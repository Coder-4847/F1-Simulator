export const TEAMS = [
  { name: 'Vantage Racing', short: 'VAN', color: '#d8ff36', secondary: '#222b25', drivers: ['You', 'Luca Moretti'] },
  { name: 'Scuderia Rosso', short: 'ROS', color: '#f05243', secondary: '#4e1319', drivers: ['Enzo Ricci', 'Mateo Cruz'] },
  { name: 'Aether Motorsport', short: 'AET', color: '#71caff', secondary: '#1e3555', drivers: ['Noah Blake', 'Kai Tanaka'] },
  { name: 'Orion GP', short: 'ORI', color: '#b19aff', secondary: '#352349', drivers: ['Alex Laurent', 'Oscar Berg'] },
  { name: 'Solstice Formula', short: 'SOL', color: '#ffad4e', secondary: '#4c2919', drivers: ['Leo Fischer', 'Sam Okafor'] }
];
export const TIRES = { soft: { color: '#ef615e', grip: 1.12, wear: 1.6, wet: .43 }, medium: { color: '#f2cb55', grip: 1, wear: 1, wet: .49 }, hard: { color: '#e8eee9', grip: .91, wear: .65, wet: .52 }, intermediate: { color: '#79d17b', grip: .84, wear: 1.05, wet: .88 }, wet: { color: '#7aaeff', grip: .73, wear: 1.2, wet: 1.15 } };
export const WEATHER = ['Clear', 'Overcast', 'Light rain', 'Heavy rain'];
export const DEFAULT_POINTS = [[.18,.73],[.12,.51],[.18,.22],[.38,.13],[.57,.20],[.72,.13],[.88,.25],[.88,.48],[.73,.55],[.78,.75],[.61,.86],[.48,.73],[.34,.85]];
export const PRESETS = [
  { id: 'verdant', name: 'Verdant International', location: 'THE LAKE DISTRICT', points: DEFAULT_POINTS, width: 13 },
  { id: 'coastal', name: 'Costa Azure Circuit', location: 'THE MEDITERRANEAN COAST', points: [[.13,.72],[.13,.28],[.26,.15],[.75,.15],[.89,.29],[.75,.40],[.88,.65],[.74,.85],[.47,.72],[.29,.85],[.35,.54]], width: 14 },
  { id: 'alpine', name: 'Alpine Ring', location: 'THE NORTHERN HIGHLANDS', points: [[.15,.7],[.2,.24],[.47,.13],[.8,.19],[.87,.47],[.65,.6],[.78,.82],[.48,.82],[.38,.52]], width: 12 }
];
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const mod = (n, m) => ((n % m) + m) % m;
export function formatTime(t) { if (!Number.isFinite(t) || t <= 0) return '—:——.———'; return `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, '0')}`; }
export function makeTrack(points, width = 13) {
  const samples = []; const count = points.length;
  for (let i = 0; i < count; i++) {
    const p0=points[mod(i-1,count)],p1=points[i],p2=points[(i+1)%count],p3=points[(i+2)%count];
    for(let j=0;j<32;j++) {
      const t=j/32, t2=t*t, t3=t2*t;
      const xy=[0,1].map(k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3));
      samples.push({ x:(xy[0]-.5)*1250,z:(xy[1]-.5)*1250 });
    }
  }
  let length=0;
  samples.forEach((p,i)=>{ const next=samples[(i+1)%samples.length]; p.s=length; p.seg=Math.hypot(next.x-p.x,next.z-p.z); length+=p.seg; p.yaw=Math.atan2(next.x-p.x,next.z-p.z); });
  return { samples, length, width };
}
export function atTrack(track, distance, offset=0) {
  const d=mod(distance,track.length), a=track.samples;
  let lo=0,hi=a.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(a[mid].s<=d)lo=mid;else hi=mid-1;}
  const p=a[lo],q=a[(lo+1)%a.length],t=(d-p.s)/(p.seg||1);
  // Interpolate the tangent as well as the position. Using p.yaw for a whole
  // sample used to make the car and chase camera snap 32 times per spline.
  const yaw=p.yaw+angleDiff(q.yaw,p.yaw)*t;
  return {x:p.x+(q.x-p.x)*t+Math.cos(yaw)*offset,z:p.z+(q.z-p.z)*t-Math.sin(yaw)*offset,yaw,index:lo};
}
export function angleDiff(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
export function tireGrip(type, weather, wear=0){const t=TIRES[type]||TIRES.medium;const wet=weather==='Heavy rain'?1:weather==='Light rain'?.65:0;return (t.grip*(1-wet)+t.wet*wet)*(1-clamp(wear,0,100)*.004);}
export function scoreSeason(results) { const pts=[25,18,15,12,10,8,6,4,2,1];const totals=Array(10).fill(0);results.forEach(r=>r.forEach((id,i)=>{if(id>=0&&id<10)totals[id]+=pts[i]||0;}));return totals; }
export function defaultState(){return {version:1,tracks:structuredClone(PRESETS),selectedTrack:'verdant',car:{primary:'#d8ff36',secondary:'#222b25',accent:'#f4f6e9',number:27,pattern:'Split',rim:'#c5ccbf',topSpeed:335,downforce:65,brakes:70,suspension:55},cars:{},race:{laps:3,weather:'Clear',tire:'medium',fuel:30,difficulty:70,damage:true,pitLap:2,pitTire:'hard'},season:{name:'2026 World Series',rounds:[{track:'verdant',weather:'Clear',laps:3,pits:[{lap:2,tire:'hard'}]},{track:'coastal',weather:'Light rain',laps:3,pits:[{lap:2,tire:'intermediate'}]},{track:'alpine',weather:'Overcast',laps:3,pits:[{lap:2,tire:'hard'}]}],results:[]},records:{}};}
