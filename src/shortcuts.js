export function workspaceShortcut(event){
  if(event.defaultPrevented||event.isComposing||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return null;
  if(event.target?.closest?.('input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="slider"]'))return null;
  if(event.key===' '&&event.target?.closest?.('summary'))return null;
  return {Delete:'delete',Escape:'escape',' ':'run',f:'fit',F:'fit',e:'edit',E:'edit',g:'reveal',G:'reveal'}[event.key]||null;
}
