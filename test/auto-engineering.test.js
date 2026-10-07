import test from 'node:test';
import assert from 'node:assert/strict';
import {driveRequirements,engineeringPreview,selectStandardMotor,solveMotionRequest,standardMotorCandidates} from '../src/auto-engineering.js';

test('actual distance decides triangular versus trapezoidal profile',()=>{
 const short=solveMotionRequest({distance:.2,targetSpeed:2,automatic:false,acceleration:1,deceleration:1});
 const long=solveMotionRequest({distance:10,targetSpeed:2,automatic:false,acceleration:1,deceleration:1});
 assert.equal(short.profileType,'triangular');assert.ok(short.peakSpeed<2);assert.equal(short.cruiseDistance,0);
 assert.equal(long.profileType,'trapezoidal');assert.equal(long.peakSpeed,2);assert.ok(long.cruiseDistance>0);
});

test('motor selection uses torque rpm and power requirements, never payload lookup',()=>{
 const requirements=driveRequirements({payloadKg:350,movingMassKg:100,acceleration:.6,targetSpeed:1,wheelRadiusM:.1,gearRatio:12,efficiency:.85});
 const selection=selectStandardMotor(requirements);
 assert.equal(selection.status,'selected');assert.ok(selection.motor.powerKw>=requirements.powerKw);assert.ok(selection.motor.ratedTorqueNm>=requirements.motorTorqueNm);assert.ok(selection.motor.maxRpm>=requirements.motorRpm);
 const samePayloadFaster=driveRequirements({payloadKg:350,movingMassKg:100,acceleration:1.2,targetSpeed:2,wheelRadiusM:.1,gearRatio:12,efficiency:.85});
 assert.ok(samePayloadFaster.powerKw>requirements.powerKw);assert.ok(samePayloadFaster.motorTorqueNm>requirements.motorTorqueNm);
});

test('no standard candidate is explicit instead of silently undersizing',()=>{
 const requirements={powerKw:100,motorTorqueNm:1000,motorRpm:5000};
 assert.deepEqual(selectStandardMotor(requirements),{status:'no-candidate',motor:null,requirements});
 assert.ok(standardMotorCandidates.length>3);
});

test('engineering preview records cause action and impact for automatic changes',()=>{
 const item={id:'cv-1',type:'conveyor',parameters:{length:2,speed:1,acceleration:.1,deceleration:.1,autoMotionTuning:1}};
 const preview=engineeringPreview(item,{payloadKg:350,movingMassKg:80});
 assert.deepEqual(preview.motionModels,['linear']);assert.equal(preview.motions.length,1);assert.equal(preview.changes.length,2);
 for(const log of preview.changes){assert.ok(log.cause);assert.match(log.action,/→/);assert.match(log.impact,/CT/);}
 assert.ok(['selected','no-candidate'].includes(preview.motorSelection.status));
});
