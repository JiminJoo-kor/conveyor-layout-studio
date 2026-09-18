import test from 'node:test';
import assert from 'node:assert/strict';
import {mobileEquipmentRoute,equipmentVisualPosition,mobileHandoverNode,equipmentClipBounds} from '../src/renderer.js';
test('large carried cargo and wheels are included in mobile standby clearance',()=>{
 const rack={id:'r',type:'asrs',x:0,y:0},v={id:'v',type:'amr',x:0,y:0,shuttleRoute:{start:{x:0,y:0},end:{x:400,y:0}}};
 const layout={cargoSpec:{length:8,width:3,unit:'m'},equipment:[rack,v]},route=mobileEquipmentRoute(layout,v);
 assert.ok(route.start.x>89+Math.hypot(70.2,18)/2+4);
});
test('zero-time start clears ASRS output stations arranged like parallel outbound lines',()=>{
 const rack={id:'r',type:'asrs',x:300,y:100,asrsVisualBounds:{width:178,height:240}},equipment=[rack],edges=[];
 for(let i=0;i<2;i++){const y=60+i*64,cv={id:'cv'+i,type:'conveyor',x:150,y,rotation:180,asrsStation:{visualLength:78}},v={id:'v'+i,type:i?'agv':'amr',x:110,y},sink={id:'end'+i,type:'dock',x:-150,y:300+i*100};equipment.push(cv,v,sink);edges.push({from:cv.id,to:v.id,fromPort:'right',toPort:'right',kind:'transfer'},{from:v.id,to:sink.id,fromPort:'left',toPort:'top',kind:'transfer'});}
 const layout={equipment,cadSchematic:{edges}};
 for(const v of equipment.filter(n=>['amr','agv'].includes(n.type))){const p=equipmentVisualPosition(layout,v,{t:0,simulationStarted:true,cadTokens:[]});for(const cv of equipment.filter(n=>n.type==='conveyor'))assert.ok(Math.abs(p.x-cv.x)>=39+18+4||Math.abs(p.y-cv.y)>=14+13+4);}
});

test('AMR and AGV standby and receive coordinates clear rotated equipment footprints',()=>{
 for(const type of ['amr','agv'])for(const rotation of [0,90,180,270]){
  const obstacle={id:'rack',type:'asrs',x:0,y:0,rotation,asrsVisualBounds:{width:200,height:160}},mobile={id:'m',type,x:0,y:0,rotation,shuttleRoute:{start:{x:0,y:0},end:{x:400,y:0}}},layout={equipment:[obstacle,mobile],cadSchematic:{edges:[]}};
  const route=mobileEquipmentRoute(layout,mobile),bounds=equipmentClipBounds(mobile),horizontal=rotation%180===0;
  assert.ok(route.start.x>=(horizontal?100+bounds.width/2:80+bounds.height/2)+4);
  assert.deepEqual(equipmentVisualPosition(layout,mobile,{t:.02,cadTokens:[]}),route.start);
  assert.deepEqual(equipmentVisualPosition(layout,mobile,{t:0,simulationStarted:true,cadTokens:[]}),route.start);
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
