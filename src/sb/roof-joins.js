import * as T from 'three';

const controllers = new WeakMap();
const TAU = Math.PI * 2;
// Current site-sb.js / solve.json contract. Actual matching scene translations
// are used below. No fetch: this module can be applied to a fully loaded root.
const SPECS = [
  { roof: [18,18.5,0], R:7.2, rise:.60, drum:[22.27,22,0], r:2.2, h:11 },
  { roof: [14.4,14,10.031], R:4.5, rise:.55, drum:[17.65,15.5,10.031], r:1.3, h:6 },
  { roof: [14.4,14,-10.031], R:4.5, rise:.55, drum:[17.65,15.5,-10.031], r:1.3, h:6 },
];
const near = (a,b) => Math.abs(a-b)<.002;

// Subtract a convex vertical polygon from triangles, splitting along its actual
// boundary (never centroid rejection). Interpolate EVERY numeric vertex attribute.
function cutRoof(source, localToRoot, center, radius) {
  const flat = source.index ? source.toNonIndexed() : source;
  const attrs = Object.entries(flat.attributes), arrays = attrs.map(()=>[]);
  const p = flat.attributes.position, groups=[];
  const planes = Array.from({length:48},(_,i)=>{
    const a=(i+.5)*TAU/48;
    return [Math.sin(a),Math.cos(a),radius*Math.cos(Math.PI/48)];
  });
  function vertex(i){return { pos:new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(localToRoot),
    data:attrs.map(([,a])=>Array.from({length:a.itemSize},(_,k)=>a.getComponent(i,k))) };}
  function mix(a,b,t){return {pos:a.pos.clone().lerp(b.pos,t),data:a.data.map((v,i)=>v.map((x,k)=>x+(b.data[i][k]-x)*t))};}
  function split(poly,plane){
    const inside=[],outside=[];
    const distance=v=>plane[0]*(v.pos.x-center.x)+plane[1]*(v.pos.z-center.z)-plane[2];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b);
      (da<=0?inside:outside).push(a);
      if((da<0&&db>0)||(da>0&&db<0)){const v=mix(a,b,da/(da-db));inside.push(v);outside.push(v);}
    }
    return [inside,outside];
  }
  let count=0;
  function emit(poly,materialIndex){
    for(let i=1;i<poly.length-1;i++){
      const tri=[poly[0],poly[i],poly[i+1]];
      if(tri[1].pos.clone().sub(tri[0].pos).cross(tri[2].pos.clone().sub(tri[0].pos)).lengthSq()<1e-16)continue;
      const last=groups.at(-1);
      if(last?.materialIndex===materialIndex)last.count+=3;else groups.push({start:count,count:3,materialIndex});
      for(const v of tri)for(let k=0;k<attrs.length;k++)arrays[k].push(...v.data[k]);
      count+=3;
    }
  }
  for(let i=0;i<p.count;i+=3){
    let poly=[vertex(i),vertex(i+1),vertex(i+2)];
    const slot=flat.groups.find(g=>i>=g.start&&i<g.start+g.count)?.materialIndex??0;
    for(const plane of planes){if(poly.length<3)break;const [inside,outside]=split(poly,plane);emit(outside,slot);poly=inside;}
  }
  const result=new T.BufferGeometry();
  attrs.forEach(([key,a],i)=>result.setAttribute(key,new T.Float32BufferAttribute(arrays[i],a.itemSize)));
  if(result.attributes.normal)result.normalizeNormals();
  for(const g of groups)result.addGroup(g.start,g.count,g.materialIndex);
  result.computeBoundingBox();result.computeBoundingSphere();
  if(flat!==source)flat.dispose();return result;
}

