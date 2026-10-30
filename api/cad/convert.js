export default function handler(request,response){
  response.status(503).json({available:false,message:'PC DWG 연결 버튼에서 무료 변환 도우미를 연결한 뒤 DWG를 선택하세요. 또는 DXF를 불러오세요. 도면은 외부 변환 서비스로 전달하지 않았습니다.'});
}
