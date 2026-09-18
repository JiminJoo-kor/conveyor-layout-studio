import test from 'node:test';
import assert from 'node:assert/strict';
import { CadFlowEngine, equipmentReceiveDuration, equipmentSequenceSnapshot, asrsOperationSnapshot, conveyorEntryPosition } from '../src/engine.js';
import { LayoutRenderer } from '../src/renderer.js';

for(const type of ['amr','agv','forkingDevice','lift','robot','conveyor'])test(`ASRS → ${type}: 인수와 출고 완료는 같은 시각이며 인수 재시작 없음`,()=>{
  const rack={id:'rack',type:'asrs',parameters:{productTypes:1,rows:1,levels:1,columns:1,outfeedTime:1}};
  const target={id:'target',type,parameters:{loadTime:2,receiveSpeed:.5,acceleration:.25,deceleration:.25,pickTime:2,holdTime:1,shuttleDistance:5}};
  const edge={from:'rack',to:'target'},layout={equipment:[rack,target],cargoSpec:{length:1200,width:800,unit:'mm'},cadSchematic:{edges:[edge]}},engine=new CadFlowEngine(layout),name=Object.keys(engine.state.asrs.zones)[0],zone=engine.state.asrs.zones[name];
  zone.inventory=1;zone.occupiedSlots[0]=true;engine.state.asrs.inventory=1;
  const token=engine.prepareToken({id:1,nodeId:'rack',edge,flowKey:name,storageFlowKey:name,stackerKey:name,asrsPhase:'retrieval',asrsTarget:{index:0},nodeEnteredAt:0,readyAt:0});
  engine.state.cadTokens=[token];engine.state.t=100;engine.canAcceptNode=()=>true;engine.predictedEntryAvailable=()=>true;
  assert.equal(engine.tryDirectHandover(token),false);
  const duration=Math.max(1,equipmentReceiveDuration(target,layout));assert.equal(token.handoffDuration,duration);
  engine.state.t=100+duration/2;
  assert.equal(engine.tryDirectHandover(token),false);
  assert.ok(Math.abs(asrsOperationSnapshot(rack,token,engine.state.t).outfeedProgress-.5)<1e-8);
  if(type==='amr'||type==='agv'){
    const boxes=[],renderer=Object.create(LayoutRenderer.prototype);
    renderer.layout=layout;renderer.flowFilter='all';
    renderer.ctx=new Proxy({fillRect(...args){boxes.push(args);}}, {get(target,key){return target[key]||(()=>{});}});
    renderer.drawCadFlow(engine.state);
    assert.equal(boxes.length,2,'Shared handover draws both source and receiving cargo before completion');
  }
  assert.equal(zone.inventory,1);
  engine.state.t=100+duration;
  assert.equal(engine.tryDirectHandover(token),true);assert.equal(token.nodeId,'target');assert.equal(zone.inventory,0);
  const op=equipmentSequenceSnapshot(target,token,engine.state.t+1e-8,layout);assert.notEqual(op.phase,'receive');assert.notEqual(op.phase,'pick');
  if(type==='conveyor')assert.equal(token.motionState.position,conveyorEntryPosition(target,layout,token));
  const complete=engine.state.events.find(e=>e.type==='asrs-handoff-complete'),receive=engine.state.events.find(e=>e.type==='sensor-infeed');assert.equal(complete.t,receive.t);
});
