import test from 'node:test';
import assert from 'node:assert/strict';
import {drawingAvailable,drawingOnlyLayout} from '../src/drawing-viewer.js';
test('drawing viewer supports converted CAD, DXF geometry and reference images',()=>{
 assert.equal(drawingAvailable({}),false);
 for(const layout of [{cadPreviewRaster:'data:image/png;base64,x'},{cadPreviewSvg:'<svg/>'},{dxfGeometry:[{}]},{background:{dataUrl:'x'}}])assert.equal(drawingAvailable(layout),true);
});
test('independent drawing view cannot relocate or remove simulation equipment',()=>{
 const layout={canvas:{width:1200,height:650},equipment:[{id:'a',x:2,y:3}],connections:[{from:'a'}],cadSchematic:{edges:[{from:'a'}]},cadViewMode:'hybrid'};
 const before=JSON.stringify(layout),view=drawingOnlyLayout(layout);view.canvas.width=300;view.equipment.push({id:'b'});
 assert.equal(JSON.stringify(layout),before);assert.equal(view.cadViewMode,'raw');assert.deepEqual(view.cadSchematic.edges,[]);
});
