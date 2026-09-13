import {atTrack, angleDiff, clamp, mod} from './core.js';

// One source of truth for the rendered wall, runoff and collision footprint.
export const RUNOFF = {curb: .85, verge: 1.6, wall: 8, wallHeight: 1.35, wallThickness: .4};
export const CAR_SHAPE = {radius: 1.3, probes: [-1.9, -.95, 0, .95, 1.9]};
export const SURFACES = {
  asphalt: {grip: 1, drag: 0, wear: 1, loose: 0},
  curb: {grip: .95, drag: .25, wear: 1.2, loose: 0},
  grass: {grip: .62, drag: 2.5, wear: 2, loose: .25},
  gravel: {grip: .4, drag: 5.5, wear: 5, loose: 1}
};
export function surfaceAt(track, offset) {
  const outside=Math.abs(offset)-track.width/2;
  return outside<=0?'asphalt':outside<=RUNOFF.curb?'curb':outside<=RUNOFF.verge?'grass':'gravel';
}
export function edgePoint(p,offset,y=0) {return [p.x+Math.cos(p.yaw)*offset,y,p.z-Math.sin(p.yaw)*offset];}
const wallsCache=new WeakMap();
export function barrierSegments(track) {
  if(wallsCache.has(track))return wallsCache.get(track);
  const walls=[];
  track.samples.forEach((p,i)=>{const q=track.samples[(i+1)%track.samples.length];
    for(const side of [-1,1]) {
      const a=edgePoint(p,side*(track.width/2+RUNOFF.wall)),b=edgePoint(q,side*(track.width/2+RUNOFF.wall));
      const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz)||1;
      let nx=-dz/length,nz=dx/length;
      if(nx*((p.x+q.x-a[0]-b[0])/2)+nz*((p.z+q.z-a[2]-b[2])/2)<0){nx=-nx;nz=-nz;}
      walls.push({a,b,nx,nz,length,index:i,side});
    }
  });wallsCache.set(track,walls);return walls;
}
export function projectTrack(track,x,z,reference=0) {
  const a=track.samples,index=atTrack(track,reference).index;let best=null,bestD=Infinity;
  for(let step=-12;step<=12;step++){
    const i=mod(index+step,a.length),p=a[i],q=a[(i+1)%a.length],dx=q.x-p.x,dz=q.z-p.z;
    const t=clamp(((x-p.x)*dx+(z-p.z)*dz)/(dx*dx+dz*dz||1),0,1),px=p.x+dx*t,pz=p.z+dz*t;
    const d2=(x-px)**2+(z-pz)**2;if(d2>=bestD)continue;bestD=d2;
    const raw=p.s+p.seg*t,distance=reference+mod(raw-reference+track.length/2,track.length)-track.length/2;
    best={distance,offset:(x-px)*Math.cos(p.yaw)-(z-pz)*Math.sin(p.yaw),yaw:p.yaw,index:i};
  }return best;
}
function nearbyWalls(track,distance) {
  const index=atTrack(track,distance).index,n=track.samples.length,walls=barrierSegments(track),out=[];
  for(let j=-16;j<=16;j++){const i=mod(index+j,n);out.push(walls[i*2],walls[i*2+1]);}return out;
}
function closest(wall,x,z) {
  const dx=wall.b[0]-wall.a[0],dz=wall.b[2]-wall.a[2];
  const t=clamp(((x-wall.a[0])*dx+(z-wall.a[2])*dz)/(wall.length**2),0,1);
  return {x:wall.a[0]+dx*t,z:wall.a[2]+dz*t};
}
export function footprintClearance(track,car) {
  const pos=car.world||atTrack(track,car.distance,car.offset),heading=car.heading??atTrack(track,car.distance).yaw;
  let clearance=Infinity;
  for(const wall of barrierSegments(track))for(const f of CAR_SHAPE.probes){
    const x=pos.x+Math.sin(heading)*f,z=pos.z+Math.cos(heading)*f,q=closest(wall,x,z);
    clearance=Math.min(clearance,Math.hypot(x-q.x,z-q.z)-CAR_SHAPE.radius);
  }return clearance;
}
export function moveWithinBarriers(track,car,dx,dz,heading=car.heading) {
  const start=car.world||atTrack(track,car.distance,car.offset);
  const margin=4+Math.hypot(dx,dz),minX=Math.min(start.x,start.x+dx)-margin,maxX=Math.max(start.x,start.x+dx)+margin;
  const minZ=Math.min(start.z,start.z+dz)-margin,maxZ=Math.max(start.z,start.z+dz)+margin;
  const walls=barrierSegments(track).filter(w=>Math.min(w.a[0],w.b[0])<=maxX&&Math.max(w.a[0],w.b[0])>=minX&&Math.min(w.a[2],w.b[2])<=maxZ&&Math.max(w.a[2],w.b[2])>=minZ);
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.25));let x=start.x,z=start.z,hit=false,nx=0,nz=0;
  // Swept overlapping circles cover the tires and wings. Finite segments,
  // including endpoints, avoid false half-plane collisions in hairpins.
  for(let step=0;step<steps;step++){
    x+=dx/steps;z+=dz/steps;
    for(let pass=0;pass<10;pass++){
      let corrected=false;
      for(const wall of walls)for(const f of CAR_SHAPE.probes){
        const px=x+Math.sin(heading)*f,pz=z+Math.cos(heading)*f,q=closest(wall,px,pz);
        const distance=Math.hypot(px-q.x,pz-q.z);
        if(distance>=CAR_SHAPE.radius)continue;
        nx=distance>.00001?(px-q.x)/distance:wall.nx;
        nz=distance>.00001?(pz-q.z)/distance:wall.nz;
        const push=CAR_SHAPE.radius-distance+.002;
        x+=nx*push;z+=nz*push;hit=true;corrected=true;
      }
      if(!corrected)break;
    }
  }
  const projected=projectTrack(track,x,z,car.distance);
  car.world={x,z};car.distance=projected.distance;car.offset=projected.offset;
  return {hit,nx,nz};
}
export function resetWorld(track,car) {
  const p=atTrack(track,car.distance,car.offset);car.world={x:p.x,z:p.z};car.heading=p.yaw;car.travelHeading=p.yaw;car.steering=0;car.slip=0;
}
export function ghostPose(ghost,time,track) {
  const a=ghost?.samples;if(!a?.length||time>ghost.time)return null;
  let lo=0,hi=a.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(a[mid].t<=time)lo=mid;else hi=mid-1;}
  const p=a[lo],q=a[Math.min(lo+1,a.length-1)],t=clamp((time-p.t)/(q.t-p.t||1),0,1);
  const distance=p.d+(q.d-p.d)*t,offset=p.o+(q.o-p.o)*t,fallback=atTrack(track,distance,offset);
  return {distance,offset,x:Number.isFinite(p.x)&&Number.isFinite(q.x)?p.x+(q.x-p.x)*t:fallback.x,z:Number.isFinite(p.z)&&Number.isFinite(q.z)?p.z+(q.z-p.z)*t:fallback.z,heading:Number.isFinite(p.h)&&Number.isFinite(q.h)?p.h+angleDiff(q.h,p.h)*t:fallback.yaw};
}
