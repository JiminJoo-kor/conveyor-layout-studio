import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const [, , layoutPath, outputPath='docs/ui-progress/actual-loaded-project.png', port='9223', targetType='conveyor', runMilliseconds='0', viewMode='2d', appUrl='http://127.0.0.1:4173/']=process.argv;
if(!layoutPath)throw new Error('Usage: node scripts/verify-browser-ui.mjs <layout.json> [screenshot.png] [debug-port]');

const pages=await fetch(`http://127.0.0.1:${port}/json`).then(response=>response.json());
const page=pages.find(entry=>entry.type==='page'&&entry.url.startsWith(appUrl));
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

await send('Page.reload',{ignoreCache:true});
await wait(1000);
const layoutText=await readFile(path.resolve(layoutPath),'utf8');
await evaluate(`(async()=>{const input=document.querySelector('#layoutFile'),transfer=new DataTransfer(),file=new File([${JSON.stringify(layoutText)}],'browser-verification.json',{type:'application/json'});transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
await wait(1500);
await evaluate(`(()=>{const requested=${JSON.stringify(targetType.toUpperCase())},card=[...document.querySelectorAll('[data-parameter-card]')].find(node=>node.closest('.equipment-type-group')?.querySelector('h3')?.textContent.toUpperCase().includes(requested))||document.querySelector('[data-parameter-card]');card?.querySelector(':scope > summary')?.click();document.querySelector('#revealEquipment')?.click();return card?.dataset.parameterCard||null;})()`);
await wait(500);
if(Number(runMilliseconds)>0){await evaluate(`document.querySelector('#runBtn')?.click()`);await wait(Number(runMilliseconds));await evaluate(`document.querySelector('#runBtn')?.click()`);await wait(250);}
if(viewMode==='3d'){await evaluate(`document.querySelector('#view3d')?.click()`);await wait(500);}
if(viewMode==='split'){await evaluate(`document.querySelector('#viewSplit')?.click()`);await wait(500);}

const report=await evaluate(`(()=>{const controls=document.querySelector('.controls'),card=document.querySelector('.equipment-parameter-card.selected')||document.querySelector('[data-parameter-card]'),sections=[...card?.querySelectorAll('[data-inspector-section]')||[]],fields=[...card?.querySelectorAll('[data-parameter-kind]')||[]],analysis=document.querySelector('#reportContent')?.textContent||'';return{viewport:{width:innerWidth,height:innerHeight},inspectorWidth:controls?Math.round(controls.getBoundingClientRect().width):0,selectedEquipment:card?.dataset.parameterCard||null,runState:document.querySelector('.operations .actions')?.dataset.runState||'',simulationTime:document.querySelector('#elapsed')?.textContent||document.querySelector('#runStateDetail')?.textContent||'',sectionOrder:sections.map(node=>node.dataset.inspectorSection),sectionState:Object.fromEntries(sections.filter(node=>node.tagName==='DETAILS').map(node=>[node.dataset.inspectorSection,node.open])),fieldKinds:Object.fromEntries(['INPUT','AUTO','RESULT','STATUS'].map(kind=>[kind,fields.filter(field=>field.dataset.parameterKind===kind).length])),editableAutoResult:fields.filter(field=>['AUTO','RESULT'].includes(field.dataset.parameterKind)&&!field.readOnly).map(field=>field.dataset.parameter),readonlyInput:fields.filter(field=>field.dataset.parameterKind==='INPUT'&&field.readOnly).map(field=>field.dataset.parameter),views:{live3dEnabled:!document.querySelector('#view3d')?.disabled,splitEnabled:!document.querySelector('#viewSplit')?.disabled},finalReportButton:Boolean(document.querySelector('#exportFinalReport')),decisionSupport:{gearbox:analysis.includes('감속기'),energy:analysis.includes('예상 전력량'),bottleneck:analysis.includes('병목 원인'),whatIf:analysis.includes('What-if')},canvasVisible:Boolean(document.querySelector('#layoutCanvas')?.getBoundingClientRect().width),errors:document.querySelector('#validation')?.textContent?.trim()||''};})()`);
const kpiReport=await evaluate(`(()=>{const strip=document.querySelector('.measured-kpi-strip'),values=[...strip?.querySelectorAll('strong')||[]].map(node=>node.textContent.trim());return{top:{throughput:document.querySelector('#throughput')?.textContent.trim(),cycle:document.querySelector('#robotUtil')?.textContent.trim(),wip:document.querySelector('#wip')?.textContent.trim(),forecast:document.querySelector('#forecast12h')?.textContent.trim(),utilization:document.querySelector('#equipmentUtilization')?.textContent.trim()},measuredStrip:values,consistent:Boolean(strip&&values[0]===document.querySelector('#throughput')?.textContent.trim()&&values[1]===document.querySelector('#robotUtil')?.textContent.trim()&&values[2]===document.querySelector('#wip')?.textContent.trim()+' EA'&&values[3]===document.querySelector('#forecast12h')?.textContent.trim())};})()`);
const accordion=await evaluate(`(()=>{const basic=document.querySelector('[data-inspector-section="basic"]');if(!basic)return{found:false};const before=basic.open;basic.querySelector(':scope > summary')?.click();const toggled=basic.open!==before;basic.querySelector(':scope > summary')?.click();return{found:true,before,toggled,restored:basic.open===before};})()`);
const responsive=[];
for(const width of [1280,900]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:false});
 await wait(200);
 responsive.push(await evaluate(`(()=>{const workspace=getComputedStyle(document.querySelector('.workspace')),controls=document.querySelector('.controls');return{width:innerWidth,gridAreas:workspace.gridTemplateAreas,inspectorWidth:Math.round(controls.getBoundingClientRect().width),inspectorTop:Math.round(controls.getBoundingClientRect().top)};})()`));
}
await send('Emulation.clearDeviceMetricsOverride');
await wait(200);
if(viewMode==='3d'){await evaluate(`document.querySelector('#rackMonitor')?.scrollIntoView({block:'start'})`);await wait(300);}
if(viewMode==='split'){await evaluate(`document.querySelector('.live-view-layout')?.scrollIntoView({block:'start'})`);await wait(300);}
if(viewMode==='analysis'){await evaluate(`document.querySelector('#simulationReport')?.scrollIntoView({block:'start'})`);await wait(300);}

const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
await writeFile(path.resolve(outputPath),Buffer.from(screenshot.data,'base64'));
socket.close();
console.log(JSON.stringify({...report,kpis:kpiReport,accordion,responsive,screenshot:path.resolve(outputPath)},null,2));
if(!report.selectedEquipment||report.inspectorWidth<360||report.editableAutoResult.length||!report.sectionOrder.includes('auto-engineering')||!report.finalReportButton||Object.values(report.decisionSupport).some(value=>!value)||!kpiReport.consistent||!accordion.toggled||!accordion.restored||responsive.some(result=>result.inspectorWidth<400))process.exitCode=1;
