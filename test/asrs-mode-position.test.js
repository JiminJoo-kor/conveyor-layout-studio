import test from 'node:test';
import assert from 'node:assert/strict';
import {CadFlowEngine} from '../src/engine.js';
import {asrsSceneModel} from '../src/asrs-monitor.js';

test('mode transition moves LIVE from retained position and commits the configured handover coordinates',()=>{
 const rack={id:'rack',type:'asrs',parameters:{columns:8,levels:4,rows:2,productTypes:1,infeedColumn:1,infeedLevel:1,outfeedColumn:8,outfeedLevel:3,modeChangeTime:1}};
 const e=new CadFlowEngine({equipment:[rack],cadSchematic:{edges:[]}}),w=e.state.asrs,key=Object.keys(w.stackers)[0],s=w.stackers[key];
 s.mode='inbound';s.position={column:0,level:0,row:0};
 assert.equal(e.ensureAsrsLineMode(key,'outbound',w),true);
 e.state.t=s.availableAt/2;
 const op=asrsSceneModel(rack,e.state,()=> '#fff').zones[0].operation;
 assert.equal(op.phase,'mode-change');assert.ok(op.x>0&&op.x<7);assert.ok(op.y>0&&op.y<2);
 e.state.t=s.availableAt;e.updateAsrsLineState(key,w);
 assert.deepEqual(s.position,{column:7,level:2,row:0});
 e.ensureAsrsLineMode(key,'inbound',w);assert.deepEqual(s.fromPosition,{column:7,level:2,row:0});
 e.state.t=s.availableAt;e.updateAsrsLineState(key,w);
 assert.deepEqual(s.position,{column:0,level:0,row:0});
});
