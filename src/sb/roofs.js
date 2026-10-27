import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Reference-informed glazed scale layout. Individual historical tile counts are
// not resolved by the photographs; the palette and pattern families are known.
export function createRoofMaterials(){
 const palette=['#53648b','#bec9ce','#83976e','#b9a76c'];
 return Object.fromEntries(palette.map((c,i)=>['tile'+i,new T.MeshStandardMaterial({color:c,roughness:.46,metalness:.035})]));
}
/** D-plan cap lofted from the wall cornice to a LEVEL polygonal drum seat.
 * Dimensions of the cap/seat are photo-informed, not surveyed. Unlike the old
 * hemisphere, its crown is under the drum rather than against the rear wall.
 */
export function createApseRoof(radius,materials,central=false){
 const group=new T.Group();group.name='Glazed apse half-dome';
 const axis=radius*.5, drumR=central?2.2:1.3, sides=central?12:8;
 const height=central?3.65:2.0, inner=drumR+.065, outerR=radius+.12;
 group.userData.fittedDrumSeat=true;
 const boundary=a=>{
  const sx=Math.sin(a),cz=Math.cos(a);
  const arc=-axis*sx+Math.sqrt(outerR*outerR-axis*axis*cz*cz);
  return sx<0?Math.min(arc,-axis/sx):arc;
 };
 const point=(t,a,lift=0)=>{
  const d=inner+(boundary(a)-inner)*t;
  return new T.Vector3(axis+d*Math.sin(a),height*Math.cos(t*Math.PI/2)+lift,d*Math.cos(a));
 };
 function normal(t,a){
  const du=point(Math.min(1,t+.0001),a).sub(point(Math.max(0,t-.0001),a));
  const dv=point(t,a+.0001).sub(point(t,a-.0001));
  const n=du.cross(dv).normalize();if(n.y<0)n.negate();return n;
 }
 const buckets=Array.from({length:4},()=>({p:[],n:[],uv:[]}));
 function tri(bucket,coords,lift,depth=1){
  if(depth){const [a,b,c]=coords,mid=(u,v)=>[(u[0]+v[0])/2,(u[1]+v[1])/2];const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
   for(const vs of [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]])tri(bucket,vs,lift,depth-1);return;}
  let vs=coords.map(([t,a])=>point(t,a,lift));
  if(vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0])).y<0){vs.reverse();coords=[...coords].reverse();}
  for(let i=0;i<3;i++){const [t,a]=coords[i],v=vs[i],n=normal(t,a);bucket.p.push(v.x,v.y,v.z);bucket.n.push(n.x,n.y,n.z);bucket.uv.push(v.x,v.z);}
 }
 function mesh(bucket,material,name){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(bucket.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(bucket.n,3));g.setAttribute('uv',new T.Float32BufferAttribute(bucket.uv,2));
  g.computeBoundingBox();g.computeBoundingSphere();const m=new T.Mesh(g,material);m.name=name;m.castShadow=m.receiveShadow=true;group.add(m);
 }
 // Continuous backing seals every tile joint. The tile lift is vertical and
 // positive over this exact same parametric surface, including the rear edge.
 const backing={p:[],n:[],uv:[]},steps=128,rows=central?20:13,cols=central?112:72;
 for(let j=0;j<32;j++)for(let i=0;i<steps;i++){
  const a=i/steps*Math.PI*2,b=(i+1)/steps*Math.PI*2,t=j/32,u=(j+1)/32;
  tri(backing,[[t,a],[u,a],[u,b]],0,0);tri(backing,[[t,a],[u,b],[t,b]],0,0);
 }
 const under=materials.tile0.clone();under.color.multiplyScalar(.65);under.roughness=.65;
 mesh(backing,under,'Continuous fitted apse roof backing');
 const mod=(v,n)=>(v%n+n)%n;
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const t0=(row+.04)/rows,t1=Math.min(1,(row+1.02)/rows);
  const a=(col+.04+(row%2)*.5)/cols*Math.PI*2,b=(col+.96+(row%2)*.5)/cols*Math.PI*2,c=(a+b)/2;
  const shoulder=t0+(t1-t0)*.74,outline=[[t0,a],[t0,b],[shoulder,b],[t1,c],[shoulder,a]],center=[(t0+shoulder)/2,c];
  // Fixed angular columns preserve the continuous diagonal lattice, instead
  // of restarting the colour sequence with a different count on every row.
  const key=central?(mod(col-row,12)===0||mod(col+row,12)===0?1:(mod(col,12)===6&&mod(row,6)===3?2:0)):
   (mod(col+row,9)===0?1:(mod(col-row,9)===0?2:(mod(col,9)===4&&mod(row,4)===2?3:0)));
  for(let k=0;k<5;k++)tri(buckets[key],[outline[k],outline[(k+1)%5],center],.025);
 }
 buckets.forEach((b,i)=>{if(b.p.length)mesh(b,materials['tile'+i],'Curved glazed apse scales '+i);});
 // A shallow, closed stone plinth bridges the circular roof opening to the
 // actual polygonal drum. No multi-metre copper skirt conceals an intersection.
 const stone=new T.MeshStandardMaterial({color:0xc5c0b1,roughness:.76});
 const copper=new T.MeshStandardMaterial({color:0x61786b,roughness:.58,metalness:.3});
 for(const [r,h,y,mat,name]of [[(inner+.045)/Math.cos(Math.PI/sides),.22,height+.03,stone,'Level stone drum plinth'],[(inner+.07)/Math.cos(Math.PI/sides),.055,height-.105,copper,'Narrow copper drip']]){
  const g=new T.CylinderGeometry(r,r,h,sides,1,false);g.translate(axis,y,0);const m=new T.Mesh(g,mat);m.name=name;m.castShadow=m.receiveShadow=true;group.add(m);
 }
 // Verify exact wall footprint, positive annulus width, and finite geometry.
 let minimumBand=Infinity,invalid=0;for(let i=0;i<360;i++)minimumBand=Math.min(minimumBand,boundary(i*Math.PI/180)-inner);
 group.traverse(o=>{if(o.isMesh)for(const a of Object.values(o.geometry.attributes))for(const v of a.array)if(!Number.isFinite(v))invalid++;});
 if(invalid||minimumBand<=0)throw new Error('Invalid fitted apse cap');
 console.info('Fitted apse cap',JSON.stringify({central,radius,axis,height,minimumBand,invalid,seat:'level stone plinth',triangles:group.children.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0)}));
 return group;
}

