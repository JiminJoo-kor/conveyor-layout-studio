import test from 'node:test';
import assert from 'node:assert/strict';
import {speedUnitReview} from '../src/speed-unit-review.js';

test('high conveyor speed offers an explicit m/min interpretation without changing data',()=>{
 const item={type:'conveyor',parameters:{speed:20}},before=structuredClone(item),review=speedUnitReview(item);
 assert.equal(review.severity,'unit-review');assert.equal(review.convertedMps,.333);assert.deepEqual(item,before);
});

test('normal speeds and other equipment do not show the conveyor unit review',()=>{
 assert.equal(speedUnitReview({type:'conveyor',parameters:{speed:1.2}}),null);assert.equal(speedUnitReview({type:'agv',parameters:{speed:20}}),null);
});
