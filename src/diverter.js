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
