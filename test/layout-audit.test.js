import test from 'node:test';
import assert from 'node:assert/strict';
import {auditLayout} from '../src/layout-audit.js';
import {equipmentOperationProgress} from '../src/renderer.js';
import {equipmentHitTarget} from '../src/editor.js';
test('render progress accepts frozen engine tokens without adding fields',()=>{
 const item={id:'amr',type:'amr',parameters:{}},token=Object.freeze({id:1,nodeId:'amr',nodeEnteredAt:0,operationDuration:10,operationStep:Object.freeze({phase:'move',progress:.5})});
 const before=JSON.stringify(token);assert.equal(equipmentOperationProgress(item,{t:5},token).progress,.5);assert.equal(JSON.stringify(token),before);assert.equal(token._visualProgress,undefined);
});
test('CAD conveyor selection matches body instead of a square around labels',()=>{
 const item={id:'cv',type:'conveyor',x:0,y:0,parameters:{length:10}},layout={displayMode:'cad',equipment:[item]};
 assert.equal(equipmentHitTarget(layout,{}, {x:0,y:30}),undefined);assert.equal(equipmentHitTarget(layout,{}, {x:20,y:5}),item);
 item.asrsStation={visualLength:300};assert.equal(equipmentHitTarget(layout,{}, {x:140,y:0}),item);
 item.rotation=90;assert.equal(equipmentHitTarget(layout,{}, {x:0,y:140}),item);
});
test('audit flags invalid coordinates, dimensions, cargo ownership and duplicates without mutation',()=>{
 const layout={equipment:[{id:'a',type:'conveyor',x:NaN,y:0,parameters:{length:-1,safetyGap:-.2},source:{dimensionReviewRequired:true}}],cadSchematic:{edges:[]}},state={t:10,cadTokens:[{id:1,nodeId:'missing'},{id:1,nodeId:'a',edge:{from:'a',to:'missing'}}]};
 const before=JSON.stringify({layout,state}),report=auditLayout(layout,state);
 for(const code of ['pose','length','gap','dimensions','cargo-id','cargo-owner','handover-owner'])assert.ok(report.findings.some(f=>f.code===code),code);
 assert.equal(JSON.stringify({layout,state}),before);assert.equal(report.time,10);
});
