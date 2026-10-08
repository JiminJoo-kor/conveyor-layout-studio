const states={
 idle:{label:'대기',button:'시뮬레이션 시작',detail:'검증 완료 후 실행할 수 있습니다.'},
 running:{label:'실행 중',button:'일시정지',detail:'물류 흐름과 생산성을 계산하고 있습니다.'},
 paused:{label:'일시정지',button:'재개',detail:'현재 시간과 물류 상태를 유지하고 있습니다.'},
 complete:{label:'완료',button:'다시 실행',detail:'설정한 계산 시간까지 시뮬레이션을 완료했습니다.'},
 error:{label:'실행 불가',button:'설정 확인',detail:'실행 조건 또는 연결 구성을 확인해 주세요.'}
};

export function simulationRunState(value,detail=''){
 const state=states[value]?value:'idle';
 return {state,...states[state],detail:detail||states[state].detail};
}
