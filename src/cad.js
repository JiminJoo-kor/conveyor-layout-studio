import { createCanvasTransform, isLogisticsDxfEntity, parseDxf, transformDxfGeometry } from './dxf.js';

export const logisticsEquipmentCatalog = [
  { type:'source', label:'투입구', keywords:['INFEED','INPUT','SOURCE','FEEDER','투입'], defaults:{ injectionInterval:30, batchSize:1 } },
  { type:'sink', label:'배출구', keywords:['OUTFEED','OUTPUT','DISCHARGE','EXIT','배출'], defaults:{ dischargeTime:5, capacity:1 } },
  { type:'conveyor', label:'컨베이어', keywords:['CONV','CONVEYOR','CV','BELT','ROLLER'], defaults:{ speed:0.5, capacity:1 } },
  { type:'processLine', label:'공정 라인', keywords:['DOOR LINE','FINAL LINE','TRIM LINE','도어 라인','화이날 라인','트림 라인'], defaults:{ lineSpeed:20, pitch:5, bufferCapacity:1 } },
  { type:'diverter', label:'디버터', keywords:['DIV','DIVERTER','MERGE','SORT GATE'], defaults:{ cycleTime:1.5, directions:2 } },
  { type:'stackerCrane', label:'스태커 크레인', keywords:['STACKER CRANE','STACKER','STK','RACK MASTER','ASRS CRANE','S/C','스태커','스테커','크레인'], defaults:{ travelSpeed:2.5, liftSpeed:1, acceleration:0.5, loadCapacity:1000, levels:1 } },
  { type:'shuttle', label:'셔틀', keywords:['SHUTTLE','MINILOAD'], defaults:{ speed:2, acceleration:1 } },
  { type:'agv', label:'AGV', keywords:['AGV','GUIDED VEHICLE'], defaults:{ speed:1.2, chargeThreshold:20 } },
  { type:'amr', label:'AMR', keywords:['AMR','MOBILE ROBOT'], defaults:{ speed:1.5, chargeThreshold:20 } },
  { type:'sorter', label:'소터', keywords:['SORTER','CROSSBELT','SHOE SORTER'], defaults:{ speed:1.8, destinations:2 } },
  { type:'lift', label:'리프트', keywords:['LIFT','ELEVATOR','VRC','HOIST'], defaults:{ cycleTime:15, levels:2 } },
  { type:'asrs', label:'자동창고', keywords:['ASRS','AS/RS','RACK','STORAGE'], defaults:{ rows:1, columns:1, levels:1 } },
  { type:'robot', label:'로봇', keywords:['ROBOT','ARM','PALLETIZER','DEPALLETIZER'], defaults:{ pickTime:2, placeTime:2 } },
  { type:'station', label:'작업 스테이션', keywords:['STATION','WORKCELL','INSPECTION','PACKING'], defaults:{ processTime:30, operators:1 } },
  { type:'buffer', label:'버퍼', keywords:['BUFFER','QUEUE','ACCUMULATION'], defaults:{ capacity:4 } },
  { type:'dock', label:'도크', keywords:['DOCK','INBOUND','OUTBOUND','TRUCK'], defaults:{ processTime:300 } }
];

export const equipmentParameterLabels = {
  injectionInterval:'투입 간격(초)',batchSize:'1회 투입 수량',dischargeTime:'배출 시간(초)',speed:'속도',capacity:'용량',
  cycleTime:'사이클타임(초)',directions:'분기 수',acceleration:'가속도',chargeThreshold:'충전 기준(%)',destinations:'목적지 수',
  levels:'층수',rows:'행',columns:'열',pickTime:'PICK(초)',placeTime:'PLACE(초)',processTime:'처리시간(초)',operators:'작업자 수',length:'길이',
  travelSpeed:'주행 속도(m/s)',liftSpeed:'승강 속도(m/s)',loadCapacity:'적재 하중(kg)',lineSpeed:'라인 속도(m/min)',pitch:'차체 피치(m)',bufferCapacity:'라인 버퍼 수'
};

