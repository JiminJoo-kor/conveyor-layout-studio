import test from 'node:test';
import assert from 'node:assert/strict';
import {asrsCycleProfile,asrsTargetCell} from '../src/engine.js';
import {buildPutawayMission,putawayMissionSnapshot,stationTransferPresentations} from '../src/asrs-putaway.js';

test('inbound pickup waits for travel from the retained outlet and leaves cargo untouched during approach',()=>{
 const rack={id:'rack',parameters:{columns:8,levels:4,rows:1,infeedColumn:1,infeedLevel:1,outfeedColumn:8,travelSpeed:1,liftSpeed:1,forkStroke:.2,forkSpeed:1}},start={column:7,level:2,row:0};
 const mission=buildPutawayMission(rack,[{tokenId:1,target:asrsTargetCell(rack,3),stationPosition:2}],asrsCycleProfile,10,'A','station',2,start);
 const token={id:1,nodeId:'station',putawayMission:mission};
 assert.ok(mission.pickupStartedAt>10);
 assert.equal(mission.startedAt,mission.pickupStartedAt+2);
 const begin=putawayMissionSnapshot(rack,token,10);
 assert.equal(begin.phase,'approach');assert.equal(begin.x,7);assert.equal(begin.y,2);
 assert.equal(stationTransferPresentations({id:'station'},{t:10,cadTokens:[token]})[0].scale,1);
 const arrived=putawayMissionSnapshot(rack,token,mission.pickupStartedAt);
 assert.equal(arrived.phase,'infeed');assert.equal(arrived.x,0);assert.equal(arrived.y,0);
 assert.equal(arrived.infeedProgress,0);
 assert.equal(putawayMissionSnapshot(rack,token,mission.pickupStartedAt+1).infeedProgress,.5);
});
