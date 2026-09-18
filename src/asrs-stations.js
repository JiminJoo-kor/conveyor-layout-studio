import { equipmentPorts } from './route.js';

export const hasAsrsStations=item=>['asrs','stackerCrane'].includes(item?.type);
export const stationId=(parent,index,kind)=>`${parent}::station-${index+1}-${kind}`;
const portIndex=port=>{const match=/^product-(\d+)-(in|out)$/.exec(port||'');return match?Number(match[1])-1:null;};

function inboundLineIndex(nodeId,edges,branches){
  let frontier=[nodeId];const seen=new Set();
  while(frontier.length){const matches=new Set();for(const id of frontier)branches.forEach((branch,index)=>{if(branch.nodeIds?.includes(id))matches.add(index);});if(matches.size===1)return [...matches][0];if(matches.size>1)return null;
    const next=[];for(const id of frontier){if(seen.has(id))continue;seen.add(id);for(const edge of edges)if(edge.to===id&&!seen.has(edge.from))next.push(edge.from);}frontier=next;
  }return null;
}

export function asrsStationSpec(parent,layout,kind,index=null){
  const p=parent.parameters||{},spec=layout.cargoSpec||{},mm=spec.unit==='mm'||!spec.unit&&(Number(spec.length)>20||Number(spec.width)>20),scale=spec.unit==='cm'?.01:mm?.001:1;
  const length=Number(spec.length)||(mm?1200:1.2),width=Number(spec.width)||(mm?800:.8);
  // Circumscribed footprint accommodates retained cargo orientation, including AMR rotations.
  const footprint=Math.hypot(length*scale,width*scale),gap=Math.max(.02,Number(p.stationSafetyGap??.2)),margin=.1;
  const count=Math.max(kind==='out'?Math.round(Number(p.retrievalCarryCount)||1):1,Math.round(Number(index==null?null:p.stationLineCounts?.[index]?.[kind])||Number(p[kind==='in'?'infeedBufferCount':'outfeedBufferCount'])||Number(p.retrievalCarryCount)||1));
  return {count,footprint,gap,margin,length:count*footprint+(count-1)*gap+2*margin,width:footprint+2*margin,speed:Math.max(.01,Number(p.stationConveyorSpeed)||.5),visualLength:layout.cadViewMode==='hybrid'?58:78,visualWidth:layout.cadViewMode==='hybrid'?16:24};
}

export function positionAsrsStations(layout){
  const parents=new Map(layout.equipment.filter(hasAsrsStations).map(p=>[p.id,p]));
  for(const parent of parents.values()){
    const p=parent.parameters,count=Math.max(1,Number(p.productTypes)||3),width=asrsStationSpec(parent,layout,'in').visualWidth,spacing=width+40,inSide=p.infeedSide||'left',outSide=p.outfeedSide||'right',same=inSide===outSide,span=(count*(same?2:1))*spacing+48;
    p.stationVisualSpacing=spacing;parent.asrsVisualBounds={width:Math.max(280,[inSide,outSide].some(s=>['top','bottom'].includes(s))?span:178),height:Math.max(count*84+40,[inSide,outSide].some(s=>['left','right'].includes(s))?span:132)};
  }
  for(const child of layout.equipment.filter(e=>e.asrsStation)){
    const parent=parents.get(child.asrsStation.parentId);if(!parent)continue;
    const {index,kind}=child.asrsStation,spec=asrsStationSpec(parent,layout,kind,index),p=parent.parameters||{},side=p[kind==='in'?'infeedSide':'outfeedSide']||(kind==='in'?'left':'right');
    const directions={left:{x:-1,y:0,angle:180},right:{x:1,y:0,angle:0},top:{x:0,y:-1,angle:-90},bottom:{x:0,y:1,angle:90}},direction=directions[side]||directions.left;
    const angle=(Number(parent.rotation)||0)*Math.PI/180,dx=direction.x*Math.cos(angle)-direction.y*Math.sin(angle),dy=direction.x*Math.sin(angle)+direction.y*Math.cos(angle);
    const ports=equipmentPorts(parent),anchor=ports[`product-${index+1}-${kind}`],offset=spec.visualLength/2+8;if(!anchor)continue;
    child.x=parent.x+(anchor.x-parent.x)+dx*offset;child.y=parent.y+(anchor.y-parent.y)+dy*offset;
    child.rotation=(Number(parent.rotation)||0)+direction.angle+(kind==='in'?180:0);
    Object.assign(child.asrsStation,spec);Object.assign(child.parameters,{length:spec.length,width:spec.width,safetyGap:spec.gap,speed:spec.speed});
  }
}

