import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionVisualStyle,selectedFlowContext} from '../src/renderer.js';

test('연결 종류는 색상 외에도 선 모양과 의미 라벨로 구분된다',()=>{
  const flow=connectionVisualStyle('flow'),branch=connectionVisualStyle('branch'),warehouse=connectionVisualStyle('warehouse'),transfer=connectionVisualStyle('transfer'),handoff=connectionVisualStyle('handoff');
  assert.equal(flow.label,'');
  assert.deepEqual(flow.dash,[]);
  assert.equal(branch.label,'분기');
  assert.ok(branch.dash.length>2);
  assert.deepEqual(connectionVisualStyle('forking'),branch);
  assert.equal(warehouse.label,'AS/RS');
  assert.ok(warehouse.width>flow.width);
  assert.equal(transfer.label,'이동');
  assert.ok(transfer.dash.length>0);
  assert.equal(handoff.label,'인계');
  assert.notDeepEqual(handoff.dash,transfer.dash);
});

test('선택 연결은 종류와 관계없이 강조 표시를 우선한다',()=>{
  const selected=connectionVisualStyle('warehouse',true);
  assert.equal(selected.label,'선택');
  assert.equal(selected.width,7);
  assert.deepEqual(selected.dash,[]);
});

test('선택 설비의 상·하류와 현재 물류 예약 경로를 별도로 식별한다',()=>{
  const edges=[{from:'a',to:'b'},{from:'b',to:'c'},{from:'x',to:'y'}],layout={cadSchematic:{edges}},state={cadTokens:[{nodeId:'b',predictiveRouteEdge:edges[1]}]},context=selectedFlowContext(layout,'b',state);
  assert.deepEqual([...context.edgeIndexes],[0,1]);
  assert.deepEqual([...context.activeEdgeIndexes],[1]);
  assert.deepEqual([...context.equipmentIds],['b','a','c']);
});
