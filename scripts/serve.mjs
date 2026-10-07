import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname,resolve,sep} from 'node:path';

const root=resolve('.'),port=Math.max(1,Number(process.env.PORT)||4173),host=process.env.HOST||'127.0.0.1',types={'.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),candidate=resolve(root,'.'+pathname),path=(await stat(candidate).catch(()=>null))?.isDirectory()?resolve(candidate,'index.html'):candidate;if(path!==root&&!path.startsWith(root+sep))throw Error('outside root');const info=await stat(path);if(!info.isFile())throw Error('not file');res.writeHead(200,{'content-type':types[extname(path).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});createReadStream(path).pipe(res);}catch{res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Not found');}}).listen(port,host,()=>console.log(`Conveyor Layout Studio · http://${host}:${port}`));
