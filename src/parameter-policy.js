import { parameterFieldsFor } from './cad.js';

export const structuralParameterKeys = new Set(['rows','columns','levels','productTypes','stackerCount','length','shuttleDistance','travelDistance','liftHeight','strokeDistance','infeedColumn','infeedLevel','outfeedColumn','outfeedLevel']);
// Identity, cargo filters, port mappings, route membership and dock roles never copy.
export function commonParameterKeys(item, requested=null) {
  const allowed = new Set([...parameterFieldsFor(item).filter(field=>!field.readOnly).map(field=>field.key), 'autoMotionTuning','continuousHandover','handoverDelay','batchReleaseEnabled','releaseBatchSize','jerk','motionProfile','performance','efficiency','availability','mtbf','mttr','microStopInterval','microStopDuration']);
  return (requested ? [requested] : Object.keys(item.parameters || {})).filter(key=>allowed.has(key));
}
export function applyCommonParameters(layout, source, requested=null) {
  const keys=commonParameterKeys(source,requested),changed=[];
  for(const target of layout.equipment || []) {
    if(target===source||target.type!==source.type||source.type==='dock'&&target.parameters?.dockRole!==source.parameters?.dockRole)continue;
    target.parameters??={};
    for(const key of keys)if(source.parameters?.[key]!==undefined)target.parameters[key]=structuredClone(source.parameters[key]);
    if(keys.includes('length')) {target.source??={};target.source.parameterLengthUnit='m';}
    changed.push(target);
  }
  return {keys,changed,structural:keys.some(key=>structuralParameterKeys.has(key))};
}
