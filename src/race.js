import {TEAMS,atTrack,angleDiff,clamp,tireGrip,mod} from './core.js';
import {SURFACES,surfaceAt,moveWithinBarriers,resetWorld} from './world.js';

export function createRace(state,track,mode='race',round=null){
  const config={...state.race,...(round?{laps:round.laps,weather:round.weather,tire:round.tire||state.race.tire,fuel:round.fuel??state.race.fuel}:{} )};
  const grid=mode==='race'?10:1;
  const cars=Array.from({length:grid},(_,id)=>{const team=TEAMS[Math.floor(id/2)];return {id,name:team.drivers[id%2],team:team.name,color:team.color,setup:{...state.car,...(id===0?{}:state.cars[id]||{})},livery:id===0?{...state.car}:{primary:team.color,secondary:team.secondary,accent:'#edf1db',number:id+8,pattern:'Split',...(state.cars[id]||{})},distance:-id*7,offset:id%2?2.4:-2.4,heading:null,speed:0,tire:config.tire,wear:0,fuel:config.fuel,damage:0,wing:0,engine:0,suspension:0,pitTime:0,pitted:[],finished:false,finishTime:0,collisionCooldown:0};});
  cars[0].offset=0;cars[0].distance=0;
  return {track,cars,mode,config,weather:config.weather,setup:{...state.car},elapsed:0,lapTime:0,lap:1,lastLap:0,best:Infinity,lapStart:0,samples:[{t:0,d:0,o:0,x:track.samples[0].x,z:track.samples[0].z,h:track.samples[0].yaw}],sampleTimer:0,ghost:state.records[track.id]?.ghost||null,paused:false,finished:false,countdown:3,steer:0,message:'',messageUntil:0,pitRequested:false,pitTire:config.pitTire,pitFuel:config.fuel,pitPlan:round?structuredClone(round.pits):[{lap:config.pitLap,tire:config.pitTire}],finishOrder:[],newRecord:false,offTrackTime:0};
}
export function message(r,text,seconds=3){r.message=text;r.messageUntil=r.elapsed+seconds;}
export function stepRace(r,keys,dt,onLap=()=>{}){
  if(dt>1/120){const count=Math.ceil(Math.min(dt,.05)*120);for(let i=0;i<count;i++)stepRace(r,keys,Math.min(dt,.05)/count,onLap);return;}
  if(r.paused||r.finished)return;
  dt=clamp(dt,0,.05);
  if(r.countdown>0){r.countdown-=dt;return;}
  r.elapsed+=dt;r.lapTime=r.elapsed-r.lapStart;
  const p=r.cars[0];r.steer=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0);
  for(const c of r.cars){
    if(c.finished||c.retired)continue;
    c.collisionCooldown=Math.max(0,c.collisionCooldown-dt);
    const setup=c.setup;
    const lap=Math.max(1,Math.floor(c.distance/r.track.length)+1),progress=mod(c.distance,r.track.length);
    const plan=r.pitPlan.find(s=>s.lap===lap&&!c.pitted.includes(s.lap));
    if(progress<75&&c.distance>r.track.length*.8&&(plan||(c.id===0&&r.pitRequested))&&!c.pitTime){
      c.pitTime=5.2;c.pitted.push(lap);c.speed=0;c.offset=-r.track.width/2-3;resetWorld(r.track,c);c.nextTire=c.id===0&&r.pitRequested?r.pitTire:plan?.tire||r.config.pitTire;
      if(c.id===0){r.pitRequested=false;message(r,'Pit stop · tires, repairs & fuel',5);}
    }
    if(c.pitTime>0){c.pitTime-=dt;if(c.pitTime<=0){c.tire=c.nextTire;c.wear=0;c.damage*=.3;c.wing=0;c.suspension*=.5;c.engine*=.7;c.fuel=c.id===0?r.pitFuel:r.config.fuel;c.offset=-2;resetWorld(r.track,c); if(c.id===0)message(r,'Go, go, go!');}continue;}
    if(!c.world)resetWorld(r.track,c);
    const pos=atTrack(r.track,c.distance),ahead=atTrack(r.track,c.distance+45);
    const curvature=Math.abs(angleDiff(ahead.yaw,pos.yaw));
    c.surface=surfaceAt(r.track,c.offset);const surface=SURFACES[c.surface];
    const grip=surface.grip*tireGrip(c.tire,r.weather,c.wear)*(1+(setup.downforce-50)*.004)*(1-c.wing*.003);
    const cornerSpeed=clamp(90-curvature*85,20,95)*Math.sqrt(grip);
    let throttle=1,brake=0;
    if(c.id===0){throttle=(keys.has('ArrowUp')||keys.has('w'))?1:0;brake=(keys.has('ArrowDown')||keys.has('s')||keys.has(' '))?1:0;
      if(!Number.isFinite(c.heading))c.heading=pos.yaw;
      const steeringRate=(1.55/(1+c.speed*.012))*clamp(c.speed/10,0,1)*grip*(1-c.suspension*.004)*(.8+setup.suspension*.004);
      c.heading+=r.steer*steeringRate*dt;
      c.travelHeading ??= c.heading;
      c.travelHeading+=angleDiff(c.heading,c.travelHeading)*(1-Math.exp(-dt*(surface.loose?2.2:24)));
      const turn=angleDiff(ahead.yaw,pos.yaw);
      if(c.speed>cornerSpeed*1.2&&Math.abs(turn)>.15)r.offTrackTime+=dt;else r.offTrackTime=0;
    }else{
      const target=Math.min(setup.topSpeed/3.6,cornerSpeed)*( .73+r.config.difficulty*.0023+(c.id%3)*.014);
      throttle=c.speed<target?1:.13;brake=c.speed>target+3?.7:0;
      let targetOffset=(c.id%2?1:-1)*2.3+Math.sin(r.elapsed*.45+c.id)*.65;
      const front=r.cars.find(o=>o!==c&&o.distance>c.distance&&o.distance-c.distance<18&&Math.abs(o.offset-c.offset)<1.9);
      if(front)targetOffset=front.offset>0?-3.5:3.5;
      c.targetOffset=targetOffset;
    }
    const offroad=Math.abs(c.offset)>r.track.width/2;
    const top=(setup.topSpeed/3.6)*(1-(setup.downforce-50)*.0018)*(1-c.engine*.006)*(1-c.damage*.0015);
    const mass=1+c.fuel*.006;
    const acceleration=throttle*(12.5*(1-c.speed/(top*1.13)))*grip/mass-brake*(14+setup.brakes*.13)*grip-.45-c.speed*c.speed*.00013-surface.drag*(1+c.speed*.08);
    c.speed=clamp(c.speed+acceleration*dt,0,c.fuel<=0?0:top);
    if(!c.world)resetWorld(r.track,c);
    let dx,dz,nextDistance,nextOffset;
    if(c.id===0){dx=Math.sin(c.travelHeading??c.heading)*c.speed*dt;dz=Math.cos(c.travelHeading??c.heading)*c.speed*dt;}
    else {nextDistance=c.distance+c.speed*dt;nextOffset=c.offset+(c.targetOffset-c.offset)*dt*1.6;const next=atTrack(r.track,nextDistance,nextOffset);dx=next.x-c.world.x;dz=next.z-c.world.z;c.heading=next.yaw;}
    const collision=moveWithinBarriers(r.track,c,dx,dz,c.heading);
    if(c.id!==0&&!collision.hit){c.distance=nextDistance;c.offset=nextOffset;}
    if(collision.hit){
      const normalSpeed=Math.abs((dx*collision.nx+dz*collision.nz)/Math.max(dt,.001));
      c.speed*=Math.max(.05,1-normalSpeed/Math.max(c.speed,1));
      if(normalSpeed>3&&c.collisionCooldown===0){impact(r,c,Math.max(3,normalSpeed*.3));c.collisionCooldown=.6;}
    }
    c.fuel=Math.max(0,c.fuel-c.speed*dt*.0021*(.7+throttle*.3));
    c.wear=clamp(c.wear+c.speed*dt*.003*({soft:1.6,medium:1,hard:.65,intermediate:1.1,wet:1.2}[c.tire])*surface.wear*(r.weather==='Clear'&&['wet','intermediate'].includes(c.tire)?2:1),0,100);
    if(c.fuel<=0&&c.id===0){message(r,'Out of fuel · press R to recover to the pits',1);}
    if(c.id!==0&&r.mode==='race'&&c.distance>=r.track.length*r.config.laps){c.finished=true;c.finishTime=r.elapsed;r.finishOrder.push(c.id);}
  }
  if(r.mode==='race')for(let i=0;i<r.cars.length;i++)for(let j=i+1;j<r.cars.length;j++){
    const a=r.cars[i],b=r.cars[j];if(a.pitTime>0||b.pitTime>0||a.finished||b.finished)continue;
    const gap=Math.abs(mod(a.distance-b.distance+r.track.length/2,r.track.length)-r.track.length/2);
    if(gap<4.1&&Math.abs(a.offset-b.offset)<1.7&&a.collisionCooldown===0&&b.collisionCooldown===0){const strength=3+Math.abs(a.speed-b.speed)*.45;impact(r,a,strength);impact(r,b,strength);a.speed*=.8;b.speed*=.87;const side=a.offset>b.offset?1:-1;const yaw=atTrack(r.track,a.distance).yaw;moveWithinBarriers(r.track,a,Math.cos(yaw)*side*.55,-Math.sin(yaw)*side*.55,a.heading);moveWithinBarriers(r.track,b,-Math.cos(yaw)*side*.55,Math.sin(yaw)*side*.55,b.heading);a.collisionCooldown=b.collisionCooldown=1.4;}
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
function impact(r,c,strength){if(!r.config.damage)return;c.damage=clamp(c.damage+strength,0,100);c.wing=clamp(c.wing+strength*1.4,0,100);c.engine=clamp(c.engine+strength*.3,0,100);c.suspension=clamp(c.suspension+strength*.65,0,100);if(c.id===0)message(r,'Contact · front wing and suspension damaged');}
export function standings(r){return [...r.cars].sort((a,b)=>Boolean(a.retired||(r.dnf&&a.id===0))-Boolean(b.retired||(r.dnf&&b.id===0))||(a.finished&&b.finished?a.finishTime-b.finishTime:a.finished?-1:b.finished?1:b.distance-a.distance));}
export function recover(r){const p=r.cars[0];p.offset=0;resetWorld(r.track,p);r.invalidLap=true;p.speed=0;p.pitTime=8;p.nextTire=r.pitTire;r.elapsed+=8;message(r,'Recovery · 8 second penalty + service',8);}
