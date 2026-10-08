const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

export function motionPresentation({calculated=null,config={},summary={}}={}){
 const requestedSpeed=number(calculated?.requestedSpeed,number(config.targetSpeed));
 const appliedSpeed=number(calculated?.appliedSpeed,number(config.targetSpeed));
 const peakSpeed=number(summary.peakSpeed);
 const cruiseTime=number(summary.cruiseTime,number(summary.t2));
 const profileType=calculated?.profileType||(cruiseTime>1e-9?'trapezoidal':'triangular');
 return{
  requestedSpeed,
  appliedSpeed,
  acceleration:number(calculated?.acceleration,number(config.acceleration)),
  deceleration:number(calculated?.deceleration,number(config.deceleration)),
  peakSpeed,
  totalTime:number(summary.totalTime,number(summary.total)),
  reachesTarget:Math.abs(peakSpeed-appliedSpeed)<=.001,
  profileType,
  profileLabel:profileType==='triangular'?'삼각형 · 거리 제한':'사다리꼴 · 정속구간 있음'
 };
}

export function motionSummaryMarkup(result,{automatic=false}={}){
 const cells=[
  ['INPUT','목표속도',`${result.requestedSpeed.toFixed(2)} m/s`],
  [automatic?'AUTO':'INPUT','적용속도',`${result.appliedSpeed.toFixed(2)} m/s`],
  [automatic?'AUTO':'INPUT','가속 / 감속',`${result.acceleration.toFixed(2)} / ${result.deceleration.toFixed(2)} m/s²`],
  ['RESULT','실제 최고',`${result.peakSpeed.toFixed(2)} m/s`],
  ['RESULT','프로파일',result.profileLabel],
  ['RESULT','총 이동시간',`${result.totalTime.toFixed(2)} s`]
 ];
 return `<div class="motion-result-summary">${cells.map(([kind,label,value])=>`<div><small>${kind}</small><span>${label}</span><b>${value}</b></div>`).join('')}</div>`;
}
