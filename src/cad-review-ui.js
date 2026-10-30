import {logisticsEquipmentCatalog} from './cad.js';
import {applyCadType,validateCadConnections,proposeCadConnections} from './cad-import.js';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
export function renderCadReviewCards(host,items,onChange){
  host.replaceChildren();
  const actions=el('div');actions.className='candidate-actions';
  for(const [action,label] of [['approve-all','확인 가능한 후보 모두 승인'],['discard-all','모두 제외']]){const b=el('button',label);b.dataset.cadAction=action;actions.append(b);}host.append(actions);
  const summary=el('small',`후보 ${items.length}개 · 현재 최대 200개 표시 (승인/제외 후 다음 후보 표시). 패턴은 이 브라우저에만 저장되며 치수·운전 속도는 복사하지 않습니다.`);host.append(summary);
  for(const item of items.slice(0,200)){
    const card=el('div');card.className='candidate-card';card.style.cssText='display:flex;flex-wrap:wrap;gap:8px;align-items:center';
    card.append(el('strong',item.name));const type=el('select');type.setAttribute('aria-label',`${item.name} 설비 종류`);type.append(new Option('설비 종류 확인','unknown'));
    for(const rule of logisticsEquipmentCatalog)type.append(new Option(rule.label,rule.type));type.value=item.type;
    type.onchange=()=>{if(type.value==='unknown')return;applyCadType(item,type.value);onChange();};card.append(type);
    const m=item.source.measurement;card.append(el('small',`${item.source.patternMatched?'저장 패턴 일치 · ':''}${m.basis} · ${m.length!=null?(m.length*1000).toFixed(1)+' mm':'단위/치수 미확정'} × ${m.width!=null?(m.width*1000).toFixed(1)+' mm':'폭 미확정'}${m.review?' · 확인 필요':''}`));
    if(item.type!=='unknown'){
      const label=el('label','실제 길이 확인(mm) '),input=el('input');input.type='number';input.min='0.1';input.step='0.1';input.value=m.length>0?m.length*1000:'';input.style.width='110px';
      input.onchange=()=>{const length=Number(input.value)/1000;if(!Number.isFinite(length)||length<=0){input.setCustomValidity('양수 길이를 입력하세요.');input.reportValidity();return;}input.setCustomValidity('');m.length=length;m.review=false;m.basis='사용자 확인 길이';item.parameters.length=length;item.source.dimensionReviewRequired=false;onChange();};label.append(input);card.append(label);
    }
    const remember=el('label','이 종류 패턴 기억 '),check=el('input');check.type='checkbox';check.checked=Boolean(item.rememberPattern);check.onchange=()=>item.rememberPattern=check.checked;remember.append(check);card.append(remember);
    for(const [action,label] of [['approve','승인'],['discard','제외']]){const b=el('button',label);b.dataset.cadAction=action;b.dataset.id=item.id;b.disabled=action==='approve'&&(item.type==='unknown'||item.type==='conveyor'&&item.source.dimensionReviewRequired);card.append(b);}host.append(card);
  }
}
export function renderCadConnectionReview(host,layout,review,onAccept,onSelect){
  host.replaceChildren();if(!review)return;
  const items=layout.equipment.filter(e=>e.source?.origin==='dxf'),edges=layout.cadSchematic?.edges||[],issues=validateCadConnections(items,edges),proposals=proposeCadConnections(items),byId=new Map(items.map(e=>[e.id,e]));
  host.append(el('strong',`연결점 검증 · 미확인/오류 ${issues.length}건 · 근접 끝점 후보 ${proposals.length}건`));
  const refresh=el('button','현재 연결 다시 검증');refresh.onclick=()=>renderCadConnectionReview(host,layout,review,onAccept,onSelect);host.append(refresh);
  host.append(el('p',review.warnings.join(' ')));
  for(const issue of issues.slice(0,100)){const row=el('div',issue.message);if(issue.id){const b=el('button','설비 보기');b.onclick=()=>onSelect(issue.id);row.append(b);}host.append(row);}
  for(const edge of proposals.slice(0,200)){
    if(edges.some(e=>e.from===edge.from&&e.to===edge.to&&e.fromPort===edge.fromPort&&e.toPort===edge.toPort))continue;
    const row=el('div',`${byId.get(edge.from)?.name}.${edge.fromPort} → ${byId.get(edge.to)?.name}.${edge.toPort} · 틈 ${(edge.gap*1000).toFixed(1)} mm `),accept=el('button','방향 확인 후 연결'),reverse=el('button','반대 방향 연결');
    accept.onclick=()=>onAccept(edge);reverse.onclick=()=>onAccept({...edge,from:edge.to,to:edge.from,fromPort:edge.toPort,toPort:edge.fromPort});row.append(accept,reverse);host.append(row);
  }
  if(issues.length>100||proposals.length>200)host.append(el('p','목록 표시 한도에 도달했습니다. 나머지는 레이아웃에서 확인하고 다시 검증하세요.'));
}
