export function workspaceNavigationState(layout,projectEmpty=false){
 const equipment=Array.isArray(layout?.equipment)?layout.equipment:[];
 const ready=!projectEmpty&&equipment.length>0;
 const has3d=ready&&equipment.some(item=>['asrs','stackerCrane'].includes(item.type)&&item.reviewStatus!=='rejected');
 return {ready,has3d,splitReady:false};
}

export function selectWorkspaceButton(buttons,selected){
 for(const button of buttons)button.classList.toggle('active',button===selected);
}
