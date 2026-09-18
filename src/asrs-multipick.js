import { motionProfileProgressAtTime } from './kinematics.js';

// One mission owns every selected load until its last downstream handover.
// Entries contain IDs, not token references, so diagnostic snapshots stay serializable.
export function buildRetrievalMission(item, entries, profileFor, startedAt, stackerKey) {
  const p=item.parameters||{}, first=profileFor(item,{slotIndex:entries[0].target.index,operation:'retrieval'});
  const home={column:first.baseColumn,level:first.baseLevel,row:0};
  const segments=[]; let at=home, total=0;
  const move=(to,entry,phase)=>{
    const speed=to.level>=at.level?(p.liftSpeed||1):(p.downSpeed||p.liftSpeed||1);
    const parameters={...p,outfeedColumn:at.column+1,outfeedLevel:at.level+1,downSpeed:speed};
    const profile=profileFor({...item,parameters},{slotIndex:to.index??0,operation:'retrieval'});
    const from={...at};
    // Home uses the same cell indexing as rack targets.
    segments.push({phase,entry,from,to:{...to},profile,start:total,end:total+profile.motion,speed});
    total+=profile.motion; at=to;
    return profile;
  };
  for(const entry of entries){
    const profile=move(entry.target,entry,'travel');
    segments.push({phase:'fork',entry,from:{...at},to:{...at},profile,start:total,end:total+profile.fork});
    total+=profile.fork; entry.pickAt=total;
  }
  home.index=(home.column*Math.max(1,Number(p.levels)||4)+home.level)*Math.max(1,Number(p.rows)||2);
  move(home,entries.at(-1),'return');
  return {equipmentId:item.id,stackerKey,parameters:{...p},startedAt,total,entries,segments,home,pickedIds:[],completedIds:[],activeTokenId:entries[0].tokenId};
}

export function retrievalMissionSnapshot(item, token, time) {
  const mission=token.retrievalMission,p=mission.parameters||item.parameters||{},elapsed=Math.max(0,time-mission.startedAt);
  const segment=mission.segments.find(s=>elapsed<s.end)||null;
  const carriedCargo=mission.entries.filter(e=>mission.pickedIds.includes(e.tokenId)&&!mission.completedIds.includes(e.tokenId));
  const active=mission.activeTokenId===token.id,startedAt=mission.batchDeposit?mission.depositStartedAt:token.handoffAcceptedAt,approved=(active||mission.batchDeposit)&&startedAt!=null;
  const duration=Math.max(.1,Number(mission.batchDeposit?mission.depositDuration:token.handoffDuration)||Number(p.outfeedTime)||1);
  const outfeedProgress=approved?Math.min(1,Math.max(0,(time-startedAt)/duration)):0;
  const phase=segment?.phase||(approved?'outfeed':'handoff-wait'),profile=segment?.profile||mission.segments.at(-1).profile;
  let x=mission.home.column,y=mission.home.level,forkProgress=0,forkExtension=0;
  if(segment){
    const t=Math.max(0,elapsed-segment.start),{from,to}=segment;
    if(phase==='fork'){
      x=to.column;y=to.level;forkProgress=Math.min(1,t/Math.max(.001,profile.fork));
      const config={targetSpeed:p.forkSpeed||.65,acceleration:p.forkAcceleration||p.acceleration||1,deceleration:p.forkDeceleration||p.deceleration||1};
      forkExtension=t<=profile.forkOneWay+profile.forkDwell?motionProfileProgressAtTime(Math.min(t,profile.forkOneWay),profile.forkStroke,config):1-motionProfileProgressAtTime(t-profile.forkOneWay-profile.forkDwell,profile.forkStroke,config);
    }else{
      const px=motionProfileProgressAtTime(t,profile.horizontal,{targetSpeed:p.travelSpeed||2.5,acceleration:p.travelAcceleration||p.acceleration||.5,deceleration:p.travelDeceleration||p.deceleration||.5});
      const py=motionProfileProgressAtTime(profile.simultaneous?t:Math.max(0,t-profile.travel),profile.vertical,{targetSpeed:segment.speed,acceleration:p.liftAcceleration||p.acceleration||.5,deceleration:p.liftDeceleration||p.deceleration||.5});
      x=from.column+(to.column-from.column)*px;y=from.level+(to.level-from.level)*py;
    }
  }
  const phaseLabel={travel:'다음 셀 이동',fork:'셀 인출',return:'출고 위치 이동','handoff-wait':'출고 위치 인계 대기',outfeed:'출고 인계'}[phase];
  return {multiPick:true,status:'outbound',label:'배출중',phase,phaseLabel,detail:`${phaseLabel} · 운반 ${carriedCargo.length}/${mission.entries.length}개`,x,y,target:segment?.entry.target||token.asrsTarget,profile,forkProgress,forkExtension,outfeedProgress,infeedProgress:0,cargoMode:carriedCargo.length?'crane':'cell',cargoScale:phase==='outfeed'?1-outfeedProgress*outfeedProgress*(3-2*outfeedProgress):1,elapsed:phase==='outfeed'?outfeedProgress*duration:Math.min(elapsed,mission.total),total:phase==='outfeed'?duration:mission.total,progress:phase==='outfeed'?outfeedProgress:Math.min(1,elapsed/Math.max(.001,mission.total)),carriedCargo,currentPickId:segment?.phase==='fork'?segment.entry.tokenId:null,activeTokenId:mission.activeTokenId};
}
