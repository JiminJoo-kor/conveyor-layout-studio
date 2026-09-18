import test from 'node:test';
import assert from 'node:assert/strict';
import {reassignStationConnections,stationPatternLabel,stationLineLabel} from '../src/station-assignment.js';

test('station label traces its own inlet to the named inbound vehicle over generic zone names',()=>{
 const parent={id:'rack',parameters:{zoneNames:['라인 1']}},layout={equipment:[parent,{id:'in',asrsStation:{parentId:'rack',index:0,kind:'in'}},{id:'cv',type:'conveyor'},{id:'truck',type:'dock',name:'차량',parameters:{dockRole:'inbound',lineName:'화이날 입고'}}],cadSchematic:{edges:[{from:'truck',to:'cv'},{from:'cv',to:'in'}]}};
 assert.equal(stationLineLabel(layout,parent,0,'라인 1',[]),'화이날 입고');
 layout.equipment[3].parameters.lineName='변경 입고';
 assert.equal(stationLineLabel(layout,parent,0,'라인 1',[]),'변경 입고');
 assert.equal(stationLineLabel(layout,{id:'other',parameters:{zoneNames:['별도 창고']}},0,'라인 1',[]),'별도 창고');
});
test('station selection displays cargo pattern names without changing slot indexes',()=>{const patterns=[{line:'트림 라인',key:'트림',label:'트림 물류'},{line:'화이날 라인',key:'화이날',label:'화이날 물류'}];assert.equal(stationPatternLabel(0,'트림 라인',patterns),'트림 물류');assert.equal(stationPatternLabel(1,undefined,patterns),'화이날 물류');assert.equal(stationPatternLabel(0,'다른 창고',patterns),'다른 창고');});
function setup(){return {equipment:[{id:'a',asrsStation:{kind:'in'}},{id:'b',asrsStation:{kind:'in'}},{id:'c',asrsStation:{kind:'out'}}],cadSchematic:{edges:[{from:'up',fromPort:'right',to:'a',toPort:'left'},{from:'a',to:'rack',asrsStationInternal:'rack'}]}};}

test('zone identity stays singular even when a fork connects multiple inbound vehicles',()=>{
 const parent={id:'rack',parameters:{}},layout={equipment:[parent],cadSchematic:{edges:[],inboundBranches:[{name:'트림 라인'},{name:'화이날 라인'}]}};
 assert.equal(stationLineLabel(layout,parent,0,'라인 1'),'트림 라인');
 assert.equal(stationLineLabel(layout,parent,1,'라인 2'),'화이날 라인');
});

test('explicit occupied exchange preserves both external links and internal links',()=>{
 const l=setup();l.cadSchematic.edges.push({from:'second',fromPort:'right',to:'b',toPort:'left'});
 reassignStationConnections(l,'a','b',{swapOccupied:true});
 assert.equal(l.cadSchematic.edges[0].to,'b');assert.equal(l.cadSchematic.edges[2].to,'a');
 assert.equal(l.cadSchematic.edges[1].from,'a');assert.equal(l.cadSchematic.edges.length,3);
});
test('reassignment moves external connectivity without removing mandatory stations',()=>{const l=setup();reassignStationConnections(l,'a','b');assert.equal(l.cadSchematic.edges[0].to,'b');assert.equal(l.cadSchematic.edges[1].from,'a');assert.equal(l.equipment.length,3);});
test('changing station role reverses external transfer direction',()=>{const l=setup();reassignStationConnections(l,'a','c');assert.deepEqual(l.cadSchematic.edges[0],{from:'c',fromPort:'right',to:'up',toPort:'right'});});
test('occupied destination is rejected without partial mutation',()=>{const l=setup();l.cadSchematic.edges.push({from:'x',to:'b'});const before=JSON.stringify(l);assert.throws(()=>reassignStationConnections(l,'a','b'));assert.equal(JSON.stringify(l),before);});
