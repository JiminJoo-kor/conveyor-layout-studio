import {compareEngineeringDuration} from './engineering-compatibility.js';
import {equipmentOperatingStatus} from './equipment-status.js';

const escapeSelector=value=>globalThis.CSS?.escape?CSS.escape(value):String(value).replace(/[^a-zA-Z0-9_-]/g,'\\$&');

export function equipmentFlowSummary(layout,item,state={}){
 const edges=layout?.cadSchematic?.edges||[],equipment=new Map((layout?.equipment||[]).map(entry=>[entry.id,entry])),name=id=>equipment.get(id)?.name||id;
 const upstream=[...new Set(edges.filter(edge=>edge.to===item?.id).map(edge=>name(edge.from)))],downstream=[...new Set(edges.filter(edge=>edge.from===item?.id).map(edge=>name(edge.to)))];
 const cargo=(state?.cadTokens||[]).filter(token=>token.nodeId===item?.id||token.edge?.to===item?.id&&token.asrsInfeedAcceptedAt!=null),waits=cargo.map(token=>token.diverterWaitReason||token.waitDiagnostic?.reason).filter(Boolean),status=equipmentOperatingStatus(item,state);
 const fault=state?.equipmentReliability?.[item?.id]?.available===false?'설비 고장/비가동':null,blockReason=fault||waits[0]||null;
 return{status:status.key,statusLabel:status.label,statusColor:status.color,upstream,downstream,cargoCount:cargo.length,cargoIds:cargo.slice(0,3).map(token=>token.id),blockReason};
}

export function updateEquipmentInspectorRuntime(root,items,layout,state={}){
 for(const item of items){
  const card=root.querySelector(`[data-parameter-card="${escapeSelector(item.id)}"]`),panel=card?.querySelector('[data-equipment-flow-summary]');if(!panel)continue;
  const summary=equipmentFlowSummary(layout,item,state),status=panel.querySelector('[data-flow-status]'),cargo=panel.querySelector('[data-flow-cargo]'),upstream=panel.querySelector('[data-flow-upstream]'),downstream=panel.querySelector('[data-flow-downstream]'),reason=panel.querySelector('[data-flow-block-reason]');
  status.textContent=summary.statusLabel;status.dataset.status=summary.status;status.style.color=summary.statusColor;
  cargo.textContent=summary.cargoCount?`${summary.cargoCount}개${summary.cargoIds.length?` · #${summary.cargoIds.join(', #')}`:''}`:'없음';
  upstream.textContent=summary.upstream.join(', ')||'연결 없음';downstream.textContent=summary.downstream.join(', ')||'연결 없음';
  reason.textContent=summary.blockReason||'없음';reason.closest('div')?.classList.toggle('active',Boolean(summary.blockReason));
 }
}

