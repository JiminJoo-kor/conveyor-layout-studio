import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureDynamicParameters,parameterFieldsFor} from '../src/cad.js';
import {CadFlowEngine,asrsCycleProfile} from '../src/engine.js';
test('legacy JSON missing coordinates stores the same values displayed by the UI',()=>{
 const item={id:'rack',type:'asrs',parameters:{columns:8}};
 ensureDynamicParameters(item);
 const e=new CadFlowEngine({equipment:[item],cadSchematic:{edges:[]}});
 assert.equal(item.parameters.outfeedColumn,8);
 assert.equal(parameterFieldsFor(item).find(f=>f.key==='outfeedColumn').value,8);
 assert.equal(asrsCycleProfile(e.nodes.get('rack'),{operation:'retrieval'}).baseColumn,7);
 assert.equal(JSON.parse(JSON.stringify(item)).parameters.outfeedColumn,8);
});
test('explicit coordinates remain unchanged when initializing old layouts',()=>{
 const item={type:'stackerCrane',parameters:{outfeedColumn:3,infeedColumn:2,outfeedLevel:2}};
 ensureDynamicParameters(item);assert.equal(item.parameters.outfeedColumn,3);assert.equal(item.parameters.infeedColumn,2);assert.equal(item.parameters.outfeedLevel,2);
});
