export function reassignStationConnections(layout,sourceId,targetId){
 const source=layout.equipment.find(n=>n.id===sourceId),target=layout.equipment.find(n=>n.id===targetId);
 if(!source?.asrsStation||!target?.asrsStation)throw Error('스테이션을 선택해 주세요.');
 if(sourceId===targetId)return;
 const edges=layout.cadSchematic.edges;
 if(edges.some(e=>!e.asrsStationInternal&&(e.from===targetId||e.to===targetId)))throw Error('선택한 스테이션에 이미 외부 연결이 있습니다. 연결을 먼저 정리해 주세요.');
 layout.cadSchematic.edges=edges.map(e=>{
  if(e.asrsStationInternal||e.from!==sourceId&&e.to!==sourceId)return e;
  const other=e.from===sourceId?e.to:e.from,port=e.from===sourceId?e.toPort:e.fromPort;
  return target.asrsStation.kind==='in'?{...e,from:other,fromPort:port,to:targetId,toPort:'left'}:{...e,from:targetId,fromPort:'right',to:other,toPort:port};
 });
}
