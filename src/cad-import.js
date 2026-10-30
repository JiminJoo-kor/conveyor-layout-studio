import {emptyDrawingError} from './cad-diagnostics.js';
import {parseDxf,createCanvasTransform,transformDxfGeometry} from './dxf.js';
import {classifyCadEntity,logisticsEquipmentCatalog} from './cad.js';
import {equipmentFlowPorts} from './route.js';

export const cadUnitScale={mm:.001,cm:.01,m:1,inch:.0254,foot:.3048};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const pointsOf=e=>e.vertices?.length?e.vertices:e.start&&e.end?[e.start,e.end]:e.bounds?[{x:e.bounds.minX,y:e.bounds.minY},{x:e.bounds.maxX,y:e.bounds.maxY}]:[];

export function measureCadEntity(entity,parts=[],units){
  const scale=cadUnitScale[units],shapes=entity.entityType==='INSERT'?parts:[entity],points=shapes.flatMap(pointsOf);
  let angle=(entity.rotation||0)*Math.PI/180;
  if(entity.start&&entity.end)angle=Math.atan2(entity.end.y-entity.start.y,entity.end.x-entity.start.x);
  else if(entity.vertices?.length>1){let longest=0;for(let i=1;i<entity.vertices.length;i++){const a=entity.vertices[i-1],b=entity.vertices[i],d=distance(a,b);if(d>longest){longest=d;angle=Math.atan2(b.y-a.y,b.x-a.x);}}}
  const projectionAngle=angle,projected=points.map(p=>({x:p.x*Math.cos(angle)+p.y*Math.sin(angle),y:-p.x*Math.sin(angle)+p.y*Math.cos(angle)}));
  let loX=Infinity,hiX=-Infinity,loY=Infinity,hiY=-Infinity;
  for(const p of projected){loX=Math.min(loX,p.x);hiX=Math.max(hiX,p.x);loY=Math.min(loY,p.y);hiY=Math.max(hiY,p.y);}
  let length=projected.length?hiX-loX:0,width=projected.length?hiY-loY:0;
  let basis='외곽 투영 치수',review=false;
  if(entity.entityType==='LINE'){length=distance(entity.start,entity.end);width=0;basis='직선 좌표';}
  if(entity.vertices?.length&&!entity.closed){length=0;for(let i=1;i<entity.vertices.length;i++)length+=distance(entity.vertices[i-1],entity.vertices[i]);basis='열린 폴리선 경로 (중심선인지 확인 필요)';review=true;}
  if(entity.radius){length=width=2*entity.radius;basis='원 지름';if(entity.entityType==='ARC'){let sweep=(entity.endAngle-entity.startAngle+360)%360;length=entity.radius*sweep*Math.PI/180;width=0;basis='호 길이 (중심선인지 확인 필요)';review=true;}}
  if(width>length&&entity.closed){[length,width]=[width,length];angle+=Math.PI/2;}
  if(entity.entityType==='INSERT'&&shapes.some(e=>['ARC','CIRCLE','ELLIPSE','SPLINE','INSERT'].includes(e.entityType))){review=true;basis+=' · 곡선/미전개 블록 확인';}
  if(entity.hasBulge||shapes.some(e=>e.hasBulge)){review=true;length=0;basis='곡선 폴리선: 자동 치수 확정 불가';}
  if(!length||!scale)review=true;
  const mid=projected.length?{x:(loX+hiX)/2,y:(loY+hiY)/2}:null;
  return {length:scale&&length>0?length*scale:null,width:scale&&width>0?width*scale:null,rawLength:length,rawWidth:width,rotation:angle*180/Math.PI,basis,review:review||!scale,units,center:mid?{x:mid.x*Math.cos(projectionAngle)-mid.y*Math.sin(projectionAngle),y:mid.x*Math.sin(projectionAngle)+mid.y*Math.cos(projectionAngle)}:entity.center};
}

