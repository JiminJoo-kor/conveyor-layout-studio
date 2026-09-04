import { validateLayout } from './layout.js';
import { DeterministicReliability, KinematicMotion, kinematicTravelDuration, motionConfigFor } from './kinematics.js';
import { handoverProgress, OccupancyManager } from './occupancy.js';

const findEquipment = (layout, type) => layout.equipment.find(item => item.type === type);
const findAll = (layout, type) => layout.equipment.filter(item => item.type === type);
const nodeIndex = (line, role) => line.nodes.findIndex(node => node.role === role);
const nodeIndexById = (line, id) => line.nodes.findIndex(node => node.id === id);

export const defaultParams = {
  useA: true, useB: false, injectA: 30, injectB: 60, injectC: 20,
  conv2Speed: 5, conv1Speed: 5, pickTime: 2, placeTime: 2,
  station15Time: 60, station16Time: 60, forklift17Time: 30,
  forklift211Time: 30, simDuration: 600
};

const unitScale=units=>units==='mm'?.001:units==='cm'?.01:units==='m'?1:null;
export const equipmentLengthMeters=(item,layout)=>{const configured=Number(item?.parameters?.length),scale=unitScale(layout?.cadSource?.units);if(Number.isFinite(configured)&&configured>0)return item?.source?.origin==='dxf'&&scale&&item?.source?.parameterLengthUnit!=='m'?configured*scale:configured;if(item?.type==='conveyor')return 5;return Math.max(.1,Number(item?.length||item?.width||20)/20);};
export const equipmentSpeedMetersPerSecond=item=>{const p=item?.parameters||{},speed=Number(p.speed),lineSpeed=Number(p.lineSpeed);if(item?.type!=='processLine'&&Number.isFinite(speed)&&speed>0)return speed;if(Number.isFinite(lineSpeed)&&lineSpeed>0)return lineSpeed/60;if(Number.isFinite(speed)&&speed>0)return speed;return .5;};
export const cargoSpec=layout=>{const spec=layout?.cargoSpec||{},millimeters=spec.unit==='mm'||Number(spec.length)>20||Number(spec.width)>20,scale=millimeters ? .001 : 1;return{length:Math.max(.001,Number(spec.length||(millimeters?1200:1.2))*scale),width:Math.max(.001,Number(spec.width||(millimeters?800:.8))*scale),weight:Math.max(.01,Number(spec.weight||100)),unit:'m'};};
export const conveyorCargoCapacity=(item,layout)=>{const incoming=(layout?.cadSchematic?.edges||[]).filter(edge=>edge.to===item?.id).length;if(incoming>1)return 1;const length=equipmentLengthMeters(item,layout),cargoLength=cargoSpec(layout).length,gap=Math.max(0,Number(item?.parameters?.safetyGap)||0);return Math.max(1,Math.floor((length+gap)/(cargoLength+gap)));};
export const conveyorEntryPosition=()=>0;
export const acceleratedTravelTime=(distance,speed,acceleration)=>{const d=Math.max(0,Number(distance)||0),v=Math.max(.1,Number(speed)||.1),a=Math.max(.1,Number(acceleration)||.1),rampDistance=v*v/a;if(d<=rampDistance)return 2*Math.sqrt(d/a);return 2*v/a+(d-rampDistance)/v;};
export const asrsTargetCell=(item,slotIndex=0)=>{const p=item?.parameters||{},rows=Math.max(1,Math.round(Number(p.rows)||2)),columns=Math.max(1,Math.round(Number(p.columns)||8)),levels=Math.max(1,Math.round(Number(p.levels)||4)),index=Math.max(0,Math.min(rows*columns*levels-1,Math.round(Number(slotIndex)||0))),perColumn=rows*levels,column=Math.floor(index/perColumn),within=index%perColumn,level=Math.floor(within/rows),row=within%rows;return{index,column,level,row};};
export const asrsCycleProfile=(item,{slotIndex=0,operation='putaway'}={})=>{const p=item?.parameters||{},target=asrsTargetCell(item,slotIndex),horizontal=(target.column+1)*Math.max(.1,Number(p.columnPitch)||1.5),vertical=(target.level+1)*Math.max(.1,Number(p.levelHeight)||1.5),travel=acceleratedTravelTime(horizontal,p.travelSpeed||2.5,p.acceleration||.5),lift=acceleratedTravelTime(vertical,operation==='retrieval'?(p.downSpeed||p.liftSpeed||1):(p.liftSpeed||1),p.acceleration||.5),motion=Number(p.simultaneousMotion??1)?Math.max(travel,lift):travel+lift,fork=Math.max(0,Number(operation==='retrieval'?p.retrievalTime:p.putawayTime)||4),returnTime=Number(p.returnHome||0)?motion:0,total=Math.max(.2,motion+fork+returnTime);return{target,horizontal,vertical,travel,lift,motion,fork,returnTime,total};};
export const asrsCycleDuration=(item,context={})=>asrsCycleProfile(item,context).total;
export const asrsOperationSnapshot=(item,token,time)=>{if(!item||!token||!['putaway','retrieval'].includes(token.asrsPhase))return{status:'waiting',label:'대기중',detail:'작업 대기',progress:0,x:0,y:0};const operation=token.asrsPhase,profile=asrsCycleProfile(item,{slotIndex:token.asrsTarget?.index||0,operation}),elapsed=Math.max(0,Math.min(profile.total,Number(time)-Number(token.nodeEnteredAt||0))),motionProgress=Math.min(1,elapsed/Math.max(.001,profile.motion)),forkProgress=Math.min(1,Math.max(0,elapsed-profile.motion)/Math.max(.001,profile.fork)),returnProgress=Math.min(1,Math.max(0,elapsed-profile.motion-profile.fork)/Math.max(.001,profile.returnTime)),outbound=operation==='retrieval',returning=profile.returnTime>0&&elapsed>=profile.motion+profile.fork,position=returning?1-returnProgress:motionProgress,detail=elapsed<profile.motion?(outbound?'렉 위치로 이동':'적재 위치로 이동'):elapsed<profile.motion+profile.fork?(outbound?'렉에서 물품 인출':'렉에 물품 적재'):(outbound?'출고 인계점 복귀':'입고 인계점 복귀');return{status:outbound?'outbound':'inbound',label:outbound?'배출중':'입고중',detail,progress:elapsed/profile.total,x:position*(profile.target.column+1),y:position*(profile.target.level+1),target:profile.target,forkProgress};};
export const equipmentAvailabilityFactor=item=>{const p=item?.parameters||{},availability=Math.max(1,Math.min(100,Number(p.availability??100)))/100,efficiency=Math.max(1,Math.min(100,Number(p.efficiency??100)))/100;return availability*efficiency;};
export const canEquipmentHandleCargo=(item,layout)=>{const limit=Number(item?.parameters?.loadCapacity),weight=cargoSpec(layout).weight;return!Number.isFinite(limit)||limit<=0||weight<=limit;};
export const equipmentLoadSpeedFactor=(item,layout,occupancy=1)=>{const p=item?.parameters||{},performance=Math.max(.01,Math.min(1,Number(p.performance??(Number(p.efficiency??100)/100))||1)),limit=Math.max(.01,Number(p.loadCapacity)||Infinity),ratio=Number.isFinite(limit)?cargoSpec(layout).weight*Math.max(1,occupancy)/limit:0,derateStart=Math.max(0,Math.min(1,Number(p.loadDerateStart??.7))),minimum=Math.max(.05,Math.min(1,Number(p.minimumLoadedSpeed??.5))),loadFactor=item?.type==='conveyor'?(ratio<=1?1:minimum):ratio<=derateStart?1:Math.max(minimum,1-(ratio-derateStart)/(Math.max(.001,1-derateStart))*(1-minimum));return performance*loadFactor;};
export const cadDuration=(item,layout,context={})=>{
  const p=item?.parameters||{};let duration;
  if(['conveyor','processLine','sorter'].includes(item?.type)){const distance=equipmentLengthMeters(item,layout)+cargoSpec(layout).length;duration=kinematicTravelDuration(distance,motionConfigFor(item));}
  else if(['asrs','stackerCrane'].includes(item?.type))duration=asrsCycleDuration(item,context);
  else if(['agv','amr','shuttle'].includes(item?.type)){const cargoLength=cargoSpec(layout).length;duration=cargoLength/Math.max(.1,Number(p.receiveSpeed)||cargoLength/Math.max(.1,Number(p.loadTime)||2))+Number(p.shuttleDistance||5)/Math.max(.1,Number(p.travelSpeed||p.speed)||1.2)+cargoLength/Math.max(.1,Number(p.transferSpeed)||cargoLength/Math.max(.1,Number(p.unloadTime)||2));}
  else if(item?.type==='forklift')duration=Number(p.loadTime||8)+Number(p.unloadTime||8)+Number(p.travelDistance||5)/Math.max(.1,Number(p.speed||1.5));
  else if(item?.type==='lift')duration=Number(p.loadTime||2)+Number(p.unloadTime||2)+Number(p.liftHeight||3)/Math.max(.1,Number(p.liftSpeed||.5));
  else if(item?.type==='turntable')duration=Number(p.rotationTime||6);
  else if(item?.type==='handoffPoint')duration=Number(p.transferTime||2);
  else if(item?.type==='forkingDevice'){const stroke=Math.max(.01,Number(p.strokeDistance)||1.5),legacy=Math.max(.2,Number(p.forkTime)||4);duration=stroke/Math.max(.1,Number(p.receiveSpeed)||2*stroke/legacy)+Math.max(0,Number(p.holdTime)||0)+stroke/Math.max(.1,Number(p.transferSpeed)||2*stroke/legacy);}
  else duration=Number(p.cycleTime??p.processTime??p.dischargeTime??1);
  return Math.max(.2,duration/Math.max(.01,equipmentAvailabilityFactor(item)));
};
export class CadFlowEngine {
  constructor(layout,params={}){this.layout=layout;this.params={...defaultParams,...params};this.fixedDt=.02;this.accumulator=0;this.occupancy=new OccupancyManager();this.reliability=new Map();this.nodes=new Map(layout.equipment.filter(item=>item.source?.origin==='dxf'&&item.type!=='processLine').map(item=>[item.id,item]));this.edges=(layout.cadSchematic?.edges||[]).filter(edge=>this.nodes.has(edge.from)&&this.nodes.has(edge.to));this.outgoing=new Map();this.incoming=new Map();for(const edge of this.edges){if(!this.outgoing.has(edge.from))this.outgoing.set(edge.from,[]);this.outgoing.get(edge.from).push(edge);this.incoming.set(edge.to,(this.incoming.get(edge.to)||0)+1);}this.sources=[...this.nodes.values()].filter(node=>node.type==='source'||(!this.incoming.has(node.id)&&this.outgoing.has(node.id)));this.reset();}
  reset(){this.accumulator=0;this.occupancy.clear();this.reliability.clear();const storage=[...this.nodes.values()].find(node=>['asrs','stackerCrane'].includes(node.type)),p=storage?.parameters||{},levels=Math.max(1,Math.round(Number(p.levels)||4)),rows=Math.max(1,Math.round(Number(p.rows)||2)),columns=Math.max(1,Math.round(Number(p.columns)||8)),productTypes=Math.max(1,Math.round(Number(p.productTypes)||3)),cellCount=levels*rows*columns,capacity=cellCount*productTypes,branchNames=(this.layout.cadSchematic?.inboundBranches||[]).map(branch=>branch.name),defaultNames=['트림 라인','화이날 라인','도어 라인'],names=Array.from({length:productTypes},(_,index)=>branchNames[index]||defaultNames[index]||`품목 ${index+1}`),zones=Object.fromEntries(names.map(name=>[name,{inventory:0,capacity:cellCount,putaways:0,retrievals:0}])),outboundTrucks=Object.fromEntries([...this.nodes.values()].filter(node=>node.type==='dock'&&node.parameters?.dockRole==='outbound').map(node=>[node.id,{loaded:0,capacity:Math.max(1,Number(node.parameters?.truckCapacity||8)),departures:0,lastDeparture:0}]));this.state={t:0,cadTokens:[],nextId:1,nextInjection:0,completedProducts:[],events:[],movedItems:0,routeAccumulators:{},locks:{},robot:{phase:'idle'},source:[],product:[],outboundTrucks,asrs:{equipmentId:storage?.id,inventory:0,capacity,cellCount,levels,rows,columns,productTypes,zones,putaways:0,retrievals:0,busyTime:0}};return this.state;}
  reliabilityFor(item){if(!this.reliability.has(item.id))this.reliability.set(item.id,new DeterministicReliability([...item.id].reduce((sum,char)=>sum+char.charCodeAt(0),1)));return this.reliability.get(item.id);}
  createMotion(item,initialPosition=0,initial={}){const distance=['conveyor','processLine','sorter'].includes(item.type)?equipmentLengthMeters(item,this.layout)+cargoSpec(this.layout).length:['agv','amr','shuttle'].includes(item.type)?Math.max(.1,Number(item.parameters?.shuttleDistance)||5):0;return distance>0?{controller:new KinematicMotion(motionConfigFor(item),{...initial,position:Math.min(distance,Math.max(0,initialPosition))}),distance}:null;}
  advanceMotion(token,item,dt,blocked=false){if(!token.motion)return true;token.motion.controller.updateConfig(motionConfigFor(item));const reliability=this.state.equipmentReliability?.[item.id]||{available:true},occupancy=this.state.cadTokens.filter(other=>other!==token&&!other.edge&&other.nodeId===item.id).length+1,speedFactor=equipmentLoadSpeedFactor(item,this.layout,occupancy),next=(this.outgoing.get(item.id)||[]).length===1?this.nodes.get(this.outgoing.get(item.id)[0].to):null,continuous=item.type==='conveyor'&&item.parameters?.continuousHandover!==0&&next?.type==='conveyor',snapshot=token.motion.controller.step(dt,{distance:token.motion.distance,blocked:blocked||!reliability.available,speedFactor,stopAtEnd:!continuous||blocked});token.motionState=snapshot;token.progress=Math.min(1,snapshot.position/token.motion.distance);if(item.type==='conveyor'&&snapshot.position>=token.motion.distance&&token.conveyorExitAt==null){const delay=continuous?0:Math.max(0,Number(item.parameters?.handoverDelay)||0);token.conveyorExitAt=this.state.t;token.readyAt=this.state.t+delay;}return snapshot.position>=token.motion.distance;}
  startHandover(token,edge,current){const speed=equipmentSpeedMetersPerSecond(current),length=cargoSpec(this.layout).length;token.edge=edge;token.progress=0;token.handover={elapsed:0,duration:length/Math.max(.05,speed),sourceId:current.id,targetId:edge.to};}
  prepareToken(token){let edge=token.edge??null,readyAt=token.readyAt??0,nodeId=token.nodeId;Object.defineProperty(token,'nodeId',{enumerable:true,configurable:true,get:()=>nodeId,set:value=>{const previous=nodeId,previousItem=this.nodes.get(previous),previousMotion=token.motionState||token.motion?.controller.snapshot(),transfer=edge&&edge.to===value?{from:previous,to:value}:null;nodeId=value;if(transfer){this.emit('sensor-outfeed',{equipmentId:transfer.from,productId:token.id,transferTo:transfer.to});this.emit('sensor-infeed',{equipmentId:transfer.to,productId:token.id,transferFrom:transfer.from});}const item=this.nodes.get(value),enteredFromPrevious=token.handover?.targetId===value&&['conveyor','processLine','sorter'].includes(item?.type),entryPosition=enteredFromPrevious?conveyorEntryPosition(item,this.layout):0,continuous=previousItem?.type==='conveyor'&&previousItem.parameters?.continuousHandover!==0&&item?.type==='conveyor',initial=continuous?{velocity:previousMotion?.velocity||0,acceleration:previousMotion?.acceleration||0}:{};token.motion=item?this.createMotion(item,entryPosition,initial):null;token.motionState=token.motion?.controller.snapshot()||null;token.progress=token.motion?token.motionState.position/token.motion.distance:0;token.conveyorExitAt=null;token.visualEdge=null;}});Object.defineProperty(token,'edge',{enumerable:true,configurable:true,get:()=>edge,set:value=>{if(value){const source=this.nodes.get(token.nodeId),duration=cargoSpec(this.layout).length/Math.max(.05,equipmentSpeedMetersPerSecond(source));token.handover={sourceId:token.nodeId,targetId:value.to,edge:value,startedAt:this.state.t,endAt:this.state.t+duration,duration,visualOnly:true};}edge=value;}});Object.defineProperty(token,'readyAt',{enumerable:true,configurable:true,get:()=>readyAt,set:value=>{readyAt=value;}});return token;}
  emit(type,detail={}){this.state.events.push({t:this.state.t,type,...detail});}
  selectRoute(options,current,token){if(options.length<2)return 0;let fork=current?.type==='forkingDevice'?current:null,forkIndex=-1,primaryIndex=0;if(!fork){forkIndex=options.findIndex(edge=>this.nodes.get(edge.to)?.type==='forkingDevice');if(forkIndex<0)return token.flowIndex%options.length;fork=this.nodes.get(options[forkIndex].to);primaryIndex=options.findIndex((edge,index)=>index!==forkIndex&&this.nodes.get(edge.to)?.type!=='forkingDevice');if(primaryIndex<0)primaryIndex=options.findIndex((edge,index)=>index!==forkIndex);}else forkIndex=options.length>1?1:0;const flowKey=token.flowKey||`flow-${token.flowIndex||0}`,configuredFlows=fork.parameters?.distributionFlowKeys,enabled=fork.parameters?.distributionEnabled!==false,eligible=enabled&&(!Array.isArray(configuredFlows)||configuredFlows.length===0||configuredFlows.includes(flowKey));if(!eligible){this.emit('fork-bypassed',{equipmentId:fork.id,junctionId:current?.id,flowKey,route:'primary',reason:enabled?'flow-not-selected':'distribution-disabled'});return primaryIndex;}const ratio=Math.max(0,Math.min(100,Number(fork.parameters?.output1Ratio??50))),key=`${fork.id}:${flowKey}`,previous=this.state.routeAccumulators[key],accumulator=(previous===undefined?100-ratio:previous)+ratio,choosePrimary=accumulator>=100;this.state.routeAccumulators[key]=choosePrimary?accumulator-100:accumulator;const optionIndex=choosePrimary?primaryIndex:forkIndex;this.emit('fork-routed',{equipmentId:fork.id,junctionId:current?.id,flowKey,output:optionIndex+1,route:choosePrimary?'primary':'fork',ratio,sequence:'deterministic-per-flow'});return optionIndex;}
  preselectEntryFork(token,toNode){if(toNode?.type!=='conveyor')return null;const options=this.outgoing.get(toNode.id)||[],forkIndex=options.findIndex(edge=>this.nodes.get(edge.to)?.type==='forkingDevice');if(options.length<2||forkIndex<0)return null;const incomingPort=token.edge?.toPort,forkPort=options[forkIndex].fromPort;if(!incomingPort||!forkPort||incomingPort!==forkPort)return null;const optionIndex=this.selectRoute(options,toNode,token);return{options,optionIndex,forkIndex};}
  _integrateStep(dt){const s=this.state;if(!(dt>0)||s.t>=this.params.simDuration)return s;s.t+=Math.min(dt,this.params.simDuration-s.t);if(s.t>=s.nextInjection){for(const [flowIndex,source] of this.sources.entries()){const branch=(this.layout.cadSchematic?.inboundBranches||[]).find(item=>item.nodeIds?.includes(source.id)),operationDuration=cadDuration(source,this.layout);s.cadTokens.push(this.prepareToken({id:s.nextId++,nodeId:source.id,createdAt:s.t,nodeEnteredAt:s.t,operationDuration,readyAt:s.t+operationDuration,edge:null,progress:0,motion:this.createMotion(source),flowIndex,flowKey:branch?.name||Object.keys(s.asrs.zones)[flowIndex%Math.max(1,Object.keys(s.asrs.zones).length)]}));}s.nextInjection=s.t+Math.max(1,this.params.injectA||30);this.emit('source-injected',{equipmentId:this.sources.map(x=>x.id).join(',')});}
    for(const token of [...s.cadTokens]){if(token.nodeId===s.asrs.equipmentId&&!token.edge)s.asrs.busyTime+=dt;if(token.edge){const toNode=this.nodes.get(token.edge.to),zone=s.asrs.zones[token.flowKey],storage=['asrs','stackerCrane'].includes(toNode.type),exclusive=['agv','amr','turntable'].includes(toNode.type),capacity=storage?Math.max(1,Math.round(Number(toNode.parameters?.stackerCount)||s.asrs.productTypes||1)):toNode.type==='conveyor'?conveyorCargoCapacity(toNode,this.layout):Infinity,occupancy=s.cadTokens.filter(other=>other!==token&&!other.edge&&other.nodeId===toNode.id).length;if(!canEquipmentHandleCargo(toNode,this.layout)){if(token.blockedBy!==toNode.id)this.emit('cargo-overload',{equipmentId:toNode.id,productId:token.id,weight:cargoSpec(this.layout).weight,limit:Number(toNode.parameters?.loadCapacity)});token.blockedBy=toNode.id;continue;}token.blockedBy=null;if((exclusive&&occupancy>0)||occupancy>=capacity)continue;if(toNode.id===s.asrs.equipmentId&&(!zone||zone.inventory>=zone.capacity))continue;const entryFork=this.preselectEntryFork(token,toNode);if(entryFork&&entryFork.optionIndex===entryFork.forkIndex){token.nodeId=toNode.id;token.edge=entryFork.options[entryFork.optionIndex];token.progress=1;s.movedItems++;continue;}if(entryFork)token.preselectedRoute={nodeId:toNode.id,optionIndex:entryFork.optionIndex};const slotIndex=toNode.id===s.asrs.equipmentId?Math.max(0,zone?.inventory||0):0,operationDuration=cadDuration(toNode,this.layout,{slotIndex,operation:'putaway'});token.nodeId=toNode.id;token.edge=null;token.progress=0;token.nodeEnteredAt=s.t;token.operationDuration=operationDuration;token.readyAt=s.t+operationDuration;s.movedItems++;if(toNode.id===s.asrs.equipmentId){token.asrsPhase='putaway';token.asrsTarget=asrsTargetCell(toNode,slotIndex);s.asrs.inventory=Math.min(s.asrs.capacity,s.asrs.inventory+1);s.asrs.putaways++;if(zone){zone.inventory++;zone.putaways++;}this.emit('asrs-putaway',{equipmentId:toNode.id,zone:token.flowKey,target:token.asrsTarget,duration:operationDuration});}this.emit('equipment-start',{equipmentId:toNode.id});}else if(s.t>=token.readyAt&&(!token.motion||token.progress>=1)){const options=this.outgoing.get(token.nodeId)||[];if(options.length){if(token.nodeId===s.asrs.equipmentId&&token.asrsPhase==='putaway'){const storageNode=this.nodes.get(token.nodeId),zone=s.asrs.zones[token.flowKey];if(!zone||zone.inventory<=0)continue;const slotIndex=Math.max(0,zone.inventory-1),duration=cadDuration(storageNode,this.layout,{slotIndex,operation:'retrieval'});token.asrsPhase='retrieval';token.asrsTarget=asrsTargetCell(storageNode,slotIndex);token.nodeEnteredAt=s.t;token.operationDuration=duration;token.readyAt=s.t+duration;this.emit('asrs-retrieval-start',{equipmentId:token.nodeId,zone:token.flowKey,target:token.asrsTarget,duration});continue;}if(token.nodeId===s.asrs.equipmentId){const zone=s.asrs.zones[token.flowKey];if(!zone||zone.inventory<=0)continue;s.asrs.inventory=Math.max(0,s.asrs.inventory-1);s.asrs.retrievals++;if(zone){zone.inventory=Math.max(0,zone.inventory-1);zone.retrievals++;}this.emit('asrs-retrieval',{equipmentId:token.nodeId,zone:token.flowKey,target:token.asrsTarget});}const current=this.nodes.get(token.nodeId),preselected=token.preselectedRoute?.nodeId===token.nodeId?token.preselectedRoute:null,optionIndex=preselected?preselected.optionIndex:this.selectRoute(options,current,token);token.preselectedRoute=null;token.edge=options[optionIndex];token.progress=1;}else{const truck=s.outboundTrucks?.[token.nodeId];if(truck){truck.loaded++;if(truck.loaded>=truck.capacity){truck.departures++;truck.loaded=0;truck.lastDeparture=s.t;this.emit('truck-departed',{equipmentId:token.nodeId,departures:truck.departures});}}s.completedProducts.push({id:token.id,cycleTime:s.t-token.createdAt});s.cadTokens.splice(s.cadTokens.indexOf(token),1);this.emit('equipment-complete',{equipmentId:token.nodeId,productId:token.id});}}}return s;}
  step(dt){if(!(dt>0))return this.state;this.accumulator+=Math.min(.5,dt);while(this.accumulator+1e-12>=this.fixedDt&&this.state.t<this.params.simDuration){for(const item of this.nodes.values()){const status=this.reliabilityFor(item).step(this.fixedDt,item.parameters);this.state.equipmentReliability??={};this.state.equipmentReliability[item.id]=status;if(!status.available)for(const token of this.state.cadTokens)if(token.nodeId===item.id&&!token.edge)token.readyAt+=this.fixedDt;}this.updateActiveMotions(this.fixedDt);this.applyOccupancyInterlocks(this.fixedDt);this._integrateStep(this.fixedDt);this.resolveZeroDelayHandovers();this.accumulator-=this.fixedDt;}return this.state;}
  tryDirectHandover(token){const s=this.state,edge=token.edge,toNode=this.nodes.get(edge?.to);if(!edge||!toNode)return false;const zone=s.asrs.zones[token.flowKey],storage=['asrs','stackerCrane'].includes(toNode.type),exclusive=['agv','amr','turntable'].includes(toNode.type),capacity=storage?Math.max(1,Math.round(Number(toNode.parameters?.stackerCount)||s.asrs.productTypes||1)):toNode.type==='conveyor'?conveyorCargoCapacity(toNode,this.layout):Infinity,occupancy=s.cadTokens.filter(other=>other!==token&&!other.edge&&other.nodeId===toNode.id).length;if(!canEquipmentHandleCargo(toNode,this.layout)){if(token.blockedBy!==toNode.id)this.emit('cargo-overload',{equipmentId:toNode.id,productId:token.id,weight:cargoSpec(this.layout).weight,limit:Number(toNode.parameters?.loadCapacity)});token.blockedBy=toNode.id;return false;}token.blockedBy=null;if((exclusive&&occupancy>0)||occupancy>=capacity)return false;if(toNode.id===s.asrs.equipmentId&&(!zone||zone.inventory>=zone.capacity))return false;const entryFork=this.preselectEntryFork(token,toNode);if(entryFork&&entryFork.optionIndex===entryFork.forkIndex){token.nodeId=toNode.id;token.edge=entryFork.options[entryFork.optionIndex];token.progress=1;s.movedItems++;return true;}if(entryFork)token.preselectedRoute={nodeId:toNode.id,optionIndex:entryFork.optionIndex};const slotIndex=toNode.id===s.asrs.equipmentId?Math.max(0,zone?.inventory||0):0,operationDuration=cadDuration(toNode,this.layout,{slotIndex,operation:'putaway'});token.nodeId=toNode.id;token.edge=null;token.progress=token.motion?token.progress:0;token.nodeEnteredAt=s.t;token.operationDuration=operationDuration;token.readyAt=s.t+operationDuration;s.movedItems++;if(toNode.id===s.asrs.equipmentId){token.asrsPhase='putaway';token.asrsTarget=asrsTargetCell(toNode,slotIndex);s.asrs.inventory=Math.min(s.asrs.capacity,s.asrs.inventory+1);s.asrs.putaways++;if(zone){zone.inventory++;zone.putaways++;}this.emit('asrs-putaway',{equipmentId:toNode.id,zone:token.flowKey,target:token.asrsTarget,duration:operationDuration});}this.emit('equipment-start',{equipmentId:toNode.id});return true;}
  resolveZeroDelayHandovers(){let changed=true,guard=this.nodes.size+1;while(changed&&guard-->0){changed=false;for(const token of this.state.cadTokens)if(token.edge&&this.tryDirectHandover(token))changed=true;}}
  hotReloadEquipment(item){const active=this.state.cadTokens.filter(token=>token.nodeId===item.id&&!token.edge);for(const token of active){const elapsed=Math.max(0,this.state.t-token.nodeEnteredAt),oldDuration=Math.max(.001,token.operationDuration||1),fraction=Math.max(0,Math.min(1,elapsed/oldDuration)),newDuration=cadDuration(item,this.layout);token.operationDuration=newDuration;token.nodeEnteredAt=this.state.t-fraction*newDuration;token.readyAt=token.nodeEnteredAt+newDuration;if(token.motion)token.motion.controller.updateConfig(motionConfigFor(item));}return active.length;}
  applyOccupancyInterlocks(dt){this.occupancy.clear();const cargo=cargoSpec(this.layout);for(const item of this.nodes.values()){if(!['conveyor','processLine','sorter'].includes(item.type))continue;const length=equipmentLengthMeters(item,this.layout),gap=Math.max(0,Number(item.parameters?.safetyGap)||0),tokens=this.state.cadTokens.filter(token=>token.nodeId===item.id&&!token.edge).sort((a,b)=>(b.progress||0)-(a.progress||0));for(const token of tokens){const center=Math.max(cargo.length/2,Math.min(length-cargo.length/2,(token.progress||0)*length));if(this.occupancy.canOccupy(token.id,item.id,center,cargo.length,gap)){this.occupancy.reserve(token.id,item.id,center,cargo.length,gap);token.queueState=null;}else{token.readyAt+=dt;token.queueState='Queue';token.motionState={...(token.motionState||{}),state:'Stopping'};}}}}
  updateActiveMotions(dt){for(const token of this.state.cadTokens){if(token.edge||!token.motion)continue;const item=this.nodes.get(token.nodeId);if(item)this.advanceMotion(token,item,dt,token.queueState==='Queue');}}
  getKpis(){const completed=this.state.completedProducts,elapsed=Math.max(this.state.t,1),cycleTime=completed.length?completed.reduce((sum,item)=>sum+item.cycleTime,0)/completed.length:0,asrs=this.state.asrs;return{mode:'cad',throughput:completed.length/elapsed*3600,cycleTime,wip:this.state.cadTokens.length,bottleneck:asrs?.busyTime/elapsed>.8?['asrs',asrs.busyTime/elapsed]:null,movedItems:this.state.movedItems,utilization:{robot:0,asrs:asrs?.busyTime/elapsed||0},asrs:{...asrs,occupancy:asrs?asrs.inventory/asrs.capacity:0}};}
}

