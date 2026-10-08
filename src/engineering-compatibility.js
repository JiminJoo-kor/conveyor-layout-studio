import {engineeringRuntimeDecision,engineeringRuntimePlan} from './engine.js';

// The current runtime advances motion in 10 ms steps; stopping-point integration
// can differ slightly from the analytical profile even with identical inputs.
export const engineeringCompatibilityTolerance=Object.freeze({absoluteSeconds:.1,relative:0.02});

const rounded=value=>Number(value.toFixed(3));
// The legacy simulator measures continuous transport until the cargo has fully
// cleared the equipment. Keep that scope here so a comparison isolates motion
// dynamics instead of accidentally comparing two different travel distances.
export function engineScopedMotionRequests(item,layout,context={}){return engineeringRuntimePlan(item,layout,context)?.requests||[];}
export function engineScopedMotionRequest(item,layout,context={}){
 return engineScopedMotionRequests(item,layout,context)[0]||null;
}

export function compareEngineeringDuration(item,layout,context={},tolerance=engineeringCompatibilityTolerance){
 const runtime=engineeringRuntimeDecision(item,layout,context),legacySeconds=runtime.legacySeconds,request=engineScopedMotionRequest(item,layout,context);
 if(!request)return{equipmentId:item?.id,type:item?.type,status:'unsupported',applyEligible:false,legacySeconds:rounded(legacySeconds),engineeringSeconds:null,deltaSeconds:null,deltaPercent:null,reasons:['이 설비의 기존 사이클 범위 매핑이 아직 완료되지 않았습니다.']};
 const motion=runtime.motion,engineeringSeconds=runtime.engineeringSeconds,deltaSeconds=engineeringSeconds-legacySeconds,deltaPercent=legacySeconds?deltaSeconds/legacySeconds*100:0,limit=Math.max(Number(tolerance.absoluteSeconds)||0,legacySeconds*(Number(tolerance.relative)||0)),compatible=Math.abs(deltaSeconds)<=limit,approved=runtime.approved&&!compatible,reasons=[`기존 사이클 범위와 동일한 ${runtime.scope} 시간을 비교했습니다.`];
 if(runtime.motions.some(axis=>axis.automatic))reasons.push('AUTO 가감속값과 현재 시뮬레이션 가감속값의 차이를 검토해야 합니다.');
 if(!compatible)reasons.push(`CT 차이 ${Math.abs(deltaSeconds).toFixed(3)}초가 허용범위 ${limit.toFixed(3)}초를 초과했습니다.`);
 if(approved)reasons.push('설비별 검토 승인을 통해 계산된 motion을 시뮬레이션에 적용합니다.');
 return{equipmentId:item.id,type:item.type,status:compatible?'compatible':approved?'approved':'review',applyEligible:compatible||approved,legacySeconds:rounded(legacySeconds),engineeringSeconds:rounded(engineeringSeconds),deltaSeconds:rounded(deltaSeconds),deltaPercent:rounded(deltaPercent),toleranceSeconds:rounded(limit),motion,motions:runtime.motions,fixedSeconds:runtime.fixedSeconds,scope:runtime.scope,reasons};
}

export function compareLayoutEngineering(layout,contextByEquipment={}){
 return(layout?.equipment||[]).map(item=>compareEngineeringDuration(item,layout,contextByEquipment[item.id]||{}));
}

export function engineeringAuditContexts(item){
 if(!['asrs','stackerCrane'].includes(item?.type))return[{key:'cycle',label:'운전 사이클',context:{}}];
 const p=item.parameters||{},lastSlot=Math.max(0,Math.max(1,Number(p.rows)||1)*Math.max(1,Number(p.columns)||1)*Math.max(1,Number(p.levels)||1)-1);
 return[{key:'putaway',label:'최장거리 입고',context:{slotIndex:lastSlot,operation:'putaway'}},{key:'retrieval',label:'최장거리 출고',context:{slotIndex:lastSlot,operation:'retrieval'}}];
}

export function buildEngineeringMotionAudit(layout){
 const equipment=(layout?.equipment||[]).filter(item=>!item.asrsStation&&item.reviewStatus!=='rejected'),rows=[];
 for(const item of equipment)for(const audit of engineeringAuditContexts(item)){const result=compareEngineeringDuration(item,layout,audit.context),runtime=engineeringRuntimeDecision(item,layout,audit.context);rows.push({...result,contextKey:audit.key,contextLabel:audit.label,equipmentName:item.name||item.id,runtimeApplied:runtime.apply});}
 const counts={compatible:0,approved:0,review:0,unsupported:0};for(const row of rows)counts[row.status]=(counts[row.status]||0)+1;
 return{equipmentCount:equipment.length,contextCount:rows.length,counts,ready:counts.review===0&&counts.unsupported===0,rows};
}
