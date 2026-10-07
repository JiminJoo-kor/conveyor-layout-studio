import test from 'node:test';
import assert from 'node:assert/strict';
import {appendHistory,historyCount,completedCycleSum,completedBoxCount,HISTORY_LIMITS} from '../src/history-memory.js';
import {CadFlowEngine,simulationEventText} from '../src/engine.js';
import {drawAsrsScene} from '../src/asrs-monitor.js';

test('200000 events remain bounded and whole-run KPI totals survive compaction and reset',()=>{
 const e=new CadFlowEngine({equipment:[{id:'stack',type:'conveyor',equipmentRole:'boxStacker',parameters:{length:5}}],cadSchematic:{edges:[],inboundBranches:[{name:'line',nodeIds:[]}]}});
 for(let i=0;i<200000;i++)e.emit('source-injected',{flowKey:'line',productId:i});
 e.state.t=1000;
 for(let i=0;i<5000;i++)appendHistory(e.state,'completedProducts',{id:i,cycleTime:4,boxCount:8,stackLayers:Array.from({length:8},(_,n)=>({id:`${i}:${n}`}))});
 const k=e.getKpis();assert.equal(k.completedCount,5000);assert.equal(k.completedBoxes,40000);assert.equal(k.cycleTime,4);assert.equal(k.throughput,18000);assert.equal(k.lineThroughput[0].generated,200000);
 assert.ok(e.state.events.length<=HISTORY_LIMITS.events);assert.ok(e.state.completedProducts.length<=HISTORY_LIMITS.completedProducts);
 assert.equal(historyCount(e.state,'events'),200000);assert.match(simulationEventText(e.state),/개별 상세는 제공되지 않습니다/);
 assert.equal(Object.keys(e.state.historySummary.eventCounts).length,1);
 e.reset();assert.equal(e.state.historySummary,undefined);assert.equal(historyCount(e.state,'events'),0);assert.equal(e.getKpis().completedCount,0);
});
test('completion totals and average CT equal unbounded reference with varying box quantities',()=>{
 const state={events:[],completedProducts:[],completedSources:[]};let sum=0,boxes=0;
 for(let i=0;i<10000;i++){const p={cycleTime:i%19,boxCount:i%8+1};sum+=p.cycleTime;boxes+=p.boxCount;appendHistory(state,'completedProducts',p);appendHistory(state,'completedSources',{id:i});}
 assert.equal(historyCount(state,'completedProducts'),10000);assert.equal(completedCycleSum(state),sum);assert.equal(completedBoxCount(state),boxes);assert.equal(historyCount(state,'completedSources'),10000);assert.ok(state.completedSources.length<=1000);
});
test('3D LIVE reuses its backing buffer until the displayed dimensions actually change',()=>{
 const ctx=new Proxy({},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});let width=0,height=0,writes=0,display=320;
 const canvas={style:{},getBoundingClientRect:()=>({width:display}),getContext:()=>ctx,get width(){return width;},set width(v){width=v;writes++;},get height(){return height;},set height(v){height=v;writes++;}};
 const equipment={id:'rack',type:'asrs',parameters:{rows:1,columns:2,levels:1}},state={t:0,asrs:{equipmentId:'rack',rows:1,columns:2,levels:1,zones:{line:{inventory:0,capacity:2}}},cadTokens:[]};
 drawAsrsScene(canvas,equipment,state,()=> '#00d4ff');assert.equal(writes,2);
 for(let i=0;i<100;i++)drawAsrsScene(canvas,equipment,state,()=> '#00d4ff');assert.equal(writes,2);
 display=400;drawAsrsScene(canvas,equipment,state,()=> '#00d4ff');assert.equal(writes,3);
});
