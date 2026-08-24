import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLayoutCandidates, classifyCadEntity, parameterFieldsFor } from '../src/cad.js';
import { createCanvasTransform, parseDxf, transformDxfGeometry } from '../src/dxf.js';
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

test('DXF 선형 후보에 실제 길이와 회전각을 보존한다',()=>{
  const [candidate]=buildLayoutCandidates({entities:[{entityType:'LINE',layer:'CONVEYOR',start:{x:0,y:0},end:{x:3000,y:3000},center:{x:1500,y:1500},bounds:{minX:0,maxX:3000,minY:0,maxY:3000}}]});
  assert.equal(candidate.rotation,45);assert.ok(candidate.length>4000);assert.equal(candidate.source.origin,'dxf');
});

test('투입구와 설비별 파라미터 필드를 생성한다',()=>{
  const source=classifyCadEntity({layer:'MHE_INFEED_01'});
  assert.equal(source.type,'source');assert.equal(source.parameters.injectionInterval,30);
  const fields=parameterFieldsFor({parameters:source.parameters});assert.equal(fields.length,2);assert.equal(fields[0].label,'투입 간격(초)');
});

test('DXF 원본 선형을 캔버스 좌표의 라인워크로 변환한다',()=>{
  const document={entities:[{entityType:'LINE',layer:'FLOW',start:{x:0,y:0},end:{x:100,y:50}},{entityType:'LWPOLYLINE',layer:'CV',vertices:[{x:0,y:0},{x:50,y:50}],closed:false}]};
  const geometry=transformDxfGeometry(document,{scale:2,offsetX:10,offsetY:210});
  assert.equal(geometry.length,2);assert.deepEqual(geometry[0].end,{x:210,y:110});assert.deepEqual(geometry[1].vertices[1],{x:110,y:110});
});
