import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export function createPlinth({u0,u1,v,height,normalMap}) {
 const stone=new T.MeshStandardMaterial({color:'#a5a099',roughness:.92});
 const dark=new T.MeshStandardMaterial({color:'#514c48',roughness:.7});
 if(normalMap){stone.normalMap=normalMap.clone();stone.normalMap.repeat.set(1/5.6,1/4.8);stone.normalMap.needsUpdate=true;stone.normalScale.set(.65,.65);stone.userData.normalMap=stone.normalMap;}
 const batches=new Map(),group=new T.Group();
 const put=(g,m,matrix)=>{if(matrix)g.applyMatrix4(matrix);const n=g.index?g.toNonIndexed():g;if(n!==g)g.dispose();if(!batches.has(m))batches.set(m,[]);batches.get(m).push(n);};
 const box=(x,y,z,w,h,d,m,matrix)=>put(new T.BoxGeometry(w,h,d).translate(x,y,z),m,matrix);
 const outline=(cx,w,bottom,top)=>{const r=w/2,s=top-r,p=new T.Shape();p.moveTo(cx-r,bottom);p.lineTo(cx+r,bottom);p.lineTo(cx+r,s);p.absarc(cx,s,r,0,Math.PI,false);p.closePath();return p;};
 for(const side of [-1,1]){
  const frame=new T.Matrix4().makeRotationY(side<0?Math.PI:0);frame.setPosition(0,0,side*v);
  const lo=side>0?u0:-u1,hi=side>0?u1:-u0,wall=new T.Shape();wall.moveTo(lo,0);wall.lineTo(hi,0);wall.lineTo(hi,height);wall.lineTo(lo,height);wall.closePath();
  for(const original of [-11,-3.9,2.3,9.3]){
   const x=original*side,opening=outline(x,3.9,.9,5.5);wall.holes.push(new T.Path(opening.getPoints(32)));
   put(new T.ShapeGeometry(opening,32).translate(0,0,-.27),stone,frame);
   const surround=outline(x,4.2,.75,5.65);surround.holes.push(new T.Path(opening.getPoints(32)));
   put(new T.ExtrudeGeometry(surround,{depth:.24,bevelEnabled:false,curveSegments:24}).translate(0,0,-.04),stone,frame);
   for(const dx of [-.88,.88]){
    const arch=new T.Shape();arch.absarc(x+dx,3.95,.87,0,Math.PI,false);arch.absarc(x+dx,3.95,.73,Math.PI,0,true);arch.closePath();
    put(new T.ExtrudeGeometry(arch,{depth:.18,bevelEnabled:false,curveSegments:20}).translate(0,0,-.18),stone,frame);
   }
   put(new T.ConeGeometry(.18,.65,12).rotateZ(Math.PI).translate(x,3.65,-.08),stone,frame);
   box(x,2.12,-.20,3.1,1.55,.07,dark,frame);
   for(const dx of [-1.63,1.63])box(x+dx,2.12,-.12,.16,1.85,.2,stone,frame);
   for(const y of [1.22,3.02])box(x,y,-.12,3.4,.15,.2,stone,frame);
  }
  put(new T.ExtrudeGeometry(wall,{depth:.55,bevelEnabled:false,curveSegments:24}).translate(0,0,-.55),stone,frame);
  for(let x=lo+.22;x<hi;x+=.46)box(x,height-.24,.12,.22,.3,.32,stone,frame);
  box((lo+hi)/2,height-.04,.12,hi-lo+.1,.14,.4,stone,frame);
 }
 for(const x of [u0+.25,u1-.25])box(x,height/2,0,.5,height,2*v,stone);
 for(const y of [.1,height-.1])box((u0+u1)/2,y,0,u1-u0,.2,2*v,stone);
 for(const [mat,geos] of batches){const merged=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());const mesh=new T.Mesh(merged,mat);mesh.name=mat===stone?'Granite arcade and courses':'Uninscribed memorial panel placeholders';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
 return {group,materials:{plinthStone:stone,plinthPlaques:dark}};
}
