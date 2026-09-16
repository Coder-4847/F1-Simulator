import {resolveCarContacts,aiPitNeed,aiServiceTire} from './traffic.js';
import {TEAMS,atTrack,angleDiff,clamp,mod} from './core.js';
import {handlingGrip,steeringRate} from './handling.js';
import {SURFACES,surfaceAt,moveWithinBarriers,resetWorld} from './world.js';

export function createRace(state,track,mode='race',round=null){
  const config={...state.race,...(round?{laps:round.laps,weather:round.weather,tire:round.tire||state.race.tire,fuel:round.fuel??state.race.fuel}:{} )};
  config.difficulty=clamp(Number.isFinite(Number(config.difficulty))?Number(config.difficulty):70,0,100);
  const grid=mode==='race'?10:1;
  const cars=Array.from({length:grid},(_,id)=>{const team=TEAMS[Math.floor(id/2)];return {id,name:team.drivers[id%2],team:team.name,color:team.color,setup:{...state.car,...(id===0?{}:state.cars[id]||{})},livery:id===0?{...state.car}:{primary:team.color,secondary:team.secondary,accent:'#edf1db',number:id+8,pattern:'Split',...(state.cars[id]||{})},distance:-id*7,offset:id%2?2.4:-2.4,heading:null,speed:0,tire:config.tire,wear:0,fuel:config.fuel,damage:0,wing:0,rearWing:0,engine:0,suspension:0,pitTime:0,pitted:[],finished:false,finishTime:0,collisionCooldown:0};});
  cars[0].offset=0;cars[0].distance=0;
  const race={track,cars,mode,config,weather:config.weather,setup:{...state.car},elapsed:0,lapTime:0,lap:1,lastLap:0,best:Infinity,lapStart:0,samples:[{t:0,d:0,o:0,x:track.samples[0].x,z:track.samples[0].z,h:track.samples[0].yaw}],sampleTimer:0,ghost:state.records[track.id]?.ghost||null,paused:false,finished:false,countdown:3,steer:0,message:'',messageUntil:0,pitRequested:false,pitTire:config.pitTire,pitFuel:config.fuel,pitPlan:mode==='race'?(round?structuredClone(round.pits||[]):[{lap:config.pitLap,tire:config.pitTire}]).filter(s=>s.lap>=2):[],finishOrder:[],newRecord:false,offTrackTime:0};
  race.splitScreen=mode==='race'&&['side','stacked'].includes(config.splitScreen)?config.splitScreen:null;
  if(race.splitScreen){
    cars[0].name='Player 1';cars[1].name='Player 2';
    race.player2={lap:1,lapStart:0,lapTime:0,lastLap:0,best:Infinity,samples:[],sampleTimer:0,steer:0,offTrackTime:0,penalty:0,pitRequested:false,pitTire:config.pitTire,pitFuel:config.fuel,message:'',messageUntil:0};
  }
  return race;
}
export function playerState(r,id=0){return id===0?r:r.player2;}
export function playerKeys(keys,id=0,split=false){
  if(!split)return keys;
  const mappings=id===0?{w:'w',s:'s',a:'a',d:'d',' ':' '}:{ArrowUp:'w',ArrowDown:'s',ArrowLeft:'a',ArrowRight:'d',Enter:' '};
  return new Set(Object.entries(mappings).filter(([key])=>keys.has(key)).map(([,value])=>value));
}
export function requestPit(r,id=0){
  const driver=playerState(r,id),car=r.cars[id];
  if(!driver||r.paused||r.finished||car.finished||car.retired)return;
  driver.pitRequested=true;playerMessage(r,id,'Pit requested · entry after the start / finish');
}
function playerMessage(r,id,text,seconds=3){const driver=playerState(r,id);if(driver){driver.message=text;driver.messageUntil=r.elapsed+seconds;}}

