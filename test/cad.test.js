import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLayoutCandidates, buildSchematicLayout, classifyCadEntity, dedupeProcessLineCandidates, detectProcessRegion, normalizeSchematicPositions, parameterFieldsFor, selectPrimaryLayoutCluster } from '../src/cad.js';
import { createCanvasTransform, isLogisticsDxfEntity, parseDxf, transformDxfGeometry } from '../src/dxf.js';
import { asrsOccupiedSlots, asrsRackCells, equipmentOperationProgress, equipmentVisualPosition, flowColor, isNodeConveyor, laneTitleAnchor, mobileEquipmentRoute, normalizedCargoSpec, shouldDrawCadToken } from '../src/renderer.js';

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
  const fields=parameterFieldsFor({parameters:source.parameters});assert.equal(fields.length,4);assert.equal(fields[0].label,'투입 간격(초)');assert.equal(fields.find(field=>field.key==='availability').value,100);
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

test('지게차와 고정 포킹장치를 별도 설비로 분류한다',()=>{
  assert.equal(classifyCadEntity({text:'FORKLIFT',layer:'MHE'}).type,'forklift');assert.equal(classifyCadEntity({text:'포킹장치',layer:'MHE'}).type,'forkingDevice');
});

test('연결된 AGV와 AMR은 앞뒤 설비 사이의 동적 이동 경로를 갖는다',()=>{
  const equipment=[{id:'a',type:'conveyor',x:0,y:0},{id:'agv',type:'agv',x:100,y:50},{id:'b',type:'conveyor',x:200,y:100}],layout={equipment,cadSchematic:{edges:[{from:'a',to:'agv',fromPort:'right',toPort:'left'},{from:'agv',to:'b',fromPort:'right',toPort:'left'}]}},route=mobileEquipmentRoute(layout,equipment[1]);assert.ok(route);assert.equal(route.points.length,2);assert.deepEqual(route.start,{x:56,y:50});assert.deepEqual(route.end,{x:144,y:50});
});

test('AGV는 적재 후 이동하고 하역 위치에 도착해야 물품을 넘긴다',()=>{
  const item={id:'agv',type:'agv',parameters:{loadTime:2,unloadTime:2}},token={nodeId:'agv',edge:null,nodeEnteredAt:10,operationDuration:10};assert.equal(equipmentOperationProgress(item,{t:11,cadTokens:[token]}).progress,0);assert.ok(Math.abs(equipmentOperationProgress(item,{t:15,cadTokens:[token]}).progress-.5)<1e-9);assert.equal(equipmentOperationProgress(item,{t:19,cadTokens:[token]}).progress,1);assert.equal(equipmentOperationProgress(item,{t:20,cadTokens:[]}).active,false);
});

test('정지 AMR은 저장 좌표에 있고 운반 중에만 경로 좌표로 이동한다',()=>{
  const item={id:'amr',type:'amr',x:100,y:80,parameters:{loadTime:0,unloadTime:0},shuttleRoute:{start:{x:20,y:20},end:{x:220,y:20},points:[{x:20,y:20},{x:220,y:20}]}},layout={equipment:[item],cadSchematic:{edges:[]}},idle=equipmentVisualPosition(layout,item,{t:0,cadTokens:[]}),token={nodeId:'amr',edge:null,nodeEnteredAt:0,operationDuration:10},moving=equipmentVisualPosition(layout,item,{t:5,cadTokens:[token]},token);assert.deepEqual(idle,{x:100,y:80});assert.ok(Math.abs(moving.x-120)<1e-9);assert.equal(moving.y,20);
});

test('턴테이블 진행률은 물품 작업시간에 동기화된다',()=>{
  const item={id:'tt',type:'turntable',parameters:{rotationTime:8}},token={nodeId:'tt',edge:null,nodeEnteredAt:2,operationDuration:8};assert.equal(equipmentOperationProgress(item,{t:6,cadTokens:[token]}).progress,.5);
});

test('같은 컨베이어의 여러 물류는 각자 진입 시각 기준 진행률을 사용한다',()=>{
  const item={id:'cv',type:'conveyor',parameters:{}},older={nodeId:'cv',edge:null,nodeEnteredAt:0,operationDuration:10},newer={nodeId:'cv',edge:null,nodeEnteredAt:5,operationDuration:10},state={t:7,cadTokens:[older,newer]};assert.equal(equipmentOperationProgress(item,state,older).progress,.7);assert.equal(equipmentOperationProgress(item,state,newer).progress,.2);
});

test('ASRS 재고 비율을 랙 점등 셀 수로 변환한다',()=>{
  assert.equal(asrsOccupiedSlots(0,64),0);assert.equal(asrsOccupiedSlots(16,64),4);assert.equal(asrsOccupiedSlots(64,64),16);
});

