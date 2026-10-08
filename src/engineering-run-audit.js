import {syncAsrsStations} from './asrs-stations.js';
import {approveEngineeringMotionByType} from './engineering-approval.js';
import {captureMeasuredRun,compareMeasuredRuns,recommendedMeasurementWindow} from './engineering-run-comparison.js';
import {CadFlowEngine} from './engine.js';
import {cloneLayout,removeUnreferencedLegacyDemoEquipment,validateLayout} from './layout.js';

export function buildEngineeringComparisonLayouts(sourceLayout,types){
 const baselineLayout=cloneLayout(sourceLayout),engineeringLayout=cloneLayout(sourceLayout);
 removeUnreferencedLegacyDemoEquipment(baselineLayout);removeUnreferencedLegacyDemoEquipment(engineeringLayout);
 syncAsrsStations(baselineLayout);syncAsrsStations(engineeringLayout);
 const approvedEquipment=approveEngineeringMotionByType(engineeringLayout,types);
 return{baselineLayout,engineeringLayout,approvedEquipment,approvedTypes:types?[...types]:null};
}

function simulate(layout,seconds,kind){
 const validation=validateLayout(layout);if(!validation.valid)throw Error(validation.errors.join(' '));
 const engine=new CadFlowEngine(layout,{...(layout.simulationParams||{}),simDuration:seconds});
 for(let elapsed=0;elapsed<seconds;elapsed+=1)engine.step(Math.min(1,seconds-elapsed));
 const kpis=engine.getKpis(),run=captureMeasuredRun({...kpis,movedItems:engine.state.movedItems},engine.state.t,kind);
 return{run,details:{putaways:engine.state.asrs.putaways,retrievals:engine.state.asrs.retrievals,inventory:engine.state.asrs.inventory,outboundTrucks:engine.state.outboundTrucks,stall:engine.state.stall}};
}

export function runEngineeringComparison(sourceLayout,configuredSeconds=0,types){
 const window=recommendedMeasurementWindow(sourceLayout,configuredSeconds),{baselineLayout,engineeringLayout,approvedEquipment,approvedTypes}=buildEngineeringComparisonLayouts(sourceLayout,types),baseline=simulate(baselineLayout,window.seconds,'baseline'),engineering=simulate(engineeringLayout,window.seconds,'engineering');
 return{measurementWindow:window,approvedTypes,approvedEquipment,baseline,engineering,comparison:compareMeasuredRuns(baseline.run,engineering.run)};
}
