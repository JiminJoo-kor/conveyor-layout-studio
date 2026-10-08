import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceActionGroups,workspaceActionStatus} from '../src/workspace-actions.js';

test('캔버스 빠른 작업은 생성 편집 화면 맞춤만 직접 노출한다',()=>{
  assert.deepEqual(workspaceActionGroups.quick,['newLayoutProject','editorToggle','viewFit']);
  assert.deepEqual(workspaceActionGroups.more.flatMap(group=>group.ids),['layoutFile','exportLayout','cadFile','drawingFile','cadViewToggle']);
});

test('작업 상태는 배치 연결 선택 편집 순으로 현재 조작을 설명한다',()=>{
  assert.equal(workspaceActionStatus({projectEmpty:true}),'프로젝트 대기');
  assert.equal(workspaceActionStatus({editing:true,placement:'conveyor'}),'배치 · CONVEYOR');
  assert.equal(workspaceActionStatus({editing:true,connecting:true}),'연결 설정 중');
  assert.equal(workspaceActionStatus({editing:true,selectionCount:3}),'3개 선택');
  assert.equal(workspaceActionStatus({editing:true}),'편집 중');
  assert.equal(workspaceActionStatus({}),'보기 모드');
});
