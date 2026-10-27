import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {metricUV} from './entrance-materials.js';
export function carvedEntrance(M){
 const group=new T.Group(),buckets=new Map();group.name='Carved capital and pedestal study';
 const put=(g,m)=>{g=g.index?g.toNonIndexed():g;if(!buckets.has(m))buckets.set(m,[]);buckets.get(m).push(g);};
 const box=(x,y,z,w,h,d,m)=>put(new T.BoxGeometry(w,h,d).translate(x,y,z),m);
 const relief=(shape,depth,x,y,z,m)=>put(new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:2,curveSegments:20}).translate(x,y,z),m);
 const crossHole=(s)=>{const p=new T.Path();const a=s*.30,b=s;for(const [i,[x,y]]of [[-a,b],[a,b],[a,a],[b,a],[b,-a],[a,-a],[a,-b],[-a,-b],[-a,-a],[-b,-a],[-b,a],[-a,a]].entries())i?p.lineTo(x,y):p.moveTo(x,y);p.closePath();return p;};
 const X=-19.25,Z=21.35;
 for(const side of[-1,1]){
  const cx=X+side*2.25;
  // Stone band with genuinely recessed diamond openings, fitted around the jug.
  const N=28,L=2*Math.PI*.49/N;
  for(let i=0;i<N;i++){
   const s=new T.Shape();s.moveTo(-L/2,-.08);s.lineTo(L/2,-.08);s.lineTo(L/2,.08);s.lineTo(-L/2,.08);s.closePath();
   const h=new T.Path();h.moveTo(0,.054);h.lineTo(.036,0);h.lineTo(0,-.054);h.lineTo(-.036,0);h.closePath();s.holes.push(h);
   const geo=new T.ExtrudeGeometry(s,{depth:.025,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:1});const p=geo.attributes.position;
   for(let k=0;k<p.count;k++){const a=i*2*Math.PI/N+p.getX(k)/.49,r=.49+p.getZ(k),y=p.getY(k);p.setXYZ(k,cx+Math.cos(a)*r,2.32+y,Z+Math.sin(a)*r);}geo.computeVertexNormals();put(geo,M.granite);
  }
  for(const y of[2.225,2.415])put(new T.TorusGeometry(.495,.018,6,64).rotateX(Math.PI/2).translate(cx,y,Z),M.granite);
  // Half-round panels below the capital, each pierced with a small cross.
  for(const dx of[-.34,0,.34]){
   const s=new T.Shape();s.moveTo(-.15,.13);s.lineTo(.15,.13);s.lineTo(.15,-.02);s.absarc(0,-.02,.15,0,-Math.PI,true);s.closePath();s.holes.push(crossHole(.065));
   relief(s,.045,cx+dx,3.53,Z+.48,M.granite);
  }
  // Narrow moulded bed under the capital gives the pendants a believable attachment.
  box(cx,3.67,Z,1.10,.065,1.02,M.granite);
  // Nested pedestal mouldings and a shallow shield panel drawn from entrance photos.
  for(const [w,h,z]of [[.65,.72,.535],[.54,.59,.553]]){
   for(const dx of[-w/2,w/2])box(cx+dx,.72,Z+z,.026,h,.032,M.granite);
   for(const y of[.72-h/2,.72+h/2])box(cx,y,Z+z,w,.026,.032,M.granite);
  }
  const shield=new T.Shape();shield.moveTo(-.14,.17);shield.lineTo(.14,.17);shield.lineTo(.14,-.06);shield.quadraticCurveTo(.12,-.18,0,-.22);shield.quadraticCurveTo(-.12,-.18,-.14,-.06);shield.closePath();
  relief(shield,.025,cx,.74,Z+.56,M.granite);
  for(const y of[1.27,1.32])box(cx,y,Z,1.09,.026,1.0,M.granite);
 }
 // Turned side shafts in the recessed doorway, with ring collars.
 for(const sign of[-1,1])for(const inset of[0,.19]){
  const x=X+sign*(1.68+inset),z=20.15+inset*.55;
  const profile=[[.15,.78],[.15,.86],[.09,.92],[.085,1.1],[.13,1.23],[.13,1.35],[.08,1.46],[.08,2.9],[.14,3.05],[.14,3.17],[.095,3.3],[.095,3.46],[.16,3.55]];
  put(new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),24).translate(x,0,z),M.granite);
  for(const y of[1.30,3.10,3.48])put(new T.TorusGeometry(.135,.018,6,24).rotateX(Math.PI/2).translate(x,y,z),M.granite);
 }
 for(const [m,gs]of buckets){const mesh=new T.Mesh(mergeGeometries(gs),m);mesh.geometry=metricUV(mesh);mesh.name='Carved stone / diamond bands, crosses, shields and door shafts';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
 return group;
}
