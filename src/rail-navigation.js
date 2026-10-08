export const railTabs=Object.freeze(['equipment','project','warnings']);

export function normalizeRailTab(tab){return railTabs.includes(tab)?tab:'equipment';}

export function railWarningRows(validation,runtimeEvents=[]){
 const rows=[];
 for(const detail of validation?.errors||[])rows.push({level:'error',detail});
 for(const detail of validation?.warnings||[])rows.push({level:'warning',detail});
 for(const event of runtimeEvents)if(['cargo-overload','simulation-stall-detected'].includes(event?.type))rows.push({level:'runtime',detail:event.type==='cargo-overload'?'허용하중 초과 감지':'물류 흐름 정지 감지'});
 return rows;
}
