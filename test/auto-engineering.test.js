import test from 'node:test';
import assert from 'node:assert/strict';
import {axisDriveRequirements,driveRequirements,engineeringPreview,loadedPayloadFor,maximumDrivePayload,motionRequestsFor,pneumaticRequirements,selectStandardCylinder,selectStandardMotor,solveFlatDriveMotion,solveMotionRequest,standardMotorCandidates,verifyDriveRoundTrip} from '../src/auto-engineering.js';

test('actual distance decides triangular versus trapezoidal profile',()=>{
 const short=solveMotionRequest({distance:.2,targetSpeed:2,automatic:false,acceleration:1,deceleration:1});
 const long=solveMotionRequest({distance:10,targetSpeed:2,automatic:false,acceleration:1,deceleration:1});
 assert.equal(short.requestedSpeed,2);assert.equal(short.appliedSpeed,2);
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

test('flat conveyor uses maximum loaded quantity and drive limits before calculating motion',()=>{
 const conveyor={type:'conveyor',parameters:{capacity:4}},loaded=loadedPayloadFor(conveyor,100),motion=solveFlatDriveMotion({equipmentType:'conveyor',distance:5.5,targetSpeed:20},{payloadKg:loaded.payloadKg,movingMassKg:80});
 assert.deepEqual(loaded,{unitPayloadKg:100,loadCount:4,payloadKg:400});
 assert.equal(motion.massKg,480);assert.equal(motion.requestedSpeed,20);assert.ok(motion.appliedSpeed<=2.5);assert.ok(motion.appliedSpeed<20);assert.ok(motion.acceleration<=.8);assert.ok(motion.deceleration<=1);assert.ok(motion.limitReasons.some(reason=>reason.includes('최고속도')));assert.ok(motion.limitReasons.some(reason=>reason.includes('RPM')));
 assert.ok(motion.motorSelection.motor);assert.ok(motion.motorSelection.requirements.massKg===480);assert.ok(motion.motorSelection.maxPayloadKg>=400);assert.ok(motion.motorSelection.loadUtilization>0);assert.equal(motion.motorSelection.verification.status,'verified');
});

test('selected drive reverses torque and power limits into maximum cargo payload',()=>{
 const motor=standardMotorCandidates.find(candidate=>candidate.id==='IEC-1.5'),result=maximumDrivePayload(motor,{movingMassKg:80,acceleration:.8,targetSpeed:1,wheelRadiusM:.08,gearRatio:12,efficiency:.85,serviceFactor:1.25});
 assert.ok(result.payloadKg>0);assert.ok(result.totalMassKg>result.payloadKg);assert.ok(['기동 토크','연속 출력'].includes(result.limitingFactor));
 const faster=maximumDrivePayload(motor,{movingMassKg:80,acceleration:.8,targetSpeed:2,wheelRadiusM:.08,gearRatio:12,efficiency:.85,serviceFactor:1.25});assert.ok(faster.payloadKg<=result.payloadKg);
});

test('forward force torque rpm power and reverse payload agree within engineering tolerance',()=>{
 const motor=standardMotorCandidates.find(candidate=>candidate.id==='IEC-1.5'),conditions={payloadKg:350,movingMassKg:80,acceleration:.8,targetSpeed:1,inclineDeg:0,rollingResistance:.03,wheelRadiusM:.08,gearRatio:12,efficiency:.85,serviceFactor:1.25},motion=solveMotionRequest({distance:8,targetSpeed:1,automatic:false,acceleration:.8,deceleration:1}),verification=verifyDriveRoundTrip(motor,conditions,motion);
 assert.equal(verification.status,'verified');assert.equal(verification.verified,true);assert.ok(verification.maxResidualPercent<=.5);assert.deepEqual(verification.checks.map(check=>check.key),['force','torque','rpm','power','capacity','distance']);assert.ok(verification.capacity.payloadKg>=conditions.payloadKg);
});

test('round-trip verification rejects a motor below the calculated duty',()=>{
 const motor=standardMotorCandidates[0],verification=verifyDriveRoundTrip(motor,{payloadKg:1000,movingMassKg:200,acceleration:1,targetSpeed:2});
 assert.equal(verification.status,'review');assert.equal(verification.verified,false);assert.ok(verification.reasons.includes('선정 모터 정격 초과'));
});

test('short flat conveyor reports the physical peak speed without forcing a constant-speed section',()=>{
 const motion=solveFlatDriveMotion({equipmentType:'conveyor',distance:.5,targetSpeed:2},{payloadKg:400,movingMassKg:80,drive:{gearRatio:4}});
 assert.equal(motion.profileType,'triangular');assert.equal(motion.cruiseTime,0);assert.ok(motion.peakSpeed<motion.appliedSpeed);
});

test('no standard candidate is explicit instead of silently undersizing',()=>{
 const requirements={powerKw:100,motorTorqueNm:1000,motorRpm:5000};
 assert.deepEqual(selectStandardMotor(requirements),{status:'no-candidate',motor:null,requirements});
 assert.ok(standardMotorCandidates.length>3);
});

test('industrial high-power requirements select the next standard motor size',()=>{
 const selection=selectStandardMotor({powerKw:13.567,motorTorqueNm:90.45,motorRpm:1432});
 assert.equal(selection.status,'selected');assert.equal(selection.motor.id,'IEC-15');
});

test('engineering preview records cause action and impact for automatic changes',()=>{
 const item={id:'cv-1',type:'conveyor',parameters:{length:2,speed:1,acceleration:.1,deceleration:.1,autoMotionTuning:1}};
 const preview=engineeringPreview(item,{payloadKg:350,movingMassKg:80});
 assert.deepEqual(preview.motionModels,['linear']);assert.equal(preview.motions.length,1);assert.equal(preview.changes.length,2);
 for(const log of preview.changes){assert.ok(log.cause);assert.match(log.action,/→/);assert.match(log.impact,/CT/);}
 assert.ok(['selected','no-candidate'].includes(preview.motorSelection.status));
});

test('equipment-specific axes map to independent motion requests',()=>{
 const asrs={id:'rack',type:'asrs',parameters:{columns:5,columnPitch:1.5,levels:3,levelHeight:2,travelSpeed:2,liftSpeed:1,downSpeed:1.2,forkStroke:.8,forkSpeed:.4,autoMotionTuning:1}};
 const axes=motionRequestsFor(asrs);assert.deepEqual(axes.map(axis=>axis.model),['x-travel','z-up-with-gravity','z-down-with-gravity','fork-loaded','fork-empty']);assert.deepEqual(axes.map(axis=>axis.distance),[6,4,4,.8,.8]);
 const preview=engineeringPreview(asrs,{payloadKg:350,movingMassKg:500});assert.equal(preview.motions.length,5);assert.equal(preview.motorSelection.axisRequirements.length,5);assert.equal(preview.motorSelection.requirements.model,'all-axis-envelope');assert.equal(preview.motorSelection.criticalRequirement.model,'z-down-with-gravity');
});

test('gravity rotary and empty return axes use distinct physical requirements',()=>{
 const up=axisDriveRequirements({model:'up-with-gravity',acceleration:.5,deceleration:.7,peakSpeed:.8,inclineDeg:90},{payloadKg:300,movingMassKg:200}),down=axisDriveRequirements({model:'down-with-gravity',acceleration:.5,deceleration:.7,peakSpeed:.8,inclineDeg:-90},{payloadKg:300,movingMassKg:200}),loaded=axisDriveRequirements({model:'fork-loaded',acceleration:.5,peakSpeed:.5},{payloadKg:300,movingMassKg:100}),empty=axisDriveRequirements({model:'fork-empty',acceleration:.5,peakSpeed:.5},{payloadKg:300,movingMassKg:100}),rotary=axisDriveRequirements({model:'rotary',acceleration:.4,peakSpeed:.6},{payloadKg:300,movingMassKg:100,drive:{rotaryRadiusM:.8}});
 assert.equal(up.operatingMode,'적재 구동');assert.equal(down.operatingMode,'하강 제동');assert.ok(down.motorTorqueNm>up.motorTorqueNm);assert.equal(empty.operatingMode,'빈 복귀');assert.ok(empty.massKg<loaded.massKg);assert.equal(rotary.driveFamily,'rotary');assert.ok(rotary.inertiaKgM2>0);assert.ok(rotary.motorTorqueNm>0);
});

test('pneumatic actuator selects a standard bore from extend and annular retract force',()=>{
 const requirements=pneumaticRequirements({payloadKg:20,movingMassKg:10,acceleration:1,frictionCoefficient:.1,externalForceN:50,serviceFactor:1.5}),selection=selectStandardCylinder(requirements,{pressureBar:6,efficiency:.85});
 assert.equal(selection.status,'selected');assert.ok(selection.cylinder.extendForceN>=requirements.requiredForceN);assert.ok(selection.cylinder.retractForceN>=requirements.requiredForceN);assert.ok(selection.cylinder.extendForceN>selection.cylinder.retractForceN);assert.ok(selection.utilizationPercent<=100);
});

test('pneumatic engineering never reports an IEC motor selection',()=>{
 const item={id:'air',type:'station',equipmentRole:'pneumatic',parameters:{strokeDistance:.4,speed:.25,returnSpeed:.4,pressureBar:6,autoMotionTuning:1}},preview=engineeringPreview(item,{payloadKg:20,movingMassKg:10});
 assert.equal(preview.motorSelection,null);assert.equal(preview.actuatorSelection.status,'selected');assert.match(preview.actuatorSelection.cylinder.id,/ISO-CYL/);
});

test('fork lift mobile rotary turn conveyor and pneumatic preserve distinct phases',()=>{
 assert.deepEqual(motionRequestsFor({id:'fork',type:'forkingDevice',parameters:{strokeDistance:1}}).map(x=>x.model),['loaded-forward','empty-return']);
 assert.deepEqual(motionRequestsFor({id:'lift',type:'lift',parameters:{liftHeight:3}}).map(x=>x.model),['up-with-gravity','down-with-gravity']);
 assert.deepEqual(motionRequestsFor({id:'amr',type:'amr',parameters:{}},{cargoLengthM:1}).map(x=>x.model),['receive','drive','transfer']);
 assert.deepEqual(motionRequestsFor({id:'turn',type:'turntable',parameters:{}}).map(x=>x.model),['rotary']);
 assert.deepEqual(motionRequestsFor({id:'turn-cv',type:'turntable',equipmentRole:'turnConveyor',parameters:{}}).map(x=>x.model),['transfer','rotary']);
 assert.deepEqual(motionRequestsFor({id:'air',type:'station',equipmentRole:'pneumatic',parameters:{}}).map(x=>x.model),['extend','retract']);
});
