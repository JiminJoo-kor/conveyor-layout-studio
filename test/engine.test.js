import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneLayout, defaultLayout, validateLayout } from '../src/layout.js';
import { CadFlowEngine, SimulationEngine, acceleratedTravelTime, asrsCycleDuration, asrsCycleProfile, asrsOperationSnapshot, asrsTargetCell, cadDuration, canEquipmentHandleCargo, cargoSpec, conveyorCargoCapacity, conveyorEntryPosition, equipmentAvailabilityFactor, equipmentLengthMeters, equipmentLoadSpeedFactor, equipmentSpeedMetersPerSecond, validateParams } from '../src/engine.js';

test('기본 레이아웃은 유효하고 핵심 노드를 포함한다', () => {
  const result = validateLayout(defaultLayout);
  assert.equal(result.valid, true, result.errors.join(' '));
  const nodes = defaultLayout.equipment.flatMap(item => item.nodes || []).map(node => node.id);
  for (const id of ['2-5', '1-3', '1-5', '1-6', '1-7']) assert.ok(nodes.includes(id));
});

test('깨진 설비 참조를 거부한다', () => {
  const layout = cloneLayout();
  layout.equipment.find(item => item.type === 'robot').pickNode = 'missing-node';
  const result = validateLayout(layout);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /pickNode/);
});

test('잘못된 파라미터와 모든 소스 비활성화를 거부한다', () => {
  const result = validateParams({
    useA:false,useB:false,injectA:0,injectB:1,injectC:1,conv2Speed:1,conv1Speed:1,
    forklift17Time:1,forklift211Time:1,simDuration:10,pickTime:0,placeTime:0,station15Time:0,station16Time:0
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 2);
});

test('A와 B가 동시에 대기하면 두 종류 모두 투입된다', () => {
  const engine = new SimulationEngine(cloneLayout(), {
    useA:true,useB:true,injectA:1,injectB:1,injectC:1,conv1Speed:.2,conv2Speed:.2,
    pickTime:.1,placeTime:.1,station15Time:0,station16Time:0,forklift17Time:.2,forklift211Time:.2,simDuration:40
  });
  engine.runUntil(20);
  const kinds = engine.state.events.filter(e => e.type === 'source-injected').map(e => e.kind);
  assert.ok(kinds.includes('A'));
  assert.ok(kinds.includes('B'));
});

test('시뮬레이션이 물품 이동과 KPI를 산출한다', () => {
  const engine = new SimulationEngine(cloneLayout(), {
    useA:true,useB:false,injectA:1,injectB:1,injectC:1,conv1Speed:.2,conv2Speed:.2,
    pickTime:.1,placeTime:.1,station15Time:.2,station16Time:.2,forklift17Time:.2,forklift211Time:.2,simDuration:40
  });
  engine.runUntil(40);
  const kpis = engine.getKpis();
  assert.ok(kpis.movedItems > 0);
  assert.ok(engine.state.completedSources.length > 0);
  assert.ok(kpis.utilization.robot > 0);
  assert.ok(kpis.wip >= 0);
});

test('CAD 흐름 그래프에서 실제 완료 기준 UPH와 CT를 계산한다',()=>{
  const equipment=[{id:'in',type:'source',x:0,y:0,source:{origin:'dxf'},parameters:{}},{id:'cv',type:'conveyor',x:100,y:0,source:{origin:'dxf'},parameters:{speed:10}},{id:'out',type:'sink',x:200,y:0,source:{origin:'dxf'},parameters:{dischargeTime:.2}}];
  const engine=new CadFlowEngine({equipment,cadSchematic:{edges:[{from:'in',to:'cv'},{from:'cv',to:'out'}]}},{injectA:2,simDuration:20});for(let i=0;i<400;i++)engine.step(.05);const kpis=engine.getKpis();
  assert.equal(kpis.mode,'cad');assert.ok(kpis.throughput>0);assert.ok(kpis.cycleTime>0);
});

test('설비 사이 연결선 길이는 UPH와 CT에 영향을 주지 않는다',()=>{
  const makeLayout=x=>({equipment:[{id:'in',type:'source',x:0,y:0,source:{origin:'dxf'},parameters:{processTime:.2}},{id:'cv',type:'conveyor',x,y:0,length:100,source:{origin:'dxf'},parameters:{length:10,speed:2}},{id:'out',type:'sink',x:x*2,y:0,source:{origin:'dxf'},parameters:{dischargeTime:.2}}],cadSchematic:{edges:[{from:'in',to:'cv'},{from:'cv',to:'out'}]}}),run=x=>{const engine=new CadFlowEngine(makeLayout(x),{injectA:2,simDuration:40});for(let i=0;i<800;i++)engine.step(.05);return engine.getKpis();},near=run(100),far=run(10000);assert.equal(far.throughput,near.throughput);assert.equal(far.cycleTime,near.cycleTime);
});

test('시각적 핸드오버 시간은 다음 설비 readyAt과 CT·UPH를 지연하지 않는다',()=>{
  const run=length=>{const equipment=[{id:'in',type:'source',x:0,y:0,source:{origin:'dxf'},parameters:{processTime:.2,speed:.5}},{id:'out',type:'sink',x:10000,y:0,source:{origin:'dxf'},parameters:{dischargeTime:.2}}],engine=new CadFlowEngine({cargoSpec:{length,width:1},equipment,cadSchematic:{edges:[{from:'in',to:'out'}]}},{injectA:2,simDuration:20});for(let i=0;i<400;i++)engine.step(.05);return engine.getKpis();},short=run(.2),long=run(20);assert.equal(long.throughput,short.throughput);assert.equal(long.cycleTime,short.cycleTime);
});

test('Zero-Delay 핸드오버는 Outfeed와 Infeed 센서를 같은 시각에 발생시킨다',()=>{
  const equipment=[{id:'in',type:'source',x:0,y:0,source:{origin:'dxf'},parameters:{processTime:.2}},{id:'out',type:'sink',x:10000,y:0,source:{origin:'dxf'},parameters:{dischargeTime:.2}}],engine=new CadFlowEngine({equipment,cadSchematic:{edges:[{from:'in',to:'out'}]}},{injectA:10,simDuration:2});for(let i=0;i<100;i++)engine.step(.02);const outfeed=engine.state.events.find(event=>event.type==='sensor-outfeed'),infeed=engine.state.events.find(event=>event.type==='sensor-infeed');assert.ok(outfeed);assert.ok(infeed);assert.equal(outfeed.t,infeed.t);assert.equal(outfeed.equipmentId,'in');assert.equal(infeed.equipmentId,'out');
});

test('운전 성능계수는 실제 운동 완료와 CT에 반영된다',()=>{
  const run=performance=>{const equipment=[{id:'in',type:'source',x:0,y:0,source:{origin:'dxf'},parameters:{processTime:.2}},{id:'cv',type:'conveyor',x:100,y:0,source:{origin:'dxf'},parameters:{length:8,speed:2,acceleration:2,deceleration:2,jerk:4,performance}},{id:'out',type:'sink',x:200,y:0,source:{origin:'dxf'},parameters:{dischargeTime:.2}}],engine=new CadFlowEngine({cargoSpec:{length:1,width:.8,weight:100},equipment,cadSchematic:{edges:[{from:'in',to:'cv'},{from:'cv',to:'out'}]}},{injectA:30,simDuration:40});for(let i=0;i<800;i++)engine.step(.05);return engine.getKpis().cycleTime;};assert.ok(run(.5)>run(1));
});

test('컨베이어 길이와 속도가 설비 처리 CT에 반영된다',()=>{
  const run=(length,speed)=>{const equipment=[{id:'in',type:'source',x:0,y:0,source:{origin:'dxf'},parameters:{processTime:.2}},{id:'cv',type:'conveyor',x:100,y:0,source:{origin:'dxf'},parameters:{length,speed}},{id:'out',type:'sink',x:200,y:0,source:{origin:'dxf'},parameters:{dischargeTime:.2}}],engine=new CadFlowEngine({equipment,cadSchematic:{edges:[{from:'in',to:'cv'},{from:'cv',to:'out'}]}},{injectA:20,simDuration:60});for(let i=0;i<1200;i++)engine.step(.05);return engine.getKpis().cycleTime;};assert.ok(run(20,1)>run(10,2));
});

test('동일한 컨베이어 길이와 속도는 도형 크기와 잔여 lineSpeed에 관계없이 같은 CT를 갖는다',()=>{
  const layout={cadSource:{units:'mm'}},a={type:'conveyor',length:40,parameters:{length:5,speed:.5,lineSpeed:120},source:{origin:'dxf',parameterLengthUnit:'m'}},b={type:'conveyor',length:400,parameters:{length:5,speed:.5},source:{origin:'dxf',parameterLengthUnit:'m'}},missing={type:'conveyor',length:400,parameters:{speed:.5},source:{origin:'dxf'}};assert.equal(equipmentSpeedMetersPerSecond(a),.5);assert.equal(cadDuration(a,layout),cadDuration(b,layout));assert.equal(equipmentLengthMeters(missing,layout),5);assert.equal(cadDuration(missing,layout),cadDuration(b,layout));
});

test('컨베이어 물류 길이에 따라 동시 적재 가능 수량을 계산한다',()=>{
  const conveyor={type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:10}},layout={cargoSpec:{length:2.5,width:1}};assert.equal(conveyorCargoCapacity(conveyor,layout),4);layout.cargoSpec.length=4;assert.equal(conveyorCargoCapacity(conveyor,layout),2);
});

