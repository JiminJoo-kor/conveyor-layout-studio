import test from 'node:test';
import assert from 'node:assert/strict';
import {autoPlaceCad,cadExecutionBlockers} from '../src/cad-auto-layout.js';
import {applyQuestionCorrections} from '../src/cad-question-memory.js';
const cv=(id,x=1)=>({id,name:id,type:'conveyor',confidence:.98,rotation:0,x,y:0,parameters:{length:2,flowDirection:'right'},source:{origin:'dxf',measurement:{length:2,width:1,rotation:0,units:'m',review:false},cadPosition:{x,y:0}}});
test('certain measured candidates are placed once, unknown dimensions stay pending',()=>{
 const a=cv('a'),b=cv('b');b.source.measurement.review=true;const layout={equipment:[],cadSource:{}};
 assert.deepEqual(autoPlaceCad(layout,[a,b]).placed.map(e=>e.id),['a']);assert.equal(layout.cadPendingCandidates.length,1);
 autoPlaceCad(layout,[a,b]);assert.equal(layout.equipment.length,1);assert.ok(cadExecutionBlockers(layout).length);
});
test('touching conveyors connect only after explicit direction answers',()=>{
 const a=cv('a'),b=cv('b',3),layout={equipment:[],cadSource:{}};
 autoPlaceCad(layout,[a,b]);assert.equal(layout.cadSchematic.edges.length,0);
 applyQuestionCorrections({questions:[a,b].map(item=>({kind:'flow',item,correction:{flowDirection:'right'}}))},[a,b]);
 assert.equal(autoPlaceCad(layout,[]).connected,1);assert.equal(layout.cadSchematic.edges[0].from,'a');
 assert.equal(autoPlaceCad(layout,[]).connected,0);
});
test('ambiguous branch endpoints never auto connect',()=>{
 const items=[cv('a'),cv('b',3),cv('c',3)];for(const i of items)i.source.flowConfirmed=true;
 const layout={equipment:[]};autoPlaceCad(layout,items);assert.equal(layout.cadSchematic.edges.length,0);
});
test('opposite confirmed flow reverses edge, not equipment direction',()=>{
 const items=[cv('a'),cv('b',3)];for(const i of items){i.source.flowConfirmed=true;i.parameters.flowDirection='left';}
 const layout={equipment:[]};autoPlaceCad(layout,items);assert.equal(layout.cadSchematic.edges[0].from,'b');assert.equal(items[0].parameters.flowDirection,'left');
});
