import test from 'node:test';
import assert from 'node:assert/strict';
import {engineeringPanelMarkup,engineeringPresentation} from '../src/engineering-presentation.js';

test('engineering result prioritizes selected IEC motor and physical requirements',()=>{
 const view=engineeringPresentation({preview:{movingMassKg:80,motorSelection:{status:'selected',motor:{id:'IEC-0.75',powerKw:.75},requirements:{motorTorqueNm:3.2,motorRpm:716,powerKw:.42},maxPayloadKg:610,loadUtilization:57.4,limitingFactor:'기동 토크',verification:{status:'verified',maxResidualPercent:.012,checks:[{label:'토크 역산',residualPercent:.012}],reasons:[]}},motions:[],changes:[]},load:{unitPayloadKg:175,loadCount:2,payloadKg:350},compatibility:{status:'compatible',scope:'linear',legacySeconds:5,engineeringSeconds:5.4,deltaSeconds:.4}});
 const html=engineeringPanelMarkup(view);
 assert.equal(view.selectionStatus,'SELECTED');
 assert.match(html,/IEC-0\.75[\s\S]*0\.75 kW/);
 assert.match(html,/Required Torque[\s\S]*Required RPM[\s\S]*Required Power/);
 assert.match(html,/현재 만재[\s\S]*최대 구동 적재중량[\s\S]*구동계 사용률/);
 assert.match(html,/정·역산 검증 완료[\s\S]*최대 계산 잔차 0\.012%/);
 assert.ok(html.indexOf('선정 요구조건')<html.indexOf('적재 여유'));
});

test('engineering result explicitly marks an out-of-range motor candidate for review',()=>{
 const view=engineeringPresentation({preview:{motorSelection:{status:'limited',motor:null,requirements:{}},motions:[],changes:[{cause:'출력 한계',action:'속도 감소',impact:'CT 증가'}]},load:{},compatibility:{status:'review',scope:'linear',legacySeconds:1,engineeringSeconds:2,deltaSeconds:1}});
 const html=engineeringPanelMarkup(view);
 assert.equal(view.selectionStatus,'REVIEW');
 assert.match(html,/표준 후보 범위 검토/);
 assert.match(html,/원인[\s\S]*조치[\s\S]*영향/);
});
