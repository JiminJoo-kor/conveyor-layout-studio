import test from 'node:test';
import assert from 'node:assert/strict';
import {LayoutRenderer,equipmentCargoMetrics} from '../src/renderer.js';

test('station cargo keeps its physical scale during handover to a shorter conveyor',()=>{
 const source={id:'station',type:'conveyor',x:0,y:0,rotation:0,asrsStation:{visualLength:78},parameters:{length:5}},target={id:'next',type:'conveyor',x:150,y:0,rotation:0,parameters:{length:2}};
 const cargo={length:1.2,width:.8,unit:'m'},layout={equipment:[source,target],cargoSpec:cargo},rects=[],ctx={save(){},restore(){},translate(){},rotate(){},beginPath(){},rect(){},clip(){},fillRect(x,y,w,h){rects.push({w,h});},strokeRect(){}};
 const renderer=Object.create(LayoutRenderer.prototype);Object.assign(renderer,{layout,ctx});
 for(const raw of [.1,.5,.9]){
  rects.length=0;renderer.handoverDescriptor=()=>({source,target,edge:{from:'station',to:'next',fromPort:'right',toPort:'left'},raw});
  renderer.drawHandoverOverlay({cadTokens:[{id:1,nodeId:source.id,cargoOrientation:0,flowKey:'A'}]});
  assert.equal(rects.length,2);
  assert.equal(rects[0].w,equipmentCargoMetrics(layout,cargo,source).visualLength);
  assert.equal(rects[1].w,equipmentCargoMetrics(layout,cargo,target).visualLength);
 }
});
