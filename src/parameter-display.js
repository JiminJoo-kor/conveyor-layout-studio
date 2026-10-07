import {equipmentLengthMeters} from './engine.js';
import {distanceParameterKeys,distanceLabel,inputDisplayValue,inputStoredValue} from './distance-units.js';

// Input units are independent of the persisted simulation units (meters).
export function parameterInputField(item,field,layout){
 if(!distanceParameterKeys.has(field.key))return field;
 const meters=field.key==='length'&&Number(item.parameters?.length)>0?equipmentLengthMeters(item,layout):Number(field.value);
 return {...field,label:distanceLabel(field.key,field.label),value:inputDisplayValue(field.key,meters),step:1,...(field.min==null?{}:{min:field.min*1000}),...(field.max==null?{}:{max:field.max*1000})};
}
export const parameterInputValue=inputStoredValue;
