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
 {id:'IEC-11',powerKw:11,ratedTorqueNm:70,maxRpm:1500},
 {id:'IEC-15',powerKw:15,ratedTorqueNm:95.5,maxRpm:1500},
 {id:'IEC-18.5',powerKw:18.5,ratedTorqueNm:117.8,maxRpm:1500},
 {id:'IEC-22',powerKw:22,ratedTorqueNm:140.1,maxRpm:1500}
]);

export const equipmentDriveDefaults=Object.freeze({
 conveyor:Object.freeze({movingMassKg:80,mechanicalMaxSpeed:2.5,accelerationLimit:0.8,decelerationLimit:1,rollingResistance:0.03,wheelRadiusM:0.08,gearRatio:12,efficiency:0.85,serviceFactor:1.25}),
 sorter:Object.freeze({movingMassKg:120,mechanicalMaxSpeed:2.5,accelerationLimit:0.8,decelerationLimit:1,rollingResistance:0.03,wheelRadiusM:0.08,gearRatio:12,efficiency:0.85,serviceFactor:1.25}),
 processLine:Object.freeze({movingMassKg:100,mechanicalMaxSpeed:1.5,accelerationLimit:0.5,decelerationLimit:0.7,rollingResistance:0.04,wheelRadiusM:0.08,gearRatio:16,efficiency:0.82,serviceFactor:1.25})
});

const positive=(value,fallback)=>Math.max(1e-6,Number.isFinite(Number(value))?Number(value):fallback);
const rounded=value=>Number(value.toFixed(3));

export function solveMotionRequest(request){
 const distance=Math.max(0,Number(request.distance)||0),targetSpeed=positive(request.targetSpeed,.5),automatic=request.automatic!==false;
 const dynamics=automatic?recommendedMotionDynamics(distance,targetSpeed,request.rampShare):{acceleration:positive(request.acceleration,.8),deceleration:positive(request.deceleration,1)};
 const profile=motionProfileSummary(distance,{targetSpeed,...dynamics,motionProfile:'trapezoidal'});
 return{...request,distance,targetSpeed,...dynamics,profileType:profile.t2>1e-9?'trapezoidal':'triangular',peakSpeed:rounded(profile.peakSpeed),accelerationDistance:rounded(profile.s1),cruiseDistance:rounded(profile.s2),decelerationDistance:rounded(profile.s3),accelerationTime:rounded(profile.t1),cruiseTime:rounded(profile.t2),decelerationTime:rounded(profile.t3),totalTime:rounded(profile.total)};
}

const maximumLinearSpeedForRpm=({maxRpm,wheelRadiusM,gearRatio})=>positive(maxRpm,1500)/positive(gearRatio,12)*2*Math.PI*positive(wheelRadiusM,.08)/60;

export function loadedPayloadFor(item,unitPayloadKg=0){
 const p=item?.parameters||{},count=['conveyor','sorter','processLine'].includes(item?.type)?Math.max(1,Math.floor(Number(p.capacity)||1)):1;
 return{unitPayloadKg:Math.max(0,Number(unitPayloadKg)||0),loadCount:count,payloadKg:Math.max(0,Number(unitPayloadKg)||0)*count};
}

