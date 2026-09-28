import {isStackEquipment} from './equipment-variants.js';
import {createStackMachine,canStackMachineReceive,receiveStack,advanceStackMachine,startStackRelease,completeStackRelease,stackMachineStatus} from './stack-machine.js';

export function stackState(engine,item){
 const machines=engine.state.stackMachines??={};
 if(!machines[item.id]){const p=item.parameters||{};machines[item.id]=createStackMachine({mode:item.equipmentRole==='boxDestacker'?'unstack':'stack',targetCount:Number(p.stackTarget??1),liftSeconds:Number(p.stackLiftTime??1),lowerSeconds:Number(p.stackLowerTime??1),maxWeight:Number(p.loadCapacity??1000),maxHeight:Number(p.stackMaxHeight??10)});}
 return machines[item.id];
}
export function cargoLayers(engine,token,spec){
 if(token.stackLayers?.length)return token.stackLayers;
 const source=engine.nodes.get(token.nodeId),count=Math.max(1,Math.floor(Number(source?.parameters?.initialStackCount)||1));
 const dimensions=spec(engine.layout);
 token.stackLayers=Array.from({length:count},(_,i)=>({id:`${token.id}:${i}`,kind:token.cargoType||token.flowKey||'empty-box',empty:source?.parameters?.emptyBox!==0,length:dimensions.length,width:dimensions.width,height:Number(source?.parameters?.boxHeight??.2),weight:dimensions.weight,createdAt:token.createdAt,cargoOrientation:token.cargoOrientation,flowKey:token.flowKey,flowIndex:token.flowIndex,originFlowKey:token.originFlowKey||token.flowKey,cargoPatternKey:token.cargoPatternKey}));
 return token.stackLayers;
}