export function validateParams(params) {
  const errors = [];
  const positive = ['injectA','injectB','injectC','conv2Speed','conv1Speed','forklift17Time','forklift211Time','simDuration'];
  const nonNegative = ['pickTime','placeTime','station15Time','station16Time'];
  for (const key of positive) if (!Number.isFinite(params[key]) || params[key] <= 0) errors.push(`${key}는 0보다 커야 합니다.`);
  for (const key of nonNegative) if (!Number.isFinite(params[key]) || params[key] < 0) errors.push(`${key}는 0 이상이어야 합니다.`);
  if (!params.useA && !params.useB) errors.push('A 또는 B 트레이를 하나 이상 사용해야 합니다.');
  return { valid: errors.length === 0, errors };
}

export class SimulationEngine {
  constructor(layout, params = {}) {
    const layoutCheck = validateLayout(layout);
    if (!layoutCheck.valid) throw new Error(layoutCheck.errors.join(' '));
    this.layout = layout;
    this.params = { ...defaultParams, ...params };
    const paramCheck = validateParams(this.params);
    if (!paramCheck.valid) throw new Error(paramCheck.errors.join(' '));
    const lines = layout.equipment.filter(item => item.type === 'conveyor');
    this.sourceLine = lines.find(line => line.trayKinds.includes('A'));
    this.productLine = lines.find(line => line.trayKinds.includes('C'));
    this.robotConfig = findEquipment(layout, 'robot');
    this.stations = findAll(layout, 'station');
    this.forklifts = findAll(layout, 'forklift');
    this.reset();
  }

