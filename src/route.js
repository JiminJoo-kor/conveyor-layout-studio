export function orthogonalRoute(from,to){
  if(Math.abs(from.y-to.y)<=8)return[{x:from.x,y:from.y},{x:to.x,y:to.y}];
  const elbowX=from.x+(to.x-from.x)*.55;
  return[{x:from.x,y:from.y},{x:elbowX,y:from.y},{x:elbowX,y:to.y},{x:to.x,y:to.y}];
}

export function routeLength(points){
  return points.slice(1).reduce((sum,point,index)=>sum+Math.hypot(point.x-points[index].x,point.y-points[index].y),0);
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

export function equipmentPorts(item,distance=44){
  const angle=(Number(item?.rotation)||0)*Math.PI/180,rotate=(x,y)=>({x:item.x+x*Math.cos(angle)-y*Math.sin(angle),y:item.y+x*Math.sin(angle)+y*Math.cos(angle)});
  return{left:rotate(-distance,0),right:rotate(distance,0),top:rotate(0,-distance),bottom:rotate(0,distance)};
}

export function connectionAnchor(item,port){return port&&equipmentPorts(item)[port]||{x:item.x,y:item.y};}

export function closestPortPair(from,to){
  const fromPorts=equipmentPorts(from),toPorts=equipmentPorts(to);let best=null;
  for(const [fromPort,a] of Object.entries(fromPorts))for(const [toPort,b] of Object.entries(toPorts)){const distance=Math.hypot(a.x-b.x,a.y-b.y);if(!best||distance<best.distance)best={fromPort,toPort,distance};}
  return best;
}
