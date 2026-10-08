import {engineeringPreview,equipmentDriveDefaults,loadedPayloadFor} from './auto-engineering.js';

const rounded=value=>Number(value.toFixed(3));

export function conveyorSectionCapacity(lengthM,cargoLengthM,safetyGapM=0){
 const length=Math.max(.1,Number(lengthM)||.1),cargo=Math.max(.001,Number(cargoLengthM)||1.2),gap=Math.max(0,Number(safetyGapM)||0);
 return Math.max(1,Math.floor((length+gap)/(cargo+gap)));
}

export function planConveyorDriveSections(item,cargoSpec={},options={}){
 if(item?.type!=='conveyor')return[];
 const totalLength=Math.max(.1,Number(item.parameters?.length)||5),maxSectionLength=Math.max(.5,Number(options.maxSectionLengthM??item.parameters?.maxSectionLengthM)||6),sectionCount=Math.max(1,Math.ceil(totalLength/maxSectionLength)),baseLength=totalLength/sectionCount,cargoLengthM=Math.max(.001,Number(cargoSpec.length)||1200)/(cargoSpec.unit==='m'?1:1000),unitPayloadKg=Math.max(0,Number(cargoSpec.weight)||0),gap=Math.max(0,Number(item.parameters?.safetyGap)||0),baseMovingMass=equipmentDriveDefaults.conveyor.movingMassKg;
 return Array.from({length:sectionCount},(_,index)=>{
  const startM=baseLength*index,endM=index===sectionCount-1?totalLength:baseLength*(index+1),lengthM=endM-startM,capacity=conveyorSectionCapacity(lengthM,cargoLengthM,gap),sectionItem={...item,id:`${item.id}-S${String(index+1).padStart(2,'0')}`,parameters:{...item.parameters,length:lengthM,capacity}},load=loadedPayloadFor(sectionItem,unitPayloadKg),movingMassKg=baseMovingMass*(lengthM/5),preview=engineeringPreview(sectionItem,{payloadKg:load.payloadKg,movingMassKg}),selection=preview.motorSelection;
  return{id:sectionItem.id,parentId:item.id,index:index+1,name:`S${String(index+1).padStart(2,'0')}`,startM:rounded(startM),endM:rounded(endM),lengthM:rounded(lengthM),capacity,payloadKg:rounded(load.payloadKg),movingMassKg:rounded(movingMassKg),motorId:selection?.motor?.id||null,motorPowerKw:selection?.motor?.powerKw??null,maxDrivePayloadKg:selection?.maxPayloadKg??null,loadUtilization:selection?.loadUtilization??null,limitingFactor:selection?.limitingFactor??null,status:selection?.status||'unsupported'};
 });
}
