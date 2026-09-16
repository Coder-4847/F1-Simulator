import {clamp} from './core.js';
import {RUNOFF,edgePoint} from './world.js';
// Check the complete circuit, including the closing segment and other nearby bends.
export function sceneryClear(track,x,z,radius){
  const clearance=track.width/2+RUNOFF.wall+radius+1;
  return track.samples.every((p,i)=>{const q=track.samples[(i+1)%track.samples.length],dx=q.x-p.x,dz=q.z-p.z,t=clamp(((x-p.x)*dx+(z-p.z)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(x-p.x-dx*t,z-p.z-dz*t)>clearance;});
}
export function sceneryLayout(track){
  const objects=[],half=track.width/2;
  const add=(kind,p,index,side,offset,radius,layer=0)=>{const t=edgePoint(p,side*offset);if(sceneryClear(track,t[0],t[2],radius))objects.push({kind,x:t[0],z:t[2],radius,index,side,layer});};
  track.samples.forEach((p,i)=>{
    for(const side of [-1,1]){
      if(i%4===0)for(let layer=0;layer<3;layer++)add('tree',p,i,side,half+14+layer*14+(i*13%9),2.6+layer*.5,layer);
      if(i%12===0){add('post',p,i,side,half+10,.1);add('flag',p,i,side,half+13,2.3);}
    }
    if(i%48===12)add('stand',p,i,i%96===12?1:-1,half+30,16);
    if(i%64===32)add('tent',p,i,1,half+32,8);
  });return objects;
}
