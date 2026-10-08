const rounded=value=>Number(value.toFixed(3));

// Design-reference reducer families. Project or manufacturer data can override this list.
export const standardGearboxCandidates=Object.freeze([
 {id:'GBX-10-150',ratio:10,ratedOutputTorqueNm:150,maxInputPowerKw:3.7,maxOutputRpm:180,efficiency:.92},
 {id:'GBX-15-250',ratio:15,ratedOutputTorqueNm:250,maxInputPowerKw:5.5,maxOutputRpm:130,efficiency:.91},
 {id:'GBX-20-400',ratio:20,ratedOutputTorqueNm:400,maxInputPowerKw:7.5,maxOutputRpm:100,efficiency:.9},
 {id:'GBX-25-650',ratio:25,ratedOutputTorqueNm:650,maxInputPowerKw:11,maxOutputRpm:80,efficiency:.89},
 {id:'GBX-30-900',ratio:30,ratedOutputTorqueNm:900,maxInputPowerKw:15,maxOutputRpm:65,efficiency:.88},
 {id:'GBX-40-1400',ratio:40,ratedOutputTorqueNm:1400,maxInputPowerKw:22,maxOutputRpm:50,efficiency:.87}
]);

export const conveyorMechanicalDefaults=Object.freeze({
 rollerPitchM:.15,rollerRatedLoadKg:180,minSupportingRollers:3,
 frameDistributedLoadKgM:500,framePointLoadKg:750,
 shaftRatedTorqueNm:900,tractionRatedForceN:9000,
 mechanicalServiceFactor:1.15,maxAutomaticSections:24
});

export function conveyorMechanicalSettings(parameters={},overrides={}){
 const source={...conveyorMechanicalDefaults,...parameters,...overrides},number=(key,min)=>Math.max(min,Number(source[key])||conveyorMechanicalDefaults[key]);
 return{rollerPitchM:number('rollerPitchM',.03),rollerRatedLoadKg:number('rollerRatedLoadKg',1),minSupportingRollers:Math.max(2,Math.floor(number('minSupportingRollers',2))),frameDistributedLoadKgM:number('frameDistributedLoadKgM',1),framePointLoadKg:number('framePointLoadKg',1),shaftRatedTorqueNm:number('shaftRatedTorqueNm',1),tractionRatedForceN:number('tractionRatedForceN',1),mechanicalServiceFactor:number('mechanicalServiceFactor',1),maxAutomaticSections:Math.max(1,Math.floor(number('maxAutomaticSections',1)))};
}

export function selectStandardGearbox({requiredOutputTorqueNm=0,inputPowerKw=0,motorRpm=0,serviceFactor=1.15}={},candidates=standardGearboxCandidates){
 const evaluated=candidates.map(candidate=>{const outputRpm=(Number(motorRpm)||0)/candidate.ratio,torqueDemand=(Number(requiredOutputTorqueNm)||0)*Math.max(1,Number(serviceFactor)||1);return{...candidate,outputRpm:rounded(outputRpm),torqueDemandNm:rounded(torqueDemand),torqueUtilizationPercent:rounded(torqueDemand/candidate.ratedOutputTorqueNm*100),powerUtilizationPercent:rounded((Number(inputPowerKw)||0)/candidate.maxInputPowerKw*100),passes:torqueDemand<=candidate.ratedOutputTorqueNm+1e-9&&(Number(inputPowerKw)||0)<=candidate.maxInputPowerKw+1e-9&&outputRpm<=candidate.maxOutputRpm+1e-9};});
 const gearbox=evaluated.find(candidate=>candidate.passes)||null;
 return{status:gearbox?'selected':'no-candidate',gearbox,evaluated};
}

export function checkConveyorMechanicalLimits({sectionLengthM,capacity,unitPayloadKg,cargoLengthM,movingMassKg,requirements,settings={}}){
 const limits=conveyorMechanicalSettings({},settings),payloadKg=Math.max(0,Number(capacity)||0)*Math.max(0,Number(unitPayloadKg)||0),supportingRollers=Math.max(limits.minSupportingRollers,Math.floor(Math.max(.01,Number(cargoLengthM)||1)/limits.rollerPitchM)+1),rollerLoadKg=Math.max(0,Number(unitPayloadKg)||0)/supportingRollers,distributedLoadKgM=(payloadKg+Math.max(0,Number(movingMassKg)||0))/Math.max(.1,Number(sectionLengthM)||.1),pointLoadKg=Math.max(0,Number(unitPayloadKg)||0),shaftTorqueNm=Math.max(0,Number(requirements?.outputTorqueNm)||0)*limits.mechanicalServiceFactor,tractionForceN=Math.max(0,Number(requirements?.forceN)||0)*limits.mechanicalServiceFactor;
 const checks=[
  {key:'roller',label:'롤러 허용하중',actual:rollerLoadKg,limit:limits.rollerRatedLoadKg,unit:'kg/roller',splittable:false},
  {key:'frame-distributed',label:'프레임 분포하중',actual:distributedLoadKgM,limit:limits.frameDistributedLoadKgM,unit:'kg/m',splittable:true},
  {key:'frame-point',label:'프레임 집중하중',actual:pointLoadKg,limit:limits.framePointLoadKg,unit:'kg',splittable:false},
  {key:'shaft',label:'구동축 토크',actual:shaftTorqueNm,limit:limits.shaftRatedTorqueNm,unit:'Nm',splittable:true},
  {key:'traction',label:'벨트/체인 견인력',actual:tractionForceN,limit:limits.tractionRatedForceN,unit:'N',splittable:true}
 ].map(check=>({...check,actual:rounded(check.actual),limit:rounded(check.limit),utilizationPercent:rounded(check.actual/check.limit*100),passes:check.actual<=check.limit+1e-9}));
 const failed=checks.filter(check=>!check.passes),worst=checks.reduce((a,b)=>b.utilizationPercent>a.utilizationPercent?b:a);
 return{status:failed.length?'review':'verified',verified:failed.length===0,payloadKg:rounded(payloadKg),supportingRollers,checks,failedKeys:failed.map(check=>check.key),unsplittable:failed.some(check=>!check.splittable),limitingFactor:worst.label,maxUtilizationPercent:worst.utilizationPercent};
}
