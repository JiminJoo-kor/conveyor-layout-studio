import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {rankEngineeringCandidates} from '../src/engineering-run-audit.js';

const file=process.argv[2];if(!file)throw Error('사용법: node scripts/rank-engineering-candidates.mjs <layout.json> [type] [limit]');
const layout=JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,'')),type=process.argv[3]||'',limit=Math.max(1,Number(process.argv[4])||10),candidates=rankEngineeringCandidates(layout,type).slice(0,limit);
console.log(JSON.stringify({file:resolve(file),type:type||'all',candidates},null,2));
