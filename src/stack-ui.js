import {distanceLabel,inputDisplayValue,inputStoredValue} from './distance-units.js';
import {isStackEquipment,isSequenceRack,sequenceConfig} from './equipment-variants.js';
import {createSequenceSchedule} from './sequence-rack.js';

function number(parent,label,value,min=1,step=1){const row=document.createElement('label'),input=document.createElement('input');input.type='number';input.min=min;input.step=step;input.value=value;input.setAttribute('aria-label',label);row.append(label,input);parent.append(row);return input;}
function paragraph(parent,text){const p=document.createElement('p');p.textContent=text;p.style.fontSize='12px';p.style.lineHeight='1.6';parent.append(p);}

export function appendStackControls(items,root,layout,onChange){
 for(const item of items){
  const card=root.querySelector(`[data-parameter-card="${CSS.escape(item.id)}"]`);if(!card)continue;
  const p=item.parameters||{};
  if(isStackEquipment(item)){
   const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=item.equipmentRole==='boxStacker'?'빈 박스 적재 · 스토퍼':'적층 박스 분배 · 스토퍼';group.append(legend);card.append(group);
   const fields=[...(item.equipmentRole==='boxStacker'?[['stackTarget','완성 적재 수량(개)',1,1,1]]:[]),['stackLiftTime','들어올림 시간(초)',1,.01,.01],['stackLowerTime','내려놓음 시간(초)',1,.01,.01],['stackMaxHeight','최대 적재 높이(m)',10,.01,.01]];
   for(const [key,label,fallback,min,step] of fields){const input=number(group,distanceLabel(key,label),inputDisplayValue(key,p[key]??fallback),inputDisplayValue(key,min),inputDisplayValue(key,step));input.addEventListener('change',()=>{if(input.reportValidity())onChange(item,key,inputStoredValue(key,input.value));});}
   paragraph(group,'일체형 컨베이어의 길이·속도·가감속·안전간격·연속 인계는 위 컨베이어 파라미터를 사용합니다. 하류 수신 승인 및 꼬리 통과 완료 전에는 다음 묶음을 받지 않습니다. 적재기는 동일 종류·규격의 빈 박스만 받습니다.');
  }
  if(isSequenceRack(item)){
   const button=document.createElement('button');button.type='button';button.textContent='서열렉 · 스태커별 출고 상세 설정';button.addEventListener('click',()=>openSequenceSettings(item,layout,onChange));card.append(button);
   paragraph(card,'각 스태커가 독립 주기로 출고합니다. 지정 셀에 재고가 없으면 순서를 건너뛰지 않고 기다립니다. 기존 AS/RS 안전·입출고 스테이션 조건을 함께 적용합니다.');
  }
  if(layout.equipment.some(isStackEquipment)&&(item.type==='source'||item.type==='dock'&&p.dockRole==='inbound')){
   const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='입고 물품 적층';group.append(legend);card.append(group);
   for(const [key,label,fallback,min,step] of [...(layout.equipment.some(e=>e.equipmentRole==='boxDestacker')?[['initialStackCount','투입 적층 수량(단)',1,1,1]]:[]),['boxHeight','박스 1단 높이(m)',.2,.001,.001]]){const input=number(group,distanceLabel(key,label),inputDisplayValue(key,p[key]??fallback),inputDisplayValue(key,min),inputDisplayValue(key,step));input.addEventListener('change',()=>{if(input.reportValidity())onChange(item,key,inputStoredValue(key,input.value));});}
   const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=p.emptyBox!==0;label.append('빈 박스',check);group.append(label);check.addEventListener('change',()=>onChange(item,'emptyBox',check.checked?1:0));
  }
 }
}

