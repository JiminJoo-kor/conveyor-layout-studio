const endpoint='http://127.0.0.1:4179/api/cad/convert';
let connectionCode='';
export function cadConversionTarget(){return connectionCode?{url:endpoint,headers:{'x-cad-token':connectionCode}}:{url:'/api/cad/convert',headers:{}};}
export async function connectCadBridge(code,{fetchImpl=fetch}={}){
  code=code.trim();if(!/^[a-f0-9]{48}$/.test(code))throw Error('PC 도우미에 표시된 연결 코드 48자리를 입력하세요.');
  const response=await fetchImpl(endpoint,{headers:{'x-cad-token':code},signal:AbortSignal.timeout(5000)}).catch(()=>{throw Error('PC 도우미를 실행하고 브라우저의 로컬 네트워크 접근을 허용하세요. 연결되지 않으면 로컬 시뮬레이터 또는 DXF를 사용하세요.');});
  const data=await response.json();if(!response.ok||!data.available)throw Error(data.message||'무료 변환기를 사용할 수 없습니다.');
  connectionCode=code;return data;
}
export function disconnectCadBridge(){connectionCode='';}
export function mountCadBridgeControl(container){
  const button=document.createElement('button');button.type='button';button.textContent='PC DWG 연결';container.append(button);
  const dialog=document.createElement('dialog');dialog.style.cssText='max-width:520px;width:90%;background:#102330;color:#d9f5ff;border:1px solid #24bbd5;border-radius:12px;padding:24px;';
  const title=document.createElement('h3');title.textContent='무료 DWG · 내 PC 변환기 연결';
  const info=document.createElement('p');info.textContent='도우미 ZIP을 풀고 Node.js가 설치된 PC에서 Start-CAD-Bridge.cmd를 실행하세요. 무료 LibreDWG가 없다면 scripts/install-libredwg.ps1을 먼저 실행하세요. 도우미 창의 연결 코드를 입력한 뒤 CAD 불러오기에서 DWG를 선택하세요.';
  const download=document.createElement('a');download.href='/downloads/cad-bridge.zip';download.download='cad-bridge.zip';download.textContent='PC 연결 도우미 다운로드';
  const input=document.createElement('input');input.type='password';input.autocomplete='off';input.placeholder='PC 도우미 연결 코드';input.setAttribute('aria-label','PC 도우미 연결 코드');input.style.cssText='display:block;width:100%;box-sizing:border-box;margin:16px 0;';
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent='코드는 이 탭에서만 사용하며 새로고침하면 다시 연결합니다. 도면은 외부 서버로 전송하지 않습니다.';
  const connect=document.createElement('button');connect.textContent='연결 확인';connect.onclick=async()=>{connect.disabled=true;status.textContent='PC 변환기 확인 중…';try{const data=await connectCadBridge(input.value);status.textContent=data.message;button.textContent='PC DWG 연결됨';input.value='';}catch(error){status.textContent=error.message;}finally{connect.disabled=false;}};
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();connect.click();}});
  const disconnect=document.createElement('button');disconnect.textContent='연결 해제';disconnect.onclick=()=>{disconnectCadBridge();button.textContent='PC DWG 연결';status.textContent='연결을 해제했습니다.';input.value='';};
  const close=document.createElement('button');close.textContent='닫기';close.onclick=()=>dialog.close();
  dialog.append(title,info,download,input,status,connect,disconnect,close);document.body.append(dialog);button.onclick=()=>dialog.showModal();
}
