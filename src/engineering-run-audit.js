import {syncAsrsStations} from './asrs-stations.js';
import {approveEngineeringMotionById,approveEngineeringMotionByType} from './engineering-approval.js';
import {buildEngineeringMotionAudit} from './engineering-compatibility.js';
import {captureMeasuredInterval,captureMeasurementSnapshot,compareMeasuredRuns,recommendedMeasurementWindow} from './engineering-run-comparison.js';
import {CadFlowEngine} from './engine.js';
import {cloneLayout,removeUnreferencedLegacyDemoEquipment,validateLayout} from './layout.js';

export function rankEngineeringCandidates(sourceLayout,type){
 const layout=cloneLayout(sourceLayout);removeUnreferencedLegacyDemoEquipment(layout);syncAsrsStations(layout);
 return buildEngineeringMotionAudit(layout).rows.filter(row=>row.status==='review'&&(!type||row.type===type)).sort((a,b)=>Math.abs(b.deltaSeconds)-Math.abs(a.deltaSeconds));
}

export function buildEngineeringComparisonLayouts(sourceLayout,types,ids){
 const baselineLayout=cloneLayout(sourceLayout),engineeringLayout=cloneLayout(sourceLayout);
 removeUnreferencedLegacyDemoEquipment(baselineLayout);removeUnreferencedLegacyDemoEquipment(engineeringLayout);
 syncAsrsStations(baselineLayout);syncAsrsStations(engineeringLayout);
 const approvedEquipment=ids?.length?approveEngineeringMotionById(engineeringLayout,ids):approveEngineeringMotionByType(engineeringLayout,types);
 return{baselineLayout,engineeringLayout,approvedEquipment,approvedTypes:types?[...types]:null,requestedEquipment:ids?[...ids]:null};
}

function advance(engine,seconds){for(let elapsed=0;elapsed<seconds;elapsed+=1)engine.step(Math.min(1,seconds-elapsed));}

function simulate(layout,window,kind){
 const validation=validateLayout(layout);if(!validation.valid)throw Error(validation.errors.join(' '));
 const engine=new CadFlowEngine(layout,{...(layout.simulationParams||{}),simDuration:window.totalSeconds});
 advance(engine,window.warmupSeconds);const start=captureMeasurementSnapshot(engine),before={putaways:engine.state.asrs.putaways,retrievals:engine.state.asrs.retrievals};
 advance(engine,window.measurementSeconds);const run=captureMeasuredInterval(engine,start,kind);
 return{run,details:{putaways:engine.state.asrs.putaways-before.putaways,retrievals:engine.state.asrs.retrievals-before.retrievals,inventory:engine.state.asrs.inventory,outboundTrucks:engine.state.outboundTrucks,stall:engine.state.stall}};
}

export function runEngineeringComparison(sourceLayout,configuredSeconds=0,types,ids){
 const window=recommendedMeasurementWindow(sourceLayout,configuredSeconds),{baselineLayout,engineeringLayout,approvedEquipment,approvedTypes,requestedEquipment}=buildEngineeringComparisonLayouts(sourceLayout,types,ids),baseline=simulate(baselineLayout,window,'baseline'),engineering=simulate(engineeringLayout,window,'engineering');
 return{measurementWindow:window,approvedTypes,requestedEquipment,approvedEquipment,baseline,engineering,comparison:compareMeasuredRuns(baseline.run,engineering.run)};
}
