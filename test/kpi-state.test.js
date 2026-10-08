import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardKpiView,kpiSupportingText,productionKpiState} from '../src/kpi-state.js';

test('CAD productivity distinguishes waiting warm-up and measured production',()=>{
 assert.equal(productionKpiState({mode:'cad',completedCount:0,wip:0},0),'시뮬레이션 대기');
 assert.equal(productionKpiState({mode:'cad',completedCount:0,wip:41,lineThroughput:[{generated:52}]},128),'운전 중 · 투입 52 · 완료 0');
 assert.equal(productionKpiState({mode:'cad',completedCount:22,wip:90},600),'정상 생산 · 완료 22개 기준');
 assert.equal(productionKpiState({mode:'legacy'},10),'');
});

test('핵심 KPI는 측정 기준과 대기 상태를 함께 설명한다',()=>{
 assert.deepEqual(kpiSupportingText({mode:'cad',completedCount:0,wip:0,bottleneck:null}),{cycle:'완료 전 · 예상 CT',wip:'라인 내 물류 없음',bottleneck:'판정 데이터 대기'});
 assert.deepEqual(kpiSupportingText({mode:'cad',completedCount:12,wip:7,bottleneck:['conv',.8]}),{cycle:'완료 12개 평균',wip:'이동·대기 물류 합계',bottleneck:'가동률 최고 설비'});
});

test('실측 완료 전에도 0 실적과 현재 물류 흐름을 숨기지 않는다',()=>{
 assert.deepEqual(dashboardKpiView({mode:'cad',completedCount:0,throughput:0,cycleTime:0,wip:12,utilization:{asrs:.25},lineThroughput:[{generated:15,asrsInbound:8,asrsOutbound:3}]},30),{measured:false,throughputText:'0.0 EA/h',cycleText:'측정 중',wipText:'12',forecast12hText:'0 EA',flowStateText:'투입 15 · 입고 8 · 출고 3 · 완료 0',utilizationText:'25.0%',forecastState:'완료 0 · 실측 생산량 대기',utilizationState:'AS/RS 실측 가동률'});
});

test('완료 물류가 있으면 실측 UPH·CT와 12시간 단순 환산을 같은 기준으로 표시한다',()=>{
 const view=dashboardKpiView({mode:'cad',completedCount:8,throughput:194.25,cycleTime:17.84,wip:36,utilization:{asrs:.842}},600);
 assert.equal(view.throughputText,'194.3 EA/h');assert.equal(view.cycleText,'17.8초');assert.equal(view.forecast12hText,'2,331 EA');assert.equal(view.utilizationText,'84.2%');assert.equal(view.measured,true);
});