test('ASRS는 품목별 실제 CELL 수와 재고 상태를 그대로 표시한다',()=>{
  const racks=asrsRackCells({cellCount:64,zones:{트림:{inventory:2,capacity:64},화이날:{inventory:1,capacity:64},도어:{inventory:0,capacity:64}}});assert.equal(racks.length,3);assert.ok(racks.every(rack=>rack.cells.length===64));assert.deepEqual(racks.map(rack=>rack.cells.filter(Boolean).length),[2,1,0]);
});

test('여러 라인의 이동 물류는 서로 다른 고정 색상을 사용한다',()=>{
  assert.notEqual(flowColor('트림 라인',0),flowColor('화이날 라인',1));assert.notEqual(flowColor('화이날 라인',1),flowColor('도어 라인',2));assert.equal(flowColor('트림 라인',0),flowColor('트림 라인',0));
});

test('ASRS 내부 적재 물류는 사각형 토큰으로 중복 표시하지 않는다',()=>{
  assert.equal(shouldDrawCadToken({nodeId:'asrs',edge:null},{type:'stackerCrane'}),false);assert.equal(shouldDrawCadToken({nodeId:'asrs',edge:null,asrsPhase:'putaway'},{type:'stackerCrane'}),true);assert.equal(shouldDrawCadToken({nodeId:'asrs',edge:null,asrsPhase:'retrieval'},{type:'stackerCrane'}),true);assert.equal(shouldDrawCadToken({nodeId:'asrs',edge:{from:'asrs',to:'out'}},{type:'stackerCrane'}),true);assert.equal(shouldDrawCadToken({nodeId:'cv',edge:null},{type:'conveyor'}),true);
});

test('물류 규격은 화면에서도 mm 저장값을 m 크기로 정규화한다',()=>{
  assert.deepEqual(normalizedCargoSpec({cargoSpec:{length:1200,width:800,unit:'mm'}}),{length:1.2,width:.8,weight:100,lengthMm:1200,widthMm:800});
});

test('기존 ASRS 후보에도 적재 구조와 물품 구분 설정 필드를 제공한다',()=>{
  const fields=parameterFieldsFor({type:'stackerCrane',parameters:{travelSpeed:2.5}}),byKey=Object.fromEntries(fields.map(field=>[field.key,field.value])),cell=fields.find(field=>field.key==='cellCount');assert.equal(byKey.levels,4);assert.equal(byKey.rows,2);assert.equal(byKey.columns,8);assert.equal(byKey.productTypes,3);assert.equal(byKey.cellCount,64);assert.equal(cell.readOnly,true);
});

test('포킹장치는 출력 1 분기 비율을 기본 50%로 제공한다',()=>{
  const fields=parameterFieldsFor({type:'forkingDevice',parameters:{forkTime:3,distributionEnabled:true,distributionFlowKeys:['트림 라인']}}),ratio=fields.find(field=>field.key==='output1Ratio');assert.equal(ratio.value,50);assert.equal(ratio.min,0);assert.equal(ratio.max,100);assert.equal(fields.some(field=>['distributionEnabled','distributionFlowKeys'].includes(field.key)),false);
});

test('컨베이어는 화면 크기와 분리된 실제 길이 파라미터를 제공한다',()=>{
  const fields=parameterFieldsFor({type:'conveyor',length:90,parameters:{speed:.5,beltWidth:2,cargoLength:3,cargoWidth:2}}),length=fields.find(field=>field.key==='length'),speed=fields.find(field=>field.key==='speed');assert.equal(length.value,5);assert.equal(length.label,'실제 길이(m)');assert.equal(speed.label,'속도(m/s)');assert.equal(fields.some(field=>['beltWidth','cargoLength','cargoWidth'].includes(field.key)),false);
});

test('포킹장치와 AMR은 현장 동작 순서가 보이는 간단 파라미터만 제공한다',()=>{const forkKeys=parameterFieldsFor({type:'forkingDevice',parameters:{jerk:9}}).map(field=>field.key),amrKeys=parameterFieldsFor({type:'amr',parameters:{motionProfile:1}}).map(field=>field.key);assert.deepEqual(forkKeys.slice(0,4),['strokeDistance','receiveSpeed','holdTime','transferSpeed']);assert.ok(amrKeys.includes('receiveSpeed')&&amrKeys.includes('travelSpeed')&&amrKeys.includes('transferSpeed'));assert.equal(forkKeys.includes('jerk'),false);assert.equal(amrKeys.includes('motionProfile'),false);});

test('라인 제목은 DXF 텍스트가 아니라 이동 가능한 트럭 설비를 따라간다',()=>{
  const text={id:'label',type:'processLine',x:10,y:10},conveyor={id:'cv',type:'conveyor',x:100,y:100},truck={id:'truck',type:'dock',x:200,y:100};assert.equal(laneTitleAnchor([text,conveyor,truck]),truck);truck.x=350;assert.equal(laneTitleAnchor([text,conveyor,truck]).x,350);
});

