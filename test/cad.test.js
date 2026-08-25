import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLayoutCandidates, buildSchematicLayout, classifyCadEntity, dedupeProcessLineCandidates, detectProcessRegion, normalizeSchematicPositions, parameterFieldsFor, selectPrimaryLayoutCluster } from '../src/cad.js';
import { createCanvasTransform, isLogisticsDxfEntity, parseDxf, transformDxfGeometry } from '../src/dxf.js';
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

test('스태커 크레인을 셔틀과 구분하고 전용 파라미터를 만든다',()=>{
  const stacker=classifyCadEntity({layer:'ASRS',blockName:'RACK_MASTER_STACKER_CRANE_01'});
  assert.equal(stacker.type,'stackerCrane');assert.equal(stacker.parameters.travelSpeed,2.5);assert.equal(stacker.parameters.loadCapacity,1000);
});

test('중첩 DXF 블록을 삽입 좌표와 회전에 맞춰 실제 선형으로 펼친다',()=>{
  const dxf=`0\nSECTION\n2\nBLOCKS\n0\nBLOCK\n2\nCV_UNIT\n10\n0\n20\n0\n0\nLINE\n8\nCV\n10\n0\n20\n0\n11\n100\n21\n0\n0\nENDBLK\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nINSERT\n8\nMHE\n2\nCV_UNIT\n10\n1000\n20\n2000\n50\n90\n0\nENDSEC\n0\nEOF\n`;
  const document=parseDxf(dxf),line=document.expandedEntities[0];
  assert.equal(line.entityType,'LINE');assert.ok(Math.abs(line.start.x-1000)<.001);assert.ok(Math.abs(line.end.y-2100)<.001);
});

test('건축 배경은 제외하고 물류설비 레이어는 유지한다',()=>{
  assert.equal(isLogisticsDxfEntity({entityType:'LINE',layer:'외벽판넬'}),false);
  assert.equal(isLogisticsDxfEntity({entityType:'DIMENSION',layer:'DIM'}),false);
  assert.equal(isLogisticsDxfEntity({entityType:'LINE',layer:'MHE_STACKER_CRANE'}),true);
  const geometry=transformDxfGeometry({entities:[{entityType:'LINE',layer:'WALL',start:{x:0,y:0},end:{x:10,y:0}},{entityType:'LINE',layer:'CV',start:{x:0,y:0},end:{x:20,y:0}}]},{scale:1,offsetX:0,offsetY:0});
  assert.equal(geometry.length,1);assert.equal(geometry[0].layer,'CV');
});

test('포킹장치를 일반 컨베이어가 아닌 ASRS 이송장치로 분류한다',()=>{
  const fork=classifyCadEntity({entityType:'TEXT',text:'포킹장치',layer:'3'}),hp=classifyCadEntity({entityType:'TEXT',text:'H/P',layer:'3'});assert.equal(fork.type,'forkingDevice');assert.equal(fork.parameters.forkTime,4);assert.equal(hp.type,'handoffPoint');assert.equal(hp.parameters.transferTime,2);
});

test('여러 도면이 섞이면 컨베이어가 많은 주요 물류 군집을 선택한다',()=>{
  const items=[{type:'amr',x:0,y:0},{type:'amr',x:1000,y:0},{type:'conveyor',x:100000,y:0},{type:'conveyor',x:101000,y:0},{type:'conveyor',x:102000,y:0}];
  const cluster=selectPrimaryLayoutCluster(items);assert.equal(cluster.length,3);assert.ok(cluster.every(item=>item.type==='conveyor'));
});

test('도어·화이날·트림 라벨로 전체 공정 영역을 선택한다',()=>{
  const document={entities:['도어 라인','화이날 라인','트림 라인'].map((text,index)=>({entityType:'TEXT',text,center:{x:150000+index*10000,y:30000+index*10000}}))};
  const region=detectProcessRegion(document);assert.ok(region.minX<100000);assert.ok(region.maxX>240000);assert.ok(region.maxY>70000);
  assert.equal(classifyCadEntity({entityType:'TEXT',text:'화이날 라인'}).type,'processLine');
});

