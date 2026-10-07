import test from 'node:test';
import assert from 'node:assert/strict';
import {compareEngineeringDuration,compareLayoutEngineering,engineScopedMotionRequest} from '../src/engineering-compatibility.js';

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
