self.onmessage=async({data})=>{
  const isDwg=/\.dwg$/i.test(data.file.name);let stage=isDwg?'DWG 변환':'DXF 읽기';
  try{
    const progress=value=>self.postMessage({progress:value});
    progress({stage:'도면 분석 모듈 준비',done:null});
    const [{parseDxf},{rasterCadPreview},{analyzeCadWithPreview}]=await Promise.all([import('./dxf.js'),import('./cad-raster-preview.js'),import('./cad-preview.js')]);
    const text=/\.dwg$/i.test(data.file.name)?await (await import('./browser-dwg.js')).convertBrowserDwg(data.file,{onProgress:progress}):await data.file.text();
    stage='도형 분석';
    const document=parseDxf(text),result=analyzeCadWithPreview(text,{...data.options,parsedDocument:document,includeSvg:false,onProgress:progress});
    stage='도면 표시 준비';result.document.previewRaster=await rasterCadPreview(document,result.document.toCanvasTransform,{onProgress:progress});
    self.postMessage({result});
  }catch(error){self.postMessage({error:error.message,diagnostic:{inputFormat:isDwg?'DWG':'DXF',fileBytes:data.file.size,stage,...error.diagnostic}});}
};

