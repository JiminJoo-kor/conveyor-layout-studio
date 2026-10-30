import {analyzeCadText} from './cad-import.js';
self.onmessage=async({data})=>{
  try{
    self.postMessage({progress:{stage:'파일 읽기',done:null}});
    const text=await data.file.text();
    const result=analyzeCadText(text,{...data.options,onProgress:progress=>self.postMessage({progress})});
    self.postMessage({result});
  }catch(error){self.postMessage({error:error.message});}
};
