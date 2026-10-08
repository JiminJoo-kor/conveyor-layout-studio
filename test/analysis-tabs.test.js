import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisTabVisibility,normalizeAnalysisTab} from '../src/analysis-tabs.js';

test('생산성 탭은 요약·리포트·LIVE를 함께 표시한다',()=>{
 assert.deepEqual(analysisTabVisibility('production'),{tab:'production',summary:true,events:false,report:true,rack:true});
});

test('이벤트 탭은 이벤트 표만 결과 영역에 표시한다',()=>{
 assert.deepEqual(analysisTabVisibility('events'),{tab:'events',summary:false,events:true,report:false,rack:false});
});

test('WIP는 리포트와 LIVE를 함께 사용하고 잘못된 탭은 생산성으로 복귀한다',()=>{
 assert.equal(analysisTabVisibility('wip').rack,true);
 assert.equal(normalizeAnalysisTab('unknown'),'production');
});
