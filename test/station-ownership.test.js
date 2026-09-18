import test from 'node:test';
import assert from 'node:assert/strict';
import {syncAsrsStations} from '../src/asrs-stations.js';
import {reassignStationOwnership} from '../src/station-assignment.js';
import {CadFlowEngine} from '../src/engine.js';

for(const kind of ['in','out'])test(`station ${kind} ownership changes while its identity, placement and external link survive reset and JSON reload`,()=>{
 let l={equipment:[{id:'rack',type:'asrs',x:100,y:200,parameters:{productTypes:2,zoneNames:['트림','화이날']}},{id:'external',type:kind==='in'?'source':'sink',parameters:{}}],cadSchematic:{edges:[kind==='in'?{from:'external',to:'rack',toPort:'product-1-in'}:{from:'rack',fromPort:'product-1-out',to:'external'}]}};
 syncAsrsStations(l);const id=`rack::station-1-${kind}`,target=`rack::station-2-${kind}`,before=l.equipment.find(n=>n.id===id),pose=[before.x,before.y,before.rotation];
 reassignStationOwnership(l,id,target);
 for(let i=0;i<3;i++){
  l=JSON.parse(JSON.stringify(l));syncAsrsStations(l);
  const n=l.equipment.find(n=>n.id===id);assert.equal(n.asrsStation.index,1);assert.match(n.name,/화이날/);assert.deepEqual([n.x,n.y,n.rotation],pose);
  assert.ok(l.cadSchematic.edges.some(e=>!e.asrsStationInternal&&(e.from===id||e.to===id)&&(e.from==='external'||e.to==='external')));
  const engine=new CadFlowEngine(l),token=engine.prepareToken({id:99,nodeId:id,cargoType:'트림'});assert.equal(engine.asrsStackerKey(token,'rack'),'화이날');
 }
});
