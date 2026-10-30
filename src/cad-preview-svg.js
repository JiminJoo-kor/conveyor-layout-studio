const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function cadPreviewSvg(document,transform){
 const blocks=document.drawingBlocks||{},ids=new Map(Object.keys(blocks).map((k,i)=>[k,'b'+i])),colors=['#d8e5ea','#ff5555','#ffff55','#55ff55','#55ffff','#5577ff','#ff55ff','#eeeeee'];
 const n=v=>Number.isFinite(Number(v))?Number(v):0;
 function shape(e){const color=colors[Math.abs(Number(e.color))]||'inherit',style=`stroke="${color}"`,p=e.center||{x:0,y:0};
 if(e.entityType==='INSERT'){const b=blocks[e.blockName],id=ids.get(e.blockName);return id?`<use href="#${id}" transform="translate(${n(p.x)} ${n(p.y)}) rotate(${n(e.rotation)}) scale(${e.scale?.x||1} ${e.scale?.y||1}) translate(${-n(b.base.x)} ${-n(b.base.y)})" ${style}/>`:'';}
 if(e.start&&e.end)return `<path d="M${n(e.start.x)} ${n(e.start.y)}L${n(e.end.x)} ${n(e.end.y)}" ${style}/>`;
 if(e.vertices?.length)return `<path d="${e.vertices.map((p,i)=>(i?'L':'M')+n(p.x)+' '+n(p.y)).join(' ')}${e.closed?'Z':''}" ${style}/>`;
 if(e.entityType==='CIRCLE')return `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(e.radius)}" ${style}/>`;
 if(e.entityType==='ARC'){const a=n(e.startAngle)*Math.PI/180,b=n(e.endAngle)*Math.PI/180,r=n(e.radius),sweep=(n(e.endAngle)-n(e.startAngle)+360)%360;return `<path d="M${p.x+r*Math.cos(a)} ${p.y+r*Math.sin(a)}A${r} ${r} 0 ${sweep>180?1:0} 1 ${p.x+r*Math.cos(b)} ${p.y+r*Math.sin(b)}" ${style}/>`;}
 if(e.text)return `<text transform="translate(${n(p.x)} ${n(p.y)}) rotate(${n(e.rotation)}) scale(1 -1)" font-family="sans-serif" font-size="${Math.max(1,n(e.height))}" fill="${color}" stroke="none">${esc(e.text)}</text>`;return '';
 }
 const used=new Set();function visit(e,depth=0){if(depth>12||e.entityType!=='INSERT'||!blocks[e.blockName]||used.has(e.blockName))return;used.add(e.blockName);for(const child of blocks[e.blockName].entities)visit(child,depth+1);}document.entities.forEach(e=>visit(e));
 const defs=Object.entries(blocks).filter(([k])=>used.has(k)).map(([k,b])=>`<g id="${ids.get(k)}">${b.entities.map(shape).join('')}</g>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="650" viewBox="0 0 1200 650"><defs>${defs}</defs><g fill="none" stroke="#9fd7e5" stroke-width="${.6/transform.scale}" transform="translate(${transform.offsetX} ${transform.offsetY}) scale(${transform.scale} ${-transform.scale})">${document.entities.map(shape).join('')}</g></svg>`;
}
