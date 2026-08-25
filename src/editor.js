import { closestPortPair, connectionAnchor, connectionKind, edgeRoute, equipmentDirectionControls, equipmentPorts } from './route.js';

const movable = item => Number.isFinite(item?.x) && Number.isFinite(item?.y);
export const snapUnit=value=>Math.round(Number(value)||0);
export const isSelectedEdgeHit=(selectedIndex,hit)=>Number.isInteger(selectedIndex)&&hit?.index===selectedIndex;

export function setEquipmentFlowDirection(layout,id,direction){const item=layout.equipment.find(node=>node.id===id),edges=layout.cadSchematic?.edges||[];if(!item||!['left','right','up','down'].includes(direction))return 0;item.parameters??={};item.parameters.flowDirection=direction;const horizontal=['left','right'].includes(direction),positive=['right','down'].includes(direction);let changed=0;for(const edge of edges){if(edge.from!==id&&edge.to!==id)continue;const neighbor=layout.equipment.find(node=>node.id===(edge.from===id?edge.to:edge.from));if(!neighbor)continue;const delta=horizontal?neighbor.x-item.x:neighbor.y-item.y,wantsOutgoing=positive?delta>0:delta<0,isOutgoing=edge.from===id;if(wantsOutgoing===isOutgoing)continue;[edge.from,edge.to]=[edge.to,edge.from];[edge.fromPort,edge.toPort]=[edge.toPort,edge.fromPort];changed++;}return changed;}

export function itemsInRect(items,start,end){const left=Math.min(start.x,end.x),right=Math.max(start.x,end.x),top=Math.min(start.y,end.y),bottom=Math.max(start.y,end.y);return items.filter(item=>movable(item)&&item.type!=='processLine'&&item.x>=left&&item.x<=right&&item.y>=top&&item.y<=bottom);}

const segmentDistance=(point,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;if(!length)return Math.hypot(point.x-a.x,point.y-a.y);const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/length)),x=a.x+t*dx,y=a.y+t*dy;return Math.hypot(point.x-x,point.y-y);};

export function insertEquipmentIntoNearestEdge(layout,item,maxDistance=58){
  const schematic=layout.cadSchematic,edges=schematic?.edges||[],byId=new Map(layout.equipment.map(node=>[node.id,node]));let nearest=null;
  edges.forEach((edge,index)=>{const from=byId.get(edge.from),to=byId.get(edge.to);if(!from||!to||edge.from===item.id||edge.to===item.id)return;const points=edgeRoute(connectionAnchor(from,edge.fromPort),connectionAnchor(to,edge.toPort),edge),distance=Math.min(...points.slice(1).map((point,i)=>segmentDistance(item,points[i],point)));if(!nearest||distance<nearest.distance)nearest={edge,index,from,to,distance};});
  if(!nearest||nearest.distance>maxDistance)return null;
  const firstPorts=closestPortPair(nearest.from,item),secondPorts=closestPortPair(item,nearest.to),base={manual:true,autoInserted:item.id};
  schematic.edges.splice(nearest.index,1,
    {...base,kind:connectionKind(nearest.from,item,nearest.edge.kind),from:nearest.edge.from,to:item.id,fromPort:nearest.edge.fromPort||firstPorts.fromPort,toPort:firstPorts.toPort},
    {...base,kind:connectionKind(item,nearest.to,nearest.edge.kind),from:item.id,to:nearest.edge.to,fromPort:secondPorts.fromPort,toPort:nearest.edge.toPort||secondPorts.toPort});
  for(const lane of schematic.lanes||[]){const index=(lane.nodes||[]).findIndex(node=>node.id===nearest.edge.from);if(index>=0&&lane.nodes[index+1]?.id===nearest.edge.to)lane.nodes.splice(index+1,0,item);}
  for(const branch of schematic.inboundBranches||[]){const index=(branch.nodeIds||[]).indexOf(nearest.edge.from);if(index>=0&&branch.nodeIds[index+1]===nearest.edge.to)branch.nodeIds.splice(index+1,0,item.id);}
  return {replaced:nearest.edge,edges:schematic.edges.slice(nearest.index,nearest.index+2),distance:nearest.distance};
}

