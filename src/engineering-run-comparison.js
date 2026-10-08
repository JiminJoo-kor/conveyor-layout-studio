const rounded=(value,digits=3)=>Number(Number(value||0).toFixed(digits));

export function measuredRunReadiness(kpis,elapsedSeconds){
 const elapsed=Math.max(0,Number(elapsedSeconds)||0),completedCount=Math.max(0,Number(kpis?.completedCount)||0),throughput=Math.max(0,Number(kpis?.throughput)||0),cycleTime=Math.max(0,Number(kpis?.cycleTime)||0),reasons=[];
 if(elapsed<=0)reasons.push('시뮬레이션 실행 필요');
 if(completedCount<=0)reasons.push('완료 물류 필요');
 if(throughput<=0)reasons.push('실측 UPH 필요');
 if(cycleTime<=0)reasons.push('실측 CT 필요');
 return{ready:reasons.length===0,reasons,elapsedSeconds:rounded(elapsed),completedCount,throughput:rounded(throughput),cycleTime:rounded(cycleTime)};
}

export function captureMeasuredRun(kpis,elapsedSeconds,kind='baseline'){
 const elapsed=Math.max(0,Number(elapsedSeconds)||0),asrsUtilization=Number(kpis?.utilization?.asrs)||0,readiness=measuredRunReadiness(kpis,elapsed);
 return{kind,elapsedSeconds:rounded(elapsed),throughput:rounded(kpis?.throughput),cycleTime:rounded(kpis?.cycleTime),wip:Math.max(0,Number(kpis?.wip)||0),completedCount:Math.max(0,Number(kpis?.completedCount)||0),movedItems:Math.max(0,Number(kpis?.movedItems)||0),asrsUtilization:rounded(asrsUtilization,5),measured:readiness.ready,measurementReasons:readiness.reasons};
}

export function compareMeasuredRuns(baseline,engineering){
 if(!baseline?.measured)return{status:'baseline-required',baseline:null,engineering:null,rows:[]};
 if(!engineering?.measured)return{status:'engineering-required',baseline,engineering:null,rows:[]};
 const specs=[['UPH','throughput','EA/h'],['평균 CT','cycleTime','초'],['WIP','wip','EA'],['AS/RS 가동률','asrsUtilization','%']];
 const rows=specs.map(([label,key,unit])=>{const scale=key==='asrsUtilization'?100:1,before=baseline[key]*scale,after=engineering[key]*scale,delta=after-before,deltaPercent=before?delta/before*100:0;return{label,key,unit,before:rounded(before),after:rounded(after),delta:rounded(delta),deltaPercent:rounded(deltaPercent)};});
 return{status:engineering.elapsedSeconds+1e-6>=baseline.elapsedSeconds?'complete':'running',baseline,engineering,rows};
}
