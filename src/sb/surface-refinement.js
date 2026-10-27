import * as T from 'three';
import {addGrime} from '../materials.js';
import {metricUV} from './entrance-materials.js';
// Preserve architectural colour identities while sharing fine-scale maps.
export function refineSurfaces(root,M){
 const records=[],cache=new Map(),geometryCache=new Map();
 const mosaic=root.getObjectByName('Licensed mosaic: south-porch-front')?.material;
 root.traverse(o=>{if(!o.isMesh||Array.isArray(o.material))return;
  const old=o.material, name=(o.name+' '+old.name).replace(/\.\d+/g,''), color=old.color?.getHexString();let kind;
  if(old.name.startsWith('Entrance ')||/roof refinement|Worked gilt|Source-resolution|West mosaic/.test(old.name))return;
  if(/Licensed mosaic|Photographed heraldic/.test(name))kind='mosaic';
  else if(/granite/i.test(name)||color==='6f6a66')kind='granite';
  else if(/stone|marble/i.test(name)||color==='e8e2d4')kind='stone';
  else if(/buff|plum|ochre brick/i.test(name))kind='buff';
  else if(/brick/i.test(name)||color==='8e4a35')kind='brick';
  else if(/glazed ceramic|central-stack \/ (cobalt|green)|corner-drum \/ (blue|green)/i.test(name))kind='glaze';
  if(!kind)return;
  const key=old.uuid+kind;let material=cache.get(key);
  if(!material){
   if(kind==='brick')material=M.brick;
   else if(kind==='granite')material=M.granite;
   else if(kind==='stone')material=M.stone;
   else {material=old.clone();material.name=(old.name||name)+' / measured-scale surface';
    const source=kind==='mosaic'?mosaic:kind==='buff'?M.brick:M.stone;
    material.normalMap=source.normalMap;material.roughnessMap=source.roughnessMap;
    material.normalScale=new T.Vector2(kind==='mosaic'?.23:kind==='glaze'?.07:.45,kind==='mosaic'?.23:kind==='glaze'?.07:.45);
    material.roughness=kind==='glaze'?.42:kind==='mosaic'?.94:.95;
    if(kind!=='mosaic')addGrime(material,{macro:.35,streaks:.14,ground:.12,scale:1.5});
   }
   cache.set(key,material);
  }
  let geo=o.geometry;
  if(kind!=='mosaic'){if(!geometryCache.has(geo))geometryCache.set(geo,metricUV(o));geo=geometryCache.get(geo);}
  records.push({o,old,oldGeo:o.geometry,material,geo});
 });
 return {apply(){for(const r of records){r.o.material=r.material;r.o.geometry=r.geo;}},restore(){for(const r of records){r.o.material=r.old;r.o.geometry=r.oldGeo;}},notes:[`${records.length} surfaces; distinct original ceramic and buff/plum colours retained.`]};
}
