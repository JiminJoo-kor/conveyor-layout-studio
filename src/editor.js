const movable = item => Number.isFinite(item?.x) && Number.isFinite(item?.y);

export class LayoutEditor {
  constructor(canvas, renderer, getLayout, onChange, onSelect) {
    this.canvas=canvas;this.renderer=renderer;this.getLayout=getLayout;this.onChange=onChange;this.onSelect=onSelect;
    this.enabled=false;this.drag=null;this.pan=null;this.view={zoom:1,x:0,y:0};
    canvas.addEventListener('pointerdown',e=>this.pointerDown(e));
    canvas.addEventListener('pointermove',e=>this.pointerMove(e));
    canvas.addEventListener('pointerup',()=>this.pointerUp());
    canvas.addEventListener('pointerleave',()=>this.pointerUp());
    canvas.addEventListener('wheel',e=>this.wheel(e),{passive:false});
  }
  setEnabled(value){this.enabled=value;this.canvas.classList.toggle('editing',value);}
  canvasPoint(event){const rect=this.canvas.getBoundingClientRect(),sx=this.canvas.width/rect.width,sy=this.canvas.height/rect.height;return{x:(event.clientX-rect.left)*sx,y:(event.clientY-rect.top)*sy};}
  worldPoint(event){const p=this.canvasPoint(event);return{x:(p.x-this.view.x)/this.view.zoom,y:(p.y-this.view.y)/this.view.zoom};}
  hit(point){return [...this.getLayout().equipment].reverse().find(item=>movable(item)&&Math.abs(point.x-item.x)<38&&Math.abs(point.y-item.y)<38);}
  pointerDown(event){if(!this.enabled&&event.button!==1&&!event.shiftKey)return;this.canvas.setPointerCapture(event.pointerId);const p=this.worldPoint(event),hit=this.hit(p);
    if(event.button===1||event.shiftKey){event.preventDefault();const raw=this.canvasPoint(event);this.pan={raw,start:{...this.view}};this.canvas.classList.add('panning');return;}
    this.renderer.setSelected(hit?.id||null);this.onSelect(hit||null);
    if(hit)this.drag={item:hit,dx:p.x-hit.x,dy:p.y-hit.y};this.onChange(false);
  }
  pointerMove(event){if(!this.enabled&&!this.pan)return;if(this.pan){const p=this.canvasPoint(event);this.view.x=this.pan.start.x+p.x-this.pan.raw.x;this.view.y=this.pan.start.y+p.y-this.pan.raw.y;this.renderer.setView(this.view);this.onChange(false);return;}
    if(this.drag){const p=this.worldPoint(event);this.drag.item.x=Math.round((p.x-this.drag.dx)/10)*10;this.drag.item.y=Math.round((p.y-this.drag.dy)/10)*10;this.onSelect(this.drag.item);this.onChange(false);}
  }
  pointerUp(){if(this.drag)this.onChange(true);this.drag=null;this.pan=null;this.canvas.classList.remove('panning');}
  wheel(event){event.preventDefault();const before=this.worldPoint(event),factor=event.deltaY<0?1.12:.88;this.view.zoom=Math.max(.2,Math.min(8,this.view.zoom*factor));const raw=this.canvasPoint(event);this.view.x=raw.x-before.x*this.view.zoom;this.view.y=raw.y-before.y*this.view.zoom;this.renderer.setView(this.view);this.onChange(false);}
  resetView(){this.view={zoom:1,x:0,y:0};this.renderer.setView(this.view);this.onChange(false);}
  add(type){const layout=this.getLayout(),count=layout.equipment.filter(item=>item.type===type).length+1;const item={id:`${type}-custom-${Date.now()}`,type,name:`새 ${type} ${count}`,x:layout.canvas.width/2,y:layout.canvas.height/2};layout.equipment.push(item);this.renderer.setSelected(item.id);this.onSelect(item);this.onChange(true);}
  remove(id){const layout=this.getLayout(),index=layout.equipment.findIndex(item=>item.id===id);if(index<0)return false;const item=layout.equipment[index];if(!item.id.includes('-custom-'))return false;layout.equipment.splice(index,1);this.renderer.setSelected(null);this.onSelect(null);this.onChange(true);return true;}
}
