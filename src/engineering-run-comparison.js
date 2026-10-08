import {completedCycleSum,historyCount} from './history-memory.js';

const rounded=(value,digits=3)=>Number(Number(value||0).toFixed(digits));

export function measuredRunReadiness(kpis,elapsedSeconds){
 const elapsed=Math.max(0,Number(elapsedSeconds)||0),completedCount=Math.max(0,Number(kpis?.completedCount)||0),throughput=Math.max(0,Number(kpis?.throughput)||0),cycleTime=Math.max(0,Number(kpis?.cycleTime)||0),reasons=[];
 if(elapsed<=0)reasons.push('시뮬레이션 실행 필요');
 if(completedCount<=0)reasons.push('완료 물류 필요');
 if(throughput<=0)reasons.push('실측 UPH 필요');
 if(cycleTime<=0)reasons.push('실측 CT 필요');
 return{ready:reasons.length===0,reasons,elapsedSeconds:rounded(elapsed),completedCount,throughput:rounded(throughput),cycleTime:rounded(cycleTime)};
}

export function recommendedMeasurementWindow(layout,configuredSeconds=0){
 const hasStorage=(layout?.equipment||[]).some(item=>!item.asrsStation&&['asrs','stackerCrane'].includes(item.type)),minimumSeconds=hasStorage?900:600,warmupSeconds=hasStorage?900:300,configured=Math.max(0,Number(configuredSeconds)||0),seconds=Math.max(minimumSeconds,configured);
 return{seconds,measurementSeconds:seconds,warmupSeconds,totalSeconds:warmupSeconds+seconds,minimumSeconds,configuredSeconds:configured,needsExtension:configured<minimumSeconds,reason:hasStorage?'AS/RS 입고·반출 흐름을 먼저 채운 뒤 최종 출고를 별도 측정':'초기 WIP를 채운 뒤 완료 물류를 별도 측정'};
}

export function captureMeasuredRun(kpis,elapsedSeconds,kind='baseline'){
 const elapsed=Math.max(0,Number(elapsedSeconds)||0),asrsUtilization=Number(kpis?.utilization?.asrs)||0,readiness=measuredRunReadiness(kpis,elapsed);
 return{kind,elapsedSeconds:rounded(elapsed),throughput:rounded(kpis?.throughput),cycleTime:rounded(kpis?.cycleTime),wip:Math.max(0,Number(kpis?.wip)||0),completedCount:Math.max(0,Number(kpis?.completedCount)||0),movedItems:Math.max(0,Number(kpis?.movedItems)||0),asrsUtilization:rounded(asrsUtilization,5),measured:readiness.ready,measurementReasons:readiness.reasons};
}

export function captureMeasurementSnapshot(engine){
 const state=engine?.state||{},warehouses=Object.values(state.warehouses||{});
 return{elapsedSeconds:Math.max(0,Number(state.t)||0),completedCount:historyCount(state,'completedProducts'),completedCycleSum:completedCycleSum(state),movedItems:Math.max(0,Number(state.movedItems)||0),asrsBusyTime:warehouses.reduce((sum,item)=>sum+(Number(item.busyTime)||0),0),stackerCount:warehouses.reduce((sum,item)=>sum+Math.max(1,Number(item.stackerCount)||1),0)};
}

export function captureMeasuredInterval(engine,start,kind='baseline'){
 const end=captureMeasurementSnapshot(engine),elapsed=Math.max(0,end.elapsedSeconds-(Number(start?.elapsedSeconds)||0)),completedCount=Math.max(0,end.completedCount-(Number(start?.completedCount)||0)),cycleSum=Math.max(0,end.completedCycleSum-(Number(start?.completedCycleSum)||0)),movedItems=Math.max(0,end.movedItems-(Number(start?.movedItems)||0)),busyTime=Math.max(0,end.asrsBusyTime-(Number(start?.asrsBusyTime)||0)),asrsUtilization=elapsed>0&&end.stackerCount>0?busyTime/(elapsed*end.stackerCount):0,kpis={throughput:elapsed>0?completedCount/elapsed*3600:0,cycleTime:completedCount>0?cycleSum/completedCount:0,wip:engine?.state?.cadTokens?.length||0,completedCount,movedItems,utilization:{asrs:asrsUtilization}},run=captureMeasuredRun(kpis,elapsed,kind);
 return{...run,warmupSeconds:rounded(start?.elapsedSeconds),totalElapsedSeconds:rounded(end.elapsedSeconds)};
}

export function compareMeasuredRuns(baseline,engineering){
 if(!baseline?.measured)return{status:'baseline-required',baseline:null,engineering:null,rows:[]};
 if(!engineering?.measured)return{status:'engineering-required',baseline,engineering:null,rows:[]};
 const specs=[['UPH','throughput','EA/h'],['평균 CT','cycleTime','초'],['WIP','wip','EA'],['AS/RS 가동률','asrsUtilization','%']];
 const rows=specs.map(([label,key,unit])=>{const scale=key==='asrsUtilization'?100:1,before=baseline[key]*scale,after=engineering[key]*scale,delta=after-before,deltaPercent=before?delta/before*100:0;return{label,key,unit,before:rounded(before),after:rounded(after),delta:rounded(delta),deltaPercent:rounded(deltaPercent)};});
 return{status:engineering.elapsedSeconds+1e-6>=baseline.elapsedSeconds?'complete':'running',baseline,engineering,rows};
}
