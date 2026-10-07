import {engineeringRuntimeDecision,engineeringRuntimePlan} from './engine.js';

// The current runtime advances motion in 10 ms steps; stopping-point integration
// can differ slightly from the analytical profile even with identical inputs.
export const engineeringCompatibilityTolerance=Object.freeze({absoluteSeconds:.1,relative:0.02});

const rounded=value=>Number(value.toFixed(3));
// The legacy simulator measures continuous transport until the cargo has fully
// cleared the equipment. Keep that scope here so a comparison isolates motion
// dynamics instead of accidentally comparing two different travel distances.
export function engineScopedMotionRequests(item,layout){return engineeringRuntimePlan(item,layout)?.requests||[];}
export function engineScopedMotionRequest(item,layout){
 return engineScopedMotionRequests(item,layout)[0]||null;
}

export function compareEngineeringDuration(item,layout,context={},tolerance=engineeringCompatibilityTolerance){
 const runtime=engineeringRuntimeDecision(item,layout,context),legacySeconds=runtime.legacySeconds,request=engineScopedMotionRequest(item,layout);
 if(!request)return{equipmentId:item?.id,type:item?.type,status:'unsupported',applyEligible:false,legacySeconds:rounded(legacySeconds),engineeringSeconds:null,deltaSeconds:null,deltaPercent:null,reasons:['이 설비의 기존 사이클 범위 매핑이 아직 완료되지 않았습니다.']};
 const motion=runtime.motion,engineeringSeconds=runtime.engineeringSeconds,deltaSeconds=engineeringSeconds-legacySeconds,deltaPercent=legacySeconds?deltaSeconds/legacySeconds*100:0,limit=Math.max(Number(tolerance.absoluteSeconds)||0,legacySeconds*(Number(tolerance.relative)||0)),compatible=Math.abs(deltaSeconds)<=limit,reasons=[`기존 사이클 범위와 동일한 ${runtime.scope} 시간을 비교했습니다.`];
 if(runtime.motions.some(axis=>axis.automatic))reasons.push('AUTO 가감속값과 현재 시뮬레이션 가감속값의 차이를 검토해야 합니다.');
 if(!compatible)reasons.push(`CT 차이 ${Math.abs(deltaSeconds).toFixed(3)}초가 허용범위 ${limit.toFixed(3)}초를 초과했습니다.`);
 return{equipmentId:item.id,type:item.type,status:compatible?'compatible':'review',applyEligible:compatible,legacySeconds:rounded(legacySeconds),engineeringSeconds:rounded(engineeringSeconds),deltaSeconds:rounded(deltaSeconds),deltaPercent:rounded(deltaPercent),toleranceSeconds:rounded(limit),motion,motions:runtime.motions,fixedSeconds:runtime.fixedSeconds,scope:runtime.scope,reasons};
}

export function compareLayoutEngineering(layout,contextByEquipment={}){
 return(layout?.equipment||[]).map(item=>compareEngineeringDuration(item,layout,contextByEquipment[item.id]||{}));
}
