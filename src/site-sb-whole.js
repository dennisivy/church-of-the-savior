import * as T from 'three';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
const hdr=await new RGBELoader().loadAsync('assets/spilled-blood/whole-refinement/kloofendal_2k.hdr');
let environment;
const mosaicMetadata=await fetch('assets/spilled-blood/whole-refinement/mosaics/metadata.json').then(r=>r.json());
const mosaicMaps=await Promise.all(Object.values(mosaicMetadata.replacements).map(async p=>{const map=await new T.TextureLoader().loadAsync(p.delivery_path);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;return {key:p.mesh_key,map,path:p.delivery_path};}));

import previous from './site-sb-entrance-carving.js';
import {filteredGeometry} from './site-sb-entrance-detail.js';
import {entranceMaterials,metricUV,mirrorVisibility} from './sb/entrance-materials.js';
import {refineRoofs} from './sb/roof-refinement.js';
import {refineSurfaces} from './sb/surface-refinement.js';
import {refineAnnexeJoins} from './sb/annexe-joins.js';
import {refineRoofJoins} from './sb/roof-joins.js';
import {refineCornerBases} from './sb/corner-base-refinement.js';
import {refineDrainage} from './sb/drain-refinement.js';
import {refineFacades} from './sb/facade-refinement.js';
const M=await entranceMaterials(), changes=[], hidden=[];
let added,roofs,facades,surfaces,drainage,corners,joins,annexe,rig,enabled=new URLSearchParams(location.search).get('whole')!=='before';
function apply(){if(!added)return;if(!enabled){annexe.restore();roofs.restore();surfaces.restore();facades.restore();drainage.restore();corners.restore();joins.restore();}if(enabled){joins.apply();corners.apply();}added.visible=enabled;mirrorVisibility.value=enabled?1:0;for(const o of hidden)o.visible=!enabled;for(const c of changes){c.o.material=enabled?c.material:c.old;c.o.geometry=enabled?c.geo:c.oldGeo;}
 if(enabled){surfaces.apply();roofs.apply();facades.apply();drainage.apply();annexe.apply();}
 if(rig)rig.renderer.shadowMap.needsUpdate=true;
 document.querySelectorAll('[data-whole]').forEach(b=>b.classList.toggle('selected',(b.dataset.whole==='after')===enabled));
 document.getElementById('comparison-state').textContent=enabled?'AFTER · whole-exterior materials, roofs and profiles':'BEFORE · completed southern entrance only';}
