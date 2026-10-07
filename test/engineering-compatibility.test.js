import test from 'node:test';
import assert from 'node:assert/strict';
import {compareEngineeringDuration,compareLayoutEngineering,engineScopedMotionRequest,engineScopedMotionRequests} from '../src/engineering-compatibility.js';
import {cadDuration,engineeringRuntimeDecision,legacyCadDuration} from '../src/engine.js';

const layout=item=>({cargoSpec:{length:1200,width:800,weight:100,unit:'mm'},equipment:[item]});

test('conveyor comparison uses the legacy full-clear travel distance',()=>{
 const item={id:'cv-1',type:'conveyor',parameters:{length:5,speed:1,acceleration:.8,deceleration:1,motionProfile:1,autoMotionTuning:0}};
 const request=engineScopedMotionRequest(item,layout(item));
 assert.equal(request.distance,6.2);
 const result=compareEngineeringDuration(item,layout(item));
 assert.equal(result.status,'compatible');
 assert.equal(result.applyEligible,true);
 assert.ok(Math.abs(result.deltaSeconds)<=result.toleranceSeconds);
});

test('automatic tuning mismatch is review-only and does not mutate parameters',()=>{
 const item={id:'cv-auto',type:'conveyor',parameters:{length:2,speed:1.5,acceleration:.2,deceleration:.2,motionProfile:1,autoMotionTuning:1}},before=structuredClone(item);
 const result=compareEngineeringDuration(item,layout(item));
 assert.equal(result.status,'review');
 assert.equal(result.applyEligible,false);
 assert.ok(result.reasons.some(reason=>reason.includes('AUTO')));
 assert.deepEqual(item,before);
});

test('layout audit keeps unmapped equipment explicit instead of applying it',()=>{
 const conveyor={id:'cv',type:'conveyor',parameters:{length:5,speed:.5,motionProfile:1,autoMotionTuning:0}},robot={id:'robot',type:'robot',parameters:{pickTime:2,placeTime:2}};
 const results=compareLayoutEngineering({cargoSpec:{length:1.2,unit:'m'},equipment:[conveyor,robot]});
 assert.equal(results.length,2);
 assert.equal(results[1].status,'unsupported');
 assert.equal(results[1].applyEligible,false);
 assert.equal(results[1].engineeringSeconds,null);
});

test('runtime uses engineering motion only through the compatibility gate',()=>{
 const compatible={id:'cv-manual',type:'conveyor',parameters:{length:5,speed:1,acceleration:.8,deceleration:1,motionProfile:1,autoMotionTuning:0}},compatibleLayout=layout(compatible),accepted=engineeringRuntimeDecision(compatible,compatibleLayout);
 assert.equal(accepted.status,'compatible');assert.equal(accepted.apply,true);assert.equal(cadDuration(compatible,compatibleLayout),accepted.engineeringSeconds);assert.notEqual(cadDuration(compatible,compatibleLayout),legacyCadDuration(compatible,compatibleLayout));
 const review={id:'cv-review',type:'conveyor',parameters:{length:2,speed:1.5,acceleration:.2,deceleration:.2,motionProfile:1,autoMotionTuning:1}},reviewLayout=layout(review),rejected=engineeringRuntimeDecision(review,reviewLayout);
 assert.equal(rejected.status,'review');assert.equal(rejected.apply,false);assert.equal(cadDuration(review,reviewLayout),legacyCadDuration(review,reviewLayout));
});

