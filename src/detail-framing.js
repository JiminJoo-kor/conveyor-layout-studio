export function advanceCamera(previous,target,{locked=false,smooth=false,width=800,height=260}={}){
  if(previous&&locked)return previous;
  if(!previous||!smooth)return target;
  const z=previous.zoom+(target.zoom-previous.zoom)*.35;
  // Interpolate world centers, not translated pixels, while zoom changes.
  const cx=(width/2-previous.x)/previous.zoom*.65+(width/2-target.x)/target.zoom*.35,cy=(height/2-previous.y)/previous.zoom*.65+(height/2-target.y)/target.zoom*.35;
  return {zoom:z,x:width/2-cx*z,y:height/2-cy*z};
}
export function forwardCamera(camera,angle,sign=1){
  return {...camera,x:camera.x-Math.cos(angle)*sign*100,y:camera.y-Math.sin(angle)*sign*45};
}
export function viewportRange(item,camera,length,visualLength,width=800,height=260,sign=1){
  const a=(Number(item.rotation)||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const fractions=[[0,0],[width,0],[0,height],[width,height]].map(([x,y])=>.5+sign*(((x-camera.x)/camera.zoom-item.x)*c+((y-camera.y)/camera.zoom-item.y)*s)/visualLength);
  const start=Math.max(0,Math.min(1,Math.min(...fractions))),end=Math.max(0,Math.min(1,Math.max(...fractions)));
  return {start,end,startMeters:start*length,endMeters:end*length};
}
