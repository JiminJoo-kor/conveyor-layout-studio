const tabs=new Set(['production','ct','wip','bottleneck','drive','events','changes']);

export function normalizeAnalysisTab(value){return tabs.has(value)?value:'production';}

export function analysisTabVisibility(value){
 const tab=normalizeAnalysisTab(value);
 return {tab,summary:tab==='production',events:tab==='events',report:tab!=='events',rack:tab==='production'||tab==='wip'};
}

export const analysisTabTitles={production:'생산성 예측',ct:'공정별 CT',wip:'재공품 · WIP',bottleneck:'병목 분석',drive:'Drive · 모터 구성',events:'이벤트',changes:'자동 변경 로그'};
