import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceShortcut } from '../src/shortcuts.js';
test('기본 작업 단축키를 해석한다',()=>{
  for(const [key,action] of [['Delete','delete'],['Escape','escape'],[' ','run'],['f','fit'],['F','fit'],['e','edit'],['g','reveal']])assert.equal(workspaceShortcut({key}),action);
  assert.equal(workspaceShortcut({key:'Backspace'}),null);
  const summary={closest:selector=>selector==='summary'?{}:null};
  assert.equal(workspaceShortcut({key:'Delete',target:summary}),'delete');
  assert.equal(workspaceShortcut({key:' ',target:summary}),null);
});
test('입력·기본 컨트롤·한글 조합·키 반복·브라우저 조합키를 침범하지 않는다',()=>{
  for(const flag of ['isComposing','repeat','defaultPrevented','ctrlKey','metaKey','altKey','shiftKey'])assert.equal(workspaceShortcut({key:'Delete',[flag]:true}),null);
  assert.equal(workspaceShortcut({key:'Delete',target:{closest:()=>({})}}),null);
  assert.equal(workspaceShortcut({key:' ',target:{closest:()=>({})}}),null);
});
