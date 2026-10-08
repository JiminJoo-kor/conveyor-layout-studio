import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentCanvasIdentity,equipmentStatusDecoration} from '../src/renderer.js';

test('레이아웃 설비 식별표는 종류 이름 흐름 방향과 운전 상태를 함께 제공한다',()=>{
  const item={id:'cv-1',type:'conveyor',name:'TRIM IN CV01',parameters:{flowDirection:'left'}};
  assert.deepEqual(equipmentCanvasIdentity(item,{cadTokens:[]}),{code:'CV',label:'TRIM IN CV01',direction:'left',arrow:'←',status:'ready',statusLabel:'정상',statusColor:'#00d4ff'});
  assert.equal(equipmentCanvasIdentity(item,{cadTokens:[{id:'cargo-1',nodeId:'cv-1'}]}).status,'active');
  assert.equal(equipmentCanvasIdentity(item,{equipmentReliability:{'cv-1':{available:false}}}).status,'fault');
  assert.equal(equipmentCanvasIdentity(item,{cadTokens:[{id:'cargo-1',nodeId:'cv-1',transferState:'WaitingAtOutfeed'}]}).status,'waiting');
  assert.equal(equipmentCanvasIdentity(item,{cadTokens:[{id:'cargo-1',nodeId:'cv-1',beltInterlocked:true}]}).status,'blocked');
});

test('회전 설비와 AS/RS 내부 컨베이어도 일관된 코드와 방향을 사용한다',()=>{
  assert.equal(equipmentCanvasIdentity({type:'turntable',name:'TT-01',rotation:90}).arrow,'↓');
  assert.equal(equipmentCanvasIdentity({type:'conveyor',name:'입고 CV',asrsStation:{parentId:'asrs-1'},rotation:270}).code,'ST-CV');
});

test('운전 상태 장식은 정상 선택 테두리와 분리된 일관된 시각 규칙을 제공한다',()=>{
  const item={id:'cv-1',type:'conveyor'};
  assert.deepEqual(equipmentStatusDecoration(item,{cadTokens:[]}),{status:'ready',label:'정상',color:'#00d4ff',dash:[],width:1,alpha:.28});
  assert.deepEqual(equipmentStatusDecoration(item,{cadTokens:[{nodeId:'cv-1'}]}),{status:'active',label:'운전',color:'#00ff88',dash:[],width:2.4,alpha:.92});
  assert.deepEqual(equipmentStatusDecoration(item,{cadTokens:[{nodeId:'cv-1',transferState:'WaitingAtOutfeed'}]}),{status:'waiting',label:'대기',color:'#ffd166',dash:[5,3],width:2,alpha:.9});
  assert.deepEqual(equipmentStatusDecoration(item,{locks:{'cv-1':true}}),{status:'blocked',label:'막힘',color:'#ff7139',dash:[8,3,2,3],width:2.6,alpha:.96});
  assert.deepEqual(equipmentStatusDecoration(item,{equipmentReliability:{'cv-1':{available:false}}}),{status:'fault',label:'고장',color:'#ff4d9d',dash:[3,3],width:3,alpha:1});
});
