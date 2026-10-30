import test from 'node:test';
import assert from 'node:assert/strict';
import {createBridgeHandler,WEB_ORIGIN} from '../scripts/cad-bridge.mjs';
import {connectCadBridge,disconnectCadBridge,cadConversionTarget} from '../src/cad-bridge-client.js';
import {prepareCadFile} from '../src/cad-import-client.js';
const code='a'.repeat(48);
test('automatic pairing rejects foreign origin, missing header and expired startup window',async()=>{
 const handler=createBridgeHandler(code);
 for(const headers of [{origin:'https://other.example','x-cad-pair':'1'},{'x-cad-pair':undefined}]){const q=request(headers);q.url='/api/cad/pair';const r=response();await handler(q,r);assert.equal(r.status,403);}
 const q=request({'x-cad-pair':'1'});q.url='/api/cad/pair';let r=response();await handler(q,r);assert.equal(JSON.parse(r.body).token,code);
 r=response();await createBridgeHandler(code,{pairUntil:0})(q,r);assert.equal(r.status,403);
});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(s,h){this.status=s;Object.assign(this.headers,h);},end(b){this.body=b;},on(){}};}
function request(headers={},method='POST'){return {url:'/api/cad/convert',method,headers:{host:'127.0.0.1:4179',origin:WEB_ORIGIN,'x-cad-token':code,...headers},async *[Symbol.asyncIterator](){yield Buffer.from('AC1032-fixture');}};}
test('bridge blocks foreign origin, DNS rebinding and wrong token before reading a drawing',async()=>{
 let called=0;const handler=createBridgeHandler(code,{convert:()=>{called++;}});
 for(const headers of [{origin:'https://other.example'},{host:'attacker.example:4179'},{'x-cad-token':'wrong'},{'x-cad-token':''},{origin:undefined}]){const r=response();await handler(request(headers),r);assert.ok([401,403].includes(r.status));}assert.equal(called,0);
});
test('preflight allows only production origin and supported headers',async()=>{
 const handler=createBridgeHandler(code);let r=response();await handler(request({'access-control-request-method':'POST','access-control-request-headers':'x-cad-token,content-type'},'OPTIONS'),r);assert.equal(r.status,204);assert.equal(r.headers['Access-Control-Allow-Origin'],WEB_ORIGIN);assert.equal(r.headers['Access-Control-Allow-Private-Network'],'true');
 r=response();await handler(request({'access-control-request-method':'POST','access-control-request-headers':'authorization'},'OPTIONS'),r);assert.equal(r.status,403);
});
test('paired bridge converts only uploaded bytes and keeps CORS on response',async()=>{
 const handler=createBridgeHandler(code,{convert:async b=>{assert.equal(b.toString(),'AC1032-fixture');return Buffer.from('0\nSECTION\n');}}),r=response();await handler(request(),r);assert.equal(r.status,200);assert.equal(r.body.toString(),'0\nSECTION\n');assert.equal(r.headers['Access-Control-Allow-Origin'],WEB_ORIGIN);
});
test('client connects in memory, sends drawing only to loopback, and disconnects',async()=>{
 disconnectCadBridge();assert.equal(cadConversionTarget().url,'/api/cad/convert');
 await connectCadBridge(code,{fetchImpl:async(url,options)=>{assert.equal(url,'http://127.0.0.1:4179/api/cad/convert');assert.equal(options.headers['x-cad-token'],code);return Response.json({available:true});}});
 try{let posts=0;await prepareCadFile(new File(['AC1032-fixture'],'a.dwg'),{fetchImpl:async(url,options)=>{assert.equal(url,'http://127.0.0.1:4179/api/cad/convert');assert.equal(options.headers['x-cad-token'],code);if(!options.method)return Response.json({available:true});posts++;return new Response('0\nSECTION\n');}});assert.equal(posts,1);}finally{disconnectCadBridge();}assert.equal(cadConversionTarget().url,'/api/cad/convert');
});
test('invalid pairing cannot enable connection',async()=>{
 disconnectCadBridge();await assert.rejects(connectCadBridge('bad'),/48/);await assert.rejects(connectCadBridge(code,{fetchImpl:async()=>Response.json({message:'wrong code'},{status:401})}),/wrong code/);assert.equal(cadConversionTarget().url,'/api/cad/convert');
});
