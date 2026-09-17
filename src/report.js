import { validateFlowGraph } from './flow-graph.js';
import { cadDuration, equipmentLengthMeters } from './engine.js';
const unitScale=units=>units==='mm'?.001:units==='cm'?.01:units==='m'?1:null;
const position=item=>item?.source?.cadPosition;
const name=item=>item?.name||item?.type||'-';

export function buildSimulationReport(layout,engine,targetUph=0){
  const equipment=layout.equipment.filter(item=>item.reviewStatus!=='rejected'&&item.type!=='processLine'),byId=new Map(equipment.map(item=>[item.id,item])),units=layout.cadSource?.units,scale=unitScale(units),corrections=[];
  for(const item of equipment.filter(item=>item.source?.inferred))corrections.push({kind:'단절 보완',detail:`${item.name}: ${item.source.reason==='warehouse-gap'?'창고 접속 단절 구간에 가상 AGV 동선 생성':'미연결 구간 자동 연결'}`,status:'자동 보완'});
  const validation=validateFlowGraph(layout);for(const detail of [...validation.errors,...validation.warnings])corrections.push({kind:'연결 검증',detail,status:'검토 필요'});if(!corrections.length)corrections.push({kind:'연결 검증',detail:'등록 설비·입출력 연결점 검사 통과 (운전 무교착 보증 아님)',status:'확인'});
  if(!scale)corrections.push({kind:'물리 배치',detail:'화면 연결 좌표는 시각 경로입니다. 실측 좌표가 없어 설비 간 실제 간섭 거리는 미검증입니다.',status:'별도 확인'});
  else {const close=[];for(let i=0;i<equipment.length;i++)for(let j=i+1;j<equipment.length;j++){const a=position(equipment[i]),b=position(equipment[j]);if(!a||!b)continue;const d=Math.hypot(a.x-b.x,a.y-b.y)*scale;if(d>0&&d<1.5)close.push(`${name(equipment[i])} ↔ ${name(equipment[j])} (${d.toFixed(2)}m)`);}corrections.push({kind:'위치 재배치',detail:close.length?`안전거리 1.5m 미만 ${close.length}개 구간: ${close.slice(0,3).join(', ')}`:'설비 중심 간 1.5m 미만 간섭 없음',status:close.length?'조정 제안':'확인'});}
  const rows=(layout.cadSchematic?.edges||[]).map((edge,index)=>{const from=byId.get(edge.from),to=byId.get(edge.to);if(!from||!to)return null;const moving=['conveyor','processLine','agv','amr','forklift'].includes(from.type),distance=moving?equipmentLengthMeters(from,layout):0,move=moving?cadDuration(from,layout):0,work=cadDuration(to,layout),ct=move+work;return{process:`${name(from)} → ${name(to)}`,distance,move,work,ct,kind:edge.kind,index};}).filter(Boolean),maxCt=Math.max(0,...rows.map(row=>row.ct));
  rows.forEach(row=>row.bottleneck=maxCt>0&&row.ct===maxCt);
  const kpis=engine.getKpis(),realizable=kpis.throughput||0,target=Number(targetUph)||realizable;
  return{corrections,topology:(layout.cadSchematic?.edges||[]).filter(edge=>byId.has(edge.from)&&byId.has(edge.to)).map(edge=>`${name(byId.get(edge.from))} [${edge.fromPort||'자동 출구'}] → ${name(byId.get(edge.to))} [${edge.toPort||'자동 입구'}]`),timingBasis:'명목 단독 운전 시간 — 실제 대기·병렬·인터락 CT는 완료 물류 KPI를 참조',rows,kpis,targetUph:target,realizableUph:realizable,eightHours:realizable*8,twelveHours:realizable*12};
}