  reset() {
    const p = this.params;
    this.state = {
      t: 0, source: Array(this.sourceLine.nodes.length).fill(null), product: Array(this.productLine.nodes.length).fill(null),
      nextA: 0, nextB: 0, nextC: 0, nextSourceKind: 'A', nextId: 1,
      sourceTick: p.conv2Speed, productTick: p.conv1Speed,
      robot: { phase: 'idle', until: 0, sourceId: null, productId: null, isLast: false },
      locks: {}, metrics: { robotBusy: 0, station15Busy: 0, station16Busy: 0, forklift17Busy: 0, forklift211Busy: 0 },
      events: [], completedSources: [], completedProducts: [], productArrivals: 0, movedItems: 0
    };
    return this.state;
  }

  emit(type, detail = {}) { this.state.events.push({ t: this.state.t, type, ...detail }); }
  makeSource(kind) { return { id: this.state.nextId++, kind, items: kind === 'A' ? 4 : 1, capacity: kind === 'A' ? 4 : 1 }; }
  makeProduct() { return { id: this.state.nextId++, kind: 'C', items: 0, capacity: 8 }; }

  step(dt) {
    const s = this.state, p = this.params;
    if (!(dt > 0) || s.t >= p.simDuration) return s;
    dt = Math.min(dt, p.simDuration - s.t);
    if (s.robot.phase !== 'idle') s.metrics.robotBusy += dt;
    for (const [id, lock] of Object.entries(s.locks)) if (lock) {
      const metric = id === 'station-15' ? 'station15Busy' : id === 'station-16' ? 'station16Busy' : id === 'forklift-17' ? 'forklift17Busy' : 'forklift211Busy';
      s.metrics[metric] += dt;
    }
    s.t += dt;
    this.inject();
    this.moveSourceLine();
    this.moveProductLine();
    this.releaseLocks();
    this.runRobot();
    return s;
  }

