const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const fixed=(value,digits)=>finite(value).toFixed(digits);

export function engineeringPresentation({preview,load,compatibility}){
 const selection=preview?.motorSelection||{},motor=selection.motor,requirements=selection.requirements||{},verification=selection.verification;
 const selected=selection.status==='selected'&&Boolean(motor);
 return{
  selectionStatus:selected?'SELECTED':'REVIEW',
  selectionLabel:selected?'표준 모터 선정 완료':'표준 후보 범위 검토',
  motorId:motor?.id||'범위 초과',
  motorPowerKw:motor?.powerKw,
  torqueNm:finite(requirements.motorTorqueNm),
  motorRpm:finite(requirements.motorRpm),
  requiredPowerKw:finite(requirements.powerKw),
  maxPayloadKg:Number.isFinite(selection.maxPayloadKg)?selection.maxPayloadKg:null,
  loadUtilization:Number.isFinite(selection.loadUtilization)?selection.loadUtilization:null,
  limitingFactor:selection.limitingFactor||'계산 대기',
  verificationStatus:verification?.status||null,verificationResidual:Number.isFinite(verification?.maxResidualPercent)?verification.maxResidualPercent:null,verificationChecks:verification?.checks||[],verificationReasons:verification?.reasons||[],
  unitPayloadKg:finite(load?.unitPayloadKg),loadCount:finite(load?.loadCount),payloadKg:finite(load?.payloadKg),movingMassKg:finite(preview?.movingMassKg),
  motions:preview?.motions||[],changes:preview?.changes||[],compatibility
 };
}

export function engineeringPanelMarkup(view){
 const c=view.compatibility||{},compatibilityText=c.status==='unsupported'?'사이클 매핑 대기':`${c.scope} · 현재 ${fixed(c.legacySeconds,2)}s → 제안 ${fixed(c.engineeringSeconds,2)}s · Δ ${finite(c.deltaSeconds)>=0?'+':''}${fixed(c.deltaSeconds,2)}s`,compatibilityLabel={compatible:'COMPATIBLE · SIM 적용',approved:'APPROVED · SIM 적용',review:'REVIEW · 기존 SIM 유지',unsupported:'UNSUPPORTED'}[c.status]||'REVIEW';
 const capacity=view.maxPayloadKg==null?'':`<div class="engineering-subhead">적재 여유</div><div class="engineering-capacity"><div><small>현재 만재</small><b>${fixed(view.payloadKg,1)} kg</b></div><div><small>최대 구동 적재중량</small><b>${fixed(view.maxPayloadKg,1)} kg</b></div><div><small>구동계 사용률</small><b>${fixed(view.loadUtilization,1)}%</b><span>${view.limitingFactor} 기준</span></div></div>`,roundTrip=view.verificationStatus?`<div class="engineering-compatibility ${view.verificationStatus==='verified'?'compatible':'review'}" data-drive-verification="${view.verificationStatus}"><b>${view.verificationStatus==='verified'?'정·역산 검증 완료':'정·역산 검토 필요'}</b><span>${view.verificationStatus==='verified'?`최대 계산 잔차 ${fixed(view.verificationResidual,3)}%`:view.verificationReasons.join(' · ')}</span></div>`:'';
 return `<div class="auto-engineering-head"><strong>AUTO ENGINEERING</strong><span>RESULT · READ ONLY</span></div><div class="engineering-compatibility ${c.status||'review'}" data-engineering-compatibility="${c.status||'review'}"><b>${compatibilityLabel}</b><span>${compatibilityText}</span></div>${roundTrip}<div class="engineering-selection ${view.selectionStatus.toLowerCase()}"><span>${view.selectionStatus}</span><div><small>${view.selectionLabel}</small><strong>${view.motorId}</strong></div><b>${view.motorPowerKw==null?'후보 없음':`${view.motorPowerKw} kW`}</b></div><div class="engineering-subhead">선정 요구조건</div><div class="engineering-kpis"><div><small>Motor</small><b>${view.motorPowerKw==null?'후보 없음':`${view.motorPowerKw} kW`}</b></div><div><small>Required Torque</small><b>${fixed(view.torqueNm,2)} Nm</b></div><div><small>Required RPM</small><b>${fixed(view.motorRpm,0)}</b></div><div><small>Required Power</small><b>${fixed(view.requiredPowerKw,3)} kW</b></div></div>${capacity}<details class="engineering-assumptions"><summary>계산 조건</summary><p>단위 물류 ${fixed(view.unitPayloadKg,1)}kg × ${view.loadCount}개 · 만재 ${fixed(view.payloadKg,1)}kg · 설비 등가질량 ${fixed(view.movingMassKg,1)}kg · 표준 후보 ${view.motorId}</p>${view.verificationChecks.length?`<p>${view.verificationChecks.map(check=>`${check.label} ${fixed(check.residualPercent,3)}%`).join(' · ')}</p>`:''}</details><div class="engineering-axis-list">${view.motions.map(motion=>`<div><strong>${motion.model}</strong><span>요청 ${fixed(motion.requestedSpeed??motion.targetSpeed,2)} · 적용 ${fixed(motion.appliedSpeed??motion.targetSpeed,2)} · 실제 최고 ${fixed(motion.peakSpeed,2)} · 목표 ${Math.abs(finite(motion.peakSpeed)-finite(motion.appliedSpeed??motion.targetSpeed))<=.001?'도달':'미도달'} · CT ${fixed(motion.totalTime,2)}s${motion.limitReasons?.length&&!motion.limitReasons.includes('제한 없음')?` · ${motion.limitReasons.join(' / ')}`:''}</span></div>`).join('')}</div>${view.changes.length?`<details class="engineering-change-log"><summary>자동 변경 근거 ${view.changes.length}건</summary>${view.changes.map(log=>`<p><b>원인</b> ${log.cause}<br><b>조치</b> ${log.action}<br><b>영향</b> ${log.impact}</p>`).join('')}</details>`:'<p class="engineering-no-change">현재 AUTO 값과 계산 결과가 일치합니다.</p>'}`;
}
