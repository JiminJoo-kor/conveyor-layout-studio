import test from 'node:test';
import assert from 'node:assert/strict';
import {diverterRouteIndex,diverterRouteKey,diverterAvailableIndex,diverterAllowsEdge} from '../src/diverter.js';
import {CadFlowEngine} from '../src/engine.js';
import {refreshEquipmentConnections,setEquipmentFlowDirection} from '../src/editor.js';

function fixture(){
  const cv={id:'cv',name:'분배',type:'conveyor',x:0,y:0,parameters:{flowDirection:'up',length:2,speed:1,diverterEnabled:1,diverterPorts:['left','right'],diverterRoutingMode:'rules'}};
  const edges=['top','left','right'].map(fromPort=>({from:'cv',to:fromPort,fromPort,toPort:'bottom',manual:true}));
  const equipment=[cv,...['top','left','right'].map(id=>({id,type:'sink',x:0,y:-100,parameters:{dischargeTime:.1}}))];
  cv.parameters.diverterRules=[{field:'cargo',value:'A',route:diverterRouteKey(edges[1])},{field:'cargo',value:'B',route:diverterRouteKey(edges[2])}];
  return {cv,edges,layout:{equipment,cargoSpec:{length:500,width:300,unit:'mm'},cadSchematic:{edges}}};
}
test('상향 직진·종류별 좌우 분기: 색상과 출발 라인에 무관하게 물류 종류로 판정',()=>{
  const {cv,edges}=fixture();assert.equal(diverterRouteIndex(cv,edges,{cargoType:'A',flowKey:'B',color:'red'}),1);assert.equal(diverterRouteIndex(cv,edges,{cargoType:'B'}),2);assert.equal(diverterRouteIndex(cv,edges,{cargoType:'C'}),0);
  cv.parameters.diverterRules.unshift({field:'destination',value:'OUT',route:diverterRouteKey(edges[2])});assert.equal(diverterRouteIndex(cv,edges,{cargoType:'A',outboundFlowKey:'OUT'}),2);
});
test('지정 출구 차단 시 다른 빈 출구로 오분류하지 않고 명시적 대체만 허용',()=>{
  const {cv,edges}=fixture(),available=edge=>edge===edges[2];assert.equal(diverterAvailableIndex(cv,edges,1,available),1);cv.parameters.diverterAlternatives=[diverterRouteKey(edges[0])];assert.equal(diverterAvailableIndex(cv,edges,1,available),1);cv.parameters.diverterAlternatives.push(diverterRouteKey(edges[2]));assert.equal(diverterAvailableIndex(cv,edges,1,available),2);
});
test('비율은 완료 건수로 3:7, 가용 경로 모드에서는 가능한 출구 선택',()=>{
  const {cv,edges}=fixture();cv.parameters.diverterRoutingMode='ratio';cv.parameters.diverterWeights={[diverterRouteKey(edges[0])]:3,[diverterRouteKey(edges[1])]:7};assert.deepEqual(Array.from({length:10},(_,i)=>diverterRouteIndex(cv,edges,{},i)),[0,0,0,1,1,1,1,1,1,1]);cv.parameters.diverterRoutingMode='available';assert.equal(diverterAvailableIndex(cv,edges,0,edge=>edge===edges[2]),2);
});
test('연결점 삭제 시 해당 조건은 대기하고 임의의 첫 경로로 보내지 않음',()=>{
  const {cv,edges,layout}=fixture();layout.cadSchematic.edges=edges.filter(edge=>edge.to!=='left');const engine=new CadFlowEngine(layout),token={id:1,nodeId:'cv',cargoType:'A'};const options=engine.outgoing.get('cv');assert.equal(engine.selectRoute(options,cv,token),-1);assert.equal(engine.plannedEdgeForToken(token,cv,options),null);
});
test('회전·배치 수정 후 측면 연결점과 조건 매핑 유지',()=>{
  const {cv,edges,layout}=fixture(),key=diverterRouteKey(edges[1]);cv.rotation=90;refreshEquipmentConnections(layout,'cv');assert.equal(diverterRouteKey(edges[1]),key);assert.ok(diverterAllowsEdge(cv,edges[1]));setEquipmentFlowDirection(layout,'cv','right');assert.equal(diverterRouteKey(edges[1]),key);
});
test('실제 엔진 반복 이송에서 종류별 지정 출구로만 도착하고 완료 건수 누적',()=>{
  const {cv,edges,layout}=fixture();layout.equipment.push({id:'source',type:'source',parameters:{injectionInterval:3,cargoType:'A'}});layout.cadSchematic.edges.push({from:'source',to:'cv',toPort:'bottom'});
  const engine=new CadFlowEngine(JSON.parse(JSON.stringify(layout)),{simDuration:60});for(let i=0;i<3000;i++)engine.step(.02);
  const arrivals=engine.state.events.filter(event=>event.type==='sensor-infeed'&&['top','left','right'].includes(event.equipmentId));assert.ok(arrivals.length>2);assert.ok(arrivals.every(event=>event.equipmentId==='left'));assert.equal(engine.state.routeAccumulators['diverter:cv'],arrivals.length);
});
test('직진 연결점도 설비 로컬 좌표로 저장되어 회전 후 유지',()=>{
  const {cv,edges}=fixture();cv.parameters.diverterMainPort='top';cv.rotation=90;assert.equal(diverterRouteIndex(cv,edges,{cargoType:'C'}),0);assert.ok(diverterAllowsEdge(cv,edges[1]));assert.ok(diverterAllowsEdge(cv,edges[2]));assert.equal(diverterAllowsEdge(cv,{fromPort:'bottom'}),false);
});
test('지정 경로가 없는 실제 시퀀스는 종료점에서 대기하고 진단 사유를 남긴다',()=>{
  const {layout}=fixture();layout.cadSchematic.edges=layout.cadSchematic.edges.filter(edge=>edge.to!=='left');layout.equipment.push({id:'source',type:'source',parameters:{injectionInterval:3,cargoType:'A'}});layout.cadSchematic.edges.push({from:'source',to:'cv',toPort:'bottom'});
  const engine=new CadFlowEngine(layout,{simDuration:30});for(let i=0;i<1500;i++)engine.step(.02);assert.equal(engine.state.completedProducts.length,0);assert.ok(engine.state.events.some(event=>event.type==='diverter-route-blocked'));assert.match(engine.flowDiagnosticText(),/설정 조건에 맞는 연결 출구 없음/);
});
