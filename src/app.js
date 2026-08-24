import { cloneLayout, defaultLayout, validateLayout } from './layout.js';
import { CadFlowEngine, defaultParams, SimulationEngine, validateParams } from './engine.js';
import { LayoutRenderer } from './renderer.js';
import { LayoutEditor } from './editor.js';
import { analyzeCadFile, parameterFieldsFor } from './cad.js';
import { buildSimulationReport } from './report.js';

const $ = id => document.getElementById(id);
let layout = cloneLayout(defaultLayout), engine = new SimulationEngine(layout, defaultParams);
let renderer = new LayoutRenderer($('layoutCanvas'), layout), running = false, frame = null, last = 0;
let selectedEquipment = null;
let pendingCadCandidates = [];
const editor = new LayoutEditor($('layoutCanvas'), renderer, () => layout, editorChanged, selectEquipment);
const cadParameterSection=document.createElement('section');cadParameterSection.id='cadEquipmentParameters';cadParameterSection.className='cad-parameter-section';cadParameterSection.hidden=true;
$('dynamicEquipmentControls').append(cadParameterSection);

const inputKeys = ['injectA','injectB','injectC','conv2Speed','conv1Speed','pickTime','placeTime','station15Time','station16Time','forklift17Time','forklift211Time','simDuration'];
function readParams() {
  return { useA:$('useA').checked, useB:$('useB').checked, ...Object.fromEntries(inputKeys.map(key=>[key,Number($(key).value)])) };
}
function resetEngine() {
  const params=readParams(), check=validateParams(params);
  $('validation').textContent=check.errors.join(' ');
  if(!check.valid) return false;
  engine=layout.displayMode==='cad'&&layout.equipment.some(item=>item.source?.origin==='dxf')?new CadFlowEngine(layout,params):new SimulationEngine(layout,params); renderer.draw(engine.state); updateDashboard(); renderEvents(); return true;
}
function editorChanged(rebuild) {
  if (rebuild) renderer.setLayout(layout);
  renderer.draw(engine.state);
}
function selectEquipment(item) {
  selectedEquipment=item;
  for(const id of ['propName','propX','propY']) $(id).disabled=!item;
  $('deleteEquipment').disabled=!item||!item.id.includes('-custom-');
  $('propName').value=item?.name||'';$('propX').value=item?.x??'';$('propY').value=item?.y??'';
}
function updateDashboard() {
  const k=engine.getKpis(), names={robot:'로봇',station15:'1-5',station16:'1-6',forklift17:'1-7 지게차',forklift211:'2-11 지게차'};
  $('simTime').textContent=format(engine.state.t); $('throughput').textContent=k.throughput.toFixed(1)+'/h';
  $('throughputLabel').textContent=k.mode==='cad'?'UPH':'1-7 처리량';$('secondaryKpiLabel').textContent=k.mode==='cad'?'평균 CT':'로봇 가동률';$('robotUtil').textContent=k.mode==='cad'?k.cycleTime.toFixed(1)+'초':(k.utilization.robot*100).toFixed(1)+'%'; $('wip').textContent=k.wip;
  $('bottleneck').textContent=k.bottleneck?`${names[k.bottleneck[0]]} ${(k.bottleneck[1]*100).toFixed(0)}%`:'-';
  $('moved').textContent=k.movedItems; $('completed').textContent=engine.state.completedProducts.length;
  renderSimulationReport();
}
function renderSimulationReport(){const panel=$('simulationReport');if(layout.displayMode!=='cad'||!layout.equipment.some(item=>item.source?.origin==='dxf')){panel.hidden=true;return;}panel.hidden=false;const report=buildSimulationReport(layout,engine),asrs=report.kpis.asrs;$('reportContent').innerHTML=`<div class="report-grid"><section class="report-block"><h3>1. 🛠️ Layout Corrections</h3><ul>${report.corrections.map(item=>`<li>[${item.kind}] ${item.detail} · ${item.status}</li>`).join('')}</ul></section><section class="report-block"><h3>2. 📐 Corrected Flow & Topology</h3><ul>${report.topology.map(item=>`<li>${item}</li>`).join('')}</ul></section><section class="report-block wide"><h3>3. ⏱️ 공정별 CT 및 병목</h3><div class="table-wrap"><table><thead><tr><th>공정명</th><th>거리(m)</th><th>이동(sec)</th><th>작업(sec)</th><th>공정 CT</th><th>병목</th></tr></thead><tbody>${report.rows.map(row=>`<tr><td>${row.process}</td><td>${row.distance.toFixed(1)}</td><td>${row.move.toFixed(1)}</td><td>${row.work.toFixed(1)}</td><td>${row.ct.toFixed(1)}</td><td>${row.bottleneck?'병목':'-'}</td></tr>`).join('')}</tbody></table></div></section><section class="report-block wide"><h3>4. 📊 UPH 및 생산성 예측</h3><div class="report-metrics"><div>Target UPH<strong>${report.targetUph.toFixed(1)}</strong></div><div>Realizable UPH<strong>${report.realizableUph.toFixed(1)}</strong></div><div>8시간 물동량<strong>${Math.floor(report.eightHours)}</strong></div><div>12시간 물동량<strong>${Math.floor(report.twelveHours)}</strong></div>${asrs?`<div>AS/RS 재고<strong>${asrs.inventory}/${asrs.capacity}</strong></div><div>AS/RS 가동률<strong>${(report.kpis.utilization.asrs*100).toFixed(1)}%</strong></div>`:''}</div></section></div>`;}
function loop(now) {
  if(!running) return; if(!last) last=now;
  const simDt=Math.min((now-last)/1000*Number($('playback').value),2); last=now;
  const steps=Math.max(1,Math.ceil(simDt/.05)); for(let i=0;i<steps;i++) engine.step(simDt/steps);
  renderer.draw(engine.state); updateDashboard();
  if(engine.state.t>=engine.params.simDuration){running=false;$('runBtn').textContent='완료';renderEvents();return;}
  frame=requestAnimationFrame(loop);
}
function toggleRun() {
  if(engine.state.t===0&&!resetEngine()) return;
  running=!running; $('runBtn').textContent=running?'일시정지':'재개'; last=0;
  if(running) frame=requestAnimationFrame(loop); else {cancelAnimationFrame(frame);renderEvents();}
}
function renderEvents() {
  const rows=engine.state.events.slice(-12).reverse();
  $('eventRows').innerHTML=rows.length?rows.map(e=>`<tr><td>${format(e.t)}</td><td>${eventLabel(e.type)}</td><td>${e.equipmentId||e.kind||''}</td><td>#${e.trayId||e.productId||'-'}</td></tr>`).join(''):'<tr><td colspan="4">아직 이벤트가 없습니다.</td></tr>';
}
function eventLabel(type){return ({'source-injected':'소스 투입','product-injected':'C 투입','robot-pick-start':'PICK 시작','robot-place-complete':'PLACE 완료','equipment-start':'설비 작업 시작','equipment-complete':'설비 작업 완료','asrs-putaway':'AS/RS 적치','asrs-retrieval':'AS/RS 반출'})[type]||type;}
function format(s){const m=Math.floor(s/60),sec=Math.floor(s%60);return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;}
function download(name,text,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href);}

