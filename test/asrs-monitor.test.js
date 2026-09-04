import test from 'node:test';
import assert from 'node:assert/strict';
import { asrsSceneModel, isoPoint } from '../src/asrs-monitor.js';

test('아이소메트릭 렉 좌표는 열·단·깊이를 서로 다른 축으로 투영한다',()=>{const origin={x:10,y:80},base=isoPoint(origin,0,0),column=isoPoint(origin,1,0),level=isoPoint(origin,0,1),depth=isoPoint(origin,0,0,1);assert.ok(column.x>base.x);assert.ok(level.y<base.y);assert.ok(depth.x>base.x&&depth.y<base.y);});

test('AS/RS 3D 장면은 물품 구분별 렉과 동일 엔진 시간의 스태커 상태를 만든다',()=>{const equipment={id:'asrs',type:'stackerCrane',parameters:{rows:2,columns:8,levels:4,columnPitch:1.5,levelHeight:1.5,travelSpeed:2.5,liftSpeed:1,putawayTime:4}},state={t:3,asrs:{equipmentId:'asrs',columns:8,levels:4,rows:2,zones:{트림:{inventory:2,capacity:64},화이날:{inventory:0,capacity:64}}},cadTokens:[{nodeId:'asrs',edge:null,flowKey:'트림',asrsPhase:'putaway',nodeEnteredAt:0,asrsTarget:{index:17}}]},model=asrsSceneModel(equipment,state,(_,index)=>index?'#0f8':'#0cf');assert.equal(model.zones.length,2);assert.equal(model.zones[0].operation.status,'inbound');assert.equal(model.zones[1].operation.status,'waiting');assert.ok(model.zones[0].column>=0&&model.zones[0].level>=0);});
