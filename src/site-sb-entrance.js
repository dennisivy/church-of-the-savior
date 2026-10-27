import * as T from 'three';
import base from './site-sb.js';
import {entranceMaterials,metricUV,visibilityEnabled,entranceAssets} from './sb/entrance-materials.js';
import {entranceDetail} from './sb/entrance-detail.js';
const M=await entranceMaterials(),changes=[];let detail,rig,mode=new URLSearchParams(location.search).get('finish')||'after';
let initialEnv;
function apply(){
 const improved=mode!=='before';visibilityEnabled.value=mode==='after'?1:0;
 for(const c of changes){c.o.material=improved?c.after:c.before;c.o.geometry=improved?c.geo:c.original;}
 if(detail)detail.visible=improved;
 if(rig){
  const lit=mode==='after';rig.scene.environmentIntensity=lit?1.1:initialEnv;
  
  const target=new T.Vector3(...(lit?[-19,10,18]:[0,35,0]));rig.sun.position.add(target.clone().sub(rig.sun.target.position));rig.sun.target.position.copy(target);rig.sun.shadow.camera.left=lit?-29:-70;rig.sun.shadow.camera.right=lit?29:70;
  rig.sun.shadow.camera.top=lit?29:70;rig.sun.shadow.camera.bottom=lit?-29:-70;rig.sun.shadow.camera.updateProjectionMatrix();
  rig.sun.shadow.normalBias=lit?.012:.025;rig.renderer.shadowMap.needsUpdate=true;
 }
 document.querySelectorAll('[data-finish]').forEach(b=>{b.classList.toggle('selected',b.dataset.finish===mode);b.setAttribute('aria-pressed',String(b.dataset.finish===mode));});
 document.getElementById('comparison-state').textContent=mode==='before'?'BEFORE · original surfaces and lighting':mode==='materials'?'SURFACES · original lighting':'AFTER · detailed surfaces + baked porch shading';
}
const presets={
 street:['Eye-level approach',[-25,1.7,34],[-19.25,4.6,21]],
 close:['Stone & door',[-22.6,2.0,25.9],[-20.2,2.65,21]],
 porch:['Entire entrance',[-27,6,31],[-19.25,5,21.35]],
 wall:['Brick & stone',[-15.3,7.3,26],[-16.5,7.0,20.1]],
};
const requested=new URLSearchParams(location.search).get('view');
const site={...base,title:'Church entrance · material and lighting study',cameraNear:.05,
 extraTextureBytes:110592,
 createMaterials(){const result=base.createMaterials();result.assets.push(...entranceAssets);return result;},
 presets:presets[requested]?{[requested]:presets[requested],...presets}:presets,
 build(mats,level){const g=base.build(mats,level);if(level!=='high')return g;
  g.updateMatrixWorld(true);g.traverse(o=>{
   if(!o.isMesh||Array.isArray(o.material)||o.isInstancedMesh)return;
   const b=new T.Box3().setFromObject(o),c=b.getCenter(new T.Vector3());
   const porch=o.name.startsWith('Blender porch')&&c.z>0;
   const adjacent=(o.name==='Masonry with recessed openings'||o.name==='Granite arcade and courses'||o.name.startsWith('Blender facade-ornament'))&&b.max.z>14;
   if(!porch&&!adjacent)return;
   let m=null,name=o.name;
   if(/Blender porch \/ brick$|Masonry|Siegersdorf/i.test(name))m=M.brick;
   else if(/granite/i.test(name))m=M.granite;
   else if(/stone|marble|white/i.test(name))m=M.stone;
   else if(porch&&/gold/.test(name))m=M.gold;
   else if(porch&&/dark/.test(name))m=M.dark;
   if(!m)return;
   const geo=metricUV(o);changes.push({o,before:o.material,after:m,original:o.geometry,geo});
  });
  detail=entranceDetail(M);g.add(detail);Object.entries(M).forEach(([k,m])=>mats['entrance_'+k]=m);apply();return g;
 },
 configure(r){rig=r;initialEnv=r.scene.environmentIntensity;apply();},
};
for(const b of document.querySelectorAll('[data-finish]'))b.addEventListener('click',()=>{mode=b.dataset.finish;apply();});
export default site;
