import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {metricUV} from './entrance-materials.js';
export function entranceDetail(M){
 const group=new T.Group();group.name='Entrance refinement / photo-informed simplified carvings';const buckets=new Map();
 const put=(geo,m)=>{const g=geo.index?geo.toNonIndexed():geo;if(!buckets.has(m))buckets.set(m,[]);buckets.get(m).push(g);};
 const box=(x,y,z,w,h,d,m)=>put(new T.BoxGeometry(w,h,d).translate(x,y,z),m);
 const ring=(x,y,z,r,w,depth,m,start=0,len=Math.PI)=>{
  const sh=new T.Shape();sh.absarc(x,y,r+w,start,start+len,false);sh.absarc(x,y,r,start+len,start,true);sh.closePath();
  put(new T.ExtrudeGeometry(sh,{depth,bevelEnabled:true,bevelSize:.007,bevelThickness:.007,bevelSegments:1,curveSegments:48}).translate(0,0,z),m);
 };
 // South porch, metre positions match existing Blender assembly.
 const X=-19.25,Z=21.35;
 for(const side of [-1,1]){
  const x=X+side*2.25;
  // Projecting capital courses and undercut shadow lines.
  for(const [y,w,h]of [[3.62,1.0,.08],[3.75,1.12,.06],[3.97,1.25,.08],[4.04,1.30,.06]])box(x,y,Z,w,h,1.06,M.granite);
  // Fine collar rings + zigzag band around the broad body.
  for(const [y,r,h]of [[1.47,.35,.06],[2.25,.48,.04],[2.39,.49,.04],[3.38,.27,.06]])put(new T.CylinderGeometry(r,r,h,48).translate(x,y,Z),M.granite);
  for(let i=0;i<48;i++){
   const a=i*Math.PI*2/48,b=(i+1)*Math.PI*2/48;
   const p=new T.Vector3(x+Math.cos(a)*.486,2.32+(i%2?.04:-.04),Z+Math.sin(a)*.486),q=new T.Vector3(x+Math.cos(b)*.486,2.32+(i%2?-.04:.04),Z+Math.sin(b)*.486);
   const d=q.clone().sub(p),geo=new T.CylinderGeometry(.013,.013,d.length(),5);geo.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));geo.translate(...p.add(q).multiplyScalar(.5).toArray());put(geo,M.granite);
  }
  // Recessed-looking pedestal panels: raised stone borders around retained face.
  for(const dx of [-.36,.36])box(x+dx,.72,Z+.495,.055,.82,.055,M.granite);
  for(const y of [.31,1.13])box(x,y,Z+.495,.77,.055,.055,M.granite);
  box(x,1.36,Z,1.13,.09,1.03,M.granite);
 }
 for(const [r,w,z]of [[2.19,.035,.25],[2.29,.045,.27],[2.40,.035,.25]])ring(X,3.7,Z+z,r,w,.045,M.stone);
 for(const cx of [-1.1,1.1])for(const [r,z]of [[1.075,.27],[1.20,.26]])ring(X+cx,3.7,Z+z,r,.025,.035,M.stone);
 // Small framed central stone tablet, visible in the reference above the twin arches.
 box(X,5.37,Z+.19,.58,.62,.12,M.stone);
 for(const dx of [-.22,.22])box(X+dx,5.37,Z+.275,.04,.47,.05,M.granite);
 for(const y of [5.14,5.60])box(X,y,Z+.275,.48,.04,.05,M.granite);
 // Dark iron door stiles and panel frames, behind the open porch arcade.
 const DZ=19.77;
 box(X,2.55,DZ,.09,3.9,.11,M.dark);
 for(const side of [-1,1])for(const [yc,h]of [[1.37,1.16],[2.98,1.64]]){
  const x=X+side*.77;
  for(const dx of [-.59,.59])box(x+dx,yc,DZ,.055,h,.08,M.dark);
  for(const y of [yc-h/2,yc+h/2])box(x,y,DZ,1.23,.055,.08,M.dark);
 }
 for(let i=-5;i<=5;i++){
  const x=i*.25,h=Math.sqrt(1.5*1.5-x*x);box(X+x,3.6+h/2,DZ,.025,h,.025,M.dark);
 }
 for(const [m,geos]of buckets){const mesh=new T.Mesh(mergeGeometries(geos),m);mesh.geometry=metricUV(mesh);mesh.name=m.name+' / added entrance detail';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
 return group;
}