export function solveFlatDriveMotion(request,{payloadKg=0,movingMassKg=80,drive={},candidates=standardMotorCandidates}={}){
 const defaults=equipmentDriveDefaults[request.equipmentType]||equipmentDriveDefaults.conveyor,settings={...defaults,...drive},requestedSpeed=positive(request.targetSpeed,.5),mechanicalMaxSpeed=positive(settings.mechanicalMaxSpeed,defaults.mechanicalMaxSpeed),rpmMaxSpeed=Math.max(...candidates.map(motor=>maximumLinearSpeedForRpm({maxRpm:motor.maxRpm,wheelRadiusM:settings.wheelRadiusM,gearRatio:settings.gearRatio}))),appliedSpeed=Math.min(requestedSpeed,mechanicalMaxSpeed,rpmMaxSpeed),accelerationLimit=positive(settings.accelerationLimit,defaults.accelerationLimit),decelerationLimit=positive(settings.decelerationLimit,defaults.decelerationLimit);
 let selection=null;
 for(const motor of candidates){const requirements=driveRequirements({payloadKg,movingMassKg,acceleration:accelerationLimit,targetSpeed:appliedSpeed,...settings});if(motor.powerKw+1e-9>=requirements.powerKw&&motor.ratedTorqueNm+1e-9>=requirements.motorTorqueNm&&motor.maxRpm+1e-9>=requirements.motorRpm){selection={status:'selected',motor,requirements};break;}}
 if(!selection){const motor=candidates.at(-1),mass=Math.max(1,payloadKg+movingMassKg),g=9.80665,resistance=mass*g*Math.max(0,Number(settings.rollingResistance)||0),availableForce=motor.ratedTorqueNm*positive(settings.gearRatio,12)*Math.max(.05,Number(settings.efficiency)||.85)/(positive(settings.wheelRadiusM,.08)*Math.max(1,Number(settings.serviceFactor)||1.25)),torqueAcceleration=Math.max(.05,(availableForce-resistance)/mass),powerForce=motor.powerKw*1000*Math.max(.05,Number(settings.efficiency)||.85)/(Math.max(.01,appliedSpeed)*Math.max(1,Number(settings.serviceFactor)||1.25)),powerAcceleration=Math.max(.05,(powerForce-resistance)/mass),acceleration=Math.min(accelerationLimit,torqueAcceleration,powerAcceleration),motion=solveMotionRequest({...request,targetSpeed:appliedSpeed,automatic:false,acceleration,deceleration:Math.min(decelerationLimit,acceleration)}),requirements=driveRequirements({payloadKg,movingMassKg,acceleration:motion.acceleration,targetSpeed:motion.peakSpeed,...settings});return{...motion,requestedSpeed,appliedSpeed,speedLimited:appliedSpeed<requestedSpeed-1e-9,limitReasons:flatDriveLimitReasons(requestedSpeed,appliedSpeed,mechanicalMaxSpeed,rpmMaxSpeed),payloadKg,movingMassKg,massKg:payloadKg+movingMassKg,motorSelection:{status:'limited',motor,requirements},driveAssumptions:settings};}
 const motion=solveMotionRequest({...request,targetSpeed:appliedSpeed,automatic:false,acceleration:accelerationLimit,deceleration:decelerationLimit});
 return{...motion,requestedSpeed,appliedSpeed,speedLimited:appliedSpeed<requestedSpeed-1e-9,limitReasons:flatDriveLimitReasons(requestedSpeed,appliedSpeed,mechanicalMaxSpeed,rpmMaxSpeed),payloadKg,movingMassKg,massKg:payloadKg+movingMassKg,motorSelection:selection,driveAssumptions:settings};
}

function flatDriveLimitReasons(requested,applied,mechanical,rpm){const reasons=[];if(requested>mechanical+1e-9)reasons.push(`설비 최고속도 ${mechanical.toFixed(2)}m/s`);if(requested>rpm+1e-9)reasons.push(`모터 RPM·감속비 한계 ${rpm.toFixed(2)}m/s`);if(applied>=requested-1e-9)reasons.push('제한 없음');return reasons;}

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

const request=(item,model,distance,targetSpeed,accelerationKey='acceleration',decelerationKey='deceleration',extra={})=>({equipmentId:item.id,equipmentType:item.type,model,distance,targetSpeed,automatic:item.parameters?.autoMotionTuning!==0,acceleration:item.parameters?.[accelerationKey],deceleration:item.parameters?.[decelerationKey],accelerationKey,decelerationKey,...extra});

export function motionRequestsFor(item,{cargoLengthM=1.2}={}){
 const p=item.parameters||{},cargo=Math.max(.01,Number(cargoLengthM)||1.2),requests=[];
 if(['conveyor','sorter'].includes(item.type))requests.push(request(item,'linear',Number(p.length)||5,Number(p.speed)||.5));
 else if(item.type==='processLine')requests.push(request(item,'linear',Number(p.pitch)||5,(Number(p.lineSpeed)||20)/60));
 else if(['agv','amr','shuttle'].includes(item.type)){requests.push(request(item,'receive',cargo,Number(p.receiveSpeed)||.4));requests.push(request(item,item.type==='shuttle'?'linear-travel':'drive',Number(p.shuttleDistance)||5,Number(p.travelSpeed)||1));requests.push(request(item,'transfer',cargo,Number(p.transferSpeed)||.4));}
 else if(item.type==='forklift'){requests.push(request(item,'loaded-forward',Number(p.travelDistance)||5,Number(p.speed)||1.5));requests.push(request(item,'empty-return',Number(p.travelDistance)||5,Number(p.returnSpeed)||Number(p.speed)||1.5));}
 else if(item.type==='forkingDevice'){const stroke=Number(p.strokeDistance)||1.5;requests.push(request(item,'loaded-forward',stroke,Number(p.receiveSpeed)||.5));requests.push(request(item,'empty-return',stroke,Number(p.transferSpeed)||.5));}
 else if(item.type==='lift'){const height=Number(p.liftHeight)||3;requests.push(request(item,'up-with-gravity',height,Number(p.liftSpeed)||.5,'acceleration','deceleration',{inclineDeg:90}));requests.push(request(item,'down-with-gravity',height,Number(p.downSpeed)||Number(p.liftSpeed)||.5,'acceleration','deceleration',{inclineDeg:-90}));}
 else if(['asrs','stackerCrane'].includes(item.type)){const horizontal=Math.max(.1,(Math.max(1,Number(p.columns)||1)-1)*(Number(p.columnPitch)||1.5)),vertical=Math.max(.1,(Math.max(1,Number(p.levels)||1)-1)*(Number(p.levelHeight)||1.5)),fork=Math.max(.01,Number(p.forkStroke)||.94);requests.push(request(item,'x-travel',horizontal,Number(p.travelSpeed)||2.5,'travelAcceleration','travelDeceleration'));requests.push(request(item,'z-up-with-gravity',vertical,Number(p.liftSpeed)||1,'liftAcceleration','liftDeceleration',{inclineDeg:90}));requests.push(request(item,'z-down-with-gravity',vertical,Number(p.downSpeed)||Number(p.liftSpeed)||1,'liftAcceleration','liftDeceleration',{inclineDeg:-90}));requests.push(request(item,'fork-loaded',fork,Number(p.forkSpeed)||.65,'forkAcceleration','forkDeceleration'));requests.push(request(item,'fork-empty',fork,Number(p.forkSpeed)||.65,'forkAcceleration','forkDeceleration'));}
 else if(item.type==='turntable'||item.equipmentRole==='turnConveyor'){const angle=Math.max(Math.PI/180,Math.abs(Number(p.rotationAngleDeg)||90)*Math.PI/180),duration=Math.max(.1,Number(p.rotationTime)||6),speed=1.5*angle/duration;if(item.equipmentRole==='turnConveyor')requests.push(request(item,'transfer',Number(p.length)||cargo,Number(p.speed)||.5));requests.push(request(item,'rotary',angle,speed,'rotationAcceleration','rotationDeceleration',{units:'rad'}));}
 else if(item.equipmentRole==='pneumatic'){const stroke=Math.max(.001,Number(p.strokeDistance)||.2),speed=Math.max(.01,Number(p.speed)||.2);requests.push(request(item,'extend',stroke,speed));requests.push(request(item,'retract',stroke,Number(p.returnSpeed)||speed));}
 return requests;
}

