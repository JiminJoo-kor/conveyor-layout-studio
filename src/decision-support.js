import {planConveyorDriveSections} from './drive-sections.js';

const rounded=value=>Number(value.toFixed(3));

export function explainBottleneck(rows=[]){
 const ranked=[...rows].filter(row=>Number(row.ct)>0).sort((a,b)=>b.ct-a.ct);if(!ranked.length)return[];
 const maximum=ranked[0].ct;
 return ranked.filter(row=>Math.abs(row.ct-maximum)<1e-9).map(row=>{const travel=Number(row.move)||0,work=Number(row.work)||0,cause=travel>=work?'이송시간이 공정시간보다 큼':'후속 설비 작업시간이 이송시간보다 큼',action=travel>=work?'구간 분할·속도·가감속 및 병렬 이송 검토':'후속 설비 작업시간 단축 또는 병렬 설비 검토',impact=`명목 CT의 ${rounded(Math.max(travel,work)/row.ct*100)}%가 ${travel>=work?'이송':'작업'} 단계`;return{process:row.process,ct:rounded(row.ct),cause,action,impact};});
}

export function estimateLayoutEnergy(layout,{hours=8,utilization=.65}={}){
 const cargo=layout?.cargoSpec||{},operatingHours=Math.max(0,Number(hours)||0),duty=Math.max(0,Math.min(1,Number(utilization)||0)),rows=(layout?.equipment||[]).filter(item=>item.type==='conveyor'&&item.reviewStatus!=='rejected').map(item=>{const sections=planConveyorDriveSections(item,cargo),ratedPowerKw=sections.reduce((sum,section)=>sum+(Number(section.motorPowerKw)||0),0),estimatedDemandKw=ratedPowerKw*duty;return{equipmentId:item.id,equipment:item.name||item.id,driveCount:sections.length,ratedPowerKw:rounded(ratedPowerKw),estimatedDemandKw:rounded(estimatedDemandKw),energyKwh:rounded(estimatedDemandKw*operatingHours),status:sections.every(section=>section.status==='verified')?'verified':'review'};});
 return{method:'선정 모터 정격 × 가정 부하율 × 운전시간',hours:operatingHours,utilizationPercent:rounded(duty*100),ratedPowerKw:rounded(rows.reduce((sum,row)=>sum+row.ratedPowerKw,0)),estimatedDemandKw:rounded(rows.reduce((sum,row)=>sum+row.estimatedDemandKw,0)),energyKwh:rounded(rows.reduce((sum,row)=>sum+row.energyKwh,0)),rows};
}

export function buildWhatIfScenarios(rows=[],measuredUph=0){
 const bottlenecks=explainBottleneck(rows);if(!bottlenecks.length)return[];const baseCt=Math.max(...rows.map(row=>Number(row.ct)||0)),baseline=Math.max(0,Number(measuredUph)||0)||3600/baseCt;
 return[10,20].map(reductionPercent=>{const reducedCt=baseCt*(1-reductionPercent/100),otherMax=Math.max(0,...rows.filter(row=>Math.abs((Number(row.ct)||0)-baseCt)>=1e-9).map(row=>Number(row.ct)||0)),nextCt=Math.max(reducedCt,otherMax),projectedUph=baseline*baseCt/nextCt;return{name:`병목 CT ${reductionPercent}% 개선`,basis:'명목 CT 민감도 추정',changedProcess:bottlenecks.map(item=>item.process).join(', '),baselineUph:rounded(baseline),projectedUph:rounded(projectedUph),deltaUph:rounded(projectedUph-baseline),limitingCt:rounded(nextCt)};});
}
