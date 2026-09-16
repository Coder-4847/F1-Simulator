import {atTrack} from './core.js';
import {moveWithinBarriers} from './world.js';

// Oriented car bodies; track progress is not a collision coordinate.
export function carContact(track,a,b){
  const pa=a.world||atTrack(track,a.distance,a.offset),pb=b.world||atTrack(track,b.distance,b.offset);
  const dx=pa.x-pb.x,dz=pa.z-pb.z;if(Math.hypot(dx,dz)>5.5)return null;
  const axes=c=>{const h=c.heading??atTrack(track,c.distance).yaw;return [{x:Math.sin(h),z:Math.cos(h)},{x:Math.cos(h),z:-Math.sin(h)}];};
  const aa=axes(a),bb=axes(b);let depth=Infinity,normal;
  for(const axis of [...aa,...bb]){
    const radius=axes=>2.35*Math.abs(axis.x*axes[0].x+axis.z*axes[0].z)+1.05*Math.abs(axis.x*axes[1].x+axis.z*axes[1].z);
    const projection=dx*axis.x+dz*axis.z,overlap=radius(aa)+radius(bb)-Math.abs(projection);
    if(overlap<=0)return null;
    if(overlap<depth){depth=overlap;const sign=projection<0?-1:1;normal={nx:axis.x*sign,nz:axis.z*sign};}
  }
  return {...normal,depth};
}
export function resolveCarContacts(r,dt,onImpact){
  for(let i=0;i<r.cars.length;i++)for(let j=i+1;j<r.cars.length;j++){
    const a=r.cars[i],b=r.cars[j];if(a.finished||b.finished||a.pitTime>0||b.pitTime>0)continue;
    const hit=carContact(r.track,a,b);if(!hit)continue;
    const {nx,nz,depth}=hit,wa=a.retired?0:1,wb=b.retired?0:1,total=wa+wb;if(!total)continue;
    const axis=c=>({x:Math.sin(c.travelHeading??c.heading??0),z:Math.cos(c.travelHeading??c.heading??0)}),fa=axis(a),fb=axis(b);
    const vx=fa.x*a.speed+(a.contactVX||0)-fb.x*b.speed-(b.contactVX||0),vz=fa.z*a.speed+(a.contactVZ||0)-fb.z*b.speed-(b.contactVZ||0);
    const closing=Math.max(0,-vx*nx-vz*nz),impulse=closing*1.03/total;
    const apply=(c,f,weight,sign)=>{
      if(!weight)return;
      const dx=nx*impulse*sign,dz=nz*impulse*sign,along=dx*f.x+dz*f.z;
      c.speed+=along;c.contactVX=(c.contactVX||0)+dx-along*f.x;c.contactVZ=(c.contactVZ||0)+dz-along*f.z;
      // Resolve overlap gradually instead of a fixed sideways teleport.
      const correction=Math.min(dt*14.4,Math.max(0,depth-.005)*(1-Math.exp(-dt*70)))*weight/total;
      moveWithinBarriers(r.track,c,nx*correction*sign,nz*correction*sign,c.heading);
      if(closing>2.5&&c.collisionCooldown===0){onImpact(r,c,closing*.5,nx*sign,nz*sign);c.collisionCooldown=.6;}
    };
    apply(a,fa,wa,1);apply(b,fb,wb,-1);
  }
}
export function aiPitNeed(r,c){
  if(c.finished||c.retired||c.pitTime>0)return '';
  const remaining=r.track.length*r.config.laps-c.distance;
  if(remaining<Math.min(350,r.track.length*.15))return '';
  if(c.wing>=45||(c.rearWing||0)>=50||c.suspension>=40||c.engine>=30||c.damage>=55)return 'repairs';
  if(c.wear>=65)return 'tires';
  if(c.fuel<Math.min(remaining,r.track.length*1.2)*.0021+1)return 'fuel';
  return '';
}
export function aiServiceTire(r,c){
  if(r.weather==='Heavy rain')return 'wet';if(r.weather==='Light rain')return 'intermediate';
  return (r.track.length*r.config.laps-c.distance)/r.track.length>4?'hard':'medium';
}
