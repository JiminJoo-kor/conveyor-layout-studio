import test from 'node:test';
import assert from 'node:assert/strict';
import { CadFlowEngine, asrsOperationSnapshot, asrsTargetCell } from '../src/engine.js';
import { asrsSceneModel } from '../src/asrs-monitor.js';
import { asrsLayoutCargoPresentation, flowDisplayTitle } from '../src/renderer.js';
import { LayoutEditor } from '../src/editor.js';
import { parameterFieldsFor } from '../src/cad.js';

function setup(slots=[0,5],extra={}){
  const rack={id:'rack',type:'asrs',x:0,y:0,parameters:{rows:1,levels:2,columns:4,productTypes:1,retrievalCarryCount:2,travelSpeed:2,liftSpeed:1,downSpeed:.5,forkStroke:.1,forkSpeed:1,retrievalTime:.1,outfeedTime:.5,modeChangeTime:0,loadCapacity:1000,...extra}};
  const dock={id:'out',type:'dock',parameters:{dockRole:'outbound',processTime:.2}};
  const layout={equipment:[rack,dock],cargoSpec:{length:1,width:.8,weight:100,unit:'m'},cadSchematic:{edges:[{from:'rack',to:'out'}]}};
  const engine=new CadFlowEngine(layout,{simDuration:500});engine.sources=[];
  const warehouse=engine.state.asrs,name=Object.keys(warehouse.zones)[0],zone=warehouse.zones[name];
  for(const [index,slot] of slots.entries()){
    const token=engine.prepareToken({id:index+1,nodeId:'rack',flowKey:name,originFlowKey:name,cargoType:name,storageFlowKey:name,asrsPhase:'stored',asrsTarget:asrsTargetCell(rack,slot),storedCargoOrientation:Math.PI/2,createdAt:0,readyAt:Infinity});
    engine.state.cadTokens.push(token);zone.occupiedSlots[slot]=true;zone.inventory++;warehouse.inventory++;
  }
  engine.asrsLineState(name,warehouse).mode='outbound';
  return {engine,rack,dock,zone,warehouse,name};
}
function advanceUntil(engine,predicate,max=10000){for(let i=0;i<max&&!predicate();i++)engine.step(.02);assert.ok(predicate(),'condition must be reached\n'+engine.flowDiagnosticText());}

test('retrieval starts at retained inlet position and waits at outlet after unloading',()=>{
 const {engine,rack,warehouse,name}=setup([3],{infeedColumn:1,outfeedColumn:4});
 warehouse.stackers[name].position={column:0,level:0,row:0};engine.scheduleAsrsBatchRetrieval();
 assert.equal(engine.state.cadTokens[0].retrievalMission.segments[0].from.column,0);
 advanceUntil(engine,()=>engine.state.completedProducts.length===1);
 assert.equal(warehouse.stackers[name].position.column,3);
 assert.equal(asrsSceneModel(rack,engine.state,()=> '#fff').zones[0].operation.x,3);
 engine.step(2);assert.equal(warehouse.stackers[name].position.column,3);
});

test('multi-pick visits two occupied cells in order, carries both and handshakes each load',()=>{
  const {engine,rack,zone,warehouse}=setup(),tokens=[...engine.state.cadTokens];
  let accept=false;engine.canAcceptNode=()=>accept;engine.predictedEntryAvailable=()=>accept;
  engine.scheduleAsrsBatchRetrieval();const mission=tokens[0].retrievalMission;
  assert.equal(mission.entries.length,2);assert.equal(tokens[1].readyAt,Infinity);
  advanceUntil(engine,()=>mission.pickedIds.length===1);
  assert.equal(zone.inventory,1);assert.equal(zone.occupiedSlots[0],false);assert.equal(zone.occupiedSlots[5],true);
  advanceUntil(engine,()=>engine.state.t>=mission.startedAt+mission.total);
  assert.equal(zone.inventory,0);assert.equal(warehouse.retrievals,0);assert.equal(mission.pickedIds.length,2);
  const op=asrsOperationSnapshot(rack,tokens[0],engine.state.t);assert.equal(op.phase,'handoff-wait');assert.equal(op.carriedCargo.length,2);assert.equal(op.x,mission.home.column);
  const a=asrsLayoutCargoPresentation(rack,engine.state,tokens[0]),b=asrsLayoutCargoPresentation(rack,engine.state,tokens[1]);assert.ok(a.visible&&b.visible);assert.notEqual(a.x,b.x);
  const scene=asrsSceneModel(rack,engine.state,()=> '#00ffff');assert.equal(scene.zones[0].operation.carriedCargo.length,2);assert.equal(scene.zones[0].zone.inventory,0);
  accept=true;advanceUntil(engine,()=>tokens[0].nodeId==='rack::station-1-out');accept=false;
  assert.equal(tokens[1].nodeId,'rack::station-1-out');assert.equal(warehouse.retrievals,2);
  assert.equal(tokens[0].nodeEnteredAt,tokens[1].nodeEnteredAt);assert.ok(Math.abs(tokens[0].motionState.position-tokens[1].motionState.position)>=engine.minimumFollowingSpacing(engine.nodes.get(tokens[0].nodeId),tokens[0]));
  engine.step(3);assert.equal(tokens[1].nodeId,'rack::station-1-out');
  assert.equal(Object.keys(warehouse.pickMissions).length,0);assert.equal(tokens[1].cargoOrientation,Math.PI/2);
  const picks=engine.state.events.filter(e=>e.type==='asrs-cell-picked');assert.deepEqual(picks.map(e=>e.target.index),[0,5]);assert.ok(picks[1].t>picks[0].t);
  assert.equal(engine.state.events.filter(e=>e.type==='asrs-handoff-complete').length,2);
});

