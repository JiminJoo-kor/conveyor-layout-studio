import {readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {spawnSync} from 'node:child_process';

const roots=['src','scripts','api'],extensions=new Set(['.js','.mjs']),files=[];
const visit=directory=>{for(const entry of readdirSync(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())visit(path);else if([...extensions].some(extension=>entry.name.endsWith(extension)))files.push(path);}};
for(const root of roots)try{visit(root);}catch(error){if(error.code!=='ENOENT')throw error;}
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0){process.stderr.write(result.stderr||result.stdout);process.exit(result.status||1);}}
console.log(`Syntax OK · ${files.length} files · ${files.map(file=>relative('.',file)).slice(0,3).join(', ')}${files.length>3?', …':''}`);
