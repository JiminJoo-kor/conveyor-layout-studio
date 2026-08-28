export const itemVisualLength=(commonVisualLength,itemPhysicalLength,equipmentPhysicalLength)=>Math.max(1,Number(commonVisualLength)||1)*Math.max(0,Number(itemPhysicalLength)||0)/Math.max(.001,Number(equipmentPhysicalLength)||.001);
export const occupancyInterval=(center,itemLength,safetyGap=0)=>({start:center-itemLength/2-safetyGap,end:center+itemLength/2+safetyGap});
export const intervalsOverlap=(a,b)=>a.start<b.end&&b.start<a.end;

export class OccupancyManager {
  constructor(){this.byEquipment=new Map();}
  clear(){this.byEquipment.clear();}
  release(tokenId,equipmentId){const slots=this.byEquipment.get(equipmentId);if(!slots)return;slots.delete(tokenId);if(!slots.size)this.byEquipment.delete(equipmentId);}
  reserve(tokenId,equipmentId,center,itemLength,safetyGap=0){if(!this.byEquipment.has(equipmentId))this.byEquipment.set(equipmentId,new Map());this.byEquipment.get(equipmentId).set(tokenId,occupancyInterval(center,itemLength,safetyGap));}
  canOccupy(tokenId,equipmentId,center,itemLength,safetyGap=0){const candidate=occupancyInterval(center,itemLength,safetyGap);return![...(this.byEquipment.get(equipmentId)?.entries()||[])].some(([id,slot])=>id!==tokenId&&intervalsOverlap(candidate,slot));}
}

export const handoverProgress=(elapsed,itemLength,speed)=>Math.max(0,Math.min(1,elapsed/Math.max(.001,itemLength/Math.max(.001,speed))));
export const handoverVisualSegments=(progress,visualLength)=>{const entered=Math.max(0,Math.min(1,progress))*visualLength;return{sourceLength:Math.max(0,visualLength-entered),targetLength:entered};};
export const smoothstep=value=>{const t=Math.max(0,Math.min(1,Number(value)||0));return t*t*(3-2*t);};
export const handoverScale=(progress,sourceScale,targetScale)=>{const targetWeight=smoothstep(progress),sourceWeight=1-targetWeight;return{sourceWeight,targetWeight,scale:Math.max(.001,sourceScale*sourceWeight+targetScale*targetWeight)};};
export const smoothedVelocityProgress=(progress,sourceVelocity,targetVelocity)=>{const t=Math.max(0,Math.min(1,Number(progress)||0)),v0=Math.max(.001,Number(sourceVelocity)||.001),v1=Math.max(.001,Number(targetVelocity)||.001),integral=v0*t+(v1-v0)*(t*t*t-.5*t*t*t*t),total=(v0+v1)/2;return Math.max(0,Math.min(1,integral/Math.max(.001,total)));};
export const rigidHandoverVisualState=(progress,itemPhysicalLength,sourceScale,targetScale,sourceVelocity,targetVelocity)=>{const scaleState=handoverScale(progress,sourceScale,targetScale);return{...scaleState,visualLength:Math.max(1,itemPhysicalLength*scaleState.scale),routeProgress:smoothedVelocityProgress(progress,sourceVelocity,targetVelocity),visualVelocity:sourceVelocity*scaleState.sourceWeight+targetVelocity*scaleState.targetWeight};};
