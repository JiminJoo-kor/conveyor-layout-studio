# CAD 자동 치수 분석 및 DWG 로컬 변환

## 사용 방법

DXF는 브라우저에서 로컬 분석합니다. 치수 문자가 없어도 단위($INSUNITS), 좌표, 회전된 외곽 형상으로 치수를 계산합니다. 단위 불명·곡선 폴리선·불완전 블록은 확인 대상으로 남깁니다. 후보에서 종류를 수정하고 `이 종류 패턴 기억`을 체크한 뒤 승인하면 이 브라우저의 localStorage에 최대 500개 패턴을 기억합니다. 치수·속도·안전간격은 다른 도면에서 복사하지 않습니다. 저장 패턴 목록에서 개별 삭제할 수 있습니다.

근접 끝점은 50mm 이내의 직선 컨베이어 후보에 대해 제안합니다. 선 중간의 교차는 연결로 보지 않습니다. 연결은 사용자가 방향을 확인하고 승인해야 반영됩니다. 미연결 입출구·고립 설비·중복·역방향을 검증합니다. 모든 도면의 끊김을 자동 복원하거나 화살표·외부 참조를 완전히 해석하는 기능은 아닙니다.

## DWG 자동 변환

AutoCAD와 유효한 라이선스가 있는 Windows PC에서 저장소 폴더를 열고:

```powershell
npm run dev:dwg
```

`http://127.0.0.1:4173/`에서 `CAD 불러오기`로 DWG를 선택합니다. 설치 경로가 다르면 실행 전에 `$env:ACCORE_CONSOLE='C:/.../accoreconsole.exe'`를 지정합니다. 기본 탐색 대상은 AutoCAD 2025 및 AutoCAD LT 2025입니다.

DWG → 해당 PC의 AutoCAD Core Console → ASCII DXF → 분석 Worker → 후보 검수 순서로 진행합니다. DWG 원본 바이트의 임시 복사본만 열며 `/readonly`와 `/isolate`를 사용합니다. 파일명은 CAD 명령에 삽입하지 않습니다. 변환 종료 후 임시 작업 폴더를 정리합니다. Windows가 파일을 잠근 경우 서버 콘솔에 정리 보류 경로를 남깁니다.

- DWG 입력 최대 32MB, DXF 변환 출력 최대 64MB, 변환 제한시간 120초, 동시 변환 1개.
- 취소 또는 연결 종료 시 실행한 변환 프로세스를 중지합니다.
- 로컬 동일 출처 요청만 받으며 CORS를 열지 않습니다. 외부 변환 서비스로 전송하지 않습니다.
- 외부 참조 도면·프록시 객체·특수 3D 객체는 완전한 변환/분석을 보장하지 않습니다. 단일 DWG 업로드에 포함되지 않은 외부 파일은 가져오지 않습니다.
- 일반 `npm run dev`와 Vercel 배포에서는 네이티브 변환기가 없으므로 DWG 선택 시 설정 안내를 표시합니다. Vercel 배포만으로 사용자 PC의 AutoCAD가 실행되지는 않습니다.

## 검증

`node --test test/cad-import.test.js test/dwg-converter.test.js`

실제 AutoCAD 2025 예제 `Mechanical - Text and Tables.dwg`를 읽기 전용 복사본으로 변환해 ASCII DXF 생성과 원본 SHA-256 불변을 확인했습니다. 이는 모든 사용자 도면 및 브라우저 UI에 대한 검증을 의미하지 않습니다.

기술 참고: [Autodesk Core Console](https://blog.autodesk.io/getting-started-with-accoreconsole/), [Autodesk DXF 내보내기](https://help.autodesk.com/cloudhelp/2023/ENU/AutoCAD-LT/files/GUID-11AEFE3C-D05A-45C3-8604-7B6A594440F3.htm).
