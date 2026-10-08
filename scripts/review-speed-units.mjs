import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {cloneLayout} from '../src/layout.js';
import {applyPlausibleSpeedUnitConversions} from '../src/speed-unit-review.js';
import {runEngineeringComparison} from '../src/engineering-run-audit.js';

const file=process.argv[2];if(!file)throw Error('사용법: node scripts/review-speed-units.mjs <layout.json> [seconds]');
const source=JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,'')),reviewLayout=cloneLayout(source),conversions=applyPlausibleSpeedUnitConversions(reviewLayout),seconds=Math.max(0,Number(process.argv[3])||0),result=runEngineeringComparison(reviewLayout,seconds);
console.log(JSON.stringify({file:resolve(file),sourceChanged:false,conversionCount:conversions.length,conversions,result},null,2));
