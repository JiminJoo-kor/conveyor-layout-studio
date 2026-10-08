import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentDriveRows,equipmentInspectorSummary} from '../src/inspector-layout.js';

test('conveyor inspector summarizes physical length sections and drives',()=>{
 const item={id:'cv',type:'conveyor',parameters:{length:23,speed:.5,loadCapacity:1000}},summary=equipmentInspectorSummary(item,{cargoSpec:{length:1200,width:800,weight:100,unit:'mm'}},'1.5 kW',12);
 assert.equal(summary.typeLabel,'ROLLER CONVEYOR');
 assert.equal(summary.metrics[0].value,'23.00 m');
 assert.ok(Number(summary.metrics[1].value)>=1);
 assert.ok(Number(summary.metrics[2].value)>=1);
});

test('conveyor drive rows expose calculated section requirements as results',()=>{
 const rows=equipmentDriveRows({id:'cv',type:'conveyor',parameters:{length:23,speed:.5,loadCapacity:1000}},{cargoSpec:{length:1200,width:800,weight:100,unit:'mm'}});
 assert.ok(rows.length>=1);assert.equal(rows[0].name,'S01');assert.ok(rows[0].lengthM>0);assert.ok(rows[0].payloadKg>0);assert.ok(rows[0].motorPowerKw>0);assert.ok(rows[0].status);
 assert.deepEqual(equipmentDriveRows({type:'lift'},{}),[]);
});

test('storage inspector summarizes cells stackers and nominal cycle',()=>{
 const summary=equipmentInspectorSummary({type:'asrs',parameters:{rows:2,columns:8,levels:4,stackerCount:2}},{},'-',17.25);
 assert.deepEqual(summary.metrics,[{label:'CELL 수',value:'64'},{label:'STACKER 수',value:'2'},{label:'명목 Cycle',value:'17.25s'}]);
});
