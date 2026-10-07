import {readFile} from 'node:fs/promises';
import {validateLayout,removeUnreferencedLegacyDemoEquipment} from '../src/layout.js';
import {syncAsrsStations,compactAsrsStations} from '../src/asrs-stations.js';
import {validateFlowGraph} from '../src/flow-graph.js';
import {CadFlowEngine} from '../src/engine.js';
import {compareLayoutEngineering} from '../src/engineering-compatibility.js';
import {parameterFieldsFor} from '../src/cad.js';
import {approveEngineeringMotionByType} from '../src/engineering-approval.js';

const file=process.argv[2];
if(!file)throw Error('사용법: node scripts/audit-layout.mjs <layout.json>');
const source=await readFile(file,'utf8'),original=JSON.parse(source.replace(/^\uFEFF/,'')),layout=structuredClone(original);
const simulationSeconds=Math.max(1,Number(process.argv[3]||layout.simulationParams?.simDuration||300));
const approvedTypes=new Set((process.argv[4]||'').split(',').map(value=>value.trim()).filter(Boolean));
const documentValidation=validateLayout(layout,{forExecution:false});
const removedLegacyDemo=removeUnreferencedLegacyDemoEquipment(layout);
const approvedEquipment=approveEngineeringMotionByType(layout,approvedTypes);
syncAsrsStations(layout);
const graph=validateFlowGraph(layout),executionValidation=validateLayout(layout),engineeringItems=layout.equipment.filter(item=>!item.asrsStation),engineering=compareLayoutEngineering({...layout,equipment:engineeringItems}),kindCounts={},unknownFields=[];
for(const item of layout.equipment.filter(item=>!item.asrsStation))for(const field of parameterFieldsFor(item)){kindCounts[field.parameterKind]=(kindCounts[field.parameterKind]||0)+1;if(!field.parameterKind)unknownFields.push(`${item.id}.${field.key}`);}
const compact=compactAsrsStations(layout),restored=JSON.parse(JSON.stringify(compact));syncAsrsStations(restored);
const roundTripGraph=validateFlowGraph(restored),engine=graph.valid?new CadFlowEngine(restored,{...(layout.simulationParams||{}),simDuration:simulationSeconds}):null;
if(engine)for(let index=0;index<Math.ceil(simulationSeconds/.02);index++)engine.step(.02);
const byId=new Map(layout.equipment.map(item=>[item.id,item])),statusCounts=engineering.reduce((counts,result)=>(counts[result.status]=(counts[result.status]||0)+1,counts),{}),statusByType=engineering.reduce((types,result)=>{types[result.type]??={};types[result.type][result.status]=(types[result.type][result.status]||0)+1;return types;},{}),review=engineering.filter(result=>result.status==='review').map(result=>({id:result.equipmentId,type:result.type,scope:result.scope,legacySeconds:result.legacySeconds,engineeringSeconds:result.engineeringSeconds,deltaSeconds:result.deltaSeconds})).sort((a,b)=>Math.abs(b.deltaSeconds)-Math.abs(a.deltaSeconds)),unsupported=engineering.filter(result=>result.status==='unsupported').map(result=>({id:result.equipmentId,type:result.type,role:byId.get(result.equipmentId)?.equipmentRole||null}));
const report={file,sourceBytes:Buffer.byteLength(source),storedBytes:Buffer.byteLength(JSON.stringify(compact)),documentValidation,removedLegacyDemo,migrationApproval:{types:[...approvedTypes],equipmentCount:approvedEquipment.length},executionValidation,graph:{valid:graph.valid,errors:graph.errors,warnings:graph.warnings},roundTrip:{valid:roundTripGraph.valid,errors:roundTripGraph.errors,equipment:restored.equipment.length,derivedStations:restored.equipment.filter(item=>item.asrsStation).length,internalEdges:restored.cadSchematic?.edges?.filter(edge=>edge.asrsStationInternal).length||0},parameters:{kindCounts,unknownFields},engineering:{statusCounts,statusByType,largestReviews:review.slice(0,12),unsupported},simulation:engine?{seconds:engine.state.t,movedItems:engine.state.movedItems,completedProducts:engine.getKpis().completedCount,wip:engine.state.cadTokens.length,putaways:engine.state.asrs.putaways,retrievals:engine.state.asrs.retrievals,inventory:engine.state.asrs.inventory,outboundTrucks:engine.state.outboundTrucks,stall:engine.state.stall}:null};
console.log(JSON.stringify(report,null,2));
