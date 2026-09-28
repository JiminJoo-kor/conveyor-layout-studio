import test from 'node:test';
import assert from 'node:assert/strict';
import {createSequenceSchedule,planSequenceRelease,acknowledgeSequenceRelease} from '../src/sequence-rack.js';
const inventory=[{id:1,cell:8,storedAt:1},{id:2,cell:3,storedAt:2},{id:3,cell:5,storedAt:3}];
test('stacker deadlines and blocked jobs are independent',()=>{
 const a=createSequenceSchedule({interval:10,count:2}),b=createSequenceSchedule({interval:5,count:2});
 assert.equal(planSequenceRelease(a,5,inventory).job,null);assert.equal(planSequenceRelease(b,5,inventory).created,true);
 const job=b.active;assert.equal(acknowledgeSequenceRelease(b,job.id,1,6),true);assert.ok(b.active);assert.equal(acknowledgeSequenceRelease(b,job.id,2,7),true);assert.equal(b.nextDue,10);
 assert.equal(planSequenceRelease(a,10,inventory,{busy:true}).job,null);assert.equal(planSequenceRelease(b,10,inventory).created,true);
});
test('specified sequence never bypasses a missing cell and advances only after handover',()=>{
 const s=createSequenceSchedule({interval:1,count:2,mode:'specified',cells:[3,99,8]});
 const {job}=planSequenceRelease(s,1,inventory);assert.deepEqual(job.productIds,[2]);assert.equal(s.cursor,0);
 acknowledgeSequenceRelease(s,job.id,2,2);assert.equal(s.cursor,1);assert.equal(planSequenceRelease(s,3,inventory).job,null);
});
test('seeded random planning survives JSON reload and never duplicates reserved or selected inventory',()=>{
 const a=createSequenceSchedule({interval:1,count:8,mode:'random',seed:42}),b=JSON.parse(JSON.stringify(a)),stock=[...inventory,{id:4,cell:1,reserved:true}];
 assert.deepEqual(planSequenceRelease(a,1,stock),planSequenceRelease(b,1,stock));assert.equal(a.active.productIds.length,3);assert.equal(new Set(a.active.productIds).size,3);assert.ok(!a.active.productIds.includes(4));
});
