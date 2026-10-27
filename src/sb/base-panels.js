import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {filteredGeometry} from '../site-sb-entrance-detail.js';
import {metricUV} from './entrance-materials.js';
export function refineBasePanels(root,M){
 root.updateMatrixWorld(true);const source=root.getObjectByName('Granite arcade and courses'),oldPanels=root.getObjectByName('Uninscribed memorial panel placeholders');
 if(!source||!oldPanels)throw new Error('Main base panels missing');
 const oldGeo=source.geometry,wasVisible=oldPanels.visible;
 const curved=[];root.traverse(o=>{if(!o.isMesh||o.name!=='sb-apse-plinth-plaque')return;const geo=o.geometry.clone(),p=geo.attributes.position,n=geo.attributes.normal;for(let i=0;i<p.count;i++){const r=Math.hypot(p.getX(i),p.getZ(i));if(!r)continue;const x=p.getX(i)/r,z=p.getZ(i)/r;if(n.getX(i)*x+n.getZ(i)*z>.75)n.setXYZ(i,x,0,z);}n.needsUpdate=true;curved.push({o,old:o.geometry,geo});});
 const centers=[-11,-3.9,2.3,9.3];
 const isOldFrame=ps=>centers.some(x=>ps.every(p=>Math.abs(Math.abs(p.z)-15.18)<.111&&Math.abs(p.x-x)<1.711&&p.y>1.139&&p.y<3.101)&&(
 ps.every(p=>Math.abs(p.y-1.22)<.076)||ps.every(p=>Math.abs(p.y-3.02)<.076)||ps.every(p=>Math.abs(p.x-x-1.63)<.081)||ps.every(p=>Math.abs(p.x-x+1.63)<.081)));
 const geo=filteredGeometry(source,ps=>!isOldFrame(ps));
 const group=new T.Group();group.name='Reference study / taller memorial panels';const pieces=[];
 const material=M.granite.clone();material.name='Uninscribed red-brown memorial stone';material.color.set('#b28c7c');material.normalScale.set(.12,.12);material.roughness=.6;material.onBeforeCompile=M.granite.onBeforeCompile;material.customProgramCacheKey=M.granite.customProgramCacheKey;
 const box=(x,y,z,w,h,d)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d).translate(x,y,z),material);pieces.push(metricUV(mesh));};
 for(const side of[-1,1])for(const x of centers){const z=side*15.3;box(x,2.125,z-side*.20,1.94,2.20,.075);
  for(const dx of[-1.06,1.06])box(x+dx,2.125,z-side*.13,.15,2.40,.18);
  for(const y of[1.0,3.25])box(x,y,z-side*.13,2.27,.15,.18);
 }
 const merged=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());const mesh=new T.Mesh(merged,material);mesh.name='Taller uninscribed memorial panels';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
 return {group,material,apply(){for(const r of curved)r.o.geometry=r.geo;source.geometry=geo;oldPanels.visible=false;root.add(group);},restore(){for(const r of curved)r.o.geometry=r.old;source.geometry=oldGeo;oldPanels.visible=wasVisible;group.removeFromParent();}};
}
