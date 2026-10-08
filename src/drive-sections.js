import {engineeringPreview,equipmentDriveDefaults,loadedPayloadFor} from './auto-engineering.js';
import {checkConveyorMechanicalLimits,conveyorMechanicalSettings,selectStandardGearbox,standardGearboxCandidates} from './mechanical-design.js';

const rounded=value=>Number(value.toFixed(3));

export function conveyorSectionCapacity(lengthM,cargoLengthM,safetyGapM=0){
 const length=Math.max(.1,Number(lengthM)||.1),cargo=Math.max(.001,Number(cargoLengthM)||1.2),gap=Math.max(0,Number(safetyGapM)||0);
 return Math.max(1,Math.floor((length+gap)/(cargo+gap)));
}

export function conveyorSectionIndex(sections,positionM){
 if(!sections.length)return-1;const position=Math.max(0,Number(positionM)||0),index=sections.findIndex(section=>position<section.endM-1e-9);return index<0?sections.length-1:index;
}

function evaluateSections(item,cargoSpec,sectionCount,options){
 const totalLength=Math.max(.1,Number(item.parameters?.length)||5),baseLength=totalLength/sectionCount,cargoLengthM=Math.max(.001,Number(cargoSpec.length)||1200)/(cargoSpec.unit==='m'?1:1000),unitPayloadKg=Math.max(0,Number(cargoSpec.weight)||0),gap=Math.max(0,Number(item.parameters?.safetyGap)||0),baseMovingMass=equipmentDriveDefaults.conveyor.movingMassKg,mechanical=conveyorMechanicalSettings(item.parameters,options.mechanical),gearboxes=options.gearboxes||standardGearboxCandidates;
 return Array.from({length:sectionCount},(_,index)=>{
  const startM=baseLength*index,endM=index===sectionCount-1?totalLength:baseLength*(index+1),lengthM=endM-startM,capacity=conveyorSectionCapacity(lengthM,cargoLengthM,gap),sectionItem={...item,id:`${item.id}-S${String(index+1).padStart(2,'0')}`,parameters:{...item.parameters,length:lengthM,capacity}},load=loadedPayloadFor(sectionItem,unitPayloadKg),movingMassKg=baseMovingMass*(lengthM/5);
  let chosen=null;
  for(const candidate of gearboxes){const preview=engineeringPreview(sectionItem,{payloadKg:load.payloadKg,movingMassKg,drive:{gearRatio:candidate.ratio,efficiency:candidate.efficiency}}),selection=preview.motorSelection,motion=preview.motions[0],gearboxSelection=selectStandardGearbox({requiredOutputTorqueNm:selection?.requirements?.outputTorqueNm,inputPowerKw:selection?.motor?.powerKw,motorRpm:selection?.requirements?.motorRpm,serviceFactor:mechanical.mechanicalServiceFactor},[candidate]),mechanicalCheck=checkConveyorMechanicalLimits({sectionLengthM:lengthM,capacity,unitPayloadKg,cargoLengthM,movingMassKg,requirements:selection?.requirements,settings:mechanical}),verified=selection?.status==='selected'&&selection?.verification?.verified&&gearboxSelection.status==='selected'&&mechanicalCheck.verified;if(verified||!chosen)chosen={preview,selection,motion,gearboxSelection,mechanicalCheck,verified};if(verified)break;}
  const {selection,motion,gearboxSelection,mechanicalCheck,verified}=chosen||{};return{id:sectionItem.id,parentId:item.id,index:index+1,name:`S${String(index+1).padStart(2,'0')}`,startM:rounded(startM),endM:rounded(endM),lengthM:rounded(lengthM),capacity,payloadKg:rounded(load.payloadKg),movingMassKg:rounded(movingMassKg),motorId:selection?.motor?.id||null,motorPowerKw:selection?.motor?.powerKw??null,gearboxId:gearboxSelection?.gearbox?.id||null,gearRatio:gearboxSelection?.gearbox?.ratio??null,gearboxUtilization:gearboxSelection?.gearbox?.torqueUtilizationPercent??null,maxDrivePayloadKg:selection?.maxPayloadKg??null,loadUtilization:selection?.loadUtilization??null,limitingFactor:mechanicalCheck?.limitingFactor||selection?.limitingFactor||null,mechanicalCheck,driveVerification:selection?.verification||null,appliedSpeed:motion?.appliedSpeed??motion?.targetSpeed??null,acceleration:motion?.acceleration??null,deceleration:motion?.deceleration??null,status:verified?'verified':'review'};
 });
}

export function designConveyorDriveSystem(item,cargoSpec={},options={}){
 if(item?.type!=='conveyor')return{status:'not-applicable',sections:[],logs:[],iterations:0};
 const totalLength=Math.max(.1,Number(item.parameters?.length)||5),maxSectionLength=Math.max(.5,Number(options.maxSectionLengthM??item.parameters?.maxSectionLengthM)||6),mechanical=conveyorMechanicalSettings(item.parameters,options.mechanical),minimum=Math.max(1,Math.ceil(totalLength/maxSectionLength)),maximum=Math.max(minimum,Number(options.maxAutomaticSections)||mechanical.maxAutomaticSections),logs=[];let sections=[],iterations=0;
 for(let count=minimum;count<=maximum;count++){iterations++;sections=evaluateSections(item,cargoSpec,count,options);const failed=sections.filter(section=>section.status!=='verified');if(!failed.length){if(count>minimum)logs.push({cause:`${minimum}개 구간 설계에서 구동계 또는 기계 허용조건 초과`,action:`구동 구간을 ${count}개로 자동 재분할`,impact:`구간당 길이 ${rounded(totalLength/count)}m · 모든 정/역산 및 허용조건 통과`});return{status:'verified',sections,logs,iterations,initialSectionCount:minimum,finalSectionCount:count};}const unsplittable=failed.some(section=>section.mechanicalCheck?.unsplittable);if(unsplittable){logs.push({cause:'단일 물류가 롤러 또는 프레임 집중하중을 초과',action:'구간 추가 대신 기계 사양 상향 필요',impact:failed.flatMap(section=>section.mechanicalCheck.failedKeys).join(', ')});break;}}
 logs.push({cause:'표준 모터·감속기 또는 기계 허용조건 내 설계 불가',action:'기계 사양/속도/물류 조건 검토',impact:`최대 ${sections.length}개 구간까지 검토`});return{status:'review',sections,logs,iterations,initialSectionCount:minimum,finalSectionCount:sections.length};
}

export function planConveyorDriveSections(item,cargoSpec={},options={}){
 return designConveyorDriveSystem(item,cargoSpec,options).sections;
}
