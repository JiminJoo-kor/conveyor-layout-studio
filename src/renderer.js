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
    for(const lane of schematic.lanes||[]){const nodes=lane.nodes.map(node=>nodeMap.get(node.id)||node).filter(Boolean);if(nodes.length<2)continue;const minX=Math.min(...nodes.map(n=>n.x)),maxX=Math.max(...nodes.map(n=>n.x)),y=nodes.reduce((sum,n)=>sum+n.y,0)/nodes.length;c.strokeStyle='rgba(23,51,74,.9)';c.lineWidth=8;c.beginPath();c.moveTo(minX,y);c.lineTo(maxX,y);c.stroke();c.fillStyle=COLORS.text;c.font='11px monospace';c.fillText(lane.name,minX,y-18);}
    for(const edge of schematic.edges||[]){const from=nodeMap.get(edge.from),to=nodeMap.get(edge.to);if(!from||!to)continue;c.strokeStyle=edge.kind==='transfer'?'rgba(255,113,57,.55)':'rgba(0,212,255,.38)';c.lineWidth=edge.kind==='transfer'?2:5;c.setLineDash(edge.kind==='transfer'?[6,5]:[]);c.beginPath();c.moveTo(from.x,from.y);c.lineTo(to.x,to.y);c.stroke();}
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
      if(item.type==='robot'&&!item.source?.origin) {
        c.beginPath(); c.arc(item.x,item.y,27,0,Math.PI*2); c.fillStyle=state.robot.phase==='idle'?'#6f2530':COLORS.orange; c.fill();
        c.strokeStyle=state.robot.phase==='idle'?'#b54555':COLORS.yellow; c.stroke(); c.fillStyle='#fff'; c.font='bold 11px monospace'; c.fillText(state.robot.phase.toUpperCase(),item.x-18,item.y+4);
        if(item.id===this.selectedId){c.strokeStyle=COLORS.yellow;c.lineWidth=2;c.strokeRect(item.x-34,item.y-34,68,68);}
      } else if(item.nodeId) {
        const pos=this.nodePositions.get(item.nodeId); if(!pos) continue;
        const busy=Boolean(state.locks[item.id]); c.fillStyle=busy?COLORS.pink:COLORS.text; c.font='10px monospace'; c.fillText(item.type==='station'?'WORK':'FORK',pos.x+18,pos.y+76);
      } else if(item.source?.origin==='dxf'&&this.drawCadSymbol(item)) {
        continue;
      } else if(Number.isFinite(item.x)&&Number.isFinite(item.y)) {
        const long=['conveyor','processLine'].includes(item.type),w=long?Math.max(24,Math.min(500,item.length||item.width||60)):Math.max(32,Math.min(120,item.width||60)),h=long?Math.max(10,Math.min(36,item.height||14)):Math.max(24,Math.min(90,item.height||40));
        c.save();c.translate(item.x,item.y);c.rotate((item.rotation||0)*Math.PI/180);c.fillStyle=state.locks[item.id]?COLORS.pink:'#17334a';c.strokeStyle=item.id===this.selectedId?COLORS.yellow:COLORS.cyan;c.lineWidth=item.id===this.selectedId?2:1;
        c.fillRect(-w/2,-h/2,w,h);c.strokeRect(-w/2,-h/2,w,h);if(long){for(let roller=-w/2+10;roller<w/2;roller+=14){c.beginPath();c.arc(roller,0,3,0,Math.PI*2);c.stroke();}if(item.type==='conveyor'){c.fillStyle='#173f2f';c.strokeStyle=COLORS.green;c.fillRect(-11,-h/2-13,22,16);c.strokeRect(-11,-h/2-13,22,16);c.fillStyle=COLORS.green;c.font='8px monospace';c.fillText('대차',-9,-h/2-3);}}c.restore();
        c.fillStyle='#d8f3ff';c.font='10px monospace';c.fillText(item.type.toUpperCase().slice(0,6),item.x-Math.min(23,w/3),item.y+4);
      }
    }
  }

  drawCadSymbol(item){
    if(!Number.isFinite(item.x)||!Number.isFinite(item.y))return false;const c=this.ctx;
    if(['stackerCrane','asrs'].includes(item.type)){c.save();c.translate(item.x,item.y);c.strokeStyle=COLORS.green;c.fillStyle='#0d2530';c.lineWidth=1;c.fillRect(-52,-38,104,76);c.strokeRect(-52,-38,104,76);for(const x of [-40,-28,28,40]){c.beginPath();c.moveTo(x,-32);c.lineTo(x,32);c.stroke();}c.strokeStyle=COLORS.orange;c.lineWidth=3;c.beginPath();c.moveTo(0,-34);c.lineTo(0,34);c.stroke();c.fillStyle=COLORS.orange;c.fillRect(-8,-8,16,16);c.fillStyle='#d8f3ff';c.font='9px monospace';c.fillText(item.type==='asrs'?'AS/RS':'STACKER',-25,4);c.restore();return true;}
    if(['source','sink','dock'].includes(item.type)){c.save();c.translate(item.x,item.y);c.fillStyle='#17334a';c.strokeStyle=COLORS.cyan;c.fillRect(-42,-20,58,40);c.strokeRect(-42,-20,58,40);c.fillRect(16,-13,24,33);c.strokeRect(16,-13,24,33);c.beginPath();c.arc(-25,23,6,0,Math.PI*2);c.arc(25,23,6,0,Math.PI*2);c.stroke();c.fillStyle='#d8f3ff';c.font='9px monospace';c.fillText(item.type==='source'?'입고':'출고',-13,4);c.restore();return true;}
    if(['amr','agv'].includes(item.type)){c.save();c.translate(item.x,item.y);c.rotate(Math.PI/4);c.fillStyle='#15374a';c.strokeStyle=COLORS.yellow;c.fillRect(-22,-22,44,44);c.strokeRect(-22,-22,44,44);c.rotate(-Math.PI/4);c.fillStyle='#fff';c.font='9px monospace';c.fillText(item.type.toUpperCase(),-10,3);c.restore();return true;}
    if(item.type==='carrier'){c.fillStyle='#173f2f';c.strokeStyle=COLORS.green;c.fillRect(item.x-24,item.y-14,48,28);c.strokeRect(item.x-24,item.y-14,48,28);c.fillStyle=COLORS.green;c.font='9px monospace';c.fillText('대차',item.x-10,item.y+3);return true;}return false;
  }

  drawCadFlow(state){
    const c=this.ctx,conveyors=this.layout.equipment.filter(item=>['conveyor','processLine'].includes(item.type)&&item.source?.origin==='dxf');
    c.save();c.strokeStyle='rgba(0,255,136,.42)';c.lineWidth=2;c.setLineDash([7,6]);
    conveyors.forEach((item,index)=>{const next=conveyors.slice(index+1).sort((a,b)=>Math.hypot(item.x-a.x,item.y-a.y)-Math.hypot(item.x-b.x,item.y-b.y))[0];if(!next)return;const distance=Math.hypot(item.x-next.x,item.y-next.y);if(distance<360){c.beginPath();c.moveTo(item.x,item.y);c.lineTo(next.x,next.y);c.stroke();}});c.setLineDash([]);c.restore();
    if(state.cadTokens){const nodes=new Map(this.layout.equipment.filter(item=>item.source?.origin==='dxf').map(item=>[item.id,item]));for(const token of state.cadTokens){const from=nodes.get(token.edge?.from||token.nodeId),to=nodes.get(token.edge?.to||token.nodeId);if(!from||!to)continue;const progress=token.edge?token.progress:0,x=from.x+(to.x-from.x)*progress,y=from.y+(to.y-from.y)*progress;c.fillStyle=COLORS.yellow;c.strokeStyle='#fff2a8';c.fillRect(x-7,y-7,14,14);c.strokeRect(x-7,y-7,14,14);}return;}
    conveyors.forEach((item,index)=>{const length=Math.max(48,item.length||item.width||160),speed=Math.max(.2,item.parameters?.speed||item.parameters?.lineSpeed/20||.5),progress=((state.t*speed*32+index*29)%length)-length/2;
      c.save();c.translate(item.x,item.y);c.rotate((item.rotation||0)*Math.PI/180);c.fillStyle=COLORS.yellow;c.strokeStyle='#fff2a8';c.lineWidth=1;c.fillRect(progress-7,-7,14,14);c.strokeRect(progress-7,-7,14,14);c.restore();
    });
  }
}
