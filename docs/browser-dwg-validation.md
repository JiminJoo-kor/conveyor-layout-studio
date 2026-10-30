# 브라우저 DWG 변환 및 대응 소스

@cadview/dwg 0.2.0의 LibreDWG WebAssembly로 실제 AutoCAD 예제 DWG를 DXF로 변환하는 데 성공했다. 변환 결과는 398,413 문자다. 사용자 도면을 외부 서버로 보내지 않고, 같은 사이트의 정적 WASM 파일만 내려받는 구조다.

`browser-dwg.js`와 `browser-cad-worker.js`가 운영 앱의 CAD 불러오기에 연결된다. Worker를 매번 생성하고 완료·오류·취소·120초 초과 시 종료해 메모리를 회수한다. WASM은 같은 사이트에서만 내려받는다. 도면은 File 객체로 Worker에 전달되며 fetch 업로드를 사용하지 않는다. DWG 입력 32MB, DXF 100MB, 변환 결과 64MB 제한이 있다.

사용자가 2026-10-30 GPL 소스 공개 조건을 승인했다. 이 배포는 GPL-3.0-only로 제공한다. 도면 데이터 자체의 공개를 요구하는 조건이 아니다. 시뮬레이터 소스는 공개 Git 저장소에서 제공하며 해당 배포 커밋의 파일을 내려받을 수 있다.

출처:
- https://github.com/wiscaksono/cadview/tree/main/packages/dwg
- https://www.gnu.org/licenses/gpl-faq.en.html#InternalDistribution
- https://www.gnu.org/licenses/gpl-faq.en.html#GPLRequireSourcePostedPublic

대응 소스: cadview b81f32d35423fcc3255588c27e72ac577bf05fcf, LibreDWG 3ca092780e6303da0c0a36a99d8425f08e658ffc. downloads/source에서 두 아카이브를 제공한다. cadview 압축을 풀고 packages/dwg/wasm/libredwg에 LibreDWG 소스를 놓은 뒤, Emscripten 환경에서 packages/dwg/wasm/build.sh를 실행한다. 이어 cadview 저장소의 pnpm install 및 packages/dwg의 빌드 명령으로 JS를 생성한다. 해당 소스의 README, package.json, 빌드 스크립트에 세부 절차가 포함되어 있다.

시뮬레이터 실행: Node.js 22 이상에서 npm run dev. 브라우저 사용자는 Node.js·AutoCAD·도우미를 설치할 필요가 없다. GPL 전문은 루트 LICENSE, 원본 고지는 vendor/cadview-dwg/LICENSE 및 각 대응 소스에 있다. 이 프로젝트에는 별도 보증이 없다.
