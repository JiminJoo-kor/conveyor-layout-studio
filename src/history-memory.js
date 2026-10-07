export const HISTORY_LIMITS=Object.freeze({events:5000,completedProducts:1000,completedSources:1000});
const metrics={ 'source-injected':'flowKey','asrs-stored':'zone','asrs-handoff-complete':'outboundLine' };
const eventKey=(type,line,field)=>JSON.stringify([type,line,field]);
export function appendHistory(state,key,record){
 const list=state[key];list.push(record);const limit=HISTORY_LIMITS[key];if(!limit||list.length<=limit)return;
 const archive=state.historySummary??={events:0,completedProducts:0,completedSources:0,cycleTimeSum:0,completedBoxes:0,eventCounts:{}};
 // Trim in chunks to avoid copying the whole array on every emitted event.
 const removed=list.splice(0,Math.max(128,list.length-limit));archive[key]+=removed.length;
 for(const entry of removed){
  if(key==='completedProducts'){archive.cycleTimeSum+=Number(entry.cycleTime)||0;archive.completedBoxes+=entry.boxCount??entry.stackLayers?.length??1;}
  if(key==='events'){const field=metrics[entry.type];if(field){const k=eventKey(entry.type,entry[field],field);archive.eventCounts[k]=(archive.eventCounts[k]||0)+1;}archive.lastPrunedEventTime=entry.t;}
 }
}
export const historyCount=(state,key)=>(state?.[key]?.length||0)+(state?.historySummary?.[key]||0);
export const completedCycleSum=state=>(state.historySummary?.cycleTimeSum||0)+state.completedProducts.reduce((n,p)=>n+(Number(p.cycleTime)||0),0);
export const completedBoxCount=state=>(state.historySummary?.completedBoxes||0)+state.completedProducts.reduce((n,p)=>n+(p.boxCount??p.stackLayers?.length??1),0);
export const historicalEventCount=(state,type,line,field)=>(state.historySummary?.eventCounts?.[eventKey(type,line,field)]||0)+state.events.filter(e=>e.type===type&&e[field]===line).length;
export function historyNotice(state){const h=state?.historySummary;return h?`메모리 보호: 최근 이벤트 최대 ${HISTORY_LIMITS.events}건 / 완료 물류 ${HISTORY_LIMITS.completedProducts}건 보관. 이전 이벤트 ${h.events}건·완료 ${h.completedProducts}건은 누계로 집계되며 개별 상세는 제공되지 않습니다. UPH·수량·평균 CT 누계는 유지됩니다.`:'';}
