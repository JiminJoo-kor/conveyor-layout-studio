import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFinalEngineeringReport} from '../src/final-report.js';

test('final report includes operations engineering decisions energy and topology',()=>{
 const html=buildFinalEngineeringReport({name:'A <Line>'},{realizableUph:100,twelveHours:1200,kpis:{cycleTime:12,wip:3},rows:[{process:'IN → CV',distance:5,move:10,work:2,ct:12}],bottleneckAnalysis:[{process:'IN → CV',ct:12,cause:'이송',action:'속도 검토',impact:'CT'}],whatIf:[{name:'CT 10%',basis:'추정',baselineUph:100,projectedUph:110,deltaUph:10}],energy:{method:'정격 기준',utilizationPercent:50,hours:8,ratedPowerKw:2,estimatedDemandKw:1,energyKwh:8},corrections:[{kind:'검증',detail:'통과',status:'확인'}],topology:['IN → CV']},{generatedAt:new Date('2026-01-01T00:00:00Z')});
 assert.match(html,/최종 Engineering Report/);assert.match(html,/병목 원인/);assert.match(html,/What-if/);assert.match(html,/8\.0 kWh/);assert.match(html,/IN → CV/);assert.match(html,/A &lt;Line&gt;/);assert.doesNotMatch(html,/<title>A <Line>/);
});
