import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentFlowConnections,equipmentFlowSummary} from '../src/inspector-layout.js';

test('선택 설비 요약은 직접 상하류와 현재 물류 및 막힘 원인을 표시한다',()=>{
 const equipment=[{id:'a',name:'투입'},{id:'b',name:'검사'},{id:'c',name:'출고'}],layout={equipment,cadSchematic:{edges:[{from:'a',to:'b'},{from:'b',to:'c'}]}},state={cadTokens:[{id:7,nodeId:'b',waitDiagnostic:{reason:'하류 설비 진입 승인/공간 대기'}}]},summary=equipmentFlowSummary(layout,equipment[1],state);
 assert.deepEqual(summary.upstream,['투입']);assert.deepEqual(summary.downstream,['출고']);assert.equal(summary.cargoCount,1);assert.deepEqual(summary.cargoIds,[7]);assert.equal(summary.blockReason,'하류 설비 진입 승인/공간 대기');assert.equal(summary.status,'blocked');
});

test('설비 비가동 원인은 물류 대기 원인보다 우선한다',()=>{
 const item={id:'b',name:'검사'},layout={equipment:[item],cadSchematic:{edges:[]}},state={equipmentReliability:{b:{available:false}},cadTokens:[{id:1,nodeId:'b',waitDiagnostic:{reason:'공간 대기'}}]},summary=equipmentFlowSummary(layout,item,state);
 assert.equal(summary.blockReason,'설비 고장/비가동');assert.equal(summary.status,'fault');
});

test('ASRS flow resolves external links through derived station interfaces',()=>{
 const rack={id:'rack',name:'창고',type:'asrs'},stationIn={id:'rack-in',name:'입고 Station CV',asrsStation:{parentId:'rack',index:0,kind:'in'}},stationOut={id:'rack-out',name:'출고 Station CV',asrsStation:{parentId:'rack',index:0,kind:'out'}},layout={equipment:[{id:'source',name:'입고 라인'},rack,stationIn,stationOut,{id:'sink',name:'출고 라인'}],cadSchematic:{edges:[{from:'source',to:'rack-in'},{from:'rack-in',to:'rack',asrsStationInternal:true},{from:'rack',to:'rack-out',asrsStationInternal:true},{from:'rack-out',to:'sink'}]}};
 const connections=equipmentFlowConnections(layout,rack);
 assert.deepEqual(connections.upstream,['입고 라인']);assert.deepEqual(connections.downstream,['출고 라인']);assert.equal(connections.connectedInterfaces,2);assert.equal(connections.totalInterfaces,2);
 const summary=equipmentFlowSummary(layout,rack,{cadTokens:[{id:3,nodeId:'rack-in'}]});assert.equal(summary.cargoCount,1);
});