export function parameterFieldsFor(item){return Object.entries(item.parameters||{}).map(([key,value])=>({key,label:equipmentParameterLabels[key]||key,value}));}

const normalized = value => String(value || '').toUpperCase().replace(/[_-]+/g,' ');

export function classifyCadEntity(entity) {
  const haystack = normalized([entity.layer,entity.blockName,entity.text,entity.name].join(' '));
  const scored = logisticsEquipmentCatalog.map(rule => ({
    rule,
    score: rule.keywords.reduce((sum,keyword)=>sum+(haystack.includes(keyword)?1:0),0)
  })).sort((a,b)=>b.score-a.score);
  const winner=scored[0];
  if(!winner?.score)return { type:'unknown', label:'미분류 설비', confidence:0.15, parameters:{} };
  return { type:winner.rule.type,label:winner.rule.label,confidence:Math.min(.98,.55+winner.score*.18),parameters:inferParameters(winner.rule,entity) };
}

export function inferParameters(rule, entity) {
  const width=Math.abs(entity.bounds?.maxX-entity.bounds?.minX)||0;
  const height=Math.abs(entity.bounds?.maxY-entity.bounds?.minY)||0;
  const length=Math.max(width,height);
  return { ...rule.defaults, ...(length?{ length:Number(length.toFixed(2)) }:{}), ...(entity.attributes||{}) };
}

export function buildLayoutCandidates(cadDocument) {
  return (cadDocument.entities||[]).map((entity,rootIndex)=>({entity,rootIndex})).map(({entity,rootIndex},index)=>{
    const match=classifyCadEntity(entity),center=entity.center||{x:0,y:0};
    const width=Math.abs((entity.bounds?.maxX??center.x)-(entity.bounds?.minX??center.x));
    const height=Math.abs((entity.bounds?.maxY??center.y)-(entity.bounds?.minY??center.y));
    const lineRotation=entity.start&&entity.end?Math.atan2(entity.end.y-entity.start.y,entity.end.x-entity.start.x)*180/Math.PI:null,shapeRotation=entity.entityType==='INSERT'?(height>width?90:0):entity.rotation??0;
    return { id:`${match.type}-candidate-${index+1}`,type:match.type,name:entity.blockName||entity.text||match.label,
      x:center.x,y:center.y,rotation:lineRotation??shapeRotation,width,height,length:lineRotation===null?Math.max(width,height):Math.hypot(width,height),confidence:match.confidence,parameters:match.parameters,
      source:{ origin:'dxf',handle:entity.handle,layer:entity.layer,blockName:entity.blockName,entityType:entity.entityType,rootIndex },reviewStatus:'candidate' };
  });
}

