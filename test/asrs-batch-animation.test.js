import test from 'node:test';
import assert from 'node:assert/strict';
import {CadFlowEngine,asrsTargetCell,asrsOperationSnapshot} from '../src/engine.js';
import {stationId} from '../src/asrs-stations.js';
import {stationTransferPresentations} from '../src/asrs-putaway.js';
import {asrsLayoutCargoPresentation} from '../src/renderer.js';
import {asrsSceneModel,stationCargoGeometry} from '../src/asrs-monitor.js';
test('station deposit animation duration is independent of conveyor speed and acceleration',()=>{
 for(const count of [1,2]){
  const durations=[];
  for(const speed of [.1,10]){
   const l=layout();Object.assign(l.equipment[1].parameters,{stationConveyorSpeed:speed,stationAcceleration:speed/2,stationDeceleration:speed/3,outfeedTime:2});
   const e=new CadFlowEngine(l,{simDuration:200});e.sources=[];const loads=Array.from({length:count},(_,i)=>addStored(e,700+i,i));
   for(let i=0;i<5000&&!loads[0].stationOutfeedVisual;i++)e.step(.02);
   assert.ok(loads[0].stationOutfeedVisual);durations.push(loads[0].handoffDuration);
   const station=e.nodes.get(stationId('rack',0,'out'));assert.equal(station.parameters.speed,speed);assert.equal(station.parameters.acceleration,speed/2);assert.equal(station.parameters.deceleration,speed/3);
   while(loads[0].nodeId==='rack')e.step(.02);
   assert.ok(loads.every(t=>t.motionState.velocity===0));
  }
  assert.equal(durations[0],durations[1]);
 }
});
test('warehouse work cargo remains inside standardized per-line status panels',()=>{
 for(const count of [1,3,6])for(const rotation of [0,90,180,270]){
  const l=layout();Object.assign(l.equipment[1].parameters,{productTypes:count,zoneNames:Array.from({length:count},(_,i)=>'Line '+i)});l.equipment[1].rotation=rotation;
  const e=new CadFlowEngine(l),rack=e.nodes.get('rack'),w=rack.asrsVisualBounds.width,h=rack.asrsVisualBounds.height;
  assert.ok(w>=280);assert.ok(h>=count*84+40);
  for(const [index,zone] of Object.keys(e.state.asrs.zones).entries()){
   const t={id:900+index,nodeId:'rack',flowKey:zone,storageFlowKey:zone,asrsPhase:'putaway',asrsTarget:asrsTargetCell(rack,0),nodeEnteredAt:0,readyAt:100};
   const p=asrsLayoutCargoPresentation(rack,{...e.state,t:1},t),a=-rotation*Math.PI/180,dx=p.x-rack.x,dy=p.y-rack.y,x=dx*Math.cos(a)-dy*Math.sin(a),y=dx*Math.sin(a)+dy*Math.cos(a);
   assert.ok(Math.abs(x)+p.displaySize/2<w/2);assert.ok(Math.abs(y)+p.displaySize/2<h/2);assert.ok(p.displaySize<=22);assert.equal(p.index,index);
  }
 }
});
test('LIVE station cargo uses physical edge spacing for every conveyor rotation',()=>{
 for(const rotation of [0,90,180,270]){
  const station={length:5,rotation,cargo:{length:1.2,width:.8}},a={cargoOrientation:0},b={cargoOrientation:Math.PI/2};
  const first=stationCargoGeometry(station,a,5,100),extent=first.width/20,second=stationCargoGeometry(station,b,5-extent-.2,100);
  assert.ok(Math.abs((first.center-first.width/2)-(second.center+second.width/2)-4)<1e-8);
 }
});
test('infeed waits for real accumulation instead of collecting widely spaced cargo',()=>{
 const e=new CadFlowEngine(layout(),{simDuration:200});e.sources=[];const a=addBuffered(e,801),b=addBuffered(e,802),station=e.nodes.get(a.nodeId);
 const target=b.motion.controller.position;b.motion.controller.position=target-.6;b.motionState=b.motion.controller.snapshot();
 a.edge=e.outgoing.get(station.id)[0];e.tryDirectHandover(a);assert.equal(a.putawayMission,undefined);
 assert.ok(b.motion.controller.position<target);
 for(let i=0;i<2000&&!a.putawayMission;i++)e.step(.02);
 assert.ok(a.putawayMission);const positions=a.putawayMission.entries.map(x=>x.stationPosition);
 assert.ok(Math.abs(positions[0]-positions[1]-e.minimumFollowingSpacing(station,a))<1e-5);
});
function layout(){return {displayMode:'cad',cargoSpec:{length:1200,width:800,weight:100,unit:'mm'},equipment:[{id:'source',type:'source',x:-300,y:0,parameters:{injectionInterval:2,cargoType:'A'}},{id:'rack',type:'asrs',name:'Rack',x:0,y:0,parameters:{stationConveyorsEnabled:1,retrievalCarryCount:2,infeedBufferCount:2,outfeedBufferCount:2,productTypes:2,zoneNames:['A','B'],rows:1,levels:1,columns:4,travelSpeed:3,liftSpeed:2,forkStroke:.1,forkSpeed:2,putawayTime:.1,retrievalTime:.1,infeedTime:.1,outfeedTime:.1,modeChangeTime:0}},{id:'sink',type:'sink',x:300,y:0,parameters:{processTime:.1}}],cadSchematic:{inboundBranches:[{name:'A',cargoType:'A',nodeIds:['source']}],edges:[{from:'source',to:'rack',toPort:'product-1-in'},{from:'rack',to:'sink',fromPort:'product-1-out'}]}};}

