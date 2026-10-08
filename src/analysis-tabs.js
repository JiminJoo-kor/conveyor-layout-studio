const tabs=new Set(['production','ct','wip','bottleneck','drive','events','changes']);

export function normalizeAnalysisTab(value){return tabs.has(value)?value:'production';}

export function analysisTabVisibility(value){
 const tab=normalizeAnalysisTab(value);
 return {tab,summary:tab==='production',events:tab==='events',report:tab!=='events',rack:tab==='production'||tab==='wip'};
}

export const analysisTabTitles={production:'생산성 예측',ct:'공정별 CT',wip:'재공품 · WIP',bottleneck:'병목 분석',drive:'Drive · 모터 구성',events:'이벤트',changes:'자동 변경 로그'};
export const analysisTabGroups={core:['production','ct','wip','bottleneck'],detail:['drive','events','changes']};
const descriptions={production:'완료 물류 기반 UPH · 평균 CT · 현재 WIP',ct:'설비와 공정별 체류시간 및 사이클 비교',wip:'라인별 재공 분포와 정체 위치',bottleneck:'가동률과 대기시간 기반 병목 후보',drive:'구동 구간별 모터 용량과 사용률',events:'시뮬레이션 상태 변경과 물류 이동 기록',changes:'AUTO ENGINEERING 원인 → 조치 → 영향'};
export function analysisTabMeta(value){const tab=normalizeAnalysisTab(value);return{tab,title:analysisTabTitles[tab],description:descriptions[tab],group:analysisTabGroups.detail.includes(tab)?'detail':'core'};}
