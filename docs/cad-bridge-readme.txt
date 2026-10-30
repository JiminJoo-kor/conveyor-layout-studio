무료 DWG 연결 도우미 (Windows 64비트)

1. ZIP 파일을 모두 압축 해제합니다.
2. Node.js LTS가 없다면 https://nodejs.org/ 에서 설치합니다.
3. LibreDWG가 없다면 scripts/install-libredwg.ps1을 PowerShell에서 실행합니다.
   공식 무료 배포본을 받으며 SHA-256을 검증합니다. 유료 CAD는 필요 없습니다.
4. Start-CAD-Bridge.cmd를 실행하고 창을 열어 둡니다.
5. https://conveyor-layout-studio.vercel.app/ 에서 PC DWG 연결을 누릅니다.
6. 도우미 창에 나온 48자리 코드를 입력하고 연결 확인을 누릅니다.
7. 브라우저가 로컬 네트워크 접근을 물으면 이 사이트에 허용합니다.
8. CAD 불러오기에서 DWG를 선택합니다. 진행상태와 분석 후보를 확인합니다.

연결 코드는 도우미를 재시작하면 바뀌고, 사이트를 새로고침하면 다시 입력해야 합니다.
도우미 창을 닫으면 연결이 종료됩니다. PC 시작 시 자동 실행하지 않습니다.
도면은 이 PC의 임시 복사본으로 변환됩니다. 외부 변환 서버에 보내지 않습니다.
최대 DWG 32MB, 변환 120초, 한 번에 한 파일입니다.
일부 특수 객체·외부 참조는 변환에서 누락될 수 있으므로 검토가 필요합니다.
브라우저/회사 정책으로 연결이 차단되면 로컬 시뮬레이터 또는 DXF를 사용하세요.

무료 도구 출처: https://github.com/LibreDWG/libredwg/releases/tag/0.14
LibreDWG는 GPLv3+이며 이 ZIP에는 바이너리를 포함하지 않습니다.
별도로 내려받은 배포본의 라이선스와 소스 제공 조건을 준수하세요.
