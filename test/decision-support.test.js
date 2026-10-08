import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWhatIfScenarios,estimateLayoutEnergy,explainBottleneck} from '../src/decision-support.js';

test('bottleneck analysis records cause action and impact instead of only ranking CT',()=>{
 const result=explainBottleneck([{process:'A → B',move:8,work:2,ct:10},{process:'B → C',move:1,work:4,ct:5}]);
 assert.equal(result.length,1);assert.match(result[0].cause,/이송시간/);assert.match(result[0].action,/속도/);assert.match(result[0].impact,/80/);
});

test('what-if values are labeled as nominal sensitivity estimates',()=>{
 const scenarios=buildWhatIfScenarios([{process:'A',move:8,work:2,ct:10},{process:'B',move:1,work:7,ct:8}],100);
 assert.equal(scenarios.length,2);assert.ok(scenarios[0].projectedUph>100);assert.match(scenarios[0].basis,/민감도 추정/);assert.ok(scenarios[1].projectedUph>=scenarios[0].projectedUph);
});

test('energy estimate uses selected section motors and states its duty assumption',()=>{
 const result=estimateLayoutEnergy({cargoSpec:{length:1000,weight:100,unit:'mm'},equipment:[{id:'cv',type:'conveyor',parameters:{length:12,speed:.5,autoMotionTuning:1}}]},{hours:8,utilization:.5});
 assert.equal(result.rows[0].driveCount,2);assert.ok(result.ratedPowerKw>0);assert.equal(result.energyKwh,result.estimatedDemandKw*8);assert.equal(result.utilizationPercent,50);
});