// Extensions sit at the shared engine's boundaries: they never move cargo across an edge.
export function installStackRuntime(Engine,{cargoSpec,equipmentLengthMeters,cargoLengthOnEquipment}){
 const p=Engine.prototype,prepare=p.prepareToken;
 const planned=p.plannedEdgeForToken;
 p.plannedEdgeForToken=function(token,item,...args){if(isStackEquipment(item)&&token.stackOutputFor!==item.id){token.predictiveRouteEdge=null;return null;}return planned.call(this,token,item,...args);};
 const kpis=p.getKpis;
 p.getKpis=function(){const result=kpis.call(this);if(!this.layout.equipment.some(isStackEquipment))return result;const ids=new Set();for(const token of this.state.cadTokens)for(const layer of token.stackLayers||[{id:token.id}])ids.add(layer.id);for(const m of Object.values(this.state.stackMachines||{}))for(const layer of [...m.held,...m.deck])ids.add(layer.id);result.wip=ids.size;result.completedBoxes=this.state.completedProducts.reduce((n,t)=>n+(t.stackLayers?.length||1),0);return result;};
 const diagnostic=p.flowDiagnosticText;
 p.flowDiagnosticText=function(){let text=diagnostic.call(this);if(this.state.stackMachines)text+='\r\n\r\n=== 적재·분배 상태 (보유 박스 포함) ===\r\n'+Object.entries(this.state.stackMachines).map(([id,m])=>`${id} | ${m.phase} | 보유 ${m.held.length} | 바닥 ${m.deck.length} | 배출 ${m.outgoing.length} | 스토퍼 ${m.stopperUp?'상승':'하강'} | 잔여 ${stackMachineStatus(m).remainingPercent.toFixed(1)}%`).join('\r\n');for(const w of Object.values(this.state.warehouses))if(w.sequenceSchedules)text+='\r\n=== 독립 출고 서열 ===\r\n'+Object.entries(w.sequenceSchedules).map(([key,s])=>`${w.equipmentId}/${key} | 다음 주기 ${s.nextDue}초 | 작업 ${s.active?.productIds.join(',')||'-'} | 인계 ${s.active?.completedIds.join(',')||'-'}`).join('\r\n');return text;};
 const outfeedBlocked=p.conveyorOutfeedWillBlock;
 p.conveyorOutfeedWillBlock=function(item,...args){if(isStackEquipment(item)&&['waiting','holding'].includes(stackState(this,item).phase))return false;return outfeedBlocked.call(this,item,...args);};
 p.prepareToken=function(token){const result=prepare.call(this,token);if(this.layout.equipment.some(isStackEquipment))cargoLayers(this,result,cargoSpec);return result;};
 const accept=p.canAcceptNode;
 p.canAcceptNode=function(item,token,edge){
  if(isStackEquipment(item)){
   if(equipmentLengthMeters(item,this.layout)+1e-9<cargoLengthOnEquipment(item,this.layout,token))return false;
   const machine=stackState(this,item),resident=this.state.cadTokens.some(t=>t!==token&&t.nodeId===item.id);
   if(resident||!['waiting','holding'].includes(machine.phase))return false;
   if(token&&!canStackMachineReceive(machine,cargoLayers(this,token,cargoSpec)).allowed)return false;
  }
  if(token?.stackLayers?.length&&Number(item?.parameters?.loadCapacity)>0&&token.stackLayers.reduce((n,l)=>n+l.weight,0)>Number(item.parameters.loadCapacity))return false;
  return accept.call(this,item,token,edge);
 };
 const motion=p.advanceMotion;
 p.advanceMotion=function(token,item,dt,blocked){
  if(isStackEquipment(item)&&token.stackOutputFor!==item.id){token.motionLimit=Math.min(token.motionLimit??Infinity,equipmentLengthMeters(item,this.layout));}
  if(isStackEquipment(item)&&token.stackOutputFor===item.id&&stackState(this,item).phase==='ready')blocked=true;
  return motion.call(this,token,item,dt,blocked);
 };
 const handover=p.tryDirectHandover;
 p.tryDirectHandover=function(token,...args){const item=this.nodes.get(token.nodeId);if(isStackEquipment(item)&&(token.stackOutputFor!==item.id||stackState(this,item).phase!=='releasing'))return false;return handover.call(this,token,...args);};
 const update=p.updateActiveMotions;
 p.updateActiveMotions=function(dt){
  update.call(this,dt);
  for(const item of this.nodes.values()){
   if(!isStackEquipment(item))continue;
   const machine=stackState(this,item),available=this.state.equipmentReliability?.[item.id]?.available!==false;
   advanceStackMachine(machine,dt,{available});
   if(machine.phase==='releasing'){
    const output=this.state.cadTokens.find(t=>t.id===machine.releaseToken);
    if(!output||output.nodeId!==item.id&&output.incomingHandover?.sourceId!==item.id){
     completeStackRelease(machine,{reservationId:machine.releaseToken,tailCleared:true,downstreamAccepted:true});machine.outputId=null;
     this.emit('stack-release-complete',{equipmentId:item.id,count:machine.completedBoxes});
    }
   }
   const token=this.state.cadTokens.find(t=>t.nodeId===item.id&&t.stackOutputFor!==item.id);
   if(available&&token&&!token.incomingHandover&&Number(token.motionState?.position)>=equipmentLengthMeters(item,this.layout)-1e-8){
    const check=canStackMachineReceive(machine,cargoLayers(this,token,cargoSpec));
    if(check.allowed){receiveStack(machine,token.stackLayers);machine.template={flowKey:token.flowKey,flowIndex:token.flowIndex,cargoType:token.cargoType,createdAt:token.createdAt,cargoOrientation:token.cargoOrientation};this.state.cadTokens.splice(this.state.cadTokens.indexOf(token),1);this.emit('stack-received',{equipmentId:item.id,productId:token.id,count:token.stackLayers.length});}
    else {token.blockedBy=check.reason;token.readyAt=Infinity;}
   }
   if(machine.phase==='ready'){
    let output=this.state.cadTokens.find(t=>t.id===machine.outputId);
    if(!output){const bottom=machine.deck[0];output=this.prepareToken({...machine.template,flowKey:bottom.flowKey??machine.template.flowKey,flowIndex:bottom.flowIndex??machine.template.flowIndex,originFlowKey:bottom.originFlowKey,cargoPatternKey:bottom.cargoPatternKey,createdAt:Math.min(...machine.deck.map(l=>l.createdAt??this.state.t)),id:this.state.nextId++,nodeId:item.id,stackOutputFor:item.id,stackLayers:structuredClone(machine.deck),nodeEnteredAt:this.state.t,readyAt:this.state.t,progress:0,edge:null});output.motion=this.createMotion(item,equipmentLengthMeters(item,this.layout),{},output);output.motionState=output.motion.controller.snapshot();machine.outputId=output.id;this.state.cadTokens.push(output);}
    const options=this.outgoing.get(item.id)||[],index=this.previewRouteIndex(options,item,output),edge=options[index];
    if(available&&edge&&this.canAcceptNode(this.nodes.get(edge.to),output,edge)&&!this.hasOpposingTransfer(edge,output)){
     startStackRelease(machine,{reservationId:output.id,downstreamApproved:true,beltPermit:true});
    }
   }
   machine.status=stackMachineStatus(machine);
  }
 };
}
