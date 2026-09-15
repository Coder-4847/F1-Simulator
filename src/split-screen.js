import {TIRES,formatTime,clamp} from './core.js';
import {playerState,standings} from './race.js';
import {drawRace,drawMap} from './render.js';
import {damageDiagram} from './handling.js';

export const splitControls=['W A S D · Space brake · B pit · R reset','↑ ← ↓ → · Enter brake · P pit · Backspace reset'];
export function splitMarkup(r){
  return `<div class="split-screen ${r.splitScreen}" id="split-screen">${[0,1].map(id=>`<section class="split-pane" aria-label="Player ${id+1} race view"><canvas id="split-canvas-${id}" aria-label="Player ${id+1} chase camera"></canvas><header class="split-top"><div><b>PLAYER ${id+1}</b><span id="split-position-${id}"></span></div><div id="split-timing-${id}"></div></header><div class="split-message" id="split-message-${id}"></div><div class="split-bottom"><div><strong class="split-speed" id="split-speed-${id}">0</strong><small> KM/H </small><b id="split-gear-${id}">N</b><div id="split-status-${id}"></div><div id="split-pit-${id}"></div></div><div class="damage-diagram" id="split-damage-${id}"></div><canvas class="split-map" id="split-map-${id}" aria-label="Player ${id+1} minimap"></canvas></div><footer>${splitControls[id]}</footer></section>`).join('')}<button class="split-pause" data-action="pause" aria-label="Pause both players">Pause · Esc</button><div id="race-overlay"></div></div>`;
}
export function drawSplit(r,dt){
  r.splitViews ||= [Object.create(r),Object.assign(Object.create(r),{viewPlayer:1})];
  for(const id of [0,1])drawRace(document.querySelector(`#split-canvas-${id}`),r.splitViews[id],dt);
}
export function updateSplitHUD(r){
  const order=standings(r);
  for(const id of [0,1]){
    const c=r.cars[id],p=playerState(r,id),set=(name,text)=>document.querySelector(`#split-${name}-${id}`).textContent=text;
    set('position',` P${order.findIndex(car=>car.id===id)+1} · LAP ${Math.min(p.lap,r.config.laps)}/${r.config.laps}`);
    set('timing',`Lap ${formatTime(p.lapTime)} · Best ${formatTime(p.best)} · +${p.penalty||0}s`);
    set('speed',Math.round(Math.abs(c.speed)*3.6));set('gear',c.speed<-.05?'R':c.speed<1?'N':Math.min(8,Math.floor(c.speed/12)+1));
    set('status',`${c.fuel.toFixed(1)} kg · ${c.tire} ${Math.round(100-c.wear)}% · ${c.surface||'asphalt'}`);
    const stop=r.pitPlan.find(s=>s.lap>=p.lap&&!c.pitted.includes(s.lap));
    set('pit',c.pitTime>0?`PIT ${c.pitTime.toFixed(1)}s`:p.pitRequested?'PIT REQUESTED':stop?`PIT LAP ${stop.lap}`:'NO PLANNED STOP');
    set('message',c.retired?'RETIRED · waiting for other player':c.finished?'FINISHED · waiting for other player':r.countdown>0?Math.ceil(r.countdown):r.elapsed<p.messageUntil?p.message:'');
    document.querySelector(`#split-damage-${id}`).innerHTML=damageDiagram(c);
    drawMap(document.querySelector(`#split-map-${id}`),r.track,{cars:r.cars.map(car=>({...car,id:car.id===id?0:car.id===0?-1:car.id}))});
  }
}
export function splitPause(r,onSettingsChange){
  const overlay=document.querySelector('#race-overlay');
  overlay.innerHTML=`<div class="overlay"><div class="modal"><div class="eyebrow">LOCAL TWO PLAYER</div><h2>Both players paused</h2><p>Request a pit stop while driving with <b>P1: B</b> or <b>P2: P</b>. Service settings below belong to the labeled player.</p><div class="field"><label for="split-layout">Screen layout</label><select id="split-layout"><option value="side" ${r.splitScreen==='side'?'selected':''}>Side by side</option><option value="stacked" ${r.splitScreen==='stacked'?'selected':''}>Top and bottom</option></select></div><div class="field"><label for="split-difficulty">AI difficulty (0–100)</label><input id="split-difficulty" type="number" min="0" max="100" value="${r.config.difficulty}"></div><div class="split-strategies">${[0,1].map(id=>{const p=playerState(r,id);return `<section><h3>Player ${id+1}</h3><p>${splitControls[id]}</p><div class="field"><label for="split-tire-${id}">Next pit tires</label><select id="split-tire-${id}">${Object.keys(TIRES).map(t=>`<option ${p.pitTire===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="field"><label for="split-fuel-${id}">Refuel target (kg)</label><input id="split-fuel-${id}" type="number" min="5" max="100" value="${p.pitFuel}"></div></section>`;}).join('')}</div><div class="modal-actions"><button class="primary" data-action="pause">Resume both players</button><button data-action="end-session">End session</button></div></div></div>`;
  document.querySelector('#split-layout').onchange=e=>{r.splitScreen=e.target.value;document.querySelector('#split-screen').className='split-screen '+r.splitScreen;onSettingsChange('splitScreen',r.splitScreen);};
  document.querySelector('#split-difficulty').onchange=e=>{r.config.difficulty=clamp(Number(e.target.value)||0,0,100);onSettingsChange('difficulty',r.config.difficulty);};
  for(const id of [0,1]){
    document.querySelector(`#split-tire-${id}`).onchange=e=>playerState(r,id).pitTire=e.target.value;
    document.querySelector(`#split-fuel-${id}`).onchange=e=>playerState(r,id).pitFuel=clamp(Number(e.target.value)||5,5,100);
  }
}
export function splitResults(r){
  return `<div class="overlay"><div class="modal"><div class="eyebrow">LOCAL TWO PLAYER</div><h2>${r.aborted?'Session ended':'Race complete'}</h2>${[0,1].map(id=>{const c=r.cars[id],p=playerState(r,id);return `<h3>Player ${id+1} · ${c.retired?'DNF':c.finished?'P'+(standings(r).findIndex(v=>v.id===id)+1):'Unfinished'}</h3><p>Best lap ${formatTime(p.best)} · ${Math.max(0,p.lap-1)} laps · ${p.penalty||0}s penalty${c.finished?' · Finish '+formatTime(c.finishTime):''}</p>`;}).join('')}<table class="table"><thead><tr><th>Pos</th><th>Driver</th><th>Status</th></tr></thead><tbody>${standings(r).map((c,i)=>`<tr><td>${i+1}</td><td>${c.name}</td><td>${c.retired?'DNF':c.finished?'Finished':'On track'}</td></tr>`).join('')}</tbody></table><div class="modal-actions"><button class="primary" data-action="race-again">Race again</button><button data-nav="dashboard">Race hub</button></div></div></div>`;
}