test('병렬 라인이 합류하는 컨베이어는 진입 충돌을 막기 위해 한 물류만 인계받는다',()=>{const merge={id:'merge',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:10}},layout={cargoSpec:{length:1,width:1},cadSchematic:{edges:[{from:'a',to:'merge'},{from:'b',to:'merge'}]}};assert.equal(conveyorCargoCapacity(merge,layout),1);const serial={...layout,cadSchematic:{edges:[{from:'a',to:'merge'}]}};assert.equal(conveyorCargoCapacity(merge,serial),10);});

test('컨베이어 수용량은 물류 길이와 최소 안전 간격을 함께 반영한다',()=>{const conveyor={id:'cv',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:10,safetyGap:1}},layout={cargoSpec:{length:2,width:1},cadSchematic:{edges:[]}};assert.equal(conveyorCargoCapacity(conveyor,layout),3);});

test('컨베이어에서 다음 컨베이어로 넘어갈 때 위치·속도·가속도를 연속 승계한다',()=>{const a={id:'a',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:5,speed:1}},b={id:'b',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:5,speed:1}},edge={from:'a',to:'b'},engine=new CadFlowEngine({equipment:[a,b],cargoSpec:{length:1,width:1},cadSchematic:{edges:[edge]}},{simDuration:20}),token=engine.prepareToken({id:99,nodeId:'a',edge:null,readyAt:0,motion:engine.createMotion(a)});token.motionState={position:6,velocity:.8,acceleration:.1,state:'ConstantSpeed'};token.edge=edge;token.nodeId='b';assert.equal(token.motionState.position,1);assert.ok(Math.abs(token.motionState.velocity-.8)<1e-9);assert.ok(Math.abs(token.motionState.acceleration-.1)<1e-9);});

