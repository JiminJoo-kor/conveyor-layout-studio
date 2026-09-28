import {createSequenceSchedule} from './sequence-rack.js';
// Keep the base type so every conveyor/storage interlock remains shared.
export const equipmentVariants={
 sequenceRack:{type:'asrs',name:'서열렉',parameters:{sequenceInterval:30,sequenceCount:1,sequenceMode:'fifo',sequenceCells:[],sequenceStackers:{}}},
 boxStacker:{type:'conveyor',name:'출고용 적재기',parameters:{stackTarget:1,stackLiftTime:1,stackLowerTime:1,stackMaxHeight:10}},
 boxDestacker:{type:'conveyor',name:'입고용 분배기',parameters:{stackLiftTime:1,stackLowerTime:1,stackMaxHeight:10}}
};
export const isStackEquipment=item=>['boxStacker','boxDestacker'].includes(item?.equipmentRole);
export const isSequenceRack=item=>item?.equipmentRole==='sequenceRack';
export function sequenceConfig(item,index){const p=item.parameters||{},local=p.sequenceStackers?.[index]||{};return {interval:Number(local.interval??p.sequenceInterval??30),count:Number(local.count??p.sequenceCount??1),mode:local.mode??p.sequenceMode??'fifo',cells:local.cells??p.sequenceCells??[],seed:Number(local.seed??index+1)};}
export function variantValidationErrors(item){
 const errors=[],p=item.parameters||{},variant=equipmentVariants[item.equipmentRole];
 if(variant&&item.type!==variant.type)errors.push('설비 기능과 기본 유형이 다릅니다.');
 for(const key of ['stackTarget','initialStackCount'])if(p[key]!=null&&(!Number.isInteger(Number(p[key]))||Number(p[key])<1))errors.push(`${key}: 1 이상의 정수가 필요합니다.`);
 for(const key of ['stackLiftTime','stackLowerTime','stackMaxHeight','boxHeight'])if(p[key]!=null&&(!Number.isFinite(Number(p[key]))||Number(p[key])<=0))errors.push(`${key}: 양수가 필요합니다.`);
 if(isSequenceRack(item))for(let i=0;i<Math.max(1,Number(p.productTypes)||3);i++)try{const config=sequenceConfig(item,i);createSequenceSchedule(config);const capacity=(Number(p.rows)||2)*(Number(p.columns)||8)*(Number(p.levels)||4);if(config.cells.some(cell=>cell>=capacity))throw Error('지정 셀이 창고 범위를 벗어났습니다.');}catch(e){errors.push(`스태커 ${i+1}: ${e.message}`);}
 return errors.map(error=>`${item.name||item.id}: ${error}`);
}
