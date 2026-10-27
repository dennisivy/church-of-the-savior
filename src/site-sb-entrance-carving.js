import * as T from 'three';
import previous,{filteredGeometry} from './site-sb-entrance-detail.js';
import {carvedEntrance} from './sb/entrance-carving.js';
import {entranceMaterials,metricUV} from './sb/entrance-materials.js';
import {addGrime} from './materials.js';
const M=await entranceMaterials();let group,rig,enabled=new URLSearchParams(location.search).get('carving')!=='before';const changed=[];
function apply(){if(!group)return;group.visible=enabled;for(const c of changed){c.o.material=enabled?c.material:c.old;c.o.geometry=enabled?c.geo:c.oldGeo;}if(rig)rig.renderer.shadowMap.needsUpdate=true;
 document.querySelectorAll('[data-carving]').forEach(b=>{b.classList.toggle('selected',(b.dataset.carving==='after')===enabled);b.setAttribute('aria-pressed',String((b.dataset.carving==='after')===enabled));});document.getElementById('comparison-state').textContent=enabled?'AFTER · recessed carving / layered stone / worked gilding':'BEFORE · roof and mosaic pass';}
const presets={stone:['Capital and carved bands',[-23.5,3.4,26.0],[-21.1,2.6,21.3]],entry:['Entrance at eye level',[-24,1.7,31],[-19.25,3.7,21.2]],gilt:['Gilded edge',[-23.5,8.8,26.8],[-20.2,8.0,21.3]],...previous.presets};
const view=new URLSearchParams(location.search).get('view');
export default {...previous,title:'Church entrance · carving and finish',presets:presets[view]?{[view]:presets[view],...presets}:presets,
 build(mats,level){const g=previous.build(mats,level);if(level!=='high')return g;group=carvedEntrance(M);g.add(group);g.updateMatrixWorld(true);
 g.traverse(o=>{if(!o.isMesh)return;
 if(o.name==='Entrance granite / added entrance detail')changed.push({o,old:o.material,material:o.material,oldGeo:o.geometry,geo:filteredGeometry(o,ps=>!ps.every(p=>p.y>2.20&&p.y<2.44))});
 if(o.name==='Blender porch / gold'&&new T.Box3().setFromObject(o).getCenter(new T.Vector3()).z>0){
  const stile=ps=>ps.every(p=>Math.abs(p.x+19.25)<.07&&p.y>.5&&p.y<5.1&&p.z>19.5&&p.z<19.9);
  const darkStile=new T.Mesh(filteredGeometry(o,stile),M.dark);darkStile.name='Dark iron door meeting stile';darkStile.matrix.copy(o.matrixWorld);darkStile.matrixAutoUpdate=false;darkStile.castShadow=darkStile.receiveShadow=true;group.add(darkStile);
  changed.push({o,old:o.material,material:o.material,oldGeo:o.geometry,geo:filteredGeometry(o,ps=>!stile(ps))});
 }
 if(o.material.name!=='Gilded pierced metal')return;const m=o.material.clone();m.name='Worked gilt surface';m.normalMap=M.granite.normalMap;m.normalScale.set(.09,.09);m.roughnessMap=M.granite.roughnessMap;m.roughness=.46;addGrime(m,{macro:.4,streaks:.15,ground:0,scale:5});changed.push({o,old:o.material,material:m,oldGeo:o.geometry,geo:metricUV(o)});mats.workedGilt=m;});
 Object.entries(M).forEach(([k,m])=>mats['carving_'+k]=m);apply();return g;},configure(r){previous.configure(r);rig=r;apply();}};
for(const b of document.querySelectorAll('[data-carving]'))b.addEventListener('click',()=>{enabled=b.dataset.carving==='after';apply();});