export function arrangeEquipmentInspector(root,items,layout,state={}){
 const basicKeys=new Set(['length','rows','columns','levels','productTypes','capacity','truckCapacity','positions','directions','operators']),logisticsKeys=new Set(['safetyGap','loadCapacity','pitch','bufferCapacity','columnPitch','levelHeight','infeedColumn','infeedLevel','outfeedColumn','outfeedLevel']);
 const section=(title,key,open=false)=>{const node=document.createElement('details');node.className='inspector-section';node.dataset.inspectorSection=key;node.open=open;const heading=document.createElement('summary'),label=document.createElement('span'),count=document.createElement('small');label.textContent=title;count.dataset.inspectorCount='';heading.append(label,count);node.append(heading);return node;};
 const fillEmpty=(node,text='해당 항목 없음')=>{if(node.children.length>1)return;const empty=document.createElement('p');empty.className='inspector-empty';empty.textContent=text;node.append(empty);};
 const updateCount=node=>{const count=node.querySelector('[data-inspector-count]'),items=[...node.children].filter(child=>child.tagName!=='SUMMARY'&&!child.classList.contains('inspector-empty'));if(count)count.textContent=items.length?`${items.length}개`:'';};
 for(const item of items){
  const card=root.querySelector(`[data-parameter-card="${escapeSelector(item.id)}"]`);if(!card)continue;
  const auto=card.querySelector('.auto-engineering-panel'),compatibility=compareEngineeringDuration(item,layout),motor=auto?.querySelector('.engineering-kpis div:first-child b')?.textContent||'해당 없음',cycle=compatibility.engineeringSeconds??compatibility.legacySeconds??0,status={compatible:'● 정상 · 계산 일치',approved:'● 승인 motion 적용',review:'● 검토 필요 · 기존 SIM',unsupported:'● 운동 계산 제외'}[compatibility.status]||'● 설정 준비',core=document.createElement('section');
  core.className=`equipment-core-summary ${compatibility.status}`;core.dataset.inspectorSection='summary';core.innerHTML=`<div><small>설비명 / 상태</small><strong>${item.name}</strong><span>${status}</span></div><div><small>핵심 결과</small><b>Motor ${motor}</b><b>Cycle ${Number(cycle).toFixed(2)}s</b></div><section class="equipment-flow-summary" data-equipment-flow-summary><div><small>운전 상태</small><b data-flow-status>-</b></div><div><small>현재 물류</small><b data-flow-cargo>-</b></div><div><small>상류</small><b data-flow-upstream>-</b></div><div><small>하류</small><b data-flow-downstream>-</b></div><div class="flow-block-reason"><small>막힘 원인</small><b data-flow-block-reason>-</b></div></section>`;
  const basic=section('① 기본 설정 · INPUT','basic',true),logistics=section('② 물류 / 기구 조건','logistics',true),motion=section('③ MOTION','motion'),engineering=section('④ AUTO ENGINEERING','auto-engineering'),flow=section('⑤ Flow / Connection','flow-connection'),detail=document.createElement('details');detail.className='engineering-detail';detail.dataset.inspectorSection='engineering-detail';detail.innerHTML='<summary>⑥ Engineering Detail</summary>';
  for(const input of card.querySelectorAll('[data-equipment-id][data-parameter][data-parameter-kind="INPUT"]')){const label=input.closest('label'),key=input.dataset.parameter;if(!label)continue;if(basicKeys.has(key))basic.append(label);else if(logisticsKeys.has(key))logistics.append(label);}
  const directLabels=[...card.children].filter(node=>node.tagName==='LABEL'&&!node.querySelector('[data-parameter-kind]:not([data-parameter-kind="INPUT"])'));for(const label of directLabels){const key=label.querySelector('[data-parameter]')?.dataset.parameter;(logisticsKeys.has(key)?logistics:basic).append(label);}
  const groups=[...card.querySelectorAll(':scope > .parameter-option-group, :scope > .fork-flow-selector, :scope > .diverter-controls')];for(const group of groups){const text=group.textContent;if(text.includes('구동 속도 프로파일'))motion.append(group);else if(/인계|연결|분배|배출|디버터|스테이션|Interface|Connection/.test(text))flow.append(group);else logistics.append(group);}
  if(auto)engineering.append(auto);
  const assigned=new Set([card.querySelector(':scope > summary'),core,basic,logistics,motion,engineering,flow]);for(const child of [...card.children])if(!assigned.has(child)&&child.tagName!=='SUMMARY')detail.append(child);
  fillEmpty(basic);fillEmpty(logistics);fillEmpty(motion,'이 설비는 별도 motion 입력이 없습니다.');fillEmpty(engineering,'계산 가능한 구동축이 없습니다.');fillEmpty(flow,'추가 Flow / Connection 설정이 없습니다.');
  for(const node of [basic,logistics,motion,engineering,flow])updateCount(node);
  const layoutGrid=document.createElement('div');layoutGrid.className='equipment-parameter-layout';layoutGrid.append(core,basic,logistics,motion,engineering,flow,detail);card.append(layoutGrid);
 }
 updateEquipmentInspectorRuntime(root,items,layout,state);
}
