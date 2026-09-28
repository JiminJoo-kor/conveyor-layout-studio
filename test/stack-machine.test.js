import test from 'node:test';
import assert from 'node:assert/strict';
import {createStackMachine,receiveStack,advanceStackMachine,startStackRelease,completeStackRelease,stackMachineStatus,canStackMachineReceive} from '../src/stack-machine.js';
const box=id=>({id,kind:'empty-box',empty:true,length:1,width:.8,height:.2,weight:2});
const cycle=s=>{for(let i=0;i<10;i++)advanceStackMachine(s,1);};
test('eight empty boxes accumulate bottom-first with stopper up, then await real downstream clearance',()=>{
 const s=createStackMachine({targetCount:8});
 for(let id=1;id<=8;id++){receiveStack(s,[box(id)]);cycle(s);assert.equal(s.stopperUp,true);assert.equal(stackMachineStatus(s).count,id);if(id<8)assert.equal(s.held.length,id);}
 assert.equal(s.phase,'ready');assert.equal(startStackRelease(s,{reservationId:1,downstreamApproved:false,beltPermit:true}),false);
 assert.equal(startStackRelease(s,{reservationId:1,downstreamApproved:true,beltPermit:true}),true);
 assert.equal(completeStackRelease(s,{reservationId:1,tailCleared:false,downstreamAccepted:true}),null);assert.equal(s.stopperUp,false);assert.equal(s.outgoing.length,8);
 const loads=completeStackRelease(s,{reservationId:1,tailCleared:true,downstreamAccepted:true});assert.deepEqual(loads.map(l=>l.id),[8,7,6,5,4,3,2,1]);assert.equal(s.stopperUp,true);assert.equal(s.phase,'waiting');
});
test('unstacking preserves individual identities and releases bottom box one at a time',()=>{
 let s=createStackMachine({mode:'unstack'});receiveStack(s,[box(1),box(2),box(3)]);const ids=[];
 for(let i=0;i<3;i++){cycle(s);s=JSON.parse(JSON.stringify(s));assert.equal(s.deck.length,1);assert.equal(s.held.length,2-i);startStackRelease(s,{reservationId:i,downstreamApproved:true,beltPermit:true});ids.push(...completeStackRelease(s,{reservationId:i,tailCleared:true,downstreamAccepted:true}).map(l=>l.id));}
 assert.deepEqual(ids,[1,2,3]);assert.equal(s.completedBoxes,3);assert.equal(stackMachineStatus(s).remainingPercent,0);
});
test('failure freezes motion, invalid load is rejected without mutation and stale acknowledgments do nothing',()=>{
 const s=createStackMachine({targetCount:2});receiveStack(s,[box(1)]);advanceStackMachine(s,.5);const before=JSON.stringify(s);advanceStackMachine(s,5,{available:false});assert.equal(JSON.stringify(s),before);cycle(s);
 const held=JSON.stringify(s);assert.throws(()=>receiveStack(s,[{...box(2),width:4}]));assert.equal(JSON.stringify(s),held);assert.equal(canStackMachineReceive(s,[box(1)]).allowed,false);
 receiveStack(s,[box(2)]);cycle(s);startStackRelease(s,{reservationId:5,downstreamApproved:true,beltPermit:true});assert.equal(completeStackRelease(s,{reservationId:4,tailCleared:true,downstreamAccepted:true}),null);
});
test('single box passes without lifting and payload limits account for every box',()=>{
 const s=createStackMachine();receiveStack(s,[box(1)]);assert.equal(s.phase,'ready');assert.equal(stackMachineStatus(s).liftProgress,0);
 const limited=createStackMachine({targetCount:2,maxWeight:3});receiveStack(limited,[box(1)]);cycle(limited);assert.equal(canStackMachineReceive(limited,[box(2)]).allowed,false);
});
