import test from 'node:test';
import assert from 'node:assert/strict';
import {reassignStationConnections} from '../src/station-assignment.js';
function setup(){return {equipment:[{id:'a',asrsStation:{kind:'in'}},{id:'b',asrsStation:{kind:'in'}},{id:'c',asrsStation:{kind:'out'}}],cadSchematic:{edges:[{from:'up',fromPort:'right',to:'a',toPort:'left'},{from:'a',to:'rack',asrsStationInternal:'rack'}]}};}
test('reassignment moves external connectivity without removing mandatory stations',()=>{const l=setup();reassignStationConnections(l,'a','b');assert.equal(l.cadSchematic.edges[0].to,'b');assert.equal(l.cadSchematic.edges[1].from,'a');assert.equal(l.equipment.length,3);});
test('changing station role reverses external transfer direction',()=>{const l=setup();reassignStationConnections(l,'a','c');assert.deepEqual(l.cadSchematic.edges[0],{from:'c',fromPort:'right',to:'up',toPort:'right'});});
test('occupied destination is rejected without partial mutation',()=>{const l=setup();l.cadSchematic.edges.push({from:'x',to:'b'});const before=JSON.stringify(l);assert.throws(()=>reassignStationConnections(l,'a','b'));assert.equal(JSON.stringify(l),before);});