export function cadPatternKey(entity,measurement){
  const ratio=measurement.rawWidth>0?measurement.rawLength/measurement.rawWidth:0;
  return JSON.stringify([entity.entityType,String(entity.blockName||'').trim().toUpperCase(),String(entity.layer||'').trim().toUpperCase(),Math.round(ratio*20)/20]);
}
export function rememberCadPattern(patterns,item,type){
  if(!item.source?.patternKey||!logisticsEquipmentCatalog.some(r=>r.type===type))throw Error('저장할 설비 종류를 선택하세요.');
  return [...patterns.filter(p=>p.key!==item.source.patternKey),{key:item.source.patternKey,type,confirmedAt:new Date().toISOString()}].slice(-500);
}
export function applyCadType(item,type){
  const rule=logisticsEquipmentCatalog.find(r=>r.type===type);if(!rule)throw Error('설비 종류를 확인하세요.');
  item.type=type;item.parameters={...rule.defaults};
  const m=item.source.measurement;
  if(m?.length>0&&!m.review){item.parameters.length=m.length;if(m.width>0)item.parameters.width=m.width;}
  item.source.parameterLengthUnit='m';
  item.source.dimensionReviewRequired=!m?.length||m.review;
  return item;
}

export function validateCadConnections(candidates,edges=[]){
  const nodes=new Map(candidates.map(c=>[c.id,c])),issues=[],seen=new Set(),linked=new Set();
  for(const edge of edges){const a=nodes.get(edge.from),b=nodes.get(edge.to),key=`${edge.from}:${edge.fromPort}>${edge.to}:${edge.toPort}`;
    if(!a||!b){issues.push({kind:'missing',message:'연결 대상 설비 누락',edge});continue;}
    if(a===b)issues.push({kind:'self',message:'동일 설비 자기 연결',edge});
    if(seen.has(key))issues.push({kind:'duplicate',message:'중복 연결',edge});seen.add(key);
    if(edge.fromPort!==equipmentFlowPorts(a).output||edge.toPort!==equipmentFlowPorts(b).input)issues.push({kind:'direction',message:'설정된 진행축 입출구와 다른 연결: 방향 확인',edge});
    linked.add(a.id);linked.add(b.id);
  }
  for(const item of candidates)if(!linked.has(item.id))issues.push({kind:'isolated',id:item.id,message:`미연결 설비: ${item.name}`});
  for(const item of candidates.filter(e=>e.type==='conveyor'&&linked.has(e.id))){
    if(!edges.some(e=>e.to===item.id))issues.push({kind:'open-input',id:item.id,message:`입구 연결 없음: ${item.name}`});
    if(!edges.some(e=>e.from===item.id))issues.push({kind:'open-output',id:item.id,message:`출구 연결 없음: ${item.name}`});
  }
  return issues;
}

