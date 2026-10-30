import {parseDxf,createCanvasTransform,transformDxfGeometry} from './dxf.js';
import {analyzeCadText} from './cad-import.js';
/** Drawing display is independent of equipment identification. */
export function analyzeCadWithPreview(text,options={}){
 const document=parseDxf(text),all=document.expandedEntities||[];let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const g of all){const points=g.vertices||[g.start,g.end,g.center].filter(Boolean);for(const p of points){const r=g.radius||0;minX=Math.min(minX,p.x-r);maxX=Math.max(maxX,p.x+r);minY=Math.min(minY,p.y-r);maxY=Math.max(maxY,p.y+r);}}
 if(Number.isFinite(minX))document.bounds={minX,minY,maxX,maxY};
 const transform=createCanvasTransform(document,1200,650),geometry=transformDxfGeometry(document,transform,null,true,true);
 try{const result=analyzeCadText(text,options);result.document.canvasGeometry=geometry;result.document.toCanvasTransform=transform;for(const item of result.candidates){const p=item.source.cadPosition;item.x=p.x*transform.scale+transform.offsetX;item.y=-p.y*transform.scale+transform.offsetY;}return result;}
 catch(error){if(!geometry.length)throw error;return {document:{units:document.units,canvasGeometry:geometry,toCanvasTransform:transform},candidates:[],schematic:{lanes:[],inboundBranches:[],edges:[]},review:{proposals:[],issues:[],warnings:['도면 표시는 가능하지만 설비 분석이 중단되었습니다: '+error.message]},diagnostic:error.diagnostic};}
}
