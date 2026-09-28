import {validateStack,stackCompatible,stackMetrics,combineStacks,splitBottom} from './stack-cargo.js';

const positive=(v,fallback)=>Number.isFinite(v)&&v>0?v:fallback;
export function createStackMachine({mode='stack',targetCount=1,liftSeconds=1,lowerSeconds=1,maxWeight=1000,maxHeight=10}={}){
 if(!['stack','unstack'].includes(mode))throw Error('잘못된 적재·분배 모드');
 if(!Number.isInteger(targetCount)||targetCount<1)throw Error('적재 수량은 1 이상의 정수여야 합니다.');
 return {mode,targetCount,liftSeconds:positive(liftSeconds,1),lowerSeconds:positive(lowerSeconds,1),maxWeight:positive(maxWeight,1000),maxHeight:positive(maxHeight,10),phase:'waiting',elapsed:0,held:[],deck:[],outgoing:[],stopperUp:true,releaseToken:null,completedBoxes:0,initialCount:0};
}
export function canStackMachineReceive(s,layers){
 try{
  validateStack(layers);
  if(!['waiting','holding'].includes(s.phase)||s.deck.length||s.outgoing.length||!s.stopperUp)return {allowed:false,reason:'설비 작업 중'};
  const all=[...layers,...s.held],m=stackMetrics(all);
  if(m.weight>s.maxWeight||m.height>s.maxHeight)return {allowed:false,reason:'적재 하중 또는 높이 초과'};
  if(s.mode==='stack'&&(layers.length!==1||all.length>s.targetCount))return {allowed:false,reason:'단품 입고 또는 목표 수량 조건 불충족'};
  if(s.mode==='stack'&&!all.every(l=>stackCompatible(all[0],l)))return {allowed:false,reason:'빈 박스 종류·규격 불일치'};
  if(s.mode==='unstack'&&s.held.length)return {allowed:false,reason:'이전 묶음 분배 중'};
  return {allowed:true,reason:null};
 }catch(error){return {allowed:false,reason:error.message};}
}
// Call only after the shared conveyor confirms complete infeed, never on entry reservation.
export function receiveStack(s,layers){
 const check=canStackMachineReceive(s,layers);if(!check.allowed)throw Error(check.reason);
 s.deck=structuredClone(layers);s.elapsed=0;s.initialCount=s.mode==='unstack'?layers.length:s.targetCount;
 if(s.mode==='stack')s.phase=s.held.length?'lowering':s.deck.length===s.targetCount?'ready':'lifting';
 else s.phase=s.deck.length===1?'ready':'separating';
}
export function advanceStackMachine(s,dt,{available=true}={}){
 if(!Number.isFinite(dt)||dt<0)throw Error('잘못된 시간 간격');
 if(!available)return;
 // A phase never starts belt transfer; shared conveyor approval owns that boundary.
 if(!['lowering','lifting','separating','lower-remainder'].includes(s.phase))return;
 const lowering=['lowering','lower-remainder'].includes(s.phase),duration=lowering?s.lowerSeconds:s.liftSeconds;
 s.elapsed=Math.min(duration,s.elapsed+dt);if(s.elapsed+1e-9<duration)return;
 if(s.phase==='lowering'){
  s.deck=combineStacks(s.deck,s.held,s);s.held=[];s.phase=s.deck.length===s.targetCount?'ready':'lifting';
 }else if(s.phase==='lifting'){s.held=s.deck;s.deck=[];s.phase='holding';}
 else if(s.phase==='separating'){const split=splitBottom(s.deck);s.deck=split.released;s.held=split.held;s.phase='ready';}
 else{s.deck=s.held;s.held=[];s.phase=s.deck.length>1?'separating':'ready';}
 s.elapsed=0;
}
// Reservation must be produced by the existing conveyor handshake, not a local timer.
export function startStackRelease(s,{reservationId,downstreamApproved,beltPermit}={}){
 if(s.phase!=='ready'||!downstreamApproved||!beltPermit||reservationId==null)return false;
 s.outgoing=s.deck;s.deck=[];s.releaseToken=reservationId;s.stopperUp=false;s.phase='releasing';return true;
}
// No automatic rollback or stopper rise while cargo straddles the transfer boundary.
export function completeStackRelease(s,{reservationId,tailCleared,downstreamAccepted}={}){
 if(s.phase!=='releasing'||reservationId!==s.releaseToken||!tailCleared||!downstreamAccepted)return null;
 const released=s.outgoing;s.completedBoxes+=released.length;s.outgoing=[];s.releaseToken=null;s.stopperUp=true;
 s.phase=s.held.length?'lower-remainder':'waiting';s.elapsed=0;return structuredClone(released);
}
export function stackMachineStatus(s){
 const total=s.held.length+s.deck.length+s.outgoing.length,duration=['lowering','lower-remainder'].includes(s.phase)?s.lowerSeconds:s.liftSeconds,progress=['lifting','lowering','separating','lower-remainder'].includes(s.phase)?Math.min(1,s.elapsed/duration):0;
 const lift=['lifting','separating'].includes(s.phase)?progress:['lowering','lower-remainder'].includes(s.phase)?1-progress:s.held.length?1:0;
 return {phase:s.phase,count:total,held:s.held.length,deck:s.deck.length,outgoing:s.outgoing.length,target:s.mode==='stack'?s.targetCount:s.initialCount,remaining:s.mode==='stack'?Math.max(0,s.targetCount-total):total,remainingPercent:s.mode==='stack'?100*Math.max(0,s.targetCount-total)/s.targetCount:100*total/Math.max(1,s.initialCount),progress,stopperUp:s.stopperUp,liftProgress:lift,visualScale:1+.12*lift};
}
