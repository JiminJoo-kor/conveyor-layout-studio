import test from 'node:test';
import assert from 'node:assert/strict';
import {captureMeasuredRun,compareMeasuredRuns} from '../src/engineering-run-comparison.js';

test('measured comparison uses engine KPIs without estimating UPH from nominal CT',()=>{
 const baseline=captureMeasuredRun({throughput:192,cycleTime:561.4075,wip:91,completedCount:48,movedItems:2208,utilization:{asrs:.59162}},900,'baseline');
 const engineering=captureMeasuredRun({throughput:160,cycleTime:631.64,wip:101,completedCount:40,movedItems:2195,utilization:{asrs:.61762}},900,'engineering');
 const result=compareMeasuredRuns(baseline,engineering);
 assert.equal(result.status,'complete');
 assert.deepEqual(result.rows.find(row=>row.key==='throughput'),{label:'UPH',key:'throughput',unit:'EA/h',before:192,after:160,delta:-32,deltaPercent:-16.667});
 assert.deepEqual(result.rows.find(row=>row.key==='asrsUtilization'),{label:'AS/RS 가동률',key:'asrsUtilization',unit:'%',before:59.162,after:61.762,delta:2.6,deltaPercent:4.395});
});

test('comparison stays pending until both measured runs exist',()=>{
 const baseline=captureMeasuredRun({throughput:100},600);
 assert.equal(compareMeasuredRuns(null,null).status,'baseline-required');
 assert.equal(compareMeasuredRuns(baseline,null).status,'engineering-required');
 assert.equal(compareMeasuredRuns(baseline,captureMeasuredRun({throughput:90},300,'engineering')).status,'running');
});