export function refreshEquipmentConnections(layout,id){
  const item=layout.equipment.find(node=>node.id===id);if(!item)return 0;const byId=new Map(layout.equipment.map(node=>[node.id,node]));let changed=0;
  for(const edge of layout.cadSchematic?.edges||[]){if(edge.from!==id&&edge.to!==id)continue;const from=byId.get(edge.from),to=byId.get(edge.to);if(!from||!to)continue;if(edge.manual&&edge.fromPort&&edge.toPort){changed++;continue;}const ports=closestPortPair(from,to);edge.fromPort=edge.from===id?'right':ports.fromPort;edge.toPort=edge.to===id?'left':ports.toPort;changed++;}
  return changed;
}

export function removeConnection(layout,index){const edges=layout.cadSchematic?.edges;if(!edges||!Number.isInteger(index)||index<0||index>=edges.length)return false;edges.splice(index,1);return true;}

export function removeEquipmentAndReconnect(layout,id){
  const index=layout.equipment.findIndex(item=>item.id===id);if(index<0)return false;
  const schematic=layout.cadSchematic,edges=schematic?.edges||[],incoming=edges.filter(edge=>edge.to===id),outgoing=edges.filter(edge=>edge.from===id),remaining=edges.filter(edge=>edge.from!==id&&edge.to!==id),priority={flow:0,handoff:1,forking:2,warehouse:3,transfer:4};
  for(const before of incoming)for(const after of outgoing){if(before.from===after.to||remaining.some(edge=>edge.from===before.from&&edge.to===after.to))continue;const kind=(priority[before.kind||'flow']>=priority[after.kind||'flow']?before.kind:after.kind)||'flow';remaining.push({from:before.from,to:after.to,kind,manual:true,autoBypass:id});}
  layout.equipment.splice(index,1);
  if(schematic){schematic.edges=remaining;for(const lane of schematic.lanes||[])lane.nodes=(lane.nodes||[]).filter(node=>node.id!==id);schematic.inboundBranches=(schematic.inboundBranches||[]).map(branch=>({...branch,nodeIds:(branch.nodeIds||[]).filter(nodeId=>nodeId!==id)})).filter(branch=>branch.nodeIds.length);if(schematic.warehouseId===id)schematic.warehouseId=null;}
  return true;
}

