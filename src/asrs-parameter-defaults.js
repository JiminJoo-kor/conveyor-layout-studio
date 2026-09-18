export function initializeAsrsHandoverPositions(item){
 if(!['asrs','stackerCrane'].includes(item?.type))return;
 const p=item.parameters??={};
 p.infeedColumn??=1;p.infeedLevel??=1;
 p.outfeedColumn??=Math.min(8,Math.max(1,Math.round(Number(p.columns)||8)));
 p.outfeedLevel??=1;
}
