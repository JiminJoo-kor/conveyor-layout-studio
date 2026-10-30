import {cadConversionTarget} from './cad-bridge-client.js';
export async function prepareCadFile(file,{signal,onProgress=()=>{},fetchImpl=fetch}={}){
  if(signal?.aborted)throw new DOMException('분석 취소','AbortError');
  if(/\.dxf$/i.test(file.name))return file;
  if(!/\.dwg$/i.test(file.name))throw Error('DWG 또는 ASCII DXF 파일을 선택하세요.');
  if(file.size>32*1024*1024)throw Error('DWG는 32MB 이하 파일을 사용하세요.');
  onProgress({stage:'무료 DWG 변환기 설치 상태 확인',done:null});
  const target=cadConversionTarget();
  const statusResponse=await fetchImpl(target.url,{signal,headers:target.headers}).catch(error=>{if(signal?.aborted)throw error;throw Object.assign(Error('무료 변환기에 연결하지 못했습니다. PC DWG 연결에서 도우미 실행 상태를 확인하세요.'),{code:'CAD_CONNECTION_REQUIRED'});});
  const status=await statusResponse.json().catch(()=>({available:false,message:'변환기 상태를 확인하지 못했습니다.'}));
  if(!statusResponse.ok||!status.available)throw Object.assign(Error(status.message||'로컬 무료 DWG 변환기를 연결하세요.'),{code:'CAD_CONNECTION_REQUIRED'});
  onProgress({stage:'LibreDWG → DXF 변환 중 · 원본 보존',done:null});
  const response=await fetchImpl(target.url,{method:'POST',headers:{...target.headers,'content-type':'application/octet-stream','x-cad-convert':'1'},body:file,signal});
  if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.message||'DWG 자동 변환을 사용할 수 없습니다. 로컬 DWG 변환 모드로 실행하거나 DXF를 사용하세요.');}
  const blob=await response.blob();onProgress({stage:'DWG 변환 완료 · 외부 참조/프록시 객체는 확인 필요',done:1,total:1});
  return new File([blob],file.name.replace(/\.dwg$/i,'.dxf'),{type:'application/dxf'});
}
export async function runCadImport(file,{signal,onProgress=()=>{},...options}={}){
  file=await prepareCadFile(file,{signal,onProgress});
  if(file.size>100*1024*1024)return Promise.reject(Error('100MB를 넘는 도면은 분할해 불러오세요.'));
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new DOMException('분석 취소','AbortError'));return;}
    const worker=new Worker(new URL('./cad-import-worker.js',import.meta.url),{type:'module'});
    const finish=(fn,value)=>{worker.terminate();signal?.removeEventListener('abort',cancel);fn(value);};
    const cancel=()=>finish(reject,new DOMException('분석 취소','AbortError'));
    signal?.addEventListener('abort',cancel,{once:true});
    worker.onmessage=({data})=>{if(data.progress)onProgress(data.progress);else if(data.error)finish(reject,Error(data.error));else finish(resolve,data.result);};
    worker.onerror=event=>finish(reject,Error(event.message||'CAD 분석 작업을 시작하지 못했습니다.'));
    worker.postMessage({file,options});
  });
}
const storageKey='cad-confirmed-patterns-v1';
export function loadCadPatterns(storage=localStorage){try{const list=JSON.parse(storage.getItem(storageKey)||'[]');return Array.isArray(list)?list.filter(p=>typeof p.key==='string'&&typeof p.type==='string').slice(-500):[];}catch{return [];}}
export function saveCadPatterns(list,storage=localStorage){storage.setItem(storageKey,JSON.stringify(list.slice(-500)));}