  runUntil(seconds, dt = 0.05) {
    const end = Math.min(seconds, this.params.simDuration);
    while (this.state.t + 1e-9 < end) this.step(Math.min(dt, end - this.state.t));
    return this.state;
  }

  inject() {
    const s = this.state, p = this.params;
    const entry = nodeIndex(this.sourceLine, 'source-entry');
    if (!s.source[entry]) {
      const dueA = p.useA && s.t >= s.nextA, dueB = p.useB && s.t >= s.nextB;
      const kind = dueA && dueB ? s.nextSourceKind : dueA ? 'A' : dueB ? 'B' : null;
      if (kind) {
        const tray = this.makeSource(kind); s.source[entry] = tray;
        if (kind === 'A') { s.nextA = s.t + p.injectA; s.nextSourceKind = 'B'; }
        else { s.nextB = s.t + p.injectB; s.nextSourceKind = 'A'; }
        this.emit('source-injected', { trayId: tray.id, kind });
      }
    }
    const productEntry = nodeIndex(this.productLine, 'product-entry');
    if (!s.product[productEntry] && s.t >= s.nextC) {
      const tray = this.makeProduct(); s.product[productEntry] = tray; s.nextC = s.t + p.injectC;
      this.emit('product-injected', { trayId: tray.id });
    }
  }

