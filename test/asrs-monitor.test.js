import test from 'node:test';
import assert from 'node:assert/strict';
import { asrsDepthPresentation, asrsSceneModel, isoPoint } from '../src/asrs-monitor.js';

test('아이소메트릭 렉 좌표는 열·단·깊이를 서로 다른 축으로 투영한다',()=>{const origin={x:10,y:80},base=isoPoint(origin,0,0),column=isoPoint(origin,1,0),level=isoPoint(origin,0,1),depth=isoPoint(origin,0,0,1);assert.ok(column.x>base.x);assert.ok(level.y<base.y);assert.ok(depth.x>base.x&&depth.y<base.y);});

test('AS/RS 3D 장면은 물품 구분별 렉과 동일 엔진 시간의 스태커 상태를 만든다',()=>{const equipment={id:'asrs',type:'stackerCrane',parameters:{rows:2,columns:8,levels:4,columnPitch:1.5,levelHeight:1.5,travelSpeed:2.5,liftSpeed:1,putawayTime:4}},state={t:3,asrs:{equipmentId:'asrs',columns:8,levels:4,rows:2,zones:{트림:{inventory:2,capacity:64},화이날:{inventory:0,capacity:64}}},cadTokens:[{nodeId:'asrs',edge:null,flowKey:'트림',asrsPhase:'putaway',nodeEnteredAt:0,asrsTarget:{index:17}}]},model=asrsSceneModel(equipment,state,(_,index)=>index?'#0f8':'#0cf');assert.equal(model.zones.length,2);assert.equal(model.zones[0].operation.status,'inbound');assert.equal(model.zones[1].operation.status,'waiting');assert.ok(model.zones[0].column>=0&&model.zones[0].level>=0);});

test('뒤 셀 작업은 깊이 구조를 벌리고 앞 랙을 투명하게 표시한다',()=>{const front=asrsDepthPresentation({status:'inbound',target:{row:0},phase:'travel'},2),rear=asrsDepthPresentation({status:'inbound',target:{row:1},phase:'travel'},2);assert.equal(front.rearTarget,false);assert.equal(front.depthGap,5);assert.equal(rear.rearTarget,true);assert.ok(rear.depthGap>front.depthGap);assert.ok(rear.frontAlpha<1);});

test('셀 입고 물류는 전체 포크 시간 동안 목표 셀 중심에서 서서히 축소된다',()=>{const start=asrsDepthPresentation({status:'inbound',target:{row:1},phase:'fork',forkProgress:0},2),middle=asrsDepthPresentation({status:'inbound',target:{row:1},phase:'fork',forkProgress:.5},2),done=asrsDepthPresentation({status:'inbound',target:{row:1},phase:'fork',forkProgress:1},2);assert.equal(start.cargoAtCell,true);assert.equal(start.cargoScale,1);assert.equal(middle.cargoScale,.5);assert.equal(done.cargoScale,0);});

test('셀 출고 물류는 목표 셀 중심에서 서서히 실제 크기로 나타난다',()=>{const start=asrsDepthPresentation({status:'outbound',target:{row:1},phase:'fork',forkProgress:0},2),middle=asrsDepthPresentation({status:'outbound',target:{row:1},phase:'fork',forkProgress:.5},2),done=asrsDepthPresentation({status:'outbound',target:{row:1},phase:'fork',forkProgress:1},2);assert.equal(start.cargoAtCell,true);assert.equal(start.cargoScale,0);assert.equal(middle.cargoScale,.5);assert.equal(done.cargoScale,1);});
