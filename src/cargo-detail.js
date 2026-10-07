import {LayoutRenderer,normalizedCargoSpec,equipmentCargoMetrics,equipmentVisualPosition,conveyorFlowSign} from './renderer.js';
import {detailCamera} from './cargo-visibility.js';
import {advanceCamera,forwardCamera,viewportRange} from './detail-framing.js';
import {equipmentLengthMeters} from './engine.js';
import {handoverEndpointPose,mobileHandoverNode} from './renderer.js';

export function installCargoDetail(renderer){
  const panel=document.createElement('details');panel.className='cargo-detail';
  panel.innerHTML=`<summary>물류 상세 보기 · 입구 / 출구 / 물류 따라가기</summary>
    <div class="cargo-detail-tools"><label><input type="checkbox" data-aid checked> 작은 물류 위치 표식</label>
    <label>보기 <select data-mode><option value="cargo">선택 물류 따라가기</option><option value="in">입구</option><option value="out">출구</option><option value="section">중간 구간</option></select></label>
    <label>물류 <select data-token aria-label="따라갈 물류"></select></label>
    <label>구간 <input data-position type="range" min="0" max="100" value="50"></label>
    <label>확대 <select data-zoom><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
    <label><input type="checkbox" data-lock> 위치·배율 고정</label>
    <label><input type="checkbox" data-pair checked> 인계 양단 자동 보기</label></div>
    <p data-status role="status">레이아웃에서 설비를 선택하세요.</p>
    <p data-range-text></p><div class="cargo-range" aria-label="확대 중인 전체 구간"><span data-range></span></div>
    <div class="cargo-detail-views"><div><strong data-primary-title>물류 국소 확대</strong><canvas width="800" height="260" aria-label="물류 국소 확대 화면"></canvas></div>
    <div data-secondary hidden><strong data-secondary-title></strong><canvas width="800" height="260" aria-label="하류 입구 확대 화면"></canvas></div></div>
    <small>원형 표식과 숫자는 위치·수량 안내이며 실제 물류 크기가 아닙니다. 상세 화면은 원본 렌더링을 균등 확대합니다. 인계 중 양단에 나뉘어 보이는 표현과 AS/RS 내부 작업은 원본 화면·3D LIVE 기준입니다.</small>`;
  renderer.canvas.closest('.canvas-card').append(panel);
  const find=s=>panel.querySelector(s),canvas=find('canvas'),mode=find('[data-mode]'),tokens=find('[data-token]'),status=find('[data-status]');
  let detail=null,secondary=null,lastAt=-Infinity,selected=null,tracked=null,signature='',lastState=null,camera=null,cameraKey='',lastTime=-1,displayOwner=null,lockedOwner=null;
  const lock=find('[data-lock]');
  const redraw=()=>{lastAt=-Infinity;if(lastState)update(lastState);};
  find('[data-aid]').onchange=e=>{renderer.visibilityAid=e.target.checked;if(lastState)renderer.draw(lastState);};
  panel.addEventListener('toggle',redraw);
  for(const control of panel.querySelectorAll('select,input[type=range],[data-lock],[data-pair]'))control.addEventListener('input',()=>{if(control===tokens)tracked=tokens.value;if(control===lock&&lock.checked){camera=detail?{...detail.view}:camera;lockedOwner=displayOwner;}if(control!==lock){lock.checked=false;cameraKey='';}redraw();});
  function update(state){
    lastState=state;if(!panel.open||document.hidden)return;
    const now=performance.now();if(now-lastAt<100&&selected===renderer.selectedId)return;lastAt=now;
    if(selected!==renderer.selectedId||Number(state.t)<lastTime){selected=renderer.selectedId;tracked=null;signature='';camera=null;cameraKey='';lock.checked=false;}
    lastTime=Number(state.t)||0;
    const item=renderer.layout.equipment.find(e=>e.id===selected);
    if(!item){status.textContent='레이아웃에서 설비를 선택하세요.';canvas.getContext('2d').clearRect(0,0,800,260);find('[data-secondary]').hidden=true;find('[data-range-text]').textContent='';find('[data-range]').style.width='0%';return;}
    const records=renderer.cargoPresentations||[],local=records.filter(r=>r.nodeId===selected),unique=[...new Map(local.map(r=>[String(r.id),r])).values()];
    if(tracked==null&&unique.length)tracked=String(unique[0].id);
    const keys=unique.map(r=>String(r.id));if(tracked!=null&&!keys.includes(tracked))keys.unshift(tracked);
    const next=keys.join('|');if(next!==signature){tokens.replaceChildren(...keys.map(id=>new Option(`#${id}`,id)));signature=next;}
    if(tracked!=null)tokens.value=tracked;
    const record=records.find(r=>String(r.id)===tracked),active=state.cadTokens?.find(t=>String(t.id)===tracked);
    let owner=item,center=equipmentVisualPosition(renderer.layout,item,state);
    if(mode.value==='cargo'&&record){owner=renderer.layout.equipment.find(e=>e.id===record.nodeId)||item;center=record;}
    else if(mode.value==='cargo'&&active){owner=renderer.layout.equipment.find(e=>e.id===active.nodeId)||item;center=equipmentVisualPosition(renderer.layout,owner,state);}
    const common=renderer.layout.cadViewMode==='hybrid'?58:78;
    if(mode.value!=='cargo'){
      const fraction=mode.value==='in'?0:mode.value==='out'?1:Number(find('[data-position]').value)/100;
      const length=item.asrsStation?.visualLength||common,a=(Number(item.rotation)||0)*Math.PI/180,offset=(fraction-.5)*length*conveyorFlowSign(item);
      center={x:center.x+Math.cos(a)*offset,y:center.y+Math.sin(a)*offset};
    }
    if(lock.checked&&lockedOwner)owner=lockedOwner;
    displayOwner=owner;
    const cargo=normalizedCargoSpec(renderer.layout),metrics=equipmentCargoMetrics(renderer.layout,cargo,owner,common);
    if(!detail){
      detail=new LayoutRenderer(canvas,{...renderer.layout,canvas:{...renderer.layout.canvas,width:800,height:260}});detail.visibilityAid=false;
      const context=detail.ctx;
      detail.ctx=new Proxy(context,{get(target,key){if(key==='fillText')return()=>{};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;},set(target,key,value){return Reflect.set(target,key,key==='lineWidth'?Math.min(value,1.5/detail.view.zoom):value,target);}});
    }
    // Reuse one small backing buffer; never retain past simulation frames.
    detail.layout=renderer.layout;detail.flowFilter=renderer.flowFilter;
    if(canvas.width!==800)canvas.width=800;if(canvas.height!==260)canvas.height=260;
    let target=detailCamera(center,{w:metrics.visualLength,h:metrics.visualWidth},800,260,Number(find('[data-zoom]').value));
    if(mode.value==='cargo'&&record&&owner.type==='conveyor')target=forwardCamera(target,(Number(owner.rotation)||0)*Math.PI/180,conveyorFlowSign(owner));
    const key=`${owner.id}:${mode.value}:${tracked}:${find('[data-zoom]').value}`;
    camera=advanceCamera(camera,target,{locked:lock.checked,smooth:key===cameraKey&&mode.value==='cargo'});cameraKey=key;
    detail.setView(camera);
    const rangeText=find('[data-range-text]'),range=find('[data-range]');
    const paint=view=>{view.ctx.setTransform(1,0,0,1,0,0);view.ctx.fillStyle='#071019';view.ctx.fillRect(0,0,view.canvas.width,view.canvas.height);view.draw(state);};
    if(owner.type==='conveyor'){
      const length=equipmentLengthMeters(owner,renderer.layout),r=viewportRange(owner,camera,length,owner.asrsStation?.visualLength||common,800,260,conveyorFlowSign(owner));
      range.style.left=`${r.start*100}%`;range.style.width=`${(r.end-r.start)*100}%`;
      rangeText.textContent=`${lock.checked?'화면 고정 · ':''}${owner.name||owner.id} · 전체 ${(length*1000).toLocaleString('ko-KR')} mm 중 ${(r.startMeters*1000).toFixed(0)}–${(r.endMeters*1000).toFixed(0)} mm 구간 · 입구 → 출구 (막대의 밝은 범위)`;
    }else{rangeText.textContent=lock.checked?'화면 위치·배율 고정 중':'현재 설비의 국소 확대 · 컨베이어 선택 시 거리 구간 표시';range.style.width='0%';}
    const nodes=new Map(renderer.layout.equipment.map(e=>[e.id,e])),handover=active&&mode.value==='cargo'&&find('[data-pair]').checked&&!lock.checked?renderer.handoverDescriptor(active,state,nodes,cargo):null;
    find('[data-secondary]').hidden=!handover;
    find('.cargo-range').hidden=Boolean(handover)||owner.type!=='conveyor';
    find('.cargo-detail-views').classList.toggle('paired',Boolean(handover));
    find('[data-primary-title]').textContent=handover?`상류 출구 · ${handover.source.name||handover.source.id} → 인계 ${Math.round(handover.raw*100)}%`:'물류 국소 확대';
    if(handover){
      const otherCanvas=find('[data-secondary] canvas');
      if(!secondary){secondary=new LayoutRenderer(otherCanvas,{...renderer.layout,canvas:{...renderer.layout.canvas,width:800,height:260}});secondary.visibilityAid=false;const ctx=secondary.ctx;secondary.ctx=new Proxy(ctx,{get(t,k){if(k==='fillText')return()=>{};const v=Reflect.get(t,k,t);return typeof v==='function'?v.bind(t):v;},set(t,k,v){return Reflect.set(t,k,k==='lineWidth'?Math.min(v,1.5/secondary.view.zoom):v,t);}});}
      for(const [view,equipment,port,other,isTarget] of [[detail,handover.source,handover.edge?.fromPort,handover.target,false],[secondary,handover.target,handover.edge?.toPort,handover.source,true]]){
        const visual=mobileHandoverNode(renderer.layout,equipment,isTarget,active.mobileRoute||(isTarget?{incoming:handover.edge}:{outgoing:handover.edge})),m=equipmentCargoMetrics(renderer.layout,cargo,equipment,common),position=handoverEndpointPose(visual,port,m.visualLength,isTarget,other,.5,common);
        view.layout=renderer.layout;view.flowFilter=renderer.flowFilter;view.setView(detailCamera(position,{w:m.visualLength,h:m.visualWidth},800,260,Number(find('[data-zoom]').value)));paint(view);
      }
      find('[data-secondary-title]').textContent=`하류 입구 · ${handover.target.name||handover.target.id} · 별도 화면 (실제 거리 아님)`;
      rangeText.textContent='인계 양단을 각각 확대 중 · 두 화면의 배율과 실제 설비 간 거리는 다를 수 있습니다.';range.style.width='0%';
      displayOwner=handover.source;
    }else paint(detail);
    status.textContent=`${owner.name||owner.id} · ${mode.options[mode.selectedIndex].text} ${mode.value==='cargo'&&tracked!=null?'#'+tracked:''} · ${Number(state.t||0).toFixed(1)}초${mode.value==='cargo'&&!record?' · '+(active?'내부 작업 / 인계 중 (3D LIVE 참조)':'표시 중인 물류 없음 / 완료'):''}`;
  }
  renderer.onDraw=update;
  return panel;
}