test('reviewed motion requires an explicit per-equipment runtime approval',()=>{
 const item={id:'cv-approved',type:'conveyor',parameters:{length:2,speed:1.5,acceleration:.2,deceleration:.2,motionProfile:1,autoMotionTuning:1}},itemLayout=layout(item),review=engineeringRuntimeDecision(item,itemLayout);
 assert.equal(review.status,'review');assert.equal(review.apply,false);
 item.engineering={motionRuntime:'approved'};
 const approved=engineeringRuntimeDecision(item,itemLayout),comparison=compareEngineeringDuration(item,itemLayout);
 assert.equal(approved.status,'approved');assert.equal(approved.apply,true);assert.equal(cadDuration(item,itemLayout),approved.engineeringSeconds);assert.notEqual(cadDuration(item,itemLayout),legacyCadDuration(item,itemLayout));
 assert.equal(comparison.status,'approved');assert.equal(comparison.applyEligible,true);assert.ok(comparison.reasons.some(reason=>reason.includes('검토 승인')));
});

test('mobile and fork cycles compose every legacy phase before runtime adoption',()=>{
 const amr={id:'amr',type:'amr',parameters:{receiveSpeed:.6,travelSpeed:1.5,transferSpeed:.4,shuttleDistance:6,acceleration:.8,deceleration:.8,autoMotionTuning:0}},amrLayout=layout(amr),amrResult=compareEngineeringDuration(amr,amrLayout);
 assert.deepEqual(engineScopedMotionRequests(amr,amrLayout).map(axis=>axis.model),['receive','drive','transfer']);assert.equal(amrResult.scope,'인수 + 주행 + 인계');assert.equal(amrResult.status,'compatible');assert.equal(cadDuration(amr,amrLayout),amrResult.engineeringSeconds);
 const fork={id:'fork',type:'forkingDevice',parameters:{strokeDistance:1.5,receiveSpeed:.5,transferSpeed:.75,holdTime:1,acceleration:.8,deceleration:.8,autoMotionTuning:0}},forkLayout=layout(fork),forkResult=compareEngineeringDuration(fork,forkLayout);
 assert.deepEqual(engineScopedMotionRequests(fork,forkLayout).map(axis=>axis.model),['loaded-forward','empty-return']);assert.equal(forkResult.fixedSeconds,1);assert.equal(forkResult.status,'compatible');
});

test('forklift and lift preserve the legacy one-way cycle scope',()=>{
 const forklift={id:'truck',type:'forklift',parameters:{travelDistance:9,speed:3,loadTime:4,unloadTime:5,acceleration:.5,deceleration:.5,autoMotionTuning:0}},forkliftResult=compareEngineeringDuration(forklift,layout(forklift));
 assert.deepEqual(forkliftResult.motions.map(axis=>axis.model),['loaded-forward']);assert.match(forkliftResult.scope,/빈차 복귀 제외/);assert.equal(forkliftResult.fixedSeconds,9);assert.equal(forkliftResult.status,'compatible');
 const lift={id:'lift',type:'lift',parameters:{liftHeight:6,liftSpeed:2,loadTime:1,unloadTime:2,acceleration:.5,deceleration:.5,autoMotionTuning:0}},liftResult=compareEngineeringDuration(lift,layout(lift));
 assert.deepEqual(liftResult.motions.map(axis=>axis.model),['up-with-gravity']);assert.match(liftResult.scope,/하강 복귀 제외/);assert.equal(liftResult.fixedSeconds,3);assert.equal(liftResult.status,'compatible');
});

test('turntable maps rotary motion without silently adding turn-conveyor transfer',()=>{
 const turntable={id:'turn',type:'turntable',parameters:{rotationTime:6,rotationAngleDeg:90,autoMotionTuning:1}},turnResult=compareEngineeringDuration(turntable,layout(turntable));
 assert.deepEqual(turnResult.motions.map(axis=>axis.model),['rotary']);assert.equal(turnResult.scope,'회전');assert.equal(turnResult.status,'compatible');assert.equal(cadDuration(turntable,layout(turntable)),turnResult.engineeringSeconds);
 const turnConveyor={id:'turn-cv',type:'turntable',equipmentRole:'turnConveyor',parameters:{length:2,speed:.5,rotationTime:6,rotationAngleDeg:90,autoMotionTuning:1}},turnConveyorResult=compareEngineeringDuration(turnConveyor,layout(turnConveyor));
 assert.deepEqual(turnConveyorResult.motions.map(axis=>axis.model),['rotary']);assert.match(turnConveyorResult.scope,/이송 축은 기존 CT에서 제외/);
});

