import { directionAxis, toggleDiverterDirection, diverterProfile, diverterEnabled, diverterAllowsEdge, diverterEdgeDirection, diverterRouteKey } from './diverter.js';
import { equipmentPorts, equipmentFlowPorts } from './route.js';

function appendRoutingControls(box,item,layout,onChange){
  const p=item.parameters||{},edges=(layout.cadSchematic?.edges||[]).filter(edge=>edge.from===item.id&&diverterAllowsEdge(item,edge,layout.equipment.find(node=>node.id===edge.to))),names={up:'↑',down:'↓',left:'←',right:'→'},flow=equipmentFlowPorts(item);
  const labelFor=edge=>`${edge.fromPort===flow.output?'직진':'분기'} ${names[diverterEdgeDirection(item,edge)]||''} → ${layout.equipment.find(node=>node.id===edge.to)?.name||edge.to} (${edge.fromPort} → ${edge.toPort||'자동'})`;
  const paragraph=text=>{const el=document.createElement('p');el.textContent=text;box.append(el);};
  paragraph(`기본 직진 ${names[diverterEdgeDirection(item,{fromPort:flow.output})]} · 입력 ${flow.input} / 직진 출력 ${flow.output}. 좌우 분기는 별도의 측면 연결점을 연결하세요. 설비 회전 시 연결점 기준 조건이 유지됩니다.`);
  const select=(label,value,options,change,parent=box)=>{const row=document.createElement('label'),el=document.createElement('select');el.setAttribute('aria-label',label);for(const [key,text] of options)el.add(new Option(text,key));el.value=value;row.append(label,el);parent.append(row);el.addEventListener('change',()=>change(el.value));return el;};
  select('분배 조건',p.diverterRoutingMode||'rules',[['rules','물류 종류·목적지 조건'],['ratio','출구별 비율'],['available','가용 경로 (같은 목적지에만 사용)'],['straight','항상 직진']],value=>onChange(item,'diverterRoutingMode',value));
  const mode=p.diverterRoutingMode||'rules',routeOptions=[['','출구 선택'],...edges.map(edge=>[diverterRouteKey(edge),labelFor(edge)])];
  if(mode==='rules'){
    paragraph('위에서부터 먼저 일치하는 조건을 적용합니다. 조건 미일치는 직진, 지정 출구가 없거나 막히면 대기합니다. 색상이 아닌 물류 종류 값으로 판정합니다.');
    const rules=p.diverterRules||[],save=(index,patch)=>onChange(item,'diverterRules',rules.map((rule,i)=>i===index?{...rule,...patch}:rule));
    rules.forEach((rule,index)=>{const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=`조건 ${index+1}`;group.append(legend);box.append(group);
      select('판정 항목',rule.field,[['cargo','물류 종류'],['destination','목적지 ID / 출고 라인 이름']],field=>save(index,{field}),group);
      const row=document.createElement('label'),input=document.createElement('input');input.value=rule.value;input.setAttribute('aria-label',`조건 ${index+1} 일치 값`);row.append('일치 값',input);group.append(row);input.addEventListener('change',()=>save(index,{value:input.value.trim()}));
      select('보낼 출구',rule.route,routeOptions,route=>save(index,{route}),group);
      if(rule.route&&!edges.some(edge=>diverterRouteKey(edge)===rule.route)){const warning=document.createElement('small');warning.textContent='지정 출구가 연결되지 않았거나 비활성화되어 있습니다. 이 조건의 물류는 대기합니다.';group.append(warning);}
      const remove=document.createElement('button');remove.type='button';remove.textContent='조건 삭제';remove.addEventListener('click',()=>onChange(item,'diverterRules',rules.filter((_,i)=>i!==index)));group.append(remove);
    });
    const add=document.createElement('button');add.type='button';add.textContent='분기 조건 추가';add.addEventListener('click',()=>onChange(item,'diverterRules',[...rules,{field:'cargo',value:'',route:''}]));box.append(add);
    const known=[...new Set([...(layout.cadSchematic?.inboundBranches||[]).map(branch=>branch.cargoType),...layout.equipment.map(node=>node.parameters?.cargoType)].filter(Boolean))];if(known.length)paragraph(`등록 물류 종류: ${known.join(' / ')}`);
  }
  if(mode==='ratio'){
    for(const edge of edges){const key=diverterRouteKey(edge),row=document.createElement('label'),input=document.createElement('input');input.type='number';input.min='0';input.max='100';input.step='1';input.value=p.diverterWeights?.[key]??0;input.setAttribute('aria-label',`${labelFor(edge)} 비중`);row.append(`${labelFor(edge)} 비중`,input);box.append(row);input.addEventListener('change',()=>{if(input.checkValidity())onChange(item,'diverterWeights',{...p.diverterWeights,[key]:Number(input.value)});});}
    paragraph('비중 3:7이면 10개 중 직진 3개·분기 7개 순서입니다. 실제 인계 완료 건수로 계산합니다. 모두 0이면 직진합니다. 대체 경로를 허용하면 실제 비율은 달라질 수 있습니다.');
  }
  if(mode!=='available'){
    const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='막힘 시 허용할 대체 출구 (기본: 모두 해제 → 대기)';group.append(legend);
    for(const edge of edges){const key=diverterRouteKey(edge),row=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=(p.diverterAlternatives||[]).includes(key);row.append(labelFor(edge),check);group.append(row);check.addEventListener('change',()=>{const values=new Set(p.diverterAlternatives||[]);check.checked?values.add(key):values.delete(key);onChange(item,'diverterAlternatives',[...values]);});}box.append(group);
  }else paragraph('수신 가능한 연결 출구로 분배합니다. 서로 다른 목적지의 라인을 연결한 경우 이 모드를 사용하지 마세요.');
  paragraph('현재 동작: 정지 후 횡이송 · 하류 수신 승인 → 분기 이송 → 인계 완료. 이송 중 경로를 변경하지 않습니다.');
}

