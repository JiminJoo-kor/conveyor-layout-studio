import test from 'node:test';
import assert from 'node:assert/strict';
import { CadFlowEngine, cadDuration, equipmentSequenceSnapshot, cargoSpec } from '../src/engine.js';
import { validateFlowGraph } from '../src/flow-graph.js';
import { applyCommonParameters } from '../src/parameter-policy.js';
import { asrsSceneModel } from '../src/asrs-monitor.js';
import { buildSimulationReport } from '../src/report.js';
import { validateLayout } from '../src/layout.js';
import { conveyorCargoCapacity, conveyorEntryPosition, cargoLengthOnEquipment, asrsOperationSnapshot } from '../src/engine.js';
import { conveyorCargoVisualPose, equipmentCargoMetrics, handoverCargoMetrics, LayoutRenderer, equipmentVisualPosition, mobileEquipmentRoute, mobileHandoverNode } from '../src/renderer.js';

const node=(id,type,parameters={})=>({id,name:id,type,x:0,y:0,parameters});
const run=(engine,seconds)=>{for(let i=0;i<seconds*50;i++)engine.step(.02);return engine;};
const storage=id=>node(id,'asrs',{productTypes:2,rows:1,columns:2,levels:1,infeedTime:.2,outfeedTime:.4,modeChangeTime:.1,forkStroke:.05,forkSpeed:1,travelSpeed:5,putawayTime:0,retrievalTime:0});

