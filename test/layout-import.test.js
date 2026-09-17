import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cloneLayout, validateLayout } from '../src/layout.js';

const fixture = () => JSON.parse(readFileSync(new URL('./fixtures/generic-two-warehouses.json', import.meta.url), 'utf8'));
test('valid legacy and CAD documents remain importable and executable', () => {
  for (const layout of [cloneLayout(), fixture()]) {
    assert.equal(validateLayout(layout).valid, true);
    assert.equal(validateLayout(layout, { forExecution:false }).valid, true);
  }
});
test('broken CAD connection can open for repair without bypassing execution validation', () => {
  const layout = fixture();
  layout.cadSchematic.edges[0].to = 'missing-equipment';
  const before = JSON.stringify(layout);
  assert.equal(validateLayout(layout, { forExecution:false }).valid, true);
  assert.equal(validateLayout(layout).valid, false);
  assert.equal(JSON.stringify(layout), before);
});
test('invalid equipment parameters can open for repair, never execute', () => {
  const layout = fixture();
  layout.equipment[1].parameters.speed = 0;
  assert.equal(validateLayout(layout, { forExecution:false }).valid, true);
  assert.equal(validateLayout(layout).valid, false);
});
test('malformed import shapes return useful errors instead of throwing', () => {
  for (const layout of [null, {}, {schemaVersion:1,equipment:{}}, {schemaVersion:1,equipment:[null]}, {schemaVersion:1,equipment:[{id:'a',nodes:{}}]}, {schemaVersion:1,equipment:[],cadSchematic:{edges:[null]}}]) {
    const check = validateLayout(layout, { forExecution:false });
    assert.equal(check.valid, false);
    assert.ok(check.errors.length);
  }
});
test('duplicate equipment identity remains a document error', () => {
  const layout = fixture();
  layout.equipment.push({...layout.equipment[0]});
  assert.equal(validateLayout(layout, { forExecution:false }).valid, false);
});
