import { closestPortPair, connectionAnchor, orthogonalRoute } from './route.js';

const movable = item => Number.isFinite(item?.x) && Number.isFinite(item?.y);

const segmentDistance=(point,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;if(!length)return Math.hypot(point.x-a.x,point.y-a.y);const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/length)),x=a.x+t*dx,y=a.y+t*dy;return Math.hypot(point.x-x,point.y-y);};

export function insertEquipmentIntoNearestEdge(layout,item,maxDistance=58){
  const schematic=layout.cadSchematic,edges=schematic?.edges||[],byId=new Map(layout.equipment.map(node=>[node.id,node]));let nearest=null;
  edges.forEach((edge,index)=>{const from=byId.get(edge.from),to=byId.get(edge.to);if(!from||!to||edge.from===item.id||edge.to===item.id)return;const points=orthogonalRoute(connectionAnchor(from,edge.fromPort),connectionAnchor(to,edge.toPort)),distance=Math.min(...points.slice(1).map((point,i)=>segmentDistance(item,points[i],point)));if(!nearest||distance<nearest.distance)nearest={edge,index,from,to,distance};});
  if(!nearest||nearest.distance>maxDistance)return null;
  const firstPorts=closestPortPair(nearest.from,item),secondPorts=closestPortPair(item,nearest.to),base={kind:nearest.edge.kind||'flow',manual:true,autoInserted:item.id};
  schematic.edges.splice(nearest.index,1,
    {...base,from:nearest.edge.from,to:item.id,fromPort:nearest.edge.fromPort||firstPorts.fromPort,toPort:firstPorts.toPort},
    {...base,from:item.id,to:nearest.edge.to,fromPort:secondPorts.fromPort,toPort:nearest.edge.toPort||secondPorts.toPort});
  for(const lane of schematic.lanes||[]){const index=(lane.nodes||[]).findIndex(node=>node.id===nearest.edge.from);if(index>=0&&lane.nodes[index+1]?.id===nearest.edge.to)lane.nodes.splice(index+1,0,item);}
  for(const branch of schematic.inboundBranches||[]){const index=(branch.nodeIds||[]).indexOf(nearest.edge.from);if(index>=0&&branch.nodeIds[index+1]===nearest.edge.to)branch.nodeIds.splice(index+1,0,item.id);}
  return {replaced:nearest.edge,edges:schematic.edges.slice(nearest.index,nearest.index+2),distance:nearest.distance};
}

export function removeEquipmentAndReconnect(layout,id){
  const index=layout.equipment.findIndex(item=>item.id===id);if(index<0)return false;
  const schematic=layout.cadSchematic,edges=schematic?.edges||[],incoming=edges.filter(edge=>edge.to===id),outgoing=edges.filter(edge=>edge.from===id),remaining=edges.filter(edge=>edge.from!==id&&edge.to!==id),priority={flow:0,handoff:1,forking:2,warehouse:3,transfer:4};
  for(const before of incoming)for(const after of outgoing){if(before.from===after.to||remaining.some(edge=>edge.from===before.from&&edge.to===after.to))continue;const kind=(priority[before.kind||'flow']>=priority[after.kind||'flow']?before.kind:after.kind)||'flow';remaining.push({from:before.from,to:after.to,kind,manual:true,autoBypass:id});}
  layout.equipment.splice(index,1);
  if(schematic){schematic.edges=remaining;for(const lane of schematic.lanes||[])lane.nodes=(lane.nodes||[]).filter(node=>node.id!==id);schematic.inboundBranches=(schematic.inboundBranches||[]).map(branch=>({...branch,nodeIds:(branch.nodeIds||[]).filter(nodeId=>nodeId!==id)})).filter(branch=>branch.nodeIds.length);if(schematic.warehouseId===id)schematic.warehouseId=null;}
  return true;
}

