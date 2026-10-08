import test from 'node:test';
import assert from 'node:assert/strict';
import {cargoMarkers,detailCamera,equipmentMarkers} from '../src/cargo-visibility.js';
import {equipmentCargoMetrics,conveyorCargoVisualPose,LayoutRenderer} from '../src/renderer.js';

test('visibility markers follow CSS pixel size and never modify physical geometry',()=>{
 const records=[{id:1,x:20,y:30,w:.2,h:.1,color:'#fff'}],before=JSON.stringify(records);
 const groups=cargoMarkers(records,{zoom:2,x:10,y:5},.5);
 assert.equal(groups[0].x,25);assert.equal(groups[0].y,32.5);
 assert.equal(JSON.stringify(records),before);
 assert.equal(cargoMarkers(records,{zoom:200,x:0,y:0}).length,0);
});
test('dense markers count unique cargo, not two handover ends',()=>{
 const r=id=>({id,x:5,y:5,w:1,h:1});
 assert.deepEqual(cargoMarkers([r(1),r(1),r(2)],{zoom:1,x:0,y:0})[0].ids,[1,2]);
});
test('nearby markers merge across bucket boundaries',()=>{
 const markers=cargoMarkers([{id:1,x:19.9,y:20,w:1,h:1},{id:2,x:20.1,y:20,w:1,h:1}],{zoom:1,x:0,y:0});
 assert.equal(markers.length,1);assert.equal(markers[0].ids.length,2);
});
test('축소 화면은 선택·운전·이상 설비만 고정 크기 표식으로 보강한다',()=>{
 const records=[{id:'ready',x:10,y:10,status:'ready',color:'#0cf',label:'CV'},{id:'active',x:100,y:10,status:'active',color:'#0f8',label:'CV'},{id:'fault',x:200,y:10,status:'fault',color:'#f4d',label:'LIFT'},{id:'selected',x:300,y:10,status:'ready',color:'#0cf',label:'AGV',selected:true}];
 assert.deepEqual(equipmentMarkers(records,{zoom:.4,x:0,y:0}).map(group=>group.ids[0]),['active','fault','selected']);
 assert.deepEqual(equipmentMarkers(records,{zoom:1,x:0,y:0}).map(group=>group.ids[0]),['selected']);
});
test('인접한 설비 표식은 묶음 수량을 표시하고 더 위험한 상태 색을 유지한다',()=>{
 const groups=equipmentMarkers([{id:'a',x:10,y:10,status:'active',color:'#0f8',label:'CV'},{id:'b',x:11,y:10,status:'blocked',color:'#f73',label:'FORK'}],{zoom:.4,x:0,y:0});
 assert.deepEqual(groups[0].ids,['a','b']);assert.equal(groups[0].status,'blocked');assert.equal(groups[0].color,'#f73');
});
test('long rotated conveyor detail enlarges cargo and gap by the same factor',()=>{
 const item={type:'conveyor',x:100,y:100,rotation:90,parameters:{length:5500}},cargo={length:1.2,width:.8},layout={equipment:[item]},metrics=equipmentCargoMetrics(layout,cargo,item);
 const a=conveyorCargoVisualPose(item,cargo,2,78,metrics,5500,Math.PI/2),b=conveyorCargoVisualPose(item,cargo,3.4,78,metrics,5500,Math.PI/2);
 const camera=detailCamera(a,{w:metrics.visualLength,h:metrics.visualWidth},800,260);
 assert.ok(Math.abs(metrics.visualWidth*camera.zoom-48)<1e-8);
 assert.ok(Math.abs(a.x*camera.zoom+camera.x-400)<1e-8);
 assert.ok(Math.abs(a.y*camera.zoom+camera.y-130)<1e-8);
 assert.ok(Math.abs((Math.hypot(b.x-a.x,b.y-a.y)-metrics.visualLength)*camera.zoom-12)<1e-7);
});
test('presentation records do not retain token payloads',()=>{
 const r=Object.create(LayoutRenderer.prototype);r.layout={};const token={id:1,nodeId:'c',stackLayers:[{huge:'payload'}]};
 r.recordCargo(token,{x:0,y:0},1,2);assert.equal(r.cargoPresentations[0].stackLayers,undefined);
 assert.equal(r.cargoPresentations[0].id,1);
});