test('pneumatic actuator compares extend hold and retract before runtime adoption',()=>{
 const actuator={id:'air',type:'station',equipmentRole:'pneumatic',parameters:{strokeDistance:.4,speed:.25,returnSpeed:.5,holdTime:.3,acceleration:.8,deceleration:.8,autoMotionTuning:0,cycleTime:1}},actuatorLayout=layout(actuator),review=compareEngineeringDuration(actuator,actuatorLayout);
 assert.deepEqual(review.motions.map(axis=>axis.model),['extend','retract']);assert.equal(review.fixedSeconds,.3);assert.equal(review.scope,'전진 + 대기 + 복귀');assert.equal(review.status,'review');assert.equal(cadDuration(actuator,actuatorLayout),legacyCadDuration(actuator,actuatorLayout));
 actuator.parameters.cycleTime=review.engineeringSeconds;const accepted=compareEngineeringDuration(actuator,actuatorLayout);
 assert.equal(accepted.status,'compatible');assert.equal(cadDuration(actuator,actuatorLayout),accepted.engineeringSeconds);
});

test('ASRS composes target-cell X Z and fork axes with simultaneous travel and return',()=>{
 const rack={id:'rack',type:'asrs',parameters:{rows:2,columns:4,levels:3,columnPitch:1.5,levelHeight:1.5,infeedColumn:1,infeedLevel:1,outfeedColumn:4,outfeedLevel:1,infeedTime:1,travelSpeed:2,liftSpeed:1,downSpeed:1.2,travelAcceleration:.5,travelDeceleration:.5,liftAcceleration:.5,liftDeceleration:.5,forkStroke:.8,forkSpeed:.4,forkAcceleration:1,forkDeceleration:1,putawayTime:.5,retrievalTime:.75,simultaneousMotion:1,autoMotionTuning:0}},rackLayout=layout(rack),putaway={slotIndex:14,operation:'putaway'},putawayResult=compareEngineeringDuration(rack,rackLayout,putaway);
 assert.deepEqual(putawayResult.motions.map(axis=>axis.model),['x-travel','z-up-with-gravity','fork-loaded','fork-empty']);assert.match(putawayResult.scope,/입고 X\/Z 동시 이동/);assert.equal(putawayResult.status,'compatible');assert.equal(cadDuration(rack,rackLayout,putaway),putawayResult.engineeringSeconds);
 const retrieval={slotIndex:14,operation:'retrieval'},retrievalResult=compareEngineeringDuration(rack,rackLayout,retrieval);
 assert.deepEqual(retrievalResult.motions.map(axis=>axis.model),['x-travel','z-down-with-gravity','fork-loaded','fork-empty']);assert.match(retrievalResult.scope,/반출 X\/Z 동시 이동/);assert.equal(retrievalResult.status,'compatible');
});

test('ASRS sequential setting sums X and Z instead of taking the slower axis',()=>{
 const rack={id:'rack-sequential',type:'stackerCrane',parameters:{rows:1,columns:4,levels:3,columnPitch:1.5,levelHeight:1.5,infeedColumn:1,infeedLevel:1,travelSpeed:2,liftSpeed:1,travelAcceleration:.5,travelDeceleration:.5,liftAcceleration:.5,liftDeceleration:.5,forkStroke:.8,forkSpeed:.4,forkAcceleration:1,forkDeceleration:1,putawayTime:.5,simultaneousMotion:0,autoMotionTuning:0}},result=compareEngineeringDuration(rack,layout(rack),{slotIndex:7,operation:'putaway'});
 assert.match(result.scope,/순차 이동/);assert.equal(result.status,'compatible');
});
