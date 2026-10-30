import {analyzeCadText} from './cad-import.js';
import {convertBrowserDwg} from './browser-dwg.js';
self.onmessage=async({data})=>{
  const isDwg=/\.dwg$/i.test(data.file.name);let stage=isDwg?'DWG 변환':'DXF 읽기';
  try{
    const progress=value=>self.postMessage({progress:value});
    const text=/\.dwg$/i.test(data.file.name)?await convertBrowserDwg(data.file,{onProgress:progress}):await data.file.text();
    stage='도형 분석';
    self.postMessage({result:analyzeCadText(text,{...data.options,onProgress:progress})});
  }catch(error){self.postMessage({error:error.message,diagnostic:{inputFormat:isDwg?'DWG':'DXF',fileBytes:data.file.size,stage,...error.diagnostic}});}
};