export function proposeCadConnections(items,tolerance=.05){
  // Spatial buckets avoid comparing every drawing entity against every other one.
  const buckets=new Map(),ends=[],size=Math.max(.001,tolerance);
  for(const item of items){const m=item.source.measurement;if(item.type!=='conveyor'||!m?.length||m.review)continue;
    const a=m.rotation*Math.PI/180,c=item.source.cadPosition,s=cadUnitScale[m.units];
    for(const [port,sign] of [['left',-1],['right',1]]){const p={id:item.id,port,x:c.x*s+Math.cos(a)*m.length/2*sign,y:c.y*s+Math.sin(a)*m.length/2*sign,angle:a};ends.push(p);const key=`${Math.floor(p.x/size)},${Math.floor(p.y/size)}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p);}
  }
  const proposals=[],seen=new Set();
  for(const a of ends)for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const b of buckets.get(`${Math.floor(a.x/size)+dx},${Math.floor(a.y/size)+dy}`)||[]){
    if(a.id===b.id||distance(a,b)>size||Math.abs(Math.sin(a.angle-b.angle))>.1)continue;
    const key=[`${a.id}.${a.port}`,`${b.id}.${b.port}`].sort().join('|');if(seen.has(key))continue;seen.add(key);
    const reverse=a.port==='left'&&b.port==='right',from=reverse?b:a,to=reverse?a:b;
    proposals.push({from:from.id,to:to.id,fromPort:from.port,toPort:to.port,kind:'flow',gap:distance(a,b),reviewRequired:true});
  }
  return proposals;
}
export function confirmCadConnection(items,edge){
  for(const [id,port,incoming] of [[edge.from,edge.fromPort,false],[edge.to,edge.toPort,true]]){
    const item=items.find(e=>e.id===id);if(!item)throw Error('연결 대상 설비가 없습니다.');
    if(item.type!=='conveyor')continue;
    const angle=((Number(item.rotation)||0)+({right:0,bottom:90,left:180,top:270}[port]||0)+(incoming?180:0))*Math.PI/180;
    item.parameters.flowDirection=Math.abs(Math.cos(angle))>=Math.abs(Math.sin(angle))?(Math.cos(angle)>0?'right':'left'):(Math.sin(angle)>0?'down':'up');
  }
  return {...edge,reviewRequired:false,confirmed:true};
}

export function analyzeCadText(text,{unitOverride,patterns=[],onProgress=()=>{}}={}){
  onProgress({stage:'CAD 구조·블록 전개',done:null});
  const document=parseDxf(text);if(!document.entities.length)throw emptyDrawingError(text);
  const units=unitOverride||document.units,parts=new Map();for(const e of document.expandedEntities){if(!parts.has(e.rootIndex))parts.set(e.rootIndex,[]);parts.get(e.rootIndex).push(e);}
  const patternMap=new Map(patterns.map(p=>[p.key,p])),candidates=[],importId=`dxf-${Date.now()}`;
  for(let index=0;index<document.entities.length;index++){
    const entity=document.entities[index];
    if(['INSERT','LINE','LWPOLYLINE','POLYLINE','CIRCLE','ARC'].includes(entity.entityType)){
      const m=measureCadEntity(entity,parts.get(index)||[],units),match=classifyCadEntity(entity),key=cadPatternKey(entity,m),remembered=patternMap.get(key),type=remembered?.type||match.type;
      // Unnamed linework remains raw geometry; unknown blocks/closed outlines stay reviewable.
      if(type!=='unknown'||entity.entityType==='INSERT'||entity.closed){
        const item={id:`cad-${index}-${importId}`,name:entity.blockName||entity.text||`${entity.layer} ${index+1}`,type,confidence:remembered?1:match.confidence,rotation:-m.rotation,x:m.center?.x||0,y:m.center?.y||0,width:78,height:28,parameters:{},reviewStatus:'candidate',source:{origin:'dxf',importId,rootIndex:index,layer:entity.layer,blockName:entity.blockName,entityType:entity.entityType,patternKey:key,patternMatched:Boolean(remembered),measurement:m,cadPosition:m.center||entity.center,parameterLengthUnit:'m'}};
        if(type!=='unknown')applyCadType(item,type);candidates.push(item);
      }
    }
    if(index%250===0||index===document.entities.length-1)onProgress({stage:'치수·설비 후보 분석',done:index+1,total:document.entities.length});
  }
  onProgress({stage:'연결점 검증',done:null});const proposals=proposeCadConnections(candidates),issues=validateCadConnections(candidates);
  if(document.expandedEntities.length>=100000)for(const item of candidates){item.source.measurement.review=true;item.source.dimensionReviewRequired=true;}
  const allBounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(const e of document.entities)for(const p of pointsOf(e)){allBounds.minX=Math.min(allBounds.minX,p.x);allBounds.minY=Math.min(allBounds.minY,p.y);allBounds.maxX=Math.max(allBounds.maxX,p.x);allBounds.maxY=Math.max(allBounds.maxY,p.y);}
  if(Number.isFinite(allBounds.minX))document.bounds=allBounds;
  const transform=createCanvasTransform(document,1200,650),canvasGeometry=transformDxfGeometry(document,transform,null,true,true);
  for(const item of candidates){const p=item.source.cadPosition;item.x=p.x*transform.scale+transform.offsetX;item.y=-p.y*transform.scale+transform.offsetY;}
  onProgress({stage:'검수 화면 준비',done:1,total:1});
  return {document:{units,canvasHeight:650,canvasGeometry,toCanvasTransform:transform},candidates,schematic:{lanes:[],inboundBranches:[],edges:[]},review:{proposals,issues,unitConfirmed:Boolean(cadUnitScale[units]),warnings:[...(!cadUnitScale[units]?['도면 단위 불명: 단위를 확인한 뒤 다시 분석하세요.']:[]),...(document.expandedEntities.length>=100000?['블록 전개 한도 도달: 도면을 분할하여 확인하세요.']:[]),'접근한 끝점은 연결 후보일 뿐입니다. 방향·분기·누락은 승인 전에 확인하세요.']}};
}
