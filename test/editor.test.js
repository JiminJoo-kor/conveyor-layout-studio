import test from 'node:test';
import assert from 'node:assert/strict';
import { removeEquipmentAndReconnect } from '../src/editor.js';

test('중간 설비를 삭제하면 이전 설비와 다음 설비를 자동 연결한다',()=>{
  const layout={equipment:[{id:'a'},{id:'middle'},{id:'b'}],cadSchematic:{lanes:[{nodes:[{id:'a'},{id:'middle'},{id:'b'}]}],inboundBranches:[],edges:[{from:'a',to:'middle',kind:'flow'},{from:'middle',to:'b',kind:'transfer'}]}};
  assert.equal(removeEquipmentAndReconnect(layout,'middle'),true);assert.deepEqual(layout.equipment.map(item=>item.id),['a','b']);assert.deepEqual(layout.cadSchematic.lanes[0].nodes.map(item=>item.id),['a','b']);assert.ok(layout.cadSchematic.edges.some(edge=>edge.from==='a'&&edge.to==='b'&&edge.kind==='transfer'&&edge.autoBypass==='middle'));
});

test('분기 설비 삭제 시 기존 입출력을 중복 없이 우회 연결한다',()=>{
  const layout={equipment:[{id:'a'},{id:'x'},{id:'b'},{id:'c'}],cadSchematic:{lanes:[],inboundBranches:[],edges:[{from:'a',to:'x',kind:'flow'},{from:'x',to:'b',kind:'flow'},{from:'x',to:'c',kind:'flow'},{from:'a',to:'b',kind:'flow'}]}};
  removeEquipmentAndReconnect(layout,'x');assert.equal(layout.cadSchematic.edges.filter(edge=>edge.from==='a'&&edge.to==='b').length,1);assert.ok(layout.cadSchematic.edges.some(edge=>edge.from==='a'&&edge.to==='c'));
});