export class LayoutEditor {
  constructor(canvas, renderer, getLayout, onChange, onSelect, onConnect, onModeChange) {
    this.canvas=canvas;this.renderer=renderer;this.getLayout=getLayout;this.onChange=onChange;this.onSelect=onSelect;this.onConnect=onConnect;this.onModeChange=onModeChange;
    this.enabled=false;this.drag=null;this.pan=null;this.connecting=false;this.connectionSource=null;this.placementType=null;this.view={zoom:1,x:0,y:0};
    canvas.addEventListener('pointerdown',e=>this.pointerDown(e));
    canvas.addEventListener('pointermove',e=>this.pointerMove(e));
    canvas.addEventListener('pointerup',()=>this.pointerUp());
    canvas.addEventListener('pointerleave',()=>this.pointerUp());
    canvas.addEventListener('wheel',e=>this.wheel(e),{passive:false});
    canvas.addEventListener('contextmenu',e=>{if(this.placementType||this.connecting){e.preventDefault();this.cancelModes();}});
    canvas.ownerDocument.addEventListener('keydown',e=>{if(e.key==='Escape')this.cancelModes();});
  }
  setEnabled(value){this.enabled=value;this.canvas.classList.toggle('editing',value);}
  setConnectionMode(value,sourceId=null){this.connecting=value;this.connectionSource=value?sourceId:null;this.renderer.setConnectionMode(value,this.connectionSource);this.onModeChange?.({connecting:value,sourceId:this.connectionSource,placement:this.placementType});this.onChange(false);}
  beginPlacement(type){this.placementType=type;this.setConnectionMode(false);this.canvas.classList.add('placing');this.renderer.setPlacementPreview(type,null);this.onModeChange?.({connecting:false,sourceId:null,placement:type});this.onChange(false);}
  cancelModes(){this.placementType=null;this.canvas.classList.remove('placing');this.renderer.setPlacementPreview(null,null);this.setConnectionMode(false);}
  canvasPoint(event){const rect=this.canvas.getBoundingClientRect(),sx=this.canvas.width/rect.width,sy=this.canvas.height/rect.height;return{x:(event.clientX-rect.left)*sx,y:(event.clientY-rect.top)*sy};}
  worldPoint(event){const p=this.canvasPoint(event);return{x:(p.x-this.view.x)/this.view.zoom,y:(p.y-this.view.y)/this.view.zoom};}
  hit(point){return [...this.getLayout().equipment].reverse().find(item=>{if(!movable(item)||item.type==='processLine')return false;const wide=['stackerCrane','asrs'].includes(item.type)?72:['dock','source','sink'].includes(item.type)?52:42,tall=['stackerCrane','asrs'].includes(item.type)?54:42;return Math.abs(point.x-item.x)<wide&&Math.abs(point.y-item.y)<tall;});}
  pointerDown(event){const p=this.worldPoint(event),hit=this.hit(p);
    if(event.button===1||event.shiftKey){event.preventDefault();this.canvas.setPointerCapture(event.pointerId);const raw=this.canvasPoint(event);this.pan={raw,start:{...this.view}};this.canvas.classList.add('panning');return;}
    if(event.button!==0)return;
    if(this.placementType){const {item,insertion}=this.addAt(this.placementType,p);this.placementType=null;this.canvas.classList.remove('placing');this.renderer.setPlacementPreview(null,null);if(insertion){this.setConnectionMode(false);this.onModeChange?.({connecting:false,sourceId:null,placement:null,insertion,item});}else this.setConnectionMode(true,item.id);return;}
    if(this.connecting){if(!hit)return;if(!this.connectionSource){this.connectionSource=hit.id;this.renderer.setConnectionMode(true,hit.id);this.onSelect(hit);this.onChange(false);return;}if(hit.id!==this.connectionSource&&this.onConnect?.(this.connectionSource,hit.id)){this.setConnectionMode(false);this.onSelect(hit);}return;}
    this.renderer.setSelected(hit?.id||null);this.onSelect(hit||null);
    if(this.enabled&&hit){this.canvas.setPointerCapture(event.pointerId);this.drag={item:hit,dx:p.x-hit.x,dy:p.y-hit.y};}this.onChange(false);
  }
  pointerMove(event){if(this.placementType){this.renderer.setPlacementPreview(this.placementType,this.worldPoint(event));this.onChange(false);return;}if(!this.enabled&&!this.pan)return;if(this.pan){const p=this.canvasPoint(event);this.view.x=this.pan.start.x+p.x-this.pan.raw.x;this.view.y=this.pan.start.y+p.y-this.pan.raw.y;this.renderer.setView(this.view);this.onChange(false);return;}
    if(this.drag){const p=this.worldPoint(event);this.drag.item.x=Math.round((p.x-this.drag.dx)/10)*10;this.drag.item.y=Math.round((p.y-this.drag.dy)/10)*10;this.onSelect(this.drag.item);this.onChange(false);}
  }
  pointerUp(){if(this.drag)this.onChange(true);this.drag=null;this.pan=null;this.canvas.classList.remove('panning');}
  wheel(event){event.preventDefault();const before=this.worldPoint(event),factor=event.deltaY<0?1.12:.88;this.view.zoom=Math.max(.2,Math.min(8,this.view.zoom*factor));const raw=this.canvasPoint(event);this.view.x=raw.x-before.x*this.view.zoom;this.view.y=raw.y-before.y*this.view.zoom;this.renderer.setView(this.view);this.onChange(false);}
  resetView(){this.view={zoom:1,x:0,y:0};this.renderer.setView(this.view);this.onChange(false);}
  addAt(type,point){const layout=this.getLayout(),count=layout.equipment.filter(item=>item.type===type).length+1,cad=layout.displayMode==='cad',item={id:`${type}-custom-${Date.now()}`,type,name:`새 ${type} ${count}`,x:Math.round(point.x/10)*10,y:Math.round(point.y/10)*10,rotation:0,parameters:{},...(cad?{source:{origin:'dxf',inferred:false,reason:'manual-add'},reviewStatus:'approved'}:{})};layout.equipment.push(item);const insertion=insertEquipmentIntoNearestEdge(layout,item);this.renderer.setSelected(item.id);this.onSelect(item);this.onChange(true);return {item,insertion};}
  remove(id){const layout=this.getLayout();if(!removeEquipmentAndReconnect(layout,id))return false;this.renderer.setSelected(null);this.onSelect(null);this.onChange(true);return true;}
}
