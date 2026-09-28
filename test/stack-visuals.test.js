import test from 'node:test';
import assert from 'node:assert/strict';
import {stackVisualGroups} from '../src/stack-visuals.js';
import {LayoutRenderer} from '../src/renderer.js';
import {createStackMachine,receiveStack,advanceStackMachine,stackMachineStatus} from '../src/stack-machine.js';
const box=id=>({id,kind:'empty',empty:true,length:1,width:.8,height:.2,weight:1});
test('separation leaves bottom box at belt scale and lifts only the remaining stack',()=>{
 const m=createStackMachine({mode:'unstack'});receiveStack(m,[box(1),box(2),box(3)]);advanceStackMachine(m,.5);
 const groups=stackVisualGroups(m,stackMachineStatus(m));assert.equal(groups[0].scale,1);assert.equal(groups[0].layers.length,1);assert.ok(groups[1].scale>1);assert.equal(groups[1].layers.length,2);
});
test('all cardinal orientations render finite stack, stopper and progress geometry',()=>{
 const m=createStackMachine({targetCount:2});receiveStack(m,[box(1)]);advanceStackMachine(m,.5);
 const ctx=new Proxy({},{get:(o,k)=>k in o?o[k]:(...args)=>{for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v),`${k}: ${v}`);},set:(o,k,v)=>(o[k]=v,true)});
 for(const rotation of [0,90,180,270])LayoutRenderer.prototype.drawStackMachines.call({ctx,layout:{cargoSpec:{length:1,width:.8,unit:'m'},equipment:[{id:'machine',equipmentRole:'boxStacker',type:'conveyor',x:50,y:50,rotation,parameters:{length:3},source:{origin:'dxf',parameterLengthUnit:'m'}}]}},{stackMachines:{machine:m}});
});