// Folded sheet seams follow the exact roof extrusion profile. Thin real ribs
// catch sunlight at grazing angles without adding geometry to every sheet.
export function createRoofSeams(shape,length,material){
 const points=shape.getPoints(40).filter(p=>p.y>.12);
 const pieces=[];
 for(let z=.3;z<length;z+=.85){
  const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(p.x,p.y+.035,z)));
  pieces.push(new T.TubeGeometry(path,64,.025,4,false));
 }
 if(!pieces.length)return new T.Group();
 const geo=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());
 const mesh=new T.Mesh(geo,material);mesh.name='Standing-seam roof ribs';mesh.castShadow=mesh.receiveShadow=true;return mesh;
}

export function createDrainpipes(material){
 const parts=[];
 for(const sign of [-1,1])for(const x of [-7.6,6.4]){
  const z=sign*15.63;
  parts.push(new T.CylinderGeometry(.095,.095,20.8,10).translate(x,11.15,z));
  parts.push(new T.CylinderGeometry(.24,.10,.48,12).translate(x,21.77,z));
  for(let y=1.4;y<21;y+=2.8){
   parts.push(new T.TorusGeometry(.113,.023,6,12).rotateX(Math.PI/2).translate(x,y,z));
   parts.push(new T.BoxGeometry(.07,.10,.28).translate(x,y,z-sign*.12));
  }
  const bend=new T.CatmullRomCurve3([new T.Vector3(x,.75,z),new T.Vector3(x,.4,z+sign*.12),new T.Vector3(x,.22,z+sign*.42)]);
  parts.push(new T.TubeGeometry(bend,8,.095,10,false));
 }
 const geo=mergeGeometries(parts);parts.forEach(p=>p.dispose());const mesh=new T.Mesh(geo,material);mesh.name='Four facade downpipes and collars';mesh.castShadow=mesh.receiveShadow=true;return mesh;
}
