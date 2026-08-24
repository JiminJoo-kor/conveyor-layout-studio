export const layoutSchemaVersion = 1;

export const defaultLayout = {
  schemaVersion: layoutSchemaVersion,
  id: 'conveyor-line-r1',
  name: 'Conveyor Robot Line R1',
  canvas: { width: 1200, height: 430, grid: 20 },
  equipment: [
    {
      id: 'line-2', type: 'conveyor', name: '2번 라인', x: 44, y: 80,
      direction: 'reverse', speedParam: 'conv2Speed', trayKinds: ['A', 'B'],
      nodes: Array.from({ length: 11 }, (_, i) => ({
        id: `2-${11 - i}`, label: `2-${11 - i}`,
        role: i === 0 ? 'source-exit' : i === 6 ? 'robot-pick' : i === 10 ? 'source-entry' : 'buffer'
      }))
    },
    {
      id: 'line-1', type: 'conveyor', name: '1번 라인', x: 224, y: 285,
      direction: 'reverse', speedParam: 'conv1Speed', trayKinds: ['C'],
      nodes: Array.from({ length: 7 }, (_, i) => ({
        id: `1-${7 - i}`, label: `1-${7 - i}`,
        role: i === 0 ? 'product-exit' : i === 1 ? 'station-16' : i === 2 ? 'station-15' : i === 4 ? 'robot-place' : i === 6 ? 'product-entry' : 'buffer'
      }))
    },
    { id: 'robot-1', type: 'robot', name: 'Transfer Robot', x: 674, y: 203, pickNode: '2-5', placeNode: '1-3' },
    { id: 'station-15', type: 'station', name: '1-5 작업', nodeId: '1-5', durationParam: 'station15Time' },
    { id: 'station-16', type: 'station', name: '1-6 작업', nodeId: '1-6', durationParam: 'station16Time' },
    { id: 'forklift-17', type: 'forklift', name: '1-7 제거', nodeId: '1-7', durationParam: 'forklift17Time' },
    { id: 'forklift-211', type: 'forklift', name: '2-11 제거', nodeId: '2-11', durationParam: 'forklift211Time' }
  ],
  connections: [
    { id: 'pick-link', from: '2-5', to: 'robot-1', kind: 'pick' },
    { id: 'place-link', from: 'robot-1', to: '1-3', kind: 'place' }
  ]
};

export function validateLayout(layout) {
  const errors = [];
  if (layout?.schemaVersion !== layoutSchemaVersion) errors.push('지원하지 않는 레이아웃 버전입니다.');
  if (!Array.isArray(layout?.equipment)) errors.push('equipment 배열이 필요합니다.');
  const ids = new Set();
  const nodeIds = new Set();
  for (const item of layout?.equipment || []) {
    if (!item.id || ids.has(item.id)) errors.push(`중복되거나 비어 있는 설비 ID: ${item.id || '(없음)'}`);
    ids.add(item.id);
    for (const node of item.nodes || []) {
      if (!node.id || nodeIds.has(node.id)) errors.push(`중복되거나 비어 있는 노드 ID: ${node.id || '(없음)'}`);
      nodeIds.add(node.id);
    }
  }
  for (const item of layout?.equipment || []) {
    if (item.nodeId && !nodeIds.has(item.nodeId)) errors.push(`${item.id}의 nodeId가 존재하지 않습니다.`);
    if (item.pickNode && !nodeIds.has(item.pickNode)) errors.push(`${item.id}의 pickNode가 존재하지 않습니다.`);
    if (item.placeNode && !nodeIds.has(item.placeNode)) errors.push(`${item.id}의 placeNode가 존재하지 않습니다.`);
  }
  return { valid: errors.length === 0, errors };
}

export function cloneLayout(layout = defaultLayout) {
  return JSON.parse(JSON.stringify(layout));
}
