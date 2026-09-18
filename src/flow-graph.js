// Equipment IDs and directed ports, not CAD names or drawing coordinates, own flow.
export const isStorage = item => ['asrs', 'stackerCrane'].includes(item?.type);
export const isTransport = item => ['conveyor', 'sorter'].includes(item?.type);
export const productPort = port => {
  const match = /^product-(\d+)-(in|out)$/.exec(port || '');
  return match ? { index: Number(match[1]) - 1, direction: match[2] } : null;
};
export function validateFlowGraph(layout) {
  const errors = [], warnings = [], nodes = new Map();
  for (const item of layout.equipment || []) {
    if (!item.id || nodes.has(item.id)) errors.push(`설비 ID 중복/누락: ${item.id}`);
    nodes.set(item.id, item);
  }
  const seen = new Set();
  for (const edge of layout.cadSchematic?.edges || []) {
    const from = nodes.get(edge.from), to = nodes.get(edge.to);
    if (!from || !to) { errors.push(`연결 설비 없음: ${edge.from} → ${edge.to}`); continue; }
    if (from.type === 'processLine' || to.type === 'processLine') errors.push(`공정 라인 주석은 실행 연결점이 아닙니다: ${edge.from} → ${edge.to}`);
    if (from === to) errors.push(`동일 설비 자기 연결: ${edge.from}`);
    const key = [edge.from, edge.fromPort || '', edge.to, edge.toPort || ''].join('|');
    if (seen.has(key)) errors.push(`중복 연결: ${key}`);
    seen.add(key);
    for (const [item, port, direction] of [[from, edge.fromPort, 'out'], [to, edge.toPort, 'in']]) {
      if (!port) continue; // Legacy automatic side selection is still supported.
      const product = productPort(port);
      if (product) {
        if (!isStorage(item) || product.direction !== direction || product.index < 0 || product.index >= Number(item.parameters?.productTypes || 3)) errors.push(`잘못된 입출고 연결점: ${item.id}.${port}`);
      } else if (!['left', 'right', 'top', 'bottom'].includes(port)) errors.push(`알 수 없는 연결점: ${item.id}.${port}`);
    }
    if (from.type === 'sink' || from.type === 'dock' && from.parameters?.dockRole === 'outbound') warnings.push(`배출 설비에 후속 연결 있음: ${from.id}`);
  }
  for (const item of nodes.values()) {
    const p = item.parameters || {};
    if(item.type==='conveyor'&&Number(p.diverterEnabled)===1){
      const directions=p.diverterDirections||[],vertical=['up','down'],horizontal=['left','right'];
      if(!Array.isArray(directions)||directions.some(d=>!vertical.includes(d)&&!horizontal.includes(d))||directions.some(d=>vertical.includes(d))&&directions.some(d=>horizontal.includes(d)))errors.push(`디버터 방향은 상·하 또는 좌·우 한 축만 선택해야 합니다: ${item.id}`);
      for(const key of ['diverterSpeed','diverterAcceleration','diverterDeceleration','diverterStroke'])if(p[key]!=null&&(!Number.isFinite(Number(p[key]))||Number(p[key])<=0))errors.push(`디버터 파라미터는 양수여야 합니다: ${item.id}.${key}`);
    }
    for (const key of ['length', 'speed', 'travelSpeed', 'receiveSpeed', 'transferSpeed', 'liftSpeed', 'acceleration', 'deceleration', 'safetyGap']) {
      if (p[key] != null && (!Number.isFinite(Number(p[key])) || Number(p[key]) < 0 || key !== 'safetyGap' && Number(p[key]) === 0)) errors.push(`유효하지 않은 파라미터: ${item.id}.${key} (속도·길이·가감속은 양수, 안전간격은 0 이상)`);
    }
    for (const key of ['rows', 'columns', 'levels', 'productTypes', 'capacity']) if(p[key] != null && (!Number.isInteger(Number(p[key])) || Number(p[key]) < 1)) errors.push(`양의 정수가 필요한 파라미터: ${item.id}.${key}`);
    if (!['sink', 'processLine'].includes(item.type) && !(item.type === 'dock' && p.dockRole === 'outbound') && !(layout.cadSchematic?.edges || []).some(edge => edge.from === item.id)) warnings.push(`후속 연결 없음: ${item.id} (출구에서 대기)`);
  }
  return { valid: !errors.length, errors, warnings };
}

export function createWarehouseState(storage, layout) {
  const p = storage?.parameters || {}, rows = Math.max(1, Math.round(Number(p.rows) || 2)), columns = Math.max(1, Math.round(Number(p.columns) || 8)), levels = Math.max(1, Math.round(Number(p.levels) || 4)), productTypes = Math.max(1, Math.round(Number(p.productTypes) || 3));
  const branches = layout.cadSchematic?.inboundBranches || [], used = new Set();
  const names = Array.from({ length: productTypes }, (_, index) => {
    const base = p.zoneNames?.[index] || branches[index]?.name || `품목 ${index + 1}`;
    let name=base,suffix=index+1;while(used.has(name))name=`${base} (${suffix++})`;
    used.add(name); return name;
  });
  const cellCount = rows * columns * levels;
  const zones = Object.fromEntries(names.map((name, index) => [name, { id: `${storage?.id || 'warehouse'}:zone:${index + 1}`, index, name, inventory: 0, capacity: cellCount, putaways: 0, retrievals: 0, releaseRemaining: 0, occupiedSlots: Array(cellCount).fill(false) }]));
  const stackers = Object.fromEntries(names.map((name, index) => [name, { id: `${storage?.id || 'warehouse'}:stacker:${index + 1}`, index, cargoType: name, mode: 'inbound', targetMode: null, availableAt: 0 }]));
  return { equipmentId: storage?.id, inventory: 0, capacity: cellCount * productTypes, cellCount, levels, rows, columns, productTypes, stackerCount: productTypes, stackers, zones, lineStates: { ...stackers }, putaways: 0, retrievals: 0, busyTime: 0 };
}
