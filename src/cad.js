import { createCanvasTransform, parseDxf, transformDxfGeometry } from './dxf.js';

export const logisticsEquipmentCatalog = [
  { type:'source', label:'투입구', keywords:['INFEED','INPUT','SOURCE','FEEDER','투입'], defaults:{ injectionInterval:30, batchSize:1 } },
  { type:'sink', label:'배출구', keywords:['OUTFEED','OUTPUT','DISCHARGE','EXIT','배출'], defaults:{ dischargeTime:5, capacity:1 } },
  { type:'conveyor', label:'컨베이어', keywords:['CONV','CONVEYOR','CV','BELT','ROLLER'], defaults:{ speed:0.5, capacity:1 } },
  { type:'diverter', label:'디버터', keywords:['DIV','DIVERTER','MERGE','SORT GATE'], defaults:{ cycleTime:1.5, directions:2 } },
  { type:'shuttle', label:'셔틀', keywords:['SHUTTLE','STK','STACKER','MINILOAD'], defaults:{ speed:2, acceleration:1 } },
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
  levels:'층수',rows:'행',columns:'열',pickTime:'PICK(초)',placeTime:'PLACE(초)',processTime:'처리시간(초)',operators:'작업자 수',length:'길이'
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
  return (cadDocument.entities||[]).map((entity,index)=>{
    const match=classifyCadEntity(entity),center=entity.center||{x:0,y:0};
    const width=Math.abs((entity.bounds?.maxX??center.x)-(entity.bounds?.minX??center.x));
    const height=Math.abs((entity.bounds?.maxY??center.y)-(entity.bounds?.minY??center.y));
    const lineRotation=entity.start&&entity.end?Math.atan2(entity.end.y-entity.start.y,entity.end.x-entity.start.x)*180/Math.PI:null;
    return { id:`${match.type}-candidate-${index+1}`,type:match.type,name:entity.blockName||entity.text||match.label,
      x:center.x,y:center.y,rotation:lineRotation??entity.rotation??0,width,height,length:Math.hypot(width,height),confidence:match.confidence,parameters:match.parameters,
      source:{ origin:'dxf',handle:entity.handle,layer:entity.layer,blockName:entity.blockName,entityType:entity.entityType },reviewStatus:'candidate' };
  });
}

export async function analyzeCadFile(file) {
  const extension=file.name.split('.').pop().toLowerCase();
  if(extension==='dwg')throw new Error('DWG를 AutoCAD 2013 ASCII DXF로 저장한 뒤 업로드해 주세요.');
  if(extension!=='dxf')throw new Error('ASCII DXF 파일만 지원합니다.');
  const document=parseDxf(await file.text()),bounds=document.bounds||{minX:0,maxX:1,minY:0,maxY:1},aspect=Math.max(.36,Math.min(.72,(bounds.maxY-bounds.minY)/Math.max(1,bounds.maxX-bounds.minX))),canvasHeight=Math.round(1200*aspect),transform=createCanvasTransform(document,1200,canvasHeight),importId=`dxf-${Date.now()}`;
  const candidates=buildLayoutCandidates(document).map(item=>({...item,id:`${item.id}-${importId}`,x:Math.round(item.x*transform.scale+transform.offsetX),y:Math.round(-item.y*transform.scale+transform.offsetY),width:Math.max(8,Math.round(item.width*transform.scale)),height:Math.max(8,Math.round(item.height*transform.scale)),length:Math.max(16,Math.round(item.length*transform.scale)),source:{...item.source,importId}}));
  return { document:{...document,canvasHeight,toCanvasTransform:transform,canvasGeometry:transformDxfGeometry(document,transform)},candidates };
}
