export const ParameterKind=Object.freeze({INPUT:'INPUT',AUTO:'AUTO',RESULT:'RESULT',STATUS:'STATUS'});

const I=ParameterKind.INPUT,A=ParameterKind.AUTO,R=ParameterKind.RESULT,S=ParameterKind.STATUS;
const shared={
  acceleration:A,deceleration:A,travelAcceleration:A,travelDeceleration:A,liftAcceleration:A,liftDeceleration:A,forkAcceleration:A,forkDeceleration:A,
  jerk:A,performance:R,cellCount:R,availability:S,mtbf:I,mttr:I,microStopInterval:I,microStopDuration:I,
  autoMotionTuning:I,motionProfile:I,loadDerateStart:I,minimumLoadedSpeed:I
};
const input=(...keys)=>Object.fromEntries(keys.map(key=>[key,I]));

// This is an inventory of persisted engineering parameters, including controls
// rendered outside parameterFieldsFor. It deliberately does not rename keys so
// existing layout JSON remains backwards compatible.
export const equipmentParameterMaster=Object.freeze({
  source:{...input('injectionInterval','batchSize','cargoType','sourceLineName')},
  sink:{...input('dischargeTime','capacity')},
  dock:{...input('processTime','truckCapacity','departureTime','dockRole')},
  conveyor:{...input('length','speed','safetyGap','loadCapacity','continuousHandover','handoverDelay'),...shared},
  processLine:{...input('lineSpeed','pitch','bufferCapacity','safetyGap'),...shared},
  diverter:{...input('cycleTime','directions','diverterMainPort','diverterAutoDynamics','diverterStroke'),...shared},
  turntable:{...input('rotationTime','positions','loadCapacity'),...shared},
  handoffPoint:{...input('transferTime','bufferCapacity')},
  forklift:{...input('travelDistance','speed','loadTime','unloadTime','loadCapacity'),...shared},
  forkingDevice:{...input('strokeDistance','receiveSpeed','transferSpeed','holdTime','output1Ratio','loadCapacity','distributionEnabled','distributionFlowKeys'),...shared},
  stackerCrane:{...input('rows','columns','levels','productTypes','stackerCount','columnPitch','levelHeight','infeedColumn','infeedLevel','outfeedColumn','outfeedLevel','infeedTime','outfeedTime','travelSpeed','liftSpeed','downSpeed','forkStroke','forkSpeed','putawayTime','retrievalTime','retrievalCarryCount','modeChangeTime','simultaneousMotion','returnHome','loadCapacity','stationConveyorsEnabled','infeedBufferCount','outfeedBufferCount','stationConveyorSpeed','stationSafetyGap','batchReleaseEnabled','releaseBatchSize','infeedPortSide','outfeedPortSide'),...shared},
  asrs:{...input('rows','columns','levels','productTypes','stackerCount','columnPitch','levelHeight','infeedColumn','infeedLevel','outfeedColumn','outfeedLevel','infeedTime','outfeedTime','travelSpeed','liftSpeed','downSpeed','forkStroke','forkSpeed','putawayTime','retrievalTime','retrievalCarryCount','modeChangeTime','simultaneousMotion','returnHome','loadCapacity','stationConveyorsEnabled','infeedBufferCount','outfeedBufferCount','stationConveyorSpeed','stationSafetyGap','batchReleaseEnabled','releaseBatchSize','infeedPortSide','outfeedPortSide'),...shared},
  shuttle:{...input('shuttleDistance','receiveSpeed','travelSpeed','transferSpeed','loadCapacity'),...shared},
  agv:{...input('shuttleDistance','receiveSpeed','travelSpeed','transferSpeed','chargeThreshold','loadCapacity'),...shared},
  amr:{...input('shuttleDistance','receiveSpeed','travelSpeed','transferSpeed','chargeThreshold','cargoTransferRotationEnabled','cargoTransferAngle','loadCapacity'),...shared},
  sorter:{...input('length','speed','destinations','loadCapacity','safetyGap'),...shared},
  lift:{...input('liftHeight','liftSpeed','downSpeed','loadTime','unloadTime','levels','loadCapacity'),...shared},
  robot:{...input('pickTime','placeTime','loadCapacity')},
  station:{...input('processTime','operators')},
  buffer:{...input('capacity')}
});

export const pneumaticParameterMaster=Object.freeze({...input('strokeDistance','speed','returnSpeed','holdTime','pressureBar','frictionCoefficient','externalForceN','pneumaticEfficiency','pneumaticServiceFactor'),cylinderBoreMm:A,cylinderRodMm:R,requiredForceN:R,extendForceN:R,retractForceN:R,...shared});

export const equipmentMotionModels=Object.freeze({
  conveyor:['linear'],processLine:['linear'],sorter:['linear'],diverter:['linear-transfer'],
  forkingDevice:['loaded-forward','empty-return'],forklift:['loaded-forward','empty-return'],
  lift:['up-with-gravity','down-with-gravity'],turntable:['rotary'],
  shuttle:['transfer','linear-travel'],agv:['drive','turn','stop'],amr:['drive','turn','stop'],
  stackerCrane:['x-travel','z-lift-with-gravity','fork-loaded-empty'],asrs:['x-travel','z-lift-with-gravity','fork-loaded-empty'],
  handoffPoint:['transfer'],robot:['pick-place'],source:['release'],sink:['receive'],dock:['receive-release'],station:['process'],buffer:['queue']
});

export function parameterDefinition(type,key){
  const kind=equipmentParameterMaster[type]?.[key]??shared[key];
  return kind?{key,kind,editable:kind===I,source:kind===I?'user':'engineering'}:null;
}

export function parameterKindFor(item,key){return(item?.equipmentRole==='pneumatic'?pneumaticParameterMaster[key]:null)??parameterDefinition(item?.type,key)?.kind??I;}
export function motionModelsFor(item){if(item?.equipmentRole==='turnConveyor')return['transfer','rotary'];if(item?.equipmentRole==='pneumatic')return['extend','retract'];return equipmentMotionModels[item?.type]??[];}
