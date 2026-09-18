export function orthogonalRoute(from,to){
  if(Math.abs(from.y-to.y)<=8)return[{x:from.x,y:from.y},{x:to.x,y:to.y}];
  const elbowX=from.x+(to.x-from.x)*.55;
  return[{x:from.x,y:from.y},{x:elbowX,y:from.y},{x:elbowX,y:to.y},{x:to.x,y:to.y}];
}

export function edgeRoute(from,to,edge={}){
  const offset=edge.routeOffset||{x:0,y:0};
  if(Math.abs(from.y-to.y)<=8){const y=(from.y+to.y)/2+(Number(offset.y)||0);if(Math.abs(y-from.y)<=1)return[{x:from.x,y:from.y},{x:to.x,y:to.y}];return[{x:from.x,y:from.y},{x:from.x,y},{x:to.x,y},{x:to.x,y:to.y}];}
  const x=from.x+(to.x-from.x)*.55+(Number(offset.x)||0),yOffset=Number(offset.y)||0;
  if(!yOffset)return[{x:from.x,y:from.y},{x,y:from.y},{x,y:to.y},{x:to.x,y:to.y}];
  const y=from.y+yOffset;
  return[{x:from.x,y:from.y},{x:from.x,y},{x,y},{x,y:to.y},{x:to.x,y:to.y}];
}

export function routeLength(points){
  return points.slice(1).reduce((sum,point,index)=>sum+Math.hypot(point.x-points[index].x,point.y-points[index].y),0);
}

export function routeArrow(points,ratio=.62){
  const segments=points.slice(1).map((to,index)=>{const from=points[index];return{from,to,length:Math.hypot(to.x-from.x,to.y-from.y)};}).filter(segment=>segment.length>1),segment=segments.sort((a,b)=>b.length-a.length)[0];if(!segment)return null;return{x:segment.from.x+(segment.to.x-segment.from.x)*ratio,y:segment.from.y+(segment.to.y-segment.from.y)*ratio,angle:Math.atan2(segment.to.y-segment.from.y,segment.to.x-segment.from.x)};
}

export function pointOnRoute(points,progress){
  const total=Math.max(1,routeLength(points));let remaining=Math.max(0,Math.min(1,progress))*total;
  for(let index=1;index<points.length;index++){
    const from=points[index-1],to=points[index],length=Math.hypot(to.x-from.x,to.y-from.y);
    if(remaining<=length||index===points.length-1){const ratio=length?remaining/length:0;return{x:from.x+(to.x-from.x)*ratio,y:from.y+(to.y-from.y)*ratio};}
    remaining-=length;
  }
  return points.at(-1);
}

export function equipmentPorts(item,distance=null){
  const storage=['asrs','stackerCrane'].includes(item?.type),horizontal=Number.isFinite(distance)?distance:storage?97:44,vertical=Number.isFinite(distance)?distance:storage?74:44,angle=(Number(item?.rotation)||0)*Math.PI/180,rotate=(x,y)=>({x:item.x+x*Math.cos(angle)-y*Math.sin(angle),y:item.y+x*Math.sin(angle)+y*Math.cos(angle)}),ports={left:rotate(-horizontal,0),right:rotate(horizontal,0),top:rotate(0,-vertical),bottom:rotate(0,vertical)};
  if(storage){const count=Math.max(1,Math.round(Number(item.parameters?.productTypes)||1)),span=Math.min(104,Math.max(0,(count-1)*26)),start=-span/2,infeedSide=['left','right','top','bottom'].includes(item.parameters?.infeedSide)?item.parameters.infeedSide:'left',outfeedSide=['left','right','top','bottom'].includes(item.parameters?.outfeedSide)?item.parameters.outfeedSide:'right',sameSide=infeedSide===outfeedSide,point=(side,index,kind)=>{const lane=count===1?0:start+span*index/(count-1)+(sameSide?(kind==='in'?-8:8):0);if(side==='right')return rotate(horizontal,lane);if(side==='top')return rotate(lane,-vertical);if(side==='bottom')return rotate(lane,vertical);return rotate(-horizontal,lane);};for(let index=0;index<count;index++){ports[`product-${index+1}-in`]=point(infeedSide,index,'in');ports[`product-${index+1}-out`]=point(outfeedSide,index,'out');}}
  return ports;
}

export function equipmentDirectionControls(item,distance=64){
  if(!item||!Number.isFinite(item.x)||!Number.isFinite(item.y))return[];
  const vertical=Math.abs(Math.sin((Number(item.rotation)||0)*Math.PI/180))>.7;
  return vertical
    ?[{direction:'up',label:'↑',x:item.x,y:item.y-distance},{direction:'down',label:'↓',x:item.x,y:item.y+distance}]
    :[{direction:'left',label:'←',x:item.x-distance,y:item.y},{direction:'right',label:'→',x:item.x+distance,y:item.y}];
}

export function equipmentFlowPorts(item,direction=item?.parameters?.flowDirection){
  const main=item?.parameters?.diverterMainPort;
  if(arguments.length<2&&Number(item?.parameters?.diverterEnabled)===1&&['left','right','top','bottom'].includes(main))return{input:{left:'right',right:'left',top:'bottom',bottom:'top'}[main],output:main};
  const vectors={left:{x:-1,y:0},right:{x:1,y:0},up:{x:0,y:-1},down:{x:0,y:1}},wanted=vectors[direction];
  if(!wanted)return{input:'left',output:'right'};
  const ports=equipmentPorts(item),output=Object.entries(ports).sort((a,b)=>((b[1].x-item.x)*wanted.x+(b[1].y-item.y)*wanted.y)-((a[1].x-item.x)*wanted.x+(a[1].y-item.y)*wanted.y))[0][0],opposite={left:'right',right:'left',top:'bottom',bottom:'top'};
  return{input:opposite[output],output};
}

export function connectionAnchor(item,port){return port&&equipmentPorts(item)[port]||{x:item.x,y:item.y};}

export function closestPortPair(from,to){
  const allFrom=equipmentPorts(from),allTo=equipmentPorts(to),storage=node=>['asrs','stackerCrane'].includes(node?.type),fromPorts=storage(from)?Object.fromEntries(Object.entries(allFrom).filter(([name])=>name.endsWith('-out'))):{left:allFrom.left,right:allFrom.right},toPorts=storage(to)?Object.fromEntries(Object.entries(allTo).filter(([name])=>name.endsWith('-in'))):{left:allTo.left,right:allTo.right};let best=null;
  for(const [fromPort,a] of Object.entries(fromPorts))for(const [toPort,b] of Object.entries(toPorts)){const distance=Math.hypot(a.x-b.x,a.y-b.y);if(!best||distance<best.distance)best={fromPort,toPort,distance};}
  return best;
}

export function connectionKind(from,to,fallback='flow'){
  const types=new Set([from?.type,to?.type]);
  if([...types].some(type=>['agv','amr','shuttle','forklift'].includes(type)))return 'transfer';
  if(types.has('stackerCrane')||types.has('asrs'))return 'warehouse';
  if(types.has('forkingDevice'))return 'forking';
  if(types.has('handoffPoint'))return 'handoff';
  return ['transfer','warehouse','forking','handoff'].includes(fallback)?'flow':fallback;
}
