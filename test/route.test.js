import test from 'node:test';
import assert from 'node:assert/strict';
import { closestPortPair, connectionAnchor, connectionKind, edgeRoute, equipmentDirectionControls, equipmentFlowPorts, orthogonalRoute, pointOnRoute, routeArrow, routeLength } from '../src/route.js';

test('대각선 설비 사이 물류는 직교 꺾임 경로를 따라 이동한다',()=>{
  const points=orthogonalRoute({x:0,y:0},{x:100,y:100});
  assert.equal(points.length,4);assert.equal(routeLength(points),200);
  const middle=pointOnRoute(points,.5);assert.ok(Math.abs(middle.x-55)<1e-9||Math.abs(middle.y-100)<1e-9);assert.notDeepEqual(middle,{x:50,y:50});
});

test('가로 설비는 좌우, 세로 설비는 위아래 방향 버튼을 표시한다',()=>{
  assert.deepEqual(equipmentDirectionControls({x:100,y:100,rotation:0}).map(item=>item.direction),['left','right']);
  assert.deepEqual(equipmentDirectionControls({x:100,y:100,rotation:90}).map(item=>item.direction),['up','down']);
});
test('회전된 설비도 선택한 화살표 방향을 출력, 반대쪽을 입력 포트로 사용한다',()=>{assert.deepEqual(equipmentFlowPorts({x:0,y:0,rotation:0,parameters:{flowDirection:'left'}}),{input:'right',output:'left'});assert.deepEqual(equipmentFlowPorts({x:0,y:0,rotation:180,parameters:{flowDirection:'left'}}),{input:'left',output:'right'});assert.deepEqual(equipmentFlowPorts({x:0,y:0,rotation:90,parameters:{flowDirection:'down'}}),{input:'left',output:'right'});});

test('설비 연결 시 가장 가까운 회전 포트를 자동 선택한다',()=>{
  const from={x:0,y:0,rotation:0},to={x:200,y:0,rotation:90},pair=closestPortPair(from,to);assert.equal(pair.fromPort,'right');assert.ok(['left','right'].includes(pair.toPort));const anchor=connectionAnchor(from,pair.fromPort);assert.deepEqual(anchor,{x:44,y:0});
});

test('연결 설비 특성에 따라 흐름 종류와 색상 의미를 분류한다',()=>{
  assert.equal(connectionKind({type:'conveyor'},{type:'conveyor'},'warehouse'),'flow');assert.equal(connectionKind({type:'conveyor'},{type:'forkingDevice'}),'forking');assert.equal(connectionKind({type:'forkingDevice'},{type:'stackerCrane'}),'warehouse');assert.equal(connectionKind({type:'conveyor'},{type:'amr'}),'transfer');assert.equal(connectionKind({type:'conveyor'},{type:'forklift'}),'transfer');
});

test('화살표는 가장 긴 직교 구간의 실제 진행 방향을 따른다',()=>{
  const arrow=routeArrow([{x:0,y:0},{x:100,y:0},{x:100,y:20},{x:110,y:20}]);assert.equal(arrow.angle,0);assert.equal(arrow.y,0);assert.ok(arrow.x>0&&arrow.x<100);
});

test('연결선 이동 오프셋은 끝점을 유지하고 중간 경로만 이동한다',()=>{
  const horizontal=edgeRoute({x:0,y:0},{x:200,y:0},{routeOffset:{x:0,y:60}});assert.deepEqual(horizontal,[{x:0,y:0},{x:0,y:60},{x:200,y:60},{x:200,y:0}]);const bent=edgeRoute({x:0,y:0},{x:200,y:100},{routeOffset:{x:40,y:0}});assert.equal(bent[1].x,150);assert.deepEqual(bent[0],{x:0,y:0});assert.deepEqual(bent.at(-1),{x:200,y:100});
});

test('꺾인 연결선은 중간 경로를 좌우와 상하로 함께 이동한다',()=>{
  const from={x:0,y:0},to={x:200,y:100},points=edgeRoute(from,to,{routeOffset:{x:40,y:30}});assert.deepEqual(points[0],from);assert.deepEqual(points.at(-1),to);assert.ok(points.some(point=>point.x===150));assert.ok(points.some(point=>point.y===30));assert.deepEqual(points[2],{x:150,y:30});
});