test('연속 인계를 끈 컨베이어는 정지 후 설정된 시간만큼 인계를 대기한다',()=>{const a={id:'a',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:.2,speed:1,acceleration:4,deceleration:4,jerk:20,continuousHandover:0,handoverDelay:2}},b={id:'b',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:5,speed:1}},engine=new CadFlowEngine({equipment:[a,b],cargoSpec:{length:.1,width:.1},cadSchematic:{edges:[{from:'a',to:'b'}]}},{simDuration:20}),token=engine.prepareToken({id:99,nodeId:'a',edge:null,readyAt:0,motion:engine.createMotion(a)});engine.state.cadTokens=[token];for(let index=0;index<500&&token.conveyorExitAt==null;index++){engine.state.t+=.02;engine.advanceMotion(token,a,.02);}assert.ok(token.conveyorExitAt>0);assert.ok(Math.abs(token.readyAt-token.conveyorExitAt-2)<1e-9);assert.equal(token.motionState.velocity,0);});
test('컨베이어 간 인계 좌표는 A에서 이미 진행한 물류 길이를 B에서도 이어받는다',()=>{const conveyor={type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:.8}},layout={cargoSpec:{length:1.2,width:.8}};assert.equal(conveyorEntryPosition(conveyor,layout),1);const normal={...conveyor,parameters:{length:5}};assert.equal(conveyorEntryPosition(normal,layout),1.2);});

test('입고 설비에서 첫 컨베이어로 진입할 때만 0m에서 머리부터 나타난다',()=>{const source={id:'in',type:'source',source:{origin:'dxf'},parameters:{processTime:.1}},conveyor={id:'cv',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:5,speed:1}},edge={from:'in',to:'cv'},engine=new CadFlowEngine({equipment:[source,conveyor],cargoSpec:{length:1,width:1},cadSchematic:{edges:[edge]}},{simDuration:20}),token=engine.prepareToken({id:99,nodeId:'in',edge:null,readyAt:0,motion:null});token.edge=edge;token.nodeId='cv';assert.equal(token.motionState.position,0);});

test('연속 체크된 빈 컨베이어 간 인계는 같은 타임스텝에 출구와 입구 센서가 발생한다',()=>{const source={id:'in',type:'source',source:{origin:'dxf'},parameters:{processTime:.01}},a={id:'a',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:1,speed:2,continuousHandover:1}},b={id:'b',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:1,speed:2,continuousHandover:1}},sink={id:'out',type:'sink',source:{origin:'dxf'},parameters:{dischargeTime:.01}},engine=new CadFlowEngine({equipment:[source,a,b,sink],cargoSpec:{length:.2,width:.1},cadSchematic:{edges:[{from:'in',to:'a'},{from:'a',to:'b'},{from:'b',to:'out'}]}},{injectA:30,simDuration:10});for(let i=0;i<500;i++)engine.step(.02);const out=engine.state.events.find(event=>event.type==='sensor-outfeed'&&event.equipmentId==='a'),input=engine.state.events.find(event=>event.type==='sensor-infeed'&&event.equipmentId==='b');assert.ok(out&&input);assert.equal(out.t,input.t);});

test('연속 인계가 켜진 컨베이어는 남아 있는 readyAt 처리시간을 무시하고 즉시 다음 컨베이어로 간다',()=>{const a={id:'a',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:1,speed:1,continuousHandover:1}},b={id:'b',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:1,speed:1}},engine=new CadFlowEngine({equipment:[a,b],cargoSpec:{length:.2,width:.1},cadSchematic:{edges:[{from:'a',to:'b'}]}},{simDuration:10}),token=engine.prepareToken({id:1,nodeId:'a',readyAt:999,motion:engine.createMotion(a),progress:1});token.progress=1;token.motionState={position:token.motion.distance,velocity:1,acceleration:0};assert.equal(engine.continuousHandoverReady(token),true);});

test('A→B 인수 순간 이전 A 출력 대기 기록을 폐기하고 B를 유일한 현재 소유 설비로 만든다',()=>{const a={id:'a',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:1,speed:2,continuousHandover:1}},b={id:'b',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:1,speed:2,continuousHandover:1}},c={id:'c',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:1,speed:2}},engine=new CadFlowEngine({equipment:[a,b,c],cargoSpec:{length:.2,width:.1},cadSchematic:{edges:[{from:'a',to:'b'},{from:'b',to:'c'}]}},{injectA:99,simDuration:10});for(let index=0;index<500;index++){engine.step(.02);const token=engine.state.cadTokens[0];if(token?.nodeId==='b'){assert.equal(token.edge,null);assert.equal(token.handover,null);assert.equal(token.incomingHandover.sourceId,'a');assert.equal(token.incomingHandover.targetId,'b');return;}}assert.fail('B가 물류를 인수하지 못함');});

test('같은 컨베이어 스펙은 정상 허용하중 안에서 적재 수량과 무관하게 같은 속도계수를 쓴다',()=>{const conveyor={type:'conveyor',parameters:{loadCapacity:1000,performance:1}},layout={cargoSpec:{length:1,width:1,weight:100}};assert.equal(equipmentLoadSpeedFactor(conveyor,layout,1),1);assert.equal(equipmentLoadSpeedFactor(conveyor,layout,8),1);});

test('mm 물류 규격은 m로 변환되어 컨베이어 용량과 통과시간에 반영된다',()=>{
  const conveyor={type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:10,speed:1}},layout={cargoSpec:{length:2500,width:1200,unit:'mm'}};
  assert.deepEqual(cargoSpec(layout),{length:2.5,width:1.2,weight:100,unit:'m'});
  assert.equal(conveyorCargoCapacity(conveyor,layout),4);
  assert.ok(cadDuration(conveyor,layout)>12.5);
});

test('셔틀·지게차·리프트·소터는 각 거리와 속도 파라미터로 CT를 계산한다',()=>{
  const layout={cargoSpec:{length:1000,width:800,unit:'mm'}};
  assert.equal(cadDuration({type:'shuttle',parameters:{shuttleDistance:6,speed:2,loadTime:2,unloadTime:3}},layout),8);
  assert.equal(cadDuration({type:'forklift',parameters:{travelDistance:9,speed:3,loadTime:4,unloadTime:5}},layout),12);
  assert.equal(cadDuration({type:'lift',parameters:{liftHeight:6,liftSpeed:2,loadTime:1,unloadTime:2}},layout),6);
  assert.ok(cadDuration({type:'sorter',parameters:{length:5,speed:2}},layout)>3);
});

