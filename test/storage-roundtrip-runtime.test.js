import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compactAsrsStations,syncAsrsStations} from '../src/asrs-stations.js';
import {CadFlowEngine} from '../src/engine.js';
import {compareEngineeringDuration} from '../src/engineering-compatibility.js';

const fixtureUrl=new URL('./fixtures/generic-two-warehouses.json',import.meta.url);
const loadFixture=async()=>JSON.parse(await readFile(fixtureUrl,'utf8'));
const run=layout=>{const engine=new CadFlowEngine(layout,{simDuration:180});for(let i=0;i<9000;i++)engine.step(.02);return engine;};
const outcome=engine=>({moved:engine.state.movedItems,completed:engine.state.completedProducts.length,putaways:engine.state.asrs.putaways,retrievals:engine.state.asrs.retrievals,inventory:engine.state.asrs.inventory,warehouseInventory:Object.fromEntries(Object.entries(engine.state.warehouses).map(([id,state])=>[id,state.inventory]))});

test('compact JSON round-trip regenerates ASRS projections without changing simulation outcome',async()=>{
 const live=await loadFixture();syncAsrsStations(live);
 const stored=compactAsrsStations(live),json=JSON.stringify(stored),restored=JSON.parse(json);
 assert.equal(stored.equipment.some(item=>item.asrsStation),false);
 assert.equal(stored.cadSchematic.edges.some(edge=>edge.asrsStationInternal),false);
 assert.ok(stored.equipment.filter(item=>['asrs','stackerCrane'].includes(item.type)).every(item=>item.parameters.stationInterfaces.length===item.parameters.productTypes*2));
 syncAsrsStations(restored);
 assert.equal(restored.equipment.filter(item=>item.asrsStation).length,8);
 assert.equal(restored.cadSchematic.edges.filter(edge=>edge.asrsStationInternal).length,8);
 assert.deepEqual(outcome(run(restored)),outcome(run(structuredClone(live))));
});

test('every requested motion family reaches the runtime compatibility audit',()=>{
 const layout={cargoSpec:{length:1200,width:800,weight:100,unit:'mm'},equipment:[]},items=[
  {id:'cv',type:'conveyor',parameters:{length:5,speed:1,acceleration:.8,deceleration:.8}},
  {id:'fork',type:'forkingDevice',parameters:{strokeDistance:1.5,forkTime:4,acceleration:.8,deceleration:.8}},
  {id:'lift',type:'lift',parameters:{liftHeight:3,liftSpeed:.5,loadTime:2,unloadTime:2,acceleration:.5,deceleration:.5}},
  {id:'turn',type:'turntable',parameters:{rotationTime:6,rotationAngleDeg:90}},
  {id:'turn-cv',type:'turntable',equipmentRole:'turnConveyor',parameters:{length:2,speed:.5,rotationTime:6,rotationAngleDeg:90}},
  {id:'crane',type:'stackerCrane',parameters:{rows:2,columns:4,levels:3,columnPitch:1.5,levelHeight:1.5,travelSpeed:2,liftSpeed:1,forkStroke:.8,forkSpeed:.4}},
  {id:'amr',type:'amr',parameters:{shuttleDistance:5,travelSpeed:1.2,receiveSpeed:.6,transferSpeed:.6,acceleration:.8,deceleration:.8}},
  {id:'air',type:'station',equipmentRole:'pneumatic',parameters:{strokeDistance:.2,speed:.2,returnSpeed:.2,processTime:1}}
 ];
 const results=items.map(item=>compareEngineeringDuration(item,{...layout,equipment:[item]}));
 assert.ok(results.every(result=>['compatible','review'].includes(result.status)));
 assert.deepEqual(results.map(result=>result.motions.map(axis=>axis.model)),[
  ['linear'],['loaded-forward','empty-return'],['up-with-gravity'],['rotary'],['rotary'],['x-travel','z-up-with-gravity','fork-loaded','fork-empty'],['receive','drive','transfer'],['extend','retract']
 ]);
});
