const COLORS = { bg:'#071019', panel:'#0c1824', line:'#17334a', cyan:'#00d4ff', green:'#00ff88', yellow:'#ffd166', orange:'#ff7139', pink:'#ff4d9d', text:'#9fc5dd' };
const FLOW_COLORS=['#00d4ff','#00ff88','#ffd166','#ff4d9d','#ff7139','#a78bfa','#38bdf8','#fb7185'];
import { connectionAnchor, edgeRoute, equipmentDirectionControls, equipmentPorts, orthogonalRoute, pointOnRoute, routeArrow, routeLength } from './route.js';
import { itemVisualLength } from './occupancy.js';
import { asrsOperationSnapshot, equipmentLengthMeters } from './engine.js';

export const isNodeConveyor = item => item.type === 'conveyor' && Array.isArray(item.nodes);
export const laneTitleAnchor = nodes => nodes.find(node=>node.type==='dock'||node.type==='sink'||node.type==='source')||nodes[0];
export const asrsOccupiedSlots=(inventory,capacity,slots=16)=>Math.min(slots,Math.ceil(slots*Math.max(0,Number(inventory)||0)/Math.max(1,Number(capacity)||1)));
export const asrsRackCells=(asrs,tokens=[])=>Object.entries(asrs?.zones||{}).map(([name,zone])=>{const cargoTypes=Object.fromEntries(tokens.filter(token=>token.nodeId===asrs?.equipmentId&&token.flowKey===name&&token.asrsTarget).map(token=>[token.asrsTarget.index,token.cargoType||token.originFlowKey||token.flowKey]));return{name,capacity:Math.max(1,Number(zone.capacity)||Number(asrs.cellCount)||1),inventory:Math.max(0,Number(zone.inventory)||0),cells:Array.isArray(zone.occupiedSlots)?zone.occupiedSlots.slice():Array.from({length:Math.max(1,Number(zone.capacity)||Number(asrs.cellCount)||1)},(_,index)=>index<Math.max(0,Number(zone.inventory)||0)),cargoTypes};});
export const flowColor=(flowKey='',flowIndex)=>{const index=Number.isInteger(flowIndex)?flowIndex:[...String(flowKey)].reduce((sum,char)=>sum+char.codePointAt(0),0);return FLOW_COLORS[Math.abs(index)%FLOW_COLORS.length];};
export const cargoColor=(cargoType='',flowIndex)=>{const key=String(cargoType||`물류 ${Number(flowIndex||0)+1}`),hash=[...key].reduce((sum,char)=>((sum*31+char.codePointAt(0))>>>0),17),palette=['#facc15','#ef4444','#c084fc','#fb923c','#22d3ee','#f472b6','#bef264','#fca5a5'];return palette[hash%palette.length];};
export const shouldDrawCadToken=(token,node)=>Boolean(token?.edge)||!['asrs','stackerCrane'].includes(node?.type)||['putaway','retrieval'].includes(token?.asrsPhase);
export const normalizedCargoSpec=layout=>{const spec=layout?.cargoSpec||{},millimeters=spec.unit==='mm'||Number(spec.length)>20||Number(spec.width)>20,scale=millimeters ? .001 : 1;return{length:Number(spec.length||(millimeters?1200:1.2))*scale,width:Number(spec.width||(millimeters?800:.8))*scale,weight:Number(spec.weight||100),lengthMm:Number(spec.length||(millimeters?1200:1.2))*(millimeters?1:1000),widthMm:Number(spec.width||(millimeters?800:.8))*(millimeters?1:1000)};};
export const scaleRatioItemVisualSize=(commonEquipmentVisualSize,itemPhysicalLength,equipmentPhysicalLength)=>itemVisualLength(commonEquipmentVisualSize,itemPhysicalLength,equipmentPhysicalLength);
export function stableCargoVisualMetrics(layout,cargo,commonVisualLength=78){const lengths=(layout?.equipment||[]).filter(item=>item.type==='conveyor'&&item.source?.origin==='dxf').map(item=>equipmentLengthMeters(item,layout)),referenceLength=lengths.length?Math.max(...lengths):Math.max(cargo.length,5),scale=commonVisualLength/referenceLength;return{scale,visualLength:Math.max(.1,Math.min(commonVisualLength*.9,cargo.length*scale)),visualWidth:Math.max(2,Math.min(18,cargo.width*scale))};}
export function conveyorFlowSign(item){const direction=item?.parameters?.flowDirection;if(!direction)return 1;const angle=(Number(item?.rotation)||0)*Math.PI/180,localRight={x:Math.cos(angle),y:Math.sin(angle)},world={left:{x:-1,y:0},right:{x:1,y:0},up:{x:0,y:-1},down:{x:0,y:1}}[direction];return world&&localRight.x*world.x+localRight.y*world.y<0?-1:1;}
export function conveyorCargoVisualPose(item,cargo,physicalPosition,commonVisualLength=78,fixedMetrics=null,physicalLengthOverride=null){const physicalLength=Math.max(.1,Number(physicalLengthOverride)||Number(item?.parameters?.length)||cargo.length),scale=commonVisualLength/physicalLength,angle=(Number(item?.rotation)||0)*Math.PI/180,sign=conveyorFlowSign(item),visualLength=fixedMetrics?.visualLength??Math.max(1,cargo.length*scale),visualWidth=fixedMetrics?.visualWidth??Math.max(5,Math.min(24,cargo.width*24/physicalLength)),raw=-commonVisualLength/2+(Math.max(0,Number(physicalPosition)||0)-cargo.length/2)*scale,limit=Math.max(0,commonVisualLength/2-visualLength/2),local=sign*Math.max(-limit,Math.min(limit,raw));return{x:item.x+Math.cos(angle)*local,y:item.y+Math.sin(angle)*local,angle,visualLength,visualWidth,scale};}
export function equipmentClipBounds(item,commonVisualLength=78){if(item?.type==='conveyor')return{width:commonVisualLength,height:28};if(item?.type==='forkingDevice')return{width:58,height:28};if(['agv','amr'].includes(item?.type))return{width:36,height:26};if(['source','sink','dock'].includes(item?.type))return{width:82,height:46};return{width:44,height:36};}
export function handoverEndpointPose(item,port,cargoLength,isTarget=false,other=null,progress=0,commonVisualLength=78){const ports=equipmentPorts(item),resolved=port&&ports[port]?port:Object.entries(ports).sort((a,b)=>Math.hypot(a[1].x-(other?.x??item.x),a[1].y-(other?.y??item.y))-Math.hypot(b[1].x-(other?.x??item.x),b[1].y-(other?.y??item.y)))[0]?.[0],bounds=equipmentClipBounds(item,commonVisualLength),localDirection=resolved==='left'?{x:-1,y:0}:resolved==='top'?{x:0,y:-1}:resolved==='bottom'?{x:0,y:1}:{x:1,y:0},boundaryDistance=Math.abs(localDirection.x)?bounds.width/2:bounds.height/2,rotation=(Number(item?.rotation)||0)*Math.PI/180,outward={x:localDirection.x*Math.cos(rotation)-localDirection.y*Math.sin(rotation),y:localDirection.x*Math.sin(rotation)+localDirection.y*Math.cos(rotation)},boundary={x:item.x+outward.x*boundaryDistance,y:item.y+outward.y*boundaryDistance},ratio=Math.max(0,Math.min(1,Number(progress)||0)),offset=isTarget?cargoLength/2-cargoLength*ratio:-cargoLength/2+cargoLength*ratio,movement=isTarget?{x:-outward.x,y:-outward.y}:outward;return{x:boundary.x+outward.x*offset,y:boundary.y+outward.y*offset,angle:Math.atan2(movement.y,movement.x),port:resolved,bounds};}
export const pendingTransferPose=(source,target,edge,cargoLength,commonVisualLength=78)=>handoverEndpointPose(source,edge?.fromPort,cargoLength,false,target,0,commonVisualLength);

