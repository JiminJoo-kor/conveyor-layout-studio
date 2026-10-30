import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {convertDwg,validateDwg,handleDwgConversion} from '../scripts/dwg-converter.mjs';
import {prepareCadFile} from '../src/cad-import-client.js';
test('conversion uses a copy, fixed script and read-only native invocation',async()=>{
 const original=Buffer.from('AC1032-test-fixture');let directory;
 const result=await convertDwg(original,{backend:'autocad',executable:'test-only',runner:async(exe,args,{cwd})=>{directory=cwd;assert.ok(args.includes('/readonly'));assert.ok(args.includes('/isolate'));assert.deepEqual(await readFile(join(cwd,'input.dwg')),original);assert.match(await readFile(join(cwd,'convert.scr'),'utf8'),/DXFOUT\noutput.dxf/);await writeFile(join(cwd,'output.dxf'),'0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n');}});
 assert.match(result.toString(),/SECTION/);assert.equal(original.toString(),'AC1032-test-fixture');await assert.rejects(access(directory));
});
test('native failure cleans its isolated work directory',async()=>{
 let directory;await assert.rejects(convertDwg(Buffer.from('AC1032-fixture'),{executable:'test',runner:async(e,a,{cwd})=>{directory=cwd;throw Error('license failure');}}),/license failure/);await assert.rejects(access(directory));
});
test('invalid file and over-limit file rejected before native processing',()=>{
 assert.throws(()=>validateDwg(Buffer.from('not dwg')),/서명/);assert.throws(()=>validateDwg(Buffer.alloc(33*1024*1024)),/32MB/);
});
test('cross-origin and unconfigured conversion never call native runner',async()=>{
 for(const enabled of [false,true]){let status,called=false;const req={method:'POST',headers:{host:'localhost:4173',origin:'https://attacker.example','x-cad-convert':'1'}},res={writeHead(s){status=s;},end(){}};await handleDwgConversion(req,res,{enabled,convert:()=>{called=true;}});assert.equal(status,enabled?403:503);assert.equal(called,false);}
});
test('DXF never uploads; DWG is converted before worker analysis',async()=>{
 const dxf=new File(['0\nEOF\n'],'a.dxf');assert.equal(await prepareCadFile(dxf,{fetchImpl:()=>{throw Error('must not upload');}}),dxf);
 const stages=[],dwg=new File(['AC1032test'],'a.dwg'),result=await prepareCadFile(dwg,{onProgress:p=>stages.push(p.stage),fetchImpl:async(url,options)=>{assert.equal(url,'/api/cad/convert');if(!options.method)return Response.json({available:true});assert.equal(options.body,dwg);return new Response('0\nSECTION\n');}});assert.equal(result.name,'a.dxf');assert.equal(stages.length,3);
});
test('default free converter receives fixed file arguments and preserves source',async()=>{
 const bytes=Buffer.from('AC1032-fixture'),copy=Buffer.from(bytes);let directory;
 await convertDwg(bytes,{executable:'free-test',runner:async(exe,args,{cwd})=>{directory=cwd;assert.deepEqual(args,['-o',join(cwd,'output.dxf'),join(cwd,'input.dwg')]);assert.deepEqual(await readFile(args[2]),copy);await assert.rejects(access(join(cwd,'convert.scr')));await writeFile(args[1],'0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n');}});
 assert.deepEqual(bytes,copy);await assert.rejects(access(directory));
});
test('unavailable converter is reported before uploading drawing',async()=>{
 let calls=0;await assert.rejects(prepareCadFile(new File(['AC1032'],'drawing.dwg'),{fetchImpl:async(url,options)=>{calls++;assert.equal(options.body,undefined);return Response.json({available:false,message:'무료 변환기 미설치'});}}),/미설치/);assert.equal(calls,1);
});
test('missing web converter gives actionable message instead of false success',async()=>{
 await assert.rejects(prepareCadFile(new File(['AC1032'],'a.dwg'),{fetchImpl:async()=>new Response(JSON.stringify({message:'변환기 미연결'}),{status:503})}),/변환기 미연결/);
});
test('same-origin local upload reaches converter and returns DXF bytes',async()=>{
 let status,result;const bytes=Buffer.from('AC1032-fixture'),req={method:'POST',headers:{host:'127.0.0.1:4173',origin:'http://127.0.0.1:4173','x-cad-convert':'1'},async *[Symbol.asyncIterator](){yield bytes;}},res={on(){},writeHead(s){status=s;},end(b){result=b;}};
 await handleDwgConversion(req,res,{enabled:true,convert:async body=>{assert.deepEqual(body,bytes);return Buffer.from('0\nSECTION\n');}});assert.equal(status,200);assert.equal(result.toString(),'0\nSECTION\n');
});
