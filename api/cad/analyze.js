export const config = { api: { bodyParser: false } };

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ message:'POST만 지원합니다.' });
  const endpoint=process.env.CAD_ANALYZER_URL;
  if(!endpoint) return response.status(503).json({
    code:'CAD_ANALYZER_NOT_CONFIGURED',
    message:'DWG 분석 엔진 연결이 필요합니다. Autodesk APS 또는 ODA 분석 서비스 URL을 설정하세요.'
  });
  try {
    const chunks=[]; for await (const chunk of request) chunks.push(chunk);
    const headers={'content-type':'application/octet-stream','x-file-name':request.headers['x-file-name']||'drawing.dwg'};
    if(process.env.CAD_ANALYZER_TOKEN)headers.authorization=`Bearer ${process.env.CAD_ANALYZER_TOKEN}`;
    const upstream=await fetch(endpoint,{method:'POST',headers,body:Buffer.concat(chunks)});
    const body=await upstream.text();response.status(upstream.status).setHeader('content-type',upstream.headers.get('content-type')||'application/json').send(body);
  } catch(error) { response.status(502).json({ message:'CAD 분석 엔진 호출 실패', detail:error.message }); }
}