// Reconcile derived children, not a one-project migration. IDs survive JSON round trips.
export function syncAsrsStations(layout){
  const old=new Map(layout.equipment.filter(e=>e.asrsStation).map(e=>[e.id,e])),parents=layout.equipment.filter(hasAsrsStations);
  if(!parents.length&&!old.size)return layout;
  layout.cadSchematic??={edges:[],lanes:[],inboundBranches:[]};
  const edges=(layout.cadSchematic.edges||[]).filter(e=>!e.asrsStationInternal).map(edge=>{
    const result={...edge};for(const end of ['from','to']){const child=old.get(result[end]);if(child){const station=child.asrsStation;result[end]=station.parentId;result[`${end}Port`]=`product-${station.index+1}-${station.kind}`;}}
    return result;
  });
  layout.equipment=layout.equipment.filter(e=>!e.asrsStation);
  for(const parent of parents){
    parent.parameters??={};parent.parameters.stationConveyorsEnabled=1;
    const count=Math.max(1,Math.round(Number(parent.parameters?.productTypes)||3));
    if(parent.parameters.productTypes==null)parent.parameters.productTypes=count;
    for(let index=0;index<count;index++)for(const kind of ['in','out']){
      const id=stationId(parent.id,index,kind),spec=asrsStationSpec(parent,layout,kind,index),name=parent.parameters?.zoneNames?.[index]||layout.cadSchematic.inboundBranches?.[index]?.name||`품목 ${index+1}`;
      const item=old.get(id)||{id,type:'conveyor',x:0,y:0,rotation:0};
      Object.assign(item,{name:`${parent.name||'AS/RS'} · ${name} ${kind==='in'?'입고':'출고'} CV`,asrsStation:{parentId:parent.id,index,kind,...spec},source:{origin:'dxf',parameterLengthUnit:'m',reason:'asrs-station'},reviewStatus:'approved',parameters:{length:spec.length,width:spec.width,speed:spec.speed,safetyGap:spec.gap,continuousHandover:1,handoverDelay:0,acceleration:Number(parent.parameters?.stationAcceleration)||.8,deceleration:Number(parent.parameters?.stationDeceleration)||.8,loadCapacity:Math.max(Number(parent.parameters?.loadCapacity)||1000,(Number(layout.cargoSpec?.weight)||100)*spec.count),availability:100,efficiency:100}});
      layout.equipment.push(item);
      edges.push(kind==='in'?{from:id,to:parent.id,fromPort:'right',toPort:`product-${index+1}-in`,kind:'warehouse',asrsStationInternal:parent.id}:{from:parent.id,to:id,fromPort:`product-${index+1}-out`,toPort:'left',kind:'warehouse',asrsStationInternal:parent.id});
    }
    // A legacy unnumbered output was shared by every stacker. Preserve that fan-in.
    for(const edge of [...edges])if(!edge.asrsStationInternal&&edge.from===parent.id&&portIndex(edge.fromPort)==null){edge.fromPort='product-1-out';for(let index=1;index<count;index++)edges.push({...edge,fromPort:`product-${index+1}-out`});}
    const originalEdges=edges.map(edge=>({...edge}));
    for(const edge of edges){if(edge.asrsStationInternal)continue;for(const [end,kind] of [['to','in'],['from','out']])if(edge[end]===parent.id){
      let index=portIndex(edge[`${end}Port`]);
      if(index==null&&kind==='in')index=inboundLineIndex(edge.from,originalEdges,layout.cadSchematic.inboundBranches||[]);
      // Invalid explicit product ports remain invalid, so validation reports them instead of rerouting cargo.
      if(index!=null&&index>=count)continue;
      index=Math.max(0,index??0);edge[end]=stationId(parent.id,index,kind);edge[`${end}Port`]=kind==='in'?'left':'right';
    }}
  }
  layout.cadSchematic.edges=[...edges.filter(e=>!e.asrsStationInternal),...edges.filter(e=>e.asrsStationInternal)];positionAsrsStations(layout);return layout;
}

