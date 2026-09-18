import test from 'node:test';
import assert from 'node:assert/strict';
import { asrsStationSpec,syncAsrsStations,stationId,positionAsrsStations } from '../src/asrs-stations.js';
import { connectableEquipmentPorts,equipmentPorts } from '../src/route.js';
import { CadFlowEngine,asrsTargetCell } from '../src/engine.js';
import { validateFlowGraph } from '../src/flow-graph.js';
import { asrsSceneModel } from '../src/asrs-monitor.js';
import {refreshEquipmentConnections,removeEquipmentAndReconnect} from '../src/editor.js';
import {equipmentCargoMetrics,equipmentClipBounds,conveyorCargoVisualPose} from '../src/renderer.js';

test('internal and normal conveyors use identical drawing and cargo scale in both views',()=>{
  for(const view of ['schematic','hybrid']){const l=layout();l.cadViewMode=view;syncAsrsStations(l);const station=l.equipment.find(e=>e.asrsStation),normal={...station,asrsStation:undefined},length=view==='hybrid'?58:78,cargo={length:1.2,width:.8};
    assert.equal(station.asrsStation.visualLength,length);assert.equal(station.asrsStation.visualWidth,view==='hybrid'?16:24);
    assert.deepEqual(equipmentCargoMetrics(l,cargo,station,length),equipmentCargoMetrics(l,cargo,normal,length));assert.deepEqual(equipmentClipBounds(station,length),equipmentClipBounds(normal,length));
    for(const rotation of [0,90,180,270]){station.rotation=normal.rotation=rotation;assert.deepEqual(conveyorCargoVisualPose(station,cargo,1,length),conveyorCargoVisualPose(normal,cargo,1,length));}
  }
});
test('all station side combinations rotate along their conveyor axis and fit warehouse bounds',()=>{
  for(const infeedSide of ['left','right','top','bottom'])for(const outfeedSide of ['left','right','top','bottom'])for(const rotation of [0,90]){
    const l=layout(),rack=l.equipment[1];Object.assign(rack.parameters,{productTypes:4,infeedSide,outfeedSide});rack.rotation=rotation;syncAsrsStations(l);const bounds=rack.asrsVisualBounds,ports=equipmentPorts(rack);
    for(const child of l.equipment.filter(e=>e.asrsStation)){const {index,kind}=child.asrsStation,anchor=ports[`product-${index+1}-${kind}`],childPorts=equipmentPorts(child),inner=kind==='in'?childPorts.right:childPorts.left;
      assert.ok(Math.abs(Math.hypot(inner.x-anchor.x,inner.y-anchor.y)-8)<1e-8);const axis=(child.rotation*Math.PI/180),dx=child.x-anchor.x,dy=child.y-anchor.y;assert.ok(Math.abs(dx*Math.sin(axis)-dy*Math.cos(axis))<1e-8);
      const a=-rotation*Math.PI/180,x=(anchor.x-rack.x)*Math.cos(a)-(anchor.y-rack.y)*Math.sin(a),y=(anchor.x-rack.x)*Math.sin(a)+(anchor.y-rack.y)*Math.cos(a);assert.ok(Math.abs(x)<=bounds.width/2+8.01&&Math.abs(y)<=bounds.height/2+8.01);
    }
  }
});

test('legacy warehouses without station settings migrate once and preserve upstream line identity',()=>{
  const l=layout();delete l.equipment[1].parameters.stationConveyorsEnabled;
  l.equipment.push({id:'cv',type:'conveyor',parameters:{length:3,speed:1}});
  l.cadSchematic.inboundBranches=[{name:'A',nodeIds:[]},{name:'B',nodeIds:['source']}];
  l.cadSchematic.edges=[{from:'source',to:'cv'},{from:'cv',to:'rack'},{from:'rack',to:'sink'}];
  syncAsrsStations(l);assert.equal(l.cadSchematic.edges.find(e=>e.from==='cv').to,stationId('rack',1,'in'));
  assert.deepEqual(l.cadSchematic.edges.filter(e=>e.to==='sink').map(e=>e.from).sort(),[stationId('rack',0,'out'),stationId('rack',1,'out')]);
  const copy=structuredClone(l);syncAsrsStations(l);assert.deepEqual(l,copy);
});