export function appendDiverterControls(items,root,layout,onChange){
  for(const item of items.filter(entry=>entry.type==='conveyor')){
    const card=root.querySelector(`[data-parameter-card="${CSS.escape(item.id)}"]`);if(!card)continue;
    const p=item.parameters||{},selected=Array.isArray(p.diverterPorts)?p.diverterPorts.map(fromPort=>diverterEdgeDirection(item,{fromPort})):p.diverterDirections||[],axis=directionAxis(selected[0]),box=document.createElement('section');box.className='diverter-controls';
    const heading=document.createElement('h3');heading.textContent='디버터 · 방향 분기';box.append(heading);
    const toggle=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=diverterEnabled(item);toggle.append('디버터 사용',check);box.append(toggle);
    check.addEventListener('change',()=>onChange(item,'diverterEnabled',check.checked?1:0));
    if(diverterEnabled(item)){
      const directions=document.createElement('div');directions.className='diverter-direction-pad';directions.setAttribute('role','group');directions.setAttribute('aria-label','디버터 분기 방향');
      for(const [key,label] of [['up','↑ 위'],['left','← 왼쪽'],['right','→ 오른쪽'],['down','↓ 아래']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.direction=key;button.setAttribute('aria-pressed',String(selected.includes(key)));button.disabled=Boolean(axis&&directionAxis(key)!==axis)||[equipmentFlowPorts(item).input,equipmentFlowPorts(item).output].some(fromPort=>diverterEdgeDirection(item,{fromPort})===key);button.addEventListener('click',()=>onChange(item,'diverterPorts',Object.keys(equipmentPorts(item)).filter(fromPort=>fromPort!==equipmentFlowPorts(item).input&&toggleDiverterDirection(selected,key).includes(diverterEdgeDirection(item,{fromPort})))));directions.append(button);}box.append(directions);
      const clear=document.createElement('button');clear.type='button';clear.textContent='방향 선택 초기화';clear.addEventListener('click',()=>onChange(item,'diverterPorts',[]));box.append(clear);
      for(const [key,label,fallback] of [['diverterSpeed','디버터 속도 (m/s)',.5],['diverterAcceleration','가속도 (m/s²)',.8],['diverterDeceleration','감속도 (m/s²)',1],['diverterStroke','디버터 이송거리 (m)',1]]){const row=document.createElement('label'),input=document.createElement('input');input.type='number';input.min='.01';input.step='any';input.value=p[key]??fallback;input.setAttribute('aria-label',label);row.append(label,input);input.addEventListener('change',()=>{const value=Number(input.value);if(!Number.isFinite(value)||value<=0){input.setCustomValidity('0보다 큰 값을 입력하세요.');input.reportValidity();return;}input.setCustomValidity('');onChange(item,key,value);});box.append(row);}
      appendRoutingControls(box,item,layout,onChange);
      const profile=diverterProfile(item),total=profile.total,x1=20+220*profile.t1/total,x2=20+220*(profile.t1+profile.t2)/total;
      const preview=document.createElement('div');preview.className='diverter-preview';
      const arrows={up:'M130 52 V10 M124 18 L130 10 L136 18',down:'M130 78 V115 M124 107 L130 115 L136 107',left:'M110 65 H25 M33 59 L25 65 L33 71',right:'M150 65 H235 M227 59 L235 65 L227 71'},shownDirections=[...new Set([diverterEdgeDirection(item,{fromPort:equipmentFlowPorts(item).output}),...selected])];
      const cargo=layout.cargoSpec||{},length=Math.max(1,Number(cargo.length)||1200),width=Math.max(1,Number(cargo.width)||800),scale=32/Math.max(length,width);
      preview.innerHTML=`<strong>분기 흐름 미리보기 · 화면 방향 기준</strong><svg viewBox="0 0 260 130" role="img" aria-label="선택 방향으로 이동하며 물류 자세는 유지"><rect x="85" y="38" width="90" height="54" rx="4" fill="#102c40" stroke="#00d4ff"/><rect x="${130-length*scale/2}" y="${65-width*scale/2}" width="${length*scale}" height="${width*scale}" fill="#ffd166"/>${shownDirections.filter(key=>arrows[key]).map(key=>`<path d="${arrows[key]}" fill="none" stroke="#00ff88" stroke-width="3"/>`).join('')}</svg><strong>디버터 속도 프로파일</strong><svg viewBox="0 0 260 112" role="img" aria-label="디버터 가속 정속 감속 그래프"><path d="M20 15 V80 H245" stroke="#63849a" fill="none"/><path d="M20 80 L${x1} 20 L${x2} 20 L240 80" stroke="#00d4ff" stroke-width="3" fill="none"/><text x="20" y="105" fill="#d8f3ff" font-size="10">0초 → ${total.toFixed(2)}초 · 최고 ${profile.peakSpeed.toFixed(2)}m/s</text></svg>`;box.append(preview);
      const note=document.createElement('p');note.textContent=`가속 ${profile.t1.toFixed(2)}초 · 정속 ${profile.t2.toFixed(2)}초 · 감속 ${profile.t3.toFixed(2)}초. 짧은 이송거리는 삼각형 프로파일입니다. 직진은 유지하며 분기 중에는 한 물류만 처리합니다. 물류 자세는 회전하지 않습니다. 디버터 설정을 변경하면 시뮬레이션이 초기화됩니다.`;box.append(note);
      const edges=(layout.cadSchematic?.edges||[]).filter(edge=>edge.from===item.id),list=document.createElement('p');list.textContent=edges.length?edges.map(edge=>{const target=layout.equipment.find(entry=>entry.id===edge.to);return `${diverterAllowsEdge(item,edge,target)?'허용':'차단'}: ${target?.name||edge.to}`;}).join(' / '):'연결된 하류 설비가 없습니다. 선택 방향의 연결점을 연결해 주세요.';box.append(list);
    }
    card.append(box);
  }
}
