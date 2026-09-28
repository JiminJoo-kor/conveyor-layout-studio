export function createSequenceSchedule({interval=30,count=1,mode='fifo',cells=[],seed=1,startAt=0}={}){
 if(!Number.isFinite(interval)||interval<=0||!Number.isInteger(count)||count<1)throw Error('출고 주기·수량 오류');
 if(!['fifo','random','specified'].includes(mode))throw Error('셀 선택 모드 오류');
 if(mode==='specified'&&(!cells.length||cells.some(c=>!Number.isInteger(c)||c<0)))throw Error('지정 셀 순서를 입력하세요.');
 if(!Number.isFinite(startAt)||startAt<0)throw Error('시작 시각 오류');
 return {interval,count,mode,cells:[...cells],cursor:0,seed:(seed>>>0)||1,nextDue:startAt+interval,active:null,serial:0};
}
const random=s=>{s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;};
// Each physical stacker owns one schedule. No shared deadline, cursor or random stream.
// inventory entries: {id,cell,storedAt,reserved}; no mutation of physical warehouse inventory.
export function planSequenceRelease(s,time,inventory,{available=true,busy=false,maxCarry=Infinity}={}){
 if(!Number.isFinite(time)||time<0)throw Error('잘못된 시각');
 if(s.active)return {job:s.active,reason:'기존 출고 작업 중',created:false};
 if(!available||busy)return {job:null,reason:!available?'설비 비가동':'해당 스태커 작업 중',created:false};
 if(time<s.nextDue)return {job:null,reason:'출고 주기 대기',created:false};
 const seen=new Set();for(const item of inventory){if(item.id==null||seen.has(item.id))throw Error('재고 물품 ID 오류');seen.add(item.id);}
 const candidates=inventory.filter(i=>!i.reserved),limit=Math.min(s.count,Number.isFinite(maxCarry)?Math.max(0,Math.floor(maxCarry)):s.count),selected=[];
 let nextCursor=s.cursor;
 if(s.mode==='specified'){
  for(let i=0;i<limit;i++){
   const cell=s.cells[nextCursor%s.cells.length],item=candidates.find(c=>c.cell===cell&&!selected.includes(c));
   if(!item)break;selected.push(item);nextCursor++;
  }
 }else{
  candidates.sort((a,b)=>(a.storedAt??0)-(b.storedAt??0)||a.cell-b.cell);
  while(selected.length<limit&&candidates.length)selected.push(candidates.splice(s.mode==='random'?Math.floor(random(s)*candidates.length):0,1)[0]);
 }
 if(!selected.length)return {job:null,reason:limit===0?'운반 허용 수량 부족':s.mode==='specified'?'지정 순서 셀 재고 없음':'출고 가능 재고 없음',created:false};
 s.active={id:++s.serial,requested:s.count,productIds:selected.map(i=>i.id),cells:selected.map(i=>i.cell),nextCursor,completedIds:[],createdAt:time,dueAt:s.nextDue};
 return {job:structuredClone(s.active),reason:null,created:true};
}
// Advance the sequence only on acknowledged per-item physical handover completion.
export function acknowledgeSequenceRelease(s,jobId,productId,time){
 const job=s.active;if(!job||job.id!==jobId||!job.productIds.includes(productId)||job.completedIds.includes(productId))return false;
 if(!Number.isFinite(time)||time<job.createdAt)throw Error('인계 완료 시각 오류');
 job.completedIds.push(productId);
 if(job.completedIds.length===job.productIds.length){s.cursor=job.nextCursor;s.nextDue=job.dueAt+(Math.floor(Math.max(0,time-job.dueAt)/s.interval)+1)*s.interval;s.active=null;}
 return true;
}
