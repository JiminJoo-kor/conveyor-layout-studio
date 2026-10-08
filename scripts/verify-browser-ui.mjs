import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const [, , layoutPath, outputPath='docs/ui-progress/actual-loaded-project.png', port='9223']=process.argv;
if(!layoutPath)throw new Error('Usage: node scripts/verify-browser-ui.mjs <layout.json> [screenshot.png] [debug-port]');

const pages=await fetch(`http://127.0.0.1:${port}/json`).then(response=>response.json());
const page=pages.find(entry=>entry.type==='page'&&entry.url.startsWith('http://127.0.0.1:4173/'));
if(!page)throw new Error('Conveyor Layout Studio browser page was not found.');

const socket=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let sequence=0;
const pending=new Map();
socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(!message.id)return;const request=pending.get(message.id);if(!request)return;pending.delete(message.id);message.error?request.reject(new Error(message.error.message)):request.resolve(message.result);});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{
 const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
 if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Browser evaluation failed.');
 return result.result.value;
};
const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

const layoutText=await readFile(path.resolve(layoutPath),'utf8');
await evaluate(`(async()=>{const input=document.querySelector('#layoutFile'),transfer=new DataTransfer(),file=new File([${JSON.stringify(layoutText)}],'browser-verification.json',{type:'application/json'});transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
await wait(1500);
await evaluate(`(()=>{const card=[...document.querySelectorAll('[data-parameter-card]')].find(node=>node.closest('.equipment-type-group')?.querySelector('h3')?.textContent.includes('CONVEYOR'))||document.querySelector('[data-parameter-card]');card?.querySelector(':scope > summary')?.click();return card?.dataset.parameterCard||null;})()`);
await wait(500);

const report=await evaluate(`(()=>{const controls=document.querySelector('.controls'),card=document.querySelector('.equipment-parameter-card.selected')||document.querySelector('[data-parameter-card]'),sections=[...card?.querySelectorAll('[data-inspector-section]')||[]],fields=[...card?.querySelectorAll('[data-parameter-kind]')||[]];return{viewport:{width:innerWidth,height:innerHeight},inspectorWidth:controls?Math.round(controls.getBoundingClientRect().width):0,selectedEquipment:card?.dataset.parameterCard||null,sectionOrder:sections.map(node=>node.dataset.inspectorSection),sectionState:Object.fromEntries(sections.filter(node=>node.tagName==='DETAILS').map(node=>[node.dataset.inspectorSection,node.open])),fieldKinds:Object.fromEntries(['INPUT','AUTO','RESULT','STATUS'].map(kind=>[kind,fields.filter(field=>field.dataset.parameterKind===kind).length])),editableAutoResult:fields.filter(field=>['AUTO','RESULT'].includes(field.dataset.parameterKind)&&!field.readOnly).map(field=>field.dataset.parameter),readonlyInput:fields.filter(field=>field.dataset.parameterKind==='INPUT'&&field.readOnly).map(field=>field.dataset.parameter),canvasVisible:Boolean(document.querySelector('#layoutCanvas')?.getBoundingClientRect().width),errors:document.querySelector('#validation')?.textContent?.trim()||''};})()`);
const accordion=await evaluate(`(()=>{const basic=document.querySelector('[data-inspector-section="basic"]');if(!basic)return{found:false};const before=basic.open;basic.querySelector(':scope > summary')?.click();const closed=!basic.open;basic.querySelector(':scope > summary')?.click();return{found:true,before,closed,reopened:basic.open};})()`);
const responsive=[];
for(const width of [1280,900]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:false});
 await wait(200);
 responsive.push(await evaluate(`(()=>{const workspace=getComputedStyle(document.querySelector('.workspace')),controls=document.querySelector('.controls');return{width:innerWidth,gridAreas:workspace.gridTemplateAreas,inspectorWidth:Math.round(controls.getBoundingClientRect().width),inspectorTop:Math.round(controls.getBoundingClientRect().top)};})()`));
}
await send('Emulation.clearDeviceMetricsOverride');
await wait(200);

const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
await writeFile(path.resolve(outputPath),Buffer.from(screenshot.data,'base64'));
socket.close();
console.log(JSON.stringify({...report,accordion,responsive,screenshot:path.resolve(outputPath)},null,2));
if(!report.selectedEquipment||report.inspectorWidth<400||report.editableAutoResult.length||!report.sectionOrder.includes('auto-engineering')||!accordion.closed||!accordion.reopened||responsive.some(result=>result.inspectorWidth<400))process.exitCode=1;
