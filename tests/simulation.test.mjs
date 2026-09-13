import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultState,makeTrack,atTrack,angleDiff,TIRES,tireGrip,scoreSeason,formatTime} from '../src/core.js';
import {createRace,stepRace,recover,standings} from '../src/race.js';
import {resetWorld,moveWithinBarriers,footprintClearance,SURFACES,surfaceAt,ghostPose} from '../src/world.js';
import {buildWorld} from '../src/scene.js';
import {carMesh} from '../src/render.js';

function fixture(mode='race'){const s=defaultState(),track={...makeTrack(s.tracks[0].points,13),id:'verdant'};const r=createRace(s,track,mode);r.countdown=0;return r;}
test('swept footprint cannot tunnel through either wall anywhere on the preset circuits',()=>{
  for(const preset of defaultState().tracks){
    const track=makeTrack(preset.points,preset.width);
    for(let d=0;d<track.length;d+=17)for(const side of [-1,1]){
      const car={distance:d,offset:side*(track.width/2+3)};
      resetWorld(track,car);car.heading+=side*Math.PI/2;
      moveWithinBarriers(track,car,Math.sin(car.heading)*30,Math.cos(car.heading)*30,car.heading);
      assert.ok(footprintClearance(track,car)>=-.06,preset.id+' wall penetration at '+d+': '+footprintClearance(track,car));
      assert.ok(Math.abs(car.offset)<track.width/2+8);
    }
  }
});
test('gravel slows the car, wears tires faster and retains lateral slip',()=>{
  const road=fixture('test'),gravel=fixture('test');
  for(const r of [road,gravel]){r.cars[0].speed=25;resetWorld(r.track,r.cars[0]);}
  gravel.cars[0].offset=gravel.track.width/2+3;resetWorld(gravel.track,gravel.cars[0]);
  for(let i=0;i<10;i++){stepRace(road,new Set(['w','a']),.02);stepRace(gravel,new Set(['w','a']),.02);}
  assert.equal(gravel.cars[0].surface,'gravel');
  assert.ok(gravel.cars[0].speed<road.cars[0].speed);
  assert.ok(gravel.cars[0].wear>road.cars[0].wear*3);
  assert.ok(SURFACES.gravel.grip<SURFACES.asphalt.grip);
  assert.ok(Math.abs(angleDiff(gravel.cars[0].heading,gravel.cars[0].travelHeading))>.001);
});
test('no stationary steering and no road-induced change in world direction',()=>{
  const r=fixture('test'),p=r.cars[0];resetWorld(r.track,p);const h=p.heading;
  for(let i=0;i<100;i++)stepRace(r,new Set(['d']),.02);
  assert.equal(p.heading,h);p.speed=20;const start={...p.world};
  for(let i=0;i<20;i++)stepRace(r,new Set(['w']),.02);
  assert.ok(Math.abs(angleDiff(Math.atan2(p.world.x-start.x,p.world.z-start.z),h))<1e-8);
});
test('ghost interpolates world heading, supports legacy laps, and expires',()=>{
  const r=fixture('ghost'),g={time:2,samples:[{t:0,d:0,o:0,x:1,z:2,h:3.1},{t:2,d:20,o:2,x:5,z:8,h:-3.1}]};
  const p=ghostPose(g,1,r.track);assert.equal(p.x,3);assert.equal(p.z,5);assert.ok(Math.abs(p.heading-Math.PI)<.001);
  assert.equal(ghostPose(g,3,r.track),null);
  assert.ok(Number.isFinite(ghostPose({time:2,samples:[{t:0,d:0,o:0},{t:2,d:20,o:0}]},1,r.track).x));
});
test('recovered laps cannot replace a clean best time',()=>{
  const r=fixture('test'),p=r.cars[0];p.distance=r.track.length-2;recover(r);p.pitTime=0;p.speed=20;let records=0;
  for(let i=0;i<20;i++)stepRace(r,new Set(['w']),.02,()=>records++);
  assert.equal(r.lap,2);assert.equal(records,0);assert.equal(r.invalidLap,false);
});
test('terminal damage retires AI and player and classification puts retirees last',()=>{
  const r=fixture();r.cars[2].damage=100;stepRace(r,new Set(),.02);assert.equal(r.cars[2].retired,true);assert.equal(standings(r).at(-1).id,2);
  r.cars[0].damage=100;stepRace(r,new Set(),.02);assert.equal(r.dnf,true);assert.equal(r.finished,true);
});
test('AI completes all presets in dry and wet conditions with finite positions',()=>{
  for(const preset of defaultState().tracks)for(const weather of ['Clear','Heavy rain']){
    const s=defaultState();s.race.weather=weather;s.race.tire=weather==='Clear'?'medium':'wet';s.race.laps=1;s.race.damage=false;
    const r=createRace(s,makeTrack(preset.points,preset.width));r.countdown=0;r.cars[0].finished=true;
    for(let i=0;i<15000&&!r.cars.slice(1).every(c=>c.finished);i++)stepRace(r,new Set(),.04);
    assert.ok(r.cars.slice(1).every(c=>c.finished&&Number.isFinite(c.distance)),preset.id+' '+weather);
  }
});
test('world mesh includes finite depth-tested geometry for all presets and widths',()=>{
  for(const p of defaultState().tracks)for(const width of [10,20]){
    const mesh=buildWorld(makeTrack(p.points,width));assert.ok(mesh.length>100000);assert.ok(mesh.every(Number.isFinite));
  }
});
test('closed circuit positions wrap, including the grid behind the line',()=>{const r=fixture();assert.ok(r.track.length>3000);for(const d of [-100,0,400,r.track.length]){const a=atTrack(r.track,d),b=atTrack(r.track,d+r.track.length);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<1e-6);assert.ok(Number.isFinite(a.yaw));}});
test('track tangent changes smoothly between adjacent render positions',()=>{const r=fixture();for(let d=0;d<r.track.length;d+=2){const a=atTrack(r.track,d),b=atTrack(r.track,d+.05);const delta=Math.abs(Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw)));assert.ok(delta<.08,`heading jumped ${delta} radians at ${d}m`);}});
test('grid has 10 unique drivers from five teams; test modes have one',()=>{const r=fixture();assert.equal(r.cars.length,10);assert.equal(new Set(r.cars.map(c=>c.name)).size,10);assert.equal(new Set(r.cars.map(c=>c.team)).size,5);assert.equal(fixture('test').cars.length,1);assert.equal(fixture('ghost').cars.length,1);});
test('wet tires outperform slicks in heavy rain and tire wear reduces grip',()=>{assert.ok(tireGrip('wet','Heavy rain')>tireGrip('soft','Heavy rain'));assert.ok(tireGrip('soft','Clear')>tireGrip('wet','Clear'));for(const tire of Object.keys(TIRES))assert.ok(tireGrip(tire,'Clear',90)<tireGrip(tire,'Clear',0));});
test('throttle moves the car, consumes fuel and wears tires; brake slows it',()=>{const r=fixture('test'),p=r.cars[0];for(let i=0;i<200;i++)stepRace(r,new Set(['w']),.02);assert.ok(p.speed>10);assert.ok(p.distance>10);assert.ok(p.fuel<30);assert.ok(p.wear>0);const speed=p.speed;for(let i=0;i<50;i++)stepRace(r,new Set(['s']),.02);assert.ok(p.speed<speed);});
test('pause and countdown do not advance race timing',()=>{const r=fixture();r.paused=true;stepRace(r,new Set(['w']),.05);assert.equal(r.elapsed,0);r.paused=false;r.countdown=2;stepRace(r,new Set(['w']),.05);assert.equal(r.elapsed,0);assert.equal(r.cars[0].distance,0);});
test('lap crossing records a replay and completes the requested race distance',()=>{const r=fixture();r.config.laps=1;r.cars[0].distance=r.track.length-.1;r.cars[0].speed=30;r.elapsed=70;const records=[];stepRace(r,new Set(['w']),.02,v=>records.push(v));assert.equal(records.length,1);assert.equal(r.finished,true);assert.equal(r.lap,2);assert.ok(records[0].ghost.samples.length>=2);assert.equal(records[0].ghost.samples.at(-1).d,r.track.length);});
test('planned pit stop changes tires, repairs wing and refuels exactly once',()=>{const r=fixture('test'),p=r.cars[0];p.distance=r.track.length+10;r.lap=2;p.fuel=2;p.wing=40;p.damage=30;stepRace(r,new Set(),.02);assert.ok(p.pitTime>0);for(let i=0;i<300;i++)stepRace(r,new Set(),.02);assert.equal(p.tire,'hard');assert.equal(p.wing,0);assert.ok(p.damage<30);assert.equal(p.fuel,30);assert.equal(p.pitTime<=0,true);assert.deepEqual(p.pitted,[2]);});
test('barrier contact damages the car unless damage is disabled',()=>{for(const enabled of [true,false]){const r=fixture('test'),p=r.cars[0];r.config.damage=enabled;p.offset=r.track.width/2+5;p.speed=40;resetWorld(r.track,p);p.heading+=Math.PI/2;p.travelHeading=p.heading;stepRace(r,new Set(),.02);assert.equal(p.damage>0,enabled);assert.ok(p.speed<40);}});
test('recovery services an empty car without advancing track progress',()=>{const r=fixture('test'),p=r.cars[0];p.distance=100;p.fuel=0;r.elapsed=20;recover(r);assert.equal(p.distance,100);assert.equal(r.elapsed,28);for(let i=0;i<410;i++)stepRace(r,new Set(),.02);assert.equal(p.fuel,30);});
test('championship points and completed-car order are stable',()=>{assert.deepEqual(scoreSeason([[0,1,2,3,4,5,6,7,8,9],[1,0,2,3,4,5,6,7,8,9]]).slice(0,3),[43,43,30]);const r=fixture();r.cars[2].finished=true;r.cars[2].finishTime=50;assert.equal(standings(r)[0].id,2);assert.equal(formatTime(91.234),'1:31.234');});
test('car mesh is finite, has four tire assemblies and responds to livery and wing loss',()=>{const car=defaultState().car,a=carMesh(car),b=carMesh({...car,primary:'#ff0000'}),damaged=carMesh(car,'medium',90);assert.ok(a.length>200);assert.ok(a.every(f=>f.p.every(v=>v.every(Number.isFinite))));assert.notDeepEqual(a,b);assert.ok(damaged.length<a.length);});
test('individual tuning and round-specific starting strategy reach the simulation',()=>{const s=defaultState();s.cars[3]={topSpeed:250,downforce:90};const t=makeTrack(s.tracks[0].points);const r=createRace(s,t,'race',{laps:5,weather:'Heavy rain',tire:'wet',fuel:45,pits:[{lap:3,tire:'intermediate'}]});assert.equal(r.cars[3].setup.topSpeed,250);assert.equal(r.cars[0].setup.topSpeed,335);assert.equal(r.cars[0].fuel,45);assert.equal(r.cars[0].tire,'wet');assert.equal(r.pitPlan[0].lap,3);});
test('player heading stays fixed without steering and responds to direct steering input',()=>{const r=fixture('test'),p=r.cars[0];stepRace(r,new Set(['w']),.02);const heading=p.heading;for(let i=0;i<50;i++)stepRace(r,new Set(['w']),.02);assert.equal(p.heading,heading);for(let i=0;i<50;i++)stepRace(r,new Set(['w','d']),.02);assert.ok(angleDiff(p.heading,heading)>.1);});
test('a complete two-lap grand prix remains finite and records both laps',()=>{const r=fixture();r.config.laps=2;r.config.damage=false;let laps=0;for(let i=0;i<60000&&!r.finished;i++){const p=r.cars[0],road=atTrack(r.track,p.distance+10),target=road.yaw-Math.atan(p.offset*.12),keys=new Set(),error=angleDiff(target,p.heading??target);if(p.speed>35)keys.add('s');else keys.add('w');if(error>.012)keys.add('d');if(error<-.012)keys.add('a');stepRace(r,keys,.02,()=>laps++);}assert.equal(r.finished,true);assert.equal(laps,2);assert.equal(r.cars[0].finished,true);assert.ok(r.cars.every(c=>Number.isFinite(c.distance)&&Number.isFinite(c.speed)));assert.ok(r.cars.slice(1).every(c=>c.distance>r.track.length));});