test('포킹장치는 설정 비율에 따라 두 출력으로 물품을 분기한다',()=>{
  const equipment=[{id:'in',type:'source',x:0,y:0,source:{origin:'dxf'},parameters:{processTime:.01}},{id:'fork',type:'forkingDevice',x:100,y:0,source:{origin:'dxf'},parameters:{forkTime:.01,output1Ratio:50}},{id:'out-1',type:'sink',x:200,y:-50,source:{origin:'dxf'},parameters:{dischargeTime:.01}},{id:'out-2',type:'sink',x:200,y:50,source:{origin:'dxf'},parameters:{dischargeTime:.01}}],engine=new CadFlowEngine({equipment,cadSchematic:{edges:[{from:'in',to:'fork'},{from:'fork',to:'out-1'},{from:'fork',to:'out-2'}]}},{injectA:1,simDuration:20});for(let i=0;i<2000;i++)engine.step(.01);const routed=engine.state.events.filter(event=>event.type==='fork-routed'),output1=routed.filter(event=>event.output===1).length,output2=routed.filter(event=>event.output===2).length;assert.ok(routed.length>10);assert.ok(Math.abs(output1-output2)<=1);assert.deepEqual(routed.slice(0,4).map(event=>event.output),[1,2,1,2]);assert.ok(routed.every(event=>event.sequence==='deterministic-per-flow'));
});

test('트림과 화이날은 서로 섞이지 않고 각각 직행과 교차를 반복한다',()=>{
  const fork={id:'fork',type:'forkingDevice',source:{origin:'dxf'},parameters:{output1Ratio:50}},equipment=[fork,{id:'trim',type:'sink',source:{origin:'dxf'}},{id:'final',type:'sink',source:{origin:'dxf'}}],edges=[{from:'fork',to:'trim'},{from:'fork',to:'final'}],engine=new CadFlowEngine({equipment,cadSchematic:{edges}}),options=engine.outgoing.get('fork');const routes=[engine.selectRoute(options,fork,{flowKey:'트림 라인'}),engine.selectRoute(options,fork,{flowKey:'화이날 라인'}),engine.selectRoute(options,fork,{flowKey:'트림 라인'}),engine.selectRoute(options,fork,{flowKey:'화이날 라인'})];assert.deepEqual(routes,[0,0,1,1]);const events=engine.state.events.filter(event=>event.type==='fork-routed');assert.deepEqual(events.map(event=>event.flowKey),['트림 라인','화이날 라인','트림 라인','화이날 라인']);assert.deepEqual(events.map(event=>event.route),['primary','primary','fork','fork']);
});

test('포킹장치는 선택한 출발 라인에만 분배 조건을 적용한다',()=>{
  const fork={id:'fork',type:'forkingDevice',source:{origin:'dxf'},parameters:{distributionEnabled:true,distributionFlowKeys:['트림 라인'],output1Ratio:50}},equipment=[fork,{id:'primary',type:'sink',source:{origin:'dxf'}},{id:'cross',type:'sink',source:{origin:'dxf'}}],edges=[{from:'fork',to:'primary'},{from:'fork',to:'cross'}],engine=new CadFlowEngine({equipment,cadSchematic:{edges}}),options=engine.outgoing.get('fork');assert.deepEqual([engine.selectRoute(options,fork,{flowKey:'트림 라인'}),engine.selectRoute(options,fork,{flowKey:'트림 라인'})],[0,1]);assert.deepEqual([engine.selectRoute(options,fork,{flowKey:'화이날 라인'}),engine.selectRoute(options,fork,{flowKey:'화이날 라인'})],[0,0]);fork.parameters.distributionEnabled=false;assert.equal(engine.selectRoute(options,fork,{flowKey:'트림 라인'}),0);assert.equal(engine.state.events.filter(event=>event.type==='fork-bypassed').length,3);
});

test('주 라인이 계속 이어지는 포크 직전 컨베이어에서도 순차 분기를 적용한다',()=>{
  const equipment=[{id:'in',type:'source',source:{origin:'dxf'},parameters:{processTime:.01}},{id:'junction',type:'conveyor',source:{origin:'dxf'},parameters:{length:.1,speed:10}},{id:'main',type:'sink',source:{origin:'dxf'},parameters:{dischargeTime:.01}},{id:'fork',type:'forkingDevice',source:{origin:'dxf'},parameters:{forkTime:.01,output1Ratio:50}},{id:'branch',type:'sink',source:{origin:'dxf'},parameters:{dischargeTime:.01}}],edges=[{from:'in',to:'junction'},{from:'junction',to:'main'},{from:'junction',to:'fork'},{from:'fork',to:'branch'}],engine=new CadFlowEngine({equipment,cadSchematic:{edges}},{injectA:1,simDuration:20});for(let index=0;index<4000;index++)engine.step(.005);const routed=engine.state.events.filter(event=>event.type==='fork-routed');assert.ok(routed.length>=6);assert.deepEqual(routed.slice(0,4).map(event=>event.route),['primary','fork','primary','fork']);assert.ok(routed.every(event=>event.equipmentId==='fork'&&event.junctionId==='junction'));
});