  moveSourceLine() {
    const s = this.state, p = this.params;
    if (s.t < s.sourceTick) return;
    const pick = nodeIndex(this.sourceLine, 'robot-pick');
    for (let i = 0; i < s.source.length - 1; i++) {
      const tray = s.source[i + 1];
      if (s.source[i] || !tray || (i + 1 === pick && tray.items > 0)) continue;
      if (i === 0 && s.locks['forklift-211']) continue;
      s.source[i] = tray; s.source[i + 1] = null;
      if (i === 0) this.startLock('forklift-211', tray, p.forklift211Time);
    }
    s.sourceTick = s.t + p.conv2Speed;
  }

  moveProductLine() {
    const s = this.state, p = this.params;
    if (s.t < s.productTick) return;
    const place = nodeIndex(this.productLine, 'robot-place');
    for (let i = 0; i < s.product.length - 1; i++) {
      const tray = s.product[i + 1];
      if (s.product[i] || !tray || (i + 1 === place && tray.items < tray.capacity)) continue;
      const nodeId = this.productLine.nodes[i].id;
      const equipment = [...this.stations, ...this.forklifts].find(item => item.nodeId === nodeId);
      if (equipment && s.locks[equipment.id]) continue;
      s.product[i] = tray; s.product[i + 1] = null;
      if (equipment) {
        const duration = p[equipment.durationParam];
        this.startLock(equipment.id, tray, duration);
        if (equipment.id === 'forklift-17') s.productArrivals++;
      }
    }
    s.productTick = s.t + p.conv1Speed;
  }