export function appendAsrsStationControls(items,root,layout,onChange){
  for(const item of items.filter(e=>['asrs','stackerCrane'].includes(e.type))){
    const card=root.querySelector(`[data-parameter-card="${CSS.escape(item.id)}"]`);if(!card)continue;
    const group=document.createElement('section');group.className='parameter-option-group';
    const title=document.createElement('h3');title.textContent='라인별 입고·출고 컨베이어';group.append(title);
    const required=document.createElement('p');required.textContent='AS/RS 필수 구성 · 모든 라인에 입고·출고 스테이션이 자동 배치됩니다.';group.append(required);
    {for(const [key,label,kind] of [['infeedBufferCount','라인별 입고 수용 수량','in'],['outfeedBufferCount','라인별 출고 수용 수량','out'],['stationConveyorSpeed','내부 컨베이어 속도(m/s)',null],['stationSafetyGap','내부 최소 안전간격(m)',null],['stationAcceleration','내부 컨베이어 가속도(m/s²)',null],['stationDeceleration','내부 컨베이어 감속도(m/s²)',null]]){
      const row=document.createElement('label'),input=document.createElement('input');input.type='number';input.min=kind==='out'?String(Math.max(1,Number(item.parameters.retrievalCarryCount)||1)):kind?'1':'.02';input.step=kind?'1':'.01';input.value=kind?asrsStationSpec(item,layout,kind).count:item.parameters[key]??(key==='stationConveyorSpeed'?.5:key==='stationSafetyGap'?.2:.8);input.setAttribute('aria-label',label);row.append(label,input);group.append(row);input.addEventListener('change',()=>{if(!input.checkValidity())return;onChange(item,key,Number(input.value));});
    }
    for(const kind of ['in','out']){const spec=asrsStationSpec(item,layout,kind),text=document.createElement('p');text.textContent=`${kind==='in'?'입고':'출고'}: 라인당 ${spec.count}개 · 자동 길이 ${spec.length.toFixed(2)}m × 폭 ${spec.width.toFixed(2)}m`;group.append(text);}
    const perLine=document.createElement('details'),summary=document.createElement('summary');summary.textContent='라인별 개별 수량·자동 치수';perLine.append(summary);
    for(let index=0;index<Math.max(1,Number(item.parameters.productTypes)||3);index++){
      const name=item.parameters.zoneNames?.[index]||layout.cadSchematic?.inboundBranches?.[index]?.name||`품목 ${index+1}`;
      for(const kind of ['in','out']){const spec=asrsStationSpec(item,layout,kind,index),row=document.createElement('label'),input=document.createElement('input');input.type='number';input.min=kind==='out'?String(Math.max(1,Number(item.parameters.retrievalCarryCount)||1)):'1';input.step='1';input.value=spec.count;input.setAttribute('aria-label',`${name} ${kind==='in'?'입고':'출고'} 수량`);row.append(`${name} ${kind==='in'?'입고':'출고'} · ${spec.length.toFixed(2)}m`,input);perLine.append(row);input.addEventListener('change',()=>{if(!input.checkValidity())return;const counts=structuredClone(item.parameters.stationLineCounts||{});counts[index]={...counts[index],[kind]:Number(input.value)};onChange(item,'stationLineCounts',counts);});}
    }group.append(perLine);
    const note=document.createElement('small');note.textContent='입고는 설정 수량을 받은 뒤 처리하며, 수량 미달 시 가능한 출고를 우선합니다. 출고는 실제 인출 묶음을 동시에 내려놓고 하류에는 설비별 승인으로 전달합니다. 출고 수용량은 1회 운반 수량 이상으로 자동 확보합니다. 물류 크기·회전 자세·안전간격·양끝 여유로 치수를 자동 계산합니다. 스태커 운반 수량과 버퍼 수량은 별도입니다. 연결점은 각 컨베이어 외측 끝에 표시됩니다. 변경 시 시뮬레이션이 초기화됩니다.';group.append(note);}
    card.append(group);
  }
}