test('일반 JSON 프로젝트는 DXF 출처 없이도 연결 순서대로 실행된다',()=>{
  const equipment=[node('새 입고','source',{injectionInterval:2}),node('새 컨베이어','conveyor',{length:2,speed:1}),node('새 배출','sink',{dischargeTime:.1})];
  const engine=run(new CadFlowEngine({equipment,cadSchematic:{edges:[{from:'새 입고',to:'새 컨베이어'},{from:'새 컨베이어',to:'새 배출'}]}},{simDuration:30}),30);
  assert.ok(engine.state.completedProducts.length>1);
});
test('잘못된 연결점과 사라진 설비는 조용히 무시하지 않고 거부한다',()=>{
  const equipment=[node('s','source'),storage('w')];
  for(const edge of [{from:'missing',to:'w'},{from:'s',to:'w',toPort:'product-3-in'},{from:'s',to:'w',toPort:'product-1-out'}])assert.equal(validateFlowGraph({equipment,cadSchematic:{edges:[edge]}}).valid,false);
});
test('AS/RS는 연결이 없어도 입고 소스처럼 빈 셀 물류를 생성하지 않는다',()=>{
  const engine=run(new CadFlowEngine({equipment:[storage('w'),node('out','sink')],cadSchematic:{edges:[{from:'w',to:'out'}]}},{simDuration:30}),30);
  assert.equal(engine.state.cadTokens.length,0);assert.equal(engine.state.completedProducts.length,0);
});
test('두 창고가 독립적으로 처리하고 명시한 입고 포트에 원래 색상/물품을 저장한다',()=>{
  const equipment=[node('s1','source',{injectionInterval:8,cargoType:'빨강'}),node('s2','source',{injectionInterval:8,cargoType:'파랑'}),storage('w1'),storage('w2'),node('out1','sink',{dischargeTime:.1}),node('out2','sink',{dischargeTime:.1})];
  const edges=[{from:'s1',to:'w1',toPort:'product-2-in'},{from:'s2',to:'w2',toPort:'product-1-in'},{from:'w1',to:'out1'},{from:'w2',to:'out2'}];
  const engine=run(new CadFlowEngine({equipment,cadSchematic:{edges,inboundBranches:[{name:'Alpha',nodeIds:['s1']},{name:'Beta',nodeIds:['s2']}] }},{simDuration:60}),60);
  assert.ok(engine.state.warehouses.w1.retrievals>0);assert.ok(engine.state.warehouses.w2.retrievals>0);
  assert.equal(engine.state.warehouses.w1.zones.Alpha.putaways,0);assert.ok(engine.state.warehouses.w1.zones.Beta.putaways>0);
  assert.ok(engine.state.completedProducts.some(token=>token.cargoType==='빨강'));assert.ok(engine.state.completedProducts.some(token=>token.cargoType==='파랑'));
});
test('출고 승인 후 인계 시간 동안 소유권과 재고는 AS/RS에 남는다',()=>{
  const w=storage('w'),out=node('out','sink',{dischargeTime:.1}),edge={from:'w',to:'out'},engine=new CadFlowEngine({equipment:[w,out],cadSchematic:{edges:[edge]}},{simDuration:10});
  const zone=Object.values(engine.state.asrs.zones)[0],key=Object.keys(engine.state.asrs.zones)[0];zone.inventory=1;zone.occupiedSlots[0]=true;engine.state.asrs.inventory=1;
  const token=engine.prepareToken({id:1,nodeId:'w',edge,flowKey:key,storageFlowKey:key,asrsPhase:'retrieval',asrsTarget:{index:0},readyAt:0,progress:1});engine.state.cadTokens=[token];
  assert.equal(engine.tryDirectHandover(token),false);assert.equal(engine.state.asrs.inventory,1);
  engine.state.t=.2;assert.equal(engine.tryDirectHandover(token),false);assert.equal(token.nodeId,'w');
  engine.state.t=.4;assert.equal(engine.tryDirectHandover(token),true);assert.equal(token.nodeId,'out');assert.equal(engine.state.asrs.inventory,0);
});
test('로봇·배출·포킹의 설정과 시퀀스 시간이 일치한다',()=>{
  assert.equal(cadDuration(node('r','robot',{pickTime:20,placeTime:30}),{}),50);
  assert.equal(cadDuration(node('s','sink',{processTime:1,dischargeTime:9}),{}),9);
  const fork=node('f','forkingDevice',{strokeDistance:1.5,receiveSpeed:.5,transferSpeed:.5,holdTime:1,acceleration:.8,deceleration:.8});
  const duration=cadDuration(fork,{}),token={nodeEnteredAt:0,operationDuration:duration};
  assert.ok(equipmentSequenceSnapshot(fork,token,duration-.1,{}).progress<1);
  assert.equal(equipmentSequenceSnapshot(fork,token,duration,{}).progress,1);
});
test('1초 단위 호출과 0.02초 단위 호출은 동일한 물리 시간을 적분한다',()=>{
  const layout={equipment:[node('s','source'),node('out','sink')],cadSchematic:{edges:[{from:'s',to:'out'}]}},a=new CadFlowEngine(structuredClone(layout)),b=new CadFlowEngine(structuredClone(layout));
  a.step(1);for(let i=0;i<50;i++)b.step(.02);assert.deepEqual(a.state.events,b.state.events);assert.equal(a.state.t,b.state.t);
});
test('명시한 m 단위는 긴 물류도 mm로 재해석하지 않는다',()=>{assert.equal(cargoSpec({cargoSpec:{unit:'m',length:30,width:2}}).length,30);});

test('AS/RS 입고 인계 도중 고장은 타이머를 동결하고 반복 평가가 시간을 추가 차감하지 않는다',()=>{
  const a=node('a','conveyor'),w=storage('w'),edge={from:'a',to:'w'},engine=new CadFlowEngine({equipment:[a,w],cadSchematic:{edges:[edge]}}),token=engine.prepareToken({id:1,nodeId:'a',edge,progress:1});engine.state.cadTokens=[token];
  engine.tryDirectHandover(token);assert.equal(token.asrsInfeedAcceptedAt,0);
  engine.state.t=.1;engine.state.equipmentReliability={w:{available:false}};engine.tryDirectHandover(token);engine.tryDirectHandover(token);assert.equal(token.asrsInfeedAcceptedAt,.1);assert.equal(token.nodeId,'a');
  engine.state.t=.2;engine.state.equipmentReliability.w.available=true;assert.equal(engine.tryDirectHandover(token),false);
  engine.state.t=.3;assert.equal(engine.tryDirectHandover(token),true);assert.equal(token.nodeId,'w');
});