test('capacity two retrieves a single available load without waiting for another',()=>{
  const {engine}=setup([3]);engine.scheduleAsrsBatchRetrieval();assert.equal(engine.state.cadTokens[0].retrievalMission.entries.length,1);
  advanceUntil(engine,()=>engine.state.completedProducts.length===1);assert.equal(engine.state.asrs.retrievals,1);
});
test('multi-pick obeys aggregate payload and independent release threshold',()=>{
  const {engine}=setup([0,5],{loadCapacity:150});engine.scheduleAsrsBatchRetrieval();assert.equal(engine.state.cadTokens[0].retrievalMission.entries.length,1);
  const gated=setup([0],{batchReleaseEnabled:1,releaseBatchSize:2});gated.engine.scheduleAsrsBatchRetrieval();assert.equal(gated.engine.state.cadTokens[0].asrsPhase,'stored');
});
test('cells with no stock are never selected and mission progress does not roll back',()=>{
  const {engine,zone}=setup();zone.occupiedSlots[5]=false;zone.inventory=1;engine.scheduleAsrsBatchRetrieval();const mission=engine.state.cadTokens[0].retrievalMission;assert.deepEqual(mission.entries.map(e=>e.target.index),[0]);
});
test('outbound add creates DOCK with named outbound lane and no source behavior',()=>{
  const layout={displayMode:'cad',equipment:[],cadSchematic:{edges:[],lanes:[]}},editor=Object.create(LayoutEditor.prototype);
  Object.assign(editor,{getLayout:()=>layout,renderer:{setSelected(){}},onSelect(){},onChange(){}});
  const {item}=editor.addAt('sink',{x:100,y:100});assert.equal(item.type,'dock');assert.equal(item.parameters.dockRole,'outbound');assert.ok(item.parameters.lineName);assert.equal(layout.cadSchematic.lanes[0].nodes[0].id,item.id);
  assert.equal(flowDisplayTitle('fallback','출고',item),item.parameters.lineName);
  const engine=new CadFlowEngine(layout);engine.step(10);assert.equal(engine.state.cadTokens.length,0);
});
test('ASRS hides the redundant carrying parameter',()=>{
  for(const type of ['asrs','stackerCrane'])assert.equal(parameterFieldsFor({type}).some(f=>f.key==='retrievalCarryCount'),false);
});

for(const type of ['conveyor','amr','agv'])test(`multi-pick uses real ${type} receiver interlocks without load loss`,()=>{
  const {engine,dock,warehouse}=setup();dock.type=type;dock.x=200;dock.y=0;dock.parameters={length:4,speed:.5,continuousHandover:1,safetyGap:.2,shuttleDistance:2,travelSpeed:1,receiveSpeed:.5,transferSpeed:.5,loadTime:1,unloadTime:1};
  const sink={id:'sink',type:'sink',x:400,y:0,parameters:{processTime:.2}},edge={from:'out',to:'sink'};
  engine.layout.equipment.push(sink);engine.nodes.set('sink',sink);engine.edges.push(edge);engine.outgoing.set('out',[edge]);engine.outgoing.set('sink',[]);engine.incoming.set('sink',1);
  advanceUntil(engine,()=>engine.state.completedProducts.length===2);
  assert.equal(warehouse.retrievals,2);assert.equal(warehouse.inventory,0);assert.equal(engine.state.cadTokens.length,0);
  assert.equal(engine.state.events.filter(e=>e.type==='asrs-multipick-start').length,1);
});