export function engineeringPreview(item,{payloadKg=0,movingMassKg,drive={}}={}){
 const defaults=equipmentDriveDefaults[item.type],effectiveMovingMass=Math.max(0,Number(movingMassKg??item.parameters?.movingMassKg??defaults?.movingMassKg??100)||0),requests=motionRequestsFor(item,drive),flatDrive=Boolean(defaults)&&item.parameters?.autoMotionTuning!==0,motions=requests.map(axis=>flatDrive?solveFlatDriveMotion(axis,{payloadKg,movingMassKg:effectiveMovingMass,drive}):solveMotionRequest(axis));if(!motions.length)return{equipmentId:item.id,motionModels:motionModelsFor(item),motions:[],motorSelection:null,changes:[]};
 if(flatDrive){const critical=motions.reduce((worst,current)=>(current.motorSelection?.requirements?.powerKw||0)>(worst.motorSelection?.requirements?.powerKw||0)?current:worst),changes=[];for(const motion of motions)for(const [key,valueKey] of [[motion.accelerationKey,'acceleration'],[motion.decelerationKey,'deceleration']]){const before=Number(item.parameters?.[key]),after=motion[valueKey];if(Number.isFinite(before)&&Math.abs(before-after)>1e-9&&!changes.some(log=>log.parameter===key))changes.push(engineeringChangeLog({equipmentId:item.id,parameter:key,before,after,cause:`${motion.model} 만재질량·운전저항·구동계 한계`,impact:`실제 최고속도 ${motion.peakSpeed.toFixed(3)}m/s · CT ${motion.totalTime.toFixed(3)}s`}));}return{equipmentId:item.id,motionModels:motionModelsFor(item),motions,motorSelection:critical.motorSelection,changes,payloadKg,movingMassKg:effectiveMovingMass};}
 const requirements=motions.map(motion=>({model:motion.model,...driveRequirements({payloadKg,movingMassKg:effectiveMovingMass,acceleration:motion.acceleration,targetSpeed:motion.peakSpeed,inclineDeg:motion.inclineDeg,...drive})})),critical=requirements.reduce((worst,current)=>current.powerKw>worst.powerKw?current:worst),motorSelection=selectStandardMotor(critical),changes=[];
 for(const motion of motions)for(const [key,valueKey] of [[motion.accelerationKey,'acceleration'],[motion.decelerationKey,'deceleration']]){const before=Number(item.parameters?.[key]),after=motion[valueKey];if(Number.isFinite(before)&&Math.abs(before-after)>1e-9&&!changes.some(log=>log.parameter===key))changes.push(engineeringChangeLog({equipmentId:item.id,parameter:key,before,after,cause:`${motion.model} 실제 이동거리와 목표속도에 필요한 가감속 프로파일`,impact:`${motion.profileType} · CT ${motion.totalTime.toFixed(3)}s`}));}
 return{equipmentId:item.id,motionModels:motionModelsFor(item),motions,motorSelection:{...motorSelection,axisRequirements:requirements},changes,payloadKg,movingMassKg:effectiveMovingMass};
}