  startLock(id, tray, duration) {
    this.state.locks[id] = { trayId: tray.id, until: this.state.t + duration };
    this.emit('equipment-start', { equipmentId: id, trayId: tray.id });
  }

  releaseLocks() {
    const s = this.state;
    for (const [id, lock] of Object.entries(s.locks)) {
      if (!lock || s.t < lock.until) continue;
      const config = [...this.stations, ...this.forklifts].find(item => item.id === id);
      if (config?.type === 'forklift') {
        const line = config.nodeId.startsWith('2-') ? this.sourceLine : this.productLine;
        const slots = line === this.sourceLine ? s.source : s.product;
        const index = nodeIndexById(line, config.nodeId);
        const tray = slots[index]; slots[index] = null;
        if (line === this.productLine && tray) s.completedProducts.push({ id: tray.id, completedAt: s.t });
      }
      this.emit('equipment-complete', { equipmentId: id, trayId: lock.trayId });
      s.locks[id] = null;
    }
  }

  runRobot() {
    const s = this.state, p = this.params;
    const pick = nodeIndexById(this.sourceLine, this.robotConfig.pickNode);
    const place = nodeIndexById(this.productLine, this.robotConfig.placeNode);
    const src = s.source[pick], dst = s.product[place];
    if (s.robot.phase === 'idle' && src?.items > 0 && dst && dst.items < dst.capacity) {
      s.robot = { phase: 'pick', until: s.t + p.pickTime, sourceId: src.id, productId: dst.id, isLast: src.items === 1 };
      this.emit('robot-pick-start', { trayId: src.id });
    }
    if (s.robot.phase === 'pick' && s.t >= s.robot.until) {
      const current = s.source[pick]; if (current?.id === s.robot.sourceId) current.items--;
      s.robot.phase = 'place'; s.robot.until = s.t + p.placeTime;
    }
    if (s.robot.phase === 'place' && s.t >= s.robot.until) {
      const currentDst = s.product[place];
      if (currentDst?.id === s.robot.productId) { currentDst.items++; s.movedItems++; }
      const sourceId = s.robot.sourceId, wasLast = s.robot.isLast;
      s.robot = { phase: 'idle', until: 0, sourceId: null, productId: null, isLast: false };
      this.emit('robot-place-complete', { trayId: sourceId, productId: currentDst?.id });
      if (wasLast) {
        s.completedSources.push({ id: sourceId, completedAt: s.t });
        s.sourceTick = s.t;
      }
      if (currentDst?.items >= currentDst?.capacity) s.productTick = s.t;
    }
  }

  getKpis() {
    const s = this.state, elapsed = Math.max(s.t, 0.001);
    const utilization = {
      robot: s.metrics.robotBusy / elapsed,
      station15: s.metrics.station15Busy / elapsed,
      station16: s.metrics.station16Busy / elapsed,
      forklift17: s.metrics.forklift17Busy / elapsed,
      forklift211: s.metrics.forklift211Busy / elapsed
    };
    const bottleneck = Object.entries(utilization).sort((a, b) => b[1] - a[1])[0];
    return {
      throughput: s.productArrivals / elapsed * 3600,
      wip: s.source.filter(Boolean).length + s.product.filter(Boolean).length,
      movedItems: s.movedItems, utilization,
      bottleneck: bottleneck[1] > 0 ? bottleneck : null
    };
  }
}
