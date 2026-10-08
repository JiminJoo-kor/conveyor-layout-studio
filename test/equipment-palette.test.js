import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentPaletteGroups,equipmentPaletteGroup} from '../src/equipment-palette.js';

test('설비 팔레트는 모든 지원 설비를 중복 없이 네 작업군으로 분류한다',()=>{
  const types=equipmentPaletteGroups.flatMap(group=>group.types);
  assert.equal(equipmentPaletteGroups.length,4);
  assert.equal(new Set(types).size,types.length);
  for(const type of ['conveyor','diverter','turntable','forkingDevice','asrs','sequenceRack','boxStacker','boxDestacker','amr','agv','inboundDock','dock','sink'])assert.ok(types.includes(type),type);
});

test('핵심 이송만 기본으로 열리고 설비 종류가 예상 그룹에 매핑된다',()=>{
  assert.deepEqual(equipmentPaletteGroups.filter(group=>group.open).map(group=>group.id),['transport']);
  assert.equal(equipmentPaletteGroup('conveyor'),'transport');
  assert.equal(equipmentPaletteGroup('turntable'),'routing');
  assert.equal(equipmentPaletteGroup('asrs'),'process-storage');
  assert.equal(equipmentPaletteGroup('sink'),'inout');
});
