import {validateFlowGraph} from './flow-graph.js';
export const workspaceRoles={
 design:{title:'설계',description:'설비 배치·연결점·실제 치수·운전 파라메터를 정의합니다. 표시 좌표와 물리 치수는 다릅니다.'},
 simulation:{title:'시뮬레이션',description:'같은 엔진 시간으로 이동·점유·인계·대기를 계산합니다. 화면 변경은 실행 상태를 변경하지 않아야 합니다.'},
 analysis:{title:'분석',description:'실행 결과의 UPH·CT·WIP와 설계 추정치를 구분해 확인합니다. 현재 상단 버튼은 해당 작업 화면으로 이동합니다.'}
};
export function auditLayout(layout,state={}){
 const findings=[],add=(severity,code,message,id)=>findings.push({severity,code,message,id});
 const graph=validateFlowGraph(layout);
 for(const message of graph.errors)add('error','graph',message);
 for(const message of graph.warnings)add('warning','graph',message);
 const items=layout.equipment||[],ids=new Set(items.map(e=>e.id)),edges=layout.cadSchematic?.edges||[];
 for(const item of items){
   if(!Number.isFinite(item.x)||!Number.isFinite(item.y)||!Number.isFinite(Number(item.rotation??0)))add('error','pose',`${item.name||item.id}: 유효하지 않은 배치 좌표/회전`,item.id);
   if(item.source?.dimensionReviewRequired)add('warning','dimensions',`${item.name||item.id}: CAD 치수 확인 필요`,item.id);
   if(['conveyor','sorter'].includes(item.type)){
     if(!(Number(item.parameters?.length)>0))add('error','length',`${item.name||item.id}: 실제 길이 입력 필요`,item.id);
     if(Number(item.parameters?.safetyGap)<0)add('error','gap',`${item.name||item.id}: 안전간격은 음수일 수 없습니다.`,item.id);
     if(!edges.some(e=>e.to===item.id))add('warning','input',`${item.name||item.id}: 상류 연결 없음`,item.id);
     if(!edges.some(e=>e.from===item.id))add('warning','output',`${item.name||item.id}: 하류 연결 없음`,item.id);
   }
 }
 const tokens=new Set();for(const token of state.cadTokens||[]){
   if(tokens.has(token.id))add('error','cargo-id',`중복 물류 ID: ${token.id}`,token.nodeId);tokens.add(token.id);
   if(!ids.has(token.nodeId))add('error','cargo-owner',`물류 #${token.id}: 소유 설비가 없습니다.`,token.nodeId);
   if(token.edge&&(!ids.has(token.edge.from)||!ids.has(token.edge.to)))add('error','handover-owner',`물류 #${token.id}: 인계 대상 설비가 없습니다.`,token.nodeId);
 }
 return {time:Number(state.t)||0,equipmentCount:items.length,connectionCount:edges.length,cargoCount:tokens.size,findings,errors:findings.filter(f=>f.severity==='error').length,warnings:findings.filter(f=>f.severity==='warning').length,scope:'연결·치수 입력·배치 좌표·물류 소유 상태의 정적 점검입니다. 충돌 및 모든 시퀀스의 정상 동작을 보증하지 않습니다.'};
}