test('moving a warehouse preserves internal product ports and removing it removes its children',()=>{
  const l=layout();syncAsrsStations(l);const before=l.cadSchematic.edges.filter(e=>e.asrsStationInternal).map(e=>({...e}));
  l.equipment.find(e=>e.id==='rack').x=200;refreshEquipmentConnections(l,'rack');positionAsrsStations(l);
  assert.deepEqual(l.cadSchematic.edges.filter(e=>e.asrsStationInternal),before);
  assert.equal(removeEquipmentAndReconnect(l,stationId('rack',0,'in')),false);
  assert.equal(removeEquipmentAndReconnect(l,'rack'),true);assert.equal(l.equipment.some(e=>e.asrsStation),false);assert.equal(l.cadSchematic.edges.length,0);
});
test('invalid per-line buffer counts are rejected rather than silently simulated',()=>{
  const l=layout();l.equipment[1].parameters.stationLineCounts={0:{in:-1}};syncAsrsStations(l);assert.equal(validateFlowGraph(l).valid,false);
});
test('multiple warehouses derive independent station IDs and capacity',()=>{
  const l=layout(),second=structuredClone(l.equipment[1]);second.id='rack-2';second.parameters.productTypes=1;second.parameters.infeedBufferCount=3;l.equipment.push(second);syncAsrsStations(l);
  assert.equal(l.equipment.filter(e=>e.asrsStation).length,6);assert.equal(l.equipment.find(e=>e.id===stationId('rack-2',0,'in')).asrsStation.count,3);assert.equal(l.equipment.find(e=>e.id===stationId('rack',0,'in')).asrsStation.count,2);assert.ok(validateFlowGraph(l).valid);
});

function layout(){return {displayMode:'cad',cargoSpec:{length:1200,width:800,weight:100,unit:'mm'},equipment:[{id:'source',type:'source',x:-300,y:0,parameters:{injectionInterval:2,cargoType:'A'}},{id:'rack',type:'asrs',name:'Rack',x:0,y:0,parameters:{stationConveyorsEnabled:1,retrievalCarryCount:2,infeedBufferCount:2,outfeedBufferCount:2,productTypes:2,zoneNames:['A','B'],rows:1,levels:1,columns:4,travelSpeed:3,liftSpeed:2,forkStroke:.1,forkSpeed:2,putawayTime:.1,retrievalTime:.1,infeedTime:.1,outfeedTime:.1,modeChangeTime:0}},{id:'sink',type:'sink',x:300,y:0,parameters:{processTime:.1}}],cadSchematic:{inboundBranches:[{name:'A',cargoType:'A',nodeIds:['source']}],edges:[{from:'source',to:'rack',toPort:'product-1-in'},{from:'rack',to:'sink',fromPort:'product-1-out'}]}};}

