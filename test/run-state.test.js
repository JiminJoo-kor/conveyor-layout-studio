import test from 'node:test';
import assert from 'node:assert/strict';
import {simulationRunState} from '../src/run-state.js';

test('실행 상태는 버튼 문구와 사용자 설명을 함께 제공한다',()=>{
 assert.deepEqual(simulationRunState('running'),{state:'running',label:'실행 중',button:'일시정지',detail:'물류 흐름과 생산성을 계산하고 있습니다.'});
 assert.equal(simulationRunState('paused').button,'재개');
 assert.equal(simulationRunState('complete').button,'다시 실행');
});

test('오류 상세를 표시하고 알 수 없는 상태는 대기로 복귀한다',()=>{
 assert.equal(simulationRunState('error','연결 없음').detail,'연결 없음');
 assert.equal(simulationRunState('unknown').state,'idle');
});