export function mobileEquipmentRoute(layout,item){
  const edges=layout.cadSchematic?.edges||[],byId=new Map(layout.equipment.map(node=>[node.id,node])),incoming=edges.find(edge=>edge.to===item.id),outgoing=edges.find(edge=>edge.from===item.id),before=byId.get(incoming?.from),after=byId.get(outgoing?.to);
  if(before&&after){const start=connectionAnchor(item,incoming.toPort||'left'),end=connectionAnchor(item,outgoing.fromPort||'right');return{start,end,points:orthogonalRoute(start,end),axis:'orthogonal'};}
  if(before){const start=connectionAnchor(before,incoming.fromPort),end=connectionAnchor(item,incoming.toPort||'left');return{start,end,points:orthogonalRoute(start,end),axis:'orthogonal'};}
  if(after){const start=connectionAnchor(item,outgoing.fromPort||'right'),end=connectionAnchor(after,outgoing.toPort);return{start,end,points:orthogonalRoute(start,end),axis:'orthogonal'};}
  return item.shuttleRoute||null;
}

export function equipmentOperationProgress(item,state,activeToken=null,cargoLength=1.2){const token=activeToken||state?.cadTokens?.find(candidate=>candidate.nodeId===item.id&&!candidate.edge);if(!token)return{active:false,progress:0,token:null};const duration=Math.max(.001,Number(token.operationDuration)||Number(item.parameters?.rotationTime)||1),entered=token.nodeEnteredAt??state.t??0,elapsed=Math.max(0,(state.t||0)-entered),raw=Math.min(1,elapsed/duration);if(['agv','amr'].includes(item.type)){const p=item.parameters||{},load=Math.max(0,Number.isFinite(Number(p.receiveSpeed))?cargoLength/Math.max(.1,Number(p.receiveSpeed)):Number(p.loadTime||2))/duration,unload=Math.max(0,Number.isFinite(Number(p.transferSpeed))?cargoLength/Math.max(.1,Number(p.transferSpeed)):Number(p.unloadTime||2))/duration,travelSpan=Math.max(.001,1-load-unload);return{active:true,progress:Math.max(0,Math.min(1,(raw-load)/travelSpan)),token};}return{active:true,progress:raw,token};}
export function equipmentVisualPosition(layout,item,state,activeToken=null){if(!['agv','amr'].includes(item?.type))return{x:item?.x,y:item?.y};const operation=equipmentOperationProgress(item,state,activeToken,normalizedCargoSpec(layout).length),route=mobileEquipmentRoute(layout,item);return operation.active&&route?pointOnRoute(route.points||[route.start,route.end],operation.progress):{x:item.x,y:item.y};}
export function mobileHandoverNode(layout,item,isTarget){if(!['agv','amr'].includes(item?.type))return item;const route=mobileEquipmentRoute(layout,item),position=route?(isTarget?route.start:route.end):{x:item.x,y:item.y};return{...item,x:position.x,y:position.y};}
export function equipmentCargoVisualPose(layout,item,state,token,cargoLength=12,commonVisualLength=78){const edges=layout?.cadSchematic?.edges||[],nodes=new Map((layout?.equipment||[]).map(node=>[node.id,node])),accepted=token?.incomingHandover,legacy=token?.handover?.targetId===item.id?token.handover:null,incoming=accepted?.targetId===item.id?accepted.edge:legacy?.edge||edges.find(edge=>edge.to===item.id),outgoing=edges.find(edge=>edge.from===item.id),before=nodes.get(incoming?.from),after=nodes.get(outgoing?.to),input=handoverEndpointPose(item,incoming?.toPort,cargoLength,true,before,1,commonVisualLength),output=handoverEndpointPose(item,outgoing?.fromPort,cargoLength,false,after,0,commonVisualLength),operation=equipmentOperationProgress(item,state,token),step=token?.operationStep,raw=operation.progress,center={x:item.x,y:item.y};let progress=raw;if(step&&['receive','move','transfer'].includes(step.phase))progress=step.phase==='receive'?.5*step.progress:step.phase==='move'?.5:.5+.5*step.progress;else if(item.type==='forkingDevice'){const p=item.parameters||{},stroke=Math.max(.01,Number(p.strokeDistance)||1.5),receive=stroke/Math.max(.1,Number(p.receiveSpeed)||.5),hold=Math.max(0,Number(p.holdTime)||0),send=stroke/Math.max(.1,Number(p.transferSpeed)||.5),elapsed=Math.max(0,(state?.t||0)-(token?.nodeEnteredAt??state?.t??0));progress=elapsed<receive ? .5*(elapsed/receive) : elapsed<receive+hold ? .5 : Math.min(1,.5+.5*(elapsed-receive-hold)/Math.max(.001,send));}const start=progress<.5?input:center,end=progress<.5?center:output,local=progress<.5?progress*2:(progress-.5)*2,angle=Math.atan2(end.y-start.y,end.x-start.x)||input.angle||0;return{x:start.x+(end.x-start.x)*local,y:start.y+(end.y-start.y)*local,angle};}

