import { directionAxis, toggleDiverterDirection, diverterProfile, diverterEnabled, diverterAllowsEdge } from './diverter.js';

export function appendDiverterControls(items,root,layout,onChange){
  for(const item of items.filter(entry=>entry.type==='conveyor')){
    const card=root.querySelector(`[data-parameter-card="${CSS.escape(item.id)}"]`);if(!card)continue;
    const p=item.parameters||{},selected=p.diverterDirections||[],axis=directionAxis(selected[0]),box=document.createElement('section');box.className='diverter-controls';
    const heading=document.createElement('h3');heading.textContent='디버터 · 방향 분기';box.append(heading);
    const toggle=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=diverterEnabled(item);toggle.append('디버터 사용',check);box.append(toggle);
    check.addEventListener('change',()=>onChange(item,'diverterEnabled',check.checked?1:0));
    if(diverterEnabled(item)){
      const directions=document.createElement('div');directions.className='diverter-direction-pad';directions.setAttribute('role','group');directions.setAttribute('aria-label','디버터 분기 방향');
      for(const [key,label] of [['up','↑ 위'],['left','← 왼쪽'],['right','→ 오른쪽'],['down','↓ 아래']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.direction=key;button.setAttribute('aria-pressed',String(selected.includes(key)));button.disabled=Boolean(axis&&directionAxis(key)!==axis);button.addEventListener('click',()=>onChange(item,'diverterDirections',toggleDiverterDirection(selected,key)));directions.append(button);}box.append(directions);
      const clear=document.createElement('button');clear.type='button';clear.textContent='방향 선택 초기화';clear.addEventListener('click',()=>onChange(item,'diverterDirections',[]));box.append(clear);
      for(const [key,label,fallback] of [['diverterSpeed','디버터 속도 (m/s)',.5],['diverterAcceleration','가속도 (m/s²)',.8],['diverterDeceleration','감속도 (m/s²)',1],['diverterStroke','디버터 이송거리 (m)',1]]){const row=document.createElement('label'),input=document.createElement('input');input.type='number';input.min='.01';input.step='any';input.value=p[key]??fallback;input.setAttribute('aria-label',label);row.append(label,input);input.addEventListener('change',()=>{const value=Number(input.value);if(!Number.isFinite(value)||value<=0){input.setCustomValidity('0보다 큰 값을 입력하세요.');input.reportValidity();return;}input.setCustomValidity('');onChange(item,key,value);});box.append(row);}
      const profile=diverterProfile(item),total=profile.total,x1=20+220*profile.t1/total,x2=20+220*(profile.t1+profile.t2)/total;
      const preview=document.createElement('div');preview.className='diverter-preview';
      const arrows={up:'M130 52 V10 M124 18 L130 10 L136 18',down:'M130 78 V115 M124 107 L130 115 L136 107',left:'M110 65 H25 M33 59 L25 65 L33 71',right:'M150 65 H235 M227 59 L235 65 L227 71'};
      const cargo=layout.cargoSpec||{},length=Math.max(1,Number(cargo.length)||1200),width=Math.max(1,Number(cargo.width)||800),scale=32/Math.max(length,width);
      preview.innerHTML=`<strong>분기 흐름 미리보기 · 화면 방향 기준</strong><svg viewBox="0 0 260 130" role="img" aria-label="선택 방향으로 이동하며 물류 자세는 유지"><rect x="85" y="38" width="90" height="54" rx="4" fill="#102c40" stroke="#00d4ff"/><rect x="${130-length*scale/2}" y="${65-width*scale/2}" width="${length*scale}" height="${width*scale}" fill="#ffd166"/>${selected.filter(key=>arrows[key]).map(key=>`<path d="${arrows[key]}" fill="none" stroke="#00ff88" stroke-width="3"/>`).join('')}</svg><strong>디버터 속도 프로파일</strong><svg viewBox="0 0 260 112" role="img" aria-label="디버터 가속 정속 감속 그래프"><path d="M20 15 V80 H245" stroke="#63849a" fill="none"/><path d="M20 80 L${x1} 20 L${x2} 20 L240 80" stroke="#00d4ff" stroke-width="3" fill="none"/><text x="20" y="105" fill="#d8f3ff" font-size="10">0초 → ${total.toFixed(2)}초 · 최고 ${profile.peakSpeed.toFixed(2)}m/s</text></svg>`;box.append(preview);
      const note=document.createElement('p');note.textContent=`가속 ${profile.t1.toFixed(2)}초 · 정속 ${profile.t2.toFixed(2)}초 · 감속 ${profile.t3.toFixed(2)}초. 짧은 이송거리는 삼각형 프로파일입니다. 직진은 유지하며 분기 중에는 한 물류만 처리합니다. 물류 자세는 회전하지 않습니다. 디버터 설정을 변경하면 시뮬레이션이 초기화됩니다.`;box.append(note);
      const edges=(layout.cadSchematic?.edges||[]).filter(edge=>edge.from===item.id),list=document.createElement('p');list.textContent=edges.length?edges.map(edge=>{const target=layout.equipment.find(entry=>entry.id===edge.to);return `${diverterAllowsEdge(item,edge,target)?'허용':'차단'}: ${target?.name||edge.to}`;}).join(' / '):'연결된 하류 설비가 없습니다. 선택 방향의 연결점을 연결해 주세요.';box.append(list);
    }
    card.append(box);
  }
}