test('임의 설비 배치를 가로 공정 라인과 이송 연결로 변환한다',()=>{
  const items=[{id:'a',type:'source',x:10,y:100},{id:'b',type:'conveyor',x:100,y:105},{id:'c',type:'sink',x:200,y:95},{id:'r',type:'robot',x:110,y:220}];
  const schematic=buildSchematicLayout(items);assert.equal(schematic.lanes[0].nodes.length,3);assert.ok(schematic.edges.some(edge=>edge.from==='a'&&edge.to==='b'));
});

test('중복 라벨을 제거하고 도어·화이날·트림 3개 라인을 유지한다',()=>{
  const labels=['도어 라인','도어 라인','화이날 라인','화이날 라인','트림 라인','트림 라인'].map((name,index)=>({id:`p${index}`,type:'processLine',name,x:index%2?200:100,y:index*20})),cv={id:'cv',type:'conveyor',name:'CV',x:300,y:70};
  const deduped=dedupeProcessLineCandidates([...labels,cv]),schematic=buildSchematicLayout(deduped);assert.equal(deduped.filter(x=>x.type==='processLine').length,3);assert.equal(schematic.lanes.length,3);assert.deepEqual(new Set(schematic.lanes.map(x=>x.name)),new Set(['도어 라인','화이날 라인','트림 라인']));
});

test('입고·창고·AGV 단절 구간을 방향 그래프로 구성한다',()=>{
  const labels=['트림 라인','화이날 라인','도어 라인'].map((name,index)=>({id:`label-${index}`,type:'processLine',name,x:30,y:100+index*100}));
  const items=[...labels,
    {id:'in',type:'source',x:50,y:300},{id:'door-cv-1',type:'conveyor',x:230,y:300},{id:'agv',type:'agv',x:360,y:300},{id:'door-cv-2',type:'conveyor',x:500,y:300},
    {id:'final-cv',type:'conveyor',x:420,y:200},{id:'trim-cv',type:'conveyor',x:420,y:100},{id:'hp-line',type:'handoffPoint',x:580,y:300},{id:'fork',type:'forkingDevice',x:610,y:300},{id:'hp-asrs',type:'handoffPoint',x:650,y:300},{id:'asrs',type:'stackerCrane',x:700,y:200,confidence:.95}
  ];
  const schematic=buildSchematicLayout(items),edgeIds=schematic.edges.flatMap(edge=>[edge.from,edge.to]);
  assert.equal(schematic.lanes.length,3);assert.equal(schematic.edges.filter(edge=>edge.kind==='warehouse').length,3);
  assert.equal(schematic.lanes.find(lane=>lane.name==='도어 라인').direction,'inbound');
  assert.ok(schematic.edges.some(edge=>edge.to==='agv'));assert.ok(schematic.edges.some(edge=>edge.from==='agv'));
  assert.equal(schematic.inferredEquipment.length,2);assert.ok(schematic.inferredEquipment.every(item=>item.type==='agv'&&item.source.inferred));
  assert.ok(!edgeIds.some(id=>id.startsWith('label-')));
  const positioned=normalizeSchematicPositions([...items,...schematic.inferredEquipment],schematic,1200),fork=positioned.find(item=>item.id==='fork'),lineHp=positioned.find(item=>item.id==='hp-line'),asrsHp=positioned.find(item=>item.id==='hp-asrs');assert.ok(positioned.filter(item=>['agv','amr'].includes(item.type)).every(item=>item.shuttleRoute?.axis==='horizontal'));assert.equal(fork.x,985);assert.ok([125,245,475].includes(fork.y));assert.equal(lineHp.x,937);assert.equal(asrsHp.x,1033);assert.ok(schematic.edges.some(edge=>edge.kind==='forking'&&(edge.from==='fork'||edge.to==='fork')));
});

test('약식 배치에서도 DXF의 상대 방향과 굴곡을 보존한다',()=>{
  const items=[{id:'a',type:'conveyor',x:0,y:0},{id:'b',type:'conveyor',x:100,y:0},{id:'c',type:'conveyor',x:100,y:100},{id:'d',type:'conveyor',x:0,y:100}],normalized=normalizeSchematicPositions(items,{lanes:[],edges:[]},1200),byId=new Map(normalized.map(item=>[item.id,item]));
  assert.ok(byId.get('b').x>byId.get('a').x);assert.equal(byId.get('a').y,byId.get('b').y);assert.ok(byId.get('c').y>byId.get('b').y);assert.equal(byId.get('c').x,byId.get('b').x);assert.equal(byId.get('d').y,byId.get('c').y);
});
