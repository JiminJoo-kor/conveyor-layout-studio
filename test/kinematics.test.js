import test from 'node:test';
import assert from 'node:assert/strict';
import { DeterministicReliability, KinematicMotion, MotionState, kinematicTravelDuration } from '../src/kinematics.js';
import { handoverProgress, handoverScale, handoverVisualSegments, intervalsOverlap, itemVisualLength, OccupancyManager, rigidHandoverVisualState, smoothedVelocityProgress } from '../src/occupancy.js';
import { scaleRatioItemVisualSize } from '../src/renderer.js';

test('S-Curve는 jerk로 가속도 변화량을 제한하고 정지까지 FSM을 추적한다',()=>{const motion=new KinematicMotion({targetSpeed:2,acceleration:1,deceleration:1,jerk:2});motion.step(.1,{distance:5});assert.ok(Math.abs(motion.acceleration-.2)<1e-9);assert.equal(motion.state,MotionState.ACCELERATING);for(let i=0;i<1000&&motion.position<5;i++)motion.step(.01,{distance:5});assert.equal(motion.position,5);assert.equal(motion.velocity,0);assert.equal(motion.state,MotionState.STOPPED);});

test('운행 중 목표속도 변경은 위치 순간이동 없이 현재 v와 a에서 연속 재계산한다',()=>{const motion=new KinematicMotion({targetSpeed:2,acceleration:1,deceleration:1,jerk:2});for(let i=0;i<100;i++)motion.step(.01,{distance:20});const before=motion.snapshot();motion.updateConfig({targetSpeed:.5});const after=motion.step(.01,{distance:20});assert.ok(after.position>=before.position);assert.ok(after.position-before.position<.1);assert.ok(Math.abs(after.velocity-before.velocity)<.1);});

test('고정 dt 운동 결과는 프레임 묶음 방식과 무관하다',()=>{const a=new KinematicMotion({targetSpeed:1.5,acceleration:.8,deceleration:1,jerk:1.5}),b=new KinematicMotion({targetSpeed:1.5,acceleration:.8,deceleration:1,jerk:1.5});for(let i=0;i<500;i++)a.step(.02,{distance:100});for(let frame=0;frame<100;frame++)for(let i=0;i<5;i++)b.step(.02,{distance:100});assert.deepEqual(a.snapshot(),b.snapshot());assert.ok(kinematicTravelDuration(10,{targetSpeed:1,acceleration:.8,deceleration:1,jerk:1.5})>10);});

test('MTBF/MTTR 모델은 같은 seed와 dt에서 동일한 정지 이벤트를 만든다',()=>{const params={mtbf:2,mttr:.5,microStopInterval:3,microStopDuration:.1},a=new DeterministicReliability(42),b=new DeterministicReliability(42),statesA=[],statesB=[];for(let i=0;i<500;i++){statesA.push(a.step(.02,params).available);statesB.push(b.step(.02,params).available);}assert.deepEqual(statesA,statesB);assert.ok(statesA.includes(false));});

test('공통 설비 표시 크기에서 실제 길이 비율대로 물류 크기를 계산한다',()=>{assert.equal(itemVisualLength(200,1,10),20);assert.equal(itemVisualLength(200,1,2),100);assert.equal(scaleRatioItemVisualSize(200,1,2),100);});

test('점유 관리자는 물류 길이와 안전간격을 포함해 후속 진입을 인터락한다',()=>{const manager=new OccupancyManager();manager.reserve('a','cv',2,1,.2);assert.equal(manager.canOccupy('b','cv',2.9,1,.2),false);assert.equal(manager.canOccupy('b','cv',4,1,.2),true);manager.release('a','cv');assert.equal(manager.canOccupy('b','cv',2.9,1,.2),true);assert.equal(intervalsOverlap({start:0,end:1},{start:1,end:2}),false);});

test('핸드오버는 head 진입부터 tail 이탈까지 양 설비 표시 길이를 연속 분할한다',()=>{assert.equal(handoverProgress(.5,1,1),.5);assert.deepEqual(handoverVisualSegments(.25,100),{sourceLength:75,targetLength:25});assert.deepEqual(handoverVisualSegments(1,100),{sourceLength:0,targetLength:100});});
test('핸드오버 스케일은 점유 비율을 smoothstep 보간하고 하나의 강체 길이를 유지한다',()=>{assert.deepEqual(handoverScale(0,20,100),{sourceWeight:1,targetWeight:0,scale:20});assert.deepEqual(handoverScale(1,20,100),{sourceWeight:0,targetWeight:1,scale:100});const middle=rigidHandoverVisualState(.5,1,20,100,20,100);assert.equal(middle.visualLength,60);assert.equal(middle.sourceWeight,.5);assert.equal(middle.targetWeight,.5);});
test('화면 속도 보간 진행률은 양 끝을 보존하고 속도 차이를 연속적으로 누적한다',()=>{assert.equal(smoothedVelocityProgress(0,20,100),0);assert.equal(smoothedVelocityProgress(1,20,100),1);const early=smoothedVelocityProgress(.25,20,100),late=smoothedVelocityProgress(.75,20,100);assert.ok(early>0&&early<.25);assert.ok(late>.5&&late<1);});
