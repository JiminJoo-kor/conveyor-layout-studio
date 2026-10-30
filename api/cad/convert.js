export default function handler(request,response){
  response.status(503).json({message:'이 웹 배포에는 DWG 변환기가 연결되지 않았습니다. AutoCAD가 설치된 PC에서 npm run dev:dwg로 로컬 실행하거나 DXF로 저장해 불러오세요. 도면은 외부 변환 서비스로 전달하지 않았습니다.'});
}
