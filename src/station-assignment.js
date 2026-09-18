// Resolve names from this warehouse's physical inlet, never another warehouse's index.
export function stationLineLabel(layout,parent,index,zoneName,patterns=[]){
 const edges=layout.cadSchematic?.edges||[],nodes=new Map(layout.equipment.map(n=>[n.id,n])),seen=new Set(),names=new Set();
 const station=layout.equipment.find(n=>n.asrsStation?.parentId===parent.id&&n.asrsStation.index===index&&n.asrsStation.kind==='in');
 const queue=station?[station.id]:edges.filter(e=>e.to===parent.id&&e.toPort===`product-${index+1}-in`).map(e=>e.from);
 const meaningful=name=>name&&!/^(라인|line|품목|물류)\s*\d+$/i.test(name.trim());
 const identity=[parent.parameters?.zoneNames?.[index],zoneName,layout.cadSchematic?.inboundBranches?.[index]?.name].find(meaningful);
 if(identity)return identity;
 while(queue.length){const id=queue.shift();if(seen.has(id))continue;seen.add(id);const node=nodes.get(id);if(!node||id===parent.id)continue;
  if(node.type==='source'||node.type==='dock'&&node.parameters?.dockRole==='inbound'){
   const name=node.parameters?.lineName||node.name;
   if(meaningful(name)&&!/^(입고|source|dock)$/i.test(name.trim()))names.add(name.trim());
   continue;
  }
  for(const edge of edges)if(edge.to===id&&!edge.asrsStationInternal)queue.push(edge.from);
 }
 if(names.size===1)return [...names][0];
 const branch=(layout.cadSchematic?.inboundBranches||[]).find(b=>b.nodeIds?.some(id=>seen.has(id)));
 const configured=parent.parameters?.zoneNames?.[index];
 return stationPatternLabel(index,[configured,branch?.name,zoneName].find(meaningful),patterns);
}
export function stationPatternLabel(index,zoneName,patterns=[]){
 const pattern=patterns.find(p=>p.line===zoneName||p.key===zoneName)||(!zoneName?patterns[index]:null);
 return pattern?.label||zoneName||`물류 ${index+1}`;
}
export function reassignStationConnections(layout,sourceId,targetId,{swapOccupied=false}={}){
 const source=layout.equipment.find(n=>n.id===sourceId),target=layout.equipment.find(n=>n.id===targetId);
 if(!source?.asrsStation||!target?.asrsStation)throw Error('스테이션을 선택해 주세요.');
 if(sourceId===targetId)return;
 const edges=layout.cadSchematic.edges;
 if(!swapOccupied&&edges.some(e=>!e.asrsStationInternal&&(e.from===targetId||e.to===targetId)))throw Error('선택한 스테이션에 이미 외부 연결이 있습니다. 연결을 먼저 정리해 주세요.');
 layout.cadSchematic.edges=edges.map(e=>{
  if(swapOccupied&&!e.asrsStationInternal&&(e.from===targetId||e.to===targetId)){
   const other=e.from===targetId?e.to:e.from,port=e.from===targetId?e.toPort:e.fromPort;
   return source.asrsStation.kind==='in'?{...e,from:other,fromPort:port,to:sourceId,toPort:'left'}:{...e,from:sourceId,fromPort:'right',to:other,toPort:port};
  }
  if(e.asrsStationInternal||e.from!==sourceId&&e.to!==sourceId)return e;
  const other=e.from===sourceId?e.to:e.from,port=e.from===sourceId?e.toPort:e.fromPort;
  return target.asrsStation.kind==='in'?{...e,from:other,fromPort:port,to:targetId,toPort:'left'}:{...e,from:targetId,fromPort:'right',to:other,toPort:port};
 });
}
