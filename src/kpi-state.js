export function productionKpiState(kpis,time=0){
 if(kpis?.mode!=='cad')return'';
 const elapsed=Math.max(0,Number(time)||0),completed=Math.max(0,Number(kpis.completedCount)||0),wip=Math.max(0,Number(kpis.wip)||0);
 if(completed>0)return`정상 생산 · 완료 ${completed}개 기준`;
 if(elapsed<=0)return'시뮬레이션 대기';
 if(wip>0)return`워밍업 · 물류 ${wip}개 이동 중`;
 return'첫 물류 투입 대기';
}
