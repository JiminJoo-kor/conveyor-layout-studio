export function stackVisualGroups(machine,status){
 if(machine.phase==='separating')return [{layers:machine.deck.slice(0,1),lift:0,scale:1},{layers:machine.deck.slice(1),lift:status.liftProgress,scale:status.visualScale}];
 return [{layers:machine.held,lift:status.liftProgress,scale:status.visualScale},{layers:machine.outputId?[]:machine.deck,lift:machine.phase==='lifting'?status.liftProgress:0,scale:machine.phase==='lifting'?status.visualScale:1}];
}
export function drawStackBadge(c,layers,width,height){
 if(!layers||layers.length<2)return;
 c.save();c.strokeStyle='#fff';c.lineWidth=.7;const lines=Math.min(layers.length,8);
 for(let i=1;i<lines;i++){const y=-height/2+i*height/lines;c.beginPath();c.moveTo(-width/2,y);c.lineTo(width/2,y);c.stroke();}
 c.fillStyle='#06121eee';c.fillRect(-9,-7,18,14);c.fillStyle='#fff';c.font='bold 9px sans-serif';c.textAlign='center';c.fillText(`${layers.length}`,0,3);c.restore();
}
