import {LayoutRenderer} from './renderer.js';
export function drawingAvailable(layout){return Boolean(layout.cadPreviewRaster||layout.cadPreviewSvg||layout.dxfGeometry?.length||layout.background?.dataUrl);}
export function drawingOnlyLayout(layout){return {...layout,canvas:{...layout.canvas},equipment:[],connections:[],cadSchematic:{edges:[]},displayMode:'cad',cadViewMode:'raw'};}
export function openDrawingViewer(layout){
 const dialog=document.createElement('dialog');dialog.className='drawing-viewer';
 const head=document.createElement('header'),title=document.createElement('strong'),close=document.createElement('button');title.textContent='도면 확인';close.textContent='닫기';close.onclick=()=>dialog.close();head.append(title,close);
 const info=document.createElement('p');info.textContent=drawingAvailable(layout)?`${layout.cadSource?.fileName||'참조 도면'} · 휠로 확대/축소 · 드래그로 이동 · 시뮬레이션은 계속 진행됩니다.`:'불러온 도면이 없습니다. 가져오기 · 저장 · 보기에서 CAD 도면 또는 참조 이미지를 먼저 불러오세요.';
 dialog.append(head,info);document.body.append(dialog);dialog.onclose=()=>dialog.remove();dialog.showModal();
 if(!drawingAvailable(layout))return;
 const controls=document.createElement('nav'),canvas=document.createElement('canvas'),label=document.createElement('output');canvas.setAttribute('aria-label','불러온 원본 도면 확대 보기');canvas.style.touchAction='none';
 const renderer=new LayoutRenderer(canvas,drawingOnlyLayout(layout));renderer.visibilityAid=false;
 const state={cadTokens:[]},draw=()=>{renderer.draw(state);label.textContent=Math.round(renderer.view.zoom*100)+'%';};
 const zoom=(factor,x=canvas.width/2,y=canvas.height/2)=>{const v=renderer.view,z=Math.max(.1,Math.min(30,v.zoom*factor)),ratio=z/v.zoom;renderer.setView({zoom:z,x:x-(x-v.x)*ratio,y:y-(y-v.y)*ratio});draw();};
 for(const [name,action] of [['−',()=>zoom(1/1.25)],['＋',()=>zoom(1.25)],['전체 맞춤',()=>{renderer.setView({x:0,y:0,zoom:1});draw();}]]){const b=document.createElement('button');b.textContent=name;b.onclick=action;controls.append(b);}controls.append(label);dialog.append(controls,canvas);
 const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};};
 canvas.addEventListener('wheel',e=>{e.preventDefault();const p=point(e);zoom(e.deltaY<0?1.15:1/1.15,p.x,p.y);},{passive:false});let drag=null;
 canvas.onpointerdown=e=>{drag=point(e);canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drag)return;const p=point(e);renderer.setView({x:renderer.view.x+p.x-drag.x,y:renderer.view.y+p.y-drag.y});drag=p;draw();};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
 if(layout.background?.dataUrl)renderer.setBackground(layout.background.dataUrl).then(()=>{if(dialog.isConnected)draw();}).catch(()=>{info.textContent='참조 이미지를 읽지 못했습니다.';});draw();
}
