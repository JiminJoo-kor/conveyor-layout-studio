import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runEngineeringComparison} from '../src/engineering-run-audit.js';

const file=process.argv[2];
if(!file)throw Error('사용법: node scripts/compare-engineering-runs.mjs <layout.json> [seconds] [types]');
const layout=JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,'')),seconds=Math.max(0,Number(process.argv[3])||0),types=process.argv[4]?.split(',').map(value=>value.trim()).filter(Boolean),result=runEngineeringComparison(layout,seconds,types);
console.log(JSON.stringify({file:resolve(file),...result},null,2));
