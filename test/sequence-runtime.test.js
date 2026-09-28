import test from 'node:test';
import assert from 'node:assert/strict';
import {CadFlowEngine,asrsTargetCell} from '../src/engine.js';

function setup(){
 const rack={id:'rack',type:'asrs',equipmentRole:'sequenceRack',parameters:{rows:1,levels:1,columns:4,productTypes:2,outfeedBufferCount:2,travelSpeed:5,liftSpeed:5,forkStroke:.1,forkSpeed:5,retrievalTime:.1,outfeedTime:.1,modeChangeTime:0,loadCapacity:1000,sequenceStackers:{0:{interval:2,count:2,mode:'specified',cells:[2,0]},1:{interval:5,count:1,mode:'fifo'}}}};
 const layout={equipment:[rack,{id:'out',type:'sink',parameters:{processTime:.1}}],cargoSpec:{length:1,width:.8,weight:1,unit:'m'},cadSchematic:{edges:[{from:'rack',to:'out'}]}};
 const engine=new CadFlowEngine(layout,{simDuration:100});engine.sources=[];
 const warehouse=engine.state.asrs,names=Object.keys(warehouse.zones);
 names.forEach(name=>{const zone=warehouse.zones[name];for(const slot of [0,2]){const token=engine.prepareToken({id:engine.state.nextId++,nodeId:'rack',flowKey:name,storageFlowKey:name,cargoType:name,asrsPhase:'stored',asrsTarget:asrsTargetCell(rack,slot),createdAt:0,readyAt:Infinity});engine.state.cadTokens.push(token);zone.occupiedSlots[slot]=true;zone.inventory++;warehouse.inventory++;}engine.asrsLineState(name,warehouse).mode='outbound';});
 return {engine,warehouse,names};
}
test('sequence rack uses independent actual stacker deadlines and specified physical cells',()=>{
 const {engine:e,warehouse:w,names}=setup();e.step(1);
 assert.equal(Object.keys(w.pickMissions||{}).length,0);
 e.step(1.1);const first=w.pickMissions[names[0]];assert.ok(first);assert.deepEqual(first.entries.map(x=>x.target.index),[2,0]);assert.equal(w.pickMissions[names[1]],undefined);
 e.step(3);assert.ok(e.state.events.some(x=>x.type==='asrs-retrieval-start'&&x.stackerKey===names[1]));
 for(let i=0;i<2500&&e.state.completedProducts.length<4;i++)e.step(.02);
 assert.equal(e.state.completedProducts.length,4,e.flowDiagnosticText());
 assert.equal(w.sequenceSchedules[names[0]].active,null);
});
test('a period with more releases than physical carry capacity continues across trips',()=>{
 const {engine:e,warehouse:w,names}=setup();const rack=e.nodes.get('rack');rack.parameters.sequenceStackers[0]={interval:2,count:2,mode:'specified',cells:[2,0]};rack.parameters.stationLineCounts={0:{out:1}};
 e.step(2.1);assert.equal(w.pickMissions[names[0]].entries.length,1);assert.equal(w.sequenceSchedules[names[0]].active.productIds.length,2);
 for(let i=0;i<3000&&w.sequenceSchedules[names[0]].active;i++)e.step(.02);
 assert.equal(w.sequenceSchedules[names[0]].active,null);assert.equal(w.sequenceSchedules[names[0]].cursor,2);
});
test('ASRS multi-pick respects the total weight of every box in stacked loads',()=>{
 const {engine:e,warehouse:w,names}=setup();for(const token of e.state.cadTokens)token.stackLayers=[{id:`${token.id}:0`,weight:300},{id:`${token.id}:1`,weight:300}];
 e.step(2.1);assert.equal(w.pickMissions[names[0]].entries.length,1);
});