function addBuffered(engine,id){const station=engine.nodes.get(stationId('rack',0,'in'));const token=engine.prepareToken({id,nodeId:station.id,flowKey:'A',cargoType:'A',readyAt:0,createdAt:0});const position=station.parameters.length-engine.state.cadTokens.filter(t=>t.nodeId===station.id).length*engine.minimumFollowingSpacing(station,token);token.motion=engine.createMotion(station,position,{velocity:0},token);token.motionState=token.motion.controller.snapshot();token.progress=position/token.motion.distance;engine.state.cadTokens.push(token);return token;}
function addStored(engine,id,slot){const rack=engine.nodes.get('rack'),zone=engine.state.asrs.zones.A;zone.occupiedSlots[slot]=true;zone.inventory++;engine.state.asrs.inventory++;const token=engine.prepareToken({id,nodeId:'rack',flowKey:'A',cargoType:'A',storageFlowKey:'A',asrsPhase:'stored',asrsTarget:asrsTargetCell(rack,slot),readyAt:Infinity,createdAt:0});engine.state.cadTokens.push(token);return token;}

test('pickup shrinks a batch in place, then deposits into distinct cells sequentially',()=>{
 const e=new CadFlowEngine(layout(),{simDuration:200});e.sources=[];
 const a=addBuffered(e,101),b=addBuffered(e,102),rack=e.nodes.get('rack'),station=e.nodes.get(a.nodeId);
 for(let i=0;i<2000&&!a.putawayMission;i++)e.step(.02);
 const m=a.putawayMission;assert.ok(m);assert.equal(m,b.putawayMission);
 assert.equal(new Set(m.entries.map(x=>x.target.index)).size,2);assert.equal(e.state.asrs.inventory,0);
 for(const ratio of [0,.25,.5,.75,.99]){
  const state={...e.state,t:m.pickupStartedAt+m.pickupDuration*ratio},frames=stationTransferPresentations(station,state);
  assert.equal(frames.length,2);assert.equal(frames[0].scale,frames[1].scale);
  assert.ok(Math.abs(frames[0].scale-(1-ratio*ratio*(3-2*ratio)))<1e-8);
  assert.deepEqual(frames.map(f=>f.position),m.entries.map(x=>x.stationPosition));
  const op=asrsOperationSnapshot(rack,a,state.t);assert.equal(op.x,m.home.column);assert.equal(op.y,m.home.level);assert.equal(op.phase,'infeed');
  assert.equal(asrsLayoutCargoPresentation(rack,state,a).visible,false);
  const scene=asrsSceneModel(rack,state,()=> '#00ffff');assert.equal(scene.zones[0].stations.find(s=>s.kind==='in').tokens[0].scale,frames[0].scale);
 }
 while(m.stage==='pickup'){e.step(.02);assert.equal(a.nodeId,b.nodeId);}
 assert.equal(a.nodeId,'rack');assert.equal(a.nodeEnteredAt,b.nodeEnteredAt);
 for(let i=0;i<4000&&m.storedIds.length<2;i++)e.step(.02);
 assert.equal(m.storedIds.length,2);assert.equal(e.state.asrs.inventory,2);
 assert.equal(e.state.asrs.zones.A.occupiedSlots.filter(Boolean).length,2);assert.equal(e.state.cadTokens.length,2);
 const events=e.state.events.filter(x=>x.type==='asrs-stored');assert.equal(events.length,2);assert.notEqual(events[0].target.index,events[1].target.index);assert.notEqual(events[0].t,events[1].t);
});
test('one or two outbound loads grow in place before atomic station handover',()=>{
 for(const count of [1,2]){
  const e=new CadFlowEngine(layout(),{simDuration:200});e.sources=[];
  const loads=Array.from({length:count},(_,i)=>addStored(e,201+i,i)),station=e.nodes.get(stationId('rack',0,'out')),rack=e.nodes.get('rack');
  for(let i=0;i<3000&&!loads[0].stationOutfeedVisual;i++)e.step(.02);
  assert.ok(loads[0].stationOutfeedVisual);const t=loads[0].handoffAcceptedAt,d=loads[0].handoffDuration;
  for(const ratio of [0,.25,.5,.75,.99]){
   const state={...e.state,t:t+d*ratio},frames=stationTransferPresentations(station,state);
   assert.equal(frames.length,count);assert.ok(frames.every(f=>Math.abs(f.scale-ratio*ratio*(3-2*ratio))<1e-8));
   assert.ok(loads.every(t=>t.nodeId==='rack'));assert.equal(e.nodeOccupancy(station.id),0);
   assert.equal(asrsLayoutCargoPresentation(rack,state,loads[0]).visible,false);
   const scene=asrsSceneModel(rack,state,()=> '#00ffff');assert.deepEqual(scene.zones[0].stations.find(s=>s.kind==='out').tokens.map(f=>f.scale),frames.map(f=>f.scale));
  }
  const positions=loads.map(t=>t.stationOutfeedVisual.position);
  while(loads[0].nodeId==='rack')e.step(.02);
  assert.ok(loads.every(t=>t.nodeId===station.id));assert.deepEqual(loads.map(t=>t.motionState.position),positions);
  assert.equal(stationTransferPresentations(station,e.state).length,0);
 }
});
test('fork motion sets pickup duration and failures freeze simultaneous shrink',()=>{
 const l=layout();l.equipment[1].parameters.forkStroke=2;l.equipment[1].parameters.forkSpeed=.1;
 const e=new CadFlowEngine(l,{simDuration:200});e.sources=[];const a=addBuffered(e,301);addBuffered(e,302);
 for(let i=0;i<2000&&!a.putawayMission;i++)e.step(.02);
 const m=a.putawayMission;assert.ok(m.pickupDuration>20);const station=e.nodes.get(m.stationId);
 e.state.t+=m.pickupDuration*.25;const before=stationTransferPresentations(station,e.state).map(f=>f.scale);
 e.state.equipmentReliability.rack={available:false};e.state.t+=.5;e.updatePutawayMissions(.5);
 assert.deepEqual(stationTransferPresentations(station,e.state).map(f=>f.scale),before);assert.equal(m.stage,'pickup');assert.equal(e.canAcceptNode(station),false);
});
