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