test('직렬 AS/RS의 입고 셀·출고 셀·인계 타이머가 서로 덮어쓰이지 않는다',()=>{
  const w1=storage('w1'),w2=storage('w2'),equipment=[node('s','source',{injectionInterval:8}),w1,w2,node('out','sink')];
  const engine=new CadFlowEngine({equipment,cadSchematic:{edges:[{from:'s',to:'w1',toPort:'product-1-in'},{from:'w1',to:'w2',fromPort:'product-1-out',toPort:'product-2-in'},{from:'w2',to:'out',fromPort:'product-1-out'}]}},{simDuration:90});
  for(let i=0;i<4500;i++){
    engine.step(.02);
    for(const warehouse of Object.values(engine.state.warehouses))assert.equal(warehouse.inventory,Object.values(warehouse.zones).reduce((sum,zone)=>sum+zone.occupiedSlots.filter(Boolean).length,0));
  }
  assert.ok(engine.state.completedProducts.length>3);
  const [a,b]=Object.values(engine.state.warehouses);assert.equal(a.putaways-a.retrievals,a.inventory);assert.equal(b.putaways-b.retrievals,b.inventory);
  assert.ok(Object.values(b.zones)[1].putaways>0);assert.equal(Object.values(b.zones)[0].putaways,0);
  assert.equal(engine.getKpis().asrs.inventory,a.inventory+b.inventory);assert.ok(engine.getKpis().utilization.asrs<=1);
});

for(const continuousHandover of [0,1])for(const rotation of [0,90])test(`병렬→분기→재합류 장기운전: 연속 ${continuousHandover}, 회전 ${rotation}`,()=>{
  const cv=id=>({...node(id,'conveyor',{length:4,speed:1,safetyGap:.2,continuousHandover}),rotation}),fork=node('fork','forkingDevice',{strokeDistance:.1,receiveSpeed:1,transferSpeed:1,holdTime:.1,output1Ratio:50}),equipment=[node('s1','source',{injectionInterval:1}),node('s2','source',{injectionInterval:1}),cv('a'),cv('b'),cv('merge'),fork,cv('c'),cv('d'),cv('end'),node('out','sink',{dischargeTime:.5})];
  const edges=[['s1','a'],['s2','b'],['a','merge'],['b','merge'],['merge','fork'],['fork','c'],['fork','d'],['c','end'],['d','end'],['end','out']].map(([from,to])=>({from,to}));
  const engine=new CadFlowEngine({equipment,cargoSpec:{length:1.2,width:.8,unit:'m'},cadSchematic:{edges}},{simDuration:180}),last=new Map();
  for(let i=0;i<9000;i++){
    engine.step(.02);
    for(const item of equipment){const tokens=engine.state.cadTokens.filter(token=>token.nodeId===item.id);if(item===fork)assert.ok(tokens.length<=1);if(item.type!=='conveyor')continue;
      tokens.sort((a,b)=>b.motion.controller.position-a.motion.controller.position);
      tokens.forEach((token,index)=>{const key=token.id+':'+item.id,position=token.motion.controller.position;assert.ok(position>=(last.get(key)||0)-1e-8,'소유 설비 안에서 물류가 역행하면 안 됨');last.set(key,position);if(index)assert.ok(tokens[index-1].motion.controller.position-position>=cargoLengthOnEquipment(item,engine.layout,tokens[index-1])+.2-1e-8,'물류 안전간격');});
    }
  }
  assert.ok(engine.state.completedProducts.length>10,'진입 가능 물류를 무기한 정지시키면 안 됨');
  for(const id of ['a','b','c','d'])assert.ok(engine.state.events.some(event=>event.type==='sensor-infeed'&&event.equipmentId===id),id+' 경로가 굶으면 안 됨');
});