test('진입부 포크 물류는 컨베이어 전체 이송을 마치기 전에 분기한다',()=>{
  const equipment=[{id:'in',type:'source',source:{origin:'dxf'},parameters:{processTime:.01}},{id:'junction',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:100,speed:1}},{id:'main',type:'sink',source:{origin:'dxf'},parameters:{dischargeTime:.01}},{id:'fork',type:'forkingDevice',source:{origin:'dxf'},parameters:{forkTime:.01,output1Ratio:50}},{id:'branch',type:'sink',source:{origin:'dxf'},parameters:{dischargeTime:.01}}],edges=[{from:'in',to:'junction',toPort:'left'},{from:'junction',to:'main',fromPort:'right'},{from:'junction',to:'fork',fromPort:'left'},{from:'fork',to:'branch'}],layout={equipment,cadSchematic:{edges},cargoSpec:{length:1,width:1}},engine=new CadFlowEngine(layout,{injectA:.5,simDuration:4});for(let index=0;index<800;index++)engine.step(.005);const routed=engine.state.events.filter(event=>event.type==='fork-routed');assert.deepEqual(routed.slice(0,2).map(event=>event.route),['primary','fork']);assert.ok(routed[1].t<cadDuration(equipment[1],layout));assert.ok(engine.state.cadTokens.some(token=>token.handover||token.incomingHandover));
});

test('출력부 포크 화살표는 컨베이어와 물류 전체 길이의 이송을 마친 뒤 분기한다',()=>{
  const equipment=[{id:'in',type:'source',source:{origin:'dxf'},parameters:{processTime:.01}},{id:'junction',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:10,speed:1}},{id:'main',type:'sink',source:{origin:'dxf'},parameters:{dischargeTime:.01}},{id:'fork',type:'forkingDevice',source:{origin:'dxf'},parameters:{forkTime:.01,output1Ratio:50}},{id:'branch',type:'sink',source:{origin:'dxf'},parameters:{dischargeTime:.01}}],edges=[{from:'in',to:'junction',toPort:'left'},{from:'junction',to:'main',fromPort:'right'},{from:'junction',to:'fork',fromPort:'right'},{from:'fork',to:'branch'}],layout={equipment,cadSchematic:{edges},cargoSpec:{length:1200,width:800,unit:'mm'}},engine=new CadFlowEngine(layout,{injectA:30,simDuration:40});for(let index=0;index<1000;index++)engine.step(.005);assert.equal(engine.state.events.filter(event=>event.type==='fork-routed').length,0);for(let index=0;index<4000;index++)engine.step(.005);const routed=engine.state.events.filter(event=>event.type==='fork-routed');assert.equal(routed.length,1);assert.ok(routed[0].t>=equipmentLengthMeters(equipment[1],layout)/equipmentSpeedMetersPerSecond(equipment[1]));
});

test('출고 트럭은 설정 수량이 적재되면 출발한다',()=>{
  const equipment=[{id:'asrs',type:'stackerCrane',x:0,y:0,source:{origin:'dxf'},parameters:{rows:1,columns:10,levels:1}},{id:'cv',type:'conveyor',x:100,y:0,source:{origin:'dxf'},parameters:{speed:10}},{id:'amr',type:'amr',x:200,y:0,source:{origin:'dxf'},parameters:{speed:10,shuttleDistance:1,loadTime:.1,unloadTime:.1}},{id:'truck',type:'dock',x:300,y:0,source:{origin:'dxf'},parameters:{dockRole:'outbound',truckCapacity:2,processTime:.1}}],engine=new CadFlowEngine({equipment,cadSchematic:{edges:[{from:'asrs',to:'cv'},{from:'cv',to:'amr'},{from:'amr',to:'truck'}]}},{injectA:1,simDuration:30}),zone=Object.values(engine.state.asrs.zones)[0];zone.inventory=4;engine.state.asrs.inventory=4;for(let i=0;i<600;i++)engine.step(.05);assert.ok(engine.state.outboundTrucks.truck.departures>0);assert.ok(engine.state.events.some(event=>event.type==='truck-departed'));
});

test('AS/RS는 트림·화이날·도어를 각각 16개 구역으로 관리한다',()=>{
  const branches=['트림 라인','화이날 라인','도어 라인'].map((name,index)=>({name,nodeIds:[`in-${index}`]})),equipment=branches.flatMap((branch,index)=>[{id:`in-${index}`,type:'source',x:0,y:index*100,source:{origin:'dxf'},parameters:{}},{id:`cv-${index}`,type:'conveyor',x:100,y:index*100,source:{origin:'dxf'},parameters:{speed:10}}]);equipment.push({id:'asrs',type:'stackerCrane',x:200,y:100,source:{origin:'dxf'},parameters:{rows:2,columns:2,levels:4,productTypes:3,stackerCount:1,columnPitch:.1,levelHeight:.1,travelSpeed:10,liftSpeed:10,downSpeed:10,acceleration:10,putawayTime:.1,retrievalTime:.1}});const edges=branches.flatMap((branch,index)=>[{from:`in-${index}`,to:`cv-${index}`},{from:`cv-${index}`,to:'asrs',kind:'warehouse'}]),engine=new CadFlowEngine({equipment,cadSchematic:{inboundBranches:branches,edges}},{injectA:1,simDuration:20});for(let i=0;i<400;i++)engine.step(.05);assert.equal(engine.state.asrs.capacity,48);assert.deepEqual(Object.values(engine.state.asrs.zones).map(zone=>zone.capacity),[16,16,16]);assert.ok(Object.values(engine.state.asrs.zones).every(zone=>zone.putaways>0));
});

test('ASRS 적재 구조와 물품 구분 수로 총 용량 및 구역 용량을 계산한다',()=>{
  const equipment=[{id:'in',type:'source',x:0,y:0,source:{origin:'dxf'}},{id:'asrs',type:'stackerCrane',x:100,y:0,source:{origin:'dxf'},parameters:{levels:5,rows:2,columns:6,productTypes:4}}],engine=new CadFlowEngine({equipment,cadSchematic:{edges:[{from:'in',to:'asrs'}]}},{injectA:10,simDuration:10});assert.equal(engine.state.asrs.cellCount,60);assert.equal(engine.state.asrs.capacity,240);assert.equal(Object.keys(engine.state.asrs.zones).length,4);assert.deepEqual(Object.values(engine.state.asrs.zones).map(zone=>zone.capacity),[60,60,60,60]);
});

