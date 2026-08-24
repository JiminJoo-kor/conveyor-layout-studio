import test from 'node:test';
import assert from 'node:assert/strict';
import { CadFlowEngine } from '../src/engine.js';
import { buildSimulationReport } from '../src/report.js';

test('AS/RS 적치·반출과 4단계 물류 리포트를 계산한다',()=>{
  const source={id:'in',type:'source',name:'입고',x:0,y:0,parameters:{injectionInterval:2},source:{origin:'dxf',cadPosition:{x:0,y:0}}},storage={id:'asrs',type:'stackerCrane',name:'AS/RS',x:100,y:0,parameters:{rows:2,columns:5,levels:2,travelSpeed:4,liftSpeed:2},source:{origin:'dxf',cadPosition:{x:10000,y:0}}},sink={id:'out',type:'sink',name:'출고',x:200,y:0,parameters:{dischargeTime:1},source:{origin:'dxf',cadPosition:{x:20000,y:0}}};
  const layout={displayMode:'cad',cadSource:{units:'mm'},equipment:[source,storage,sink],cadSchematic:{lanes:[{name:'입출고 라인',direction:'inbound'}],edges:[{from:'in',to:'asrs',kind:'warehouse'},{from:'asrs',to:'out',kind:'warehouse'}]}};
  const engine=new CadFlowEngine(layout,{injectA:2,simDuration:60});for(let i=0;i<1200;i++)engine.step(.05);const report=buildSimulationReport(layout,engine,100);
  assert.ok(engine.state.asrs.putaways>0);assert.ok(engine.state.asrs.retrievals>0);assert.equal(report.targetUph,100);assert.equal(report.rows.length,2);assert.ok(report.eightHours>=0);assert.ok(report.topology[0].includes('AS/RS'));
});