for(const type of ['forkingDevice','turntable','agv','amr','shuttle','forklift','lift','robot','station','diverter','handoffPoint','sorter']) {
  test(`${type}: 사용 중·고장 중에는 병렬 상류 두 개 모두 진입 불가, 비면 한 개만 인수`,()=>{
    const a=node('a','conveyor',{length:3}),b=node('b','conveyor',{length:3}),machine=node('machine',type),out=node('out','sink'),ea={from:'a',to:'machine'},eb={from:'b',to:'machine'},edges=[ea,eb,{from:'machine',to:'out'}];
    const engine=new CadFlowEngine({equipment:[a,b,machine,out],cadSchematic:{edges}}),first=engine.prepareToken({id:1,nodeId:'a',edge:ea,progress:1}),second=engine.prepareToken({id:2,nodeId:'b',edge:eb,progress:1}),busy=engine.prepareToken({id:3,nodeId:'machine',readyAt:100});
    engine.state.cadTokens=[first,second,busy];assert.equal(engine.tryDirectHandover(first),false);assert.equal(engine.tryDirectHandover(second),false);
    engine.state.cadTokens=[first,second];engine.state.equipmentReliability={machine:{available:false}};assert.equal(engine.tryDirectHandover(first),false);
    engine.state.equipmentReliability.machine.available=true;assert.equal(engine.tryDirectHandover(first),true);assert.equal(engine.tryDirectHandover(second),false);assert.equal(engine.nodeOccupancy('machine'),1);
  });
}
test('다른 스태커도 동일 창고의 같은 빈 셀을 동시에 예약할 수 없다',()=>{
  const a=node('a','conveyor'),b=node('b','conveyor'),w=storage('w');w.parameters.columns=1;
  const ea={from:'a',to:'w',toPort:'product-2-in'},eb={from:'b',to:'w',toPort:'product-2-in'},engine=new CadFlowEngine({equipment:[a,b,w],cadSchematic:{edges:[ea,eb],inboundBranches:[{name:'Alpha',nodeIds:['a']},{name:'Beta',nodeIds:['b']}]}});
  const first=engine.prepareToken({id:1,nodeId:'a',edge:ea,cargoType:'Alpha',flowKey:'Alpha'}),second=engine.prepareToken({id:2,nodeId:'b',edge:eb,cargoType:'Beta',flowKey:'Beta'});engine.state.cadTokens=[first,second];
  engine.resolveZeroDelayHandovers();assert.equal(first.asrsInfeedAcceptedAt,0);assert.equal(second.asrsInfeedAcceptedAt,undefined);
  engine.state.t=.2;engine.resolveZeroDelayHandovers();assert.equal(first.nodeId,'w');assert.equal(second.nodeId,'b');assert.equal(engine.state.asrs.zones.Beta.inventory,1);
});
test('저장명 중복이나 물품 종류 추가가 스태커 수를 임의로 늘리지 않는다',()=>{
  const engine=new CadFlowEngine({equipment:[storage('w')],cadSchematic:{inboundBranches:[{name:'같은 이름'},{name:'같은 이름'}],edges:[]}});
  for(const cargoType of ['A','B','C','D','E'])engine.asrsStackerKey({cargoType});
  assert.equal(Object.keys(engine.state.asrs.stackers).length,2);assert.equal(Object.keys(engine.state.asrs.zones).length,2);
  assert.equal(Object.values(engine.state.asrs.zones).reduce((sum,zone)=>sum+zone.capacity,0),engine.state.asrs.capacity);
});
test('가로·세로 점유길이, 수용량, 초기좌표와 안전간격은 동일한 투영 길이를 사용한다',()=>{
  const cv=node('c','conveyor',{length:5.5,speed:.5,safetyGap:.2}),layout={equipment:[cv],cargoSpec:{length:1.2,width:.8,unit:'m'},cadSchematic:{edges:[]}},engine=new CadFlowEngine(layout),token={cargoOrientation:Math.PI/2};
  assert.equal(cargoLengthOnEquipment(cv,layout,token),.8000000000000002);
  assert.equal(conveyorCargoCapacity(cv,layout,token),5);assert.ok(Math.abs(conveyorEntryPosition(cv,layout,token)-.8)<1e-9);
  assert.ok(Math.abs(engine.createMotion(cv,0,{},token).distance-6.3)<1e-9);
  cv.rotation=90;assert.equal(conveyorCargoCapacity(cv,layout,token),4);assert.equal(conveyorEntryPosition(cv,layout,token),1.2);
});
test('경계 끝에서도 물류 중심을 되돌리지 않으므로 설정 안전간격이 축소되지 않는다',()=>{
  const cv=node('c','conveyor',{length:10,safetyGap:.5}),layout={equipment:[cv]},cargo={length:1.2,width:.8},metrics=equipmentCargoMetrics(layout,cargo,cv,78);
  const a=conveyorCargoVisualPose(cv,cargo,11.2,78,metrics,10,0),b=conveyorCargoVisualPose(cv,cargo,9.48,78,metrics,10,0);
  assert.ok(a.x-b.x-a.visualLength>=.5*78/10);
});
test('물류 크기는 설비별 실제 길이 비율이며 인계 양쪽에 하나의 보간 강체를 사용한다',()=>{
  const a=node('a','conveyor',{length:2}),b=node('b','conveyor',{length:10}),layout={equipment:[a,b]},cargo={length:1,width:.5};
  assert.equal(equipmentCargoMetrics(layout,cargo,a,200).visualLength,100);assert.equal(equipmentCargoMetrics(layout,cargo,b,200).visualLength,20);
  let previous=100;for(let i=0;i<=100;i++){const metrics=handoverCargoMetrics(layout,cargo,a,b,i/100,200);assert.ok(metrics.visualLength<=previous+1e-9);assert.equal(metrics.visualWidth/metrics.visualLength,.5);previous=metrics.visualLength;}
});
test('회전 배치 AMR의 실제 그리기 회전 중심과 선택 좌표가 같다',()=>{
  const vehicle={...node('v','amr'),x:100,y:50,rotation:90,shuttleRoute:{start:{x:100,y:50},end:{x:300,y:50},points:[{x:100,y:50},{x:300,y:50}]}},layout={equipment:[vehicle],cadSchematic:{edges:[]}},token={nodeId:'v',operationStep:{phase:'move',progress:.5}},state={t:1,cadTokens:[token]},translations=[];
  LayoutRenderer.prototype.drawRotatedCadSymbol.call({layout,ctx:{save(){},restore(){},rotate(){},translate(x,y){translations.push({x,y});}},drawCadSymbol(){return true;}},vehicle,state);
  assert.deepEqual(translations[0],equipmentVisualPosition(layout,vehicle,state));
});
test('AMR의 선택 작업 경로는 연결 배열 순서를 바꿔도 유지된다',()=>{
  const a={...node('a','conveyor'),x:0,y:0},v={...node('v','amr'),x:100,y:0},b={...node('b','conveyor'),x:200,y:0},c={...node('c','conveyor'),x:200,y:200},incoming={from:'a',to:'v',kind:'transfer'},toB={from:'v',to:'b',kind:'transfer'},toC={from:'v',to:'c',kind:'transfer'},layout={equipment:[a,v,b,c],cadSchematic:{edges:[incoming,toB,toC]}},assignment={incoming,outgoing:toC};
  const first=mobileEquipmentRoute(layout,v,assignment);layout.cadSchematic.edges.reverse();assert.deepEqual(mobileEquipmentRoute(layout,v,assignment),first);
  const boundary=mobileHandoverNode(layout,v,false,assignment);assert.equal(boundary.x,first.end.x);assert.equal(boundary.y,first.end.y);
});
test('공통 적용은 Dock 역할·물품·라인·포트 연결·분배 대상을 복제하지 않는다',()=>{
  const a=node('a','dock',{dockRole:'inbound',lineName:'A',cargoType:'RED',processTime:3}),b=node('b','dock',{dockRole:'inbound',lineName:'B',cargoType:'BLUE',processTime:1}),c=node('c','dock',{dockRole:'outbound',processTime:1});
  applyCommonParameters({equipment:[a,b,c]},a);assert.equal(b.parameters.processTime,3);assert.equal(b.parameters.lineName,'B');assert.equal(b.parameters.cargoType,'BLUE');assert.equal(c.parameters.processTime,1);
});
test('3D LIVE는 표시 창고와 실제 저장 구역을 기준으로 상태를 선택한다',()=>{
  const w1=storage('w1'),w2=storage('w2'),engine=new CadFlowEngine({equipment:[w1,w2],cadSchematic:{edges:[]}}),asrs=engine.state.warehouses.w2,key=Object.keys(asrs.zones)[1];asrs.zones[key].inventory=1;
  const token={id:1,nodeId:'w2',stackerKey:Object.keys(asrs.stackers)[0],storageFlowKey:key,cargoType:'다른 라인 물류',flowKey:key,asrsPhase:'putaway',asrsTarget:{index:1},nodeEnteredAt:0};engine.state.cadTokens=[token];
  const scene=asrsSceneModel(w2,engine.state,()=> '#00ffff');const storedRack=scene.zones.find(entry=>entry.storageZone===key);assert.equal(storedRack.name,key);assert.equal(storedRack.zone.inventory,1);assert.equal(scene.zones.reduce((sum,entry)=>sum+entry.zone.inventory,0),1);
  assert.equal(asrsSceneModel(w1,engine.state,()=> '#00ffff').zones[0].zone.inventory,0);
});
test('AS/RS 승인 취소의 null 시간은 0초 승인으로 오인하지 않는다',()=>{
  const snapshot=asrsOperationSnapshot(storage('w'),{asrsPhase:'retrieval',asrsTarget:{index:0},nodeEnteredAt:0,handoffAcceptedAt:null},100);
  assert.equal(snapshot.phase,'handoff-wait');assert.equal(snapshot.cargoScale,1);
});

