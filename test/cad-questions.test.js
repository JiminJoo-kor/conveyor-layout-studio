import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCadQuestions,buildQuestionReport,questionsComplete} from '../src/cad-questions.js';
test('CAD questions retain evidence and require every nonblank answer',()=>{
 const item={id:'c1',name:'CV',type:'unknown',source:{rootIndex:7,measurement:{review:true,basis:'curve'}}};
 const state=buildCadQuestions({candidates:[item],document:{units:'mm'},review:{warnings:['unknown units']}},'a.dwg');
 assert.equal(state.questions.length,4);item.name='changed';assert.equal(state.questions[0].item.name,'CV');
 assert.throws(()=>buildQuestionReport(state),/모든/);state.questions.forEach(q=>q.answer='  ');assert.equal(questionsComplete(state),false);
 state.questions.forEach(q=>q.answer='모르겠음');assert.equal(questionsComplete(state),true);assert.equal(buildQuestionReport(state).unresolved.length,4);
});
test('zero recognized candidates still produces a drawing question',()=>{
 const state=buildCadQuestions({candidates:[],document:{},review:{}},'empty.dxf');assert.equal(state.questions.length,1);assert.equal(state.questions[0].kind,'drawing');
});