export function message(r,text,seconds=3){r.message=text;r.messageUntil=r.elapsed+seconds;}
export function stepRace(r,keys,dt,onLap=()=>{}){
  if(dt>1/120){const count=Math.ceil(Math.min(dt,.05)*120);for(let i=0;i<count;i++)stepRace(r,keys,Math.min(dt,.05)/count,onLap);return;}
  if(r.paused||r.finished)return;
  dt=clamp(dt,0,.05);
  if(r.countdown>0){r.countdown-=dt;return;}
  r.elapsed+=dt;

  for(const c of r.cars){
    if(c.finished||c.retired)continue;
    c.collisionCooldown=Math.max(0,c.collisionCooldown-dt);
    const driver=c.id===0?r:r.splitScreen&&c.id===1?r.player2:null;
    const input=driver?playerKeys(keys,c.id,Boolean(r.splitScreen)):new Set();
    if(driver){const steerInput=(input.has('ArrowRight')||input.has('d')?1:0)-(input.has('ArrowLeft')||input.has('a')?1:0);driver.steer+=(steerInput-driver.steer)*(1-Math.exp(-dt*7));}
    const setup=c.setup;
    const lap=Math.max(1,Math.floor(c.distance/r.track.length)+1),progress=mod(c.distance,r.track.length);
    if(!driver&&r.mode==='race')c.aiPitRequested ||= aiPitNeed(r,c);
    const plan=r.pitPlan.find(s=>s.lap===lap&&!c.pitted.includes(s.lap));
    if(c.speed>=0&&c.lastPitLap!==lap&&progress<75&&c.distance>r.track.length*.8&&(plan||(driver&&driver.pitRequested)||c.aiPitRequested)&&!c.pitTime){
      const adaptive=!driver&&Boolean(c.aiPitRequested);
      c.pitTime=5.2+(!driver?Math.max(c.suspension,c.engine)*.04:0);c.lastPitLap=lap;c.pitted.push(lap);c.speed=0;c.offset=-r.track.width/2-3;resetWorld(r.track,c);c.nextTire=driver&&driver.pitRequested?driver.pitTire:adaptive?aiServiceTire(r,c):plan?.tire||r.config.pitTire;
      c.aiPitRequested='';
      if(driver){driver.pitRequested=false;playerMessage(r,c.id,'Pit stop · tires, repairs & fuel',5);}
    }
    if(c.pitTime>0){c.pitTime-=dt;if(c.pitTime<=0){c.pitTime=0;c.tire=c.nextTire;c.wear=0;c.damage*=.3;c.wing=0;c.rearWing=0;c.suspension*=driver?.5:.15;c.engine*=driver?.7:.25;c.fuel=driver?driver.pitFuel:clamp(Math.max(r.config.fuel,Math.min(r.track.length*r.config.laps-c.distance,r.track.length*3)*.0021+2),5,100);c.offset=-2;resetWorld(r.track,c); if(driver)playerMessage(r,c.id,'Go, go, go!');}continue;}
    if(!c.world)resetWorld(r.track,c);
    const pos=atTrack(r.track,c.distance),ahead=atTrack(r.track,c.distance+45);
    const curvature=Math.abs(angleDiff(ahead.yaw,pos.yaw));
    c.surface=surfaceAt(r.track,c.offset);const surface=SURFACES[c.surface];
    const grip=surface.grip*handlingGrip(c,r.weather);
    const cornerSpeed=clamp(90-curvature*85,20,95)*Math.sqrt(grip);
    let throttle=1,brake=0,reverse=false,forward=false;
    if(driver){throttle=(input.has('ArrowUp')||input.has('w'))?1:0;brake=(input.has('ArrowDown')||input.has('s')||input.has(' '))?1:0;
      forward=throttle===1;reverse=(input.has('s')||input.has('ArrowDown'))&&!forward&&!input.has(' ');
      if(brake)throttle=0;
      if(!Number.isFinite(c.heading))c.heading=pos.yaw;
      const rate=steeringRate(c,r.weather,surface.grip);
      c.yawSlip=(c.yawSlip||0)*Math.exp(-dt*3)+driver.steer*surface.loose*clamp((Math.abs(c.speed)-5)/20,0,1)*dt*2;
      c.heading+=(driver.steer*rate+c.yawSlip)*Math.sign(c.speed)*dt;
      c.travelHeading ??= c.heading;
      c.travelHeading+=angleDiff(c.heading,c.travelHeading)*(1-Math.exp(-dt*(surface.loose?2.2:24)));
      const turn=angleDiff(ahead.yaw,pos.yaw);
      if(c.speed>cornerSpeed*1.2&&Math.abs(turn)>.15)driver.offTrackTime+=dt;else driver.offTrackTime=0;
    }else{
      const target=Math.min(setup.topSpeed/3.6,cornerSpeed)*( .50+r.config.difficulty*.0046+(c.id%3)*.014);
      throttle=c.speed<target?1:.13;brake=c.speed>target+3?.7:0;
      let targetOffset=(c.id%2?1:-1)*2.3+Math.sin(r.elapsed*.45+c.id)*.65;
      const front=r.cars.filter(o=>o!==c&&!o.finished&&!o.retired&&o.pitTime<=0&&o.distance>c.distance&&o.distance-c.distance<28&&Math.abs(o.offset-c.offset)<2.4).sort((a,b)=>a.distance-b.distance)[0];
      if(front){
        if(!c.passUntil||r.elapsed>c.passUntil){
          const desired=front.offset>0?-3.5:3.5;
          const occupied=r.cars.some(o=>o!==c&&o!==front&&Math.abs(o.distance-c.distance)<15&&Math.abs(o.offset-desired)<2.5);
          c.passOffset=occupied?c.offset:desired;c.passUntil=r.elapsed+2;
        }
        targetOffset=c.passOffset;
        const gap=front.distance-c.distance;
        if(Math.abs(front.offset-c.offset)<2.2&&gap<8+Math.max(0,c.speed-front.speed)*.7){throttle=0;brake=Math.max(brake,clamp((c.speed-front.speed)*.12+(8-gap)*.1,0,1));}
      }else if(r.elapsed<(c.passUntil||0))targetOffset=c.passOffset;
      c.targetOffset=targetOffset;
    }
    const top=(setup.topSpeed/3.6)*(1-(setup.downforce-50)*.0018)*(1-c.engine*.006)*(1-c.damage*.0015);
    const mass=1+c.fuel*.006;
    const speed=Math.abs(c.speed),reverseDrive=driver&&reverse&&c.speed<=0;
    const direction=reverseDrive||c.speed<0?-1:1;
    const driving=direction<0?Number(reverseDrive):throttle;
    const braking=direction<0?Number(forward||input.has(' ')):brake;
    // Loose surfaces limit steering grip, but wheels retain enough drive traction to escape.
    const traction=surface.loose?Math.max(grip,.72):grip;
    const driveTop=direction<0?8:surface.loose?Math.min(top,25):top;
    const drag=surface.loose?(surface.loose===1?.009:.006)*speed*speed:surface.drag*(clamp(speed/6,0,1)+speed*.08);
    const acceleration=driving*12.5*(1-speed/(driveTop*1.13))*traction/mass-braking*(14+setup.brakes*.13)*grip-.45-speed*speed*.00013-drag;
    c.speed=direction*clamp(speed+acceleration*dt,0,c.fuel<=0?0:direction<0?8:top);
    if(!c.world)resetWorld(r.track,c);
    let dx,dz,nextDistance,nextOffset;
    if(driver){dx=Math.sin(c.travelHeading??c.heading)*c.speed*dt;dz=Math.cos(c.travelHeading??c.heading)*c.speed*dt;}
    else {nextDistance=c.distance+c.speed*dt;nextOffset=c.offset+clamp((c.targetOffset-c.offset)*1.6,-2.5,2.5)*dt;const next=atTrack(r.track,nextDistance,nextOffset);dx=next.x-c.world.x;dz=next.z-c.world.z;c.heading=next.yaw;}
    const contactDrift=Math.hypot(c.contactVX||0,c.contactVZ||0);
    dx+=(c.contactVX||0)*dt;dz+=(c.contactVZ||0)*dt;
    c.contactVX=(c.contactVX||0)*Math.exp(-dt*5);c.contactVZ=(c.contactVZ||0)*Math.exp(-dt*5);
    const collision=moveWithinBarriers(r.track,c,dx,dz,c.heading);
    if(!driver&&!collision.hit&&contactDrift<.001){c.distance=nextDistance;c.offset=nextOffset;}
    if(collision.hit){
      const normalSpeed=Math.abs((dx*collision.nx+dz*collision.nz)/Math.max(dt,.001));
      c.speed*=Math.max(.05,1-normalSpeed/Math.max(Math.abs(c.speed),1));
      if(normalSpeed>3&&c.collisionCooldown===0){impact(r,c,Math.max(3,normalSpeed*.55),collision.nx,collision.nz);c.collisionCooldown=.6;}
    }
    c.fuel=Math.max(0,c.fuel-Math.abs(c.speed)*dt*.0021*(.7+throttle*.3));
    c.wear=clamp(c.wear+Math.abs(c.speed)*dt*.003*({soft:1.6,medium:1,hard:.65,intermediate:1.1,wet:1.2}[c.tire])*surface.wear*(r.weather==='Clear'&&['wet','intermediate'].includes(c.tire)?2:1),0,100);
    if(c.fuel<=0&&driver){playerMessage(r,c.id,'Out of fuel · '+(c.id===0?'R':'Backspace')+' to recover',1);}
    if(!driver&&r.mode==='race'&&c.distance>=r.track.length*r.config.laps){c.finished=true;c.finishTime=r.elapsed;r.finishOrder.push(c.id);}
  }
  if(r.mode==='race')resolveCarContacts(r,dt,impact);
  for(const id of r.splitScreen?[0,1]:[0]){
    const p=r.cars[id],driver=playerState(r,id),clock=r.elapsed+(driver.penalty||0);
    if(p.finished||p.retired)continue;
    driver.lapTime=clock-driver.lapStart;
  driver.sampleTimer+=dt;if(driver.sampleTimer>=.12){driver.samples.push({t:driver.lapTime,d:p.distance-(driver.lap-1)*r.track.length,o:p.offset,x:p.world?.x,z:p.world?.z,h:p.heading});driver.sampleTimer=0;}
  if(p.distance>=driver.lap*r.track.length){
    const lapTime=clock-driver.lapStart;driver.lastLap=lapTime;driver.samples.push({t:lapTime,d:r.track.length,o:p.offset,x:p.world?.x,z:p.world?.z,h:p.heading});
    const record={time:lapTime,weather:r.weather,tire:p.tire,date:new Date().toISOString(),ghost:{time:lapTime,samples:driver.samples}};
    if(!driver.invalidLap){driver.best=Math.min(driver.best,lapTime);onLap(record,id);}driver.invalidLap=false;driver.lap++;driver.lapStart=clock;driver.lapTime=0;driver.samples=[{t:0,d:0,o:p.offset,x:p.world?.x,z:p.world?.z,h:p.heading}];playerMessage(r,id,'Lap complete · '+lapTime.toFixed(3)+' s');
    if(r.mode==='race'&&driver.lap>r.config.laps){p.finished=true;p.finishTime=clock;r.finishOrder.push(id);if(!r.splitScreen)r.finished=true;}
  }
  }
  for(const c of r.cars)if(c.damage>=100){c.retired=true;c.speed=0;}
  if(r.cars[0].retired){r.dnf=true;if(!r.splitScreen)r.finished=true;}
  if(r.splitScreen)r.finished=[r.cars[0],r.cars[1]].every(c=>c.finished||c.retired);
}