const presets={northmosaic:['North-west mosaic',[-29,8,-16.25],[-24.365,7.7,-16.25]],walk:['Walk-up view',[-42,1.7,53],[-8,20,0]],overview:['Whole church',[-105,58,117],[0,32,0]],north:['North entrance',[-28,6,-34],[-19.25,6,-18]],east:['Apse roofs',[48,26,37],[20,16,0]],south:['South wall',[3,11,37],[0,13,15]],domes:['Domes',[-45,55,60],[0,48,0]],west:['West facade',[-55,20,1],[-23,19,0]],...previous.presets};
const view=new URLSearchParams(location.search).get('view');
export default {...previous,title:'Spilled Blood · whole exterior refinement',presets:presets[view]?{[view]:presets[view],...presets}:presets,
 createMaterials(){const r=previous.createMaterials();r.assets.push(...mosaicMaps.map(p=>({path:p.path,texture:p.map})));r.assets.push({path:'assets/spilled-blood/whole-refinement/kloofendal_2k.hdr',texture:hdr});return r;},
 update(state){previous.update?.(state);if(rig&&environment){rig.scene.environment=environment.texture;rig.scene.environmentIntensity=1.1;}},
 build(mats,level){const root=previous.build(mats,level);if(level!=='high')return root;
 root.updateMatrixWorld(true);added=new T.Group();added.name='Whole exterior / north entrance completion';
 // Reflect architectural components, never photographed mosaic scenes.
 for(const name of ['Blender overlapping roof and pierced gilt ornament','Entrance refinement / photo-informed simplified carvings','Carved capital and pedestal study','Copper core roof closure','Folded seams on core roof']){
  const source=root.getObjectByName(name);if(!source)continue;
  const mirror=new T.Group();mirror.name='North / '+name;mirror.scale.z=-1;mirror.add(source.clone(true));added.add(mirror);
 }
 // Reuse the approved relief on both perpendicular west-facing portal arches.
 for(const name of ['Entrance refinement / photo-informed simplified carvings','Carved capital and pedestal study']){
  const source=root.getObjectByName(name);if(!source)continue;
  const turn=new T.Group();turn.name='South-west / '+name;turn.matrixAutoUpdate=false;
  turn.matrix.makeTranslation(-19.25,0,16.25).multiply(new T.Matrix4().makeRotationY(-Math.PI/2)).multiply(new T.Matrix4().makeTranslation(19.25,0,-16.25));turn.add(source.clone(true));added.add(turn);
  const mirror=new T.Group();mirror.name='North-west / '+name;mirror.scale.z=-1;mirror.add(turn.clone(true));added.add(mirror);
 }
 const objects=[];root.traverse(o=>{if(o.isMesh)objects.push(o);});
 const geoCache=new Map();
 for(const o of objects){if(Array.isArray(o.material))continue;
  let material=o.material,geo=o.geometry;const n=o.name;
  const north=n.startsWith('Blender porch')&&new T.Box3().setFromObject(o).getCenter(new T.Vector3()).z<0;
  const replacement=mosaicMaps.find(p=>p.key===n);if(replacement){material=o.material.clone();material.map=replacement.map;material.name='Native-resolution '+n;}
  if(north){
   if(/\/ (blue|green|ochre|white)$/.test(n)){hidden.push(o);continue;}
   if(/\/ gold$/.test(n))geo=filteredGeometry(o,ps=>{const h=ps.reduce((s,p)=>s+p.y/3,0);return h<5.5||h>10.6;});
   if(/\/ stone$/.test(n))geo=filteredGeometry(o,ps=>!ps.every(p=>p.y>7.6&&p.y<8.95&&Math.abs(p.x+19.25)<4.1&&Math.abs(p.z+16.25)<4.1));
   if(/\/ brick$/.test(n))geo=filteredGeometry(o,ps=>!ps.every(p=>p.y>8.45&&p.y<8.9&&Math.abs(p.x+19.25)<3.6&&Math.abs(p.z+16.25)<3.6));
  }
  // Existing red masonry uses metre UVs. Preserve distinct buff and plum bands.
  if(!material.name.startsWith('Entrance ')&&(n==='Masonry with recessed openings'||/\/ (brick|Siegersdorf red brick)( \(shared instances\))?$/.test(n))){material=M.brick;if(!geoCache.has(geo))geoCache.set(geo,metricUV({geometry:geo}));geo=geoCache.get(geo);}
  if(!material.name.startsWith('Entrance ')&&(n==='Arched window surrounds'||/Blender .*\/ (stone|marble|.*limestone.*|.*granite.*)( \(shared instances\))?$/i.test(n))){
   material=/granite/i.test(n)?M.granite:M.stone;
   if(!geoCache.has(geo)){const surrogate={geometry:geo};geoCache.set(geo,metricUV(surrogate));}geo=geoCache.get(geo);
  }
  if(material!==o.material||geo!==o.geometry)changes.push({o,old:o.material,material,oldGeo:o.geometry,geo});
 }
 root.add(added);drainage=refineDrainage(root,M);corners=refineCornerBases(root,M);joins=refineRoofJoins(root,M);for(const c of changes){c.o.material=c.material;c.o.geometry=c.geo;}surfaces=refineSurfaces(root,M);surfaces.apply();roofs=refineRoofs(root,M);facades=refineFacades(root,M);annexe=refineAnnexeJoins(root,M);
 
 Object.entries(M).forEach(([k,m])=>mats['whole_'+k]=m);apply();root.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material))mats['wholeMat_'+m.uuid]=m;});const seen=new Set();let invalid=0;root.traverse(o=>{if(!o.isMesh||seen.has(o.geometry))return;seen.add(o.geometry);for(const x of o.geometry.attributes.position.array)if(!Number.isFinite(x))invalid++;});if(invalid)throw new Error('Invalid exterior geometry: '+invalid);const desired=enabled;const snapshot=()=>{const rows=[];root.traverse(o=>{if(o.isMesh)rows.push([o.uuid,o.geometry.uuid,[].concat(o.material).map(m=>m.uuid),o.visible]);});return JSON.stringify(rows.sort((a,b)=>a[0].localeCompare(b[0])));};enabled=true;apply();const afterSnapshot=snapshot();enabled=false;apply();enabled=true;apply();if(snapshot()!==afterSnapshot)throw new Error('Before/after restoration is not stable');enabled=desired;apply();console.info('Exterior comparison check','Exact mesh/material/geometry state restored after toggle');console.info('Exterior geometry check',JSON.stringify({uniqueGeometries:seen.size,invalidCoordinates:invalid}));console.info('Exterior assembly report',JSON.stringify([...annexe.notes,...joins.notes,...corners.notes,...drainage.notes]));return root;
 },configure(r){previous.configure(r);rig=r;const generator=new T.PMREMGenerator(r.renderer);hdr.mapping=T.EquirectangularReflectionMapping;const lightScene=new T.Scene();lightScene.background=hdr;const ground=new T.Mesh(new T.CircleGeometry(100,64).rotateX(-Math.PI/2).translate(0,-3,0),new T.MeshBasicMaterial({color:new T.Color(.32,.29,.25),toneMapped:false}));lightScene.add(ground);environment=generator.fromScene(lightScene,.02,.1,200);ground.geometry.dispose();ground.material.dispose();generator.dispose();const target=new T.Vector3(0,35,0);r.sun.position.add(target.clone().sub(r.sun.target.position));r.sun.target.position.copy(target);Object.assign(r.sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55});r.sun.shadow.camera.updateProjectionMatrix();apply();}};
for(const b of document.querySelectorAll('[data-whole]'))b.addEventListener('click',()=>{enabled=b.dataset.whole==='after';apply();});
