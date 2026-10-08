import {equipmentDriveDefaults} from './auto-engineering.js';

const rounded=value=>Number(value.toFixed(3));

export function speedUnitReview(item){
 if(item?.type!=='conveyor')return null;
 const requested=Math.max(0,Number(item.parameters?.speed)||0),limits=equipmentDriveDefaults.conveyor;
 if(requested<=limits.mechanicalMaxSpeed)return null;
 const converted=requested/60,plausibleAsMetersPerMinute=converted>0&&converted<=limits.mechanicalMaxSpeed;
 return{requestedMps:rounded(requested),mechanicalMaxMps:limits.mechanicalMaxSpeed,convertedMps:rounded(converted),plausibleAsMetersPerMinute,severity:plausibleAsMetersPerMinute?'unit-review':'range-review',message:plausibleAsMetersPerMinute?`${requested}가 m/min 입력이라면 ${rounded(converted)}m/s입니다.`:`${requested}m/s는 기계 최고속도 ${limits.mechanicalMaxSpeed}m/s를 초과합니다.`};
}
