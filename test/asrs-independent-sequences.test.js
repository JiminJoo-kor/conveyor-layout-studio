import test from 'node:test';
import assert from 'node:assert/strict';
import {CadFlowEngine,asrsTargetCell} from '../src/engine.js';

for(const blocked of ['putaway','retrieval'])for(const task of ['inbound','outbound'])test(`${blocked} on stacker A does not block ${task} on stacker B after fork routing`,()=>{
 const rack={id:'rack',type:'asrs',parameters:{productTypes:2,zoneNames:['A','B'],rows:1,columns:4,levels:1,infeedBufferCount:2,outfeedBufferCount:2,modeChangeTime:0,travelSpeed:3,forkStroke:.1,forkSpeed:2,infeedTime:.1,outfeedTime:.1,putawayTime:.1,retrievalTime:.1}};
 const e=new CadFlowEngine({equipment:[rack,{id:'outA',type:'sink'},{id:'outB',type:'sink'}],cargoSpec:{length:1,width:.5,weight:10,unit:'m'},cadSchematic:{edges:[{from:'rack',fromPort:'product-1-out',to:'outA'},{from:'rack',fromPort:'product-2-out',to:'outB'}]}},{simDuration:100});e.sources=[];
 const w=e.state.asrs,block=e.prepareToken({id:1,nodeId:'rack',flowKey:'A',storageFlowKey:'A',cargoType:'A',asrsPhase:blocked,readyAt:Infinity,asrsTarget:asrsTargetCell(rack,0)});e.state.cadTokens.push(block);
 w.stackers.A.mode=blocked==='putaway'?'inbound':'outbound';w.stackers.B.mode=task;
 const station=e.nodes.get('rack::station-2-in'),edge=e.outgoing.get(station.id)[0];
 for(let i=0;i<2;i++){
  const t=e.prepareToken({id:i+2,nodeId:task==='inbound'?station.id:'rack',flowKey:'B',storageFlowKey:'B',originFlowKey:'A',cargoType:'A',cargoOrientation:0,asrsPhase:task==='outbound'?'stored':null,asrsTarget:asrsTargetCell(rack,i),readyAt:Infinity});
  e.state.cadTokens.push(t);
  if(task==='inbound'){t.motion=e.createMotion(station,station.parameters.length-i*e.minimumFollowingSpacing(station,t),{},t);t.motionState=t.motion.controller.snapshot();t.edge=edge;}
  else{w.zones.B.occupiedSlots[i]=true;w.zones.B.inventory++;w.inventory++;}
 }
 const done=()=>task==='inbound'?w.zones.B.putaways>=2:e.state.completedProducts.filter(p=>p.id===2||p.id===3).length===2;
 for(let i=0;i<4000&&!done();i++)e.step(.02);
 assert.ok(done(),e.flowDiagnosticText());assert.equal(block.nodeId,'rack');assert.equal(block.asrsPhase,blocked);
 assert.equal(e.asrsLineBusy('A',null,w),true);
});
