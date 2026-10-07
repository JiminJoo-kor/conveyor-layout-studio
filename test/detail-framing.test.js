import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceCamera,forwardCamera,viewportRange} from '../src/detail-framing.js';
test('locked viewport preserves exact position and scale',()=>{
 const a={zoom:4,x:10,y:20};assert.equal(advanceCamera(a,{zoom:1,x:999,y:999},{locked:true}),a);
});
test('camera interpolates world center while zoom changes',()=>{
 const a={zoom:2,x:200,y:30},b={zoom:4,x:0,y:-70},c=advanceCamera(a,b,{smooth:true});
 assert.equal((400-c.x)/c.zoom,100);assert.equal((130-c.y)/c.zoom,50);assert.ok(c.zoom>2&&c.zoom<4);
});
test('forward framing leaves more space in travel direction',()=>{
 const a={zoom:1,x:0,y:0};assert.equal(forwardCamera(a,0).x,-100);assert.equal(forwardCamera(a,0,-1).x,100);assert.equal(forwardCamera(a,Math.PI/2).y,-45);
});
test('range follows rotation, reverse direction and clips to conveyor bounds',()=>{
 const item={x:0,y:0,rotation:0},camera={zoom:10,x:400,y:130};
 const horizontal=viewportRange(item,camera,100,100);assert.ok(Math.abs(horizontal.start-.1)<1e-9);assert.equal(horizontal.end,.9);
 const r=viewportRange({...item,rotation:90},camera,100,100);assert.ok(Math.abs(r.start-.37)<1e-9);assert.ok(Math.abs(r.end-.63)<1e-9);
 const full=viewportRange(item,{zoom:1,x:400,y:130},100,100);assert.equal(full.start,0);assert.equal(full.end,1);
 const forward=viewportRange(item,{zoom:20,x:200,y:130},100,100),reverse=viewportRange(item,{zoom:20,x:200,y:130},100,100,800,260,-1);assert.ok(Math.abs(reverse.start-(1-forward.end))<1e-9);
});
