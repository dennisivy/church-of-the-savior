import * as T from 'three';
import {addGrime} from '../materials.js';
const loader=new T.TextureLoader();
export const entranceAssets=[];
export const visibilityEnabled={value:1};
export const mirrorVisibility={value:0};
const vmeta=await fetch('assets/spilled-blood/entrance-study/sky-visibility.json').then(r=>r.json());
const vdata=new Uint8Array(await fetch('assets/spilled-blood/entrance-study/sky-visibility.bin').then(r=>r.arrayBuffer()));
const volume=new T.Data3DTexture(vdata,...vmeta.size);volume.format=T.RedFormat;volume.type=T.UnsignedByteType;volume.minFilter=volume.magFilter=T.LinearFilter;volume.unpackAlignment=1;volume.needsUpdate=true;entranceAssets.push({path:'assets/spilled-blood/entrance-study/sky-visibility.bin',texture:volume});
function skyVisibility(m){
 const previous=m.onBeforeCompile,key=m.customProgramCacheKey();
 m.onBeforeCompile=sh=>{previous(sh);sh.uniforms.entranceVisibility={value:volume};sh.uniforms.entranceVisibilityOn=visibilityEnabled;sh.uniforms.mirrorEntranceVisibility=mirrorVisibility;
 sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
 uniform highp sampler3D entranceVisibility;
 uniform float entranceVisibilityOn;
 uniform float mirrorEntranceVisibility;`);
 sh.fragmentShader=sh.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
 vec3 shadeWorldNormal=inverseTransformDirection(normal,viewMatrix);
 vec3 shadePoint=vGW+shadeWorldNormal*.26;
 shadePoint.z=mix(shadePoint.z,abs(shadePoint.z),mirrorEntranceVisibility);
 vec3 shadeUVW=(shadePoint-vec3(-26.,0.,13.))/vec3(14.,14.,13.);
 float shadeInside=step(0.,shadeUVW.x)*step(0.,shadeUVW.y)*step(0.,shadeUVW.z)*step(shadeUVW.x,1.)*step(shadeUVW.y,1.)*step(shadeUVW.z,1.);
 float skyAccess=texture(entranceVisibility,clamp(shadeUVW,0.,1.)).r;
 float entranceAO=mix(1.,.36+.64*skyAccess,shadeInside*entranceVisibilityOn);
 reflectedLight.indirectDiffuse*=entranceAO;
 reflectedLight.indirectSpecular*=mix(1.,entranceAO,.55);`);
 };m.customProgramCacheKey=()=>key+'entranceSkyVisibility1';
}
let materialPromise;
export function entranceMaterials(){return materialPromise ||= makeEntranceMaterials();}
async function makeEntranceMaterials(){
 const sets={};
 await Promise.all(['brick','granite','stone'].map(async name=>{
  const [map,normalMap,roughnessMap]=await Promise.all(['color.jpg','normal.jpg','rough.jpg'].map(s=>loader.loadAsync(`assets/spilled-blood/entrance-study/${name}-${s}`)));
  for(const [i,t] of [map,normalMap,roughnessMap].entries()){entranceAssets.push({path:`assets/spilled-blood/entrance-study/${name}-${['color.jpg','normal.jpg','rough.jpg'][i]}`,texture:t});t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;t.repeat.set(...(name==='brick'?[1/1.08,1/.60]:name==='granite'?[1/.48,1/.48]:[1/.85,1/.85]));}
  map.colorSpace=T.SRGBColorSpace;
  const m=new T.MeshStandardMaterial({name:`Entrance ${name}`,map,normalMap,roughnessMap,roughness:name==='granite'?.92:1,normalScale:new T.Vector2(name==='brick'?.9:.55,name==='brick'?.9:.55)});
  addGrime(m,{macro:.5,streaks:name==='stone'?.45:.18,ground:.18,scale:1});skyVisibility(m);sets[name]=m;
 }));
 sets.dark=new T.MeshStandardMaterial({name:'Aged iron',color:'#262a29',metalness:.65,roughness:.68});
 sets.gold=new T.MeshStandardMaterial({name:'Aged brass',color:'#ad8850',metalness:.86,roughness:.42});
 return sets;
}
// Project in metres, including top faces. Only the experiment's clones are changed.
export function metricUV(mesh){
 const old=mesh.geometry;const geo=old.index?old.toNonIndexed():old.clone();
 const p=geo.attributes.position,uv=new Float32Array(p.count*2),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3();
 for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);n.subVectors(b,a).cross(c.sub(a));
  const axis=Math.abs(n.y)>Math.max(Math.abs(n.x),Math.abs(n.z))?'y':Math.abs(n.x)>Math.abs(n.z)?'x':'z';
  for(let k=0;k<3;k++){uv[(i+k)*2]=axis==='x'?p.getZ(i+k):p.getX(i+k);uv[(i+k)*2+1]=axis==='y'?p.getZ(i+k):p.getY(i+k);}}
 geo.setAttribute('uv',new T.BufferAttribute(uv,2));return geo;
}
