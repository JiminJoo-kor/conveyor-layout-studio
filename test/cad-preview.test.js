import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeCadWithPreview} from '../src/cad-preview.js';
const wrap=body=>'0\nSECTION\n2\nENTITIES\n'+body+'0\nENDSEC\n0\nEOF\n';
test('unrecognized architectural drawing still renders CAD lines and ordinary labels',()=>{const r=analyzeCadWithPreview(wrap('0\nLINE\n8\nWALL\n10\n-100\n20\n-20\n11\n100\n21\n20\n0\nTEXT\n8\nTITLE\n10\n0\n20\n0\n40\n5\n1\nGeneral plan\n'));assert.equal(r.candidates.length,0);assert.equal(r.document.canvasGeometry.length,2);assert.equal(r.document.canvasGeometry[1].text,'General plan');const line=r.document.canvasGeometry[0];assert.ok(line.start.x>=0&&line.end.x<=1200);});
test('no converted geometry retains explicit diagnostic rather than inventing preview',()=>{assert.throws(()=>analyzeCadWithPreview(wrap('')),e=>Boolean(e.diagnostic));});
