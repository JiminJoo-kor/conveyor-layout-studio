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
  const nodes=candidates.filter(item=>item.type!=='unknown'&&Number.isFinite(item.x)&&Number.isFinite(item.y)),lanes=[];
  for(const node of [...nodes].sort((a,b)=>a.y-b.y||a.x-b.x)){let lane=lanes.find(group=>Math.abs(group.y-node.y)<=64);if(!lane){lane={id:`lane-${lanes.length+1}`,y:node.y,nodes:[]};lanes.push(lane);}lane.nodes.push(node);lane.y=lane.nodes.reduce((sum,item)=>sum+item.y,0)/lane.nodes.length;}
  lanes.forEach((lane,index)=>{lane.name=lane.nodes.find(item=>item.type==='processLine')?.name||`${index+1}번 라인`;lane.nodes.sort((a,b)=>a.x-b.x);});
  const edges=[];for(const lane of lanes)for(let index=1;index<lane.nodes.length;index++)edges.push({from:lane.nodes[index-1].id,to:lane.nodes[index].id,kind:'flow'});
  const transfers=nodes.filter(item=>['robot','stackerCrane','shuttle','amr','agv','diverter'].includes(item.type));
  for(const transfer of transfers){const nearby=nodes.filter(item=>item.id!==transfer.id&&!transfers.includes(item)).sort((a,b)=>Math.hypot(transfer.x-a.x,transfer.y-a.y)-Math.hypot(transfer.x-b.x,transfer.y-b.y)).slice(0,2);for(const target of nearby)if(Math.hypot(transfer.x-target.x,transfer.y-target.y)<420)edges.push({from:transfer.id,to:target.id,kind:'transfer'});}
  return {lanes:lanes.filter(lane=>lane.nodes.length>1),edges};
}

export function normalizeSchematicPositions(candidates,schematic,width=1200){
  const laneGap=Math.max(105,Math.min(155,620/Math.max(1,schematic.lanes.length))),positionById=new Map();
  schematic.lanes.forEach((lane,laneIndex)=>{const count=lane.nodes.length,gap=count>1?Math.min(130,(width-160)/(count-1)):0;lane.nodes.forEach((node,index)=>positionById.set(node.id,{x:80+index*gap,y:90+laneIndex*laneGap}));});
  candidates.filter(item=>!positionById.has(item.id)).forEach((item,index)=>positionById.set(item.id,{x:80+(index%9)*125,y:90+(schematic.lanes.length+Math.floor(index/9))*laneGap}));
  return candidates.map(item=>({...item,originalPosition:{x:item.x,y:item.y},...(positionById.get(item.id)||{})}));
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
  const document=parseDxf(await file.text()),allCandidates=buildLayoutCandidates(document),processRegion=detectProcessRegion(document),cluster=processRegion?allCandidates.filter(item=>item.type!=='unknown'&&inside({x:item.x,y:item.y},processRegion)):selectPrimaryLayoutCluster(allCandidates),points=cluster.flatMap(item=>[{x:item.x-item.width/2,y:item.y-item.height/2},{x:item.x+item.width/2,y:item.y+item.height/2}]);
  if(processRegion)document.bounds=processRegion;else if(points.length){document.bounds={minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};}
  const bounds=document.bounds||{minX:0,maxX:1,minY:0,maxY:1},aspect=Math.max(.36,Math.min(.72,(bounds.maxY-bounds.minY)/Math.max(1,bounds.maxX-bounds.minX))),canvasHeight=Math.round(1200*aspect),transform=createCanvasTransform(document,1200,canvasHeight),importId=`dxf-${Date.now()}`;
  let candidates=cluster.map(item=>({...item,id:`${item.id}-${importId}`,x:Math.round(item.x*transform.scale+transform.offsetX),y:Math.round(-item.y*transform.scale+transform.offsetY),width:Math.max(36,Math.min(110,Math.round(item.width*transform.scale))),height:Math.max(32,Math.min(70,Math.round(item.height*transform.scale))),length:Math.max(70,Math.min(110,Math.round(item.length*transform.scale))),rotation:0,source:{...item.source,importId}}));
  const roots=processRegion?(document.entities||[]).map((entity,rootIndex)=>({entity,rootIndex})).filter(({entity})=>inside(entity.center,processRegion)).map(x=>x.rootIndex):cluster.map(item=>item.source.rootIndex),fullGeometry=transformDxfGeometry(document,transform,roots,Boolean(processRegion)),stride=Math.max(1,Math.ceil(fullGeometry.length/9000)),canvasGeometry=fullGeometry.filter((_,index)=>index%stride===0);
  const schematic=buildSchematicLayout(candidates);candidates=normalizeSchematicPositions(candidates,schematic,1200);schematic.lanes.forEach(lane=>lane.nodes=lane.nodes.map(node=>candidates.find(item=>item.id===node.id)||node));
  return { document:{...document,canvasHeight:Math.max(520,90+(schematic.lanes.length+2)*130),toCanvasTransform:transform,canvasGeometry},candidates,schematic };
}
