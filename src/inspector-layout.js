import {compareEngineeringDuration} from './engineering-compatibility.js';
import {equipmentOperatingStatus} from './equipment-status.js';
import {planConveyorDriveSections} from './drive-sections.js';

const escapeSelector=value=>globalThis.CSS?.escape?CSS.escape(value):String(value).replace(/[^a-zA-Z0-9_-]/g,'\\$&');
const equipmentLabels={conveyor:'ROLLER CONVEYOR',processLine:'PROCESS CONVEYOR',forkingDevice:'FORK UNIT',turntable:'TURNTABLE',lift:'LIFTER',amr:'AMR',agv:'AGV',asrs:'AS/RS',stackerCrane:'STACKER CRANE'};

export function equipmentInspectorSummary(item,layout,motor='해당 없음',cycle=0){
 if(item?.type==='conveyor'){
  const sections=planConveyorDriveSections(item,layout?.cargoSpec),length=Number(item.parameters?.length??item.length)||0;
  return{typeLabel:equipmentLabels[item.type],metrics:[{label:'전체 길이',value:`${length.toFixed(2)} m`},{label:'SECTION 수',value:String(sections.length)},{label:'DRIVE 수',value:String(sections.filter(section=>section.motorPowerKw!=null).length)}]};
 }
 if(['asrs','stackerCrane'].includes(item?.type)){
  const p=item.parameters||{},cells=Math.max(1,Number(p.rows)||1)*Math.max(1,Number(p.columns)||1)*Math.max(1,Number(p.levels)||1);
  return{typeLabel:equipmentLabels[item.type],metrics:[{label:'CELL 수',value:String(cells)},{label:'STACKER 수',value:String(Math.max(1,Number(p.stackerCount)||1))},{label:'명목 Cycle',value:`${Number(cycle).toFixed(2)}s`}]};
 }
 return{typeLabel:equipmentLabels[item?.type]||String(item?.type||'EQUIPMENT').replaceAll('_',' ').toUpperCase(),metrics:[{label:'Motor',value:motor},{label:'Cycle',value:`${Number(cycle).toFixed(2)}s`},{label:'현재 물류',value:'-',dynamic:'cargo'}]};
}

export function equipmentDriveRows(item,layout){
 if(item?.type!=='conveyor')return[];
 return planConveyorDriveSections(item,layout?.cargoSpec).map(section=>({name:section.name,lengthM:section.lengthM,payloadKg:section.payloadKg,motorPowerKw:section.motorPowerKw,status:section.status}));
}

export function equipmentFlowConnections(layout,item){
 const equipment=new Map((layout?.equipment||[]).map(entry=>[entry.id,entry])),owned=new Set([item?.id]);
 if(['asrs','stackerCrane'].includes(item?.type))for(const entry of equipment.values())if(entry.asrsStation?.parentId===item.id)owned.add(entry.id);
 const edges=(layout?.cadSchematic?.edges||[]).filter(edge=>!edge.asrsStationInternal),name=id=>equipment.get(id)?.name||id;
 const upstream=[...new Set(edges.filter(edge=>owned.has(edge.to)&&!owned.has(edge.from)).map(edge=>name(edge.from)))],downstream=[...new Set(edges.filter(edge=>owned.has(edge.from)&&!owned.has(edge.to)).map(edge=>name(edge.to)))];
 const interfaces=[...owned].slice(1).map(id=>equipment.get(id)).filter(Boolean).map(entry=>({id:entry.id,index:entry.asrsStation.index,kind:entry.asrsStation.kind,name:entry.name,connected:edges.some(edge=>edge.from===entry.id||edge.to===entry.id)}));
 return{upstream,downstream,interfaces,connectedInterfaces:interfaces.filter(entry=>entry.connected).length,totalInterfaces:interfaces.length};
}

export function equipmentFlowSummary(layout,item,state={}){
 const connections=equipmentFlowConnections(layout,item),owned=new Set([item?.id,...connections.interfaces.map(entry=>entry.id)]);
 const cargo=(state?.cadTokens||[]).filter(token=>owned.has(token.nodeId)||owned.has(token.edge?.to)&&token.asrsInfeedAcceptedAt!=null),waits=cargo.map(token=>token.diverterWaitReason||token.waitDiagnostic?.reason).filter(Boolean),status=equipmentOperatingStatus(item,state);
 const fault=state?.equipmentReliability?.[item?.id]?.available===false?'설비 고장/비가동':null,blockReason=fault||waits[0]||null;
 return{status:status.key,statusLabel:status.label,statusColor:status.color,...connections,cargoCount:cargo.length,cargoIds:cargo.slice(0,3).map(token=>token.id),blockReason};
}

