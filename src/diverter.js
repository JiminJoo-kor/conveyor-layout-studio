import { equipmentFlowPorts, equipmentPorts } from './route.js';
import { motionProfileSummary, motionProfileProgressAtTime } from './kinematics.js';

export const diverterEnabled=item=>item?.type==='conveyor'&&Number(item.parameters?.diverterEnabled)===1;
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
  return (item.parameters?.diverterDirections||[]).includes(diverterEdgeDirection(item,edge,target));
}
export function diverterProfile(item){
  const p=item?.parameters||{},config={targetSpeed:Number(p.diverterSpeed)||.5,acceleration:Number(p.diverterAcceleration)||.8,deceleration:Number(p.diverterDeceleration)||1,motionProfile:'trapezoidal'},distance=Math.max(.01,Number(p.diverterStroke)||1);
  return {...motionProfileSummary(distance,config),config};
}
export function advanceDiverterTransfer(token,item,edge,time,permitted){
  if(!diverterBranch(item,edge))return true;
  let move=token.diverterTransfer;
  if(!move||move.sourceId!==item.id||move.targetId!==edge.to){if(!permitted)return false;const profile=diverterProfile(item);move=token.diverterTransfer={sourceId:item.id,targetId:edge.to,profile,elapsed:0,lastTime:time,permitted:true,progress:0};}
  const dt=Math.max(0,time-move.lastTime);move.lastTime=time;
  if(permitted&&move.permitted)move.elapsed=Math.min(move.profile.total,move.elapsed+dt);
  move.permitted=permitted;move.progress=motionProfileProgressAtTime(move.elapsed,move.profile.distance,move.profile.config);
  return permitted&&move.elapsed+1e-9>=move.profile.total;
}
