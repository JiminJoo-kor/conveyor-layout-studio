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
function boundsOf(points){if(!points.length)return null;return{minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};}
function centerOf(points){const b=boundsOf(points);return b?{x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2}:{x:0,y:0};}
function addData(data,code,value){if(data[code]===undefined)data[code]=value;else if(Array.isArray(data[code]))data[code].push(value);else data[code]=[data[code],value];}

export function parseDxf(text) {
  const input=pairs(text),entities=[],layers=new Set(),blocks=new Map();let section='',i=0,unitsCode=0;
  while(i<input.length){const pair=input[i];
    if(pair.code===0&&pair.value==='SECTION'){section=input[i+1]?.value||'';i+=2;continue;}
    if(pair.code===0&&pair.value==='ENDSEC'){section='';i++;continue;}
    if(section==='HEADER'&&pair.code===9&&pair.value==='$INSUNITS'){unitsCode=Number(input[i+1]?.value)||0;i+=2;continue;}
    if((section==='ENTITIES'||section==='BLOCKS')&&pair.code===0&&!['SECTION','ENDSEC','EOF','BLOCK','ENDBLK','SEQEND','VERTEX'].includes(pair.value)){
      const type=pair.value,data={},vertices=[];i++;
      while(i<input.length&&input[i].code!==0){addData(data,input[i].code,input[i].value);i++;}
      if(type==='POLYLINE')while(input[i]?.value==='VERTEX'){const vd={};i++;while(i<input.length&&input[i].code!==0){addData(vd,input[i].code,input[i].value);i++;}vertices.push(pointFrom(vd));}
      const entity=collectEntity(type,data,vertices);layers.add(entity.layer);
      if(section==='ENTITIES')entities.push(entity);else if(entity.blockName)blocks.set(entity.blockName,entity);
      continue;
    }
    i++;
  }
  const drawable=entities.filter(e=>e.center||e.bounds),allPoints=drawable.flatMap(e=>e.bounds?[{x:e.bounds.minX,y:e.bounds.minY},{x:e.bounds.maxX,y:e.bounds.maxY}]:[e.center]);
  const bounds=boundsOf(allPoints),unitNames={0:'unitless',1:'inch',2:'foot',4:'mm',5:'cm',6:'m'};
  return {format:'DXF',version:'ASCII',units:unitNames[unitsCode]||`code-${unitsCode}`,bounds,layers:[...layers],blocks:[...blocks.keys()],entities};
}

export function createCanvasTransform(document,width=1200,height=430,padding=40){const b=document.bounds;if(!b)return{scale:1,offsetX:0,offsetY:0};const sx=(width-padding*2)/Math.max(1,b.maxX-b.minX),sy=(height-padding*2)/Math.max(1,b.maxY-b.minY),scale=Math.min(sx,sy);return{scale,offsetX:padding-b.minX*scale,offsetY:padding+b.maxY*scale};}

export function transformDxfGeometry(document,transform){
  const point=p=>({x:p.x*transform.scale+transform.offsetX,y:-p.y*transform.scale+transform.offsetY});
  return (document.entities||[]).flatMap(entity=>{
    const common={type:entity.entityType,layer:entity.layer||'0'};
    if(entity.entityType==='LINE')return [{...common,start:point(entity.start),end:point(entity.end)}];
    if(['LWPOLYLINE','POLYLINE'].includes(entity.entityType)&&entity.vertices?.length)return [{...common,vertices:entity.vertices.map(point),closed:entity.closed}];
    if(entity.entityType==='CIRCLE')return [{...common,center:point(entity.center),radius:entity.radius*transform.scale}];
    if(entity.entityType==='ARC')return [{...common,center:point(entity.center),radius:entity.radius*transform.scale,startAngle:-(entity.endAngle||0)*Math.PI/180,endAngle:-(entity.startAngle||0)*Math.PI/180}];
    return [];
  });
}
