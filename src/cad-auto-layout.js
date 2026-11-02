import {proposeCadConnections,validateCadConnections} from './cad-import.js';
import {equipmentFlowPorts} from './route.js';
export function autoPlaceCad(layout,candidates){
 const placed=[],pending=[];layout.equipment??=[];layout.cadSchematic??={edges:[]};layout.cadSchematic.edges??=[];
 for(const item of candidates){
  if(item.reviewStatus==='rejected')continue;
  const m=item.source?.measurement;
  const certain=item.source?.typeConfirmed||item.source?.patternMatched||item.confidence>=.9;
  if(item.type==='unknown'||!certain||!m?.length||m.review||item.source?.dimensionReviewRequired){pending.push(item);continue;}
  if(!layout.equipment.some(e=>e.id===item.id)){item.reviewStatus='approved';item.source.autoPlaced=true;layout.equipment.push(item);placed.push(item);}
 }
 const items=layout.equipment.filter(e=>e.source?.origin==='dxf');
 const proposals=proposeCadConnections(items),counts=new Map();
 for(const p of proposals)for(const key of [`${p.from}:${p.fromPort}`,`${p.to}:${p.toPort}`])counts.set(key,(counts.get(key)||0)+1);
 let connected=0;
 for(const proposal of proposals){
  const a=items.find(i=>i.id===proposal.from),b=items.find(i=>i.id===proposal.to);
  if(!a.source.flowConfirmed||!b.source.flowConfirmed)continue;
  let p=proposal;
  if(equipmentFlowPorts(a).input===p.fromPort&&equipmentFlowPorts(b).output===p.toPort)p={...p,from:p.to,to:p.from,fromPort:p.toPort,toPort:p.fromPort};
  const from=items.find(i=>i.id===p.from),to=items.find(i=>i.id===p.to);
  if(equipmentFlowPorts(from).output!==p.fromPort||equipmentFlowPorts(to).input!==p.toPort)continue;
  if(counts.get(`${p.from}:${p.fromPort}`)!==1||counts.get(`${p.to}:${p.toPort}`)!==1)continue;
  if(layout.cadSchematic.edges.some(e=>(e.from===p.from&&e.fromPort===p.fromPort)||(e.to===p.to&&e.toPort===p.toPort)))continue;
  layout.cadSchematic.edges.push({...p,reviewRequired:false,confirmed:true,automatic:true});connected++;
 }
 layout.cadPendingCandidates=pending;
 layout.cadPlacementReview={placed:items.length,pending:pending.length,issues:validateCadConnections(items,layout.cadSchematic.edges)};
 return {placed,pending,connected};
}
export function cadExecutionBlockers(layout){
 if(!layout.cadSource)return [];
 const items=layout.equipment.filter(e=>e.source?.origin==='dxf'),messages=[];
 if(layout.cadPendingCandidates?.length)messages.push(`설비 후보 ${layout.cadPendingCandidates.length}개 승인 또는 제외 필요`);
 if(!items.length)messages.push('확정된 CAD 설비가 없습니다.');
 const direction=items.filter(e=>e.type==='conveyor'&&!e.source.flowConfirmed);
 if(direction.length)messages.push(`진행 방향 ${direction.length}개 확인 필요`);
 const issues=validateCadConnections(items,layout.cadSchematic?.edges||[]);
 if(issues.length)messages.push(`연결점 ${issues.length}건 검수 필요`);
 return messages;
}
