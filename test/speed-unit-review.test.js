import test from 'node:test';
import assert from 'node:assert/strict';
import {applyPlausibleSpeedUnitConversions,speedUnitReview} from '../src/speed-unit-review.js';

test('high conveyor speed offers an explicit m/min interpretation without changing data',()=>{
 const item={type:'conveyor',parameters:{speed:20}},before=structuredClone(item),review=speedUnitReview(item);
 assert.equal(review.severity,'unit-review');assert.equal(review.convertedMps,.333);assert.deepEqual(item,before);
});

test('normal speeds and other equipment do not show the conveyor unit review',()=>{
 assert.equal(speedUnitReview({type:'conveyor',parameters:{speed:1.2}}),null);assert.equal(speedUnitReview({type:'agv',parameters:{speed:20}}),null);
});

test('batch conversion changes only plausible conveyor copies and records every change',()=>{
 const layout={equipment:[{id:'a',name:'A',type:'conveyor',parameters:{speed:20},engineering:{motionRuntime:'approved'}},{id:'b',type:'conveyor',parameters:{speed:1.2}},{id:'c',type:'agv',parameters:{speed:20}}]},changes=applyPlausibleSpeedUnitConversions(layout);
 assert.deepEqual(changes.map(change=>[change.equipmentId,change.before,change.after]),[['a',20,.333]]);assert.equal(layout.equipment[0].engineering,undefined);assert.equal(layout.equipment[1].parameters.speed,1.2);assert.equal(layout.equipment[2].parameters.speed,20);
});
