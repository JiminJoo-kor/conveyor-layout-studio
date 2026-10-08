import test from 'node:test';
import assert from 'node:assert/strict';
import {captureMeasuredInterval,captureMeasuredRun,captureMeasurementSnapshot,compareMeasuredRuns,measuredRunReadiness,recommendedMeasurementWindow} from '../src/engineering-run-comparison.js';

test('measured comparison uses engine KPIs without estimating UPH from nominal CT',()=>{
 const baseline=captureMeasuredRun({throughput:192,cycleTime:561.4075,wip:91,completedCount:48,movedItems:2208,utilization:{asrs:.59162}},900,'baseline');
 const engineering=captureMeasuredRun({throughput:160,cycleTime:631.64,wip:101,completedCount:40,movedItems:2195,utilization:{asrs:.61762}},900,'engineering');
 const result=compareMeasuredRuns(baseline,engineering);
 assert.equal(result.status,'complete');
 assert.deepEqual(result.rows.find(row=>row.key==='throughput'),{label:'UPH',key:'throughput',unit:'EA/h',before:192,after:160,delta:-32,deltaPercent:-16.667});
 assert.deepEqual(result.rows.find(row=>row.key==='asrsUtilization'),{label:'AS/RS 가동률',key:'asrsUtilization',unit:'%',before:59.162,after:61.762,delta:2.6,deltaPercent:4.395});
});

test('comparison stays pending until both measured runs exist',()=>{
 const baseline=captureMeasuredRun({throughput:100,cycleTime:36,completedCount:10},600);
 assert.equal(compareMeasuredRuns(null,null).status,'baseline-required');
 assert.equal(compareMeasuredRuns(baseline,null).status,'engineering-required');
 assert.equal(compareMeasuredRuns(baseline,captureMeasuredRun({throughput:90,cycleTime:40,completedCount:8},300,'engineering')).status,'running');
});

test('elapsed time without completed cargo is not accepted as a measured baseline',()=>{
 const readiness=measuredRunReadiness({throughput:0,cycleTime:0,completedCount:0,wip:81},300),run=captureMeasuredRun({throughput:0,cycleTime:0,completedCount:0,wip:81},300);
 assert.equal(readiness.ready,false);assert.ok(readiness.reasons.includes('완료 물류 필요'));assert.equal(run.measured,false);
});

test('measured interval excludes warm-up counts and uses only interval utilization',()=>{
 const state={t:900,cadTokens:Array(10),movedItems:100,completedProducts:[{cycleTime:120},{cycleTime:140}],warehouses:{rack:{busyTime:300,stackerCount:2}}},engine={state},start=captureMeasurementSnapshot(engine);
 state.t=1500;state.cadTokens=Array(14);state.movedItems=160;state.completedProducts.push({cycleTime:160},{cycleTime:180},{cycleTime:200});state.warehouses.rack.busyTime=660;
 const run=captureMeasuredInterval(engine,start,'engineering');
 assert.deepEqual({elapsed:run.elapsedSeconds,warmup:run.warmupSeconds,total:run.totalElapsedSeconds,completed:run.completedCount,throughput:run.throughput,cycleTime:run.cycleTime,wip:run.wip,moved:run.movedItems,utilization:run.asrsUtilization},{elapsed:600,warmup:900,total:1500,completed:3,throughput:18,cycleTime:180,wip:14,moved:60,utilization:.3});
 assert.equal(run.measured,true);
});

test('ASRS projects recommend a 900 second measured comparison window',()=>{
 const storage=recommendedMeasurementWindow({equipment:[{type:'asrs'}]},300),ordinary=recommendedMeasurementWindow({equipment:[{type:'conveyor'}]},300),longConfigured=recommendedMeasurementWindow({equipment:[{type:'asrs'}]},1200);
 assert.deepEqual([storage.seconds,storage.needsExtension],[900,true]);assert.deepEqual([ordinary.seconds,ordinary.minimumSeconds],[600,600]);assert.deepEqual([longConfigured.seconds,longConfigured.needsExtension],[1200,false]);
 assert.deepEqual([storage.warmupSeconds,storage.measurementSeconds,storage.totalSeconds],[900,900,1800]);assert.deepEqual([ordinary.warmupSeconds,ordinary.measurementSeconds,ordinary.totalSeconds],[300,600,900]);
});
