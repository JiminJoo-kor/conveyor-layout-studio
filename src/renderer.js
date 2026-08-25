const COLORS = { bg:'#071019', panel:'#0c1824', line:'#17334a', cyan:'#00d4ff', green:'#00ff88', yellow:'#ffd166', orange:'#ff7139', pink:'#ff4d9d', text:'#9fc5dd' };

export const isNodeConveyor = item => item.type === 'conveyor' && Array.isArray(item.nodes);

export class LayoutRenderer {
  constructor(canvas, layout) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.view = { zoom: 1, x: 0, y: 0 };
    this.backgroundImage = null;
    this.selectedId = null;
    this.setLayout(layout);
  }

  setView(view) { this.view = { ...this.view, ...view }; }
  setSelected(id) { this.selectedId = id; }
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
    if(this.layout.displayMode==='cad'&&this.layout.cadViewMode!=='raw')this.drawCadSchematic();
    const lines = this.layout.equipment.filter(item=>isNodeConveyor(item)&&this.isVisible(item));
    lines.forEach(line => this.drawLine(line, line.trayKinds.includes('C') ? state.product : state.source));
    if(this.layout.displayMode!=='cad')this.drawConnections();
    this.drawEquipment(state);
    if(this.layout.displayMode==='cad')this.drawCadFlow(state);
    c.restore();
  }

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

  drawCadSchematic(){
    const c=this.ctx,schematic=this.layout.cadSchematic;if(!schematic)return;const nodeMap=new Map(this.layout.equipment.filter(item=>item.source?.origin==='dxf').map(item=>[item.id,item]));
    c.save();
    for(const lane of schematic.lanes||[]){const nodes=lane.nodes.map(node=>nodeMap.get(node.id)||node).filter(Boolean);if(!nodes.length)continue;const label=nodeMap.get(lane.labelId),anchor=label||nodes[0];c.fillStyle=COLORS.text;c.font='11px monospace';const direction=lane.direction==='inbound'?'입고 → 창고':lane.direction==='warehouse-outbound'?'창고 → 공정':'출고 방향';c.fillText(`${lane.name}  ·  ${direction}`,anchor.x,anchor.y-18);}
    for(const vehicle of nodeMap.values()){const route=vehicle.shuttleRoute;if(!route)continue;c.strokeStyle='rgba(0,255,136,.72)';c.lineWidth=2;c.setLineDash([8,5]);c.beginPath();c.moveTo(route.start.x,route.start.y);c.lineTo(route.end.x,route.end.y);c.stroke();c.setLineDash([]);for(const x of [route.start.x,route.end.x])for(const dy of [-12,12]){c.beginPath();c.arc(x,route.start.y+dy,4,0,Math.PI*2);c.fillStyle=dy<0?'#ff4d4d':'#00f29a';c.fill();c.strokeStyle='#d8f3ff';c.stroke();}const mid=(route.start.x+route.end.x)/2;c.fillStyle=COLORS.green;c.beginPath();c.moveTo(mid-12,route.start.y-5);c.lineTo(mid,route.start.y);c.lineTo(mid-12,route.start.y+5);c.fill();c.beginPath();c.moveTo(mid+12,route.start.y-5);c.lineTo(mid,route.start.y);c.lineTo(mid+12,route.start.y+5);c.fill();}
    for(const edge of schematic.edges||[]){if(this.layout.cadViewMode==='hybrid'&&edge.kind==='flow')continue;const from=nodeMap.get(edge.from),to=nodeMap.get(edge.to);if(!from||!to)continue;const transfer=edge.kind==='transfer',warehouse=edge.kind==='warehouse',forking=edge.kind==='forking',distance=Math.hypot(to.x-from.x,to.y-from.y);if(this.layout.cadViewMode==='hybrid'&&distance>260)continue;c.strokeStyle=transfer?'rgba(255,113,57,.75)':warehouse||forking?'rgba(0,255,136,.58)':'rgba(0,212,255,.48)';c.lineWidth=transfer?3:warehouse?5:3;c.setLineDash(transfer?[7,5]:[]);const orthogonal=edge.kind!=='flow'&&Math.abs(from.y-to.y)>8,elbowX=from.x+(to.x-from.x)*.55,points=orthogonal?[from,{x:elbowX,y:from.y},{x:elbowX,y:to.y},to]:[from,to];c.beginPath();points.forEach((point,index)=>index?c.lineTo(point.x,point.y):c.moveTo(point.x,point.y));c.stroke();const segment=points[Math.max(1,points.length-2)],angle=Math.atan2(to.y-segment.y,to.x-segment.x),x=segment.x+(to.x-segment.x)*.68,y=segment.y+(to.y-segment.y)*.68;c.setLineDash([]);c.fillStyle=transfer?COLORS.orange:warehouse||forking?COLORS.green:COLORS.cyan;c.beginPath();c.moveTo(x+Math.cos(angle)*9,y+Math.sin(angle)*9);c.lineTo(x+Math.cos(angle+2.55)*8,y+Math.sin(angle+2.55)*8);c.lineTo(x+Math.cos(angle-2.55)*8,y+Math.sin(angle-2.55)*8);c.closePath();c.fill();}
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
      if(item.type==='robot'&&!item.source?.origin) {
        c.beginPath(); c.arc(item.x,item.y,27,0,Math.PI*2); c.fillStyle=state.robot.phase==='idle'?'#6f2530':COLORS.orange; c.fill();
        c.strokeStyle=state.robot.phase==='idle'?'#b54555':COLORS.yellow; c.stroke(); c.fillStyle='#fff'; c.font='bold 11px monospace'; c.fillText(state.robot.phase.toUpperCase(),item.x-18,item.y+4);
        if(item.id===this.selectedId){c.strokeStyle=COLORS.yellow;c.lineWidth=2;c.strokeRect(item.x-34,item.y-34,68,68);}
      } else if(item.nodeId) {
        const pos=this.nodePositions.get(item.nodeId); if(!pos) continue;
        const busy=Boolean(state.locks[item.id]); c.fillStyle=busy?COLORS.pink:COLORS.text; c.font='10px monospace'; c.fillText(item.type==='station'?'WORK':'FORK',pos.x+18,pos.y+76);
      } else if(item.source?.origin==='dxf'&&this.drawCadSymbol(item,state)) {
        continue;
      } else if(Number.isFinite(item.x)&&Number.isFinite(item.y)) {
        const long=['conveyor','processLine'].includes(item.type),w=long?Math.max(24,Math.min(500,item.length||item.width||60)):Math.max(32,Math.min(120,item.width||60)),h=long?Math.max(10,Math.min(36,item.height||14)):Math.max(24,Math.min(90,item.height||40));
        c.save();c.translate(item.x,item.y);c.rotate((item.rotation||0)*Math.PI/180);c.fillStyle=state.locks[item.id]?COLORS.pink:'#17334a';c.strokeStyle=item.id===this.selectedId?COLORS.yellow:COLORS.cyan;c.lineWidth=item.id===this.selectedId?2:1;
        c.fillRect(-w/2,-h/2,w,h);c.strokeRect(-w/2,-h/2,w,h);if(long){for(let roller=-w/2+10;roller<w/2;roller+=14){c.beginPath();c.arc(roller,0,3,0,Math.PI*2);c.stroke();}}c.restore();
        c.fillStyle='#d8f3ff';c.font='10px monospace';c.fillText(item.type.toUpperCase().slice(0,6),item.x-Math.min(23,w/3),item.y+4);
      }
    }
  }

  drawCadSymbol(item,state){
    if(!Number.isFinite(item.x)||!Number.isFinite(item.y))return false;const c=this.ctx,compact=this.layout.cadViewMode==='hybrid';
    if(['stackerCrane','asrs'].includes(item.type)){const w=compact?46:104,h=compact?34:76;c.save();c.translate(item.x,item.y);c.strokeStyle=COLORS.green;c.fillStyle='#0d2530';c.lineWidth=1;c.fillRect(-w/2,-h/2,w,h);c.strokeRect(-w/2,-h/2,w,h);for(const x of [-w*.34,-w*.22,w*.22,w*.34]){c.beginPath();c.moveTo(x,-h*.4);c.lineTo(x,h*.4);c.stroke();}c.strokeStyle=COLORS.orange;c.lineWidth=compact?2:3;c.beginPath();c.moveTo(0,-h*.42);c.lineTo(0,h*.42);c.stroke();c.fillStyle=COLORS.orange;c.fillRect(-4,-4,8,8);c.fillStyle='#d8f3ff';c.font=`${compact?7:9}px monospace`;c.fillText(item.type==='asrs'?'AS/RS':'STACKER',compact?-15:-25,3);c.restore();return true;}
    if(item.type==='handoffPoint'){const w=compact?22:38,h=compact?26:42;c.save();c.translate(item.x,item.y);c.fillStyle='#17334a';c.strokeStyle=COLORS.cyan;c.fillRect(-w/2,-h/2,w,h);c.strokeRect(-w/2,-h/2,w,h);c.fillStyle='#d8f3ff';c.font=`${compact?7:9}px monospace`;c.fillText('H/P',compact?-7:-9,3);c.restore();return true;}
    if(item.type==='turntable'){const radius=compact?14:24,angle=(state?.t||0)*Math.PI/3;c.save();c.translate(item.x,item.y);c.fillStyle='#17334a';c.strokeStyle=COLORS.yellow;c.lineWidth=2;c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.fill();c.stroke();c.rotate(angle);c.strokeStyle=COLORS.green;c.beginPath();c.moveTo(-radius+4,0);c.lineTo(radius-4,0);c.stroke();c.fillStyle='#d8f3ff';c.font=`${compact?6:8}px monospace`;c.fillText('TT',-5,3);c.restore();return true;}
    if(item.type==='forkingDevice'){const w=compact?32:58,h=compact?18:28;c.save();c.translate(item.x,item.y);c.fillStyle='#0d3928';c.strokeStyle=COLORS.green;c.fillRect(-w/2,-h/2,w,h);c.strokeRect(-w/2,-h/2,w,h);c.lineWidth=2;for(const dy of [-5,5]){c.beginPath();c.moveTo(-w/2-12,dy);c.lineTo(w/2+12,dy);c.stroke();}c.fillStyle=COLORS.green;c.font=`${compact?7:9}px monospace`;c.fillText('FORK',compact?-9:-12,3);c.restore();return true;}
    if(['source','sink','dock'].includes(item.type)){const inbound=item.type==='source'||(item.type==='dock'&&/TRUCK|INBOUND|입고/i.test(item.name||''));c.save();c.translate(item.x,item.y);c.fillStyle='#17334a';c.strokeStyle=COLORS.cyan;c.fillRect(-42,-20,58,40);c.strokeRect(-42,-20,58,40);c.fillRect(16,-13,24,33);c.strokeRect(16,-13,24,33);c.beginPath();c.arc(-25,23,6,0,Math.PI*2);c.arc(25,23,6,0,Math.PI*2);c.stroke();c.fillStyle='#d8f3ff';c.font='9px monospace';c.fillText(inbound?'입고':'출고',-13,4);c.restore();return true;}
    if(['amr','agv'].includes(item.type)){const half=compact?11:18,route=item.shuttleRoute,speed=Math.max(.2,Number(item.parameters?.speed||1.2));let x=item.x,y=item.y;if(route){const distance=Math.max(1,route.end.x-route.start.x),phase=((state?.t||0)*speed*28)%(distance*2),progress=phase<=distance?phase:distance*2-phase;x=route.start.x+progress;y=route.start.y;}c.save();c.translate(x,y);c.fillStyle='#15374a';c.strokeStyle=COLORS.yellow;c.fillRect(-half,-half*.7,half*2,half*1.4);c.strokeRect(-half,-half*.7,half*2,half*1.4);c.fillStyle='#fff';c.font=`${compact?7:9}px monospace`;c.fillText(item.type.toUpperCase(),compact?-7:-10,3);c.restore();return true;}
    return false;
  }

  drawCadFlow(state){
    const c=this.ctx,conveyors=this.layout.equipment.filter(item=>item.type==='conveyor'&&item.source?.origin==='dxf');
    if(state.cadTokens){const nodes=new Map(this.layout.equipment.filter(item=>item.source?.origin==='dxf').map(item=>[item.id,item]));for(const token of state.cadTokens){const from=nodes.get(token.edge?.from||token.nodeId),to=nodes.get(token.edge?.to||token.nodeId);if(!from||!to)continue;const progress=token.edge?token.progress:0,x=from.x+(to.x-from.x)*progress,y=from.y+(to.y-from.y)*progress;c.fillStyle=COLORS.yellow;c.strokeStyle='#fff2a8';c.fillRect(x-7,y-7,14,14);c.strokeRect(x-7,y-7,14,14);}return;}
    conveyors.forEach((item,index)=>{const length=Math.max(48,item.length||item.width||160),speed=Math.max(.2,item.parameters?.speed||item.parameters?.lineSpeed/20||.5),progress=((state.t*speed*32+index*29)%length)-length/2;
      c.save();c.translate(item.x,item.y);c.rotate((item.rotation||0)*Math.PI/180);c.fillStyle=COLORS.yellow;c.strokeStyle='#fff2a8';c.lineWidth=1;c.fillRect(progress-7,-7,14,14);c.strokeRect(progress-7,-7,14,14);c.restore();
    });
  }
}