function addBuffered(engine,id){const station=engine.nodes.get(stationId('rack',0,'in'));const token=engine.prepareToken({id,nodeId:station.id,flowKey:'A',cargoType:'A',readyAt:0,createdAt:0});engine.state.cadTokens.push(token);return token;}
function addStored(engine,id,slot){const rack=engine.nodes.get('rack'),zone=engine.state.asrs.zones.A;zone.occupiedSlots[slot]=true;zone.inventory++;engine.state.asrs.inventory++;const token=engine.prepareToken({id,nodeId:'rack',flowKey:'A',cargoType:'A',storageFlowKey:'A',asrsPhase:'stored',asrsTarget:asrsTargetCell(rack,slot),readyAt:Infinity,createdAt:0});engine.state.cadTokens.push(token);return token;}
test('infeed waits for configured count, then drains the admitted batch without waiting for refill',()=>{
  const engine=new CadFlowEngine(layout(),{simDuration:200});engine.sources=[];addBuffered(engine,1);
  for(let i=0;i<1000;i++)engine.step(.02);assert.equal(engine.state.asrs.putaways,0);
  addBuffered(engine,2);for(let i=0;i<3000&&engine.state.asrs.putaways<2;i++)engine.step(.02);
  assert.equal(engine.state.asrs.putaways,2,engine.flowDiagnosticText());assert.equal(engine.state.cadTokens.filter(t=>t.nodeId===stationId('rack',0,'in')).length,0);
});
test('partial infeed does not block available outbound retrieval',()=>{
  const engine=new CadFlowEngine(layout(),{simDuration:200});engine.sources=[];const inbound=addBuffered(engine,1);addStored(engine,2,0);addStored(engine,3,1);
  for(let i=0;i<3000&&engine.state.asrs.retrievals<2;i++)engine.step(.02);
  assert.equal(engine.state.asrs.retrievals,2,engine.flowDiagnosticText());assert.equal(engine.state.asrs.putaways,0);assert.equal(inbound.nodeId,stationId('rack',0,'in'));
});
test('two retrieved loads land on outfeed station on exactly the same simulation tick',()=>{
  const engine=new CadFlowEngine(layout(),{simDuration:200});engine.sources=[];const a=addStored(engine,1,0),b=addStored(engine,2,1);
  for(let i=0;i<3000&&a.nodeId==='rack';i++){engine.step(.02);assert.equal(a.nodeId==='rack',b.nodeId==='rack');}
  assert.equal(a.nodeId,stationId('rack',0,'out'));assert.equal(b.nodeId,a.nodeId);assert.equal(a.nodeEnteredAt,b.nodeEnteredAt);assert.ok(Math.abs(a.motionState.position-b.motionState.position)>=engine.minimumFollowingSpacing(engine.nodes.get(a.nodeId),a));
  assert.equal(engine.state.events.find(e=>e.type==='asrs-batch-deposit-complete').count,2);
});
test('outfeed station count replaces the old separate retrieval load setting',()=>{
  const l=layout();l.equipment[1].parameters.outfeedBufferCount=1;l.equipment[1].parameters.stationLineCounts={0:{out:1}};syncAsrsStations(l);
  assert.equal(l.equipment.find(e=>e.id===stationId('rack',0,'out')).asrsStation.count,1);
});
test('full rack can retrieve to release space for a pending infeed batch without deadlock',()=>{
  const l=layout();l.equipment[1].parameters.columns=2;const engine=new CadFlowEngine(l,{simDuration:200});engine.sources=[];
  addStored(engine,1,0);addStored(engine,2,1);addBuffered(engine,3);addBuffered(engine,4);
  for(let i=0;i<6000&&engine.state.asrs.putaways<2;i++)engine.step(.02);
  assert.equal(engine.state.asrs.putaways,2,engine.flowDiagnosticText());assert.ok(engine.state.asrs.retrievals>=2);
});
test('derived conveyors reconnect by product port, survive repeated sync and JSON round-trip',()=>{
  const l=layout();syncAsrsStations(l);assert.equal(l.equipment.filter(e=>e.asrsStation).length,4);assert.equal(l.cadSchematic.edges.length,6);assert.ok(validateFlowGraph(l).valid);
  assert.equal(l.cadSchematic.edges.find(e=>e.from==='source').to,stationId('rack',0,'in'));
  assert.equal(l.cadSchematic.edges.find(e=>e.to==='sink').from,stationId('rack',0,'out'));
  const saved=JSON.parse(JSON.stringify(l));syncAsrsStations(saved);assert.deepEqual(saved,l);assert.equal(new Set(saved.equipment.map(e=>e.id)).size,7);
  assert.deepEqual(connectableEquipmentPorts(l.equipment.find(e=>e.id==='rack')),{});
  assert.deepEqual(Object.keys(connectableEquipmentPorts(l.equipment.find(e=>e.id===stationId('rack',0,'in')))),['left']);
});
test('cargo sizing and per-line capacity determine physical and visual conveyor length',()=>{
  const l=layout(),rack=l.equipment[1];rack.parameters.stationLineCounts={1:{in:3,out:1}};syncAsrsStations(l);
  const a=l.equipment.find(e=>e.id===stationId('rack',0,'in')),b=l.equipment.find(e=>e.id===stationId('rack',1,'in'));
  assert.ok(b.parameters.length>a.parameters.length);assert.equal(b.asrsStation.visualLength,a.asrsStation.visualLength);assert.equal(b.asrsStation.count,3);
  assert.ok(a.parameters.length>=2*Math.hypot(1.2,.8)+.2);
  const before=a.parameters.length;l.cargoSpec.length=2000;syncAsrsStations(l);assert.ok(l.equipment.find(e=>e.id===a.id).parameters.length>before);
  rack.rotation=90;rack.x=100;positionAsrsStations(l);const ports=equipmentPorts(a);assert.ok(Number.isFinite(ports.left.y));assert.ok(Math.abs(ports.left.y-ports.right.y)>40);
});
test('legacy disabled flag cannot remove mandatory ASRS stations',()=>{
  const l=layout();syncAsrsStations(l);l.equipment.find(e=>e.id==='rack').parameters.stationConveyorsEnabled=0;syncAsrsStations(l);
  assert.equal(l.equipment.length,7);assert.equal(l.cadSchematic.edges.length,6);assert.equal(l.cadSchematic.edges[0].to,stationId('rack',0,'in'));assert.equal(l.equipment.find(e=>e.id==='rack').parameters.stationConveyorsEnabled,1);
});
test('unconnected internal conveyors never generate cargo as automatic sources',()=>{
  const l=layout();l.cadSchematic.edges=[];const engine=new CadFlowEngine(l);engine.step(20);assert.ok(engine.sources.every(e=>!e.asrsStation));assert.equal(engine.state.cadTokens.filter(t=>t.nodeId.includes('::')).length,0);
});
test('infeed buffer accepts only its configured count while its stacker is occupied',()=>{
  const l=layout(),engine=new CadFlowEngine(l,{simDuration:300}),rack=engine.nodes.get('rack'),name='A',zone=engine.state.asrs.zones[name];
  const busy=engine.prepareToken({id:999,nodeId:'rack',flowKey:name,cargoType:name,storageFlowKey:name,asrsPhase:'putaway',asrsTarget:asrsTargetCell(rack,0),readyAt:200,nodeEnteredAt:0});zone.occupiedSlots[0]=true;zone.inventory=1;engine.state.asrs.inventory=1;engine.state.cadTokens.push(busy);
  for(let i=0;i<1500;i++){engine.step(.02);assert.ok(engine.nodeOccupancy(stationId('rack',0,'in'))<=2);}
  assert.equal(engine.nodeOccupancy(stationId('rack',0,'in')),2);assert.equal(engine.nodeOccupancy(stationId('rack',1,'in')),0);
  assert.equal(engine.canAcceptNode(engine.nodes.get(stationId('rack',0,'in')),null,engine.edges.find(e=>e.from==='source')),false);
});
test('multi-pick unloads onto its outfeed buffer and buffer handshakes downstream independently',()=>{
  const l=layout(),engine=new CadFlowEngine(l,{simDuration:300});engine.sources=[];const rack=engine.nodes.get('rack'),zone=engine.state.asrs.zones.A;
  for(let i=0;i<3;i++){zone.occupiedSlots[i]=true;zone.inventory++;engine.state.asrs.inventory++;engine.state.cadTokens.push(engine.prepareToken({id:i+1,nodeId:'rack',flowKey:'A',cargoType:'A',storageFlowKey:'A',asrsPhase:'stored',asrsTarget:asrsTargetCell(rack,i),readyAt:Infinity,createdAt:0}));}
  engine.asrsLineState('A').mode='outbound';const accept=engine.canAcceptNode.bind(engine);let blocked=true;engine.canAcceptNode=(item,...args)=>item?.id==='sink'&&blocked?false:accept(item,...args);
  for(let i=0;i<4000;i++){engine.step(.02);assert.ok(engine.nodeOccupancy(stationId('rack',0,'out'))<=2);assert.equal(engine.state.cadTokens.length+engine.state.completedProducts.length,3);}
  assert.equal(engine.nodeOccupancy(stationId('rack',0,'out')),2);assert.equal(engine.state.cadTokens.filter(t=>t.nodeId==='rack').length,1,engine.flowDiagnosticText());
  const scene=asrsSceneModel(rack,engine.state,()=> '#00ffff');assert.equal(scene.zones[0].stations.find(s=>s.kind==='out').tokens.length,2);
  blocked=false;for(let i=0;i<5000&&engine.state.completedProducts.length<3;i++)engine.step(.02);
  assert.equal(engine.state.completedProducts.length,3,engine.flowDiagnosticText());
});