test('ASRS 랙 2열 8번지 4단은 품목별 64 CELL로 계산한다',()=>{
  const equipment=[{id:'in',type:'source',x:0,y:0,source:{origin:'dxf'}},{id:'asrs',type:'asrs',x:100,y:0,source:{origin:'dxf'},parameters:{rows:2,columns:8,levels:4,productTypes:3}}],engine=new CadFlowEngine({equipment,cadSchematic:{edges:[{from:'in',to:'asrs'}]}});assert.equal(engine.state.asrs.cellCount,64);assert.equal(engine.state.asrs.capacity,192);assert.deepEqual(Object.values(engine.state.asrs.zones).map(zone=>zone.capacity),[64,64,64]);
});

test('AS/RS 묶음 배출은 품목별 설정 수량이 적재될 때까지 셀에 보관한 뒤 출고한다',()=>{
  const equipment=[{id:'in',type:'source',source:{origin:'dxf'},parameters:{processTime:.01}},{id:'asrs',type:'stackerCrane',source:{origin:'dxf'},parameters:{rows:1,columns:6,levels:1,productTypes:1,columnPitch:.1,levelHeight:.1,travelSpeed:10,liftSpeed:10,acceleration:10,putawayTime:.2,retrievalTime:.2,batchReleaseEnabled:1,releaseBatchSize:3}},{id:'out',type:'sink',source:{origin:'dxf'},parameters:{dischargeTime:.01}}],engine=new CadFlowEngine({equipment,cadSchematic:{edges:[{from:'in',to:'asrs'},{from:'asrs',to:'out'}]}},{injectA:1,simDuration:12});for(let index=0;index<600;index++)engine.step(.02);const putaways=engine.state.events.filter(event=>event.type==='asrs-putaway'),firstRetrieval=engine.state.events.find(event=>event.type==='asrs-retrieval-start'),putawaysBefore=putaways.filter(event=>event.t<=firstRetrieval.t);assert.ok(firstRetrieval?.batch);assert.ok(putawaysBefore.length>=3);assert.deepEqual(putawaysBefore.slice(0,3).map(event=>event.target.index),[0,1,2]);assert.ok(engine.state.events.some(event=>event.type==='asrs-stored'));assert.ok(Object.values(engine.state.asrs.zones)[0].occupiedSlots.some(Boolean));
});

test('ASRS는 요청 라인 재고가 없으면 다른 라인 재고로 대체 출고하지 않는다',()=>{
  const equipment=[{id:'asrs',type:'stackerCrane',source:{origin:'dxf'},parameters:{rows:1,columns:2,levels:1,productTypes:2,travelSpeed:10,liftSpeed:10}},{id:'out',type:'sink',source:{origin:'dxf'},parameters:{dischargeTime:.01}}],engine=new CadFlowEngine({equipment,cadSchematic:{edges:[{from:'asrs',to:'out'}]}},{injectA:30,simDuration:40});for(let index=0;index<200;index++)engine.step(.05);const [requested,other]=Object.values(engine.state.asrs.zones);other.inventory=1;engine.state.asrs.inventory=1;for(let index=0;index<100;index++)engine.step(.05);assert.equal(engine.state.completedProducts.length,0);assert.equal(other.inventory,1);requested.inventory=1;engine.state.asrs.inventory=2;for(let index=0;index<100;index++)engine.step(.05);assert.ok(engine.state.completedProducts.length>0);assert.equal(other.inventory,1);
});

test('ASRS 사이클은 목표 열과 층, 상승·하강 속도를 반영한다',()=>{
  const item={type:'stackerCrane',parameters:{rows:2,columns:8,levels:4,columnPitch:1.5,levelHeight:2,travelSpeed:3,liftSpeed:1,downSpeed:2,acceleration:1,putawayTime:4,retrievalTime:6,simultaneousMotion:1}};
  assert.deepEqual(asrsTargetCell(item,0),{index:0,column:0,level:0,row:0});
  assert.deepEqual(asrsTargetCell(item,17),{index:17,column:2,level:0,row:1});
  assert.ok(asrsCycleDuration(item,{slotIndex:63,operation:'putaway'})>asrsCycleDuration(item,{slotIndex:0,operation:'putaway'}));
  assert.notEqual(asrsCycleDuration(item,{slotIndex:17,operation:'putaway'}),asrsCycleDuration(item,{slotIndex:17,operation:'retrieval'}));
  assert.ok(acceleratedTravelTime(10,2,1)>0);
});

test('AS/RS 입고와 출고는 서로 다른 인계 위치에서 목표 셀까지 거리를 계산한다',()=>{const item={type:'stackerCrane',parameters:{rows:1,columns:8,levels:4,columnPitch:2,levelHeight:1.5,infeedColumn:1,infeedLevel:1,outfeedColumn:8,outfeedLevel:2,travelSpeed:2,liftSpeed:1,downSpeed:1}},putaway=asrsCycleProfile(item,{slotIndex:12,operation:'putaway'}),retrieval=asrsCycleProfile(item,{slotIndex:12,operation:'retrieval'});assert.deepEqual([putaway.baseColumn,putaway.baseLevel],[0,0]);assert.deepEqual([retrieval.baseColumn,retrieval.baseLevel],[7,1]);assert.notEqual(putaway.horizontal,retrieval.horizontal);const outStart=asrsOperationSnapshot(item,{asrsPhase:'retrieval',nodeEnteredAt:0,asrsTarget:{index:12}},0);assert.deepEqual([outStart.x,outStart.y],[7,1]);});