export class LayoutEditor {
  constructor(canvas, renderer, getLayout, onChange, onSelect, onConnect, onModeChange, onEdgeSelect) {
    this.canvas=canvas;this.renderer=renderer;this.getLayout=getLayout;this.onChange=onChange;this.onSelect=onSelect;this.onConnect=onConnect;this.onModeChange=onModeChange;this.onEdgeSelect=onEdgeSelect;
    this.enabled=false;this.drag=null;this.edgeDrag=null;this.connectionDrag=null;this.pan=null;this.marquee=null;this.selectedIds=new Set();this.selectedEdgeIndex=null;this.connecting=false;this.connectionSource=null;this.placementType=null;this.view={zoom:1,x:0,y:0};
    canvas.addEventListener('pointerdown',e=>this.pointerDown(e));
    canvas.addEventListener('pointermove',e=>this.pointerMove(e));
    canvas.addEventListener('pointerup',()=>this.pointerUp());
    canvas.addEventListener('pointerleave',()=>this.pointerUp());
    canvas.addEventListener('wheel',e=>this.wheel(e),{passive:false});
    canvas.addEventListener('contextmenu',e=>{if(this.placementType||this.connecting){e.preventDefault();this.cancelModes();return;}if(!this.enabled)return;const hit=this.hitEdge(this.worldPoint(e));if(hit){e.preventDefault();this.selectEdge(hit.index,{x:e.clientX,y:e.clientY});}else this.selectEdge(null);});
    canvas.ownerDocument.addEventListener('keydown',e=>{if(e.key==='Escape'){this.cancelModes();this.clearSelection();this.selectEdge(null);}});
  }
  setEnabled(value){this.enabled=value;this.canvas.classList.toggle('editing',value);}
  setConnectionMode(value){this.connecting=value;this.connectionSource=null;this.connectionDrag=null;this.renderer.setConnectionMode(value,null);this.renderer.setConnectionPreview(null);this.onModeChange?.({connecting:value,sourceId:null,placement:this.placementType});this.onChange(false);}
  beginPlacement(type){this.placementType=type;this.setConnectionMode(false);this.canvas.classList.add('placing');this.renderer.setPlacementPreview(type,null);this.onModeChange?.({connecting:false,sourceId:null,placement:type});this.onChange(false);}
  cancelModes(){this.placementType=null;this.canvas.classList.remove('placing');this.renderer.setPlacementPreview(null,null);this.setConnectionMode(false);}
  clearSelection(){this.selectedIds.clear();this.renderer.setMultiSelected([]);this.renderer.setMarquee(null);this.onSelect(null);this.onChange(false);}
  canvasPoint(event){const rect=this.canvas.getBoundingClientRect(),sx=this.canvas.width/rect.width,sy=this.canvas.height/rect.height;return{x:(event.clientX-rect.left)*sx,y:(event.clientY-rect.top)*sy};}
  worldPoint(event){const p=this.canvasPoint(event);return{x:(p.x-this.view.x)/this.view.zoom,y:(p.y-this.view.y)/this.view.zoom};}
  hit(point){return [...this.getLayout().equipment].reverse().find(item=>{if(!movable(item)||item.type==='processLine')return false;const wide=['stackerCrane','asrs'].includes(item.type)?72:['dock','source','sink'].includes(item.type)?52:42,tall=['stackerCrane','asrs'].includes(item.type)?54:42;return Math.abs(point.x-item.x)<wide&&Math.abs(point.y-item.y)<tall;});}
  hitPort(point,tolerance=13,excludeId=null){let best=null;for(const item of [...this.getLayout().equipment].reverse()){if(!movable(item)||item.type==='processLine'||item.id===excludeId)continue;for(const [port,anchor] of Object.entries(equipmentPorts(item))){const distance=Math.hypot(point.x-anchor.x,point.y-anchor.y);if(distance<=tolerance&&(!best||distance<best.distance))best={item,port,anchor,distance};}}return best;}
  hitDirectionControl(point,tolerance=15){if(this.selectedIds.size!==1)return null;const id=[...this.selectedIds][0],item=this.getLayout().equipment.find(node=>node.id===id);return equipmentDirectionControls(item).find(control=>Math.hypot(point.x-control.x,point.y-control.y)<=tolerance)||null;}
  hitEdge(point,tolerance=12){const layout=this.getLayout(),byId=new Map(layout.equipment.map(item=>[item.id,item])),edges=layout.cadSchematic?.edges||[];let best=null;edges.forEach((edge,index)=>{const from=byId.get(edge.from),to=byId.get(edge.to);if(!from||!to)return;const points=edgeRoute(connectionAnchor(from,edge.fromPort),connectionAnchor(to,edge.toPort),edge),distance=Math.min(...points.slice(1).map((p,i)=>segmentDistance(point,points[i],p)));if(distance<=tolerance&&(!best||distance<best.distance))best={edge,index,distance};});return best;}
  selectEdge(index,context=null){this.selectedEdgeIndex=Number.isInteger(index)?index:null;this.renderer.setSelectedEdge(this.selectedEdgeIndex);this.onEdgeSelect?.(this.selectedEdgeIndex!==null?this.getLayout().cadSchematic.edges[this.selectedEdgeIndex]:null,this.selectedEdgeIndex,context);this.onChange(false);}
  pointerDown(event){const p=this.worldPoint(event),hit=this.hit(p);
    if(event.button===1||event.shiftKey){event.preventDefault();this.canvas.setPointerCapture(event.pointerId);const raw=this.canvasPoint(event);this.pan={raw,start:{...this.view}};this.canvas.classList.add('panning');return;}
    if(event.button!==0)return;
    const directionControl=this.enabled&&!this.connecting&&!this.placementType?this.hitDirectionControl(p):null;if(directionControl){event.preventDefault();const id=[...this.selectedIds][0];setEquipmentFlowDirection(this.getLayout(),id,directionControl.direction);refreshEquipmentConnections(this.getLayout(),id);this.onSelect(this.getLayout().equipment.find(item=>item.id===id));this.onChange(true);return;}
    if(this.placementType){const {item,insertion}=this.addAt(this.placementType,p);this.placementType=null;this.canvas.classList.remove('placing');this.renderer.setPlacementPreview(null,null);if(insertion){this.setConnectionMode(false);this.onModeChange?.({connecting:false,sourceId:null,placement:null,insertion,item});}else this.setConnectionMode(true);return;}
    if(this.connecting){const portHit=this.hitPort(p);if(!portHit)return;this.canvas.setPointerCapture(event.pointerId);this.connectionDrag={fromId:portHit.item.id,fromPort:portHit.port,start:portHit.anchor,current:p};this.renderer.setConnectionPreview({from:portHit.anchor,to:p});this.onSelect(portHit.item);this.onModeChange?.({connecting:true,sourceId:portHit.item.id,fromPort:portHit.port,placement:null});this.onChange(false);return;}
    const selectedEdgeHit=this.enabled&&this.selectedEdgeIndex!==null?this.hitEdge(p,14):null;if(isSelectedEdgeHit(this.selectedEdgeIndex,selectedEdgeHit)){this.clearSelection();this.selectEdge(selectedEdgeHit.index);this.canvas.setPointerCapture(event.pointerId);this.edgeDrag={start:p,edge:selectedEdgeHit.edge,offset:{x:Number(selectedEdgeHit.edge.routeOffset?.x)||0,y:Number(selectedEdgeHit.edge.routeOffset?.y)||0}};return;}
    const edgeHit=this.enabled&&!hit?this.hitEdge(p):null;if(edgeHit){this.clearSelection();this.selectEdge(edgeHit.index);this.canvas.setPointerCapture(event.pointerId);this.edgeDrag={start:p,edge:edgeHit.edge,offset:{x:Number(edgeHit.edge.routeOffset?.x)||0,y:Number(edgeHit.edge.routeOffset?.y)||0}};return;}
    if(this.enabled&&!hit){this.selectEdge(null);this.clearSelection();this.canvas.setPointerCapture(event.pointerId);this.marquee={start:p,current:p};this.renderer.setMarquee({x:p.x,y:p.y,w:0,h:0});return;}
    this.selectEdge(null);
    if(hit){if(!this.selectedIds.has(hit.id)){this.selectedIds=new Set([hit.id]);this.renderer.setMultiSelected([hit.id]);this.onSelect(hit);}else this.onSelect(this.selectedIds.size===1?hit:null);}
    else this.clearSelection();
    if(this.enabled&&hit){this.canvas.setPointerCapture(event.pointerId);const items=this.getLayout().equipment.filter(item=>this.selectedIds.has(item.id));this.drag={start:p,items:items.map(item=>({item,x:item.x,y:item.y}))};}this.onChange(false);
  }
  pointerMove(event){if(this.placementType){this.renderer.setPlacementPreview(this.placementType,this.worldPoint(event));this.onChange(false);return;}if(!this.enabled&&!this.pan)return;if(this.pan){const p=this.canvasPoint(event);this.view.x=this.pan.start.x+p.x-this.pan.raw.x;this.view.y=this.pan.start.y+p.y-this.pan.raw.y;this.renderer.setView(this.view);this.onChange(false);return;}
    if(this.marquee){const p=this.worldPoint(event),start=this.marquee.start;this.marquee.current=p;this.renderer.setMarquee({x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(p.x-start.x),h:Math.abs(p.y-start.y)});this.onChange(false);return;}
    if(this.connectionDrag){const p=this.worldPoint(event),target=this.hitPort(p,13,this.connectionDrag.fromId),to=target?.anchor||p;this.connectionDrag.current=to;this.connectionDrag.target=target;this.renderer.setConnectionPreview({from:this.connectionDrag.start,to,valid:Boolean(target)});this.onChange(false);return;}
    if(this.edgeDrag){const p=this.worldPoint(event),dx=snapUnit(p.x-this.edgeDrag.start.x),dy=snapUnit(p.y-this.edgeDrag.start.y);this.edgeDrag.edge.routeOffset={x:snapUnit(this.edgeDrag.offset.x+dx),y:snapUnit(this.edgeDrag.offset.y+dy)};this.onChange(false);return;}
    if(this.drag){const p=this.worldPoint(event),dx=snapUnit(p.x-this.drag.start.x),dy=snapUnit(p.y-this.drag.start.y);for(const entry of this.drag.items){entry.item.x=snapUnit(entry.x+dx);entry.item.y=snapUnit(entry.y+dy);refreshEquipmentConnections(this.getLayout(),entry.item.id);}this.onSelect(this.drag.items.length===1?this.drag.items[0].item:null);this.onChange(false);}
  }
  pointerUp(){if(this.connectionDrag){const drag=this.connectionDrag,target=drag.target;if(target)this.onConnect?.(drag.fromId,target.item.id,drag.fromPort,target.port);this.connectionDrag=null;this.renderer.setConnectionPreview(null);this.onChange(Boolean(target));}if(this.marquee){const selected=itemsInRect(this.getLayout().equipment,this.marquee.start,this.marquee.current),ids=selected.map(item=>item.id);this.selectedIds=new Set(ids);this.renderer.setMultiSelected(ids);this.renderer.setMarquee(null);this.onSelect(selected.length===1?selected[0]:null);this.onModeChange?.({connecting:false,placement:null,selectionCount:ids.length});this.marquee=null;this.onChange(false);}if(this.drag||this.edgeDrag)this.onChange(true);this.drag=null;this.edgeDrag=null;this.pan=null;this.canvas.classList.remove('panning');}
  wheel(event){event.preventDefault();const before=this.worldPoint(event),factor=event.deltaY<0?1.12:.88;this.view.zoom=Math.max(.2,Math.min(8,this.view.zoom*factor));const raw=this.canvasPoint(event);this.view.x=raw.x-before.x*this.view.zoom;this.view.y=raw.y-before.y*this.view.zoom;this.renderer.setView(this.view);this.onChange(false);}
  resetView(){this.view={zoom:1,x:0,y:0};this.renderer.setView(this.view);this.onChange(false);}
  addAt(type,point){const layout=this.getLayout(),count=layout.equipment.filter(item=>item.type===type).length+1,cad=layout.displayMode==='cad',defaults={conveyor:{length:5,speed:.5},agv:{speed:1.2,shuttleDistance:5,loadTime:2,unloadTime:2},amr:{speed:1.5,shuttleDistance:5,loadTime:2,unloadTime:2},turntable:{rotationTime:6,positions:2},forklift:{speed:1.5,loadTime:8,unloadTime:8,loadCapacity:1500},forkingDevice:{forkTime:4,strokeDistance:1.5,loadCapacity:1000,distributionEnabled:true,distributionFlowKeys:[],output1Ratio:50}},labels={conveyor:'컨베이어',forklift:'지게차',forkingDevice:'포킹장치',turntable:'턴테이블'},item={id:`${type}-custom-${Date.now()}`,type,name:`새 ${labels[type]||type} ${count}`,x:snapUnit(point.x),y:snapUnit(point.y),rotation:0,parameters:{...(defaults[type]||{})},...(cad?{source:{origin:'dxf',inferred:false,reason:'manual-add',...(type==='conveyor'?{parameterLengthUnit:'m'}:{})},reviewStatus:'approved'}:{})};layout.equipment.push(item);const insertion=insertEquipmentIntoNearestEdge(layout,item);this.selectedIds=new Set([item.id]);this.renderer.setSelected(item.id);this.onSelect(item);this.onChange(true);return {item,insertion};}
  remove(id){const layout=this.getLayout();if(!removeEquipmentAndReconnect(layout,id))return false;this.renderer.setSelected(null);this.onSelect(null);this.onChange(true);return true;}
  removeEdge(index){if(!removeConnection(this.getLayout(),index))return false;this.selectEdge(null);this.onChange(true);return true;}
}
