import test from 'node:test';
import assert from 'node:assert/strict';
import {CadFlowEngine,asrsTargetCell} from '../src/engine.js';
import {stationId} from '../src/asrs-stations.js';
test('outfeed station retains a straddled load when downstream permission is withdrawn',()=>{
 const l=layout();l.equipment[2].type='conveyor';l.equipment[2].parameters={length:5,speed:1,continuousHandover:1};
 const e=new CadFlowEngine(l),station=e.nodes.get(stationId('rack',0,'out')),edge=e.outgoing.get(station.id)[0];
 const t=e.prepareToken({id:20,nodeId:station.id,flowKey:'A'});t.predictiveRouteEdge=edge;t.handoverCommitted=true;t.handoffReserved=true;
 const position=station.parameters.length+.2;t.motion=e.createMotion(station,position,{velocity:.5},t);t.motionState=t.motion.controller.snapshot();e.state.cadTokens.push(t);
 e.canAcceptNode=()=>false;e.advanceMotion(t,station,.1);
 assert.equal(t.handoverStraddled,true);assert.equal(t.motionState.position,position);assert.equal(t.motionState.velocity,0);assert.equal(e.stationDepositSafe(station,{id:21}),false);
});
function layout(){return {displayMode:'cad',cargoSpec:{length:1200,width:800,weight:100,unit:'mm'},equipment:[{id:'source',type:'source',x:-300,y:0,parameters:{injectionInterval:2,cargoType:'A'}},{id:'rack',type:'asrs',name:'Rack',x:0,y:0,parameters:{stationConveyorsEnabled:1,retrievalCarryCount:2,infeedBufferCount:2,outfeedBufferCount:2,productTypes:2,zoneNames:['A','B'],rows:1,levels:1,columns:4,travelSpeed:3,liftSpeed:2,forkStroke:.1,forkSpeed:2,putawayTime:.1,retrievalTime:.1,infeedTime:.1,outfeedTime:.1,modeChangeTime:0}},{id:'sink',type:'sink',x:300,y:0,parameters:{processTime:.1}}],cadSchematic:{inboundBranches:[{name:'A',cargoType:'A',nodeIds:['source']}],edges:[{from:'source',to:'rack',toPort:'product-1-in'},{from:'rack',to:'sink',fromPort:'product-1-out'}]}};}

function addBuffered(engine,id){const station=engine.nodes.get(stationId('rack',0,'in'));const token=engine.prepareToken({id,nodeId:station.id,flowKey:'A',cargoType:'A',readyAt:0,createdAt:0});engine.state.cadTokens.push(token);return token;}
function addStored(engine,id,slot){const rack=engine.nodes.get('rack'),zone=engine.state.asrs.zones.A;zone.occupiedSlots[slot]=true;zone.inventory++;engine.state.asrs.inventory++;const token=engine.prepareToken({id,nodeId:'rack',flowKey:'A',cargoType:'A',storageFlowKey:'A',asrsPhase:'stored',asrsTarget:asrsTargetCell(rack,slot),readyAt:Infinity,createdAt:0});engine.state.cadTokens.push(token);return token;}

test('station checks straddled cargo and other inbound reservations before crane deposit',()=>{
 const e=new CadFlowEngine(layout()),station=e.nodes.get(stationId('rack',0,'out'));
 const t=e.prepareToken({id:1,nodeId:station.id,flowKey:'A'});e.state.cadTokens.push(t);
 assert.equal(e.stationDepositSafe(station,{id:2}),true);
 t.handoverStraddled=true;assert.equal(e.stationDepositSafe(station,{id:2}),false);
 t.handoverStraddled=false;t.motionState={position:station.parameters.length+.2};
 assert.equal(e.stationDepositSafe(station,{id:2}),false);
 t.motionState.position=station.parameters.length;
 e.transferReservations.set('test',{tokenId:99,edge:{to:station.id}});
 assert.equal(e.stationDepositSafe(station,{id:2}),false);
 e.transferReservations.clear();assert.equal(e.stationDepositSafe(station,{id:2}),true);
});
test('station freezes existing cargo while a crane deposit is in progress',()=>{
 const e=new CadFlowEngine(layout()),station=e.nodes.get(stationId('rack',0,'out'));
 const t=e.prepareToken({id:1,nodeId:station.id,flowKey:'A'});
 t.motion=e.createMotion(station,1,{velocity:.5},t);t.motionState=t.motion.controller.snapshot();
 e.state.cadTokens.push(t,{id:2,nodeId:'rack',stationOutfeedVisual:{stationId:station.id},handoffAcceptedAt:0});
 e.advanceMotion(t,station,.1);assert.equal(t.motionState.position,1);assert.equal(t.motionState.velocity,0);
});
test('batch output feeds a single-load machine individually without losing remaining cargo',()=>{
 const l=layout();l.equipment[2].type='turntable';l.equipment[2].parameters={processTime:5,rotationTime:5};
 const e=new CadFlowEngine(l,{simDuration:120});e.sources=[];addStored(e,1,0);addStored(e,2,1);
 let observed=false;
 for(let i=0;i<4000;i++){e.step(.02);assert.ok(e.nodeOccupancy('sink')<=1);
  if(e.nodeOccupancy('sink')===1){assert.equal(e.nodeOccupancy(stationId('rack',0,'out')),1);observed=true;break;}}
 assert.ok(observed,e.flowDiagnosticText());
});
