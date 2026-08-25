import test from 'node:test';
import assert from 'node:assert/strict';
import { insertEquipmentIntoNearestEdge, removeEquipmentAndReconnect } from '../src/editor.js';

test('중간 설비를 삭제하면 이전 설비와 다음 설비를 자동 연결한다',()=>{
  const layout={equipment:[{id:'a'},{id:'middle'},{id:'b'}],cadSchematic:{lanes:[{nodes:[{id:'a'},{id:'middle'},{id:'b'}]}],inboundBranches:[],edges:[{from:'a',to:'middle',kind:'flow'},{from:'middle',to:'b',kind:'transfer'}]}};
  assert.equal(removeEquipmentAndReconnect(layout,'middle'),true);assert.deepEqual(layout.equipment.map(item=>item.id),['a','b']);assert.deepEqual(layout.cadSchematic.lanes[0].nodes.map(item=>item.id),['a','b']);assert.ok(layout.cadSchematic.edges.some(edge=>edge.from==='a'&&edge.to==='b'&&edge.kind==='transfer'&&edge.autoBypass==='middle'));
});

test('분기 설비 삭제 시 기존 입출력을 중복 없이 우회 연결한다',()=>{
  const layout={equipment:[{id:'a'},{id:'x'},{id:'b'},{id:'c'}],cadSchematic:{lanes:[],inboundBranches:[],edges:[{from:'a',to:'x',kind:'flow'},{from:'x',to:'b',kind:'flow'},{from:'x',to:'c',kind:'flow'},{from:'a',to:'b',kind:'flow'}]}};
  removeEquipmentAndReconnect(layout,'x');assert.equal(layout.cadSchematic.edges.filter(edge=>edge.from==='a'&&edge.to==='b').length,1);assert.ok(layout.cadSchematic.edges.some(edge=>edge.from==='a'&&edge.to==='c'));
});

test('기존 연결선 위에 설비를 놓으면 원래 선을 두 연결로 분할한다',()=>{
  const layout={equipment:[{id:'a',x:0,y:0,rotation:0},{id:'b',x:300,y:0,rotation:0},{id:'new',x:150,y:10,rotation:0}],cadSchematic:{lanes:[{nodes:[{id:'a'},{id:'b'}]}],inboundBranches:[{nodeIds:['a','b']}],edges:[{from:'a',to:'b',kind:'warehouse',fromPort:'right',toPort:'left'}]}};
  const result=insertEquipmentIntoNearestEdge(layout,layout.equipment[2]);assert.ok(result);assert.equal(layout.cadSchematic.edges.length,2);assert.deepEqual(layout.cadSchematic.edges.map(edge=>[edge.from,edge.to]),[['a','new'],['new','b']]);assert.ok(layout.cadSchematic.edges.every(edge=>edge.kind==='warehouse'&&edge.autoInserted==='new'));assert.deepEqual(layout.cadSchematic.lanes[0].nodes.map(node=>node.id),['a','new','b']);assert.deepEqual(layout.cadSchematic.inboundBranches[0].nodeIds,['a','new','b']);
});

test('연결선에서 먼 위치에 놓은 설비는 자동 삽입하지 않는다',()=>{
  const layout={equipment:[{id:'a',x:0,y:0},{id:'b',x:300,y:0},{id:'new',x:150,y:200}],cadSchematic:{lanes:[],inboundBranches:[],edges:[{from:'a',to:'b',kind:'flow'}]}};
  assert.equal(insertEquipmentIntoNearestEdge(layout,layout.equipment[2]),null);assert.deepEqual(layout.cadSchematic.edges.map(edge=>[edge.from,edge.to]),[['a','b']]);
});
