import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneLayout, defaultLayout, validateLayout } from '../src/layout.js';
import { CadFlowEngine, SimulationEngine, validateParams } from '../src/engine.js';

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

test('출고 트럭은 설정 수량이 적재되면 출발한다',()=>{
  const equipment=[{id:'asrs',type:'stackerCrane',x:0,y:0,source:{origin:'dxf'},parameters:{rows:1,columns:10,levels:1}},{id:'cv',type:'conveyor',x:100,y:0,source:{origin:'dxf'},parameters:{speed:10}},{id:'amr',type:'amr',x:200,y:0,source:{origin:'dxf'},parameters:{speed:10,shuttleDistance:1,loadTime:.1,unloadTime:.1}},{id:'truck',type:'dock',x:300,y:0,source:{origin:'dxf'},parameters:{dockRole:'outbound',truckCapacity:2,processTime:.1}}],engine=new CadFlowEngine({equipment,cadSchematic:{edges:[{from:'asrs',to:'cv'},{from:'cv',to:'amr'},{from:'amr',to:'truck'}]}},{injectA:1,simDuration:30});for(let i=0;i<600;i++)engine.step(.05);assert.ok(engine.state.outboundTrucks.truck.departures>0);assert.ok(engine.state.events.some(event=>event.type==='truck-departed'));
});

test('AS/RS는 트림·화이날·도어를 각각 16개 구역으로 관리한다',()=>{
  const branches=['트림 라인','화이날 라인','도어 라인'].map((name,index)=>({name,nodeIds:[`in-${index}`]})),equipment=branches.flatMap((branch,index)=>[{id:`in-${index}`,type:'source',x:0,y:index*100,source:{origin:'dxf'},parameters:{}},{id:`cv-${index}`,type:'conveyor',x:100,y:index*100,source:{origin:'dxf'},parameters:{speed:10}}]);equipment.push({id:'asrs',type:'stackerCrane',x:200,y:100,source:{origin:'dxf'},parameters:{}});const edges=branches.flatMap((branch,index)=>[{from:`in-${index}`,to:`cv-${index}`},{from:`cv-${index}`,to:'asrs',kind:'warehouse'}]),engine=new CadFlowEngine({equipment,cadSchematic:{inboundBranches:branches,edges}},{injectA:1,simDuration:10});for(let i=0;i<200;i++)engine.step(.05);assert.equal(engine.state.asrs.capacity,48);assert.deepEqual(Object.values(engine.state.asrs.zones).map(zone=>zone.capacity),[16,16,16]);assert.ok(Object.values(engine.state.asrs.zones).every(zone=>zone.putaways>0));
});
