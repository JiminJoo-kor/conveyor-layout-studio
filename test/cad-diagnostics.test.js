import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectDxfText,emptyDrawingError} from '../src/cad-diagnostics.js';
import {parseDxf} from '../src/dxf.js';
import {analyzeCadText} from '../src/cad-import.js';
const dxf='0\nSECTION\n2\nENTITIES\n0\nLINE\n10\n0\n20\n0\n11\n10\n21\n10\n0\nENDSEC\n0\nEOF\n';
test('DXF metadata distinguishes missing and empty entity sections without including drawing text',()=>{assert.deepEqual(inspectDxfText(dxf).entityTypes,{LINE:1});const e=emptyDrawingError('0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n');assert.match(e.message,/ENTITIES/);assert.equal(e.diagnostic.stage,'도형 읽기');assert.throws(()=>analyzeCadText('0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n'),e=>e.diagnostic.sections.includes('ENTITIES')&&/비어 있다는 뜻은 아닙니다/.test(e.message));});
test('DXF parser supports BOM and CR-only converted text',()=>{assert.equal(parseDxf('\uFEFF'+dxf.replaceAll('\n','\r')).entities.length,1);});
