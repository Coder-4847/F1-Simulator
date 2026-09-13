import {renderScene} from './scene.js';
import { atTrack, angleDiff, TIRES } from './core.js';

export function fitCanvas(canvas) {
  const dpr=Math.min(window.devicePixelRatio||1,2), w=canvas.clientWidth,h=canvas.clientHeight;
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,w,h};
}
function shade(hex, n) {const v=parseInt(hex.replace('#',''),16);return `rgb(${Math.min(255,((v>>16)&255)*n)},${Math.min(255,((v>>8)&255)*n)},${Math.min(255,(v&255)*n)})`;}
export function carMesh(car={}, tire='medium', damage=0) {
  const primary=car.primary||'#d8ff36',secondary=car.secondary||'#222b25',accent=car.accent||'#f4f6e9';const faces=[];
  function poly(p,c){faces.push({p,c});}
  function box(x,y,z,w,h,l,c){const v=[[x-w/2,y,z-l/2],[x+w/2,y,z-l/2],[x+w/2,y+h,z-l/2],[x-w/2,y+h,z-l/2],[x-w/2,y,z+l/2],[x+w/2,y,z+l/2],[x+w/2,y+h,z+l/2],[x-w/2,y+h,z+l/2]];[[[3,2,6,7],1.13],[[0,1,2,3],.57],[[4,7,6,5],.9],[[0,3,7,4],.72],[[1,5,6,2],.87]].forEach(([ids,s])=>poly(ids.map(i=>v[i]),shade(c,s)));}
  // World units: approximately 5.6 m long, 2 m wide. +Z is the nose.
  box(0,.17,-.05,1.7,.08,3.7,secondary); // floor
  box(0,.3,-.35,.67,.55,2.3,primary); // monocoque
  box(-.61,.28,-.6,.53,.37,1.8,primary);box(.61,.28,-.6,.53,.37,1.8,primary);
  poly([[-.36,.86,-1.5],[.36,.86,-1.5],[.25,1.12,-.4],[-.25,1.12,-.4]],secondary);
  poly([[-.25,1.12,-.4],[.25,1.12,-.4],[.12,.6,-1.95],[-.12,.6,-1.95]],primary);
  // Tapered nose, cockpit and halo.
  poly([[-.33,.78,.2],[.33,.78,.2],[.12,.38,2.45],[-.12,.38,2.45]],primary);
  poly([[-.33,.78,.2],[-.12,.38,2.45],[-.12,.24,2.45],[-.33,.3,.2]],shade(primary,.68));
  poly([[.33,.78,.2],[.33,.3,.2],[.12,.24,2.45],[.12,.38,2.45]],shade(primary,.8));
  box(0,.82,0,.48,.025,.65,'#0b100e');box(0,.85,-.12,.28,.24,.28,accent);
  box(-.28,.96,.06,.065,.065,.85,secondary);box(.28,.96,.06,.065,.065,.85,secondary);box(0,.96,.46,.62,.065,.07,secondary);box(0,.72,.43,.045,.28,.045,secondary);
  box(0,.88,-.68,.25,.38,.27,primary);
  if(damage<85){box(0,.19,2.3,1.97,.08,.47,secondary);box(0,.28,2.25,1.86,.055,.25,primary);box(-.96,.15,2.3,.055,.25,.54,accent);box(.96,.15,2.3,.055,.25,.54,accent);}
  box(-.5,.45,-2.04,.06,.65,.13,secondary);box(.5,.45,-2.04,.06,.65,.13,secondary);box(0,1.05,-2.12,1.6,.08,.47,primary);box(0,1.17,-2.21,1.6,.06,.2,secondary);box(-.83,.79,-2.12,.045,.5,.55,accent);box(.83,.79,-2.12,.045,.5,.55,accent);
  for(const z of [-1.48,1.53])for(const x of [-.94,.94]){
    box(x*.58,.36,z,.7,.05,.08,secondary);box(x*.58,.49,z-.13,.7,.04,.06,secondary);
    const radius=.37,width=.37,N=14;
    for(let i=0;i<N;i++){const a=i/N*Math.PI*2,b=(i+1)/N*Math.PI*2;poly([[x-width/2,.4+Math.sin(a)*radius,z+Math.cos(a)*radius],[x+width/2,.4+Math.sin(a)*radius,z+Math.cos(a)*radius],[x+width/2,.4+Math.sin(b)*radius,z+Math.cos(b)*radius],[x-width/2,.4+Math.sin(b)*radius,z+Math.cos(b)*radius]],i<7?'#222623':'#131613');}
    for(const side of [-1,1]){
      const xx=x+side*width/2;
      poly(Array.from({length:N},(_,i)=>[xx,.4+Math.sin(i/N*Math.PI*2)*radius,z+Math.cos(i/N*Math.PI*2)*radius]),'#151a16');
      poly(Array.from({length:N},(_,i)=>[xx+side*.002,.4+Math.sin(i/N*Math.PI*2)*.275,z+Math.cos(i/N*Math.PI*2)*.275]),TIRES[tire]?.color||'#f2cb55');
      poly(Array.from({length:N},(_,i)=>[xx+side*.004,.4+Math.sin(i/N*Math.PI*2)*.245,z+Math.cos(i/N*Math.PI*2)*.245]),'#1b201c');
      poly(Array.from({length:10},(_,i)=>[xx+side*.008,.4+Math.sin(i/10*Math.PI*2)*.14,z+Math.cos(i/10*Math.PI*2)*.14]),car.rim||'#9ca394');
    }
  }
  if(car.pattern==='Stripes')for(const x of [-.14,.14])poly([[x-.035,.792,.25],[x+.035,.792,.25],[x+.025,.395,2.3],[x-.025,.395,2.3]],accent);
  if(car.pattern==='Split')poly([[0,.79,.22],[.26,.79,.22],[.1,.39,2.4],[0,.39,2.4]],accent);
  if(car.pattern==='Chevron'){poly([[-.3,.8,.35],[0,.65,1.18],[.3,.8,.35],[.22,.8,.35],[0,.7,.87],[-.22,.8,.35]],secondary);}
  return faces;
}
export function drawGarage(canvas, car, rotation=-.65, time=0) {
  const {ctx,w,h}=fitCanvas(canvas);ctx.clearRect(0,0,w,h);
  const scale=Math.min(w/7.3,h/4.6);const pitch=.34;
  const project=([x,y,z])=>{const xx=x*Math.cos(rotation)+z*Math.sin(rotation), zz=z*Math.cos(rotation)-x*Math.sin(rotation);return {x:w*.52+xx*scale,y:h*.57+(zz*Math.sin(pitch)-y*Math.cos(pitch))*scale,d:-zz*Math.cos(pitch)-y*Math.sin(pitch)};};
  ctx.save();ctx.translate(w*.52,h*.67);ctx.scale(1,.23);const gr=ctx.createRadialGradient(0,0,5,0,0,scale*2.8);gr.addColorStop(0,'#020700a0');gr.addColorStop(1,'#02070000');ctx.fillStyle=gr;ctx.fillRect(-scale*3,-scale*3,scale*6,scale*6);ctx.restore();
  const faces=carMesh(car).map(f=>({...f,v:f.p.map(project)})).sort((a,b)=>b.v.reduce((s,v)=>s+v.d,0)/b.v.length-a.v.reduce((s,v)=>s+v.d,0)/a.v.length);
  for(const f of faces){ctx.beginPath();f.v.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=f.c;ctx.fill();ctx.strokeStyle=f.c;ctx.lineWidth=.5;ctx.stroke();}
  const num=project([0,.795,1.03]);ctx.save();ctx.translate(num.x,num.y);ctx.rotate(-.12);ctx.fillStyle=car.secondary;ctx.font=`italic bold ${scale*.22}px Arial`;ctx.textAlign='center';ctx.fillText(car.number||27,0,0);ctx.restore();
  ctx.strokeStyle='#a8bc7020';ctx.beginPath();ctx.moveTo(w*.17,h*.86);ctx.lineTo(w*.84,h*.86);ctx.stroke();
}
export function drawMap(canvas, track, options={}) {
  const {ctx,w,h}=fitCanvas(canvas);ctx.clearRect(0,0,w,h);const a=track.samples;
  const minX=Math.min(...a.map(p=>p.x)),maxX=Math.max(...a.map(p=>p.x)),minZ=Math.min(...a.map(p=>p.z)),maxZ=Math.max(...a.map(p=>p.z));const sc=Math.min((w-35)/(maxX-minX),(h-30)/(maxZ-minZ));
  const proj=p=>({x:(p.x-(minX+maxX)/2)*sc+w/2,y:(p.z-(minZ+maxZ)/2)*sc+h/2});
  ctx.lineJoin='round';ctx.lineCap='round';
  for(const [width,color] of [[8,'#50603b'],[4,options.color||'#c6d6a4']]){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();a.forEach((p,i)=>{const v=proj(p);i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y);});ctx.closePath();ctx.stroke();}
  const s=proj(a[0]);ctx.fillStyle='#d8ff36';ctx.fillRect(s.x-4,s.y-4,8,8);
  for(const c of options.cars||[]){const p=proj(atTrack(track,c.distance,c.offset));ctx.beginPath();ctx.arc(p.x,p.y,c.id===0?4:2.5,0,7);ctx.fillStyle=c.id===0?'#d8ff36':c.color||'#fff';ctx.fill();}
}
export function drawRace(canvas,race,dt=1/60){renderScene(canvas,race,dt,carMesh);}
