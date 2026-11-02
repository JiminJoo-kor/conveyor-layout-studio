const endpoint='http://127.0.0.1:4179/api/cad/convert';
let connectionCode='';
export async function autoConnectCadBridge({fetchImpl=fetch}={}){
  const response=await fetchImpl('http://127.0.0.1:4179/api/cad/pair',{method:'POST',headers:{'x-cad-pair':'1'},signal:AbortSignal.timeout(4000)});
  const data=await response.json();if(!response.ok)throw Error(data.message||'PC 도우미 연결 실패');
  return connectCadBridge(data.token,{fetchImpl});
}
export function cadConversionTarget(){return connectionCode?{url:endpoint,headers:{'x-cad-token':connectionCode}}:{url:null,headers:{}};}
export async function connectCadBridge(code,{fetchImpl=fetch}={}){
  code=code.trim();if(!/^[a-f0-9]{48}$/.test(code))throw Error('PC 도우미에 표시된 연결 코드 48자리를 입력하세요.');
  const response=await fetchImpl(endpoint,{headers:{'x-cad-token':code},signal:AbortSignal.timeout(5000)}).catch(()=>{throw Error('PC 도우미를 실행하고 브라우저의 로컬 네트워크 접근을 허용하세요. 연결되지 않으면 로컬 시뮬레이터 또는 DXF를 사용하세요.');});
  const data=await response.json();if(!response.ok||!data.available)throw Error(data.message||'무료 변환기를 사용할 수 없습니다.');
  connectionCode=code;return data;
}
export function isCadBridgeConnected(){return Boolean(connectionCode);}
export function disconnectCadBridge(){connectionCode='';}
export function mountCadBridgeControl(container,{onDisconnect=()=>{}}={}){
  let pending=null;
  const button=document.createElement('button');button.type='button';button.textContent='PC DWG 연결';container.append(button);
  const dialog=document.createElement('dialog');dialog.style.cssText='max-width:520px;width:90%;background:#102330;color:#d9f5ff;border:1px solid #24bbd5;border-radius:12px;padding:20px;font:13px/1.6 sans-serif;';
  const title=document.createElement('h3');title.textContent='DWG 자동 설치 · 연결';
  const info=document.createElement('p');info.textContent='① 자동 설치 파일을 받으세요. ② 다운로드한 Install-CAD-Helper.cmd를 한 번 실행하세요. 압축 해제와 무료 변환기·실행 환경 설치는 자동으로 진행됩니다. 이 창을 열어두면 연결 후 선택한 도면 분석을 이어갑니다. 최초 실행과 브라우저의 로컬 네트워크 허용은 사용자가 진행해야 합니다.';
  const download=document.createElement('a');download.href='/downloads/Install-CAD-Helper.cmd';download.download='Install-CAD-Helper.cmd';download.textContent='무료 도우미 자동 설치 파일 받기';download.style.cssText='display:block;padding:12px 16px;border-radius:6px;background:#03bddb;color:#03202c;text-align:center;font:600 14px sans-serif;text-decoration:none';
  download.addEventListener('click',()=>{status.textContent='다운로드한 파일을 실행해 주세요. 설치와 연결을 기다리고 있습니다…';startPolling();});
  const input=document.createElement('input');input.type='password';input.autocomplete='off';input.placeholder='PC 도우미 연결 코드';input.setAttribute('aria-label','PC 도우미 연결 코드');input.style.cssText='display:block;width:100%;box-sizing:border-box;margin:16px 0;';
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent='도면은 이 PC에서 처리합니다. 긴 연결 코드를 입력할 필요가 없습니다.';
  const automatic=document.createElement('button');automatic.textContent='설치 완료 · 연결 다시 확인';
  automatic.onclick=async()=>{automatic.disabled=true;status.textContent='이 PC의 도우미를 확인하고 있습니다…';try{const data=await autoConnectCadBridge();status.textContent=data.message;button.textContent='PC DWG 연결됨';if(pending){const done=pending;pending=null;done.resolve();dialog.close();}}catch(error){status.textContent='설치 파일 실행 후 자동으로 연결됩니다. '+(error.name==='TypeError'?'브라우저의 로컬 네트워크 접근 허용도 확인하세요.':error.message);}finally{automatic.disabled=false;}};
  const connect=document.createElement('button');connect.textContent='연결 확인';connect.onclick=async()=>{connect.disabled=true;status.textContent='PC 변환기 확인 중…';try{const data=await connectCadBridge(input.value);status.textContent=data.message;button.textContent='PC DWG 연결됨';input.value='';if(pending){const done=pending;pending=null;done.resolve();dialog.close();}}catch(error){status.textContent=error.message;}finally{connect.disabled=false;}};
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();connect.click();}});
  const disconnect=document.createElement('button');disconnect.textContent='연결 해제';disconnect.onclick=()=>{disconnectCadBridge();onDisconnect();button.textContent='PC DWG 연결';status.textContent='연결을 해제했습니다.';input.value='';};
  const close=document.createElement('button');close.textContent='닫기';close.onclick=()=>dialog.close();
  const advanced=document.createElement('details'),summary=document.createElement('summary');summary.textContent='이전 도우미 수동 연결';advanced.append(summary,input,connect);
  dialog.append(title,info,download,status,automatic,disconnect,close,advanced);document.body.append(dialog);button.onclick=()=>{dialog.showModal();automatic.click();};
  let polling=null;dialog.addEventListener('close',()=>{clearInterval(polling);polling=null;});
  const startPolling=()=>{if(!polling)polling=setInterval(()=>{if(dialog.open&&!automatic.disabled&&!connectionCode)automatic.click();},3000);};button.addEventListener('click',startPolling);
  dialog.addEventListener('close',()=>{if(pending){const done=pending;pending=null;done.reject(new DOMException('DWG 연결 취소 · 파일을 다시 선택해 주세요.','AbortError'));}});
  if(new URLSearchParams(location.search).get('cad-helper')==='1'){dialog.showModal();automatic.click();startPolling();}
  return {requestConnection(fileName,signal){return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new DOMException('분석 취소','AbortError'));return;}
    const cancel=()=>dialog.close(),finish=fn=>value=>{signal?.removeEventListener('abort',cancel);fn(value);};
    pending={resolve:finish(resolve),reject:finish(reject)};signal?.addEventListener('abort',cancel,{once:true});
    status.textContent=fileName+' · PC 변환기를 연결하면 이 파일의 분석을 자동으로 이어갑니다.';
    if(!dialog.open)dialog.showModal();
    automatic.click();startPolling();
  });}};
}
