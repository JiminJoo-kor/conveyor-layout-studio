/** Metadata only: never includes source drawing text. */
export function inspectDxfText(text){
 const lines=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');
 const sections=[],entities={};let section='',invalidPairs=0;
 for(let i=0;i+1<lines.length;i+=2){const code=Number(lines[i].trim()),value=lines[i+1].trim();if(!Number.isInteger(code))invalidPairs++;if(code===0&&value==='SECTION'){section=lines[i+3]?.trim()||'';sections.push(section);}else if(code===0&&value==='ENDSEC')section='';else if(section==='ENTITIES'&&code===0&&!['EOF','SEQEND','VERTEX'].includes(value))entities[value]=(entities[value]||0)+1;}
 return {characters:text.length,sections,entityTypes:entities,invalidPairs,hasEof:/\bEOF\s*$/.test(text)};
}
export function emptyDrawingError(text){const diagnostic=inspectDxfText(text);const error=new Error(diagnostic.sections.includes('ENTITIES')?'변환 결과의 도형 영역에서 읽을 수 있는 객체를 찾지 못했습니다. 원본 도면이 비어 있다는 뜻은 아닙니다.':'변환 결과에 도형 영역(ENTITIES)이 없습니다. 변환 결과의 구조를 확인해야 합니다.');error.diagnostic={stage:'도형 읽기',...diagnostic};return error;}
