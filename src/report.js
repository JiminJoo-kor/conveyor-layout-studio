const unitScale=units=>units==='mm'?.001:units==='cm'?.01:units==='m'?1:null;
const position=item=>item?.source?.cadPosition;
const name=item=>item?.name||item?.type||'-';

export function buildSimulationReport(layout,engine,targetUph=0){
  const equipment=layout.equipment.filter(item=>item.source?.origin==='dxf'&&item.type!=='processLine'),byId=new Map(equipment.map(item=>[item.id,item])),units=layout.cadSource?.units,scale=unitScale(units),corrections=[];
  for(const item of equipment.filter(item=>item.source?.inferred))corrections.push({kind:'단절 보완',detail:`${item.name}: ${item.source.reason==='warehouse-gap'?'창고 접속 단절 구간에 가상 AGV 동선 생성':'미연결 구간 자동 연결'}`,status:'자동 보완'});
  if(!corrections.length)corrections.push({kind:'단절 보완',detail:'승인된 토폴로지에서 미연결 단절 구간 없음',status:'확인'});
  if(!scale)corrections.push({kind:'위치 재배치',detail:'DXF 단위가 불명확하여 1.5~2m 안전거리 자동 재배치는 보류됨',status:'검토 필요'});
  else {const close=[];for(let i=0;i<equipment.length;i++)for(let j=i+1;j<equipment.length;j++){const a=position(equipment[i]),b=position(equipment[j]);if(!a||!b)continue;const d=Math.hypot(a.x-b.x,a.y-b.y)*scale;if(d>0&&d<1.5)close.push(`${name(equipment[i])} ↔ ${name(equipment[j])} (${d.toFixed(2)}m)`);}corrections.push({kind:'위치 재배치',detail:close.length?`안전거리 1.5m 미만 ${close.length}개 구간: ${close.slice(0,3).join(', ')}`:'설비 중심 간 1.5m 미만 간섭 없음',status:close.length?'조정 제안':'확인'});}
  const rows=(layout.cadSchematic?.edges||[]).map((edge,index)=>{const from=byId.get(edge.from),to=byId.get(edge.to);if(!from||!to)return null;const a=position(from),b=position(to),distance=a&&b&&scale?Math.hypot(a.x-b.x,a.y-b.y)*scale:Math.hypot(from.x-to.x,from.y-to.y)/20,speed=Math.max(.1,Number(from.parameters?.speed||from.parameters?.travelSpeed||.8)),move=distance/speed,work=Math.max(.2,Number(to.parameters?.cycleTime||to.parameters?.processTime||to.parameters?.dischargeTime||(['asrs','stackerCrane'].includes(to.type)?10:1))),ct=move+work;return{process:`${name(from)} → ${name(to)}`,distance,move,work,ct,kind:edge.kind,index};}).filter(Boolean),maxCt=Math.max(0,...rows.map(row=>row.ct));
  rows.forEach(row=>row.bottleneck=maxCt>0&&row.ct===maxCt);
  const kpis=engine.getKpis(),realizable=kpis.throughput||0,target=Number(targetUph)||realizable;
  return{corrections,topology:(layout.cadSchematic?.lanes||[]).map(lane=>`${lane.name}: ${lane.direction==='inbound'?'입고 트럭 → 컨베이어 → H/P/포킹 → AS/RS 보관':'AS/RS 반출 → H/P/포킹 → 컨베이어 → AMR → 출고 트럭'}`),rows,kpis,targetUph:target,realizableUph:realizable,eightHours:realizable*8,twelveHours:realizable*12};
}
