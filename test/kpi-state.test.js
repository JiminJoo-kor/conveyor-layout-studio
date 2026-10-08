import test from 'node:test';
import assert from 'node:assert/strict';
import {kpiSupportingText,productionKpiState} from '../src/kpi-state.js';

test('CAD productivity distinguishes waiting warm-up and measured production',()=>{
 assert.equal(productionKpiState({mode:'cad',completedCount:0,wip:0},0),'시뮬레이션 대기');
 assert.equal(productionKpiState({mode:'cad',completedCount:0,wip:41},128),'워밍업 · 물류 41개 이동 중');
 assert.equal(productionKpiState({mode:'cad',completedCount:22,wip:90},600),'정상 생산 · 완료 22개 기준');
 assert.equal(productionKpiState({mode:'legacy'},10),'');
});

test('핵심 KPI는 측정 기준과 대기 상태를 함께 설명한다',()=>{
 assert.deepEqual(kpiSupportingText({mode:'cad',completedCount:0,wip:0,bottleneck:null}),{cycle:'완료 전 · 예상 CT',wip:'라인 내 물류 없음',bottleneck:'판정 데이터 대기'});
 assert.deepEqual(kpiSupportingText({mode:'cad',completedCount:12,wip:7,bottleneck:['conv',.8]}),{cycle:'완료 12개 평균',wip:'이동·대기 물류 합계',bottleneck:'가동률 최고 설비'});
});
