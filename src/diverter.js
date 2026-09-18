import { equipmentFlowPorts, equipmentPorts } from './route.js';
import { motionProfileSummary, motionProfileProgressAtTime } from './kinematics.js';

export const diverterEnabled=item=>item?.type==='conveyor'&&Number(item.parameters?.diverterEnabled)===1;
export const movingDiverter=item=>diverterEnabled(item)&&item.parameters?.diverterMotionMode==='moving';
export const directionAxis=direction=>['up','down'].includes(direction)?'vertical':['left','right'].includes(direction)?'horizontal':null;
export function toggleDiverterDirection(directions,direction){
  const selected=Array.isArray(directions)?directions:[],axis=directionAxis(direction);
  if(!axis||selected.some(entry=>directionAxis(entry)!==axis))return selected.slice();
  return selected.includes(direction)?selected.filter(entry=>entry!==direction):[...selected,direction];
}
export function diverterEdgeDirection(item,edge,target){
  const port=equipmentPorts(item)[edge?.fromPort],point=port||target;if(!point)return null;
  const dx=point.x-item.x,dy=point.y-item.y;
  return Math.abs(dx)>=Math.abs(dy)?dx>=0?'right':'left':dy>=0?'down':'up';
}
export function diverterBranch(item,edge){return diverterEnabled(item)&&edge?.from===item.id&&edge.fromPort!==equipmentFlowPorts(item).output;}
export function diverterAllowsEdge(item,edge,target){
  if(!diverterEnabled(item)||edge.fromPort===equipmentFlowPorts(item).output)return true;
  if(Array.isArray(item.parameters?.diverterPorts))return edge.fromPort!==equipmentFlowPorts(item).input&&item.parameters.diverterPorts.includes(edge.fromPort);
  return (item.parameters?.diverterDirections||[]).includes(diverterEdgeDirection(item,edge,target));
}
// Port IDs are local to the equipment; rotating the drawing must not remap rules.
export const diverterRouteKey=edge=>JSON.stringify([edge.fromPort||'',edge.to,edge.toPort||'']);
export function diverterRouteIndex(item,options,token={},count=0){
  const p=item.parameters||{},mode=p.diverterRoutingMode||'rules';
  const straight=options.findIndex(edge=>edge.fromPort===equipmentFlowPorts(item).output);
  if(mode==='straight')return straight;
  if(mode==='ratio'){
    const weights=options.map(edge=>Math.max(0,Math.round(Number(p.diverterWeights?.[diverterRouteKey(edge)])||0)));
    const total=weights.reduce((sum,value)=>sum+value,0);if(!total)return straight;
    let slot=count%total;for(let i=0;i<weights.length;i++){if(slot<weights[i])return i;slot-=weights[i];}
  }
  if(mode==='available')return straight>=0?straight:0;
  const rule=(p.diverterRules||[]).find(rule=>{
    const value=rule.field==='destination'?token.destinationId||token.outboundFlowKey:token.cargoPatternKey||token.cargoType||token.originFlowKey;
    return String(value??'')===String(rule.value)&&rule.value!=='';
  });
  return rule?options.findIndex(edge=>diverterRouteKey(edge)===rule.route):straight;
}
export function diverterAvailableIndex(item,options,preferred,available){
  if(preferred>=0&&available(options[preferred]))return preferred;
  const p=item.parameters||{},alternatives=p.diverterAlternatives||[];
  if(p.diverterRoutingMode!=='available'&&!alternatives.length)return preferred;
  const index=options.findIndex(edge=>(p.diverterRoutingMode==='available'||alternatives.includes(diverterRouteKey(edge)))&&available(edge));
  return index>=0?index:preferred;
}
export function diverterDynamics(item,distanceOverride=null,initialSpeed=null){
  const p=item?.parameters||{},distance=Math.max(.001,Number(distanceOverride??p.diverterStroke)||1),speed=Math.max(.01,Number(p.diverterSpeed)||.5);
  if(Number(p.diverterAutoDynamics)!==1)return{acceleration:Number(p.diverterAcceleration)||.8,deceleration:Number(p.diverterDeceleration)||1};
  const reference=movingDiverter(item)?Math.max(speed,Number(initialSpeed??p.speed)||0):speed,rate=Math.max(.1,reference*reference/(.5*distance));
  return{acceleration:rate,deceleration:rate};
}
export function updateDiverterParameter(item,key,value){
  item.parameters??={};item.parameters[key]=value;if(key==='diverterEnabled'&&value===1)item.parameters.diverterAutoDynamics??=1;
  if(Number(item.parameters.diverterAutoDynamics)===1){const rates=diverterDynamics(item);item.parameters.diverterAcceleration=rates.acceleration;item.parameters.diverterDeceleration=rates.deceleration;}
}
export function diverterProfile(item,initialSpeed=null,distanceOverride=null){
  const p=item?.parameters||{},config={targetSpeed:Number(p.diverterSpeed)||.5,...diverterDynamics(item,distanceOverride,initialSpeed),motionProfile:'trapezoidal'},distance=Math.max(.01,Number(p.diverterStroke)||1);
  if(!movingDiverter(item))return {...motionProfileSummary(distance,config),config};
  const d=distanceOverride??distance,startSpeed=Math.max(0,initialSpeed??(Number(p.speed)||0)),target=config.targetSpeed,rate=target>=startSpeed?config.acceleration:-config.deceleration;
  const rampDistance=Math.abs(target*target-startSpeed*startSpeed)/(2*Math.abs(rate)),rampEndSpeed=rampDistance>d?Math.sqrt(Math.max(0,startSpeed*startSpeed+2*rate*d)):target;
  const rampTime=Math.abs(rampEndSpeed-startSpeed)/Math.abs(rate),s1=Math.min(d,rampDistance),s2=Math.max(0,d-s1),t2=s2/Math.max(.000001,rampEndSpeed);
  return{moving:true,distance:d,startSpeed,endSpeed:rampEndSpeed,peakSpeed:Math.max(startSpeed,rampEndSpeed),rate,rampTime,t1:rampTime,t2,t3:0,s1,s2,s3:0,total:rampTime+t2,config};
}
export function diverterMotionAtTime(profile,time){
  const t=Math.max(0,Math.min(profile.total,time)),r=Math.min(t,profile.rampTime);
  return{position:Math.min(profile.distance,Math.max(0,profile.startSpeed*r+.5*profile.rate*r*r+profile.endSpeed*Math.max(0,t-r))),velocity:t<profile.rampTime?Math.max(0,profile.startSpeed+profile.rate*t):profile.endSpeed};
}
export function advanceDiverterTransfer(token,item,edge,time,permitted){
  if(!diverterBranch(item,edge))return true;
  let move=token.diverterTransfer;
  if(!move||move.sourceId!==item.id||move.targetId!==edge.to){if(!permitted)return false;const profile=diverterProfile(item,Number(token.motion?.controller.velocity??token.motionState?.velocity)||0);move=token.diverterTransfer={sourceId:item.id,targetId:edge.to,profile,elapsed:0,lastTime:time,permitted:true,progress:0,velocity:profile.startSpeed||0,offset:0,totalDistance:profile.distance};}
  const dt=Math.max(0,time-move.lastTime);move.lastTime=time;
  if(move.profile.moving){
    if(!permitted){move.permitted=false;move.velocity=0;return false;}
    if(!move.permitted){move.offset=move.progress*move.totalDistance;move.profile=diverterProfile(item,0,Math.max(0,move.totalDistance-move.offset));move.elapsed=0;}
    else move.elapsed=Math.min(move.profile.total,move.elapsed+dt);
    move.permitted=true;const sample=diverterMotionAtTime(move.profile,move.elapsed);move.velocity=sample.velocity;move.progress=Math.min(1,(move.offset+sample.position)/move.totalDistance);
    return move.progress>=1-1e-9;
  }
  if(permitted&&move.permitted)move.elapsed=Math.min(move.profile.total,move.elapsed+dt);
  move.permitted=permitted;move.progress=motionProfileProgressAtTime(move.elapsed,move.profile.distance,move.profile.config);
  return permitted&&move.elapsed+1e-9>=move.profile.total;
}
