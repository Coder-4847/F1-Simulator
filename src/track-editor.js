import {makeTrack,clamp} from './core.js';
export function segmentDistance(a,b,c,d){
  const cross=(p,q,r)=>(q.x-p.x)*(r.z-p.z)-(q.z-p.z)*(r.x-p.x);
  const x=cross(a,b,c),y=cross(a,b,d),u=cross(c,d,a),v=cross(c,d,b);
  if(x*y<0&&u*v<0)return 0;
  const point=(p,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);};
  return Math.min(point(a,c,d),point(b,c,d),point(c,a,b),point(d,a,b));
}
export function validateTrack(points,width){
  if(!Array.isArray(points)||points.length<4||points.length>60||!points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=1)))return 'Use 4–60 valid control points inside the editor.';
  if(!Number.isFinite(width)||width<10||width>20)return 'Track width must be between 10 and 20 meters.';
  if(points.some((p,i)=>Math.hypot(p[0]-points[(i+1)%points.length][0],p[1]-points[(i+1)%points.length][1])*1250<12))return 'Move neighboring nodes at least 12 meters apart.';
  const track=makeTrack(points,width),a=track.samples;
  if(!Number.isFinite(track.length)||track.length<500)return 'Make your circuit at least 500 meters long.';
  for(let i=0;i<a.length;i++)for(let j=i+2;j<a.length;j++){
    if(i===0&&j===a.length-1)continue;
    const distance=segmentDistance(a[i],a[(i+1)%a.length],a[j],a[(j+1)%a.length]);
    if(distance<.01)return 'The circuit crosses itself. Move the crossing nodes before saving.';
    const arc=Math.min(a[j].s-a[i].s,track.length-(a[j].s-a[i].s));
    if(arc>(width+16)*2&&distance<width+17)return 'Track sections are too close: leave room for both roads and barriers.';
  }
  return '';
}
export function insertionIndex(points,width,point){
  const a=makeTrack(points,width).samples,p={x:(point[0]-.5)*1250,z:(point[1]-.5)*1250};let best=Infinity,index=0;
  a.forEach((v,i)=>{const d=segmentDistance(p,p,v,a[(i+1)%a.length]);if(d<best){best=d;index=Math.floor(i/32)+1;}});return index;
}
