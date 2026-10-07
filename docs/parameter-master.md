# Parameter Master와 운동 모델 기준

`src/parameter-master.js`가 설비별 저장 파라미터의 의미를 정의하는 단일 기준이다. 기존 JSON 키는 호환성을 위해 변경하거나 중복 저장하지 않는다.

- `INPUT`: 사용자가 설비 조건으로 결정한다.
- `AUTO`: 거리·목표속도·부하 조건에서 계산한다. 기본은 읽기 전용이며 `autoMotionTuning=0`인 명시적 수동 모드에서만 편집한다.
- `RESULT`: 파생 계산 결과다. 입력 컨트롤을 없애지 않고 읽기 전용으로 표시한다.
- `STATUS`: 실행 중 상태다. 저장 입력으로 취급하지 않는다.

현재 1단계는 기존 화면과 실행 로직을 유지하면서 모든 지원 설비와 기존 UI 필드를 분류한다. AS/RS Station Conveyor 설정은 AS/RS 소유 파라미터(`stationConveyorsEnabled`, buffer count, speed, safety gap)만 참조하며 내부 station 노드에 별도 사용자 값을 중복 저장하지 않는 현 구조를 유지한다.

운동 모델은 설비 동작이 다른 이유를 코드로 명시한다. Conveyor는 선형 이송, 포크는 적재 전진/빈 복귀, Lifter는 중력 영향을 받는 상승/하강, Turntable은 회전, 이동 로봇은 주행/회전/정지, AS/RS는 X 주행/Z 승강/포크의 독립 축이다. 이 매핑은 다음 단계의 공통 motion request와 축별 부하 계산 입력이 된다.

`src/auto-engineering.js`는 다음 계산 경계를 제공한다.

1. `solveMotionRequest`: 실제 거리와 목표속도 및 가감속 조건으로 삼각형/사다리꼴을 판정한다.
2. `driveRequirements`: payload와 설비 이동질량을 힘, 출력축 torque, motor torque, RPM, power 요구조건으로 변환한다.
3. `selectStandardMotor`: 세 요구조건을 모두 만족하는 첫 표준 모터를 선택하며 후보가 없으면 명시적으로 실패한다.
4. `engineeringChangeLog`: 자동 변경을 원인, 조치, 영향으로 기록한다.

Payload를 kW에 직접 대응시키지 않는다. 같은 payload도 속도, 가속도, 경사, 휠 반경, 감속비와 효율에 따라 다른 모터가 선택되어야 한다. 현재 계산은 UI/저장값을 직접 변경하지 않는 preview 경계이며, 설비별 상세 모델을 검증한 뒤 시뮬레이션에 연결한다.

설비별 preview는 하나의 대표값으로 축약하지 않는다. AS/RS는 X 주행, Z 상승, Z 하강, 적재 포크, 빈 포크를 각각 계산한다. AMR·AGV는 인수, 주행, 인계로 나누고, Lifter는 중력 방향이 다른 상승과 하강을 분리한다. `equipmentRole=turnConveyor`와 `equipmentRole=pneumatic`도 각각 transfer/rotary 및 extend/retract 요청을 만든다. 모터 후보는 이 축별 요구조건 중 가장 큰 power 요구 축을 기준으로 선정하되 모든 축 결과를 함께 반환한다.

선택 설비 카드의 `AUTO ENGINEERING`은 preview 결과만 표시한다. Motor, Peak Torque, RPM, Required Power, 축별 프로파일과 원인→조치→영향 로그는 읽기 전용이며 입력 컨트롤이나 별도 저장 키를 만들지 않는다. 물류 중량은 공통 cargo spec을 사용하고, 설비 이동질량은 현재 설비별 보수적 기본 가정을 표시한다. 이후 실제 기구 데이터가 제공되면 `movingMassKg`로 명시할 수 있다.
