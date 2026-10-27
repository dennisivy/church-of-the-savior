import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {metricUV} from './entrance-materials.js';
export function porchConnections(root,M){
 const tileChanges=[];root.updateMatrixWorld(true);
 root.traverse(o=>{if(!o.isMesh||!/^(Cobalt|Ivory|Ochre)_glaze$/.test(o.name))return;const old=o.geometry,geo=old.clone(),p=geo.attributes.position,inv=o.matrixWorld.clone().invert();let moved=0;
 for(let i=0;i<p.count;i++){const q=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(q.y<5.55||q.y>9.82)continue;const dx=q.x+19.25,dz=q.z-(q.z>0?16.25:-16.25);let n;if(Math.abs(dz)>3.35&&Math.abs(dx)<3.05)n=new T.Vector3(Math.sign(dx)*.804,.594,0);else if(dx< -3.35&&Math.abs(dz)<3.05)n=new T.Vector3(0,.594,Math.sign(dz)*.804);if(!n)continue;q.addScaledVector(n,.065).applyMatrix4(inv);p.setXYZ(i,q.x,q.y,q.z);moved++;}
 if(moved){p.needsUpdate=true;geo.computeBoundingSphere();geo.computeBoundingBox();tileChanges.push({o,old,geo});}else geo.dispose();});
 const group=new T.Group();group.name='Connected porch architecture';const batches=new Map();
 const copper=new T.MeshStandardMaterial({name:'Porch transition copper',color:'#597d70',metalness:.35,roughness:.57});
 const plum=new T.MeshStandardMaterial({name:'Porch moulded plum masonry',color:'#57453f',roughness:.92,normalMap:M.brick.normalMap,normalScale:new T.Vector2(.3,.3)});
 const ochre=new T.MeshStandardMaterial({name:'Porch ochre brick panels',color:'#b58d58',roughness:.86,normalMap:M.brick.normalMap,normalScale:new T.Vector2(.3,.3)});
 const put=(geo,mat,frame)=>{if(frame)geo.applyMatrix4(frame);const mesh=new T.Mesh(geo,mat),g=metricUV(mesh);geo.dispose();if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(g);};
 const box=(x,y,z,w,h,d,mat,frame)=>put(new T.BoxGeometry(w,h,d).translate(x,y,z),mat,frame);
 function archRing(r,w,spring,depth,mat,frame){const s=new T.Shape();s.absarc(0,spring,r+w,0,Math.PI,false);s.absarc(0,spring,r,Math.PI,0,true);s.closePath();put(new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:1,curveSegments:32}),mat,frame);}
 const south=new T.Matrix4().makeTranslation(-19.25,0,16.25);
 for(const sign of[1,-1]){
  const frame=new T.Matrix4().makeScale(1,1,sign).multiply(south);
  // Actual existing core is +/-3.5. Connect its rear to the bell-tower shoulder
  // (world z5.7) and main-body west wall (x-15.7); slight overlaps close seams.
  box(.12,4.25,-7.0,7.24,8.5,7.35,M.brick,frame);
  box(.12,.39,-7.0,7.32,.78,7.4,M.granite,frame);
  for(const [y,h,w]of[[7.95,.13,7.42],[8.22,.18,7.60],[8.48,.16,7.76]])box(.12,y,-7.0,w,h,7.48,M.stone,frame);
  box(.12,8.60,-7.0,7.68,.12,7.48,copper,frame);
  for(let x=-3.35;x<3.6;x+=.48)box(x,8.68,-7,.025,.05,7.45,copper,frame);
  // Engaged corner piers visually bind the core, gable shoulders and base.
  for(const [x,z]of[[-3.5,3.5],[3.5,3.5],[-3.5,-3.5]]){
   box(x,4.30,z,.56,8.6,.56,M.brick,frame);box(x,.46,z,.76,.92,.76,M.granite,frame);
   for(let y=1.35;y<7.7;y+=1.42){box(x,y,z,.65,.36,.65,plum,frame);box(x,y+.49,z,.59,.54,.59,ochre,frame);box(x,y+.89,z,.73,.12,.73,M.stone,frame);}
   for(const [y,w]of[[7.86,.78],[8.08,.88],[8.33,.98]])box(x,y,z,w,.16,w,M.stone,frame);
  }
  // Open side arch on each porch facing the corner between the paired portals.
  for(const west of[false,true]){
   const s=new T.Shape();const width=1.88,r=.69,c=width/2,spring=3.38;
   s.moveTo(0,0);s.lineTo(c-r,0);s.lineTo(c-r,spring);s.absarc(c,spring,r,Math.PI,0,true);s.lineTo(c+r,0);s.lineTo(width,0);s.lineTo(width,5.78);s.lineTo(0,5.78);s.closePath();
   let f;if(!west){f=new T.Matrix4().makeTranslation(-2.85,0,3.28).multiply(new T.Matrix4().makeRotationY(-Math.PI/2)); // local x -> +Z
   }else{f=new T.Matrix4().makeTranslation(-5.16,0,2.85);}
   const full=frame.clone().multiply(f);put(new T.ExtrudeGeometry(s,{depth:.26,bevelEnabled:false,curveSegments:32}),M.brick,full);
   const ringFrame=full.clone().multiply(new T.Matrix4().makeTranslation(c,0,.27));archRing(r,.13,spring,.12,M.stone,ringFrame);
   for(const u of[c-r-.065,c+r+.065])box(u,spring/2,.30,.13,spring,.20,M.stone,full);
   box(width/2,5.65,.12,width+.16,.18,.48,M.stone,full);
  }
  // Closed roof shoulders around the octagonal tent stand, below the existing
  // small upper gable ring. The four broad lower gables were absent before.
  for(const a of[-1,1]){box(0,8.85,a*3.48,6.98,.12,.055,copper,frame);box(a*3.48,8.85,0,.055,.12,6.98,copper,frame);}
  const vertices=[],indices=[];const outer=3.48,inner=1.36;
  for(let i=0;i<4;i++){const a=i*Math.PI/2,b=(i+1)*Math.PI/2;for(const [r,y,t]of[[outer,8.87,a],[outer,8.87,b],[inner,10.05,b],[inner,10.05,a]])vertices.push(Math.cos(t+Math.PI/4)*r*Math.SQRT2,y,Math.sin(t+Math.PI/4)*r*Math.SQRT2);const k=i*4;indices.push(k,k+2,k+1,k,k+3,k+2);}
  const roof=new T.BufferGeometry();roof.setAttribute('position',new T.Float32BufferAttribute(vertices,3));roof.setIndex(indices);roof.computeVertexNormals();put(roof,copper,frame);
  for(let i=0;i<4;i++){
   const a=Math.PI/4+i*Math.PI/2;const f=frame.clone().multiply(new T.Matrix4().makeRotationY(a)).multiply(new T.Matrix4().makeTranslation(0,0,4.03));
   const shape=new T.Shape();shape.moveTo(-.59,8.93);shape.lineTo(.59,8.93);shape.lineTo(0,9.88);shape.closePath();put(new T.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:false}),M.brick,f);
   for(const sign of[-1,1]){const p=new T.Vector3(sign*.63,8.93,.19),q=new T.Vector3(0,9.94,.19),d=q.clone().sub(p),g=new T.BoxGeometry(.085,d.length(),.18);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));g.translate(...p.add(q).multiplyScalar(.5).toArray());put(g,M.stone,f);}
  }
  for(let i=0;i<4;i++){
   const a=i*Math.PI/2;const f=frame.clone().multiply(new T.Matrix4().makeRotationY(a)).multiply(new T.Matrix4().makeTranslation(0,0,3.10));
   const s=new T.Shape();s.moveTo(-1.18,8.78);s.lineTo(1.18,8.78);s.lineTo(1.18,9.03);s.absarc(0,9.03,1.18,0,Math.PI,false);s.closePath();
   put(new T.ExtrudeGeometry(s,{depth:.24,bevelEnabled:false,curveSegments:32}),M.brick,f);
   for(const [r,w,z]of[[1.18,.13,.25],[1.36,.07,.25]])archRing(r,w,9.03,.10,M.stone,f.clone().multiply(new T.Matrix4().makeTranslation(0,0,z)));
   // Copper barrel cap follows each gable into the roof shoulder.
   const ps=[],ids=[];for(let j=0;j<=32;j++){const t=j*Math.PI/32;for(const z of[-.70,.38])ps.push(Math.cos(t)*1.45,9.03+Math.sin(t)*1.45,z);}
   for(let j=0;j<32;j++){const k=j*2;ids.push(k,k+1,k+2,k+1,k+3,k+2);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ps,3));g.setIndex(ids);g.computeVertexNormals();put(g,copper,f);
  }
 }
 // Reflections reverse winding. Restore outward orientation on all mirrored
 // triangles before merging; computed normals alone cannot fix backface culling.
 for(const [m,parts]of batches){for(const g of parts){const p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<p.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),c=new T.Vector3().fromBufferAttribute(p,i+2);const cross=b.sub(a).cross(c.sub(a)),expected=new T.Vector3().fromBufferAttribute(n,i);if(cross.dot(expected)<0)for(const attr of Object.values(g.attributes))for(let k=0;k<attr.itemSize;k++){const x=attr.array[(i+1)*attr.itemSize+k];attr.array[(i+1)*attr.itemSize+k]=attr.array[(i+2)*attr.itemSize+k];attr.array[(i+2)*attr.itemSize+k]=x;}}}
  const geo=mergeGeometries(parts);parts.forEach(p=>p.dispose());const mesh=new T.Mesh(geo,m);mesh.name='Connected porch / '+m.name;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
 }
 copper.side=T.DoubleSide;
 group.updateMatrixWorld(true);let rays=0,hits=0,invalid=0;group.traverse(o=>{if(o.isMesh)for(const p of o.geometry.attributes.position.array)if(!Number.isFinite(p))invalid++;});
 for(const sign of[1,-1])for(const y of[1.2,2.2,3.1])for(const offset of[-.6,0,.6]){
  for(const [p,d]of[[[-19.25+offset,y,sign*22.5],[0,0,-sign]],[[-25.5,y,sign*(16.25+offset)],[1,0,0]]]){rays++;if(new T.Raycaster(new T.Vector3(...p),new T.Vector3(...d),0,2.8).intersectObject(group,true).length)hits++;}
 }
 for(const sign of[1,-1])for(const y of[1.2,2.2,3.1])for(const [p,d]of[[[-23.5,y,sign*20.47],[1,0,0]],[[-23.47,y,sign*17.7],[0,0,sign]]]){rays++;if(new T.Raycaster(new T.Vector3(...p),new T.Vector3(...d),0,2.5).intersectObject(group,true).length)hits++;}
 console.info('Porch connection validation',JSON.stringify({rays,obstructedRays:hits,invalidCoordinates:invalid,correctedTileMeshes:tileChanges.length}));
 if(invalid||hits)throw new Error('Porch connection geometry validation failed');
 group.userData.notes='Reference-informed connecting mass, open side arches, engaged masonry piers, lower gable tier and copper shoulders. Positions fitted to existing model; unidentified mosaic scenes not invented.';
 return {group,materials:[copper,plum,ochre],apply(){root.add(group);for(const r of tileChanges)r.o.geometry=r.geo;},restore(){group.removeFromParent();for(const r of tileChanges)r.o.geometry=r.old;}};
}
