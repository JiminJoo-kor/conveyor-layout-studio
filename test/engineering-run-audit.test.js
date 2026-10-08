import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEngineeringComparisonLayouts} from '../src/engineering-run-audit.js';

test('comparison layouts preserve the source and approve only the engineering clone',()=>{
 const source={schemaVersion:1,displayMode:'cad',cargoSpec:{length:1200,width:800,weight:100,unit:'mm'},equipment:[{id:'cv',type:'conveyor',parameters:{length:5,speed:1,autoMotionTuning:1}}],cadSchematic:{edges:[]}};
 const before=structuredClone(source),result=buildEngineeringComparisonLayouts(source);
 assert.deepEqual(source,before);assert.equal(result.baselineLayout.equipment[0].engineering,undefined);assert.equal(result.engineeringLayout.equipment[0].engineering?.motionRuntime,'approved');assert.deepEqual(result.approvedEquipment,['cv']);
});
