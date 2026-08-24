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
    this.drawDxfGeometry();
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
      c.stroke();
    }c.restore();
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
      if(item.type==='robot') {
        c.beginPath(); c.arc(item.x,item.y,27,0,Math.PI*2); c.fillStyle=state.robot.phase==='idle'?'#6f2530':COLORS.orange; c.fill();
        c.strokeStyle=state.robot.phase==='idle'?'#b54555':COLORS.yellow; c.stroke(); c.fillStyle='#fff'; c.font='bold 11px monospace'; c.fillText(state.robot.phase.toUpperCase(),item.x-18,item.y+4);
        if(item.id===this.selectedId){c.strokeStyle=COLORS.yellow;c.lineWidth=2;c.strokeRect(item.x-34,item.y-34,68,68);}
      } else if(item.nodeId) {
        const pos=this.nodePositions.get(item.nodeId); if(!pos) continue;
        const busy=Boolean(state.locks[item.id]); c.fillStyle=busy?COLORS.pink:COLORS.text; c.font='10px monospace'; c.fillText(item.type==='station'?'WORK':'FORK',pos.x+18,pos.y+76);
      } else if(Number.isFinite(item.x)&&Number.isFinite(item.y)) {
        const long=item.type==='conveyor',w=long?Math.max(24,Math.min(500,item.length||item.width||60)):Math.max(32,Math.min(120,item.width||60)),h=long?Math.max(10,Math.min(36,item.height||14)):Math.max(24,Math.min(90,item.height||40));
        c.save();c.translate(item.x,item.y);c.rotate((item.rotation||0)*Math.PI/180);c.fillStyle=state.locks[item.id]?COLORS.pink:'#17334a';c.strokeStyle=item.id===this.selectedId?COLORS.yellow:COLORS.cyan;c.lineWidth=item.id===this.selectedId?2:1;
        c.fillRect(-w/2,-h/2,w,h);c.strokeRect(-w/2,-h/2,w,h);if(long){c.setLineDash([8,5]);c.beginPath();c.moveTo(-w/2+5,0);c.lineTo(w/2-5,0);c.stroke();c.setLineDash([]);}c.restore();
        c.fillStyle='#d8f3ff';c.font='10px monospace';c.fillText(item.type.toUpperCase().slice(0,6),item.x-Math.min(23,w/3),item.y+4);
      }
    }
  }

  drawCadFlow(state){
    const c=this.ctx,conveyors=this.layout.equipment.filter(item=>item.type==='conveyor'&&item.source?.origin==='dxf');
    c.save();c.strokeStyle='rgba(0,255,136,.42)';c.lineWidth=2;c.setLineDash([7,6]);
    conveyors.forEach((item,index)=>{const next=conveyors.slice(index+1).sort((a,b)=>Math.hypot(item.x-a.x,item.y-a.y)-Math.hypot(item.x-b.x,item.y-b.y))[0];if(!next)return;const distance=Math.hypot(item.x-next.x,item.y-next.y);if(distance<360){c.beginPath();c.moveTo(item.x,item.y);c.lineTo(next.x,next.y);c.stroke();}});c.setLineDash([]);c.restore();
    conveyors.forEach((item,index)=>{const length=Math.max(48,item.length||item.width||80),speed=Math.max(.2,item.parameters?.speed||.5),progress=((state.t*speed*32+index*29)%length)-length/2;
      c.save();c.translate(item.x,item.y);c.rotate((item.rotation||0)*Math.PI/180);c.fillStyle=COLORS.yellow;c.strokeStyle='#fff2a8';c.lineWidth=1;c.fillRect(progress-7,-7,14,14);c.strokeRect(progress-7,-7,14,14);c.restore();
    });
  }
}
