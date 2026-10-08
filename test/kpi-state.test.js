import test from 'node:test';
import assert from 'node:assert/strict';
import {productionKpiState} from '../src/kpi-state.js';

test('CAD productivity distinguishes waiting warm-up and measured production',()=>{
 assert.equal(productionKpiState({mode:'cad',completedCount:0,wip:0},0),'시뮬레이션 대기');
 assert.equal(productionKpiState({mode:'cad',completedCount:0,wip:41},128),'워밍업 · 물류 41개 이동 중');
 assert.equal(productionKpiState({mode:'cad',completedCount:22,wip:90},600),'정상 생산 · 완료 22개 기준');
 assert.equal(productionKpiState({mode:'legacy'},10),'');
});
