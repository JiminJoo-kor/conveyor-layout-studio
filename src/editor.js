const movable = item => Number.isFinite(item?.x) && Number.isFinite(item?.y);

export class LayoutEditor {
  constructor(canvas, renderer, getLayout, onChange, onSelect, onConnect) {
    this.canvas=canvas;this.renderer=renderer;this.getLayout=getLayout;this.onChange=onChange;this.onSelect=onSelect;this.onConnect=onConnect;
    this.enabled=false;this.drag=null;this.pan=null;this.connecting=false;this.connectionSource=null;this.view={zoom:1,x:0,y:0};
    canvas.addEventListener('pointerdown',e=>this.pointerDown(e));
    canvas.addEventListener('pointermove',e=>this.pointerMove(e));
    canvas.addEventListener('pointerup',()=>this.pointerUp());
    canvas.addEventListener('pointerleave',()=>this.pointerUp());
    canvas.addEventListener('wheel',e=>this.wheel(e),{passive:false});
  }
  setEnabled(value){this.enabled=value;this.canvas.classList.toggle('editing',value);}
  setConnectionMode(value,sourceId=null){this.connecting=value;this.connectionSource=value?sourceId:null;this.renderer.setConnectionMode(value,this.connectionSource);this.onChange(false);}
  canvasPoint(event){const rect=this.canvas.getBoundingClientRect(),sx=this.canvas.width/rect.width,sy=this.canvas.height/rect.height;return{x:(event.clientX-rect.left)*sx,y:(event.clientY-rect.top)*sy};}
  worldPoint(event){const p=this.canvasPoint(event);return{x:(p.x-this.view.x)/this.view.zoom,y:(p.y-this.view.y)/this.view.zoom};}
  hit(point){return [...this.getLayout().equipment].reverse().find(item=>{if(!movable(item)||item.type==='processLine')return false;const wide=['stackerCrane','asrs'].includes(item.type)?72:['dock','source','sink'].includes(item.type)?52:42,tall=['stackerCrane','asrs'].includes(item.type)?54:42;return Math.abs(point.x-item.x)<wide&&Math.abs(point.y-item.y)<tall;});}
  pointerDown(event){const p=this.worldPoint(event),hit=this.hit(p);
    if(event.button===1||event.shiftKey){event.preventDefault();this.canvas.setPointerCapture(event.pointerId);const raw=this.canvasPoint(event);this.pan={raw,start:{...this.view}};this.canvas.classList.add('panning');return;}
    if(event.button!==0)return;
    if(this.connecting){if(!hit)return;if(!this.connectionSource){this.connectionSource=hit.id;this.renderer.setConnectionMode(true,hit.id);this.onSelect(hit);this.onChange(false);return;}if(hit.id!==this.connectionSource&&this.onConnect?.(this.connectionSource,hit.id)){this.setConnectionMode(false);this.onSelect(hit);}return;}
    this.renderer.setSelected(hit?.id||null);this.onSelect(hit||null);
    if(this.enabled&&hit){this.canvas.setPointerCapture(event.pointerId);this.drag={item:hit,dx:p.x-hit.x,dy:p.y-hit.y};}this.onChange(false);
  }
  pointerMove(event){if(!this.enabled&&!this.pan)return;if(this.pan){const p=this.canvasPoint(event);this.view.x=this.pan.start.x+p.x-this.pan.raw.x;this.view.y=this.pan.start.y+p.y-this.pan.raw.y;this.renderer.setView(this.view);this.onChange(false);return;}
    if(this.drag){const p=this.worldPoint(event);this.drag.item.x=Math.round((p.x-this.drag.dx)/10)*10;this.drag.item.y=Math.round((p.y-this.drag.dy)/10)*10;this.onSelect(this.drag.item);this.onChange(false);}
  }
  pointerUp(){if(this.drag)this.onChange(true);this.drag=null;this.pan=null;this.canvas.classList.remove('panning');}
  wheel(event){event.preventDefault();const before=this.worldPoint(event),factor=event.deltaY<0?1.12:.88;this.view.zoom=Math.max(.2,Math.min(8,this.view.zoom*factor));const raw=this.canvasPoint(event);this.view.x=raw.x-before.x*this.view.zoom;this.view.y=raw.y-before.y*this.view.zoom;this.renderer.setView(this.view);this.onChange(false);}
  resetView(){this.view={zoom:1,x:0,y:0};this.renderer.setView(this.view);this.onChange(false);}
  add(type){const layout=this.getLayout(),count=layout.equipment.filter(item=>item.type===type).length+1,cad=layout.displayMode==='cad',item={id:`${type}-custom-${Date.now()}`,type,name:`새 ${type} ${count}`,x:layout.canvas.width/2,y:layout.canvas.height/2,parameters:{},...(cad?{source:{origin:'dxf',inferred:false,reason:'manual-add'},reviewStatus:'approved'}:{})};layout.equipment.push(item);this.renderer.setSelected(item.id);this.onSelect(item);this.onChange(true);this.setConnectionMode(true,item.id);return item;}
  remove(id){const layout=this.getLayout(),index=layout.equipment.findIndex(item=>item.id===id);if(index<0)return false;layout.equipment.splice(index,1);const schematic=layout.cadSchematic;if(schematic){schematic.edges=(schematic.edges||[]).filter(edge=>edge.from!==id&&edge.to!==id);for(const lane of schematic.lanes||[])lane.nodes=(lane.nodes||[]).filter(node=>node.id!==id);schematic.inboundBranches=(schematic.inboundBranches||[]).map(branch=>({...branch,nodeIds:(branch.nodeIds||[]).filter(nodeId=>nodeId!==id)})).filter(branch=>branch.nodeIds.length);if(schematic.warehouseId===id)schematic.warehouseId=null;}this.renderer.setSelected(null);this.onSelect(null);this.onChange(true);return true;}
}
