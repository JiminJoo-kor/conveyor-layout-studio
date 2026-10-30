const copy=x=>JSON.parse(JSON.stringify(x));
export function buildCadQuestions(result,fileName){
  const questions=[],add=(kind,prompt,reason,item)=>questions.push({id:`Q${questions.length+1}`,kind,prompt,reason,item:item?copy(item):null,answer:''});
  for(const item of result.candidates){
    if(item.type==='unknown')add('equipment','이 부분은 어떤 설비인가요? 이름·역할 또는 설비가 아닌 도면 표시인지 알려주세요.','설비 종류를 확정하지 못했습니다.',item);
    if(item.source?.measurement?.review||item.source?.dimensionReviewRequired)add('dimension','실제 길이·폭·단위와 진행 방향은 무엇인가요? 곡선이면 중심선과 회전 방향도 설명해 주세요.',item.source?.measurement?.basis||'치수 확인 필요',item);
    add('flow','이 설비의 입구·출구는 어디이며 어느 설비와 연결되나요? 흐름 방향·분기 조건·대기 조건을 설명해 주세요. 해당 없으면 그 이유를 입력하세요.','도면의 근접·교차만으로 인계 연결을 확정할 수 없습니다.',item);
  }
  for(const warning of result.review?.warnings||[])add('drawing','이 경고와 관련된 도면 조건 또는 올바른 해석을 알려주세요. 모르면 “모르겠음”으로 답할 수 있습니다.',warning);
  if(!questions.length)add('drawing','이 도면에서 배치해야 하는 설비와 물류 흐름을 설명해 주세요.','설비 후보를 찾지 못했습니다.');
  return {version:1,fileName,createdAt:new Date().toISOString(),units:result.document?.units,transform:result.document?.toCanvasTransform,analysisReview:copy(result.review||{}),questions};
}
export function questionsComplete(state){return Boolean(state?.questions?.length)&&state.questions.every(q=>typeof q.answer==='string'&&q.answer.trim());}
export function buildQuestionReport(state){if(!questionsComplete(state))throw Error('모든 질문에 답변을 입력해야 로그를 생성할 수 있습니다.');return {...copy(state),exportedAt:new Date().toISOString(),purpose:'사용자 설명을 바탕으로 CAD 인식·치수·연결·배치를 재검토하기 위한 진단 자료. 답변은 자동 검증되거나 자동 적용되지 않았습니다.',unresolved:state.questions.filter(q=>/모르|불명|미확인|확인 필요/.test(q.answer)).map(q=>q.id)};}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function snapshot(geometry,question,transform){
  if(/^data:image\/(png|jpeg|webp);base64,/.test(question.userImage||''))return question.userImage;
  const canvas=document.createElement('canvas');canvas.width=600;canvas.height=320;const c=canvas.getContext('2d');c.fillStyle='#061722';c.fillRect(0,0,600,320);
  const item=question.item,m=item?.source?.measurement,scale=transform?.scale||1;
  let x=item?.x??600,y=item?.y??325,w=item?Math.max(35,(m?.rawLength||0)*scale*1.5,(m?.rawWidth||0)*scale*1.5):1200,h=item?w*.6:650;
  const zoom=Math.min(560/w,280/h);c.save();c.translate(300,160);c.scale(zoom,zoom);c.translate(-x,-y);c.lineWidth=1/zoom;
  for(const g of geometry||[]){c.strokeStyle=item&&g.rootIndex===item.source.rootIndex?'#ffb347':'#4795aa';c.beginPath();if(g.start&&g.end){c.moveTo(g.start.x,g.start.y);c.lineTo(g.end.x,g.end.y);}else if(g.vertices?.length){c.moveTo(g.vertices[0].x,g.vertices[0].y);for(const p of g.vertices.slice(1))c.lineTo(p.x,p.y);if(g.closed)c.closePath();}else if(g.center&&g.radius){c.arc(g.center.x,g.center.y,g.radius,g.startAngle??0,g.endAngle??Math.PI*2);}else if(g.center&&g.text){c.fillStyle='#a8d5df';c.font=`${12/zoom}px sans-serif`;c.fillText(g.text,g.center.x,g.center.y);}c.stroke();}
  if(item){c.strokeStyle='#ff668c';c.lineWidth=2/zoom;c.strokeRect(x-w*.32,y-h*.32,w*.64,h*.64);}c.restore();c.fillStyle='#fff';c.font='14px sans-serif';c.fillText(`${question.id} · ${item?.name||'전체 도면'}`.slice(0,65),12,22);
  if(!geometry?.length){c.fillText('변환된 도면 이미지 없음 · 원본 캡처를 첨부하세요.',18,170);}
  return canvas.toDataURL('image/png');
}
const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
function save(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function openCadQuestions(state,geometry){
  if(state.noGeometry)geometry=[];
  const dialog=node('dialog');dialog.style.cssText='width:min(1050px,92vw);max-height:90vh;overflow:auto;background:#0b2130;color:#d8f4ff;padding:20px;border:1px solid #29c9ec';
  const head=node('h2','도면 확인 질문 · 답변 후 상세 로그'),intro=node('p','이미지는 변환된 도면 선을 잘라 그린 참고 이미지입니다. 변환 중 누락된 객체는 보이지 않을 수 있습니다. 모르는 항목도 “모르겠음”으로 입력하면 미해결 항목으로 로그에 남습니다. 답변은 배치에 자동 적용되지 않습니다.'),status=node('p'),list=node('div'),prev=node('button','이전'),next=node('button','다음'),exportButton=node('button','답변 완료 · 이미지 포함 상세 로그 저장'),close=node('button','닫기');let page=0;
  const update=()=>{status.textContent=`${state.questions.filter(q=>q.answer.trim()).length}/${state.questions.length} 답변 · ${page+1}/${Math.ceil(state.questions.length/8)} 페이지`;exportButton.disabled=!questionsComplete(state);};
  function render(){list.replaceChildren();for(const q of state.questions.slice(page*8,page*8+8)){const card=node('section');card.style.cssText='padding:14px;border:1px solid #32738b;margin:12px 0';card.append(node('h3',q.id+' · '+(q.item?.name||'전체 도면')),node('p','확인 이유: '+q.reason));const img=node('img');img.src=snapshot(geometry,q,state.transform);img.alt=q.id+' 도면 일부';img.style.cssText='width:100%;max-width:600px';const label=node('label',q.prompt),answer=node('textarea');answer.rows=4;answer.maxLength=10000;answer.style.cssText='display:block;width:100%;box-sizing:border-box;margin:8px 0';answer.value=q.answer;answer.setAttribute('aria-label',q.id+' 답변');answer.oninput=()=>{q.answer=answer.value;update();};label.append(answer);card.append(img,label);list.append(card);}prev.disabled=page===0;next.disabled=(page+1)*8>=state.questions.length;update();}
  prev.onclick=()=>{page--;render();};next.onclick=()=>{page++;render();};close.onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
  const jsonButton=node('button','JSON 진단 저장');
  const oldUpdate=update;
  const captureLabel=node('label','원본 캡처 첨부(선택): '),captureQuestion=node('select'),capture=node('input'),captureStatus=node('span');capture.type='file';capture.accept='image/png,image/jpeg,image/webp';captureQuestion.setAttribute('aria-label','캡처를 첨부할 질문');for(const q of state.questions)captureQuestion.append(new Option(q.id+' '+(q.item?.name||'전체 도면'),q.id));captureLabel.append(captureQuestion,capture,captureStatus);
  capture.onchange=async()=>{const file=capture.files[0],q=state.questions.find(q=>q.id===captureQuestion.value);if(!file||!q)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){captureStatus.textContent='PNG·JPEG·WebP 이미지 5MB 이하를 선택하세요.';return;}q.userImage=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('이미지 읽기 실패'));reader.readAsDataURL(file);});captureStatus.textContent=q.id+' 캡처 첨부됨';capture.value='';render();};
  async function exportReport(format){
    if(!questionsComplete(state)){status.textContent='모든 질문에 답해주세요.';return;}
    exportButton.disabled=true;jsonButton.disabled=true;const report=buildQuestionReport(state);
    try{for(let i=0;i<report.questions.length;i++){report.questions[i].image=snapshot(geometry,report.questions[i],state.transform);if(i%8===0){status.textContent=`로그 이미지 준비 ${i+1}/${report.questions.length}`;await new Promise(resolve=>setTimeout(resolve,0));}}
      const name=state.fileName.replace(/[\\/:*?"<>|]/g,'_')+'-질문진단';
      if(format==='json'){save(name+'.json',JSON.stringify(report,null,2),'application/json');return;}
      save(name+'.html','<!doctype html><meta charset="utf-8"><title>CAD 질문 진단</title><style>body{max-width:1000px;margin:auto;font:16px/1.6 sans-serif}img{max-width:100%}pre{white-space:pre-wrap;overflow-wrap:anywhere}section{border-bottom:1px solid #888;padding:20px}</style><h1>'+escape(state.fileName)+' · 상세 진단</h1><p>'+escape(report.purpose)+'</p><p>미해결: '+escape(report.unresolved.join(', ')||'미해결 표기 없음 — 답변의 정확성은 별도 검증 필요')+'</p><pre>'+escape(JSON.stringify({version:report.version,units:report.units,transform:report.transform,createdAt:report.createdAt,exportedAt:report.exportedAt},null,2))+'</pre>'+report.questions.map(q=>'<section><h2>'+escape(q.id+' '+(q.item?.name||'전체 도면'))+'</h2><img src="'+q.image+'"><p>확인 이유: '+escape(q.reason)+'</p><p>'+escape(q.prompt)+'</p><pre>사용자 답변: '+escape(q.answer)+'</pre><details><summary>원본 식별·좌표·치수·분류 근거</summary><pre>'+escape(JSON.stringify(q.item,null,2))+'</pre></details></section>').join(''),'text/html');
    }finally{oldUpdate();jsonButton.disabled=!questionsComplete(state);}
  }
  exportButton.onclick=()=>exportReport('html');jsonButton.onclick=()=>exportReport('json');jsonButton.disabled=!questionsComplete(state);list.addEventListener('input',()=>jsonButton.disabled=!questionsComplete(state));
  dialog.append(head,intro,status,prev,next,exportButton,jsonButton,close,captureLabel,list);document.body.append(dialog);render();dialog.showModal();
}
