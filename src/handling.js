import {clamp,tireGrip} from './core.js';

export function handlingGrip(car,weather){
  return tireGrip(car.tire,weather,car.wear)*(1+(car.setup.downforce-50)*.004)*(1-car.wing*.005)*(1-(car.rearWing||0)*.002);
}
export function steeringAuthority(car,weather){
  return 1.12*handlingGrip(car,weather)*(1-car.suspension*.006)*(.8+car.setup.suspension*.004);
}
export function steeringRate(car,weather,surfaceGrip=1){
  const speed=Math.abs(car.speed);
  return steeringAuthority(car,weather)*surfaceGrip/(1+speed*.012)*clamp(speed/7,0,1);
}
export function cornerLimit(car,weather,curvature){
  // Same yaw-rate limit as the steering physics: curvature * speed = yaw rate.
  const k=Math.max(.00001,Math.abs(curvature));
  return Math.min(car.setup.topSpeed/3.6,(-1+Math.sqrt(1+.048*steeringAuthority(car,weather)/k))/.024);
}
export function damageColor(value){return value<1?'#54dc83':value<25?'#efe65a':value<50?'#c9a52c':value<75?'#f38a32':'#f04b49';}
export function damageDiagram(car){
  const parts=[['wing','Front wing','<rect x="26" y="5" width="68" height="10" rx="2"/>'],['rearWing','Rear wing','<rect x="31" y="111" width="58" height="10" rx="2"/>'],['damage','Chassis','<path d="M55 19H65L77 66L72 104H48L43 66Z"/>'],['engine','Engine','<rect x="51" y="72" width="18" height="25" rx="3"/>'],['suspension','Suspension','<path d="M32 31L53 43M88 31L67 43M32 93L48 82M88 93L72 82" fill="none" stroke-width="5"/><rect x="22" y="22" width="12" height="24" rx="3"/><rect x="86" y="22" width="12" height="24" rx="3"/><rect x="22" y="83" width="12" height="24" rx="3"/><rect x="86" y="83" width="12" height="24" rx="3"/>']];
  return `<svg viewBox="0 0 120 128" role="img" aria-label="Car component damage">${parts.map(([key,label,shape])=>`<g data-component="${key}" fill="${damageColor(car[key]||0)}" stroke="${damageColor(car[key]||0)}"><title>${label}: ${Math.round(car[key]||0)}% damage</title>${shape}</g>`).join('')}</svg><div class="damage-readings">${parts.map(([key,label])=>`<div><span>${label}</span><b style="color:${damageColor(car[key]||0)}">${Math.round(car[key]||0)}%</b></div>`).join('')}<small>DAMAGE · GREEN → RED</small></div>`;
}
