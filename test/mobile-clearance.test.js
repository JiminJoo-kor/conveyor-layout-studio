import test from 'node:test';
import assert from 'node:assert/strict';
import {mobileEquipmentRoute,equipmentVisualPosition,mobileHandoverNode,equipmentClipBounds} from '../src/renderer.js';

test('AMR and AGV standby and receive coordinates clear rotated equipment footprints',()=>{
 for(const type of ['amr','agv'])for(const rotation of [0,90,180,270]){
  const obstacle={id:'rack',type:'asrs',x:0,y:0,rotation,asrsVisualBounds:{width:200,height:160}},mobile={id:'m',type,x:0,y:0,rotation,shuttleRoute:{start:{x:0,y:0},end:{x:400,y:0}}},layout={equipment:[obstacle,mobile],cadSchematic:{edges:[]}};
  const route=mobileEquipmentRoute(layout,mobile),bounds=equipmentClipBounds(mobile),horizontal=rotation%180===0;
  assert.ok(route.start.x>=(horizontal?100+bounds.width/2:80+bounds.height/2)+4);
  assert.deepEqual(equipmentVisualPosition(layout,mobile,{t:.02,cadTokens:[]}),route.start);
  const receive=mobileHandoverNode(layout,mobile,true);assert.deepEqual({x:receive.x,y:receive.y},route.start);
  assert.deepEqual(equipmentVisualPosition(layout,mobile,{t:10,cadTokens:[],mobileReturns:{m:{startedAt:1,completedAt:5,duration:4}}}),route.start);
  assert.deepEqual(equipmentVisualPosition(layout,mobile,{t:0,cadTokens:[]}),{x:0,y:0});
 }
});
test('a route fully inside equipment still receives an unobstructed standby point',()=>{
 const obstacle={id:'rack',type:'asrs',x:0,y:0},mobile={id:'m',type:'amr',x:0,y:0,shuttleRoute:{start:{x:0,y:0},end:{x:5,y:0}}},layout={equipment:[obstacle,mobile]},route=mobileEquipmentRoute(layout,mobile);
 assert.ok(Math.abs(route.start.x)>=111||Math.abs(route.start.y)>=83);
 assert.ok(Math.abs(route.end.x)>=111||Math.abs(route.end.y)>=83);
});
