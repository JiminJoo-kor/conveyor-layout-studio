import test from 'node:test';
import assert from 'node:assert/strict';
import {reassignStationConnections,stationPatternLabel} from '../src/station-assignment.js';
test('station selection displays cargo pattern names without changing slot indexes',()=>{const patterns=[{line:'트림 라인',key:'트림',label:'트림 물류'},{line:'화이날 라인',key:'화이날',label:'화이날 물류'}];assert.equal(stationPatternLabel(0,'트림 라인',patterns),'트림 물류');assert.equal(stationPatternLabel(1,undefined,patterns),'화이날 물류');assert.equal(stationPatternLabel(0,'다른 창고',patterns),'다른 창고');});
function setup(){return {equipment:[{id:'a',asrsStation:{kind:'in'}},{id:'b',asrsStation:{kind:'in'}},{id:'c',asrsStation:{kind:'out'}}],cadSchematic:{edges:[{from:'up',fromPort:'right',to:'a',toPort:'left'},{from:'a',to:'rack',asrsStationInternal:'rack'}]}};}
test('reassignment moves external connectivity without removing mandatory stations',()=>{const l=setup();reassignStationConnections(l,'a','b');assert.equal(l.cadSchematic.edges[0].to,'b');assert.equal(l.cadSchematic.edges[1].from,'a');assert.equal(l.equipment.length,3);});
test('changing station role reverses external transfer direction',()=>{const l=setup();reassignStationConnections(l,'a','c');assert.deepEqual(l.cadSchematic.edges[0],{from:'c',fromPort:'right',to:'up',toPort:'right'});});
test('occupied destination is rejected without partial mutation',()=>{const l=setup();l.cadSchematic.edges.push({from:'x',to:'b'});const before=JSON.stringify(l);assert.throws(()=>reassignStationConnections(l,'a','b'));assert.equal(JSON.stringify(l),before);});
