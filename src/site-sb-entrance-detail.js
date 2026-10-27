import * as T from 'three';
import previous from './site-sb-entrance.js';
import {metricUV} from './sb/entrance-materials.js';
import {addGrime} from './materials.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
const path='assets/spilled-blood/entrance-detail/';
const draco=new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/').setWorkerLimit(2);
const [kit,manifest,map,normalMap,roughnessMap]=await Promise.all([
 new GLTFLoader().setDRACOLoader(draco).loadAsync(path+'roof-ornament.glb'),fetch(path+'manifest.json').then(r=>r.json()),
 ...['south-mosaic-source.webp','tessera-normal.jpg','tessera-rough.jpg'].map(f=>new T.TextureLoader().loadAsync(path+f))]);
map.colorSpace=T.SRGBColorSpace;for(const t of[map,normalMap,roughnessMap])t.anisotropy=8;
const mosaic=new T.MeshStandardMaterial({name:'Source-resolution photographed mosaic',map,normalMap,roughnessMap,normalScale:new T.Vector2(.32,.32),roughness:1,metalness:.08,alphaTest:.35,side:T.DoubleSide});
const altered=[],hidden=[],caps=[];let rig,ready=false,enabled=new URLSearchParams(location.search).get('refine')!=='before';
kit.scene.position.set(-19.25,0,16.25);kit.scene.name='Blender overlapping roof and pierced gilt ornament';
kit.scene.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;if(o.material.name.includes('glaze')){o.geometry=metricUV(o);o.material.normalMap=normalMap;o.material.roughnessMap=roughnessMap;o.material.normalScale=new T.Vector2(.045,.045);addGrime(o.material,{macro:.32,streaks:.1,ground:0,scale:5});}else addGrime(o.material,{macro:.3,streaks:.15,ground:0,scale:3});if(o.material.name==='Patinated copper')o.material.side=T.DoubleSide;}});
function update(){if(!ready)return;kit.scene.visible=enabled;caps.forEach(o=>o.visible=enabled);hidden.forEach(o=>o.visible=!enabled);for(const c of altered){if(c.material)c.o.material=enabled?c.material:c.oldMaterial;if(c.geometry)c.o.geometry=enabled?c.geometry:c.oldGeometry;}
 if(rig)rig.renderer.shadowMap.needsUpdate=true;
 document.querySelectorAll('[data-refine]').forEach(b=>{b.classList.toggle('selected',(b.dataset.refine==='after')===enabled);b.setAttribute('aria-pressed',String((b.dataset.refine==='after')===enabled));});
 document.getElementById('comparison-state').textContent=enabled?'AFTER · overlapping tiles / pierced metal / source-resolution mosaic':'BEFORE · previous material and shading pass';
}
// Retain eagle and door handles, remove only the old simple gable loops.
export function filteredGeometry(o,keep){const src=o.geometry.index?o.geometry.toNonIndexed():o.geometry,ids=[],p=src.attributes.position,q=new T.Vector3();
 for(let i=0;i<p.count;i+=3){const points=[];for(let k=0;k<3;k++){q.fromBufferAttribute(p,i+k).applyMatrix4(o.matrixWorld);points.push(q.clone());}if(keep(points))ids.push(i,i+1,i+2);}
 const geo=new T.BufferGeometry();for(const [key,a]of Object.entries(src.attributes)){const data=new a.array.constructor(ids.length*a.itemSize);ids.forEach((v,i)=>{for(let k=0;k<a.itemSize;k++)data[i*a.itemSize+k]=a.array[v*a.itemSize+k];});geo.setAttribute(key,new T.BufferAttribute(data,a.itemSize,a.normalized));}geo.computeBoundingSphere();return geo;
}
const presets={
 craft:['Roof, lace & mosaic',[-27.8,10.4,29.6],[-19.25,8.0,20.3]],
 mosaic:['Mosaic close-up',[-21.2,8.25,25.0],[-19.25,7.75,21.36]],
 tiles:['Overlapping roof tiles',[-27.5,13.0,23.8],[-20.5,8.7,19.0]],
 tent:['Tiled tent',[-25,18,25],[-19.25,16,16.25]],
 street:previous.presets.street,
};
const view=new URLSearchParams(location.search).get('view');
const site={...previous,title:'Church entrance · roof, ornament and mosaic',presets:presets[view]?{[view]:presets[view],...presets}:presets,
 models:[...previous.models,{label:'Blender roof & pierced ornament',bytes:manifest.bytes}],
 createMaterials(){const result=previous.createMaterials();result.assets.push(...[['south-mosaic-source.webp',map],['tessera-normal.jpg',normalMap],['tessera-rough.jpg',roughnessMap]].map(([f,texture])=>({path:path+f,texture})));return result;},
 build(mats,level){const g=previous.build(mats,level);if(level!=='high')return g;g.updateMatrixWorld(true);
  g.traverse(o=>{if(!o.isMesh)return;
   if(o.name==='Licensed mosaic: south-porch-front')altered.push({o,material:mosaic,oldMaterial:o.material});
   if(o.name==='Licensed mosaic: south-west-porch'){const m=o.material.clone();m.name='West mosaic / original photo with surface response';m.normalMap=normalMap;m.normalScale.set(.25,.25);m.roughnessMap=roughnessMap;m.roughness=1;altered.push({o,material:m,oldMaterial:o.material});mats.westMosaicRefined=m;}
   if(!o.name.startsWith('Blender porch'))return;
   const c=new T.Box3().setFromObject(o).getCenter(new T.Vector3());if(c.z<0)return;
   if(/\/ (blue|green|ochre|white)$/.test(o.name))hidden.push(o);
   if(/\/ brick$/.test(o.name)){
    const isCap=ps=>ps.every(p=>p.y>8.45&&p.y<8.9&&Math.abs(p.x+19.25)<3.6&&Math.abs(p.z-16.25)<3.6);
    const cap=new T.Mesh(filteredGeometry(o,isCap),new T.MeshStandardMaterial({name:'Standing seam core roof',color:'#425e55',metalness:.55,roughness:.52}));cap.name='Copper core roof closure';cap.matrix.copy(o.matrixWorld);cap.matrixAutoUpdate=false;cap.castShadow=cap.receiveShadow=true;caps.push(cap);
    altered.push({o,oldGeometry:o.geometry,geometry:filteredGeometry(o,ps=>!isCap(ps))});
   }
   if(/\/ stone$/.test(o.name))altered.push({o,oldGeometry:o.geometry,geometry:filteredGeometry(o,ps=>!ps.every(p=>p.y>7.6&&p.y<8.95&&Math.abs(p.x+19.25)<4.1&&Math.abs(p.z-16.25)<4.1))});
   if(/\/ gold$/.test(o.name))altered.push({o,geometry:filteredGeometry(o,ps=>{const h=ps.reduce((s,p)=>s+p.y/3,0);return h<5.5||h>10.6;}),oldGeometry:o.geometry});
  });
  if(caps.length){const geos=[];for(let x=-3.15;x<3.5;x+=.45)geos.push(new T.BoxGeometry(.018,.028,6.98).translate(-19.25+x,8.817,16.25));const seams=new T.Mesh(mergeGeometries(geos),caps[0].material);seams.name='Folded seams on core roof';seams.castShadow=seams.receiveShadow=true;caps.push(seams);}
  g.add(kit.scene,...caps);mats.mosaicRefined=mosaic;caps.forEach(o=>mats['coreRoof_'+o.material.uuid]=o.material);kit.scene.traverse(o=>{if(o.isMesh)mats['detail_'+o.material.uuid]=o.material;});ready=true;update();return g;
 },
 configure(r){previous.configure(r);rig=r;update();},
};
for(const b of document.querySelectorAll('[data-refine]'))b.addEventListener('click',()=>{enabled=b.dataset.refine==='after';update();});
export default site;
