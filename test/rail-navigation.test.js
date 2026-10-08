import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRailTab,railWarningRows} from '../src/rail-navigation.js';

test('left rail exposes only equipment project and warning tabs',()=>{
 assert.equal(normalizeRailTab('project'),'project');
 assert.equal(normalizeRailTab('unknown'),'equipment');
});

test('left rail combines topology and relevant runtime warnings',()=>{
 assert.deepEqual(railWarningRows({errors:['연결 오류'],warnings:['출구 대기']},[{type:'cargo-overload'},{type:'equipment-start'}]),[
  {level:'error',detail:'연결 오류'},{level:'warning',detail:'출구 대기'},{level:'runtime',detail:'허용하중 초과 감지'}
 ]);
});