function surfaceGeometry(positions){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function quad(out,a,b,c,d,normal){
  const cross=b.clone().sub(a).cross(c.clone().sub(a));
  const vertices=cross.dot(normal)>=0?[a,b,c,a,c,d]:[a,c,b,a,d,c];
  for(const v of vertices)out.push(v.x,v.y,v.z);
}

/**
 * Preview only. Initially applied. Call AFTER assets/instancing, BEFORE
 * refineRoofs/material overlays. Restore controllers in reverse creation order.
 * Captures static component transforms; root transforms can change normally.
 * Returns {apply, restore, addedGroup, notes, dispose}. No original resources
 * are mutated/disposed; original material, visibility and endpoints are retained.
 */
export function refineRoofJoins(root,materials={}){
  if(!root?.isObject3D)throw new TypeError('refineRoofJoins expects an Object3D');
  if(controllers.has(root)){const c=controllers.get(root);c.apply();return c;}
  root.updateWorldMatrix(true,true);
  const inverse=root.matrixWorld.clone().invert();
  const relative=o=>inverse.clone().multiply(o.matrixWorld);
  const translation=o=>new T.Vector3().setFromMatrixPosition(relative(o));
  const at=(o,v)=>translation(o).distanceTo(new T.Vector3(...v))<.03;
  const addedGroup=new T.Group();addedGroup.name='SB reversible roof joins';
  const notes=[
    'Preview fitted joins derived from site-sb.js and solve.json: central roof (18,18.5,0) R7.2 / drum (22.27,22,0) R2.2 H11; side roof (14.4,14,±10.031) R4.5 / drum (17.65,15.5,±10.031) R1.3 H6.',
    'Window sills raised only within lower drum geometry; original window heads, drum tops, dome/globe/cross coordinates remain fixed. Collar and support design inferred, not surveyed.',
    'Annexe radial cuts and straight returns closed; three overlapping half-cones, broad top terrace and their valleys are NOT rebuilt or claimed watertight as a boolean union.',
    'Apply before roof/material refinements; restore those first. Static source component transforms captured at creation. Unknown/instanced upper roof/drum meshes are skipped, never destructively baked.',
  ];
  const objects=[];root.traverse(o=>objects.push(o));
  const changes=[],ownedGeometry=new Set(),ownedMaterials=new Set();
  // Plain clones of colour/PBR/map data only: entrance-specific AO shader bounds
  // must not be copied to the apse. No brick albedo is put on metal flashing.
  function mat(source,color,metalness=.0,roughness=.7){
    const m=source?.isMaterial?source.clone():new T.MeshStandardMaterial({color,metalness,roughness});
    ownedMaterials.add(m);return m;
  }
  const copper=mat(materials.copper,0x607468,.35,.55);
  const brick=mat(materials.brick,0x8b5a3e);
  // Added solids have no inherited metric UVs; use plain matching colour where
  // source textures require mapping rather than silently sampling (0,0).
  for(const m of [copper,brick])for(const key of ['map','normalMap','roughnessMap','aoMap','bumpMap','displacementMap'])m[key]=null;
  if(materials.brick?.map)brick.color.set(0x8b5a3e);
  function add(g,m,name,matrix){
    ownedGeometry.add(g);const mesh=new T.Mesh(g,m);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;
    if(matrix){mesh.matrix.copy(matrix);mesh.matrixAutoUpdate=false;}addedGroup.add(mesh);return mesh;
  }
  function replace(mesh,geometry){ownedGeometry.add(geometry);changes.push({mesh,before:mesh.geometry,after:geometry});}
  const plainTranslation=o=>{
    const m=relative(o),t=new T.Matrix4().makeTranslation(...translation(o).toArray());
    return m.elements.every((v,i)=>Math.abs(v-t.elements[i])<1e-5);
  };
  for(const spec of SPECS){
    const roof=objects.find(o=>o.name==='Glazed apse half-dome'&&at(o,spec.roof));
    if(roof?.userData.fittedDrumSeat){notes.push(`Apse z=${spec.roof[2]} uses a fitted cap and closed level plinth; legacy clipping skipped.`);continue;}
    const drum=objects.find(o=>o.name==='sb-drum-corner'&&at(o,spec.drum)&&near(o.userData.radius,spec.r)&&near(o.userData.height,spec.h));
    if(!roof||!drum||!plainTranslation(roof)||!plainTranslation(drum)){notes.push(`Skipped unmatched or transformed apse at z=${spec.roof[2]}.`);continue;}
    const targets=[];roof.traverse(o=>{if(o.isMesh)targets.push(o);});
    const drumMeshes=[];drum.traverse(o=>{if(o.isMesh)drumMeshes.push(o);});
    if([...targets,...drumMeshes].some(o=>o.isInstancedMesh||o.isSkinnedMesh||!plainTranslation(o))){notes.push(`Skipped nonstandard upper apse meshes at z=${spec.roof[2]}.`);continue;}
    const rc=translation(roof),dc=translation(drum),r=spec.r,R=spec.R,h=spec.h,n=drum.userData.sides;
    const face=2*r*Math.sin(Math.PI/n),half=Math.min(face*.21,h*.13),spring=h*.73-half,oldSill=h*.2;
    const roofY=(x,z)=>rc.y+spec.rise*Math.sqrt(Math.max(0,R*R-(x-rc.x)**2-(z-rc.z)**2));
    let highest=rc.y;
    for(let i=0;i<96;i++){const a=i*TAU/96;highest=Math.max(highest,roofY(dc.x+(r+.16)*Math.sin(a),dc.z+(r+.16)*Math.cos(a)));}
    const newSill=Math.max(oldSill,highest-dc.y+.22);
    if(newSill>spring-.3){notes.push(`Skipped roof/window fitting at z=${rc.z}: insufficient space below arch heads.`);continue;}
    // A 48-gon cut extends 60mm beyond the nominal drum. Flashing bridges to
    // the actual polygon wall face, hiding the small deliberate clearance.
    for(const mesh of targets)replace(mesh,cutRoof(mesh.geometry,relative(mesh),dc,r+.06));
    const remap=y=>y<=oldSill?y*newSill/oldSill:y<spring?newSill+(y-oldSill)*(spring-newSill)/(spring-oldSill):y;
    for(const mesh of drumMeshes){
      const g=mesh.geometry.clone(),p=g.attributes.position;
      for(let i=0;i<p.count;i++)p.setY(i,remap(p.getY(i)));
      p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();replace(mesh,g);
    }
    const flashing=[],support=[];
    const seatY=Math.max(dc.y+.06,highest+.16);
    const wallRadius=a=>r*Math.cos(Math.PI/n)/Math.cos((a%(TAU/n))-Math.PI/n);
    // Full skirt from the curved roof seat to original drum bottom where the
    // drum floats; elsewhere remains buried. It never reaches the new windows.
    for(let i=0;i<192;i++){
      const a=i*TAU/192,b=(i+1)*TAU/192;
      const ring=(angle,outer)=>{
        const rr=outer?r+.13:wallRadius(angle)+.006;
        const x=dc.x+rr*Math.sin(angle),z=dc.z+rr*Math.cos(angle);
        return new T.Vector3(x,outer?roofY(x,z)+.07:seatY,z);
      };
      const ia=ring(a,false),ib=ring(b,false),oa=ring(a,true),ob=ring(b,true);
      quad(flashing,ia,ib,ob,oa,new T.Vector3(0,1,0));
      const bottomA=ia.clone(),bottomB=ib.clone();bottomA.y-=.12;bottomB.y-=.12;
      const topA=ia.clone(),topB=ib.clone();topA.y=Math.max(dc.y+.035,seatY+.04);topB.y=Math.max(dc.y+.035,seatY+.04);
      if(topA.y>bottomA.y+.0001||topB.y>bottomB.y+.0001)quad(support,bottomA,bottomB,topB,topA,new T.Vector3(Math.sin((a+b)/2),0,Math.cos((a+b)/2)));
    }
    add(surfaceGeometry(flashing),copper,'Fitted apse sloping apron and level drum seat');
    if(support.length)add(surfaceGeometry(support),brick,'Apse drum curved seat support');
    notes.push(`Apse z=${rc.z}: sill world y ${dc.y+oldSill} -> ${(dc.y+newSill).toFixed(3)}; arch spring ${(dc.y+spring).toFixed(3)}, drum top ${dc.y+h} unchanged. Roof/tile triangles clipped, interpolated attributes retained.`);
  }
  // Explicit radial cut end faces for each current low annexe half-cone.
  let central=null,closures=0;
  for(const mesh of objects){
    const p=mesh.geometry?.parameters;
    if(!mesh.isMesh||mesh.isInstancedMesh||mesh.geometry.type!=='CylinderGeometry'||!p||!near(p.thetaLength,Math.PI)||!near(p.height,1.9))continue;
    if(!((near(p.radiusTop,8.8)&&near(p.radiusBottom,10.4))||(near(p.radiusTop,4.4)&&near(p.radiusBottom,6.1))))continue;
    const vertices=[];
    for(const a of [p.thetaStart,p.thetaStart+p.thetaLength]){
      const bottom=new T.Vector3(p.radiusBottom*Math.sin(a),-p.height/2,p.radiusBottom*Math.cos(a));
      const top=new T.Vector3(p.radiusTop*Math.sin(a),p.height/2,p.radiusTop*Math.cos(a));
      quad(vertices,new T.Vector3(0,-p.height/2,0),bottom,top,new T.Vector3(0,p.height/2,0),new T.Vector3(-1,0,0));
    }
    add(surfaceGeometry(vertices),copper,'Closed annexe radial roof cuts',relative(mesh));closures+=2;
    if(near(p.radiusTop,8.8)&&plainTranslation(mesh))central=translation(mesh);
  }
  // Closed extrusion over the existing x14.4..18 return block. Match the
  // current central half-cone's plateau + slope, rather than introduce a step.
  if(central&&near(central.x,18)&&near(central.y,6.45)&&near(central.z,0)){
    for(const sign of [-1,1]){
      const shape=new T.Shape();
      shape.moveTo(sign*7.2,5.5);shape.lineTo(sign*10.4,5.5);shape.lineTo(sign*8.8,7.4);shape.lineTo(sign*7.2,7.4);shape.closePath();
      const g=new T.ExtrudeGeometry(shape,{depth:3.6,bevelEnabled:false,curveSegments:1});
      // Shape XY=(world Z,world Y), extrusion Z becomes world X; reflection
      // avoided by rotateY(+pi/2): world Z=-shapeX, simply exchanges the two sides.
      g.rotateY(Math.PI/2);g.translate(14.4,0,0);
      add(g,copper,'Closed straight annexe roof return');
    }
  }
  notes.push(`Added ${closures} radial roof cut closures. Existing annexe wall/plaque overlaps and valley drainage remain provisional; no plaques removed.`);
  let applied=false,disposed=false;
  function apply(){if(disposed)throw new Error('Roof joins controller disposed');for(const r of changes)r.mesh.geometry=r.after;root.add(addedGroup);root.updateMatrixWorld(true);applied=true;return controller;}
  function restore(){if(applied){for(const r of changes)r.mesh.geometry=r.before;addedGroup.removeFromParent();applied=false;}return controller;}
  const controller={apply,restore,addedGroup,notes,dispose(){if(disposed)return;restore();ownedGeometry.forEach(g=>g.dispose());ownedMaterials.forEach(m=>m.dispose());addedGroup.clear();controllers.delete(root);disposed=true;}};
  controllers.set(root,controller);return apply();
}
