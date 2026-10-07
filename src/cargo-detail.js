import {LayoutRenderer,normalizedCargoSpec,equipmentCargoMetrics,equipmentVisualPosition,conveyorFlowSign} from './renderer.js';
import {detailCamera} from './cargo-visibility.js';

export function installCargoDetail(renderer){
  const panel=document.createElement('details');panel.className='cargo-detail';
  panel.innerHTML=`<summary>물류 상세 보기 · 입구 / 출구 / 물류 따라가기</summary>
    <div class="cargo-detail-tools"><label><input type="checkbox" data-aid checked> 작은 물류 위치 표식</label>
    <label>보기 <select data-mode><option value="cargo">선택 물류 따라가기</option><option value="in">입구</option><option value="out">출구</option><option value="section">중간 구간</option></select></label>
    <label>물류 <select data-token aria-label="따라갈 물류"></select></label>
    <label>구간 <input data-position type="range" min="0" max="100" value="50"></label>
    <label>확대 <select data-zoom><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div>
    <p data-status role="status">레이아웃에서 설비를 선택하세요.</p>
    <canvas width="800" height="260" aria-label="물류 국소 확대 화면"></canvas>
    <small>원형 표식과 숫자는 위치·수량 안내이며 실제 물류 크기가 아닙니다. 상세 화면은 원본 렌더링을 균등 확대합니다. 인계 중 양단에 나뉘어 보이는 표현과 AS/RS 내부 작업은 원본 화면·3D LIVE 기준입니다.</small>`;
  renderer.canvas.closest('.canvas-card').append(panel);
  const find=s=>panel.querySelector(s),canvas=find('canvas'),mode=find('[data-mode]'),tokens=find('[data-token]'),status=find('[data-status]');
  let detail=null,lastAt=-Infinity,selected=null,tracked=null,signature='',lastState=null;
  const redraw=()=>{lastAt=-Infinity;if(lastState)update(lastState);};
  find('[data-aid]').onchange=e=>{renderer.visibilityAid=e.target.checked;if(lastState)renderer.draw(lastState);};
  panel.addEventListener('toggle',redraw);
  for(const control of panel.querySelectorAll('select,input[type=range]'))control.addEventListener('input',()=>{if(control===tokens)tracked=tokens.value;redraw();});
  function update(state){
    lastState=state;if(!panel.open||document.hidden)return;
    const now=performance.now();if(now-lastAt<100&&selected===renderer.selectedId)return;lastAt=now;
    if(selected!==renderer.selectedId){selected=renderer.selectedId;tracked=null;signature='';}
    const item=renderer.layout.equipment.find(e=>e.id===selected);
    if(!item){status.textContent='레이아웃에서 설비를 선택하세요.';canvas.getContext('2d').clearRect(0,0,800,260);return;}
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
    const metrics=equipmentCargoMetrics(renderer.layout,normalizedCargoSpec(renderer.layout),owner,common);
    if(!detail){
      detail=new LayoutRenderer(canvas,{...renderer.layout,canvas:{...renderer.layout.canvas,width:800,height:260}});detail.visibilityAid=false;
      const context=detail.ctx;
      detail.ctx=new Proxy(context,{get(target,key){if(key==='fillText')return()=>{};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;},set(target,key,value){return Reflect.set(target,key,key==='lineWidth'?Math.min(value,1.5/detail.view.zoom):value,target);}});
    }
    // Reuse one small backing buffer; never retain past simulation frames.
    detail.layout=renderer.layout;detail.flowFilter=renderer.flowFilter;
    if(canvas.width!==800)canvas.width=800;if(canvas.height!==260)canvas.height=260;
    detail.setView(detailCamera(center,{w:metrics.visualLength,h:metrics.visualWidth},800,260,Number(find('[data-zoom]').value)));
    detail.draw(state);
    status.textContent=`${owner.name||owner.id} · ${mode.options[mode.selectedIndex].text} ${mode.value==='cargo'&&tracked!=null?'#'+tracked:''} · ${Number(state.t||0).toFixed(1)}초${mode.value==='cargo'&&!record?' · '+(active?'내부 작업 / 인계 중 (3D LIVE 참조)':'표시 중인 물류 없음 / 완료'):''}`;
  }
  renderer.onDraw=update;
  return panel;
}
