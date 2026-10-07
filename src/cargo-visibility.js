// Screen-space aids only: never alter physical positions or cargo dimensions.
export function cargoMarkers(records=[],view={zoom:1,x:0,y:0},ratio=1){
  const groups=new Map(),seen=new Set();
  for(const r of records){
    if(seen.has(r.id))continue;seen.add(r.id);
    if(Math.min(r.w,r.h)*view.zoom*ratio>=12)continue;
    const x=(r.x*view.zoom+view.x)*ratio,y=(r.y*view.zoom+view.y)*ratio;
    const bx=Math.floor(x/20),by=Math.floor(y/20),key=`${bx},${by}`;
    let group;
    for(let dx=-1;dx<=1&&!group;dx++)for(let dy=-1;dy<=1&&!group;dy++){
      const candidate=groups.get(`${bx+dx},${by+dy}`);
      if(candidate&&Math.hypot(candidate.x-x,candidate.y-y)<20)group=candidate;
    }
    if(group)group.ids.push(r.id);else groups.set(key,{x,y,color:r.color,ids:[r.id]});
  }
  return [...groups.values()];
}
export function detailCamera(center,size,width,height,multiplier=1){
  const zoom=Math.min(100000,Math.max(.1,48/Math.max(.00001,Math.min(size.w,size.h))))*multiplier;
  return {zoom,x:width/2-center.x*zoom,y:height/2-center.y*zoom};
}
