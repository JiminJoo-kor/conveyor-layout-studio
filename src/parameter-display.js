import {equipmentLengthMeters} from './engine.js';

// Input units are independent of the persisted simulation units (meters).
export function parameterInputField(item,field,layout){
 if(field.key!=='length')return field;
 const meters=Number(item.parameters?.length)>0?equipmentLengthMeters(item,layout):Number(field.value);
 return {...field,label:'실제 길이(mm)',value:Number((meters*1000).toFixed(6)),step:1,min:100,...(field.max==null?{}:{max:field.max*1000})};
}
export function parameterInputValue(key,value){return key==='length'?Number(value)/1000:Number(value);}
