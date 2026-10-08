export const workspaceActionGroups={
  quick:['newLayoutProject','editorToggle','viewFit'],
  more:[
    {title:'프로젝트',ids:['layoutFile','exportLayout']},
    {title:'CAD · 참조',ids:['cadFile','drawingFile']},
    {title:'보기 방식',ids:['cadViewToggle']}
  ]
};

export function workspaceActionStatus({projectEmpty=false,editing=false,connecting=false,placement=null,selectionCount=0,insertion=false}={}){
  if(projectEmpty)return '프로젝트 대기';
  if(placement)return `배치 · ${String(placement).toUpperCase()}`;
  if(connecting)return '연결 설정 중';
  if(insertion)return '자동 삽입 완료';
  if(selectionCount>1)return `${selectionCount}개 선택`;
  return editing?'편집 중':'보기 모드';
}