export class LayoutRenderer {
  constructor(canvas, layout) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.view = { zoom: 1, x: 0, y: 0 };
    this.backgroundImage = null;
    this.selectedId = null;
    this.selectedIds=new Set();this.selectedEdgeIndex=null;this.marquee=null;this.connectionMode=false;this.connectionSourceId=null;this.connectionPreview=null;this.placementPreview={type:null,point:null};this.flowFilter='all';
    this.setLayout(layout);
  }

  setView(view) { this.view = { ...this.view, ...view }; }
  setSelected(id) { this.selectedId=id;this.selectedIds=new Set(id?[id]:[]); }
  setMultiSelected(ids=[]) { this.selectedIds=new Set(ids);this.selectedId=ids.length===1?ids[0]:null; }
  isSelected(id){return this.selectedIds.has(id)||this.selectedId===id;}
  setMarquee(rect){this.marquee=rect;}
  setSelectedEdge(index=null){this.selectedEdgeIndex=Number.isInteger(index)?index:null;}
  setConnectionMode(value,sourceId=null){this.connectionMode=value;this.connectionSourceId=sourceId;}
  setConnectionPreview(preview){this.connectionPreview=preview;}
  setPlacementPreview(type,point){this.placementPreview={type,point};}
  setFlowFilter(flowKey='all'){this.flowFilter=flowKey||'all';}
  async setBackground(source) {
    if (!source) { this.backgroundImage = null; return; }
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = source; });
    this.backgroundImage = image;
  }

  setLayout(layout) {
    this.layout = layout;
    this.canvas.width = layout.canvas.width;
    this.canvas.height = layout.canvas.height;
    this.nodePositions = new Map();
    for (const line of layout.equipment.filter(item=>isNodeConveyor(item)&&this.isVisible(item))) {
      line.nodes.forEach((node, index) => this.nodePositions.set(node.id, { x: line.x + index * 88, y: line.y, lineId: line.id, index }));
    }
  }

  isVisible(item) { return this.layout.displayMode!=='cad'||item.source?.origin==='dxf'; }

  draw(state) {
    const c = this.ctx, { width, height, grid } = this.layout.canvas;
    c.fillStyle = COLORS.bg; c.fillRect(0, 0, width, height);
    c.save(); c.translate(this.view.x, this.view.y); c.scale(this.view.zoom, this.view.zoom);
    if (this.backgroundImage) { c.globalAlpha=.32; c.drawImage(this.backgroundImage,0,0,width,height); c.globalAlpha=1; }
    c.strokeStyle = 'rgba(70,120,150,.08)'; c.lineWidth = 1;
    for (let x = 0; x < width; x += grid) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,height); c.stroke(); }
    for (let y = 0; y < height; y += grid) { c.beginPath(); c.moveTo(0,y); c.lineTo(width,y); c.stroke(); }
    if(['raw','hybrid'].includes(this.layout.cadViewMode))this.drawDxfGeometry();
    if(this.layout.displayMode==='cad'&&this.layout.cadViewMode!=='raw')this.drawCadSchematic(state);
    const lines = this.layout.equipment.filter(item=>isNodeConveyor(item)&&this.isVisible(item));
    lines.forEach(line => this.drawLine(line, line.trayKinds.includes('C') ? state.product : state.source));
    if(this.layout.displayMode!=='cad')this.drawConnections();
    this.drawEquipment(state);
    this.drawDirectionControls();
    this.drawConnectionPreview();
    this.drawMarquee();
    this.drawPlacementPreview();
    if(this.layout.displayMode==='cad'){const nodes=new Map(this.layout.equipment.map(item=>[item.id,item])),cadTokens=(state.cadTokens||[]).filter(token=>(this.flowFilter==='all'||token.flowKey===this.flowFilter)&&shouldDrawCadToken(token,nodes.get(token.nodeId))),visibleState={...state,cadTokens};this.drawCadFlow(visibleState);this.drawHandoverOverlay(visibleState);}
    c.restore();
  }

  drawDirectionControls(){if(!this.selectedId)return;const item=this.layout.equipment.find(node=>node.id===this.selectedId);if(!item||item.type==='processLine')return;const c=this.ctx,active=item.parameters?.flowDirection;for(const control of equipmentDirectionControls(item)){c.save();c.beginPath();c.arc(control.x,control.y,13,0,Math.PI*2);c.fillStyle=active===control.direction?'rgba(0,255,136,.95)':'rgba(5,18,29,.96)';c.strokeStyle=active===control.direction?COLORS.green:COLORS.yellow;c.lineWidth=2;c.fill();c.stroke();c.fillStyle=active===control.direction?'#05231a':'#fff2a8';c.font='bold 15px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(control.label,control.x,control.y+1);c.restore();}}

  drawMarquee(){if(!this.marquee)return;const {x,y,w,h}=this.marquee,c=this.ctx;c.save();c.fillStyle='rgba(0,212,255,.1)';c.strokeStyle=COLORS.cyan;c.lineWidth=1.5;c.setLineDash([6,4]);c.fillRect(x,y,w,h);c.strokeRect(x,y,w,h);c.restore();}

  drawDxfGeometry(){
    const c=this.ctx,geometry=this.layout.dxfGeometry||[];if(!geometry.length)return;
    c.save();c.strokeStyle='rgba(0,212,255,.62)';c.lineWidth=1.4;c.lineJoin='round';c.lineCap='round';
    for(const shape of geometry){c.beginPath();
      if(shape.type==='LINE'){c.moveTo(shape.start.x,shape.start.y);c.lineTo(shape.end.x,shape.end.y);}
      else if(shape.type==='LWPOLYLINE'||shape.type==='POLYLINE'){shape.vertices.forEach((p,index)=>index?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));if(shape.closed)c.closePath();}
      else if(shape.type==='CIRCLE'){c.arc(shape.center.x,shape.center.y,shape.radius,0,Math.PI*2);}
      else if(shape.type==='ARC'){c.arc(shape.center.x,shape.center.y,shape.radius,shape.startAngle,shape.endAngle);}
      else if(['TEXT','MTEXT'].includes(shape.type)){c.fillStyle='#77eaff';c.font=`${Math.min(22,shape.height||11)}px monospace`;c.fillText(shape.text,shape.center.x,shape.center.y);continue;}
      c.stroke();
    }c.restore();
  }

  drawCadSchematic(state){
    const c=this.ctx,schematic=this.layout.cadSchematic;if(!schematic)return;const nodeMap=new Map(this.layout.equipment.filter(item=>item.source?.origin==='dxf').map(item=>[item.id,item]));
    c.save();
    for(const lane of schematic.lanes||[]){const nodes=lane.nodes.map(node=>nodeMap.get(node.id)||node).filter(Boolean);if(!nodes.length)continue;const anchor=laneTitleAnchor(nodes);c.fillStyle=COLORS.text;c.font='11px monospace';const direction=lane.direction==='inbound'?'입고 → 창고':lane.direction==='warehouse-outbound'?'창고 → 공정':'출고 방향';c.fillText(`${lane.name}  ·  ${direction}`,anchor.x-42,anchor.y-38);}
    for(const branch of schematic.inboundBranches||[]){const truck=nodeMap.get(branch.nodeIds?.[0]);if(!truck)continue;c.fillStyle=COLORS.green;c.font='10px monospace';c.fillText(`${branch.name} 입고 · 트럭 → AS/RS`,truck.x,truck.y-27);}
    for(const vehicle of nodeMap.values()){if(!['agv','amr'].includes(vehicle.type)||!vehicle.shuttleRoute)continue;const point=equipmentVisualPosition(this.layout,vehicle,state);c.save();c.translate(point.x,point.y);c.strokeStyle='rgba(0,255,136,.72)';c.lineWidth=2;c.setLineDash([5,4]);c.beginPath();c.moveTo(-18,0);c.lineTo(18,0);c.stroke();c.setLineDash([]);for(const dx of [-14,14])for(const dy of [-12,12]){c.beginPath();c.arc(dx,dy,4,0,Math.PI*2);c.fillStyle=dy<0?'#ff4d4d':'#00f29a';c.fill();c.strokeStyle='#d8f3ff';c.stroke();}c.fillStyle=COLORS.green;c.beginPath();c.arc(0,0,5,0,Math.PI*2);c.fill();c.restore();}
    for(const [edgeIndex,edge] of (schematic.edges||[]).entries()){if(this.layout.cadViewMode==='hybrid'&&edge.kind==='flow')continue;const fromNode=nodeMap.get(edge.from),toNode=nodeMap.get(edge.to);if(!fromNode||!toNode)continue;const from=connectionAnchor(fromNode,edge.fromPort),to=connectionAnchor(toNode,edge.toPort),transfer=edge.kind==='transfer',warehouse=edge.kind==='warehouse',forking=edge.kind==='forking',selected=edgeIndex===this.selectedEdgeIndex,distance=Math.hypot(to.x-from.x,to.y-from.y);if(this.layout.cadViewMode==='hybrid'&&distance>260)continue;c.strokeStyle=selected?COLORS.pink:transfer?'rgba(255,113,57,.75)':warehouse||forking?'rgba(0,255,136,.58)':'rgba(0,212,255,.48)';c.lineWidth=selected?7:transfer?3:warehouse?5:3;c.setLineDash(transfer?[7,5]:[]);const points=edgeRoute(from,to,edge);c.beginPath();points.forEach((point,index)=>index?c.lineTo(point.x,point.y):c.moveTo(point.x,point.y));c.stroke();const arrow=routeArrow(points);c.setLineDash([]);if(arrow){const {x,y,angle}=arrow;c.fillStyle=selected?COLORS.pink:transfer?COLORS.orange:warehouse||forking?COLORS.green:COLORS.cyan;c.beginPath();c.moveTo(x+Math.cos(angle)*9,y+Math.sin(angle)*9);c.lineTo(x+Math.cos(angle+2.55)*8,y+Math.sin(angle+2.55)*8);c.lineTo(x+Math.cos(angle-2.55)*8,y+Math.sin(angle-2.55)*8);c.closePath();c.fill();}}
    c.setLineDash([]);c.restore();
  }

  drawLine(line, slots) {
    const c = this.ctx, nodeW = 78, nodeH = 58;
    c.font = '12px monospace'; c.fillStyle = COLORS.text; c.fillText(line.name, line.x, line.y - 24);
    c.strokeStyle = COLORS.line; c.lineWidth = 7;
    c.beginPath(); c.moveTo(line.x + nodeW/2, line.y + nodeH/2); c.lineTo(line.x + (line.nodes.length-1)*88 + nodeW/2, line.y + nodeH/2); c.stroke();
    line.nodes.forEach((node, index) => {
      const x=line.x+index*88, y=line.y, important=node.role!=='buffer';
      c.fillStyle = important ? '#10283a' : COLORS.panel; c.strokeStyle = important ? COLORS.cyan : COLORS.line; c.lineWidth=1;
      c.fillRect(x,y,nodeW,nodeH); c.strokeRect(x,y,nodeW,nodeH);
      c.fillStyle=important?COLORS.cyan:COLORS.text; c.font='11px monospace'; c.fillText(node.label,x+8,y+15);
      if(slots[index]) this.drawTray(slots[index],x+10,y+23,nodeW-20,nodeH-29);
    });
  }

  drawTray(tray,x,y,w,h) {
    const c=this.ctx; c.fillStyle=tray.kind==='C'?'#103c30':'#4b3a0d'; c.strokeStyle=tray.kind==='C'?COLORS.green:COLORS.yellow;
    c.fillRect(x,y,w,h); c.strokeRect(x,y,w,h); c.fillStyle=tray.kind==='C'?COLORS.green:COLORS.yellow; c.font='bold 11px monospace';
    c.fillText(`${tray.kind}#${tray.id}`,x+4,y+12); c.fillStyle=COLORS.orange; c.fillText(`${tray.items}/${tray.capacity}`,x+w-29,y+12);
  }

  drawConnections() {
    const c=this.ctx, robot=this.layout.equipment.find(item=>item.type==='robot');
    const pick=this.nodePositions.get(robot.pickNode), place=this.nodePositions.get(robot.placeNode);
    if(!pick||!place) return;
    c.strokeStyle='rgba(0,212,255,.45)'; c.setLineDash([5,5]); c.beginPath(); c.moveTo(pick.x+39,pick.y+58); c.lineTo(robot.x,robot.y); c.lineTo(place.x+39,place.y); c.stroke(); c.setLineDash([]);
  }

  drawEquipment(state) {
    const c=this.ctx;
    for(const item of this.layout.equipment.filter(x=>!isNodeConveyor(x)&&this.isVisible(x))) {
      if(item.type==='processLine')continue;
      if(this.isSelected(item.id)&&item.source?.origin==='dxf'){const w=['stackerCrane','asrs'].includes(item.type)?194:['dock','source','sink'].includes(item.type)?112:item.type==='conveyor'?94:96,h=['stackerCrane','asrs'].includes(item.type)?150:item.type==='conveyor'?52:82,position=equipmentVisualPosition(this.layout,item,state);c.save();c.fillStyle='rgba(255,77,157,.13)';c.strokeStyle=COLORS.pink;c.lineWidth=3;c.setLineDash([7,4]);c.fillRect(position.x-w/2,position.y-h/2,w,h);c.strokeRect(position.x-w/2,position.y-h/2,w,h);c.setLineDash([]);c.restore();}
      if(item.type==='robot'&&!item.source?.origin) {
        c.beginPath(); c.arc(item.x,item.y,27,0,Math.PI*2); c.fillStyle=state.robot.phase==='idle'?'#6f2530':COLORS.orange; c.fill();
        c.strokeStyle=state.robot.phase==='idle'?'#b54555':COLORS.yellow; c.stroke(); c.fillStyle='#fff'; c.font='bold 11px monospace'; c.fillText(state.robot.phase.toUpperCase(),item.x-18,item.y+4);
        if(this.isSelected(item.id)){c.strokeStyle=COLORS.yellow;c.lineWidth=2;c.strokeRect(item.x-34,item.y-34,68,68);}
      } else if(item.nodeId) {
        const pos=this.nodePositions.get(item.nodeId); if(!pos) continue;
        const busy=Boolean(state.locks[item.id]); c.fillStyle=busy?COLORS.pink:COLORS.text; c.font='10px monospace'; c.fillText(item.type==='station'?'WORK':'FORK',pos.x+18,pos.y+76);
      } else if(item.source?.origin==='dxf'&&this.drawRotatedCadSymbol(item,state)) {
        if(['stackerCrane','asrs'].includes(item.type))this.drawAsrsOccupancy(item,state);
        const activeToken=state.cadTokens?.find(token=>token.nodeId===item.id&&!token.edge),step=activeToken?.operationStep;if(step&&!['conveyor','processLine','sorter','asrs','stackerCrane'].includes(item.type)){const position=equipmentVisualPosition(this.layout,item,state,activeToken),label=`${step.label} ${Math.round(Math.max(0,Math.min(1,step.progress||0))*100)}%`,width=Math.max(42,c.measureText(label).width+10);c.fillStyle='rgba(5,18,29,.92)';c.fillRect(position.x-width/2,position.y+22,width,13);c.fillStyle=step.phase==='transfer'?COLORS.green:step.phase==='move'?COLORS.yellow:COLORS.cyan;c.font='7px monospace';c.textAlign='center';c.fillText(label,position.x,position.y+31);c.textAlign='start';}
        continue;
      } else if(Number.isFinite(item.x)&&Number.isFinite(item.y)) {
        const long=['conveyor','processLine'].includes(item.type),schematicMax=this.layout.cadViewMode==='schematic'?78:500,w=long?Math.max(24,Math.min(schematicMax,item.length||item.width||60)):Math.max(32,Math.min(120,item.width||60)),h=long?Math.max(10,Math.min(36,item.height||14)):Math.max(24,Math.min(90,item.height||40));
        c.save();c.translate(item.x,item.y);c.rotate((item.rotation||0)*Math.PI/180);c.fillStyle=state.locks[item.id]?COLORS.pink:'#17334a';c.strokeStyle=this.isSelected(item.id)?COLORS.yellow:COLORS.cyan;c.lineWidth=this.isSelected(item.id)?2:1;
        c.fillRect(-w/2,-h/2,w,h);c.strokeRect(-w/2,-h/2,w,h);if(long){for(let roller=-w/2+10;roller<w/2;roller+=14){c.beginPath();c.arc(roller,0,3,0,Math.PI*2);c.stroke();}}c.restore();
        c.font='9px monospace';const label=String(item.name||item.type).replace(/\s+/g,' ').slice(0,18),labelWidth=Math.min(150,Math.max(42,c.measureText(label).width+12)),labelY=item.y+Math.abs(Math.sin((item.rotation||0)*Math.PI/180))*w/2+Math.abs(Math.cos((item.rotation||0)*Math.PI/180))*h/2+14;c.fillStyle='rgba(5,18,29,.9)';c.fillRect(item.x-labelWidth/2,labelY-10,labelWidth,14);c.fillStyle='#d8f3ff';c.textAlign='center';c.fillText(label,item.x,labelY);c.textAlign='start';
      }
    }
    if(this.connectionMode){for(const item of this.layout.equipment.filter(x=>x.type!=='processLine'&&Number.isFinite(x.x)&&Number.isFinite(x.y)&&this.isVisible(x))){const active=item.id===this.connectionSourceId,ports=equipmentPorts(item);c.save();c.strokeStyle='#061019';c.lineWidth=2;for(const [name,point] of Object.entries(ports)){c.fillStyle=active?COLORS.yellow:['right','bottom'].includes(name)?COLORS.green:COLORS.cyan;c.beginPath();c.arc(point.x,point.y,active?7:6,0,Math.PI*2);c.fill();c.stroke();}c.restore();}}
  }

  drawAsrsOccupancy(item,state){const asrs=state?.asrs;if(!asrs||asrs.equipmentId!==item.id)return;const c=this.ctx,p=item.parameters||{},columns=Math.max(1,Math.round(Number(p.columns)||asrs.columns||8)),levels=Math.max(1,Math.round(Number(p.levels)||asrs.levels||4)),rows=Math.max(1,Math.round(Number(p.rows)||asrs.rows||2)),allZones=asrsRackCells(asrs,state?.cadTokens||[]),zones=this.flowFilter==='all'?allZones:allZones.filter(zone=>zone.name===this.flowFilter),panelW=176,panelH=132,startX=-82,startY=-55,gridW=116,zoneGap=3,usableH=88,zoneH=Math.max(10,(usableH-zoneGap*Math.max(0,zones.length-1))/Math.max(1,zones.length)),gridRows=levels*rows,cellW=gridW/columns,cellH=zoneH/gridRows;c.save();c.translate(item.x,item.y);c.rotate((item.rotation||0)*Math.PI/180);c.fillStyle='rgba(5,18,29,.96)';c.strokeStyle=COLORS.green;c.fillRect(-panelW/2,-panelH/2,panelW,panelH);c.strokeRect(-panelW/2,-panelH/2,panelW,panelH);zones.forEach((zone,zoneIndex)=>{const y0=startY+zoneIndex*(zoneH+zoneGap),lineIndex=allZones.findIndex(entry=>entry.name===zone.name),lineColor=flowColor(zone.name,lineIndex);for(let index=0;index<zone.cells.length;index++){const column=index%columns,row=Math.floor(index/columns),x=startX+column*cellW,y=y0+row*cellH,itemColor=cargoColor(zone.cargoTypes[index]||zone.name,index);c.fillStyle=zone.cells[index]?itemColor:'#132b3d';c.fillRect(x+.6,y+.6,Math.max(1,cellW-1.2),Math.max(1,cellH-1.2));c.strokeStyle=zone.cells[index]?lineColor:'rgba(159,197,221,.22)';c.strokeRect(x+.6,y+.6,Math.max(1,cellW-1.2),Math.max(1,cellH-1.2));}c.fillStyle=lineColor;c.font='7px monospace';c.fillText(`${zone.name.replace(' 라인','').slice(0,7)}`,startX+gridW+5,y0+8);c.fillStyle='#d8f3ff';c.fillText(`${zone.inventory}/${zone.capacity}`,startX+gridW+5,y0+17);});c.fillStyle='#d8f3ff';c.font='7px monospace';c.fillText(`${levels}층 × ${columns}열 × ${rows}행 · ${allZones.length}품목`,startX,startY+usableH+13);c.fillStyle='#9ec9d8';c.fillText(this.flowFilter==='all'?`총 재고 ${asrs.inventory}/${asrs.capacity}`:`${this.flowFilter}만 표시`,startX,startY+usableH+23);c.restore();}

  drawConnectionPreview(){if(!this.connectionPreview)return;const {from,to,valid}=this.connectionPreview,c=this.ctx,points=orthogonalRoute(from,to);c.save();c.strokeStyle=valid?COLORS.green:COLORS.yellow;c.lineWidth=3;c.setLineDash(valid?[]:[7,5]);c.beginPath();points.forEach((point,index)=>index?c.lineTo(point.x,point.y):c.moveTo(point.x,point.y));c.stroke();c.setLineDash([]);c.fillStyle=valid?COLORS.green:COLORS.yellow;c.beginPath();c.arc(to.x,to.y,7,0,Math.PI*2);c.fill();c.restore();}

  drawPlacementPreview(){const {type,point}=this.placementPreview;if(!type||!point)return;const c=this.ctx;c.save();c.globalAlpha=.62;c.fillStyle='#17334a';c.strokeStyle=COLORS.yellow;c.lineWidth=2;c.setLineDash([6,4]);c.fillRect(point.x-34,point.y-22,68,44);c.strokeRect(point.x-34,point.y-22,68,44);c.setLineDash([]);c.fillStyle='#fff';c.font='10px monospace';c.fillText(type.toUpperCase(),point.x-25,point.y+4);c.restore();}

  drawRotatedCadSymbol(item,state){const c=this.ctx;c.save();c.translate(item.x,item.y);c.rotate((item.rotation||0)*Math.PI/180);c.translate(-item.x,-item.y);const drawn=this.drawCadSymbol(item,state);c.restore();return drawn;}

  drawCadSymbol(item,state){
    if(!Number.isFinite(item.x)||!Number.isFinite(item.y))return false;const c=this.ctx,compact=this.layout.cadViewMode==='hybrid';
    if(item.type==='conveyor'){const w=compact?58:78,h=compact?16:24,p=item.parameters||{},cargo=normalizedCargoSpec(this.layout);c.save();c.translate(item.x,item.y);c.fillStyle='#102b3b';c.strokeStyle=this.isSelected(item.id)?COLORS.yellow:COLORS.cyan;c.lineWidth=this.isSelected(item.id)?2:1.5;c.fillRect(-w/2,-h/2,w,h);c.strokeRect(-w/2,-h/2,w,h);for(let roller=-w/2+9;roller<w/2;roller+=13){c.beginPath();c.arc(roller,0,3,0,Math.PI*2);c.stroke();}c.fillStyle='#d8f3ff';c.font=`${compact?6:8}px monospace`;c.textAlign='center';c.fillText('CONVEYOR',0,compact?-12:-17);c.fillStyle='#9fc5dd';c.fillText(`CV ${Number(p.length||5).toFixed(1)}m`,0,compact?22:28);c.textAlign='start';c.restore();return true;}
    if(['stackerCrane','asrs'].includes(item.type)){const p=item.parameters||{},levels=Math.max(1,Math.round(Number(p.levels)||4)),rows=Math.max(1,Math.round(Number(p.rows)||3)),columns=Math.max(1,Math.round(Number(p.columns)||4)),productTypes=Math.max(1,Math.round(Number(p.productTypes)||3)),w=compact?76:178,h=compact?66:132,zones=Object.entries(state?.asrs?.zones||{}),drawColumns=Math.min(columns,10),drawLevels=Math.min(levels,8),rackLeft=-w*.46,rackTop=-h*.43,rackWidth=w*.78,rackHeight=h*.62,cellW=rackWidth/drawColumns,cellH=rackHeight/drawLevels,palette=['rgba(0,212,255,.35)','rgba(0,255,136,.35)','rgba(255,210,63,.38)','rgba(255,77,157,.35)','rgba(255,113,57,.35)'];c.save();c.translate(item.x,item.y);c.fillStyle='#0d2530';c.strokeStyle=COLORS.green;c.lineWidth=1;c.fillRect(-w/2,-h/2,w,h);c.strokeRect(-w/2,-h/2,w,h);for(let row=0;row<drawLevels;row++)for(let column=0;column<drawColumns;column++){const zoneIndex=Math.min(productTypes-1,Math.floor(row/drawLevels*productTypes));c.fillStyle=palette[zoneIndex%palette.length];c.fillRect(rackLeft+column*cellW,rackTop+row*cellH,cellW,cellH);c.strokeStyle='rgba(216,243,255,.35)';c.strokeRect(rackLeft+column*cellW,rackTop+row*cellH,cellW,cellH);}c.strokeStyle=COLORS.orange;c.lineWidth=compact?2:3;c.beginPath();c.moveTo(w*.38,rackTop);c.lineTo(w*.38,rackTop+rackHeight);c.stroke();c.fillStyle=COLORS.orange;c.fillRect(w*.38-3,-3,6,6);c.fillStyle='#d8f3ff';c.font=`${compact?6:8}px monospace`;c.fillText(`${levels}층 × ${columns}열 × ${rows}행 · ${productTypes}품목`,-w*.46,h*.31);c.fillStyle='#9ec9d8';c.fillText(`총 재고 ${state?.asrs?.inventory||0} / ${state?.asrs?.capacity||levels*rows*columns}`,-w*.46,h*.44);if(!compact&&this.isSelected(item.id)&&zones.length){const panelX=w/2+7,panelW=92,panelH=16+zones.length*13;c.fillStyle='rgba(5,18,29,.95)';c.strokeStyle='rgba(0,255,136,.55)';c.fillRect(panelX,-panelH/2,panelW,panelH);c.strokeRect(panelX,-panelH/2,panelW,panelH);c.fillStyle=COLORS.green;c.font='7px monospace';c.fillText('품목별 재고',panelX+7,-panelH/2+11);zones.slice(0,8).forEach(([name,zone],index)=>{c.fillStyle=palette[index%palette.length].replace('.35','.9').replace('.38','.9');c.fillRect(panelX+7,-panelH/2+17+index*13,6,6);c.fillStyle='#d8f3ff';c.fillText(`${name.replace(' 라인','').slice(0,7)} ${zone.inventory}/${zone.capacity}`,panelX+17,-panelH/2+23+index*13);});}c.restore();return true;}
    if(item.type==='handoffPoint'){const w=compact?22:38,h=compact?26:42;c.save();c.translate(item.x,item.y);c.fillStyle='#17334a';c.strokeStyle=COLORS.cyan;c.fillRect(-w/2,-h/2,w,h);c.strokeRect(-w/2,-h/2,w,h);c.fillStyle='#d8f3ff';c.font=`${compact?7:9}px monospace`;c.fillText('H/P',compact?-7:-9,3);c.restore();return true;}
    if(item.type==='turntable'){const radius=compact?14:24,operation=equipmentOperationProgress(item,state),positions=Math.max(2,Number(item.parameters?.positions||2)),angle=operation.progress*Math.PI*2/positions;c.save();c.translate(item.x,item.y);c.fillStyle=operation.active?'#264234':'#17334a';c.strokeStyle=COLORS.yellow;c.lineWidth=2;c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.fill();c.stroke();c.rotate(angle);c.strokeStyle=COLORS.green;c.beginPath();c.moveTo(-radius+4,0);c.lineTo(radius-4,0);c.stroke();c.fillStyle='#d8f3ff';c.font=`${compact?6:8}px monospace`;c.fillText('TT',-5,3);c.restore();return true;}
    if(item.type==='forkingDevice'){const w=compact?32:58,h=compact?18:28;c.save();c.translate(item.x,item.y);c.fillStyle='#0d3928';c.strokeStyle=COLORS.green;c.fillRect(-w/2,-h/2,w,h);c.strokeRect(-w/2,-h/2,w,h);c.lineWidth=2;for(const dy of [-5,5]){c.beginPath();c.moveTo(-w/2-12,dy);c.lineTo(w/2+12,dy);c.stroke();}c.fillStyle=COLORS.green;c.font=`${compact?7:9}px monospace`;c.fillText('FORK',compact?-9:-12,3);c.restore();return true;}
    if(item.type==='forklift'){const scale=compact?.7:1;c.save();c.translate(item.x,item.y);c.scale(scale,scale);c.fillStyle='#273446';c.strokeStyle=COLORS.yellow;c.lineWidth=2;c.fillRect(-24,-11,30,20);c.strokeRect(-24,-11,30,20);c.fillRect(-17,-25,17,14);c.strokeRect(-17,-25,17,14);c.beginPath();c.arc(-15,13,6,0,Math.PI*2);c.arc(4,13,6,0,Math.PI*2);c.stroke();c.beginPath();c.moveTo(10,-17);c.lineTo(10,12);c.moveTo(10,8);c.lineTo(34,8);c.moveTo(10,13);c.lineTo(34,13);c.stroke();c.fillStyle='#fff2a8';c.font='8px monospace';c.fillText('지게차',-22,3);c.restore();return true;}
    if(['source','sink','dock'].includes(item.type)){const inbound=item.type==='source'||(item.type==='dock'&&item.parameters?.dockRole!=='outbound'&&/TRUCK|INBOUND|입고/i.test(item.name||'')),truck=state?.outboundTrucks?.[item.id];c.save();c.translate(item.x,item.y);c.fillStyle='#17334a';c.strokeStyle=COLORS.cyan;c.fillRect(-42,-20,58,40);c.strokeRect(-42,-20,58,40);c.fillRect(16,-13,24,33);c.strokeRect(16,-13,24,33);c.beginPath();c.arc(-25,23,6,0,Math.PI*2);c.arc(25,23,6,0,Math.PI*2);c.stroke();c.fillStyle='#d8f3ff';c.font='9px monospace';c.fillText(inbound?'입고':'출고',-13,4);if(truck){c.fillStyle=COLORS.yellow;c.font='8px monospace';c.fillText(`${truck.loaded}/${truck.capacity} · ${truck.departures}회`,-35,-25);}c.restore();return true;}
    if(['amr','agv'].includes(item.type)){const half=compact?11:18,operation=equipmentOperationProgress(item,state),position=equipmentVisualPosition(this.layout,item,state);c.save();c.translate(position.x,position.y);c.fillStyle=operation.active?'#26506a':'#15374a';c.strokeStyle=COLORS.yellow;c.fillRect(-half,-half*.7,half*2,half*1.4);c.strokeRect(-half,-half*.7,half*2,half*1.4);c.fillStyle='#fff';c.font=`${compact?7:9}px monospace`;c.fillText(item.type.toUpperCase(),compact?-7:-10,3);c.restore();return true;}
    return false;
  }

  handoverDescriptor(token,state,nodes,cargo){const physical=item=>equipmentLengthMeters(item,this.layout),visible=ratio=>ratio>1e-4&&ratio<1-1e-4,receiving=ratio=>ratio>=0&&ratio<1-1e-4;if(!token.edge&&token.motion&&['conveyor','processLine','sorter'].includes(nodes.get(token.nodeId)?.type)){const source=nodes.get(token.nodeId),position=Number(token.motionState?.position)||0,entered=Math.max(0,position-physical(source)),outgoing=(this.layout.cadSchematic?.edges||[]).filter(edge=>edge.from===source.id),edge=token.predictiveRouteEdge||token.visualEdge||outgoing[0],target=nodes.get(edge?.to),raw=entered/cargo.length;if(visible(raw)&&edge&&target)return{source,target,edge,raw};}if(token.edge)return null;const handover=token.incomingHandover,source=nodes.get(handover?.sourceId),target=nodes.get(handover?.targetId);if(!handover||token.nodeId!==handover.targetId||!source||!target||!token.motion)return null;const raw=(Number(token.motionState?.position)||0)/cargo.length;return receiving(raw)?{source,target,edge:handover.edge||{},raw:Math.max(0,raw)}:null;}

  drawHandoverOverlay(state){const c=this.ctx,nodes=new Map(this.layout.equipment.map(item=>[item.id,item])),cargo=normalizedCargoSpec(this.layout),commonVisualLength=this.layout.cadViewMode==='hybrid'?58:78,metrics=stableCargoVisualMetrics(this.layout,cargo,commonVisualLength),colorsFor=token=>({cargo:cargoColor(token.cargoType||token.flowKey,token.flowIndex),line:flowColor(token.flowKey,token.flowIndex)}),drawEndpoint=(item,port,other,progress,isTarget,colors)=>{const bounds=equipmentClipBounds(item,commonVisualLength),cargoLength=metrics.visualLength,cargoWidth=metrics.visualWidth,pose=handoverEndpointPose(item,port,cargoLength,isTarget,other,progress,commonVisualLength),itemAngle=(Number(item.rotation)||0)*Math.PI/180;c.save();c.translate(item.x,item.y);c.rotate(itemAngle);c.beginPath();c.rect(-bounds.width/2,-bounds.height/2,bounds.width,bounds.height);c.clip();c.rotate(-itemAngle);c.translate(-item.x,-item.y);c.translate(pose.x,pose.y);c.rotate(pose.angle);c.fillStyle=colors.cargo;c.strokeStyle=colors.line;c.lineWidth=2;c.fillRect(-cargoLength/2,-cargoWidth/2,cargoLength,cargoWidth);c.strokeRect(-cargoLength/2,-cargoWidth/2,cargoLength,cargoWidth);c.restore();};for(const token of state.cadTokens||[]){const descriptor=this.handoverDescriptor(token,state,nodes,cargo);if(!descriptor?.source||!descriptor?.target)continue;const raw=Math.max(0,Math.min(1,descriptor.raw)),colors=colorsFor(token),edge=descriptor.edge||{},source=mobileHandoverNode(this.layout,descriptor.source,false),target=mobileHandoverNode(this.layout,descriptor.target,true);drawEndpoint(source,edge.fromPort,target,raw,false,colors);drawEndpoint(target,edge.toPort,source,raw,true,colors);}}

  drawCadFlow(state){
    const c=this.ctx,conveyors=this.layout.equipment.filter(item=>item.type==='conveyor'&&item.source?.origin==='dxf');
    if(state.cadTokens){
      const nodes=new Map(this.layout.equipment.map(item=>[item.id,item])),cargo=normalizedCargoSpec(this.layout),metrics=stableCargoVisualMetrics(this.layout,cargo,this.layout.cadViewMode==='hybrid'?58:78);
      for(const token of state.cadTokens){
        const fromNode=nodes.get(token.edge?.from||token.nodeId),toNode=nodes.get(token.edge?.to||token.nodeId);if(!fromNode||!toNode)continue;
        let point,cargoW=metrics.visualLength,cargoH=metrics.visualWidth,cargoAngle=0,cargoScale=1,clipItem=null;
        if(!token.edge&&['agv','amr'].includes(fromNode.type)){if(this.handoverDescriptor(token,state,nodes,cargo))continue;const route=mobileEquipmentRoute(this.layout,fromNode),operation=equipmentOperationProgress(fromNode,state,token);point=route?pointOnRoute(route.points||[route.start,route.end],operation.progress):{x:fromNode.x,y:fromNode.y};}
        else if(!token.edge&&fromNode.type==='conveyor'){if(this.handoverDescriptor(token,state,nodes,cargo))continue;const visualLength=this.layout.cadViewMode==='hybrid'?58:78,physicalPosition=Number(token.motionState?.position)||0,pose=conveyorCargoVisualPose(fromNode,cargo,physicalPosition,visualLength,metrics,equipmentLengthMeters(fromNode,this.layout)),itemColor=cargoColor(token.cargoType||token.flowKey,token.flowIndex),lineColor=flowColor(token.flowKey,token.flowIndex);c.save();c.translate(fromNode.x,fromNode.y);c.rotate(pose.angle);c.beginPath();c.rect(-visualLength/2,-14,visualLength,28);c.clip();c.rotate(-pose.angle);c.translate(-fromNode.x,-fromNode.y);c.translate(pose.x,pose.y);c.rotate(pose.angle);c.fillStyle=itemColor;c.strokeStyle=lineColor;c.lineWidth=2;c.fillRect(-pose.visualLength/2,-pose.visualWidth/2,pose.visualLength,pose.visualWidth);c.strokeRect(-pose.visualLength/2,-pose.visualWidth/2,pose.visualLength,pose.visualWidth);c.restore();continue;}
        else if(!token.edge&&['asrs','stackerCrane'].includes(fromNode.type)){const incoming=(this.layout.cadSchematic?.edges||[]).find(edge=>edge.to===fromNode.id),outgoing=(this.layout.cadSchematic?.edges||[]).find(edge=>edge.from===fromNode.id),retrieval=token.asrsPhase==='retrieval',edge=retrieval?outgoing:incoming,other=nodes.get(retrieval?edge?.to:edge?.from),operation=asrsOperationSnapshot(fromNode,token,state.t||0);point=retrieval?handoverEndpointPose(fromNode,edge?.fromPort,cargoW,false,other,0,this.layout.cadViewMode==='hybrid'?58:78):handoverEndpointPose(fromNode,edge?.toPort,cargoW,true,other,1,this.layout.cadViewMode==='hybrid'?58:78);cargoAngle=point.angle;cargoScale=Math.max(0,Math.min(1,Number(operation.cargoScale??1)));}
        else if(!token.edge){point=equipmentCargoVisualPose(this.layout,fromNode,state,token,cargoW,this.layout.cadViewMode==='hybrid'?58:78);cargoAngle=point.angle;}
        else{const visualSource=mobileHandoverNode(this.layout,fromNode,false),visualTarget=mobileHandoverNode(this.layout,toNode,true);point=pendingTransferPose(visualSource,visualTarget,token.edge,cargoW,this.layout.cadViewMode==='hybrid'?58:78);cargoAngle=point.angle;clipItem=visualSource;}
        const x=point.x,y=point.y;c.save();if(clipItem){const bounds=equipmentClipBounds(clipItem,this.layout.cadViewMode==='hybrid'?58:78),itemAngle=(Number(clipItem.rotation)||0)*Math.PI/180;c.translate(clipItem.x,clipItem.y);c.rotate(itemAngle);c.beginPath();c.rect(-bounds.width/2,-bounds.height/2,bounds.width,bounds.height);c.clip();c.rotate(-itemAngle);c.translate(-clipItem.x,-clipItem.y);}c.translate(x,y);c.rotate(cargoAngle);c.globalAlpha=Math.max(.001,cargoScale);c.fillStyle=cargoColor(token.cargoType||token.flowKey,token.flowIndex);c.strokeStyle=flowColor(token.flowKey,token.flowIndex);c.lineWidth=2;c.fillRect(-cargoW*cargoScale/2,-cargoH*cargoScale/2,cargoW*cargoScale,cargoH*cargoScale);c.strokeRect(-cargoW*cargoScale/2,-cargoH*cargoScale/2,cargoW*cargoScale,cargoH*cargoScale);c.restore();
      }
      return;
    }
    conveyors.forEach((item,index)=>{const length=Math.max(48,item.length||item.width||160),speed=Math.max(.2,item.parameters?.speed||item.parameters?.lineSpeed/20||.5),progress=((state.t*speed*32+index*29)%length)-length/2;
      c.save();c.translate(item.x,item.y);c.rotate((item.rotation||0)*Math.PI/180);c.fillStyle=COLORS.yellow;c.strokeStyle='#fff2a8';c.lineWidth=1;c.fillRect(progress-7,-7,14,14);c.strokeRect(progress-7,-7,14,14);c.restore();
    });
  }
}
