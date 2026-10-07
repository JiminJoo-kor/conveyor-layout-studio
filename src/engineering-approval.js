import {engineeringRuntimeDecision} from './engine.js';

export const productionMotionTypes=Object.freeze(['conveyor','processLine','forkingDevice','turntable','amr','agv']);

export function approveEngineeringMotionByType(layout,types=productionMotionTypes){
 const allowed=new Set(types),approved=[];
 for(const item of layout?.equipment||[]){
  if(item.asrsStation||!allowed.has(item.type))continue;
  const decision=engineeringRuntimeDecision(item,layout);
  if(decision.status==='unsupported')continue;
  item.engineering={...(item.engineering||{}),motionRuntime:'approved'};
  approved.push(item.id);
 }
 return approved;
}
