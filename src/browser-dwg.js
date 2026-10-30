// SPDX-License-Identifier: GPL-3.0-only
export async function convertBrowserDwg(file,{onProgress=()=>{},wasmUrl=new URL('../vendor/cadview-dwg/libredwg.wasm',import.meta.url).href}={}){
  if(file.size>32*1024*1024)throw Error('DWG는 32MB 이하 파일을 사용하세요.');
  const header=await file.slice(0,6).text();if(!/^AC10\d{2}$/.test(header))throw Error('DWG 파일 형식이 아닙니다.');
  onProgress({stage:'브라우저용 무료 변환기 준비 · 도면 전송 없음',done:null});
  const {initWasm,convertDwgToDxf}=await import('../vendor/cadview-dwg/index.js');
  await initWasm({wasmUrl});
  onProgress({stage:'DWG → DXF 브라우저 변환 중',done:null});
  const dxf=await convertDwgToDxf(await file.arrayBuffer(),{wasmUrl,timeout:0});
  if(dxf.length>64*1024*1024)throw Error('변환 결과가 64MB를 넘습니다. 도면을 분할해 주세요.');
  if(!dxf.includes('SECTION')||!dxf.includes('EOF'))throw Error('변환 결과가 유효한 DXF가 아닙니다.');
  onProgress({stage:'브라우저 변환 완료 · 특수 객체와 외부 참조 확인 필요',done:1,total:1});
  return dxf;
}
