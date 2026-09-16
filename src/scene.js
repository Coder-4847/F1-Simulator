import {sceneryLayout} from './scenery.js';
import {atTrack,angleDiff} from './core.js';
import {linePoint,guideSpeed} from './racing-line.js';
import {RUNOFF,edgePoint,barrierSegments,ghostPose} from './world.js';

const views=new WeakMap();
function rgb(c){
  if(c.startsWith('#')){const n=parseInt(c.slice(1),16);return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];}
  return c.match(/[\d.]+/g).slice(0,3).map(n=>Math.min(255,+n)/255);
}
class Mesh {
  constructor(){this.data=[];}
  face(p,color,material=0){const c=rgb(color);for(let i=1;i<p.length-1;i++)for(const v of [p[0],p[i],p[i+1]])this.data.push(...v,...c,material);}
  box(x,y,z,w,h,d,color){
    const p=[[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y+h,z-d/2],[x-w/2,y+h,z-d/2],[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y+h,z+d/2],[x-w/2,y+h,z+d/2]];
    for(const f of [[0,1,2,3],[4,7,6,5],[0,3,7,4],[1,5,6,2],[3,2,6,7]])this.face(f.map(i=>p[i]),color);
  }
  cone(x,z,y,r,h,color){for(let i=0;i<8;i++){const a=i*Math.PI/4,b=(i+1)*Math.PI/4;this.face([[x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x,y+h,z],[x+Math.cos(b)*r,y,z+Math.sin(b)*r]],color);}}
}
// Colors use the same steering authority as the player, with a small turn-in margin.
export function buildRacingLine(race){
  const mesh=new Mesh(),p=race.cars[race.viewPlayer||0],track=race.track;
  for(let d=Math.floor(p.distance/5)*5;d<p.distance+240;d+=5){
    const target=guideSpeed(race,d);
    const color=p.speed>target+2?'#ff3333':p.speed>target-3?'#ffd52a':'#52f547';
    const a=linePoint(track,d),b=linePoint(track,d+3.6);
    mesh.face([edgePoint(a,-.42,.035),edgePoint(a,.42,.035),edgePoint(b,.42,.035),edgePoint(b,-.42,.035)],color);
  }
  return new Float32Array(mesh.data);
}
export function buildWorld(track){
  const m=new Mesh(),half=track.width/2,a=track.samples;
  m.face([[-3500,-.08,-3500],[3500,-.08,-3500],[3500,-.08,3500],[-3500,-.08,3500]],'#57933c',1);
  const strip=(p,q,l,r,y,c,mat=0)=>m.face([edgePoint(p,l,y),edgePoint(p,r,y),edgePoint(q,r,y),edgePoint(q,l,y)],c,mat);
  a.forEach((p,i)=>{
    const q=a[(i+1)%a.length];
    // Nested strips have distinct heights; depth testing handles every overlap.
    strip(p,q,-half-RUNOFF.wall,half+RUNOFF.wall,-.035,'#cbb58b',3);
    strip(p,q,-half-RUNOFF.verge,half+RUNOFF.verge,-.015,'#6cab44',1);
    strip(p,q,-half,half,.005,'#41484b',2);
    for(const side of [-1,1]){
      strip(p,q,side*half,side*(half+RUNOFF.curb),.025,i%4<2?'#efeee4':'#e34438');
      strip(p,q,side*(half-.16),side*half,.018,'#f6f2dc');
    }
  });
  for(const obj of sceneryLayout(track)){
    const {x,z,index:i,layer,side}=obj,p=a[i];
    if(obj.kind==='tree'){
      const colors=['#2f713b','#469047','#609b39','#347f57'];
      m.box(x,0,z,.55,2.8,.55,'#765034');m.cone(x,z,1.7,2.6+layer*.5,4+(i%3),colors[(i+layer)%4]);m.cone(x,z,3.8,1.9+layer*.3,3,colors[(i+layer+1)%4]);
    }else if(obj.kind==='post')m.box(x,0,z,.12,3.5,.12,'#788b91');
    else if(obj.kind==='flag'){
      m.box(x,0,z,.12,6,.12,'#d3dce0');m.face([[x,6,z],[x+2,5.6,z+.3],[x+2,4.7,z+.3],[x,5,z]],['#d8ff36','#ef6350','#61c8fa','#bc9aff'][i/12%4|0]);
    }else if(obj.kind==='tent'){
      m.box(x,0,z,10,3,7,'#e8e4ce');m.cone(x,z,3,8,3,'#ee7150');m.box(x,1,z-3.55,7,1.4,.08,'#3f778a');
    }else if(obj.kind==='stand'){
      const place=(lat,fwd,y)=>[x+Math.cos(p.yaw)*lat+Math.sin(p.yaw)*fwd,y,z-Math.sin(p.yaw)*lat+Math.cos(p.yaw)*fwd];
      for(let row=0;row<6;row++){
        const lat=side*(-4+row*1.3),height=.8+row*.7;
        m.face([place(lat,-13,height),place(lat,13,height),place(lat+side*1.3,13,height),place(lat+side*1.3,-13,height)],row%2?'#388bba':'#eed25d');
        for(let seat=0;seat<22;seat++){const t=place(lat,seat*1.15-12,height);m.box(t[0],t[1],t[2],.45,.6,.45,['#ed6751','#eadfc0','#384d91','#8dcdeb'][(seat+row)%4]);}
      }
      m.face([place(-5,-14,6.5),place(5,-14,7.5),place(5,14,7.5),place(-5,14,6.5)],'#e5e5d5');
      for(const f of [-13,13]){const t=place(side*4,f,0);m.box(t[0],0,t[2],.3,7.5,.3,'#536b76');}
    }
  }
  for(const wall of barrierSegments(track)){
    const {a,b,nx,nz,index}=wall,h=RUNOFF.wallHeight,w=RUNOFF.wallThickness;
    const c=index%16<8?'#f0eee3':'#e25443';
    m.face([a,[a[0],h,a[2]],[b[0],h,b[2]],b],c,4);
    m.face([[a[0],h,a[2]],[a[0]-nx*w,h,a[2]-nz*w],[b[0]-nx*w,h,b[2]-nz*w],[b[0],h,b[2]]],'#f7f2dc');
    m.face([[a[0]-nx*w,0,a[2]-nz*w],[b[0]-nx*w,0,b[2]-nz*w],[b[0]-nx*w,h,b[2]-nz*w],[a[0]-nx*w,h,a[2]-nz*w]],c);
  }
  const p=a[0],q=atTrack(track,1.5);
  for(let k=0;k<20;k++)strip(p,q,-half+k*track.width/20,-half+(k+1)*track.width/20,.03,k%2?'#fff9e1':'#24282b');
  for(let i=0;i<16;i++){const t=i*Math.PI/8;m.cone(Math.cos(t)*1600,Math.sin(t)*1600,-1,350,110+(i%4)*55,i%2?'#6a985e':'#80a46b');}
  return new Float32Array(m.data);
}
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function createView(canvas){
  const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
  if(!gl)throw Error('WebGL is required for the race view. Enable browser hardware acceleration.');
  const program=gl.createProgram();
  gl.attachShader(program,shader(gl,gl.VERTEX_SHADER,`
    attribute vec3 position;attribute vec3 color;attribute float material;
    uniform vec3 camera;uniform vec2 viewAngle;uniform float aspect;
    uniform vec3 model;uniform float heading;
    varying vec3 tint;varying vec3 world;varying float mat;varying float depth;
    void main(){
      float c=cos(heading),s=sin(heading);
      world=vec3(position.x*c+position.z*s,position.y,position.z*c-position.x*s)+model;
      vec3 d=world-camera;float cy=cos(viewAngle.x),sy=sin(viewAngle.x);
      float z=d.x*sy+d.z*cy,x=d.x*cy-d.z*sy;
      float y=d.y*cos(viewAngle.y)+z*sin(viewAngle.y);
      z=z*cos(viewAngle.y)-d.y*sin(viewAngle.y);
      gl_Position=vec4(x*1.55/aspect,y*1.55,z*1.000267-.400053,z);
      tint=color;mat=material;depth=z;
    }`));
  gl.attachShader(program,shader(gl,gl.FRAGMENT_SHADER,`
    precision mediump float;
    varying vec3 tint;varying vec3 world;varying float mat;varying float depth;
    uniform vec3 fog;uniform float wet;uniform float opacity;
    float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){
      vec3 c=tint;
      if(mat>.5){
        float scale=mat<1.5?1.6:mat<2.5?14.:7.;
        float n=hash(floor(world.xz*scale));
        c*=.88+n*.24;
        if(mat<1.5)c*=.93+.07*sin(world.x*.12)*sin(world.z*.09);
        if(mat>1.5&&mat<2.5)c=mix(c,c*.72+vec3(.04,.07,.09),wet*.7);
      }
      c=mix(c,fog,clamp((depth-140.)/1600.,0.,.88));
      gl_FragColor=vec4(c,opacity);
    }`));
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  const loc={};for(const n of ['camera','viewAngle','aspect','model','heading','fog','wet','opacity'])loc[n]=gl.getUniformLocation(program,n);
  const attributes=['position','color','material'].map(n=>gl.getAttribLocation(program,n));
  const overlay=document.createElement('canvas');overlay.setAttribute('aria-hidden','true');
  Object.assign(overlay.style,{position:'absolute',left:canvas.offsetLeft+'px',top:canvas.offsetTop+'px',pointerEvents:'none'});
  canvas.after(overlay);
  return {gl,program,loc,attributes,world:gl.createBuffer(),dynamic:gl.createBuffer(),track:null,overlay};
}
export function renderScene(canvas,race,dt,carMesh){
  let v=views.get(canvas);if(!v){v=createView(canvas);views.set(canvas,v);}
  const {gl,loc}=v,dpr=Math.min(window.devicePixelRatio||1,1.5);
  const w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  gl.viewport(0,0,w,h);gl.useProgram(v.program);
  const rainy=race.weather.includes('rain'),dark=race.weather==='Heavy rain',over=race.weather==='Overcast';
  const sky=dark?[.37,.46,.5]:rainy||over?[.62,.72,.75]:[.46,.72,.89];
  gl.clearColor(...sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const p=race.cars[race.viewPlayer||0],pos=p.world||atTrack(race.track,p.distance,p.offset),heading=p.heading??atTrack(race.track,p.distance).yaw;
  if(!v.camera||v.race!==race){v.camera={yaw:heading};v.race=race;}
  v.camera.yaw+=angleDiff(heading,v.camera.yaw)*(1-Math.exp(-dt*7));
  const yaw=v.camera.yaw;
  gl.uniform3f(loc.camera,pos.x-Math.sin(yaw)*8,4.8,pos.z-Math.cos(yaw)*8);
  gl.uniform2f(loc.viewAngle,yaw,.38);gl.uniform1f(loc.aspect,w/h);
  gl.uniform3f(loc.fog,...sky);gl.uniform1f(loc.wet,rainy?1:0);gl.uniform1f(loc.opacity,1);
  const bind=buffer=>{gl.bindBuffer(gl.ARRAY_BUFFER,buffer);v.attributes.forEach((a,i)=>{gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,i===2?1:3,gl.FLOAT,false,28,i===0?0:i===1?12:24);});};
  if(v.track!==race.track){v.track=race.track;const data=buildWorld(race.track);v.count=data.length/7;gl.bindBuffer(gl.ARRAY_BUFFER,v.world);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);}
  bind(v.world);gl.uniform3f(loc.model,0,0,0);gl.uniform1f(loc.heading,0);gl.drawArrays(gl.TRIANGLES,0,v.count);
  const guide=buildRacingLine(race);
  bind(v.dynamic);gl.bufferData(gl.ARRAY_BUFFER,guide,gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,guide.length/7);
  canvas.dataset.racingLine='dynamic';
  function drawCar(c,ghost=false){
    const point=c.world||atTrack(race.track,c.distance,c.offset);
    if(Math.hypot(point.x-pos.x,point.z-pos.z)>400)return;
    const mesh=new Mesh();for(const f of carMesh(c.livery,c.tire,c.wing??c.damage))mesh.face(f.p,ghost?'#a0f0ff':f.c);
    bind(v.dynamic);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.data),gl.DYNAMIC_DRAW);
    gl.uniform3f(loc.model,point.x,.04,point.z);gl.uniform1f(loc.heading,c.heading??atTrack(race.track,c.distance).yaw);
    gl.uniform1f(loc.opacity,ghost?.38:1);gl.drawArrays(gl.TRIANGLES,0,mesh.data.length/7);
  }
  for(const c of race.cars)drawCar(c);
  if(race.mode==='ghost'){
    const g=ghostPose(race.ghost,race.lapTime,race.track);
    if(g){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);drawCar({...g,world:g,livery:{},tire:'medium'},true);gl.depthMask(true);gl.disable(gl.BLEND);}
  }
  canvas.dataset.renderer='webgl';canvas.dataset.drawError=String(gl.getError());
  const overlay=v.overlay;overlay.width=w;overlay.height=h;overlay.style.width=canvas.clientWidth+'px';overlay.style.height=canvas.clientHeight+'px';
  const ctx=overlay.getContext('2d'),time=race.elapsed;
  if(rainy){
    ctx.strokeStyle=dark?'#e0ecf078':'#e0ecf04a';ctx.lineWidth=dpr;ctx.beginPath();
    for(let i=0;i<(dark?150:65);i++){const x=(i*137+time*230)%w,y=(i*89+time*560)%h;ctx.moveTo(x,y);ctx.lineTo(x-5*dpr,y+18*dpr);}ctx.stroke();
  }
  if(p.surface==='gravel'&&p.speed>2){
    for(let i=0;i<24;i++){const x=w*.5+Math.sin(i*4.2+time*2)*w*.15,y=h*.72+(i*13+time*40)%(h*.26);ctx.fillStyle='#cbb58b26';ctx.beginPath();ctx.arc(x,y,(9+i%6)*dpr,0,7);ctx.fill();}
  }
}
