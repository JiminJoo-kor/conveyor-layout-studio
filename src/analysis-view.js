export function mountAnalysisView(panel){
  const anchor=document.createComment('analysis panel position');panel.before(anchor);
  const style=document.createElement('style');style.textContent=`
    .analysis-view-controls{display:flex!important;gap:5px;margin-left:auto;flex-shrink:0}
    .analysis-view-controls button{white-space:nowrap;min-width:0;padding:5px 9px}
    #operationsPanel .dock-head{height:auto;min-height:34px;flex-wrap:wrap;gap:6px}
    #operationsPanel{grid-template-rows:auto minmax(0,1fr)}
    body .workspace:has(#operationsPanel[data-view="fit"]){grid-template-rows:minmax(160px,1fr) minmax(260px,58vh)}
    body #operationsPanel[data-view="fit"]{height:100%;min-height:0}
    body.analysis-expanded{overflow:hidden}
    body #operationsPanel[data-view="expanded"]{position:fixed;inset:12px;z-index:2000;width:calc(100% - 24px);height:calc(100dvh - 24px);box-sizing:border-box;max-height:none;max-width:none;display:grid;grid-template-columns:minmax(0,1fr);grid-template-areas:'head' 'results';grid-template-rows:auto minmax(0,1fr);padding:12px;background:#071b2a;box-shadow:0 0 0 20px #020b12e8}
    #operationsPanel[data-view="expanded"]>.run-config,#operationsPanel[data-view="expanded"]>.actions,#operationsPanel[data-view="expanded"]>.validation,#operationsPanel[data-view="expanded"]>#rackMonitorSlot{display:none!important}
    #operationsPanel .dock-results{overflow:auto;min-height:0;overscroll-behavior:contain}
    #operationsPanel .simulation-report:not([hidden]){height:auto!important;overflow:visible!important;max-height:none!important}
    #operationsPanel .table-wrap{max-height:none!important;height:auto!important;overflow:visible!important}
    #operationsPanel .lower-grid{height:auto!important;max-height:none}
    #operationsPanel[data-view="fit"] table{width:100%;min-width:0;table-layout:fixed}
    #operationsPanel[data-view="fit"] th,#operationsPanel[data-view="fit"] td{white-space:normal;overflow-wrap:anywhere;padding:5px 7px;font-size:11px}
    #operationsPanel[data-view="expanded"] .reference-analysis{height:auto;min-height:240px}
    #operationsPanel[data-view="expanded"] .uph-trend svg{height:240px}
    #operationsPanel[data-view="expanded"] th,#operationsPanel[data-view="expanded"] td{font-size:12px;padding:8px 10px}
    @media(max-width:700px){body #operationsPanel[data-view="expanded"]{inset:4px;padding:6px}.analysis-view-controls{width:100%;justify-content:flex-end}}
  `;document.head.append(style);
  const controls=document.createElement('div');controls.className='analysis-view-controls';controls.setAttribute('aria-label','분석 화면 크기');
  const modes=[['dock','기본 크기'],['fit','화면에 맞춤'],['expanded','확장']];
  function select(mode){if(mode==='expanded')document.body.append(panel);else anchor.after(panel);document.body.classList.toggle('analysis-expanded',mode==='expanded');panel.dataset.view=mode;for(const button of controls.children)button.setAttribute('aria-pressed',String(button.dataset.view===mode));if(mode!=='expanded')panel.scrollIntoView({block:'nearest'});}
  for(const [mode,label] of modes){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.view=mode;button.setAttribute('aria-controls',panel.id);button.title=mode==='expanded'?'브라우저 전체 영역으로 분석 확대 · Esc로 복귀':mode==='fit'?'분석 영역을 높이고 표 너비를 화면에 맞춤':'하단 기본 크기로 복귀';button.onclick=()=>select(mode);controls.append(button);}
  panel.querySelector('.dock-head').append(controls);panel.dataset.view='dock';controls.firstElementChild.setAttribute('aria-pressed','true');
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel.dataset.view==='expanded'&&!document.querySelector('dialog[open]')){select('dock');controls.lastElementChild.focus();}});
}
