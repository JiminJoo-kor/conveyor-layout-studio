import {cadConversionTarget} from './cad-bridge-client.js';
export async function prepareCadFile(file,{signal,useLocalBridge=false,fetchImpl=fetch,onProgress=()=>{}}={}){
  if(signal?.aborted)throw new DOMException('분석 취소','AbortError');
  if(/\.dxf$/i.test(file.name))return file;
  if(!/\.dwg$/i.test(file.name))throw Error('DWG 또는 ASCII DXF 파일을 선택하세요.');
  if(file.size>32*1024*1024)throw Error('DWG는 32MB 이하 파일을 사용하세요.');
  if(!useLocalBridge)return file;
  const target=cadConversionTarget();if(target.url!=='http://127.0.0.1:4179/api/cad/convert')throw Error('PC 변환기를 먼저 연결하세요.');
  onProgress({stage:'내 PC에서 DWG 변환 중 · 외부 전송 없음',done:null});
  const response=await fetchImpl(target.url,{method:'POST',headers:{...target.headers,'content-type':'application/octet-stream'},body:file,signal,redirect:'error'});
  if(!response.ok){let message='PC 변환에 실패했습니다.';try{message=(await response.json()).message||message;}catch{}throw Error(message);}
  const blob=await response.blob();if(blob.size>256*1024*1024)throw Error('변환 결과가 256MB를 넘습니다.');
  return new File([blob],file.name.replace(/\.dwg$/i,'.dxf'),{type:'application/dxf'});
}
export async function runCadImport(file,{signal,onProgress=()=>{},workerFactory=()=>new Worker(new URL('./browser-cad-worker.js',import.meta.url),{type:'module'}),timeoutMs=120000,...options}={}){
  file=await prepareCadFile(file,{signal,onProgress,useLocalBridge:options.useLocalBridge,fetchImpl:options.fetchImpl});
  if(file.size>256*1024*1024)return Promise.reject(Error('256MB를 넘는 도면은 분할해 불러오세요.'));
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new DOMException('분석 취소','AbortError'));return;}
    const worker=workerFactory();let settled=false;
    const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();signal?.removeEventListener('abort',cancel);fn(value);};
    const cancel=()=>finish(reject,new DOMException('분석 취소','AbortError'));
    const timer=setTimeout(()=>finish(reject,Error('도면 처리 제한시간(120초)을 초과했습니다. 도면을 분할해 주세요.')),timeoutMs);
    signal?.addEventListener('abort',cancel,{once:true});
    worker.onmessage=({data})=>{if(data.progress)onProgress(data.progress);else if(data.error)finish(reject,Object.assign(Error(data.error),{diagnostic:data.diagnostic}));else finish(resolve,data.result);};
    worker.onerror=event=>finish(reject,Error(event.message||'CAD 분석 작업을 시작하지 못했습니다.'));
    try{worker.postMessage({file,options});}catch(error){finish(reject,error);}
  });
}
const storageKey='cad-confirmed-patterns-v1';
export function loadCadPatterns(storage=localStorage){try{const list=JSON.parse(storage.getItem(storageKey)||'[]');return Array.isArray(list)?list.filter(p=>typeof p.key==='string'&&typeof p.type==='string').slice(-500):[];}catch{return [];}}
export function saveCadPatterns(list,storage=localStorage){storage.setItem(storageKey,JSON.stringify(list.slice(-500)));}