test('AS/RS 출고 중에는 입고 물류가 직전 컨베이어 종료단을 점유하고 후속 물류도 충돌 대기한다',()=>{const cv={id:'cv',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:5,speed:1,safetyGap:.2}},asrs={id:'asrs',type:'stackerCrane',source:{origin:'dxf'},parameters:{rows:1,columns:2,levels:1,productTypes:1}},edge={from:'cv',to:'asrs'},engine=new CadFlowEngine({equipment:[cv,asrs],cargoSpec:{length:1,width:.8},cadSchematic:{edges:[edge]}},{injectA:99,simDuration:10}),outbound=engine.prepareToken({id:1,nodeId:'asrs',edge:null,asrsPhase:'retrieval',asrsTarget:{index:0},readyAt:9}),front=engine.prepareToken({id:2,nodeId:'cv',edge:null,motion:engine.createMotion(cv),readyAt:0}),behind=engine.prepareToken({id:3,nodeId:'cv',edge:null,motion:engine.createMotion(cv),readyAt:0});front.progress=1;front.edge=edge;behind.progress=.92;engine.state.cadTokens=[outbound,front,behind];assert.equal(engine.holdAsrsInboundWhileBusy(),true);assert.equal(front.edge,null);assert.equal(front.progress,1);assert.equal(front.queueState,'ASRS작업대기');engine.applyOccupancyInterlocks(.02);assert.equal(behind.queueState,'Queue');});

test('AS/RS 입고 중에도 다음 입고를 차단하고 앞단 컨베이어까지 점유 인터락을 전파한다',()=>{const upstream={id:'up',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:1.2,speed:1,safetyGap:.2}},infeed={id:'infeed',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:1.2,speed:1,safetyGap:.2}},asrs={id:'asrs',type:'stackerCrane',source:{origin:'dxf'},parameters:{rows:1,columns:2,levels:1,productTypes:1,stackerCount:1}},toInfeed={from:'up',to:'infeed'},toAsrs={from:'infeed',to:'asrs'},engine=new CadFlowEngine({equipment:[upstream,infeed,asrs],cargoSpec:{length:1,width:.8},cadSchematic:{edges:[toInfeed,toAsrs]}},{injectA:99,simDuration:10}),activePutaway=engine.prepareToken({id:1,nodeId:'asrs',edge:null,asrsPhase:'putaway',asrsTarget:{index:0},readyAt:9}),waiting=engine.prepareToken({id:2,nodeId:'infeed',edge:null,motion:engine.createMotion(infeed),readyAt:0}),upstreamCargo=engine.prepareToken({id:3,nodeId:'up',edge:null,motion:engine.createMotion(upstream),readyAt:0});waiting.progress=1;waiting.edge=toAsrs;upstreamCargo.progress=1;upstreamCargo.edge=toInfeed;engine.state.cadTokens=[activePutaway,waiting,upstreamCargo];engine.resolveZeroDelayHandovers();assert.equal(waiting.nodeId,'infeed');assert.equal(waiting.edge,null);assert.equal(waiting.progress,1);assert.equal(waiting.queueState,'ASRS작업대기');assert.equal(engine.tryDirectHandover(upstreamCargo),false);assert.equal(upstreamCargo.nodeId,'up');});

test('AS/RS 스태커 인터락은 시작 설비 라인별로 독립 실행된다',()=>{const makeCv=id=>({id,type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:2,speed:1}}),lineA=makeCv('line-a'),lineB=makeCv('line-b'),asrs={id:'asrs',type:'stackerCrane',source:{origin:'dxf'},parameters:{rows:1,columns:2,levels:1,productTypes:2,stackerCount:2}},edgeA={from:'line-a',to:'asrs'},edgeB={from:'line-b',to:'asrs'},branches=[{name:'라인 A',nodeIds:['line-a']},{name:'라인 B',nodeIds:['line-b']}],engine=new CadFlowEngine({equipment:[lineA,lineB,asrs],cargoSpec:{length:.5,width:.4},cadSchematic:{inboundBranches:branches,edges:[edgeA,edgeB]}},{injectA:99,simDuration:10}),activeA=engine.prepareToken({id:1,nodeId:'asrs',edge:null,flowKey:'라인 A',asrsPhase:'retrieval',asrsTarget:{index:0},readyAt:9}),waitingA=engine.prepareToken({id:2,nodeId:'line-a',edge:null,flowKey:'라인 A',motion:engine.createMotion(lineA),readyAt:0}),waitingB=engine.prepareToken({id:3,nodeId:'line-b',edge:null,flowKey:'라인 B',motion:engine.createMotion(lineB),readyAt:0});waitingA.progress=1;waitingA.edge=edgeA;waitingB.progress=1;waitingB.edge=edgeB;engine.state.cadTokens=[activeA,waitingA,waitingB];engine.asrsBatchConfig();engine.resolveZeroDelayHandovers();assert.equal(waitingA.nodeId,'line-a');assert.equal(waitingA.edge,null);assert.equal(waitingB.nodeId,'asrs');assert.equal(waitingB.asrsPhase,'putaway');assert.equal(engine.asrsLineBusy('라인 A'),true);assert.equal(engine.asrsLineBusy('라인 B'),true);});

test('AS/RS 앞 물류가 대기해도 다음 설비에 안전 공간이 있으면 이전 물류는 계속 이동한다',()=>{const upstream={id:'up',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:3,speed:1,safetyGap:.2}},infeed={id:'infeed',type:'conveyor',source:{origin:'dxf',parameterLengthUnit:'m'},parameters:{length:6,speed:1,safetyGap:.2}},asrs={id:'asrs',type:'stackerCrane',source:{origin:'dxf'},parameters:{rows:1,columns:2,levels:1,productTypes:1}},toInfeed={from:'up',to:'infeed'},toAsrs={from:'infeed',to:'asrs'},engine=new CadFlowEngine({equipment:[upstream,infeed,asrs],cargoSpec:{length:1,width:.8},cadSchematic:{inboundBranches:[{name:'라인 A',nodeIds:['up','infeed']}],edges:[toInfeed,toAsrs]}},{injectA:99,simDuration:10}),active=engine.prepareToken({id:1,nodeId:'asrs',edge:null,flowKey:'라인 A',asrsPhase:'putaway',asrsTarget:{index:0},readyAt:9}),atEnd=engine.prepareToken({id:2,nodeId:'infeed',edge:null,flowKey:'라인 A',motion:engine.createMotion(infeed),readyAt:0}),following=engine.prepareToken({id:3,nodeId:'up',edge:null,flowKey:'라인 A',motion:engine.createMotion(upstream),readyAt:0});atEnd.progress=1;atEnd.edge=toAsrs;following.progress=1;following.edge=toInfeed;engine.state.cadTokens=[active,atEnd,following];engine.resolveZeroDelayHandovers();assert.equal(atEnd.nodeId,'infeed');assert.equal(atEnd.edge,null);assert.equal(following.nodeId,'infeed');assert.equal(following.edge,null);assert.ok(following.progress<atEnd.progress);assert.notEqual(following.queueState,'Queue');});

