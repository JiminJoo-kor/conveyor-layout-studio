import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {handleDwgConversion} from './dwg-converter.mjs';

export const WEB_ORIGIN='https://conveyor-layout-studio.vercel.app';
export function createBridgeHandler(token,{convert,port=4179}={}){
  return async(req,res)=>{
    const fail=(status,message)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify({message}));};
    if(req.headers.host!==`127.0.0.1:${port}`||req.headers.origin!==WEB_ORIGIN)return fail(403,'허용되지 않은 사이트입니다.');
    res.setHeader('Access-Control-Allow-Origin',WEB_ORIGIN);res.setHeader('Vary','Origin');res.setHeader('Cache-Control','no-store');
    if(req.url!=='/api/cad/convert')return fail(404,'지원하지 않는 경로입니다.');
    if(req.method==='OPTIONS'){
      const headers=(req.headers['access-control-request-headers']||'').toLowerCase().split(',').map(h=>h.trim()).filter(Boolean);
      if(!['GET','POST'].includes(req.headers['access-control-request-method'])||headers.some(h=>!['content-type','x-cad-convert','x-cad-token'].includes(h)))return fail(403,'지원하지 않는 요청입니다.');
      res.setHeader('Access-Control-Allow-Methods','GET, POST');res.setHeader('Access-Control-Allow-Headers','content-type, x-cad-convert, x-cad-token');
      res.setHeader('Access-Control-Allow-Private-Network','true');res.writeHead(204);res.end();return;
    }
    const supplied=Buffer.from(req.headers['x-cad-token']||''),expected=Buffer.from(token);
    if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return fail(401,'연결 코드가 다릅니다. PC 연결 도우미의 코드를 다시 입력하세요.');
    if(!['GET','POST'].includes(req.method))return fail(405,'지원하지 않는 요청입니다.');
    try{await handleDwgConversion(req,res,{enabled:true,trustedBridge:true,...(convert?{convert}:{})});}catch{if(!res.headersSent)fail(500,'변환 도우미 오류');else res.end();}
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const token=randomBytes(24).toString('hex');
  const server=createServer(createBridgeHandler(token));
  server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'CAD helper is already running on port 4179. Close it before restarting.':e.message);process.exitCode=1;});
  server.listen(4179,'127.0.0.1',()=>{
    console.log(`Free CAD helper ready. Keep this window open.\nOpen ${WEB_ORIGIN}\nClick PC DWG connection and paste this code:\n\n${token}\n\nClose this window to disconnect. Drawings stay on this PC.`);
  });
}
