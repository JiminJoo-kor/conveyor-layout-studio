const number = value => Number.parseFloat(value) || 0;
const pointFrom = data => ({ x:number(data[10]), y:number(data[20]), z:number(data[30]) });

function pairs(text) {
  const lines=text.replace(/\r/g,'').split('\n'),result=[];
  for(let i=0;i+1<lines.length;i+=2)result.push({code:Number(lines[i].trim()),value:lines[i+1].trim()});
  return result;
}

function collectEntity(type, data, vertices=[]) {
  const common={entityType:type,handle:data[5],layer:data[8]||'0',color:data[62],lineType:data[6],rotation:number(data[50])};
  if(type==='INSERT')return {...common,blockName:data[2],center:pointFrom(data),scale:{x:number(data[41])||1,y:number(data[42])||1,z:number(data[43])||1},attributes:{}};
  if(type==='TEXT'||type==='MTEXT')return {...common,text:data[1]||data[3]||'',center:pointFrom(data),height:number(data[40])};
  if(type==='LINE'){const start=pointFrom(data),end={x:number(data[11]),y:number(data[21]),z:number(data[31])};return {...common,start,end,center:{x:(start.x+end.x)/2,y:(start.y+end.y)/2},bounds:boundsOf([start,end])};}
  if(type==='CIRCLE')return {...common,center:pointFrom(data),radius:number(data[40]),bounds:{minX:number(data[10])-number(data[40]),maxX:number(data[10])+number(data[40]),minY:number(data[20])-number(data[40]),maxY:number(data[20])+number(data[40])}};
  if(type==='ARC')return {...common,center:pointFrom(data),radius:number(data[40]),startAngle:number(data[50]),endAngle:number(data[51])};
  if(type==='LWPOLYLINE'||type==='POLYLINE'){const pts=vertices.length?vertices:polylinePoints(data);return {...common,vertices:pts,closed:Boolean(number(data[70])&1),center:centerOf(pts),bounds:boundsOf(pts)};}
  return {...common,center:pointFrom(data)};
}

function polylinePoints(data) {
  const xs=Array.isArray(data[10])?data[10]:[data[10]],ys=Array.isArray(data[20])?data[20]:[data[20]];
  return xs.filter(v=>v!==undefined).map((x,i)=>({x:number(x),y:number(ys[i])}));
}
function boundsOf(points){
  if(!points.length)return null;
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const point of points){if(!point)continue;if(point.x<minX)minX=point.x;if(point.x>maxX)maxX=point.x;if(point.y<minY)minY=point.y;if(point.y>maxY)maxY=point.y;}
  return Number.isFinite(minX)?{minX,maxX,minY,maxY}:null;
}
function centerOf(points){const b=boundsOf(points);return b?{x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2}:{x:0,y:0};}
function addData(data,code,value){if(data[code]===undefined)data[code]=value;else if(Array.isArray(data[code]))data[code].push(value);else data[code]=[data[code],value];}

function transformPoint(point,matrix){return{x:point.x*matrix.a+point.y*matrix.c+matrix.e,y:point.x*matrix.b+point.y*matrix.d+matrix.f,z:point.z||0};}
function multiply(parent,local){return{a:parent.a*local.a+parent.c*local.b,b:parent.b*local.a+parent.d*local.b,c:parent.a*local.c+parent.c*local.d,d:parent.b*local.c+parent.d*local.d,e:parent.a*local.e+parent.c*local.f+parent.e,f:parent.b*local.e+parent.d*local.f+parent.f};}
function insertMatrix(insert,base={x:0,y:0}){const angle=(insert.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),sx=insert.scale?.x||1,sy=insert.scale?.y||1;return{a:c*sx,b:s*sx,c:-s*sy,d:c*sy,e:insert.center.x-(base.x*c*sx-base.y*s*sy),f:insert.center.y-(base.x*s*sx+base.y*c*sy)};}
function transformEntity(entity,matrix,instance,rootIndex){
  const result={...entity,instancePath:instance,rootIndex};
  if(entity.center)result.center=transformPoint(entity.center,matrix);
  if(entity.start&&entity.end){result.start=transformPoint(entity.start,matrix);result.end=transformPoint(entity.end,matrix);}
  if(entity.vertices)result.vertices=entity.vertices.map(point=>transformPoint(point,matrix));
  const points=result.vertices?.length?result.vertices:result.start?[result.start,result.end]:null;
  if(points){result.bounds=boundsOf(points);result.center=centerOf(points);}
  else if(entity.bounds){const corners=[{x:entity.bounds.minX,y:entity.bounds.minY},{x:entity.bounds.maxX,y:entity.bounds.minY},{x:entity.bounds.maxX,y:entity.bounds.maxY},{x:entity.bounds.minX,y:entity.bounds.maxY}].map(point=>transformPoint(point,matrix));result.bounds=boundsOf(corners);result.center=centerOf(corners);}
  const scale=Math.sqrt(Math.abs(matrix.a*matrix.d-matrix.b*matrix.c));
  if(entity.radius)result.radius=entity.radius*scale;
  return result;
}

