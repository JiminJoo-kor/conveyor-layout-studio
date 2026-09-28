import {isSequenceRack,sequenceConfig} from './equipment-variants.js';
import {createSequenceSchedule,planSequenceRelease,acknowledgeSequenceRelease} from './sequence-rack.js';

export function sequenceCandidates(engine,storage,asrs,key,candidates,capacity){
 if(!isSequenceRack(storage))return candidates;
 const schedules=asrs.sequenceSchedules??={},index=asrs.stackers[key]?.index??0;
 const schedule=schedules[key]??=createSequenceSchedule(sequenceConfig(storage,index));
 // One period may require several physical trips when station capacity is smaller.
 const {job}=planSequenceRelease(schedule,engine.state.t,candidates.map(t=>({id:t.id,cell:t.asrsTarget.index,storedAt:t.nodeEnteredAt??t.createdAt??0})),{available:engine.state.equipmentReliability?.[storage.id]?.available!==false});
 if(!job)return [];
 return job.productIds.map(id=>candidates.find(t=>t.id===id)).filter(Boolean);
}
export function acknowledgeSequence(engine,asrs,key,token){
 const schedule=asrs.sequenceSchedules?.[key];
 if(schedule?.active)acknowledgeSequenceRelease(schedule,schedule.active.id,token.id,engine.state.t);
}
