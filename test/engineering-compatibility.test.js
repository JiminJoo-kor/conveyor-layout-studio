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
 const conveyor={id:'cv',type:'conveyor',parameters:{length:5,speed:.5,motionProfile:1,autoMotionTuning:0}},asrs={id:'rack',type:'asrs',parameters:{}};
 const results=compareLayoutEngineering({cargoSpec:{length:1.2,unit:'m'},equipment:[conveyor,asrs]});
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
