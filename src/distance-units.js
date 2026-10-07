// Persist meters; present geometric input in millimeters. Speeds/accelerations stay SI.
export const distanceParameterKeys=new Set(['length','width','travelDistance','shuttleDistance','liftHeight','columnPitch','levelHeight','pitch','strokeDistance','forkStroke','safetyGap','stationSafetyGap','diverterStroke','stackMaxHeight','boxHeight']);
export const distanceLabel=(key,label)=>distanceParameterKeys.has(key)?label.replace(/\(m\)/g,'(mm)'):label;
export const inputDisplayValue=(key,value)=>distanceParameterKeys.has(key)?Number((Number(value)*1000).toFixed(6)):Number(value);
export const inputStoredValue=(key,value)=>distanceParameterKeys.has(key)?Number(value)/1000:Number(value);
