import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeCadText,measureCadEntity,rememberCadPattern,proposeCadConnections,validateCadConnections,confirmCadConnection} from '../src/cad-import.js';
import {loadCadPatterns,saveCadPatterns,runCadImport} from '../src/cad-import-client.js';
const dxf=(units=4,entities='0\nLINE\n8\nCV\n10\n0\n20\n0\n11\n5500\n21\n0\n')=>`0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n${units}\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
test('dimensionless annotation-free line gets true meter length and progress counts',()=>{
 const events=[],r=analyzeCadText(dxf(),{onProgress:p=>events.push(p)});assert.equal(r.candidates[0].parameters.length,5.5);assert.equal(r.candidates[0].source.parameterLengthUnit,'m');assert.equal(r.schematic.edges.length,0);assert.ok(events.some(e=>e.done===1&&e.total===1));
});
test('unknown unit is not silently interpreted as meters',()=>{
 const r=analyzeCadText(dxf(0));assert.equal(r.review.unitConfirmed,false);assert.equal(r.candidates[0].source.dimensionReviewRequired,true);assert.equal(r.candidates[0].source.measurement.length,null);
 assert.equal(analyzeCadText(dxf(0),{unitOverride:'mm'}).candidates[0].parameters.length,5.5);
});
test('inch and foot scales supported without dimension annotations',()=>{
 assert.equal(analyzeCadText(dxf(1)).candidates[0].parameters.length,139.7);assert.equal(analyzeCadText(dxf(2)).candidates[0].parameters.length,1676.4);
});
test('rotated closed outline keeps 5500 by 900 measurements',()=>{
 const a=.7,vertices=[[0,0],[5500,0],[5500,900],[0,900]].map(([x,y])=>({x:100+x*Math.cos(a)-y*Math.sin(a),y:200+x*Math.sin(a)+y*Math.cos(a)}));
 const m=measureCadEntity({entityType:'LWPOLYLINE',closed:true,vertices},[],'mm');assert.ok(Math.abs(m.length-5.5)<1e-8);assert.ok(Math.abs(m.width-.9)<1e-8);assert.equal(m.review,false);
});
test('nested block transformed geometry and rotation measured in local axis',()=>{
 const a=Math.PI/3,vertices=[[0,0],[11000,0],[11000,450],[0,450]].map(([x,y])=>({x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)}));const m=measureCadEntity({entityType:'INSERT',rotation:60},[{entityType:'LWPOLYLINE',vertices}], 'mm');assert.ok(Math.abs(m.length-11)<1e-8);assert.ok(Math.abs(m.width-.45)<1e-8);
});
test('curved polyline never gets a false straight chord measurement',()=>{
 const m=measureCadEntity({entityType:'LWPOLYLINE',vertices:[{x:0,y:0},{x:1000,y:0}],hasBulge:true},[],'mm');assert.equal(m.length,null);assert.equal(m.review,true);
});
test('confirmed pattern remembers type only, survives storage and matches reimport',()=>{
 const item=analyzeCadText(dxf()).candidates[0],patterns=rememberCadPattern([],item,'forkingDevice');assert.equal(patterns[0].parameters,undefined);
 const storage={value:'',getItem(){return this.value;},setItem(k,v){this.value=v;}};saveCadPatterns(patterns,storage);const r=analyzeCadText(dxf(),{patterns:loadCadPatterns(storage)});assert.equal(r.candidates[0].type,'forkingDevice');assert.equal(r.candidates[0].source.patternMatched,true);
});
test('endpoint gaps are proposed only, interior crossings do not connect',()=>{
 const lines='0\nLINE\n8\nCV\n10\n0\n20\n0\n11\n1000\n21\n0\n0\nLINE\n8\nCV\n10\n1020\n20\n0\n11\n2020\n21\n0\n0\nLINE\n8\nCV\n10\n500\n20\n-500\n11\n500\n21\n500\n';
 const r=analyzeCadText(dxf(4,lines));assert.equal(r.review.proposals.length,1);assert.equal(r.schematic.edges.length,0);assert.ok(Math.abs(r.review.proposals[0].gap-.02)<1e-10);
 const edge=confirmCadConnection(r.candidates,r.review.proposals[0]);assert.equal(validateCadConnections(r.candidates,[edge]).filter(e=>e.kind==='direction').length,0);assert.equal(validateCadConnections(r.candidates,[edge,edge]).filter(e=>e.kind==='duplicate').length,1);
});
test('reverse acceptance updates machine flow direction',()=>{
 const a=analyzeCadText(dxf()).candidates[0],b=structuredClone(a);b.id+='b';const edge=confirmCadConnection([a,b],{from:a.id,to:b.id,fromPort:'left',toPort:'right'});assert.equal(a.parameters.flowDirection,'left');assert.equal(b.parameters.flowDirection,'left');assert.equal(validateCadConnections([a,b],[edge]).filter(e=>e.kind==='direction').length,0);
});
test('cancellation before worker creation rejects without changing layout',async()=>{
 const c=new AbortController();c.abort();await assert.rejects(runCadImport({name:'drawing.dxf',size:20},{signal:c.signal}),{name:'AbortError'});
});
