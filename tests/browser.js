import {defaultState,makeTrack,atTrack,angleDiff} from '../src/core.js';
import {createRace,stepRace} from '../src/race.js';
import {resetWorld,ghostPose} from '../src/world.js';
import {drawRace} from '../src/render.js';
const frame=document.querySelector('#app'),out=document.querySelector('#results'),key='apex-formula-test';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let checks=0,errors=[],record;
const assert=(value,name)=>{if(!value)throw Error(name);checks++;out.textContent+='\nPASS '+name;};
const doc=()=>frame.contentDocument;
const click=s=>{const el=doc().querySelector(s);if(!el)throw Error('Missing '+s);el.click();};
const set=(s,value,type='change')=>{const el=doc().querySelector(s);el.value=value;el.dispatchEvent(new frame.contentWindow.Event(type,{bubbles:true}));};
const saved=()=>JSON.parse(localStorage.getItem(key));
async function load(){await new Promise(resolve=>{frame.onload=resolve;frame.src='/?test=1&run='+Date.now();});await sleep(100);}
function benchmark(){
  const state=defaultState(),track={...makeTrack(state.tracks[0].points),id:'verdant'},r=createRace(state,track,'test');r.countdown=0;r.config.damage=false;r.pitPlan=[];
  for(let i=0;i<30000&&!record;i++){
    const p=r.cars[0],road=atTrack(track,p.distance+10),error=angleDiff(road.yaw-Math.atan(p.offset*.12),p.heading??road.yaw);
    const keys=new Set([p.speed>35?'s':'w']);if(error>.012)keys.add('d');if(error<-.012)keys.add('a');
    stepRace(r,keys,.02,v=>record=v);
  }
  if(!record)throw Error('Full lap benchmark failed');return record;
}
document.querySelector('#run').onclick=async()=>{
  checks=0;errors=[];out.textContent='Running...';frame.hidden=false;document.querySelector('.stage').hidden=true;
  try{
    const state=defaultState();state.records.verdant=benchmark();localStorage.setItem(key,JSON.stringify(state));await load();
    frame.contentWindow.addEventListener('error',e=>errors.push(e.message));
    assert(doc().querySelector('#hero-car')?.width>0,'Dashboard and car preview render');
    click('[data-nav="tracks"]');click('[data-action="new-track"]');set('#track-name','Regression Circuit','input');
    const before=doc().querySelector('#editor-stats').textContent;
    click('[data-editor-mode="add"]');
    const canvas=doc().querySelector('#editor'),rect=canvas.getBoundingClientRect();
    canvas.dispatchEvent(new frame.contentWindow.PointerEvent('pointerdown',{clientX:rect.left+rect.width*.32,clientY:rect.top+rect.height*.19,bubbles:true}));
    assert(doc().querySelector('#editor-stats').textContent!==before,'Track builder inserts a node');
    click('[data-action="undo-track"]');assert(doc().querySelector('#editor-stats').textContent===before,'Track builder undo restores geometry');
    set('#editor-width',18,'input');click('[data-action="save-track"]');
    assert(saved().tracks.at(-1).name==='Regression Circuit'&&saved().tracks.at(-1).width===18,'Custom circuit and width persist');
    click('[data-action="test-track"]');assert(doc().querySelector('#race-track').value===saved().selectedTrack,'Save and test selects the custom circuit');
    click('[data-action="start-race"]');await sleep(300);assert(doc().querySelector('#race-canvas').dataset.drawError==='0','Custom circuit renders with no WebGL error');
    const press=(type,key)=>doc().body.dispatchEvent(new frame.contentWindow.KeyboardEvent(type,{key,bubbles:true}));
    press('keydown','w');await sleep(4200);press('keyup','w');
    const speed=Number(doc().querySelector('#hud-speed').textContent);assert(speed>10,'Browser keyboard throttle drives the car');
    press('keydown','s');await sleep(900);press('keyup','s');
    assert(Number(doc().querySelector('#hud-speed').textContent)<speed,'Browser keyboard brake slows the car');
    click('[data-action="pause"]');assert(doc().querySelector('#live-pit-tire'),'Pause exposes live tire and fuel strategy');
    set('#live-pit-tire','wet');set('#live-pit-fuel',47);click('[data-action="end-session"]');click('[data-nav="dashboard"]');
    click('[data-nav="garage"]');
    for(let i=0;i<10;i++){set('#garage-car',i);set('#car-topSpeed',250+i,'input');set('#paint-primary','#35aaff','input');set('#car-pattern','Stripes');set('#car-number',30+i);}
    assert(saved().car.topSpeed===250&&saved().cars[9].topSpeed===259,'All ten cars keep independent performance setups');
    assert(saved().cars[9].primary==='#35aaff'&&saved().cars[9].number===39,'Livery, pattern and race number persist');
    assert(doc().querySelector('#stat-speed').textContent==='259','Garage performance readout updates immediately');
    const downloads=[],anchor=frame.contentWindow.HTMLAnchorElement.prototype,originalClick=anchor.click;
    anchor.click=function(){downloads.push({name:this.download,text:fetch(this.href).then(r=>r.text())});};
    click('[data-action="export-car"]');await sleep(400);
    const model=downloads.find(d=>d.name.endsWith('.obj')),material=downloads.find(d=>d.name.endsWith('.mtl'));
    assert(model&&material&&(await model.text).includes('mtllib apex-v26.mtl')&&(await material.text).includes('newmtl'),'Car export produces matching OBJ and material files');
    click('[data-nav="season"]');click('[data-action="new-season"]');set('#season-name','Regression Season','input');
    set('[data-round="0"][data-prop="weather"]','Heavy rain');set('[data-round="0"][data-prop="laps"]',5);
    set('[data-round="0"][data-prop="tire"]','wet');set('[data-round="0"][data-prop="fuel"]',52);
    click('[data-add-pit="0"]');set('[data-pit-round="0"][data-pit="1"][data-prop="tire"]','intermediate');
    click('[data-action="add-round"]');assert(saved().season.rounds.length===2&&saved().season.rounds[0].pits.length===2,'Season calendar supports custom tracks and multiple tire stops');
    const custom=saved().seasonId;set('#season-switch','series-2026');set('#season-switch',custom);
    assert(doc().querySelector('#season-name').value==='Regression Season','Multiple seasons survive switching');
    click('[data-action="season-race"]');await sleep(250);
    assert(doc().querySelector('.weather-badge').textContent.includes('Heavy rain')&&doc().querySelector('#tire-label').textContent==='WET','Round weather and starting tires reach the race');
    assert(doc().querySelectorAll('.leader-row').length===10&&doc().querySelector('#hud-fuel').textContent.includes('52.0'),'Ten-car grid and round fuel reach the HUD');
    click('[data-action="pause"]');click('[data-action="end-session"]');click('[data-nav="season"]');
    assert(saved().season.results.length===0,'Abandoned round does not award championship points');
    click('[data-action="random-weather"]');assert(saved().season.rounds.every(r=>['Clear','Overcast','Light rain','Heavy rain'].includes(r.weather)),'Random forecasts stay valid');
    click('[data-action="export-data"]');const backup=await downloads.find(d=>d.name==='apex-paddock.json').text;
    assert(JSON.parse(backup).season.name==='Regression Season','Paddock export includes the customized season');
    const transfer=new frame.contentWindow.DataTransfer();
    transfer.items.add(new frame.contentWindow.File([backup],'backup.json',{type:'application/json'}));
    doc().querySelector('#import-file').files=transfer.files;
    doc().querySelector('#import-file').dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));await sleep(50);
    assert(doc().querySelector('#toast').textContent==='Paddock imported.'&&saved().cars[9].topSpeed===259,'Paddock import restores tracks, car setups and season strategies');
    anchor.click=originalClick;
    click('[data-nav="records"]');click('[data-ghost-track="verdant"]');
    assert(doc().body.textContent.includes('Ghost loaded'),'Completed lap is loaded from saved records');
    click('[data-action="start-race"]');await sleep(350);
    assert(doc().querySelector('#leaderboard').textContent.includes('Ghost'),'Time trial displays the saved ghost');
    assert(doc().querySelector('#race-canvas').dataset.drawError==='0','Ghost and opaque world render without WebGL errors');
    click('[data-action="pause"]');click('[data-action="end-session"]');click('[data-nav="dashboard"]');
    await load();click('[data-nav="tracks"]');assert(doc().body.textContent.includes('Regression Circuit'),'Custom circuit survives page reload');
    assert(errors.length===0,'No application exceptions during UI checks');
    out.textContent+='\n\n'+checks+' UI checks passed. Engine regression suite: npm test.';
  }catch(e){out.textContent+='\nFAIL '+e.stack;}
};
let sceneRace,sector=0,showGhost=false,animation=0;
function scene(){
  cancelAnimationFrame(animation);frame.hidden=true;document.querySelector('.stage').hidden=false;
  const s=defaultState(),t=s.tracks[+document.querySelector('#track').value],track={...makeTrack(t.points,t.width),id:t.id};
  s.race.weather=document.querySelector('#weather').value;sceneRace=createRace(s,track,showGhost?'ghost':'race');
  sceneRace.cars.forEach((c,i)=>{c.distance=track.length*sector/8-i*10;resetWorld(track,c);});
  if(showGhost){const p=sceneRace.cars[0],q=atTrack(track,p.distance+12,2);sceneRace.ghost={time:10,samples:[{t:0,d:p.distance+12,o:2,x:q.x,z:q.z,h:q.yaw},{t:10,d:p.distance+12,o:2,x:q.x,z:q.z,h:q.yaw}]};}
  const canvas=document.querySelector('#view');
  function render(){drawRace(canvas,sceneRace,1/60);out.textContent='Visual inspection: '+t.name+' / sector '+sector+' / '+sceneRace.weather+' / WebGL error '+canvas.dataset.drawError;animation=requestAnimationFrame(render);}render();
}
document.querySelector('#scene').onclick=scene;
document.querySelector('#corner').onclick=()=>{sector=(sector+1)%8;scene();};
document.querySelector('#ghost').onclick=()=>{showGhost=!showGhost;scene();};
document.querySelector('#weather').onchange=scene;document.querySelector('#track').onchange=scene;