export function detectProcessRegion(document){
  const anchors=(document.entities||[]).filter(entity=>['TEXT','MTEXT'].includes(entity.entityType)&&/(도어 라인|화이날 라인|트림 라인|DOOR LINE|FINAL LINE|TRIM LINE)/i.test(entity.text||''));
  if(anchors.length<3)return null;const xs=anchors.map(x=>x.center.x),ys=anchors.map(x=>x.center.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  return {minX:minX-80000,maxX:maxX+80000,minY:minY-30000,maxY:maxY+30000};
}
const inside=(point,bounds)=>point&&point.x>=bounds.minX&&point.x<=bounds.maxX&&point.y>=bounds.minY&&point.y<=bounds.maxY;

export function buildSchematicLayout(candidates){
  const nodes=candidates.filter(item=>item.type!=='unknown'&&Number.isFinite(item.x)&&Number.isFinite(item.y));
  const labels=nodes.filter(item=>item.type==='processLine'),storage=nodes.filter(item=>['stackerCrane','asrs'].includes(item.type));
  const bridgeTypes=new Set(['robot','shuttle','amr','agv','diverter']),bridges=nodes.filter(item=>bridgeTypes.has(item.type));
  const flowNodes=nodes.filter(item=>item.type!=='processLine'&&!storage.includes(item)&&!bridges.includes(item)),lanes=[];
  if(labels.length>=2){for(const label of [...labels].sort((a,b)=>a.y-b.y))lanes.push({id:`lane-${lanes.length+1}`,name:label.name,y:label.y,nodes:[]});for(const node of flowNodes){const lane=[...lanes].sort((a,b)=>Math.abs(a.y-node.y)-Math.abs(b.y-node.y))[0];lane.nodes.push(node);}}
  else for(const node of [...flowNodes].sort((a,b)=>a.y-b.y||a.x-b.x)){let lane=lanes.find(group=>Math.abs(group.y-node.y)<=48);if(!lane){lane={id:`lane-${lanes.length+1}`,y:node.y,nodes:[]};lanes.push(lane);}lane.nodes.push(node);lane.y=lane.nodes.reduce((sum,item)=>sum+item.y,0)/lane.nodes.length;}
  const warehouse=storage.sort((a,b)=>(b.confidence||0)-(a.confidence||0))[0],edges=[],usedBridges=new Set(),inferredEquipment=[];
  lanes.forEach((lane,index)=>{
    lane.name=lane.name||`${index+1}번 라인`;const source=lane.nodes.find(item=>item.type==='source'),sink=lane.nodes.find(item=>['sink','dock'].includes(item.type));
    lane.direction=source?'inbound':sink?'outbound':warehouse?'warehouse-outbound':'inferred';
    const meanX=lane.nodes.reduce((sum,node)=>sum+node.x,0)/Math.max(1,lane.nodes.length),ascending=source?source.x<=(warehouse?.x??Infinity):sink?sink.x>=(warehouse?.x??-Infinity):warehouse?warehouse.x<meanX:true;
    lane.nodes.sort((a,b)=>(ascending?1:-1)*(a.x-b.x));
    if(source){lane.nodes.splice(lane.nodes.indexOf(source),1);lane.nodes.unshift(source);}if(sink){lane.nodes.splice(lane.nodes.indexOf(sink),1);lane.nodes.push(sink);}
    let laneHasBridge=false;
    for(let i=1;i<lane.nodes.length;i++){const from=lane.nodes[i-1],to=lane.nodes[i],minX=Math.min(from.x,to.x),maxX=Math.max(from.x,to.x),bridge=bridges.filter(item=>!usedBridges.has(item.id)&&item.x>=minX&&item.x<=maxX).sort((a,b)=>Math.abs(a.y-lane.y)-Math.abs(b.y-lane.y))[0];if(bridge&&Math.abs(bridge.y-lane.y)<180){edges.push({from:from.id,to:bridge.id,kind:'transfer'},{from:bridge.id,to:to.id,kind:'transfer'});usedBridges.add(bridge.id);laneHasBridge=true;}else edges.push({from:from.id,to:to.id,kind:'flow'});}
    if(warehouse&&lane.nodes.length){const endpoint=[lane.nodes[0],lane.nodes.at(-1)].sort((a,b)=>Math.hypot(a.x-warehouse.x,a.y-warehouse.y)-Math.hypot(b.x-warehouse.x,b.y-warehouse.y))[0],warehouseGap=Math.hypot(endpoint.x-warehouse.x,endpoint.y-warehouse.y),normalGaps=lane.nodes.slice(1).map((node,i)=>Math.hypot(node.x-lane.nodes[i].x,node.y-lane.nodes[i].y)).sort((a,b)=>a-b),typicalGap=normalGaps[Math.floor(normalGaps.length/2)]||80;
      if(!laneHasBridge&&(labels.length>=2||warehouseGap>Math.max(180,typicalGap*1.8))){const agv={id:`inferred-agv-${lane.id}`,type:'agv',name:`${lane.name} AGV`,x:(endpoint.x+warehouse.x)/2,y:(endpoint.y+warehouse.y)/2,width:48,height:48,confidence:.72,parameters:{speed:1.2,chargeThreshold:20},source:{origin:'dxf',inferred:true,reason:'warehouse-gap'},reviewStatus:'candidate'};inferredEquipment.push(agv);if(lane.direction==='inbound')edges.push({from:endpoint.id,to:agv.id,kind:'transfer'},{from:agv.id,to:warehouse.id,kind:'warehouse'});else edges.push({from:warehouse.id,to:agv.id,kind:'warehouse'},{from:agv.id,to:endpoint.id,kind:'transfer'});}
      else edges.push(lane.direction==='inbound'?{from:endpoint.id,to:warehouse.id,kind:'warehouse'}:{from:warehouse.id,to:endpoint.id,kind:'warehouse'});}
  });
  for(const bridge of bridges.filter(item=>!usedBridges.has(item.id))){const nearby=[...flowNodes].sort((a,b)=>Math.hypot(bridge.x-a.x,bridge.y-a.y)-Math.hypot(bridge.x-b.x,bridge.y-b.y)).slice(0,2);if(nearby.length===2)edges.push({from:nearby[0].id,to:bridge.id,kind:'transfer'},{from:bridge.id,to:nearby[1].id,kind:'transfer'});}
  return {lanes:labels.length>=2?lanes:lanes.filter(lane=>lane.nodes.length>1),edges,warehouseId:warehouse?.id,inferredEquipment};
}

const canonicalProcessLine=name=>/도어|DOOR/i.test(name)?'도어 라인':/화이날|FINAL/i.test(name)?'화이날 라인':/트림|TRIM/i.test(name)?'트림 라인':name;
export function dedupeProcessLineCandidates(candidates){
  const others=candidates.filter(item=>item.type!=='processLine'),best=new Map();for(const item of candidates.filter(x=>x.type==='processLine')){const key=canonicalProcessLine(item.name),current=best.get(key);if(!current||item.x>current.x)best.set(key,{...item,name:key});}return [...others,...best.values()];
}

export function normalizeSchematicPositions(candidates,schematic,width=1200){
  const laneGap=Math.max(105,Math.min(155,620/Math.max(1,schematic.lanes.length))),positionById=new Map();
  schematic.lanes.forEach((lane,laneIndex)=>{const count=lane.nodes.length,gap=count>1?Math.min(130,(width-300)/(count-1)):0;lane.nodes.forEach((node,index)=>positionById.set(node.id,{x:80+index*gap,y:90+laneIndex*laneGap}));});
  if(schematic.warehouseId)positionById.set(schematic.warehouseId,{x:width-105,y:90+(schematic.lanes.length-1)*laneGap/2});
  for(const bridge of candidates.filter(item=>['agv','amr','robot','shuttle','diverter'].includes(item.type))){if(positionById.has(bridge.id))continue;const incoming=schematic.edges.find(item=>item.to===bridge.id),outgoing=schematic.edges.find(item=>item.from===bridge.id),from=positionById.get(incoming?.from),to=positionById.get(outgoing?.to);if(from&&to)positionById.set(bridge.id,{x:(from.x+to.x)/2,y:(from.y+to.y)/2});}
  candidates.filter(item=>!positionById.has(item.id)).forEach((item,index)=>positionById.set(item.id,{x:80+(index%9)*125,y:90+(schematic.lanes.length+Math.floor(index/9))*laneGap}));
  return candidates.map(item=>{const normalizedPosition=positionById.get(item.id)||{x:item.x,y:item.y};return {...item,originalPosition:{x:item.x,y:item.y},normalizedPosition,...normalizedPosition};});
}

export function selectPrimaryLayoutCluster(candidates){
  const recognized=candidates.filter(item=>item.type!=='unknown');if(recognized.length<2)return recognized;
  const nearest=recognized.map((item,index)=>Math.min(...recognized.map((other,j)=>j===index?Infinity:Math.hypot(item.x-other.x,item.y-other.y)))).filter(Number.isFinite).sort((a,b)=>a-b);
  const median=nearest[Math.floor(nearest.length/2)]||50000,threshold=Math.max(15000,Math.min(180000,median*3.5)),unseen=new Set(recognized),groups=[];
  while(unseen.size){const seed=unseen.values().next().value,group=[],queue=[seed];unseen.delete(seed);while(queue.length){const item=queue.shift();group.push(item);for(const other of [...unseen])if(Math.hypot(item.x-other.x,item.y-other.y)<=threshold){unseen.delete(other);queue.push(other);}}groups.push(group);}
  const score=group=>group.length+group.filter(x=>x.type==='conveyor').length*5+new Set(group.map(x=>x.type)).size*2;
  return groups.sort((a,b)=>score(b)-score(a))[0];
}

export async function analyzeCadFile(file) {
  const extension=file.name.split('.').pop().toLowerCase();
  if(extension==='dwg')throw new Error('DWG를 AutoCAD 2013 ASCII DXF로 저장한 뒤 업로드해 주세요.');
  if(extension!=='dxf')throw new Error('ASCII DXF 파일만 지원합니다.');
  const document=parseDxf(await file.text()),allCandidates=buildLayoutCandidates(document),processRegion=detectProcessRegion(document),cluster=dedupeProcessLineCandidates(processRegion?allCandidates.filter(item=>item.type!=='unknown'&&inside({x:item.x,y:item.y},processRegion)):selectPrimaryLayoutCluster(allCandidates)),points=cluster.flatMap(item=>[{x:item.x-item.width/2,y:item.y-item.height/2},{x:item.x+item.width/2,y:item.y+item.height/2}]);
  if(processRegion)document.bounds=processRegion;else if(points.length){document.bounds={minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};}
  const bounds=document.bounds||{minX:0,maxX:1,minY:0,maxY:1},aspect=Math.max(.36,Math.min(.72,(bounds.maxY-bounds.minY)/Math.max(1,bounds.maxX-bounds.minX))),canvasHeight=Math.round(1200*aspect),transform=createCanvasTransform(document,1200,canvasHeight),importId=`dxf-${Date.now()}`;
  let candidates=cluster.map(item=>({...item,id:`${item.id}-${importId}`,x:Math.round(item.x*transform.scale+transform.offsetX),y:Math.round(-item.y*transform.scale+transform.offsetY),width:Math.max(36,Math.min(110,Math.round(item.width*transform.scale))),height:Math.max(32,Math.min(70,Math.round(item.height*transform.scale))),length:Math.max(70,Math.min(110,Math.round(item.length*transform.scale))),rotation:0,source:{...item.source,importId}}));
  const roots=processRegion?(document.entities||[]).map((entity,rootIndex)=>({entity,rootIndex})).filter(({entity})=>inside(entity.center,processRegion)).map(x=>x.rootIndex):cluster.map(item=>item.source.rootIndex),fullGeometry=transformDxfGeometry(document,transform,roots,Boolean(processRegion)),stride=Math.max(1,Math.ceil(fullGeometry.length/9000)),canvasGeometry=fullGeometry.filter((_,index)=>index%stride===0);
  const schematic=buildSchematicLayout(candidates);candidates=[...candidates,...(schematic.inferredEquipment||[])];candidates=normalizeSchematicPositions(candidates,schematic,1200);schematic.lanes.forEach(lane=>lane.nodes=lane.nodes.map(node=>candidates.find(item=>item.id===node.id)||node));
  return { document:{...document,canvasHeight:Math.max(canvasHeight,520,90+(schematic.lanes.length+2)*130),toCanvasTransform:transform,canvasGeometry},candidates,schematic };
}
