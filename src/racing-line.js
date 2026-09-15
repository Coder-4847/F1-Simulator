import {atTrack,angleDiff,clamp,mod} from './core.js';
import {cornerLimit,handlingGrip} from './handling.js';
const paths=new WeakMap();
export function racingPath(track){
  if(paths.has(track))return paths.get(track);
  const count=Math.ceil(track.length/5),step=track.length/count;
  const centers=Array.from({length:count},(_,i)=>atTrack(track,i*step)),offsets=new Float64Array(count);
  const margin=Math.max(0,track.width/2-2.2);
  // Relax the path toward neighboring chords within the usable road width.
  // This cuts apexes and opens exits without snapping between corner offsets.
  for(let pass=0;pass<180;pass++){
    const next=offsets.slice();
    for(let i=0;i<count;i++){
      const a=mod(i-1,count),b=(i+1)%count,p=centers[i];
      const x=(centers[a].x+Math.cos(centers[a].yaw)*offsets[a]+centers[b].x+Math.cos(centers[b].yaw)*offsets[b])/2;
      const z=(centers[a].z-Math.sin(centers[a].yaw)*offsets[a]+centers[b].z-Math.sin(centers[b].yaw)*offsets[b])/2;
      next[i]=clamp(offsets[i]+.45*((x-p.x)*Math.cos(p.yaw)-(z-p.z)*Math.sin(p.yaw)-offsets[i]),-margin,margin);
    }
    offsets.set(next);
  }
  const points=centers.map((p,i)=>({...p,x:p.x+Math.cos(p.yaw)*offsets[i],z:p.z-Math.sin(p.yaw)*offsets[i],offset:offsets[i]}));
  points.forEach((p,i)=>{const a=points[mod(i-1,count)],b=points[(i+1)%count];p.yaw=Math.atan2(b.x-a.x,b.z-a.z);});
  points.forEach((p,i)=>{const a=points[mod(i-1,count)],b=points[(i+1)%count];p.curvature=angleDiff(b.yaw,a.yaw)/Math.max(1,Math.hypot(b.x-a.x,b.z-a.z));});
  const path={points,step};paths.set(track,path);return path;
}
export function linePoint(track,distance){
  const {points,step}=racingPath(track),n=mod(distance,track.length)/step,i=Math.floor(n),t=n-i,a=points[i],b=points[(i+1)%points.length];
  return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,yaw:a.yaw+angleDiff(b.yaw,a.yaw)*t,curvature:a.curvature+(b.curvature-a.curvature)*t};
}
export function guideSpeed(race,distance){
  const car=race.cars[race.viewPlayer||0],grip=handlingGrip(car,race.weather),braking=Math.max(3,(14+car.setup.brakes*.13)*grip*.9);
  let target=car.setup.topSpeed/3.6;
  for(let look=0;look<=160;look+=10){
    const corner=cornerLimit(car,race.weather,linePoint(race.track,distance+look).curvature)*.96;
    target=Math.min(target,Math.sqrt(corner*corner+2*braking*look));
  }
  return target;
}
