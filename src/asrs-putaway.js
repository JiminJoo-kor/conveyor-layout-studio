import {buildRetrievalMission,retrievalMissionSnapshot} from './asrs-multipick.js';

export function buildPutawayMission(item,entries,profileFor,startedAt,stackerKey,stationId,pickupDuration,startPosition=null){
  const p=item.parameters||{},adapted={...item,parameters:{...p,outfeedColumn:p.infeedColumn||1,outfeedLevel:p.infeedLevel||1,retrievalTime:p.putawayTime||0}};
  const home={column:Math.max(0,(p.infeedColumn||1)-1),level:Math.max(0,(p.infeedLevel||1)-1),row:0};
  home.index=(home.column*Math.max(1,Number(p.levels)||4)+home.level)*Math.max(1,Number(p.rows)||2);
  const approach=startPosition?buildRetrievalMission(adapted,[{tokenId:null,target:home}],profileFor,startedAt,stackerKey,startPosition):null;
  if(approach){approach.segments=approach.segments.slice(0,1);approach.total=approach.segments[0].end;}
  const pickupStartedAt=startedAt+(approach?.total||0);
  const mission=buildRetrievalMission(adapted,entries,profileFor,pickupStartedAt+pickupDuration,stackerKey);
  return {...mission,stationId,approach,pickupStartedAt,pickupDuration,stage:'pickup',storedIds:[],pickedIds:entries.map(e=>e.tokenId)};
}
export function putawayMissionSnapshot(item,token,time){
  const m=token.putawayMission,progress=Math.max(0,Math.min(1,(time-m.pickupStartedAt)/m.pickupDuration));
  if(m.approach&&time<m.pickupStartedAt){const approach=retrievalMissionSnapshot(item,{...token,retrievalMission:m.approach},time);return {...approach,multiPick:false,multiPutaway:true,status:'inbound',label:'입고부 이동',phase:'approach',phaseLabel:'현재 위치에서 입고부 이동',cargoMode:'none',carriedCargo:[],cargoScale:0,infeedProgress:0};}
  const snapshot=retrievalMissionSnapshot(item,{...token,retrievalMission:{...m,completedIds:m.storedIds}},Math.max(m.startedAt,time));
  const phase=m.stage==='pickup'?'infeed':snapshot.phase==='handoff-wait'?'complete':snapshot.phase;
  if(phase==='return')snapshot.phaseLabel='입고 위치 복귀';
  return {...snapshot,multiPick:false,multiPutaway:true,status:'inbound',label:'입고중',phase,phaseLabel:phase==='infeed'?'스테이션 묶음 인수':phase==='fork'?'셀별 적재':snapshot.phaseLabel,detail:`${m.storedIds.length}/${m.entries.length}개 셀 적재`,x:m.stage==='pickup'?m.home.column:snapshot.x,y:m.stage==='pickup'?m.home.level:snapshot.y,infeedProgress:progress,cargoScale:m.stage==='pickup'?progress:1,cargoMode:m.stage==='pickup'?'none':'crane',progress:m.stage==='pickup'?progress:snapshot.progress,total:m.stage==='pickup'?m.pickupDuration:snapshot.total,elapsed:m.stage==='pickup'?progress*m.pickupDuration:snapshot.elapsed};
}
export function stationTransferPresentations(station,state){
  const result=[],smooth=p=>p*p*(3-2*p),time=state?.t||0;
  for(const token of state?.cadTokens||[]){
    const mission=token.putawayMission;
    if(mission?.stationId===station.id&&mission.stage==='pickup')result.push({token,position:mission.entries.find(e=>e.tokenId===token.id).stationPosition,scale:1-smooth(Math.max(0,Math.min(1,(time-mission.pickupStartedAt)/mission.pickupDuration))),kind:'in'});
    const deposit=token.stationOutfeedVisual;
    if(deposit?.stationId===station.id&&token.nodeId!==station.id&&token.handoffAcceptedAt!=null)result.push({token,position:deposit.position,scale:smooth(Math.max(0,Math.min(1,(time-token.handoffAcceptedAt)/token.handoffDuration))),kind:'out'});
  }return result;
}