$('runBtn').addEventListener('click',toggleRun);
$('resetBtn').addEventListener('click',()=>{running=false;cancelAnimationFrame(frame);resetEngine();$('runBtn').textContent='시뮬레이션 시작';});
$('exportLayout').addEventListener('click',()=>download('conveyor-layout.json',JSON.stringify(layout,null,2)));
$('editorToggle').addEventListener('click',()=>{const active=$('editorTools').hidden;$('editorTools').hidden=!active;editor.setEnabled(active);$('editorToggle').textContent=active?'편집 종료':'편집 모드';});
$('viewFit').addEventListener('click',()=>editor.resetView());
$('cadViewToggle').addEventListener('click',()=>{if(layout.displayMode!=='cad')return;const order=['hybrid','schematic','raw'],labels={hybrid:'혼합 보기',schematic:'약식 보기',raw:'CAD 보기'},next=order[(order.indexOf(layout.cadViewMode)+1)%order.length];layout.cadViewMode=next;for(const item of layout.equipment.filter(entry=>entry.source?.origin==='dxf')){const position=next==='schematic'?item.normalizedPosition:item.originalPosition;if(position){item.x=position.x;item.y=position.y;}}$('cadViewToggle').textContent=labels[next];renderer.setLayout(layout);editor.resetView();renderer.draw(engine.state);});
$('drawingFile').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;const dataUrl=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file);});layout.background={name:file.name,dataUrl};await renderer.setBackground(dataUrl);renderer.draw(engine.state);event.target.value='';});
$('cadFile').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;const panel=$('cadStatus');panel.hidden=false;$('cadStatusTitle').textContent='DXF 로컬 분석 중';$('cadStatusText').textContent=`${file.name}의 좌표, 레이어, 블록과 문자를 브라우저에서 읽고 있습니다.`;$('cadCandidates').innerHTML='';
  try{
    const result=await analyzeCadFile(file),candidates=result.candidates.filter(item=>item.type!=='unknown');
    layout.cadSource={fileName:file.name,analyzedAt:new Date().toISOString(),units:result.document.units||'unknown',importId:candidates[0]?.source?.importId};
    layout.dxfGeometry=result.document.canvasGeometry;layout.cadSchematic=result.schematic;layout.cadViewMode='hybrid';layout.canvas.height=result.document.canvasHeight;layout.displayMode='cad';layout.equipment=layout.equipment.filter(item=>item.source?.origin!=='dxf');for(const item of candidates)if(item.originalPosition){item.x=item.originalPosition.x;item.y=item.originalPosition.y;}$('cadViewToggle').textContent='혼합 보기';
    renderer.setLayout(layout);renderer.draw(engine.state);pendingCadCandidates=candidates;$('cadStatusTitle').textContent='DXF 분석 완료';$('cadStatusText').textContent=`원본 라인 ${layout.dxfGeometry.length}개와 설비 후보 ${candidates.length}개를 찾았습니다. 라인워크 위에 승인 설비가 배치됩니다.`;renderCadCandidates();renderCadEquipmentParameters();
  }catch(error){$('cadStatusTitle').textContent='DXF 분석 실패';$('cadStatusText').textContent=error.message;}
  finally{event.target.value='';}
});
function renderCadCandidates(){
  const host=$('cadCandidates');
  host.innerHTML=pendingCadCandidates.length?`<div class="candidate-actions"><button data-cad-action="approve-all">모두 승인</button><button data-cad-action="discard-all">모두 제외</button></div>`+pendingCadCandidates.map(item=>`<div class="candidate-card"><span>${item.name}</span><small>${item.type} · 신뢰도 ${Math.round(item.confidence*100)}%</small><button data-cad-action="approve" data-id="${item.id}">승인</button><button data-cad-action="discard" data-id="${item.id}">제외</button></div>`).join(''):'<span>검수할 후보가 없습니다.</span>';
}
function renderCadEquipmentParameters(){
  const items=layout.equipment.filter(item=>item.source?.origin==='dxf'&&item.reviewStatus==='approved'),counts={};
  for(const item of items)counts[item.type]=(counts[item.type]||0)+1;
  const active=items.length>0;$('defaultEquipmentControls').hidden=active;$('dynamicEquipmentControls').hidden=!active;cadParameterSection.hidden=!active;
  const groups=Object.entries(Object.groupBy?Object.groupBy(items,item=>item.type):items.reduce((result,item)=>((result[item.type]??=[]).push(item),result),{}));
  cadParameterSection.innerHTML=active?`<h2>레이아웃 설비 파라미터</h2><p class="equipment-counts">${Object.entries(counts).map(([type,count])=>`${type.toUpperCase()} ${count}대`).join(' · ')}</p>`+groups.map(([type,equipment])=>`<div class="equipment-type-group"><h3>${type.toUpperCase()} <small>${equipment.length}대</small></h3>${equipment.map(item=>`<details class="equipment-parameter-card"><summary>${item.name}</summary>${parameterFieldsFor(item).map(field=>`<label>${field.label}<span><input type="number" step="0.1" data-equipment-id="${item.id}" data-parameter="${field.key}" value="${field.value}"></span></label>`).join('')}</details>`).join('')}</div>`).join(''):'';
}
cadParameterSection.addEventListener('change',event=>{const input=event.target.closest('[data-equipment-id]');if(!input)return;const item=layout.equipment.find(entry=>entry.id===input.dataset.equipmentId);if(item)item.parameters[input.dataset.parameter]=Number(input.value);});
$('cadCandidates').addEventListener('click',event=>{
  const button=event.target.closest('[data-cad-action]');if(!button)return;const action=button.dataset.cadAction,id=button.dataset.id;
  const selected=action==='approve-all'?pendingCadCandidates:pendingCadCandidates.filter(item=>item.id===id);
  if(action==='approve'||action==='approve-all'){
    const importId=selected[0]?.source?.importId;
    if(importId&&layout.cadActiveImportId!==importId){layout.equipment=layout.equipment.filter(item=>item.source?.origin!=='dxf');layout.cadActiveImportId=importId;layout.displayMode='cad';}
    for(const item of selected){item.reviewStatus='approved';layout.equipment.push(item);}
  }
  if(action==='approve-all'||action==='discard-all')pendingCadCandidates=[];else pendingCadCandidates=pendingCadCandidates.filter(item=>item.id!==id);
  renderer.setLayout(layout);if(action==='approve'||action==='approve-all')resetEngine();else renderer.draw(engine.state);renderCadCandidates();renderCadEquipmentParameters();
  if(action==='approve'||action==='approve-all'){$('cadStatusTitle').textContent='설비 반영 완료';$('cadStatusText').textContent=`${selected.length}개 설비를 레이아웃에 배치했습니다. 편집 모드에서 위치와 파라미터를 보정할 수 있습니다.`;}
  else if(action==='discard-all'){$('cadStatusTitle').textContent='후보 제외 완료';$('cadStatusText').textContent='분석 후보를 모두 제외했습니다.';}
});
document.querySelectorAll('[data-add]').forEach(button=>button.addEventListener('click',()=>editor.add(button.dataset.add)));
$('resetView').addEventListener('click',()=>editor.resetView());
$('deleteEquipment').addEventListener('click',()=>selectedEquipment&&editor.remove(selectedEquipment.id));
for(const id of ['propName','propX','propY']) $(id).addEventListener('change',()=>{if(!selectedEquipment)return;selectedEquipment.name=$('propName').value||selectedEquipment.name;selectedEquipment.x=Number($('propX').value);selectedEquipment.y=Number($('propY').value);renderer.draw(engine.state);});
$('layoutFile').addEventListener('change',async event=>{
  const file=event.target.files[0]; if(!file)return;
  try {const candidate=JSON.parse(await file.text()), check=validateLayout(candidate);if(!check.valid)throw new Error(check.errors.join(' '));layout=candidate;renderer.setLayout(layout);await renderer.setBackground(layout.background?.dataUrl||null);resetEngine();$('layoutName').textContent=layout.name;selectEquipment(null);}
  catch(error){$('validation').textContent='레이아웃 불러오기 실패: '+error.message;} finally{event.target.value='';}
});
inputKeys.forEach(key=>$(key).value=defaultParams[key]); $('useA').checked=defaultParams.useA;$('useB').checked=defaultParams.useB;
$('layoutName').textContent=layout.name;renderer.draw(engine.state);updateDashboard();renderEvents();
