import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PlaybackBudget} from '../src/playback-budget.js';
import {CadFlowEngine} from '../src/engine.js';
test('large playback requests yield within the work budget without increasing physical time steps',()=>{
 let clock=0;const calls=[],engine={state:{t:0},params:{simDuration:100},step(dt){calls.push(dt);this.state.t+=dt;clock+=2;}};
 const budget=new PlaybackBudget({clock:()=>clock,budgetMs:4});budget.reset(0);const result=budget.advance(engine,1000,100);
 assert.equal(result.steps,2);assert.equal(result.advanced,.04);assert.equal(result.limited,true);assert.ok(budget.pending<=2);assert.ok(calls.every(dt=>dt===.02));
 budget.reset(5000);assert.equal(budget.pending,0);assert.equal(budget.advance(engine,5000,100).steps,0);
});
test('normal and high requested playback produce identical stack line results at equal simulation time',()=>{
 const layout=JSON.parse(readFileSync(new URL('../examples/empty-box-stack-line.json',import.meta.url),'utf8'));
 const run=speed=>{const engine=new CadFlowEngine(structuredClone(layout),{simDuration:60});let cost=0;const budget=new PlaybackBudget({clock:()=>cost,budgetMs:4});const step=engine.step.bind(engine);engine.step=dt=>{step(dt);cost+=2;};for(let now=50;engine.state.t<60&&now<200000;now+=50)budget.advance(engine,now,speed);assert.ok(engine.state.t>=60);return engine.state;};
 const normal=run(1),fast=run(100);assert.deepEqual(fast.completedProducts,normal.completedProducts);assert.deepEqual(fast.stackMachines,normal.stackMachines);assert.equal(fast.t,normal.t);
});