function expandBlockInserts(entities,blocks,maxEntities=100000){
  const output=[];
  const visit=(entity,matrix,depth,path,rootIndex)=>{
    if(output.length>=maxEntities||depth>12)return;
    if(entity.entityType!=='INSERT'){output.push(transformEntity(entity,matrix,path,rootIndex));return;}
    const block=blocks.get(entity.blockName);
    if(!block){output.push(transformEntity(entity,matrix,path,rootIndex));return;}
    const next=multiply(matrix,insertMatrix(entity,block.base));
    for(let index=0;index<block.entities.length;index++)visit(block.entities[index],next,depth+1,`${path}/${entity.blockName}:${index}`,rootIndex);
  };
  const identity={a:1,b:0,c:0,d:1,e:0,f:0};
  // 이름이 확인된 물류 블록부터 펼쳐 대용량 도면에서도 핵심 설비가 잘리지 않게 한다.
  entities.map((entity,index)=>({entity,index})).sort((a,b)=>Number(hasLogisticsIdentity(b.entity))-Number(hasLogisticsIdentity(a.entity))).forEach(({entity,index})=>visit(entity,identity,0,`model:${index}`,index));
  return output;
}

export function parseDxf(text) {
  const input=pairs(text),entities=[],layers=new Set(),blocks=new Map();let section='',currentBlock=null,i=0,unitsCode=0;
  while(i<input.length){const pair=input[i];
    if(pair.code===0&&pair.value==='SECTION'){section=input[i+1]?.value||'';i+=2;continue;}
    if(pair.code===0&&pair.value==='ENDSEC'){section='';i++;continue;}
    if(section==='HEADER'&&pair.code===9&&pair.value==='$INSUNITS'){unitsCode=Number(input[i+1]?.value)||0;i+=2;continue;}
    if(section==='BLOCKS'&&pair.code===0&&pair.value==='BLOCK'){
      const data={};i++;while(i<input.length&&input[i].code!==0){addData(data,input[i].code,input[i].value);i++;}
      currentBlock={name:data[2]||data[3],base:pointFrom(data),entities:[]};if(currentBlock.name)blocks.set(currentBlock.name,currentBlock);continue;
    }
    if(section==='BLOCKS'&&pair.code===0&&pair.value==='ENDBLK'){currentBlock=null;i++;continue;}
    if((section==='ENTITIES'||section==='BLOCKS')&&pair.code===0&&!['SECTION','ENDSEC','EOF','BLOCK','ENDBLK','SEQEND','VERTEX'].includes(pair.value)){
      const type=pair.value,data={},vertices=[];i++;
      while(i<input.length&&input[i].code!==0){addData(data,input[i].code,input[i].value);i++;}
      if(type==='POLYLINE')while(input[i]?.value==='VERTEX'){const vd={};i++;while(i<input.length&&input[i].code!==0){addData(vd,input[i].code,input[i].value);i++;}vertices.push(pointFrom(vd));}
      const entity=collectEntity(type,data,vertices);layers.add(entity.layer);
      if(section==='ENTITIES')entities.push(entity);else if(currentBlock)currentBlock.entities.push(entity);
      continue;
    }
    i++;
  }
  const expandedEntities=expandBlockInserts(entities,blocks),rootBounds=new Map();
  for(const entity of expandedEntities){if(!entity.bounds)continue;const b=rootBounds.get(entity.rootIndex)||{minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};b.minX=Math.min(b.minX,entity.bounds.minX);b.maxX=Math.max(b.maxX,entity.bounds.maxX);b.minY=Math.min(b.minY,entity.bounds.minY);b.maxY=Math.max(b.maxY,entity.bounds.maxY);rootBounds.set(entity.rootIndex,b);}
  for(const [index,b] of rootBounds){if(entities[index]?.entityType==='INSERT'){entities[index].bounds=b;entities[index].center=centerOf([{x:b.minX,y:b.minY},{x:b.maxX,y:b.maxY}]);}}
  const drawable=expandedEntities.filter(e=>e.center||e.bounds),allPoints=drawable.flatMap(e=>e.bounds?[{x:e.bounds.minX,y:e.bounds.minY},{x:e.bounds.maxX,y:e.bounds.maxY}]:[e.center]);
  const logisticsPoints=drawable.filter(isLogisticsDxfEntity).flatMap(e=>e.bounds?[{x:e.bounds.minX,y:e.bounds.minY},{x:e.bounds.maxX,y:e.bounds.maxY}]:[e.center]);
  const bounds=boundsOf(logisticsPoints)||boundsOf(allPoints),unitNames={0:'unitless',1:'inch',2:'foot',4:'mm',5:'cm',6:'m'};
  return {format:'DXF',version:'ASCII',units:unitNames[unitsCode]||`code-${unitsCode}`,bounds,layers:[...layers],blocks:[...blocks.keys()],blockDefinitions:Object.fromEntries([...blocks].map(([name,block])=>[name,{base:block.base,entityCount:block.entities.length}])),entities,expandedEntities};
}

