import test from 'node:test';
import assert from 'node:assert/strict';
import {approveEngineeringMotionByType,productionMotionTypes} from '../src/engineering-approval.js';

test('production approval marks only mapped parent equipment without changing parameters',()=>{
 const conveyor={id:'cv',type:'conveyor',parameters:{length:2,speed:1.5,autoMotionTuning:1}},station={id:'station',type:'conveyor',asrsStation:{kind:'in'},parameters:{length:1,speed:.5}},dock={id:'dock',type:'dock',parameters:{}},layout={cargoSpec:{length:1200,unit:'mm'},equipment:[conveyor,station,dock]},before=structuredClone(layout.equipment.map(item=>item.parameters));
 const approved=approveEngineeringMotionByType(layout);
 assert.deepEqual(productionMotionTypes,['conveyor','processLine','forkingDevice','turntable','amr','agv']);
 assert.deepEqual(approved,['cv']);assert.equal(conveyor.engineering.motionRuntime,'approved');assert.equal(station.engineering,undefined);assert.equal(dock.engineering,undefined);assert.deepEqual(layout.equipment.map(item=>item.parameters),before);
});