test('two independent stackers retrieve concurrently and reserve only their own loads',()=>{
  const {engine,rack,warehouse,name}=setup([0,5],{productTypes:2}),other=Object.keys(warehouse.zones).find(n=>n!==name),zone=warehouse.zones[other];
  for(const [i,slot] of [1,6].entries()){engine.state.cadTokens.push(engine.prepareToken({id:i+3,nodeId:rack.id,flowKey:other,originFlowKey:other,cargoType:other,storageFlowKey:other,asrsPhase:'stored',asrsTarget:asrsTargetCell(rack,slot),createdAt:0,readyAt:Infinity}));zone.occupiedSlots[slot]=true;zone.inventory++;warehouse.inventory++;}
  engine.asrsLineState(other,warehouse).mode='outbound';engine.scheduleAsrsBatchRetrieval();
  assert.equal(Object.keys(warehouse.pickMissions).length,2);
  const missions=Object.values(warehouse.pickMissions);assert.equal(missions[0].startedAt,missions[1].startedAt);assert.deepEqual(missions.map(m=>m.entries.length),[2,2]);
  advanceUntil(engine,()=>engine.state.completedProducts.length===4);assert.equal(warehouse.retrievals,4);
});

test('reliability stop freezes the multi-pick clock and resumes without reverse motion',()=>{
  const {engine,rack}=setup();engine.scheduleAsrsBatchRetrieval();engine.step(.4);const token=engine.state.cadTokens[0],mission=token.retrievalMission,elapsed=engine.state.t-mission.startedAt;
  engine.state.equipmentReliability[rack.id]={available:false};engine.state.t+=1;engine.updateRetrievalMissions(1);
  assert.ok(Math.abs(engine.state.t-mission.startedAt-elapsed)<1e-8);
  assert.ok(Math.abs(asrsOperationSnapshot(rack,token,engine.state.t).elapsed-elapsed)<1e-8);
  assert.match(engine.flowDiagnosticText(),/AS\/RS 다중 출고 작업/);
});

test('parameter edits do not release a follower before the shared retrieval finishes',()=>{
  const {engine,rack}=setup();engine.scheduleAsrsBatchRetrieval();const [first,second]=engine.state.cadTokens,ready=first.readyAt;
  rack.parameters.retrievalCarryCount=3;rack.parameters.travelSpeed=10;engine.hotReloadEquipment(rack);
  assert.equal(second.readyAt,Infinity);assert.equal(first.readyAt,ready);assert.equal(first.retrievalMission.parameters.travelSpeed,2);
});

test('output station count overrides the legacy carry count and visits N cells',()=>{
  const {engine}=setup([0,3,5],{retrievalCarryCount:1,outfeedBufferCount:3});
  engine.scheduleAsrsBatchRetrieval();
  const mission=engine.state.cadTokens[0].retrievalMission;
  assert.deepEqual(mission.entries.map(e=>e.target.index),[0,3,5]);
  advanceUntil(engine,()=>mission.pickedIds.length===3);
  assert.deepEqual(engine.state.events.filter(e=>e.type==='asrs-cell-picked').map(e=>e.target.index),[0,3,5]);
  advanceUntil(engine,()=>engine.state.completedProducts.length===3);
});

test('per-line output count overrides the common count',()=>{
  const {engine}=setup([0,3,5],{retrievalCarryCount:1,outfeedBufferCount:3,stationLineCounts:{0:{out:2}}});
  engine.scheduleAsrsBatchRetrieval();
  assert.equal(engine.state.cadTokens[0].retrievalMission.entries.length,2);
  assert.equal(engine.nodes.get('rack::station-1-out').asrsStation.count,2);
});

test('lower station count is not raised by a legacy carry setting',()=>{
  const {engine}=setup([0,5],{retrievalCarryCount:4,outfeedBufferCount:1});
  engine.scheduleAsrsBatchRetrieval();
  assert.equal(engine.nodes.get('rack::station-1-out').asrsStation.count,1);
  assert.equal(engine.state.cadTokens.filter(t=>t.asrsPhase==='retrieval').length,1);
});

test('ordinary retrieval fills N despite a stale release allowance',()=>{
  const {engine,zone}=setup([0,5],{outfeedBufferCount:2});
  zone.releaseRemaining=1;
  engine.scheduleAsrsBatchRetrieval();
  assert.equal(engine.state.cadTokens[0].retrievalMission.entries.length,2);
});