export function createCanvasTransform(document,width=1200,height=430,padding=40){const b=document.bounds;if(!b)return{scale:1,offsetX:0,offsetY:0};const sx=(width-padding*2)/Math.max(1,b.maxX-b.minX),sy=(height-padding*2)/Math.max(1,b.maxY-b.minY),scale=Math.min(sx,sy);return{scale,offsetX:padding-b.minX*scale,offsetY:padding+b.maxY*scale};}

const architecturalLayerTerms=['WALL','WAL','COLUMN','COL','DOOR','WINDOW','FLOOR','CEILING','GRID','AXIS','DIM','TEXT','TEX','TXT','HATCH','FRAME','BORDER','TITLE','SHEET','건축','벽','외벽','내벽','기둥','문','창호','치수','천장','도곽','표제'];
const logisticsLayerTerms=['CONV','CONVEYOR','CV','ROLLER','BELT','RACK','STACK','STK','CRANE','SHUTTLE','AMR','AGV','ASRS','MHE','SORT','LIFT','ROBOT','물류','컨베이어','랙','크레인','셔틀'];
function hasLogisticsIdentity(entity){const haystack=`${entity.layer||''} ${entity.blockName||''} ${entity.instancePath||''}`.toUpperCase();return logisticsLayerTerms.some(term=>haystack.includes(term));}
export function isProcessLabel(entity){return ['TEXT','MTEXT'].includes(entity.entityType)&&/(도어|화이날|트림|입고|출고|스테커|스태커|DOOR|FINAL|TRIM|INBOUND|OUTBOUND|ASRS)/i.test(entity.text||'');}
export function isArchitecturalDxfEntity(entity){
  const haystack=`${entity.layer||''} ${entity.blockName||''}`.toUpperCase();
  return architecturalLayerTerms.some(term=>haystack.includes(term))||['HATCH','DIMENSION'].includes(entity.entityType)||(['TEXT','MTEXT'].includes(entity.entityType)&&!isProcessLabel(entity));
}
export function isLogisticsDxfEntity(entity){
  const haystack=`${entity.layer||''} ${entity.blockName||''} ${entity.instancePath||''}`.toUpperCase();
  if(isProcessLabel(entity))return true;
  if(isArchitecturalDxfEntity(entity))return false;
  if(hasLogisticsIdentity(entity))return true;
  // 펼쳐진 익명/건축 블록은 물류 키워드가 확인될 때만 표시한다.
  if(entity.instancePath)return false;
  return true;
}

export function transformDxfGeometry(document,transform,rootIndexes=null,includeProcessContext=false){
  const point=p=>({x:p.x*transform.scale+transform.offsetX,y:-p.y*transform.scale+transform.offsetY});
  const allowed=rootIndexes?new Set(rootIndexes):null;
  return (document.expandedEntities||document.entities||[]).filter(entity=>(isLogisticsDxfEntity(entity)||(includeProcessContext&&!isArchitecturalDxfEntity(entity)))&&(!allowed||allowed.has(entity.rootIndex))).flatMap(entity=>{
    const common={type:entity.entityType,layer:entity.layer||'0'};
    if(entity.entityType==='LINE')return [{...common,start:point(entity.start),end:point(entity.end)}];
    if(['LWPOLYLINE','POLYLINE'].includes(entity.entityType)&&entity.vertices?.length)return [{...common,vertices:entity.vertices.map(point),closed:entity.closed}];
    if(entity.entityType==='CIRCLE')return [{...common,center:point(entity.center),radius:entity.radius*transform.scale}];
    if(entity.entityType==='ARC')return [{...common,center:point(entity.center),radius:entity.radius*transform.scale,startAngle:-(entity.endAngle||0)*Math.PI/180,endAngle:-(entity.startAngle||0)*Math.PI/180}];
    if(['TEXT','MTEXT'].includes(entity.entityType)&&isProcessLabel(entity))return [{...common,center:point(entity.center),text:entity.text,height:Math.max(10,(entity.height||12)*transform.scale)}];
    return [];
  });
}
