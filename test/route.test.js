import test from 'node:test';
import assert from 'node:assert/strict';
import { closestPortPair, connectionAnchor, orthogonalRoute, pointOnRoute, routeLength } from '../src/route.js';

test('대각선 설비 사이 물류는 직교 꺾임 경로를 따라 이동한다',()=>{
  const points=orthogonalRoute({x:0,y:0},{x:100,y:100});
  assert.equal(points.length,4);assert.equal(routeLength(points),200);
  const middle=pointOnRoute(points,.5);assert.ok(Math.abs(middle.x-55)<1e-9||Math.abs(middle.y-100)<1e-9);assert.notDeepEqual(middle,{x:50,y:50});
});

test('설비 연결 시 가장 가까운 회전 포트를 자동 선택한다',()=>{
  const from={x:0,y:0,rotation:0},to={x:200,y:0,rotation:90},pair=closestPortPair(from,to);assert.equal(pair.fromPort,'right');assert.ok(['top','bottom'].includes(pair.toPort));const anchor=connectionAnchor(from,pair.fromPort);assert.deepEqual(anchor,{x:44,y:0});
});
