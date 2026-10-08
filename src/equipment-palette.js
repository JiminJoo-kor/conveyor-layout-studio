export const equipmentPaletteGroups=[
  {id:'transport',title:'이송',open:true,types:['conveyor','shuttle','agv','amr','forklift','lift']},
  {id:'routing',title:'방향 전환 · 분기',open:false,types:['diverter','sorter','turntable','forkingDevice','handoffPoint']},
  {id:'process-storage',title:'작업 · 보관',open:false,types:['robot','station','sequenceRack','boxStacker','boxDestacker','asrs']},
  {id:'inout',title:'입출고',open:false,types:['inboundDock','dock','sink']}
];

export function equipmentPaletteGroup(type){return equipmentPaletteGroups.find(group=>group.types.includes(type))?.id||'other';}
