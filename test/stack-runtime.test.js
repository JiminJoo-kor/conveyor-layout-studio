import test from 'node:test';
import assert from 'node:assert/strict';
import {CadFlowEngine} from '../src/engine.js';

function setup(role,target=2){
 const layout={cargoSpec:{length:1,width:.8,weight:2,unit:'m'},equipment:[
  {id:'source',type:'source',x:0,y:0,parameters:{processTime:.1,cargoType:'empty',initialStackCount:role==='boxDestacker'?target:1}},
  {id:'machine',type:'conveyor',equipmentRole:role,x:10,y:0,parameters:{length:3,speed:2,continuousHandover:1,loadCapacity:100,stackTarget:target,stackLiftTime:.1,stackLowerTime:.1}},
  {id:'sink',type:'sink',x:20,y:0,parameters:{processTime:.1}}
 ],cadSchematic:{edges:[{from:'source',to:'machine'},{from:'machine',to:'sink'}]}};
 return new CadFlowEngine(layout,{simDuration:120});
}
test('real conveyor engine stacks two boxes and releases one identity-preserving bundle',()=>{
 const e=setup('boxStacker');for(let i=0;i<3000&&!e.state.completedProducts.length;i++)e.step(.02);
 assert.ok(e.state.completedProducts.length,e.flowDiagnosticText());
 assert.ok(e.state.events.some(x=>x.type==='stack-release-complete'));
 assert.equal(e.state.stackMachines.machine.completedBoxes,2);
 assert.equal(e.state.completedProducts[0].stackLayers.length,2);
 assert.equal(new Set(e.state.completedProducts[0].stackLayers.map(l=>l.id)).size,2);
});
test('real conveyor engine separates a three-box bundle without lost identities',()=>{
 const e=setup('boxDestacker',3);for(let i=0;i<4000&&e.state.completedProducts.length<3;i++)e.step(.02);
 assert.equal(e.state.completedProducts.length,3,e.flowDiagnosticText());
 assert.equal(e.state.stackMachines.machine.completedBoxes,3);
 assert.equal(new Set(e.state.completedProducts.flatMap(t=>t.stackLayers.map(l=>l.id))).size,3);
});
test('blocked downstream keeps stopper raised and all boxes until approval',()=>{
 const e=setup('boxStacker'),accept=e.canAcceptNode;e.canAcceptNode=function(item,...args){if(item?.id==='sink')return false;return accept.call(this,item,...args);};e.step(60);
 const m=e.state.stackMachines.machine;assert.equal(m.phase,'ready',e.flowDiagnosticText());assert.equal(m.stopperUp,true);assert.equal(m.deck.length,2);assert.equal(e.state.completedProducts.length,0);
 e.canAcceptNode=accept;e.step(5);assert.ok(e.state.completedProducts.length);assert.equal(e.state.completedProducts[0].boxCount,2);
});
test('destacker to stacker conserves all box IDs through common conveyor handshakes',()=>{
 const e=setup('boxDestacker',3),layout=structuredClone(e.layout);
 layout.equipment.push({id:'stacker',type:'conveyor',equipmentRole:'boxStacker',x:15,y:0,parameters:{length:3,speed:2,loadCapacity:100,stackTarget:3,stackLiftTime:.1,stackLowerTime:.1}});
 layout.cadSchematic.edges=[{from:'source',to:'machine'},{from:'machine',to:'stacker'},{from:'stacker',to:'sink'}];
 const run=()=>{const engine=new CadFlowEngine(structuredClone(layout),{simDuration:120});return engine;};
 const a=run(),b=run();for(let i=0;i<3000;i++)a.step(.02);for(let i=0;i<60;i++)b.step(1);
 assert.ok(a.state.completedProducts.length,a.flowDiagnosticText());
 assert.deepEqual(a.state.completedProducts,b.state.completedProducts);
 const ids=a.state.completedProducts.flatMap(t=>t.stackLayers.map(l=>l.id));assert.equal(new Set(ids).size,ids.length);assert.ok(a.state.completedProducts.every(t=>t.stackLayers.length===3));
 assert.equal(a.getKpis().completedBoxes,ids.length);
});
test('reliability stop freezes the lifting phase and resumes without losing held boxes',()=>{
 const e=setup('boxStacker');for(let i=0;i<1000&&e.state.stackMachines?.machine?.phase!=='lifting';i++)e.step(.02);
 const m=e.state.stackMachines.machine;assert.equal(m.phase,'lifting');const before=m.elapsed;
 e.state.equipmentReliability.machine={available:false};e.updateActiveMotions(.05);assert.equal(m.elapsed,before);
 e.state.equipmentReliability.machine={available:true};e.updateActiveMotions(.2);assert.equal(m.phase,'holding');assert.equal(m.held.length,1);
});
test('infeed cargo does not reserve an outlet before the stack operation finishes',()=>{
 const e=setup('boxStacker');for(let i=0;i<300;i++){e.step(.02);for(const grant of e.transferReservations.values())if(grant.fromId==='machine'){const token=e.state.cadTokens.find(t=>t.id===grant.tokenId);assert.equal(token?.stackOutputFor,'machine');}}
});
