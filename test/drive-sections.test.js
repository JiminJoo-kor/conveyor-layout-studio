import test from 'node:test';
import assert from 'node:assert/strict';
import {conveyorSectionCapacity,conveyorSectionIndex,designConveyorDriveSystem,planConveyorDriveSections} from '../src/drive-sections.js';
import {conveyorDriveSectionVisuals} from '../src/renderer.js';

test('long conveyor is balanced into manufacturable sections with one drive each',()=>{
 const conveyor={id:'cv-01',type:'conveyor',parameters:{length:23,speed:.5,safetyGap:.2,autoMotionTuning:1}},sections=planConveyorDriveSections(conveyor,{length:1000,width:800,weight:100,unit:'mm'},{maxSectionLengthM:6});
 assert.equal(sections.length,4);assert.ok(sections.every(section=>section.lengthM<=6));assert.equal(sections.reduce((sum,section)=>sum+section.lengthM,0),23);assert.deepEqual(sections.map(section=>section.name),['S01','S02','S03','S04']);assert.ok(sections.every(section=>section.motorPowerKw>0));
 assert.ok(sections.every(section=>section.gearboxId&&section.status==='verified'&&section.driveVerification.verified&&section.mechanicalCheck.verified));
});

test('mechanical traction limit adds drive sections and records cause action impact',()=>{
 const conveyor={id:'cv-auto',type:'conveyor',parameters:{length:10,speed:.5,safetyGap:0,autoMotionTuning:1}},design=designConveyorDriveSystem(conveyor,{length:1000,weight:120,unit:'mm'},{maxSectionLengthM:10,mechanical:{tractionRatedForceN:1000}});
 assert.equal(design.status,'verified');assert.ok(design.finalSectionCount>design.initialSectionCount);assert.ok(design.logs.some(log=>log.cause&&log.action&&log.impact));assert.ok(design.sections.every(section=>section.mechanicalCheck.verified));
});

test('single cargo overload is reported for mechanical upgrade instead of endless splitting',()=>{
 const conveyor={id:'cv-heavy',type:'conveyor',parameters:{length:5,speed:.5,autoMotionTuning:1}},design=designConveyorDriveSystem(conveyor,{length:1000,weight:1000,unit:'mm'},{mechanical:{rollerRatedLoadKg:20,framePointLoadKg:500}});
 assert.equal(design.status,'review');assert.equal(design.iterations,1);assert.ok(design.logs.some(log=>log.action.includes('기계 사양 상향')));assert.ok(design.sections.some(section=>section.mechanicalCheck.unsplittable));
});

test('section cargo count uses cargo pitch and full-load weight for motor sizing',()=>{
 assert.equal(conveyorSectionCapacity(5.75,1,.2),4);
 const light=planConveyorDriveSections({id:'cv',type:'conveyor',parameters:{length:5.75,speed:1,safetyGap:.2,autoMotionTuning:1}},{length:1000,width:800,weight:50,unit:'mm'})[0],heavy=planConveyorDriveSections({id:'cv',type:'conveyor',parameters:{length:5.75,speed:1,safetyGap:.2,autoMotionTuning:1}},{length:1000,width:800,weight:300,unit:'mm'})[0];
 assert.equal(light.capacity,4);assert.equal(light.payloadKg,200);assert.equal(heavy.payloadKg,1200);assert.ok(heavy.motorPowerKw>=light.motorPowerKw);assert.ok(heavy.loadUtilization>0);
});

test('short conveyor remains one section and non-conveyor equipment is untouched',()=>{
 const sections=planConveyorDriveSections({id:'short',type:'conveyor',parameters:{length:3,speed:.5}},{length:1200,weight:100,unit:'mm'});assert.equal(sections.length,1);assert.equal(sections[0].lengthM,3);
 assert.deepEqual(planConveyorDriveSections({id:'lift',type:'lift',parameters:{}},{length:1200,weight:100,unit:'mm'}),[]);
});

test('cargo position maps to the active physical drive section',()=>{
 const sections=planConveyorDriveSections({id:'cv',type:'conveyor',parameters:{length:12,speed:.5}},{length:1000,weight:100,unit:'mm'});assert.equal(sections.length,2);assert.equal(conveyorSectionIndex(sections,0),0);assert.equal(conveyorSectionIndex(sections,5.99),0);assert.equal(conveyorSectionIndex(sections,6),1);assert.equal(conveyorSectionIndex(sections,12),1);
});

test('canvas section status follows live cargo position and parent belt lock',()=>{
 const item={id:'cv',type:'conveyor',parameters:{length:12,speed:.5}},layout={cargoSpec:{length:1000,weight:100,unit:'mm'}},state={cadTokens:[{nodeId:'cv',motionState:{position:7}}],locks:{conveyor:{cv:false}}},visuals=conveyorDriveSectionVisuals(item,state,layout,120);assert.equal(visuals.length,2);assert.deepEqual(visuals.map(section=>section.active),[false,true]);assert.equal(visuals[0].startX,-60);assert.equal(visuals.at(-1).endX,60);
 state.locks.conveyor.cv=true;assert.ok(conveyorDriveSectionVisuals(item,state,layout,120).every(section=>section.locked));
});
