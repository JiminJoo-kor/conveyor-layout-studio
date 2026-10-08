import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceNavigationState} from '../src/workspace-navigation.js';

test('빈 프로젝트에서는 실행 및 3D 탐색을 비활성화한다',()=>{
 assert.deepEqual(workspaceNavigationState({equipment:[]},true),{ready:false,has3d:false,splitReady:false});
});

test('일반 설비 프로젝트는 시뮬레이션과 분석만 활성화한다',()=>{
 assert.deepEqual(workspaceNavigationState({equipment:[{type:'conveyor'}]}),{ready:true,has3d:false,splitReady:false});
});

test('AS/RS가 있으면 3D LIVE 탐색을 활성화한다',()=>{
 assert.deepEqual(workspaceNavigationState({equipment:[{type:'stackerCrane'}]}),{ready:true,has3d:true,splitReady:true});
});

test('제외된 AS/RS 후보는 3D LIVE 대상으로 세지 않는다',()=>{
 assert.equal(workspaceNavigationState({equipment:[{type:'asrs',reviewStatus:'rejected'}]}).has3d,false);
});
