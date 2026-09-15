import {TEAMS,atTrack,angleDiff,clamp,mod} from './core.js';
import {handlingGrip,steeringRate} from './handling.js';
import {SURFACES,surfaceAt,moveWithinBarriers,resetWorld} from './world.js';

export function createRace(state,track,mode='race',round=null){
  const config={...state.race,...(round?{laps:round.laps,weather:round.weather,tire:round.tire||state.race.tire,fuel:round.fuel??state.race.fuel}:{} )};
  config.difficulty=clamp(Number.isFinite(Number(config.difficulty))?Number(config.difficulty):70,0,100);
  const grid=mode==='race'?10:1;
  const cars=Array.from({length:grid},(_,id)=>{const team=TEAMS[Math.floor(id/2)];return {id,name:team.drivers[id%2],team:team.name,color:team.color,setup:{...state.car,...(id===0?{}:state.cars[id]||{})},livery:id===0?{...state.car}:{primary:team.color,secondary:team.secondary,accent:'#edf1db',number:id+8,pattern:'Split',...(state.cars[id]||{})},distance:-id*7,offset:id%2?2.4:-2.4,heading:null,speed:0,tire:config.tire,wear:0,fuel:config.fuel,damage:0,wing:0,rearWing:0,engine:0,suspension:0,pitTime:0,pitted:[],finished:false,finishTime:0,collisionCooldown:0};});
  cars[0].offset=0;cars[0].distance=0;
  return {track,cars,mode,config,weather:config.weather,setup:{...state.car},elapsed:0,lapTime:0,lap:1,lastLap:0,best:Infinity,lapStart:0,samples:[{t:0,d:0,o:0,x:track.samples[0].x,z:track.samples[0].z,h:track.samples[0].yaw}],sampleTimer:0,ghost:state.records[track.id]?.ghost||null,paused:false,finished:false,countdown:3,steer:0,message:'',messageUntil:0,pitRequested:false,pitTire:config.pitTire,pitFuel:config.fuel,pitPlan:mode==='race'?(round?structuredClone(round.pits||[]):[{lap:config.pitLap,tire:config.pitTire}]).filter(s=>s.lap>=2):[],finishOrder:[],newRecord:false,offTrackTime:0};
}
export function message(r,text,seconds=3){r.message=text;r.messageUntil=r.elapsed+seconds;}
export function stepRace(r,keys,dt,onLap=()=>{}){
  if(dt>1/120){const count=Math.ceil(Math.min(dt,.05)*120);for(let i=0;i<count;i++)stepRace(r,keys,Math.min(dt,.05)/count,onLap);return;}
  if(r.paused||r.finished)return;
  dt=clamp(dt,0,.05);
  if(r.countdown>0){r.countdown-=dt;return;}
  r.elapsed+=dt;r.lapTime=r.elapsed-r.lapStart;
  const p=r.cars[0];const steerInput=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0);
  r.steer+=(steerInput-r.steer)*(1-Math.exp(-dt*7));
  for(const c of r.cars){
    if(c.finished||c.retired)continue;
    c.collisionCooldown=Math.max(0,c.collisionCooldown-dt);
    const setup=c.setup;
    const lap=Math.max(1,Math.floor(c.distance/r.track.length)+1),progress=mod(c.distance,r.track.length);
    const plan=r.pitPlan.find(s=>s.lap===lap&&!c.pitted.includes(s.lap));
    if(c.speed>=0&&c.lastPitLap!==lap&&progress<75&&c.distance>r.track.length*.8&&(plan||(c.id===0&&r.pitRequested))&&!c.pitTime){
      c.pitTime=5.2;c.lastPitLap=lap;c.pitted.push(lap);c.speed=0;c.offset=-r.track.width/2-3;resetWorld(r.track,c);c.nextTire=c.id===0&&r.pitRequested?r.pitTire:plan?.tire||r.config.pitTire;
      if(c.id===0){r.pitRequested=false;message(r,'Pit stop · tires, repairs & fuel',5);}
    }
    if(c.pitTime>0){c.pitTime-=dt;if(c.pitTime<=0){c.pitTime=0;c.tire=c.nextTire;c.wear=0;c.damage*=.3;c.wing=0;c.rearWing=0;c.suspension*=.5;c.engine*=.7;c.fuel=c.id===0?r.pitFuel:r.config.fuel;c.offset=-2;resetWorld(r.track,c); if(c.id===0)message(r,'Go, go, go!');}continue;}
    if(!c.world)resetWorld(r.track,c);
    const pos=atTrack(r.track,c.distance),ahead=atTrack(r.track,c.distance+45);
    const curvature=Math.abs(angleDiff(ahead.yaw,pos.yaw));
    c.surface=surfaceAt(r.track,c.offset);const surface=SURFACES[c.surface];
    const grip=surface.grip*handlingGrip(c,r.weather);
    const cornerSpeed=clamp(90-curvature*85,20,95)*Math.sqrt(grip);
    let throttle=1,brake=0,reverse=false,forward=false;
    if(c.id===0){throttle=(keys.has('ArrowUp')||keys.has('w'))?1:0;brake=(keys.has('ArrowDown')||keys.has('s')||keys.has(' '))?1:0;
      forward=throttle===1;reverse=(keys.has('s')||keys.has('ArrowDown'))&&!forward&&!keys.has(' ');
      if(brake)throttle=0;
      if(!Number.isFinite(c.heading))c.heading=pos.yaw;
      const rate=steeringRate(c,r.weather,surface.grip);
      c.yawSlip=(c.yawSlip||0)*Math.exp(-dt*3)+r.steer*surface.loose*clamp((Math.abs(c.speed)-5)/20,0,1)*dt*2;
      c.heading+=(r.steer*rate+c.yawSlip)*Math.sign(c.speed)*dt;
      c.travelHeading ??= c.heading;
      c.travelHeading+=angleDiff(c.heading,c.travelHeading)*(1-Math.exp(-dt*(surface.loose?2.2:24)));
      const turn=angleDiff(ahead.yaw,pos.yaw);
      if(c.speed>cornerSpeed*1.2&&Math.abs(turn)>.15)r.offTrackTime+=dt;else r.offTrackTime=0;
    }else{
      const target=Math.min(setup.topSpeed/3.6,cornerSpeed)*( .50+r.config.difficulty*.0046+(c.id%3)*.014);
      throttle=c.speed<target?1:.13;brake=c.speed>target+3?.7:0;
      let targetOffset=(c.id%2?1:-1)*2.3+Math.sin(r.elapsed*.45+c.id)*.65;
      const front=r.cars.find(o=>o!==c&&o.distance>c.distance&&o.distance-c.distance<18&&Math.abs(o.offset-c.offset)<1.9);
      if(front)targetOffset=front.offset>0?-3.5:3.5;
      c.targetOffset=targetOffset;
    }
    const top=(setup.topSpeed/3.6)*(1-(setup.downforce-50)*.0018)*(1-c.engine*.006)*(1-c.damage*.0015);
    const mass=1+c.fuel*.006;
    const speed=Math.abs(c.speed),reverseDrive=c.id===0&&reverse&&c.speed<=0;
    const direction=reverseDrive||c.speed<0?-1:1;
    const driving=direction<0?Number(reverseDrive):throttle;
    const braking=direction<0?Number(forward||keys.has(' ')):brake;
    // Loose surfaces limit steering grip, but wheels retain enough drive traction to escape.
    const traction=surface.loose?Math.max(grip,.72):grip;
    const driveTop=direction<0?8:surface.loose?Math.min(top,25):top;
    const drag=surface.loose?(surface.loose===1?.009:.006)*speed*speed:surface.drag*(clamp(speed/6,0,1)+speed*.08);
    const acceleration=driving*12.5*(1-speed/(driveTop*1.13))*traction/mass-braking*(14+setup.brakes*.13)*grip-.45-speed*speed*.00013-drag;
    c.speed=direction*clamp(speed+acceleration*dt,0,c.fuel<=0?0:direction<0?8:top);
    if(!c.world)resetWorld(r.track,c);
    let dx,dz,nextDistance,nextOffset;
    if(c.id===0){dx=Math.sin(c.travelHeading??c.heading)*c.speed*dt;dz=Math.cos(c.travelHeading??c.heading)*c.speed*dt;}
    else {nextDistance=c.distance+c.speed*dt;nextOffset=c.offset+(c.targetOffset-c.offset)*dt*1.6;const next=atTrack(r.track,nextDistance,nextOffset);dx=next.x-c.world.x;dz=next.z-c.world.z;c.heading=next.yaw;}
    const collision=moveWithinBarriers(r.track,c,dx,dz,c.heading);
    if(c.id!==0&&!collision.hit){c.distance=nextDistance;c.offset=nextOffset;}
    if(collision.hit){
      const normalSpeed=Math.abs((dx*collision.nx+dz*collision.nz)/Math.max(dt,.001));
      c.speed*=Math.max(.05,1-normalSpeed/Math.max(Math.abs(c.speed),1));
      if(normalSpeed>3&&c.collisionCooldown===0){impact(r,c,Math.max(3,normalSpeed*.55),collision.nx,collision.nz);c.collisionCooldown=.6;}
    }
    c.fuel=Math.max(0,c.fuel-Math.abs(c.speed)*dt*.0021*(.7+throttle*.3));
    c.wear=clamp(c.wear+Math.abs(c.speed)*dt*.003*({soft:1.6,medium:1,hard:.65,intermediate:1.1,wet:1.2}[c.tire])*surface.wear*(r.weather==='Clear'&&['wet','intermediate'].includes(c.tire)?2:1),0,100);
    if(c.fuel<=0&&c.id===0){message(r,'Out of fuel · press R to recover to the pits',1);}
    if(c.id!==0&&r.mode==='race'&&c.distance>=r.track.length*r.config.laps){c.finished=true;c.finishTime=r.elapsed;r.finishOrder.push(c.id);}
  }
  if(r.mode==='race')for(let i=0;i<r.cars.length;i++)for(let j=i+1;j<r.cars.length;j++){
    const a=r.cars[i],b=r.cars[j];if(a.pitTime>0||b.pitTime>0||a.finished||b.finished)continue;
    const gap=Math.abs(mod(a.distance-b.distance+r.track.length/2,r.track.length)-r.track.length/2);
    if(gap<4.1&&Math.abs(a.offset-b.offset)<1.7&&a.collisionCooldown===0&&b.collisionCooldown===0){const strength=3+Math.abs(a.speed-b.speed)*.45;const ax=(a.world?.x||0)-(b.world?.x||0),az=(a.world?.z||0)-(b.world?.z||0),length=Math.hypot(ax,az)||1;impact(r,a,strength,ax/length,az/length);impact(r,b,strength,-ax/length,-az/length);a.speed*=.8;b.speed*=.87;const side=a.offset>b.offset?1:-1;const yaw=atTrack(r.track,a.distance).yaw;moveWithinBarriers(r.track,a,Math.cos(yaw)*side*.55,-Math.sin(yaw)*side*.55,a.heading);moveWithinBarriers(r.track,b,-Math.cos(yaw)*side*.55,Math.sin(yaw)*side*.55,b.heading);a.collisionCooldown=b.collisionCooldown=1.4;}
  }
  r.sampleTimer+=dt;if(r.sampleTimer>=.12){r.samples.push({t:r.lapTime,d:p.distance-(r.lap-1)*r.track.length,o:p.offset,x:p.world?.x,z:p.world?.z,h:p.heading});r.sampleTimer=0;}
  if(p.distance>=r.lap*r.track.length){
    const lapTime=r.elapsed-r.lapStart;r.lastLap=lapTime;r.samples.push({t:lapTime,d:r.track.length,o:p.offset,x:p.world?.x,z:p.world?.z,h:p.heading});
    const record={time:lapTime,weather:r.weather,tire:p.tire,date:new Date().toISOString(),ghost:{time:lapTime,samples:r.samples}};
    if(!r.invalidLap){r.best=Math.min(r.best,lapTime);onLap(record);}r.invalidLap=false;r.lap++;r.lapStart=r.elapsed;r.lapTime=0;r.samples=[{t:0,d:0,o:p.offset,x:p.world?.x,z:p.world?.z,h:p.heading}];message(r,'Lap complete · '+lapTime.toFixed(3)+' s');
    if(r.mode==='race'&&r.lap>r.config.laps){p.finished=true;p.finishTime=r.elapsed;r.finishOrder.push(0);r.finished=true;}
  }
  for(const c of r.cars)if(c.damage>=100){c.retired=true;c.speed=0;}
  if(p.retired){r.finished=true;r.dnf=true;message(r,'Retired · terminal damage');}
}
export function impact(r,c,strength,nx=0,nz=0){
  if(!r.config.damage)return;
  const facing=Math.sin(c.heading||0)*nx+Math.cos(c.heading||0)*nz;
  const part=facing<-.45?'wing':facing>.45?'rearWing':'suspension';
  c.damage=clamp(c.damage+strength*.55,0,100);
  c[part]=clamp((c[part]||0)+strength*1.5,0,100);
  if(part==='rearWing')c.engine=clamp(c.engine+strength*.8,0,100);
  if(strength>20)c.suspension=clamp(c.suspension+strength*.3,0,100);
  if(c.id===0)message(r,'Contact · '+({wing:'front wing',rearWing:'rear wing / engine',suspension:'suspension'}[part])+' damage');
}
export function standings(r){return [...r.cars].sort((a,b)=>Boolean(a.retired||(r.dnf&&a.id===0))-Boolean(b.retired||(r.dnf&&b.id===0))||(a.finished&&b.finished?a.finishTime-b.finishTime:a.finished?-1:b.finished?1:b.distance-a.distance));}
export function recover(r){
  const p=r.cars[0];p.offset=0;resetWorld(r.track,p);r.invalidLap=true;p.speed=0;p.yawSlip=0;r.steer=0;p.pitTime=0;r.pitRequested=false;
  const lap=Math.max(1,Math.floor(p.distance/r.track.length)+1);
  if(r.pitPlan.some(stop=>stop.lap===lap)&&!p.pitted.includes(lap))p.pitted.push(lap);
  p.tire=r.pitTire;p.wear=0;p.wing=0;p.rearWing=0;p.damage*=.3;p.suspension*=.5;p.engine*=.7;p.fuel=r.pitFuel;
  r.elapsed+=5;r.lapTime=r.elapsed-r.lapStart;message(r,'Recovery · +5 seconds · drive now',3);
}
