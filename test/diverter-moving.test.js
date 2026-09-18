import test from 'node:test';
import assert from 'node:assert/strict';
import {diverterProfile,diverterMotionAtTime,advanceDiverterTransfer} from '../src/diverter.js';
import {CadFlowEngine} from '../src/engine.js';
import {movingDiverterVisualPose,handoverEndpointPose,cargoVisualExtentAlongAxis} from '../src/renderer.js';
const machine=()=>({id:'cv',type:'conveyor',x:0,y:0,parameters:{length:5,speed:1,acceleration:1,deceleration:1,motionProfile:1,diverterEnabled:1,diverterMotionMode:'moving',diverterRoutingMode:'available',diverterDirections:['up'],diverterSpeed:1,diverterStroke:2,diverterAcceleration:1,diverterDeceleration:1}});
test('고속 프로파일은 같은 진입·분기 속도에서 정속이고 출구 속도가 0이 아님',()=>{
 const profile=diverterProfile(machine());assert.equal(profile.total,2);assert.equal(profile.t1,0);assert.deepEqual(diverterMotionAtTime(profile,1),{position:1,velocity:1});assert.equal(diverterMotionAtTime(profile,2).velocity,1);
});
test('짧은 거리 가속·감속은 주어진 거리 내의 도달 속도와 시간으로 계산',()=>{
 const cv=machine();cv.parameters.diverterStroke=.1;cv.parameters.diverterSpeed=2;let p=diverterProfile(cv);assert.ok(p.endSpeed>1&&p.endSpeed<2);assert.ok(Math.abs(diverterMotionAtTime(p,p.total).position-.1)<1e-9);
 cv.parameters.diverterSpeed=.2;p=diverterProfile(cv);assert.ok(p.endSpeed>.2&&p.endSpeed<1);assert.ok(Math.abs(diverterMotionAtTime(p,p.total).position-.1)<1e-9);
});
test('분기중 차단은 위치 유지, 재개는 현재 위치에서 가속하고 중복 시간 적분 없음',()=>{
 const cv=machine(),edge={from:'cv',to:'out',fromPort:'top'},token={motionState:{velocity:1}};
 advanceDiverterTransfer(token,cv,edge,0,true);advanceDiverterTransfer(token,cv,edge,.5,true);assert.equal(token.diverterTransfer.progress,.25);
 advanceDiverterTransfer(token,cv,edge,1,false);advanceDiverterTransfer(token,cv,edge,20,false);assert.equal(token.diverterTransfer.progress,.25);assert.equal(token.diverterTransfer.velocity,0);
 advanceDiverterTransfer(token,cv,edge,21,true);assert.equal(token.diverterTransfer.progress,.25);advanceDiverterTransfer(token,cv,edge,21.5,true);const progress=token.diverterTransfer.progress;assert.ok(progress>.25);assert.equal(token.diverterTransfer.velocity,.5);advanceDiverterTransfer(token,cv,edge,21.5,true);assert.equal(token.diverterTransfer.progress,progress);assert.ok(advanceDiverterTransfer(token,cv,edge,25,true));
});
function engineFor(mode='moving'){const cv=machine();cv.parameters.diverterMotionMode=mode;const layout={equipment:[{id:'source',type:'source',parameters:{injectionInterval:30}},cv,{id:'out',type:'sink',x:0,y:-100,parameters:{dischargeTime:.1}}],cargoSpec:{length:500,width:400,unit:'mm'},cadSchematic:{edges:[{from:'source',to:'cv',toPort:'left'},{from:'cv',to:'out',fromPort:'top'}]}};return new CadFlowEngine(layout,{simDuration:40});}
test('실제 엔진: 고속 분기 진입 때 속도 유지, 정지형은 정지 후 분기',()=>{
 for(const mode of ['moving','stop']){const engine=engineFor(mode);let velocity=null;for(let i=0;i<1500;i++){engine.step(.02);const token=engine.state.cadTokens.find(token=>token.diverterTransfer);if(token&&velocity==null)velocity=token.motionState.velocity;}assert.notEqual(velocity,null);if(mode==='moving')assert.ok(velocity>.9);else assert.equal(velocity,0);assert.ok(engine.state.completedProducts.length>0);}
});
test('수신 불가시 고속 분기 시작하지 않고 정지, 해제 후 인계',()=>{
 const engine=engineFor(),blocker=engine.prepareToken({id:900,nodeId:'out',readyAt:Infinity});engine.state.cadTokens.push(blocker);
 for(let i=0;i<900;i++)engine.step(.02);const waiting=engine.state.cadTokens.find(token=>token.nodeId==='cv');assert.ok(waiting);assert.equal(waiting.motionState.velocity,0);assert.ok(!waiting.diverterTransfer);assert.equal(engine.state.completedProducts.length,0);
 engine.state.cadTokens=engine.state.cadTokens.filter(token=>token!==blocker);for(let i=0;i<900;i++)engine.step(.02);assert.ok(engine.state.completedProducts.length>0);
});
test('고속 분기 종료 속도는 하류 컨베이어로 이어진다',()=>{
 const cv=machine(),out={id:'out',type:'conveyor',parameters:{length:5,speed:1}},edge={from:'cv',to:'out',fromPort:'top',toPort:'left'},engine=new CadFlowEngine({equipment:[cv,out],cadSchematic:{edges:[edge]}}),token=engine.prepareToken({id:1,nodeId:'cv',edge,readyAt:0,motionState:{velocity:1}});engine.state.cadTokens=[token];engine.canAcceptNode=()=>true;
 assert.equal(engine.tryDirectHandover(token),false);engine.state.t=2;assert.equal(engine.tryDirectHandover(token),true);assert.equal(token.nodeId,'out');assert.equal(token.motion.controller.velocity,1);
});
test('물류 자세를 유지하며 곡선 접근 끝점과 분기 인계 시작점이 동일',()=>{
 const cv=machine(),edge={from:'cv',to:'out',fromPort:'top'},target={id:'out',x:0,y:-100},metrics={visualLength:18,visualWidth:10},start={x:-40,y:0,angle:0,cargoAngle:.3};
 assert.deepEqual(movingDiverterVisualPose(cv,edge,target,0,start,metrics),start);const end=movingDiverterVisualPose(cv,edge,target,1,start,metrics),probe=handoverEndpointPose(cv,'top',18,false,target,0),extent=cargoVisualExtentAlongAxis(18,10,.3,probe.angle),expected=handoverEndpointPose(cv,'top',extent,false,target,0);assert.equal(end.x,expected.x);assert.equal(end.y,expected.y);assert.equal(end.cargoAngle,.3);
});
