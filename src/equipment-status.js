const STATUS_META={
 ready:{label:'정상',color:'#00d4ff'},
 active:{label:'운전',color:'#00ff88'},
 waiting:{label:'대기',color:'#ffd166'},
 blocked:{label:'막힘',color:'#ff7139'},
 fault:{label:'고장',color:'#ff4d9d'},
};

export function equipmentOperatingStatus(item,state={}){
 const id=item?.id,reliability=state?.equipmentReliability?.[id],tokens=(state?.cadTokens||[]).filter(token=>token.nodeId===id||token.edge?.to===id&&token.asrsInfeedAcceptedAt!=null),locked=Boolean(state?.locks?.[id]||state?.locks?.conveyor?.[id]);
 let key='ready';
 if(reliability?.available===false)key='fault';
 else if(locked||tokens.some(token=>token.beltInterlocked||token.waitDiagnostic?.reason))key='blocked';
 else if(tokens.some(token=>token.queueState||token.transferState==='WaitingAtOutfeed'||token.edge&&token.nodeId===id))key='waiting';
 else if(tokens.length||state?.mobileReturns?.[id])key='active';
 return{key,...STATUS_META[key]};
}

export const equipmentStatusMeta=key=>STATUS_META[key]||STATUS_META.ready;