test('새 프로젝트의 임의 라인명도 시작 설비에서 물류 라인으로 고정된다',()=>{const sources=['차체 1라인','모듈 X라인'].map((name,index)=>({id:`src-${index}`,type:'source',source:{origin:'dxf'},parameters:{processTime:1,cargoType:index?'트림 물류':'도어 물류'},name})),branches=sources.map((source,index)=>({name:index?'모듈 X라인':'차체 1라인',nodeIds:[source.id]})),engine=new CadFlowEngine({equipment:sources,cadSchematic:{inboundBranches:branches,edges:[]}},{injectA:30,simDuration:2});engine.step(.02);assert.deepEqual(engine.state.cadTokens.map(token=>token.flowKey),['차체 1라인','모듈 X라인']);assert.deepEqual(engine.state.cadTokens.map(token=>token.cargoType),['도어 물류','트림 물류']);});

test('AS/RS 우측 모니터 상태는 엔진 작업시간과 목표 셀을 동일하게 사용한다',()=>{const item={type:'stackerCrane',parameters:{rows:2,columns:8,levels:4,columnPitch:1.5,levelHeight:2,travelSpeed:2.5,liftSpeed:1,downSpeed:1.2,acceleration:.5,putawayTime:4,retrievalTime:5}},token={asrsPhase:'putaway',nodeEnteredAt:10,asrsTarget:{index:17}},start=asrsOperationSnapshot(item,token,10),middle=asrsOperationSnapshot(item,token,15);assert.equal(start.status,'inbound');assert.equal(start.label,'입고중');assert.deepEqual(start.target,asrsTargetCell(item,17));assert.ok(middle.progress>start.progress);token.asrsPhase='retrieval';assert.equal(asrsOperationSnapshot(item,token,10).status,'outbound');assert.equal(asrsOperationSnapshot(item,null,10).label,'대기중');});

test('AS/RS 3D 사이클은 목표 이동·포크 신축·셀 적재·인출·원점 복귀를 실제 시간으로 구분한다',()=>{const item={type:'stackerCrane',parameters:{rows:2,columns:8,levels:4,columnPitch:1.5,levelHeight:2,travelSpeed:2.5,liftSpeed:1,downSpeed:1.2,acceleration:.5,putawayTime:4,retrievalTime:6}},target={index:17},putaway=asrsCycleProfile(item,{slotIndex:17,operation:'putaway'}),token={asrsPhase:'putaway',nodeEnteredAt:0,asrsTarget:target},travel=asrsOperationSnapshot(item,token,putaway.motion/2),forkIn=asrsOperationSnapshot(item,token,putaway.motion+putaway.fork*.25),stored=asrsOperationSnapshot(item,token,putaway.motion+putaway.fork*.75),returning=asrsOperationSnapshot(item,token,putaway.motion+putaway.fork+putaway.returnTime*.5);assert.equal(travel.phase,'travel');assert.ok(travel.x>0&&travel.y>=0);assert.equal(forkIn.phase,'fork');assert.ok(forkIn.forkExtension>0);assert.equal(forkIn.cargoMode,'crane');assert.equal(stored.cargoMode,'cell');assert.equal(returning.phase,'return');assert.ok(returning.x>0&&returning.x<putaway.target.column+1);token.asrsPhase='retrieval';const retrieval=asrsCycleProfile(item,{slotIndex:17,operation:'retrieval'}),beforePickup=asrsOperationSnapshot(item,token,retrieval.motion+retrieval.fork*.25),afterPickup=asrsOperationSnapshot(item,token,retrieval.motion+retrieval.fork*.75);assert.equal(beforePickup.cargoMode,'cell');assert.equal(afterPickup.cargoMode,'crane');assert.equal(retrieval.total,retrieval.motion+retrieval.fork+retrieval.returnTime);});

test('물류 중량과 설비 허용하중, 가동률·운전효율을 현장 보정에 반영한다',()=>{
  const layout={cargoSpec:{length:1200,width:800,weight:800,unit:'mm'}},conveyor={type:'conveyor',parameters:{length:5,speed:1,loadCapacity:700,availability:80,efficiency:75}};
  assert.equal(canEquipmentHandleCargo(conveyor,layout),false);
  assert.ok(Math.abs(equipmentAvailabilityFactor(conveyor)-.6)<1e-9);
  assert.ok(cadDuration(conveyor,layout)>6.2/.6);
});

test('포킹장치와 AMR은 받기·대기·이동·넘기기 파라미터로 CT를 계산한다',()=>{const layout={cargoSpec:{length:1200,width:800,unit:'mm'}},fork={type:'forkingDevice',parameters:{strokeDistance:1.5,receiveSpeed:.5,holdTime:1,transferSpeed:.75}},amr={type:'amr',parameters:{shuttleDistance:6,receiveSpeed:.6,travelSpeed:1.5,transferSpeed:.4}};assert.equal(cadDuration(fork,layout),6);assert.equal(cadDuration(amr,layout),9);});
