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