export function impact(r,c,strength,nx=0,nz=0){
  if(!r.config.damage)return;
  const facing=Math.sin(c.heading||0)*nx+Math.cos(c.heading||0)*nz;
  const part=facing<-.45?'wing':facing>.45?'rearWing':'suspension';
  c.damage=clamp(c.damage+strength*.55,0,100);
  c[part]=clamp((c[part]||0)+strength*1.5,0,100);
  if(part==='rearWing')c.engine=clamp(c.engine+strength*.8,0,100);
  if(strength>20)c.suspension=clamp(c.suspension+strength*.3,0,100);
  if(c.id===0||(r.splitScreen&&c.id===1))playerMessage(r,c.id,'Contact · '+({wing:'front wing',rearWing:'rear wing / engine',suspension:'suspension'}[part])+' damage');
}
export function standings(r){return [...r.cars].sort((a,b)=>Boolean(a.retired||(r.dnf&&a.id===0))-Boolean(b.retired||(r.dnf&&b.id===0))||(a.finished&&b.finished?a.finishTime-b.finishTime:a.finished?-1:b.finished?1:b.distance-a.distance));}
export function recover(r,id=0){
  const p=r.cars[id],driver=playerState(r,id);if(!driver||p.finished||p.retired||r.finished||r.paused)return;
  p.offset=0;resetWorld(r.track,p);driver.invalidLap=true;p.speed=0;p.contactVX=0;p.contactVZ=0;p.yawSlip=0;driver.steer=0;p.pitTime=0;driver.pitRequested=false;
  const lap=Math.max(1,Math.floor(p.distance/r.track.length)+1);
  if(r.pitPlan.some(stop=>stop.lap===lap)&&!p.pitted.includes(lap))p.pitted.push(lap);
  p.tire=driver.pitTire;p.wear=0;p.wing=0;p.rearWing=0;p.damage*=.3;p.suspension*=.5;p.engine*=.7;p.fuel=driver.pitFuel;
  if(r.splitScreen)driver.penalty=(driver.penalty||0)+5;else r.elapsed+=5;
  driver.lapTime=r.elapsed+(driver.penalty||0)-driver.lapStart;playerMessage(r,id,'Recovery · +5 seconds · drive now',3);
}
