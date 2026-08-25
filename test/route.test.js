import test from 'node:test';
import assert from 'node:assert/strict';
import { orthogonalRoute, pointOnRoute, routeLength } from '../src/route.js';

test('대각선 설비 사이 물류는 직교 꺾임 경로를 따라 이동한다',()=>{
  const points=orthogonalRoute({x:0,y:0},{x:100,y:100});
  assert.equal(points.length,4);assert.equal(routeLength(points),200);
  const middle=pointOnRoute(points,.5);assert.ok(Math.abs(middle.x-55)<1e-9||Math.abs(middle.y-100)<1e-9);assert.notDeepEqual(middle,{x:50,y:50});
});
