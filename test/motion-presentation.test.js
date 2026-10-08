import test from 'node:test';
import assert from 'node:assert/strict';
import {motionPresentation,motionSummaryMarkup} from '../src/motion-presentation.js';

test('presents a distance-limited triangular profile as a calculated result',()=>{
 const result=motionPresentation({config:{targetSpeed:2,acceleration:.8,deceleration:1},summary:{peakSpeed:.6,t1:.75,t2:0,t3:.6,total:1.35}});
 assert.equal(result.profileType,'triangular');
 assert.equal(result.profileLabel,'삼각형 · 거리 제한');
 assert.equal(result.reachesTarget,false);
 assert.match(motionSummaryMarkup(result,{automatic:true}),/INPUT[\s\S]*AUTO[\s\S]*RESULT/);
});

test('presents a target-reaching profile with a constant-speed interval',()=>{
 const result=motionPresentation({calculated:{requestedSpeed:1,appliedSpeed:.8,acceleration:.5,deceleration:.7,profileType:'trapezoidal'},config:{},summary:{peakSpeed:.8,cruiseTime:2,totalTime:4}});
 assert.equal(result.profileLabel,'사다리꼴 · 정속구간 있음');
 assert.equal(result.reachesTarget,true);
 assert.match(motionSummaryMarkup(result,{automatic:true}),/목표속도[\s\S]*적용속도[\s\S]*실제 최고/);
});
