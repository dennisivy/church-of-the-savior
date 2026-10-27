import * as T from 'three';
import {addGrime} from '../materials.js';
import {createWallMaterials} from './facades.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
const draco=new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/').setWorkerLimit(2);
const optimized=await fetch(new URL('../../assets/spilled-blood/optimized.json',import.meta.url)).then(r=>r.json());
const cached=new Map();
let requestedParts=0,loadedParts=0;
function progress(){const text=document.getElementById('loadtext');if(text)text.textContent=`Blender parts: ${loadedParts} / ${requestedParts}`;}
export function loadBlenderAsset(name) {
 if(!/^[a-z-]+$/.test(name))throw Error('Invalid component name');
 if(!cached.has(name)){
  requestedParts++;progress();
  const url=new URL(`../../assets/spilled-blood/${optimized[name]?.file||name+'.glb'}`,import.meta.url);
  const metadata=new URL(`../../assets/spilled-blood/${name==='central-cross'?'manifest':name}.json`,import.meta.url);
  cached.set(name,Promise.all([new GLTFLoader().setDRACOLoader(draco).loadAsync(url.href),fetch(metadata).then(r=>{if(!r.ok)throw Error(`Missing ${name} manifest`);return r.json();})]).then(([gltf,manifest])=>{
   if(optimized[name]){manifest.originalBytes=optimized[name].originalBytes;manifest.bytes=optimized[name].bytes;if(manifest.geometry)manifest.geometry.bytes=optimized[name].bytes;}
   const materials={};gltf.scene.traverse(o=>{if(o.isMesh){
    const originalName=o.material.name;
    if(['brick','Siegersdorf red brick'].includes(originalName.replace(/\.\d+$/,''))){
     // Project metre-sized masonry UVs per face. No extra texture download;
     // all brick shells share the same albedo/normal/roughness atlas.
     const source=o.geometry,geo=source.index?source.toNonIndexed():source;
     const p=geo.attributes.position,uv=new Float32Array(p.count*2),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3();
     for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);n.subVectors(b,a).cross(c.sub(a));const axis=Math.abs(n.x)>Math.abs(n.z)?2:0;
      for(let k=0;k<3;k++){uv[(i+k)*2]=axis===2?p.getZ(i+k):p.getX(i+k);uv[(i+k)*2+1]=p.getY(i+k);}}
     geo.setAttribute('uv',new T.BufferAttribute(uv,2));o.geometry=geo;o.material=createWallMaterials().brick;
     if(geo!==source)source.dispose();
    }
    if(/stone|marble|granite/i.test(originalName)&&!o.material.userData.surfaceWeathered){addGrime(o.material,{macro:.65,streaks:.32,ground:.3,scale:1.4});o.material.userData.surfaceWeathered=true;}
    o.castShadow=o.receiveShadow=true;o.name=`Blender ${name} / ${originalName}`;materials['blender_'+o.material.uuid]=o.material;
   }});
   loadedParts++;progress();
   return {scene:gltf.scene,materials,manifest};
  }));
 }
 return cached.get(name);
}
export const loadCentralCross=()=>loadBlenderAsset('central-cross');
