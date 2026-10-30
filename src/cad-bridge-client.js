const endpoint='http://127.0.0.1:4179/api/cad/convert';
let connectionCode='';
export async function autoConnectCadBridge({fetchImpl=fetch}={}){
  const response=await fetchImpl('http://127.0.0.1:4179/api/cad/pair',{method:'POST',headers:{'x-cad-pair':'1'},signal:AbortSignal.timeout(4000)});
  const data=await response.json();if(!response.ok)throw Error(data.message||'PC 도우미 연결 실패');
  return connectCadBridge(data.token,{fetchImpl});
}
export function cadConversionTarget(){return connectionCode?{url:endpoint,headers:{'x-cad-token':connectionCode}}:{url:'/api/cad/convert',headers:{}};}
export async function connectCadBridge(code,{fetchImpl=fetch}={}){
  code=code.trim();if(!/^[a-f0-9]{48}$/.test(code))throw Error('PC 도우미에 표시된 연결 코드 48자리를 입력하세요.');
  const response=await fetchImpl(endpoint,{headers:{'x-cad-token':code},signal:AbortSignal.timeout(5000)}).catch(()=>{throw Error('PC 도우미를 실행하고 브라우저의 로컬 네트워크 접근을 허용하세요. 연결되지 않으면 로컬 시뮬레이터 또는 DXF를 사용하세요.');});
  const data=await response.json();if(!response.ok||!data.available)throw Error(data.message||'무료 변환기를 사용할 수 없습니다.');
  connectionCode=code;return data;
}
export function disconnectCadBridge(){connectionCode='';}
export function mountCadBridgeControl(container){
  let pending=null;
  const button=document.createElement('button');button.type='button';button.textContent='PC DWG 연결';container.append(button);
  const dialog=document.createElement('dialog');dialog.style.cssText='max-width:520px;width:90%;background:#102330;color:#d9f5ff;border:1px solid #24bbd5;border-radius:12px;padding:24px;';
  const title=document.createElement('h3');title.textContent='무료 DWG · 내 PC 변환기 연결';
  const info=document.createElement('p');info.textContent='처음 한 번만 도우미를 내려받아 압축을 풀고 Start-CAD-Bridge.cmd를 실행하세요. 필요한 무료 구성요소를 자동으로 준비합니다. 실행 후 아래 자동 연결을 누르면 선택한 도면으로 이어집니다. 브라우저가 로컬 네트워크 접근을 물으면 허용해 주세요.';
  const download=document.createElement('a');download.href='/downloads/cad-bridge.zip';download.download='cad-bridge.zip';download.textContent='PC 연결 도우미 다운로드';download.style.color='#46dfff';
  const input=document.createElement('input');input.type='password';input.autocomplete='off';input.placeholder='PC 도우미 연결 코드';input.setAttribute('aria-label','PC 도우미 연결 코드');input.style.cssText='display:block;width:100%;box-sizing:border-box;margin:16px 0;';
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent='도면은 이 PC에서 처리합니다. 긴 연결 코드를 입력할 필요가 없습니다.';
  const automatic=document.createElement('button');automatic.textContent='자동 연결';
  automatic.onclick=async()=>{automatic.disabled=true;status.textContent='이 PC의 도우미를 확인하고 있습니다…';try{const data=await autoConnectCadBridge();status.textContent=data.message;button.textContent='PC DWG 연결됨';if(pending){const done=pending;pending=null;done.resolve();dialog.close();}}catch(error){status.textContent='도우미를 실행한 뒤 다시 눌러주세요. '+(error.name==='TypeError'?'브라우저의 로컬 네트워크 접근 허용도 확인하세요.':error.message);}finally{automatic.disabled=false;}};
  const connect=document.createElement('button');connect.textContent='연결 확인';connect.onclick=async()=>{connect.disabled=true;status.textContent='PC 변환기 확인 중…';try{const data=await connectCadBridge(input.value);status.textContent=data.message;button.textContent='PC DWG 연결됨';input.value='';if(pending){const done=pending;pending=null;done.resolve();dialog.close();}}catch(error){status.textContent=error.message;}finally{connect.disabled=false;}};
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();connect.click();}});
  const disconnect=document.createElement('button');disconnect.textContent='연결 해제';disconnect.onclick=()=>{disconnectCadBridge();button.textContent='PC DWG 연결';status.textContent='연결을 해제했습니다.';input.value='';};
  const close=document.createElement('button');close.textContent='닫기';close.onclick=()=>dialog.close();
  const advanced=document.createElement('details'),summary=document.createElement('summary');summary.textContent='이전 도우미 수동 연결';advanced.append(summary,input,connect);
  dialog.append(title,info,download,status,automatic,disconnect,close,advanced);document.body.append(dialog);button.onclick=()=>{dialog.showModal();automatic.click();};
  dialog.addEventListener('close',()=>{if(pending){const done=pending;pending=null;done.reject(new DOMException('DWG 연결 취소 · 파일을 다시 선택해 주세요.','AbortError'));}});
  return {requestConnection(fileName,signal){return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new DOMException('분석 취소','AbortError'));return;}
    const cancel=()=>dialog.close(),finish=fn=>value=>{signal?.removeEventListener('abort',cancel);fn(value);};
    pending={resolve:finish(resolve),reject:finish(reject)};signal?.addEventListener('abort',cancel,{once:true});
    status.textContent=fileName+' · PC 변환기를 연결하면 이 파일의 분석을 자동으로 이어갑니다.';
    if(!dialog.open)dialog.showModal();
    automatic.click();
  });}};
}
