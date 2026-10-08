export function productionKpiState(kpis,time=0){
 if(kpis?.mode!=='cad')return'';
 const elapsed=Math.max(0,Number(time)||0),completed=Math.max(0,Number(kpis.completedCount)||0),wip=Math.max(0,Number(kpis.wip)||0);
 if(completed>0)return`정상 생산 · 완료 ${completed}개 기준`;
 if(elapsed<=0)return'시뮬레이션 대기';
 if(wip>0)return`워밍업 · 물류 ${wip}개 이동 중`;
 return'첫 물류 투입 대기';
}

export function kpiSupportingText(kpis={}){
 if(kpis.mode!=='cad')return{cycle:'로봇 운전시간 비율',wip:'현재 공정 내 물류',bottleneck:'설비 가동률 기준'};
 const completed=Math.max(0,Number(kpis.completedCount)||0),wip=Math.max(0,Number(kpis.wip)||0);
 return{
  cycle:completed?`완료 ${completed}개 평균`:'완료 전 · 예상 CT',
  wip:wip?'이동·대기 물류 합계':'라인 내 물류 없음',
  bottleneck:kpis.bottleneck?'가동률 최고 설비':'판정 데이터 대기'
 };
}

export function dashboardKpiView(kpis={},time=0){const elapsed=Math.max(0,Number(time)||0),completed=Math.max(0,Number(kpis.completedCount)||0),measured=completed>0,throughput=Math.max(0,Number(kpis.throughput)||0),cycleTime=Math.max(0,Number(kpis.cycleTime)||0),utilization=kpis.mode==='cad'?Math.max(0,Number(kpis.utilization?.asrs)||0):Math.max(0,...Object.values(kpis.utilization||{}).map(Number));return{measured,throughputText:measured?`${throughput.toFixed(1)} EA/h`:'—',cycleText:measured?`${cycleTime.toFixed(1)}초`:'—',wipText:String(Math.max(0,Number(kpis.wip)||0)),forecast12hText:measured?`${Math.floor(throughput*12).toLocaleString()} EA`:'—',utilizationText:elapsed>0?`${(utilization*100).toFixed(1)}%`:'—',forecastState:measured?'현재 실측 UPH × 12시간':'완료 물류 후 실측',utilizationState:elapsed>0?(kpis.mode==='cad'?'AS/RS 실측 가동률':'주요 설비 최고 가동률'):'운전 데이터 대기'};}
