// Bottom-to-top identities survive grouping, splitting and JSON round trips.
export function validateStack(layers){
 if(!Array.isArray(layers)||!layers.length)throw Error('물품 적층 정보가 비어 있습니다.');
 const ids=new Set();
 for(const layer of layers){
  if(layer.id==null||ids.has(layer.id))throw Error('박스 ID 누락 또는 중복');
  ids.add(layer.id);
  if(!['length','width','height','weight'].every(k=>Number.isFinite(layer[k])&&layer[k]>0))throw Error('박스 규격과 중량은 양수여야 합니다.');
 }
 return layers;
}
export function stackCompatible(a,b){
 return a.kind===b.kind&&a.empty===true&&b.empty===true&&['length','width','height'].every(k=>Math.abs(a[k]-b[k])<1e-9);
}
export function stackMetrics(layers){
 validateStack(layers);
 return {count:layers.length,length:Math.max(...layers.map(l=>l.length)),width:Math.max(...layers.map(l=>l.width)),height:layers.reduce((n,l)=>n+l.height,0),weight:layers.reduce((n,l)=>n+l.weight,0)};
}
export function combineStacks(bottom,top,{maxWeight=Infinity,maxHeight=Infinity}={}){
 const layers=[...validateStack(bottom),...validateStack(top)];validateStack(layers);
 if(!layers.every(l=>stackCompatible(layers[0],l)))throw Error('동일 규격·종류의 빈 박스만 적재할 수 있습니다.');
 const metrics=stackMetrics(layers);
 if(metrics.weight>maxWeight||metrics.height>maxHeight)throw Error('적재 하중 또는 높이 초과');
 return structuredClone(layers);
}
export function splitBottom(layers){validateStack(layers);return {released:structuredClone(layers.slice(0,1)),held:structuredClone(layers.slice(1))};}