test('일반 프로젝트 리포트는 실제 설비·연결점을 표시하고 명목시간과 실제 CT를 구분한다',()=>{
  const layout={schemaVersion:1,equipment:[node('s','source'),node('r','robot'),node('o','sink')],cadSchematic:{edges:[{from:'s',to:'r',fromPort:'right',toPort:'left'},{from:'r',to:'o'}]}},engine=new CadFlowEngine(layout),report=buildSimulationReport(layout,engine);
  assert.equal(report.rows.length,2);assert.match(report.topology[0],/s \[right\].*r \[left\]/);assert.match(report.timingBasis,/명목/);assert.ok(report.topology.every(line=>!line.includes('AS/RS')));
  layout.cadSchematic.edges[0].to='missing';assert.equal(validateLayout(layout).valid,false);
});

for(const type of ['forkingDevice','turntable','agv','amr','shuttle','forklift','lift','robot','station','diverter','handoffPoint','sorter','buffer'])test(`${type}: 일반 프로젝트에서 인수·작업·배출 시퀀스가 끝나고 후속 물류도 처리된다`,()=>{
  const equipment=[node('s','source',{injectionInterval:2}),node('m',type,{length:2,strokeDistance:.2,shuttleDistance:1,travelDistance:1,liftHeight:1,processTime:.3,pickTime:.2,placeTime:.2,rotationTime:.3,transferTime:.3,cycleTime:.3,loadTime:.2,unloadTime:.2}),node('o','sink',{dischargeTime:.1})],edges=[{from:'s',to:'m'},{from:'m',to:'o'}],layout={equipment,cadSchematic:{edges}},engine=run(new CadFlowEngine(layout,{simDuration:90}),90);
  assert.ok(engine.state.completedProducts.length>=2,type+' 작업이 무기한 멈추면 안 됨');assert.ok(engine.state.events.some(event=>event.type==='sensor-outfeed'&&event.equipmentId==='m'));
});

test('연결선의 화면 좌표·길이는 실제 인계 시각과 완료 UPH를 바꾸지 않는다',()=>{
  const layout={equipment:[node('s','source'),node('cv','conveyor',{length:3}),node('out','sink')],cadSchematic:{edges:[{from:'s',to:'cv'},{from:'cv',to:'out'}]}},moved=structuredClone(layout);moved.equipment[1].x=100000;moved.equipment[1].y=-80000;moved.cadSchematic.edges[0].routeOffset={x:25000,y:99000};
  const a=run(new CadFlowEngine(layout,{simDuration:40}),40),b=run(new CadFlowEngine(moved,{simDuration:40}),40);assert.deepEqual(a.state.events,b.state.events);assert.equal(a.getKpis().throughput,b.getKpis().throughput);
});
