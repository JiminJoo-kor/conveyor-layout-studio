import {motionProfileSummary,recommendedMotionDynamics} from './kinematics.js';
import {motionModelsFor} from './parameter-master.js';

export const standardMotorCandidates=Object.freeze([
 {id:'IEC-0.2',powerKw:.2,ratedTorqueNm:1.27,maxRpm:1500},
 {id:'IEC-0.4',powerKw:.4,ratedTorqueNm:2.55,maxRpm:1500},
 {id:'IEC-0.75',powerKw:.75,ratedTorqueNm:4.78,maxRpm:1500},
 {id:'IEC-1.5',powerKw:1.5,ratedTorqueNm:9.55,maxRpm:1500},
 {id:'IEC-2.2',powerKw:2.2,ratedTorqueNm:14,maxRpm:1500},
 {id:'IEC-3.7',powerKw:3.7,ratedTorqueNm:23.6,maxRpm:1500},
 {id:'IEC-5.5',powerKw:5.5,ratedTorqueNm:35,maxRpm:1500},
 {id:'IEC-7.5',powerKw:7.5,ratedTorqueNm:47.8,maxRpm:1500},
 {id:'IEC-11',powerKw:11,ratedTorqueNm:70,maxRpm:1500}
]);

const positive=(value,fallback)=>Math.max(1e-6,Number.isFinite(Number(value))?Number(value):fallback);
const rounded=value=>Number(value.toFixed(3));

export function solveMotionRequest(request){
 const distance=Math.max(0,Number(request.distance)||0),targetSpeed=positive(request.targetSpeed,.5),automatic=request.automatic!==false;
 const dynamics=automatic?recommendedMotionDynamics(distance,targetSpeed,request.rampShare):{acceleration:positive(request.acceleration,.8),deceleration:positive(request.deceleration,1)};
 const profile=motionProfileSummary(distance,{targetSpeed,...dynamics,motionProfile:'trapezoidal'});
 return{...request,distance,targetSpeed,...dynamics,profileType:profile.t2>1e-9?'trapezoidal':'triangular',peakSpeed:rounded(profile.peakSpeed),accelerationDistance:rounded(profile.s1),cruiseDistance:rounded(profile.s2),decelerationDistance:rounded(profile.s3),accelerationTime:rounded(profile.t1),cruiseTime:rounded(profile.t2),decelerationTime:rounded(profile.t3),totalTime:rounded(profile.total)};
}

export function driveRequirements({payloadKg=0,movingMassKg=0,acceleration=.8,targetSpeed=.5,inclineDeg=0,rollingResistance=.03,wheelRadiusM=.08,gearRatio=12,efficiency=.85,serviceFactor=1.25}={}){
 const mass=Math.max(0,Number(payloadKg)||0)+Math.max(0,Number(movingMassKg)||0),g=9.80665,angle=(Number(inclineDeg)||0)*Math.PI/180,a=positive(acceleration,.8),speed=positive(targetSpeed,.5),radius=positive(wheelRadiusM,.08),ratio=positive(gearRatio,12),eta=Math.max(.05,Math.min(1,Number(efficiency)||.85)),factor=Math.max(1,Number(serviceFactor)||1.25);
 const rolling=mass*g*Math.max(0,Number(rollingResistance)||0)*Math.cos(angle),gravity=mass*g*Math.sin(angle),inertia=mass*a,forceN=Math.max(0,rolling+gravity+inertia),outputTorqueNm=forceN*radius,motorTorqueNm=outputTorqueNm/(ratio*eta)*factor,motorRpm=speed/(2*Math.PI*radius)*60*ratio,powerKw=forceN*speed/eta/1000*factor;
 return{massKg:rounded(mass),forceN:rounded(forceN),outputTorqueNm:rounded(outputTorqueNm),motorTorqueNm:rounded(motorTorqueNm),motorRpm:rounded(motorRpm),powerKw:rounded(powerKw),assumptions:{inclineDeg:Number(inclineDeg)||0,rollingResistance:Number(rollingResistance)||0,wheelRadiusM:radius,gearRatio:ratio,efficiency:eta,serviceFactor:factor}};
}

export function selectStandardMotor(requirements,candidates=standardMotorCandidates){
 const selected=candidates.find(motor=>motor.powerKw+1e-9>=requirements.powerKw&&motor.ratedTorqueNm+1e-9>=requirements.motorTorqueNm&&motor.maxRpm+1e-9>=requirements.motorRpm);
 return selected?{status:'selected',motor:selected,requirements}:{status:'no-candidate',motor:null,requirements};
}

export function engineeringChangeLog({equipmentId,parameter,before,after,cause,impact}){
 return{equipmentId,parameter,before,after,cause,action:`${parameter} ${before} → ${after}`,impact,createdBy:'AUTO_ENGINEERING'};
}

function distanceAndSpeed(item){const p=item.parameters||{};if(['conveyor','sorter'].includes(item.type))return{distance:Number(p.length)||5,speed:Number(p.speed)||.5};if(['agv','amr','shuttle'].includes(item.type))return{distance:Number(p.shuttleDistance)||5,speed:Number(p.travelSpeed)||1};if(item.type==='forklift')return{distance:Number(p.travelDistance)||5,speed:Number(p.speed)||1};if(item.type==='lift')return{distance:Number(p.liftHeight)||3,speed:Number(p.liftSpeed)||.5};if(item.type==='forkingDevice')return{distance:Number(p.strokeDistance)||1.5,speed:Math.max(Number(p.receiveSpeed)||0,Number(p.transferSpeed)||0,.5)};return null;}

export function engineeringPreview(item,{payloadKg=0,movingMassKg=100,drive={}}={}){
 const basis=distanceAndSpeed(item);if(!basis)return{equipmentId:item.id,motionModels:motionModelsFor(item),motions:[],motorSelection:null,changes:[]};
 const motion=solveMotionRequest({equipmentId:item.id,model:motionModelsFor(item)[0],distance:basis.distance,targetSpeed:basis.speed,automatic:item.parameters?.autoMotionTuning!==0,acceleration:item.parameters?.acceleration,deceleration:item.parameters?.deceleration});
 const requirements=driveRequirements({payloadKg,movingMassKg,acceleration:motion.acceleration,targetSpeed:motion.peakSpeed,...drive}),motorSelection=selectStandardMotor(requirements),changes=[];
 for(const key of ['acceleration','deceleration']){const before=Number(item.parameters?.[key]);const after=motion[key];if(Number.isFinite(before)&&Math.abs(before-after)>1e-9)changes.push(engineeringChangeLog({equipmentId:item.id,parameter:key,before,after,cause:'실제 이동거리와 목표속도에 필요한 가감속 프로파일',impact:`${motion.profileType} · CT ${motion.totalTime.toFixed(3)}s`}));}
 return{equipmentId:item.id,motionModels:motionModelsFor(item),motions:[motion],motorSelection,changes};
}
