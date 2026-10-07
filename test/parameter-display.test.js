import test from 'node:test';
import assert from 'node:assert/strict';
import {parameterInputField,parameterInputValue} from '../src/parameter-display.js';
import {applyCommonParameters} from '../src/parameter-policy.js';
const field={key:'length',label:'실제 길이(m)',value:5.5,min:.1};
test('5500 mm input is 5.5 m internally and existing meter values display as mm',()=>{
 const item={type:'conveyor',parameters:{length:5.5},source:{parameterLengthUnit:'m'}};
 assert.deepEqual(parameterInputField(item,field,{}),{...field,label:'실제 길이(mm)',value:5500,min:100,step:1});
 assert.equal(parameterInputValue('length','5500'),5.5);assert.equal(parameterInputValue('speed','0.5'),.5);
 assert.equal(parameterInputField(item,{key:'speed',value:.5},{}).value,.5);
});
test('legacy CAD mm lengths render once and common apply converts to meters once',()=>{
 const source={id:'a',type:'conveyor',parameters:{length:5500},source:{origin:'dxf'}},target={id:'b',type:'conveyor',parameters:{length:1}};
 const layout={cadSource:{units:'mm'},equipment:[source,target]};
 assert.equal(parameterInputField(source,field,layout).value,5500);
 applyCommonParameters(layout,source,'length');assert.equal(target.parameters.length,5.5);assert.equal(target.source.parameterLengthUnit,'m');
 assert.equal(parameterInputField(target,field,layout).value,5500);
 const restored=JSON.parse(JSON.stringify(layout));assert.equal(parameterInputField(restored.equipment[1],field,restored).value,5500);
});
