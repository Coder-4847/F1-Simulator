import {mkdir,writeFile} from 'node:fs/promises';
import {carMesh} from '../src/render.js';
import {defaultState} from '../src/core.js';
const faces=carMesh(defaultState().car);
const materials=[...new Set(faces.map(f=>f.c))];
let obj='# APEX V26 Formula car | meters | Y up | +Z forward\nmtllib apex-v26.mtl\no V26\n',index=1;
for(const f of faces){obj+=f.p.map(v=>'v '+v.join(' ')).join('\n')+'\nusemtl material_'+materials.indexOf(f.c)+'\nf '+f.p.map(()=>index++).join(' ')+'\n';}
const mtl=materials.map((color,i)=>{const rgb=color.startsWith('#')?color.slice(1).match(/../g).map(v=>parseInt(v,16)/255):color.match(/[\d.]+/g).map(v=>Number(v)/255);return `newmtl material_${i}\nKd ${rgb.join(' ')}\nKa 0.1 0.1 0.1\n`;}).join('\n');
await mkdir(new URL('../assets/',import.meta.url),{recursive:true});
await writeFile(new URL('../assets/apex-v26.obj',import.meta.url),obj);
await writeFile(new URL('../assets/apex-v26.mtl',import.meta.url),mtl);
console.log(`Exported ${faces.length} colored faces to assets/apex-v26.obj and apex-v26.mtl`);
