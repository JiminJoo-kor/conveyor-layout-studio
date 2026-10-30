// Render CAD blocks in the worker without building millions of SVG DOM instances.
export async function rasterCadPreview(document,transform,{onProgress=()=>{}}={}){
 const canvas=new OffscreenCanvas(3600,1950),c=canvas.getContext('2d'),blocks=document.drawingBlocks||{},colors=['#d8e5ea','#ff5555','#ffff55','#55ff55','#55ffff','#5577ff','#ff55ff','#eeeeee'];
 c.scale(3,3);c.translate(transform.offsetX,transform.offsetY);c.scale(transform.scale,-transform.scale);c.lineWidth=.6/transform.scale;let count=0;
 async function draw(entities,depth=0,parentColor='#9fd7e5'){
 if(depth>12)return;
 for(const e of entities){if(++count%10000===0){onProgress({stage:'CAD 전체 도면 그리기 · '+count.toLocaleString()+'개',done:null});await new Promise(r=>setTimeout(r,0));}
 const color=colors[Math.abs(Number(e.color))]||parentColor,p=e.center||{x:0,y:0};
 if(e.entityType==='INSERT'&&blocks[e.blockName]){const b=blocks[e.blockName];c.save();c.translate(p.x,p.y);c.rotate((e.rotation||0)*Math.PI/180);c.scale(e.scale?.x||1,e.scale?.y||1);c.translate(-b.base.x,-b.base.y);await draw(b.entities,depth+1,color);c.restore();continue;}
 c.strokeStyle=color;c.fillStyle=color;c.beginPath();
 if(e.start&&e.end){c.moveTo(e.start.x,e.start.y);c.lineTo(e.end.x,e.end.y);}
 else if(e.vertices?.length){c.moveTo(e.vertices[0].x,e.vertices[0].y);for(const v of e.vertices.slice(1))c.lineTo(v.x,v.y);if(e.closed)c.closePath();}
 else if(e.radius>0)c.arc(p.x,p.y,e.radius,e.entityType==='ARC'?(e.startAngle||0)*Math.PI/180:0,e.entityType==='ARC'?(e.endAngle||0)*Math.PI/180:2*Math.PI);
 else if(e.text){c.save();c.translate(p.x,p.y);c.rotate((e.rotation||0)*Math.PI/180);c.scale(1,-1);c.font=Math.max(1,e.height||1)+'px sans-serif';c.fillText(e.text,0,0);c.restore();}
 c.stroke();
 }}
 await draw(document.entities);const bytes=new Uint8Array(await (await canvas.convertToBlob({type:'image/png'})).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));return 'data:image/png;base64,'+btoa(binary);
}