export function updateEquipmentInspectorRuntime(root,items,layout,state={}){
 for(const item of items){
  const card=root.querySelector(`[data-parameter-card="${escapeSelector(item.id)}"]`),panel=card?.querySelector('[data-equipment-flow-summary]');if(!panel)continue;
  const summary=equipmentFlowSummary(layout,item,state),status=card.querySelector('[data-flow-status]'),cargo=card.querySelector('[data-flow-cargo]'),upstream=panel.querySelector('[data-flow-upstream]'),downstream=panel.querySelector('[data-flow-downstream]'),reason=panel.querySelector('[data-flow-block-reason]');
  status.textContent=summary.statusLabel;status.dataset.status=summary.status;status.style.color=summary.statusColor;
  if(cargo)cargo.textContent=summary.cargoCount?`${summary.cargoCount}개${summary.cargoIds.length?` · #${summary.cargoIds.join(', #')}`:''}`:'없음';
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
  const auto=card.querySelector('.auto-engineering-panel'),compatibility=compareEngineeringDuration(item,layout),motor=auto?.querySelector('.engineering-kpis div:first-child b')?.textContent||'해당 없음',cycle=compatibility.engineeringSeconds??compatibility.legacySeconds??0,summary=equipmentInspectorSummary(item,layout,motor,cycle),status={compatible:'● 정상 · 계산 일치',approved:'● 승인 motion 적용',review:'● 검토 필요 · 기존 SIM',unsupported:'● 운동 계산 제외'}[compatibility.status]||'● 설정 준비',core=document.createElement('section');
  core.className=`equipment-core-summary ${compatibility.status}`;core.dataset.inspectorSection='summary';core.innerHTML=`<header class="equipment-summary-title"><div><small>${summary.typeLabel}</small><strong>${item.name}</strong><span>${status}</span></div><b class="equipment-runtime-status" data-flow-status>-</b></header><section class="equipment-summary-kpis">${summary.metrics.map(metric=>`<div><small>${metric.label}</small><b${metric.dynamic==='cargo'?' data-flow-cargo':''}>${metric.value}</b></div>`).join('')}</section><section class="equipment-flow-summary" data-equipment-flow-summary><div><small>상류</small><b data-flow-upstream>-</b></div><div><small>하류</small><b data-flow-downstream>-</b></div><div class="flow-block-reason"><small>막힘 원인</small><b data-flow-block-reason>-</b></div></section>`;
  const basic=section('① 기본 설정 · INPUT','basic',true),logistics=section('② 물류 / 기구 조건','logistics',true),driveRows=equipmentDriveRows(item,layout),drive=driveRows.length?section('③ SECTION / DRIVE','section-drive',true):null,motion=section(`${drive?'④':'③'} MOTION`,'motion'),engineering=section(`${drive?'⑤':'④'} AUTO ENGINEERING`,'auto-engineering'),flow=section(`${drive?'⑥':'⑤'} Flow / Connection`,'flow-connection'),detail=document.createElement('details');detail.className='engineering-detail';detail.dataset.inspectorSection='engineering-detail';detail.innerHTML=`<summary>${drive?'⑦':'⑥'} Engineering Detail</summary>`;
  const connections=equipmentFlowConnections(layout,item),flowOverview=document.createElement('section');flowOverview.className='flow-connection-overview';flowOverview.innerHTML=`<div><small>UPSTREAM</small><b>${connections.upstream.join(', ')||'연결 없음'}</b></div><i>→</i><div><small>CURRENT</small><b>${item.name}</b></div><i>→</i><div><small>DOWNSTREAM</small><b>${connections.downstream.join(', ')||'연결 없음'}</b></div>${connections.totalInterfaces?`<p><span>INTERFACE</span><b>${connections.connectedInterfaces} / ${connections.totalInterfaces} 연결</b><small>Station Conveyor는 부모 AS/RS 설정에서 자동 생성</small></p>`:''}`;flow.append(flowOverview);
  if(drive){const wrap=document.createElement('div');wrap.className='table-wrap inspector-drive-table';wrap.innerHTML=`<table><thead><tr><th>구간</th><th>길이</th><th>만재</th><th>Motor</th><th>상태</th></tr></thead><tbody>${driveRows.map(row=>`<tr><td>${row.name}</td><td>${row.lengthM.toFixed(2)}m</td><td>${row.payloadKg.toFixed(0)}kg</td><td>${row.motorPowerKw==null?'-':row.motorPowerKw+'kW'}</td><td>${row.status}</td></tr>`).join('')}</tbody></table>`;drive.append(wrap);}
  for(const input of card.querySelectorAll('[data-equipment-id][data-parameter][data-parameter-kind="INPUT"]')){const label=input.closest('label'),key=input.dataset.parameter;if(!label)continue;if(basicKeys.has(key))basic.append(label);else if(logisticsKeys.has(key))logistics.append(label);}
  const directLabels=[...card.children].filter(node=>node.tagName==='LABEL'&&!node.querySelector('[data-parameter-kind]:not([data-parameter-kind="INPUT"])'));for(const label of directLabels){const key=label.querySelector('[data-parameter]')?.dataset.parameter;(logisticsKeys.has(key)?logistics:basic).append(label);}
  const groups=[...card.querySelectorAll(':scope > .parameter-option-group, :scope > .fork-flow-selector, :scope > .diverter-controls')];for(const group of groups){const text=group.textContent;if(text.includes('구동 속도 프로파일'))motion.append(group);else if(/인계|연결|분배|배출|디버터|스테이션|Interface|Connection/.test(text))flow.append(group);else logistics.append(group);}
  if(auto)engineering.append(auto);
  const assigned=new Set([card.querySelector(':scope > summary'),core,basic,logistics,drive,motion,engineering,flow]);for(const child of [...card.children])if(!assigned.has(child)&&child.tagName!=='SUMMARY')detail.append(child);
  fillEmpty(basic);fillEmpty(logistics);fillEmpty(motion,'이 설비는 별도 motion 입력이 없습니다.');fillEmpty(engineering,'계산 가능한 구동축이 없습니다.');fillEmpty(flow,'추가 Flow / Connection 설정이 없습니다.');
  for(const node of [basic,logistics,drive,motion,engineering,flow].filter(Boolean))updateCount(node);
  const layoutGrid=document.createElement('div');layoutGrid.className='equipment-parameter-layout';layoutGrid.append(core,basic,logistics,...(drive?[drive]:[]),motion,engineering,flow,detail);card.append(layoutGrid);
 }
 updateEquipmentInspectorRuntime(root,items,layout,state);
}
