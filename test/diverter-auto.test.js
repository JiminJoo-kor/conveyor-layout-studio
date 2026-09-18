import test from 'node:test';
import assert from 'node:assert/strict';
import {diverterProfile,updateDiverterParameter} from '../src/diverter.js';

test('automatic diverter dynamics refresh with speed and stroke and retain cruise',()=>{
  const item={type:'conveyor',parameters:{diverterStroke:1,diverterSpeed:.5}};
  updateDiverterParameter(item,'diverterEnabled',1);
  const first=diverterProfile(item);assert.ok(first.t2>0);
  updateDiverterParameter(item,'diverterSpeed',1);
  const faster=diverterProfile(item);assert.equal(item.parameters.diverterAcceleration,2);assert.equal(item.parameters.diverterDeceleration,2);assert.ok(faster.total<first.total);assert.ok(faster.t2>0);
  updateDiverterParameter(item,'diverterStroke',2);
  assert.equal(item.parameters.diverterAcceleration,1);assert.ok(diverterProfile(item).total>faster.total);
});
test('manual diverter acceleration and deceleration remain independent',()=>{
  const item={type:'conveyor',parameters:{diverterEnabled:1,diverterAutoDynamics:0,diverterAcceleration:.3,diverterDeceleration:.7}};
  updateDiverterParameter(item,'diverterSpeed',2);
  assert.equal(diverterProfile(item).config.acceleration,.3);assert.equal(diverterProfile(item).config.deceleration,.7);
});
test('moving automatic diverter keeps nonzero entry speed and finite motion',()=>{
  const item={type:'conveyor',parameters:{diverterEnabled:1,diverterAutoDynamics:1,diverterMotionMode:'moving',speed:2,diverterSpeed:1,diverterStroke:1}};
  const profile=diverterProfile(item,2);assert.equal(profile.startSpeed,2);assert.ok(profile.endSpeed>0);assert.ok(Number.isFinite(profile.total));assert.equal(profile.config.acceleration,8);
});