export function openSequenceSettings(item,layout,onChange){
 document.querySelector('[data-sequence-settings]')?.remove();
 const dialog=document.createElement('dialog');dialog.dataset.sequenceSettings=item.id;dialog.setAttribute('aria-label','서열렉 스태커별 상세 설정');dialog.style.cssText='position:fixed;inset:8vh 5vw auto auto;max-height:80vh;overflow:auto;width:min(620px,85vw);background:#0c1824;color:#9fc5dd;border:1px solid #00d4ff;z-index:1000;padding:20px';
 const title=document.createElement('h3');title.textContent=`${item.name} · 독립 출고 서열`;dialog.append(title);
 const style=document.createElement('style');style.textContent='[data-sequence-settings] fieldset{margin:12px 0;padding:12px;border:1px solid #28516a;border-radius:6px}[data-sequence-settings] label{display:grid;grid-template-columns:1fr 110px;gap:10px;align-items:center;margin:8px 0;font-size:13px}[data-sequence-settings] input,[data-sequence-settings] select,[data-sequence-settings] textarea{box-sizing:border-box;max-width:100%;padding:8px;background:#071019;color:#00d4ff;border:1px solid #28516a;border-radius:4px;font:13px sans-serif}[data-sequence-settings] input{width:110px}[data-sequence-settings] select{width:100%;margin:8px 0}[data-sequence-settings] button{margin:6px;padding:10px;border:1px solid #00d4ff;border-radius:4px;background:#0c2434;color:#00d4ff}';dialog.append(style);
 paragraph(dialog,'레이아웃을 함께 볼 수 있는 독립 설정 창입니다. 주기는 시뮬레이션 시간 기준이며, 출고 정체 시 밀린 주기를 한꺼번에 실행하지 않습니다. 셀 지정은 1부터 시작하는 열/단/행을 순서대로 입력합니다(예: 1/1/1, 3/2/1).');
 const p=item.parameters||{},rows=Math.max(1,Number(p.rows)||2),levels=Math.max(1,Number(p.levels)||4),columns=Math.max(1,Number(p.columns)||8),forms=[];
 for(let i=0;i<Math.max(1,Number(p.productTypes)||1);i++){
  const config=sequenceConfig(item,i),group=document.createElement('fieldset'),legend=document.createElement('legend'),station=layout.equipment.find(e=>e.asrsStation?.parentId===item.id&&e.asrsStation.index===i);legend.textContent=station?.name||`스태커 ${i+1}`;group.append(legend);dialog.append(group);
  const interval=number(group,'독립 출고 주기(초)',config.interval,.01,.01),count=number(group,'주기당 출고 수량(개)',config.count),seed=number(group,'랜덤 재현 시드',config.seed),mode=document.createElement('select');mode.setAttribute('aria-label',`스태커 ${i+1} 셀 선택`);
  for(const [value,label] of [['fifo','먼저 입고된 셀'],['random','랜덤 셀 (시드 재현)'],['specified','지정 셀 순서']])mode.add(new Option(label,value));mode.value=config.mode;group.append(mode);
  const cells=document.createElement('textarea');cells.setAttribute('aria-label',`스태커 ${i+1} 지정 셀 순서`);cells.value=config.cells.map(index=>`${Math.floor(index/(rows*levels))+1}/${Math.floor(index/rows)%levels+1}/${index%rows+1}`).join(', ');cells.style.width='100%';group.append(cells);cells.disabled=mode.value!=='specified';mode.addEventListener('change',()=>cells.disabled=mode.value!=='specified');forms.push({interval,count,seed,mode,cells});
 }
 const error=document.createElement('p');error.setAttribute('role','alert');error.style.color='#ff809d';dialog.append(error);
 const apply=document.createElement('button');apply.textContent='설정 적용';apply.type='button';apply.addEventListener('click',()=>{
  try{const settings={};forms.forEach((f,i)=>{
   if(![f.interval,f.count,f.seed].every(input=>input.reportValidity()))throw Error('주기·수량·시드 입력을 확인하세요.');
   const cells=f.mode.value==='specified'?f.cells.value.split(',').map(value=>{const v=value.trim().split('/').map(Number);if(v.length!==3||!v.every(Number.isInteger)||v[0]<1||v[0]>columns||v[1]<1||v[1]>levels||v[2]<1||v[2]>rows)throw Error(`스태커 ${i+1}: 셀 범위는 ${columns}열 / ${levels}단 / ${rows}행입니다.`);return(v[0]-1)*rows*levels+(v[1]-1)*rows+v[2]-1;}):[];
   const config={interval:Number(f.interval.value),count:Number(f.count.value),seed:Number(f.seed.value),mode:f.mode.value,cells};createSequenceSchedule(config);settings[i]=config;
  });if(onChange(item,'sequenceStackers',settings)!==false)dialog.remove();}catch(e){error.textContent=e.message;}
 });const close=document.createElement('button');close.textContent='닫기';close.type='button';close.addEventListener('click',()=>dialog.remove());dialog.append(apply,close);dialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'&&e.target.tagName!=='TEXTAREA'){e.preventDefault();apply.click();}});document.body.append(dialog);dialog.show();
}
