import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLayoutCandidates, classifyCadEntity } from '../src/cad.js';
import { createCanvasTransform, parseDxf } from '../src/dxf.js';
import { isNodeConveyor } from '../src/renderer.js';

test('DWG 블록명과 레이어명으로 대표 물류설비를 분류한다',()=>{
  assert.equal(classifyCadEntity({layer:'MHE_CONVEYOR',blockName:'ROLLER_CV'}).type,'conveyor');
  assert.equal(classifyCadEntity({layer:'ROBOT_ROUTE',blockName:'AMR_01'}).type,'amr');
  assert.equal(classifyCadEntity({layer:'SORTING',blockName:'DIVERTER_02'}).type,'diverter');
});

test('ASCII DXF에서 단위, 레이어, 블록 삽입 좌표를 읽는다',()=>{
  const dxf=`0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nINSERT\n5\nA1\n8\nMHE_CONVEYOR\n2\nROLLER_CONVEYOR\n10\n1000\n20\n2000\n50\n90\n0\nLINE\n5\nA2\n8\nMHE_ROUTE\n10\n0\n20\n0\n11\n3000\n21\n0\n0\nENDSEC\n0\nEOF\n`;
  const document=parseDxf(dxf),insert=document.entities[0];
  assert.equal(document.units,'mm');assert.equal(insert.blockName,'ROLLER_CONVEYOR');assert.equal(insert.center.x,1000);assert.ok(document.layers.includes('MHE_CONVEYOR'));
  const transform=createCanvasTransform(document);assert.ok(transform.scale>0);
});

test('CAD 형상에서 위치와 추정 파라미터를 포함한 후보를 생성한다',()=>{
  const [candidate]=buildLayoutCandidates({entities:[{handle:'A1',layer:'MHE',blockName:'BELT_CONVEYOR',center:{x:120,y:80},bounds:{minX:0,maxX:300,minY:0,maxY:40}}]});
  assert.equal(candidate.type,'conveyor');
  assert.equal(candidate.x,120);
  assert.equal(candidate.parameters.length,300);
  assert.equal(candidate.reviewStatus,'candidate');
});

test('DXF 컨베이어 후보와 시뮬레이션 컨베이어를 구분한다',()=>{
  assert.equal(isNodeConveyor({type:'conveyor',x:10,y:20}),false);
  assert.equal(isNodeConveyor({type:'conveyor',nodes:[]}),true);
});
