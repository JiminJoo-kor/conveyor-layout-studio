import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLayoutCandidates, classifyCadEntity } from '../src/cad.js';

test('DWG 블록명과 레이어명으로 대표 물류설비를 분류한다',()=>{
  assert.equal(classifyCadEntity({layer:'MHE_CONVEYOR',blockName:'ROLLER_CV'}).type,'conveyor');
  assert.equal(classifyCadEntity({layer:'ROBOT_ROUTE',blockName:'AMR_01'}).type,'amr');
  assert.equal(classifyCadEntity({layer:'SORTING',blockName:'DIVERTER_02'}).type,'diverter');
});

test('CAD 형상에서 위치와 추정 파라미터를 포함한 후보를 생성한다',()=>{
  const [candidate]=buildLayoutCandidates({entities:[{handle:'A1',layer:'MHE',blockName:'BELT_CONVEYOR',center:{x:120,y:80},bounds:{minX:0,maxX:300,minY:0,maxY:40}}]});
  assert.equal(candidate.type,'conveyor');
  assert.equal(candidate.x,120);
  assert.equal(candidate.parameters.length,300);
  assert.equal(candidate.reviewStatus,'candidate');
});
