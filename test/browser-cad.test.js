import test from 'node:test';
import assert from 'node:assert/strict';
import {runCadImport} from '../src/cad-import-client.js';
import {convertBrowserDwg} from '../src/browser-dwg.js';
test('browser import passes local file to worker and releases worker on success',async()=>{
 let terminated=0;const file=new File(['AC1032'],'a.dwg');const worker={terminate(){terminated++;},postMessage(data){assert.equal(data.file,file);queueMicrotask(()=>this.onmessage({data:{result:{candidates:[]}}}));}};
 assert.deepEqual(await runCadImport(file,{workerFactory:()=>worker}),{candidates:[]});assert.equal(terminated,1);
});
test('cancellation terminates conversion worker even while conversion is busy',async()=>{
 const controller=new AbortController();let terminated=0;const worker={terminate(){terminated++;},postMessage(){controller.abort();}};
 await assert.rejects(runCadImport(new File(['AC1032'],'a.dwg'),{signal:controller.signal,workerFactory:()=>worker}),{name:'AbortError'});assert.equal(terminated,1);
});
test('timeout terminates worker and errors do not report success',async()=>{
 let terminated=0;await assert.rejects(runCadImport(new File(['AC1032'],'a.dwg'),{workerFactory:()=>({terminate(){terminated++;},postMessage(){}}),timeoutMs:5}),/제한시간/);assert.equal(terminated,1);
});
test('invalid DWG signature is rejected before loading WASM',async()=>{
 await assert.rejects(convertBrowserDwg(new File(['not a drawing'],'bad.dwg')),/형식/);
});