test('포킹장치를 일반 컨베이어가 아닌 ASRS 이송장치로 분류한다',()=>{
  const fork=classifyCadEntity({entityType:'TEXT',text:'포킹장치',layer:'3'}),hp=classifyCadEntity({entityType:'TEXT',text:'H/P',layer:'3'}),turntable=classifyCadEntity({entityType:'CIRCLE',radius:1200,layer:'0'});assert.equal(fork.type,'forkingDevice');assert.equal(fork.parameters.forkTime,4);assert.equal(hp.type,'handoffPoint');assert.equal(hp.parameters.transferTime,2);assert.equal(turntable.type,'turntable');assert.equal(turntable.parameters.rotationTime,6);
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
  assert.equal(schematic.inferredEquipment.length,3);assert.ok(schematic.inferredEquipment.every(item=>['agv','amr'].includes(item.type)&&item.source.inferred));assert.ok(schematic.inferredEquipment.some(item=>item.name.includes('화이날 라인 AS/RS 반출 AMR')));
  assert.ok(!edgeIds.some(id=>id.startsWith('label-')));
  const positioned=normalizeSchematicPositions([...items,...schematic.inferredEquipment],schematic,1200),fork=positioned.find(item=>item.id==='fork'),lineHp=positioned.find(item=>item.id==='hp-line'),asrsHp=positioned.find(item=>item.id==='hp-asrs'),vehicles=positioned.filter(item=>['agv','amr'].includes(item.type));assert.ok(vehicles.filter(item=>item.source?.reason!=='asrs-discharge-amr').every(item=>item.shuttleRoute?.axis==='horizontal'));assert.ok(vehicles.some(item=>item.source?.reason==='asrs-discharge-amr'&&item.shuttleRoute?.axis==='orthogonal'));assert.equal(fork.x,955);assert.ok([125,285,475].includes(fork.y));assert.equal(lineHp.x,907);assert.equal(asrsHp.x,1003);assert.ok(schematic.edges.some(edge=>edge.kind==='forking'&&(edge.from==='fork'||edge.to==='fork')));
});

test('약식 배치에서도 DXF의 상대 방향과 굴곡을 보존한다',()=>{
  const items=[{id:'a',type:'conveyor',x:0,y:0},{id:'b',type:'conveyor',x:100,y:0},{id:'c',type:'conveyor',x:100,y:100},{id:'d',type:'conveyor',x:0,y:100}],normalized=normalizeSchematicPositions(items,{lanes:[],edges:[]},1200),byId=new Map(normalized.map(item=>[item.id,item]));
  assert.ok(byId.get('b').x>byId.get('a').x);assert.equal(byId.get('a').y,byId.get('b').y);assert.ok(byId.get('c').y>byId.get('b').y);assert.equal(byId.get('c').x,byId.get('b').x);assert.equal(byId.get('d').y,byId.get('c').y);
});

test('출고 전용 3개 라인에는 대응하는 입고 트럭과 ASRS 입고 분기를 생성한다',()=>{
  const labels=['트림 라인','화이날 라인','도어 라인'].map((name,index)=>({id:`label-${index}`,type:'processLine',name,x:100,y:100+index*100,source:{layer:String(index+2)}})),items=labels.flatMap((label,index)=>[label,{id:`cv-${index}`,type:'conveyor',name:'CV',x:500,y:label.y,source:{layer:String(index+2)}},{id:`out-${index}`,type:'dock',name:'출고 트럭',x:50,y:label.y,parameters:{dockRole:'outbound'}}]),warehouse={id:'asrs',type:'stackerCrane',x:700,y:200,confidence:.95},schematic=buildSchematicLayout([...items,warehouse]);assert.equal(schematic.inboundBranches.length,3);assert.equal(schematic.inferredEquipment.filter(item=>item.type==='dock'&&item.parameters?.dockRole==='inbound').length,3);assert.equal(schematic.inferredEquipment.filter(item=>item.name.includes('AS/RS 인피드 CV')).length,3);assert.equal(schematic.inferredEquipment.filter(item=>item.source?.reason==='asrs-discharge-amr').length,2);assert.equal(schematic.dischargeModes['lane-1'],'conveyor');assert.equal(schematic.dischargeModes['lane-2'],'amr');assert.equal(schematic.dischargeModes['lane-3'],'amr');assert.ok(schematic.inboundBranches.every(branch=>branch.nodeIds.length===6));assert.equal(schematic.edges.filter(edge=>edge.to==='asrs'&&edge.kind==='warehouse').length,3);assert.ok(schematic.edges.filter(edge=>edge.to==='asrs').every(edge=>edge.from.endsWith('-asrs-cv')));
});
