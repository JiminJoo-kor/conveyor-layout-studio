import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentUiParameterKeys,logisticsEquipmentCatalog,parameterFieldsFor} from '../src/cad.js';
import {ParameterKind,equipmentParameterMaster,motionModelsFor,parameterDefinition} from '../src/parameter-master.js';

test('all supported equipment has a parameter inventory and motion model mapping',()=>{
 for(const {type} of logisticsEquipmentCatalog){
  assert.ok(equipmentParameterMaster[type],`${type} parameter master`);
  assert.ok(motionModelsFor({type}).length,`${type} motion model`);
 }
});

test('every existing numeric UI parameter is classified',()=>{
 for(const [type,keys] of Object.entries(equipmentUiParameterKeys))for(const key of keys)
  assert.ok(parameterDefinition(type,key),`${type}.${key}`);
});

test('AUTO and RESULT fields render read-only without deleting controls',()=>{
 const automatic={type:'conveyor',parameters:{length:5,speed:1,acceleration:.4,deceleration:.5,autoMotionTuning:1}};
 const manual={...automatic,parameters:{...automatic.parameters,autoMotionTuning:0}};
 assert.equal(parameterFieldsFor(automatic).find(field=>field.key==='acceleration').parameterKind,ParameterKind.AUTO);
 assert.equal(parameterFieldsFor(automatic).find(field=>field.key==='acceleration').readOnly,true);
 assert.equal(parameterFieldsFor(manual).find(field=>field.key==='acceleration').readOnly,false);
 const storage={type:'asrs',parameters:{rows:2,columns:3,levels:4}};
 const cells=parameterFieldsFor(storage).find(field=>field.key==='cellCount');
 assert.equal(cells.parameterKind,ParameterKind.RESULT);assert.equal(cells.readOnly,true);assert.equal(cells.value,24);
});

test('motion models preserve equipment-specific engineering distinctions',()=>{
 assert.deepEqual(motionModelsFor({type:'conveyor'}),['linear']);
 assert.deepEqual(motionModelsFor({type:'forkingDevice'}),['loaded-forward','empty-return']);
 assert.deepEqual(motionModelsFor({type:'lift'}),['up-with-gravity','down-with-gravity']);
 assert.deepEqual(motionModelsFor({type:'turntable'}),['rotary']);
 assert.deepEqual(motionModelsFor({type:'stackerCrane'}),['x-travel','z-lift-with-gravity','fork-loaded-empty']);
 assert.deepEqual(motionModelsFor({type:'amr'}),['drive','turn','stop']);
});
