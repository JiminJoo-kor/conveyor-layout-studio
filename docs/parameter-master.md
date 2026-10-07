# Parameter Master와 운동 모델 기준

`src/parameter-master.js`가 설비별 저장 파라미터의 의미를 정의하는 단일 기준이다. 기존 JSON 키는 호환성을 위해 변경하거나 중복 저장하지 않는다.

- `INPUT`: 사용자가 설비 조건으로 결정한다.
- `AUTO`: 거리·목표속도·부하 조건에서 계산한다. 기본은 읽기 전용이며 `autoMotionTuning=0`인 명시적 수동 모드에서만 편집한다.
- `RESULT`: 파생 계산 결과다. 입력 컨트롤을 없애지 않고 읽기 전용으로 표시한다.
- `STATUS`: 실행 중 상태다. 저장 입력으로 취급하지 않는다.

현재 1단계는 기존 화면과 실행 로직을 유지하면서 모든 지원 설비와 기존 UI 필드를 분류한다. AS/RS Station Conveyor 설정은 AS/RS 소유 파라미터(`stationConveyorsEnabled`, buffer count, speed, safety gap)만 참조하며 내부 station 노드에 별도 사용자 값을 중복 저장하지 않는 현 구조를 유지한다.

운동 모델은 설비 동작이 다른 이유를 코드로 명시한다. Conveyor는 선형 이송, 포크는 적재 전진/빈 복귀, Lifter는 중력 영향을 받는 상승/하강, Turntable은 회전, 이동 로봇은 주행/회전/정지, AS/RS는 X 주행/Z 승강/포크의 독립 축이다. 이 매핑은 다음 단계의 공통 motion request와 축별 부하 계산 입력이 된다.

다음 단계에서는 이 분류를 패널 섹션 순서와 배지에 연결한 뒤, 공통 motion request/result 및 원인→조치→영향 로그를 도입한다. 모터 선정은 이 결과의 torque/RPM/power 요구조건과 표준 후보 테이블을 사용하며 payload→kW 직접 매핑을 금지한다.
