import {analyzeCadText} from './cad-import.js';
import {convertBrowserDwg} from './browser-dwg.js';
self.onmessage=async({data})=>{
  try{
    const progress=value=>self.postMessage({progress:value});
    const text=/\.dwg$/i.test(data.file.name)?await convertBrowserDwg(data.file,{onProgress:progress}):await data.file.text();
    self.postMessage({result:analyzeCadText(text,{...data.options,onProgress:progress})});
  }catch(error){self.postMessage({error:error.message});}
};
