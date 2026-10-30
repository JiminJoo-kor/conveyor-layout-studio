import {mkdtemp,writeFile,readFile,stat,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve,basename} from 'node:path';
import {spawn} from 'node:child_process';

export const DWG_LIMIT=32*1024*1024;
export function validateDwg(bytes){if(!bytes.length||bytes.length>DWG_LIMIT)throw Error('DWG는 32MB 이하 파일을 사용하세요.');if(!/^AC10\d{2}/.test(bytes.subarray(0,6).toString('ascii')))throw Error('지원하는 DWG 파일 서명이 아닙니다.');}
export async function findCoreConsole(){
  const candidates=[process.env.ACCORE_CONSOLE,'C:/Program Files/Autodesk/AutoCAD 2025/accoreconsole.exe','C:/Program Files/Autodesk/AutoCAD LT 2025/accoreconsole.exe'].filter(Boolean);
  for(const file of candidates)try{await access(file);return file;}catch{}
  throw Error('AutoCAD Core Console을 찾지 못했습니다. ACCORE_CONSOLE 경로와 AutoCAD 라이선스를 확인하세요.');
}
export function runCoreConsole(executable,args,{cwd,signal,timeout=120000}={}){
  return new Promise((resolveResult,reject)=>{
    if(signal?.aborted){reject(new Error('DWG 변환 취소'));return;}
    const child=spawn(executable,args,{cwd,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});let reason='',log=Buffer.alloc(0);
    const stop=message=>{reason=message;child.kill();},cancel=()=>stop('DWG 변환 취소'),timer=setTimeout(()=>stop('DWG 변환 제한시간 초과'),timeout);
    signal?.addEventListener('abort',cancel,{once:true});
    const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);};
    for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{log=Buffer.concat([log,b]).subarray(-65536);});
    child.on('error',()=>{cleanup();reject(Error('AutoCAD 변환 프로세스를 실행하지 못했습니다.'));});
    child.on('close',code=>{cleanup();if(reason)reject(Error(reason));else if(code!==0)reject(Error('AutoCAD 변환 실패: 설치·라이선스·사용자 프로필을 확인하세요.'));else resolveResult({code});});
  });
}
export async function convertDwg(bytes,{signal,executable,runner=runCoreConsole}={}){
  validateDwg(bytes);const core=executable||await findCoreConsole(),parent=resolve(tmpdir()),job=await mkdtemp(join(parent,'conveyor-dwg-'));
  try{
    const input=join(job,'input.dwg'),script=join(job,'convert.scr'),output=join(job,'output.dxf');
    await writeFile(input,bytes);
    // Constant script and fixed filenames: uploaded names/text never become commands.
    await writeFile(script,'_.FILEDIA\n0\n_.DXFOUT\noutput.dxf\n16\n_.QUIT\n_Y\n','ascii');
    await runner(core,['/i',input,'/s',script,'/readonly','/isolate','ConveyorDwgImport',join(job,'profile')],{cwd:job,signal});
    const info=await stat(output).catch(()=>null);if(!info?.isFile()||info.size>64*1024*1024)throw Error('DXF 생성 실패 또는 64MB 출력 한도 초과');
    const dxf=await readFile(output);if(dxf.subarray(0,32).toString().includes('AutoCAD Binary DXF')||!dxf.toString('utf8',0,4096).includes('SECTION'))throw Error('변환 결과가 ASCII DXF가 아닙니다.');
    return dxf;
  }finally{
    // Only the uniquely created job folder is eligible for cleanup.
    if(dirname(resolve(job))===parent&&basename(job).startsWith('conveyor-dwg-')){
      try{await rm(job,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
      catch(error){console.warn(`DWG 임시 폴더 정리 보류 (${error.code}): ${job}`);}
    }
  }
}
let busy=false;
export async function handleDwgConversion(req,res,{enabled=false,convert=convertDwg}={}){
  const fail=(status,message)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify({message}));};
  if(req.method!=='POST')return fail(405,'POST만 지원합니다.');
  if(!enabled)return fail(503,'DWG 자동 변환은 AutoCAD가 설치된 PC에서 npm run dev:dwg로 실행하세요. 웹 배포판에는 변환기가 연결되지 않았습니다.');
  const host=req.headers.host||'',origin=req.headers.origin;
  if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host)||origin!==`http://${host}`||req.headers['x-cad-convert']!=='1')return fail(403,'이 PC의 동일 출처 요청만 허용합니다.');
  if(busy)return fail(429,'다른 DWG를 변환 중입니다. 완료 후 다시 시도하세요.');
  busy=true;const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
  try{
    const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>DWG_LIMIT){fail(413,'DWG는 32MB 이하 파일을 사용하세요.');return;}chunks.push(chunk);}
    const output=await convert(Buffer.concat(chunks),{signal:controller.signal});if(controller.signal.aborted)return;
    res.writeHead(200,{'content-type':'application/dxf','cache-control':'no-store','x-cad-conversion-note':'External references and proxy objects require review'});res.end(output);
  }catch(error){if(!res.destroyed&&!res.headersSent)fail(422,error.message);}finally{busy=false;}
}
