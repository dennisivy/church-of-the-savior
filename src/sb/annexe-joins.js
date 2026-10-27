import * as T from 'three';

const controllers = new WeakMap();
const near = (a,b,t=.025) => Math.abs(a-b)<t;
const TAU = Math.PI*2;
// Coordinates/radii retained from site-sb.js and solve.json, not a new solve.
const PARTS = [
  {id:'central',x:18,z:0,r:10,rt:8.8,rb:10.4,segments:32},
  {id:'south',x:14.4,z:10.031,r:5.9,rt:4.4,rb:6.1,segments:40},
  {id:'north',x:14.4,z:-10.031,r:5.9,rt:4.4,rb:6.1,segments:40},
];
const plane=(x,y,z,d)=>({n:new T.Vector3(x,y,z),d});
const distance=(p,v)=>{const d=p.n.dot(v)-p.d;return Math.abs(d)<1e-6?0:d;};
const ownedCut=(solid,removeBoundary=false)=>({...solid,removeBoundary});

function prism(part,r0,r1,y0,y1,segments=100,full=false){
  const planes=[plane(0,-1,0,-y0),plane(0,1,0,y1)];
  const span=full?TAU:Math.PI, da=span/segments, cosine=Math.cos(da/2);
  const slope=(r1-r0)/(y1-y0);
  for(let i=0;i<segments;i++){
    const a=(i+.5)*da,x=Math.sin(a),z=Math.cos(a);
    planes.push(plane(x,-slope*cosine,z,x*part.x+z*part.z+(r0-slope*y0)*cosine));
  }
  if(!full)planes.push(plane(-1,0,0,-part.x));
  const maxR=Math.max(r0,r1);
  return {planes,box:new T.Box3(new T.Vector3(part.x-(full?maxR:0),y0,part.z-maxR),new T.Vector3(part.x+maxR,y1,part.z+maxR))};
}
function boxSolid(x0,x1,y0,y1,z0,z1){return {planes:[plane(-1,0,0,-x0),plane(1,0,0,x1),plane(0,-1,0,-y0),plane(0,1,0,y1),plane(0,0,-1,-z0),plane(0,0,1,z1)],box:new T.Box3(new T.Vector3(x0,y0,z0),new T.Vector3(x1,y1,z1))};}
function returnSolid(sign){
  const s=boxSolid(14.4,18,5.5,7.4,sign>0?7.2:-10.4,sign>0?10.4:-7.2);
  // Exact extruded plateau/slope profile made by refineRoofJoins.
  s.planes.push(plane(0,1,sign*1.9/1.6,5.5+10.4*1.9/1.6));return s;
}

// Subtract convex volumes from each source triangle. New boundary vertices are
// intersections with planes; all numeric attributes and material slots survive.
// Boundary fragments remain with their source (no blanket epsilon erosion).
function clipGeometry(source,matrix,solids){
  const flat=source.index?source.toNonIndexed():source,attrs=Object.entries(flat.attributes);
  const data=attrs.map(()=>[]),groups=[],p=flat.attributes.position;
  let written=0,changedTriangles=0;
  const vertex=i=>({p:new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix),a:attrs.map(([,a])=>Array.from({length:a.itemSize},(_,k)=>a.getComponent(i,k)))});
  const mix=(a,b,t)=>({p:a.p.clone().lerp(b.p,t),a:a.a.map((v,i)=>v.map((x,k)=>x+(b.a[i][k]-x)*t))});
  function split(poly,pl){
    const inside=[],outside=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],da=distance(pl,a.p),db=distance(pl,b.p);
      (da<=0?inside:outside).push(a);
      if((da<0&&db>0)||(da>0&&db<0)){const v=mix(a,b,da/(da-db));inside.push(v);outside.push(v);}
    }
    return [inside,outside];
  }
  function subtract(poly,solid){
    // An entire polygon on/outside any boundary is not buried. Retains exposed
    // coplanar caps and avoids deleting both owners along touching boundaries.
    if(solid.planes.some(pl=>poly.every(v=>distance(pl,v.p)>=0)
      && (!solid.removeBoundary || poly.some(v=>distance(pl,v.p)>0))))return [poly];
    let remaining=poly;const result=[];
    for(const pl of solid.planes){
      if(remaining.length<3)break;
      const [inside,outside]=split(remaining,pl);if(outside.length>=3)result.push(outside);remaining=inside;
    }
    return result;
  }
  for(let i=0;i<p.count;i+=3){
    const triangle=[vertex(i),vertex(i+1),vertex(i+2)],bounds=new T.Box3().setFromPoints(triangle.map(v=>v.p));
    let polygons=[triangle];
    for(const solid of solids){
      if(!bounds.intersectsBox(solid.box))continue;
      polygons=polygons.flatMap(poly=>subtract(poly,solid));
      if(!polygons.length)break;
    }
    if(polygons.length!==1||polygons[0]!==triangle)changedTriangles++;
    const slot=flat.groups.find(g=>i>=g.start&&i<g.start+g.count)?.materialIndex??0;
    for(const poly of polygons)for(let j=1;j<poly.length-1;j++){
      const tri=[poly[0],poly[j],poly[j+1]];
      if(tri[1].p.clone().sub(tri[0].p).cross(tri[2].p.clone().sub(tri[0].p)).lengthSq()<1e-16)continue;
      for(const v of tri)attrs.forEach((_,k)=>data[k].push(...v.a[k]));
      const last=groups.at(-1);if(last?.materialIndex===slot)last.count+=3;else groups.push({start:written,count:3,materialIndex:slot});written+=3;
    }
  }
  const geo=new T.BufferGeometry();attrs.forEach(([name,a],i)=>geo.setAttribute(name,new T.Float32BufferAttribute(data[i],a.itemSize)));
  if(geo.attributes.normal)geo.normalizeNormals();for(const g of groups)geo.addGroup(g.start,g.count,g.materialIndex);
  geo.computeBoundingBox();geo.computeBoundingSphere();if(flat!==source)flat.dispose();
  return {geo,changedTriangles};
}

function circleIntersection(a,ra,b,rb){
  const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),u=(ra*ra-rb*rb+d*d)/(2*d),v=Math.sqrt(Math.max(0,ra*ra-u*u));
  const candidates=[1,-1].map(s=>new T.Vector2(a.x+u*dx/d-s*v*dz/d,a.z+u*dz/d+s*v*dx/d));
  return candidates.sort((p,q)=>q.x-p.x)[0];
}
function section(part,y){const r=T.MathUtils.lerp(part.rb,part.rt,(y-5.5)/1.9);return Array.from({length:part.segments+1},(_,i)=>new T.Vector2(part.x+r*Math.sin(i*Math.PI/part.segments),part.z+r*Math.cos(i*Math.PI/part.segments)));}
function cross2(a,b){return a.x*b.y-a.y*b.x;}
function intersectionAt(a,b,y){
  const aa=section(a,y),bb=section(b,y),hits=[];
  for(let i=0;i<aa.length-1;i++)for(let j=0;j<bb.length-1;j++){
    const r=aa[i+1].clone().sub(aa[i]),s=bb[j+1].clone().sub(bb[j]),den=cross2(r,s);if(Math.abs(den)<1e-12)continue;
    const d=bb[j].clone().sub(aa[i]),t=cross2(d,s)/den,u=cross2(d,r)/den;
    if(t>=0&&t<=1&&u>=0&&u<=1)hits.push(aa[i].clone().addScaledVector(r,t));
  }
  return hits.sort((p,q)=>q.x-p.x)[0];
}
function roofHeight(solid,x,z){
  let y=7.4;
  for(const p of solid.planes){
    if(p.n.y>1e-8)y=Math.min(y,(p.d-p.n.x*x-p.n.z*z)/p.n.y);
    else if(Math.abs(p.n.y)<1e-8&&p.n.x*x+p.n.z*z>p.d+1e-7)return -Infinity;
  }
  return y>=5.5-1e-6?y:-Infinity;
}
function valleyGeometry(a,b,sa,sb){
  // Samples lie on the ACTUAL faceted cone/cone intersection, not circles.
  // Narrow flashing skirts each side on the union's upper envelope (+15mm).
  const path=Array.from({length:97},(_,i)=>{const y=5.51+i*1.88/96,p=intersectionAt(a,b,y);return p?new T.Vector3(p.x,y,p.y):null;});
  if(path.some(p=>!p))return null;
  const vertices=[],rails=[];
  for(let i=0;i<path.length;i++){
    const tangent=path[Math.min(i+1,path.length-1)].clone().sub(path[Math.max(0,i-1)]);
    const across=new T.Vector3(-tangent.z,0,tangent.x).normalize().multiplyScalar(.065);
    rails.push([-1,1].map(sign=>{const p=path[i].clone().addScaledVector(across,sign);const y=Math.max(roofHeight(sa,p.x,p.z),roofHeight(sb,p.x,p.z));p.y=Number.isFinite(y)?y+.015:path[i].y+.015;return p;}));
  }
  for(let i=0;i<rails.length-1;i++){
    const [a,b]=rails[i],[d,c]=rails[i+1];let seq=[a,b,c,a,c,d];
    if(b.clone().sub(a).cross(c.clone().sub(a)).y<0)seq=[a,c,b,a,d,c];
    for(const v of seq)vertices.push(v.x,v.y,v.z);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}

/**
 * Synchronous, preview-only, initially applied. Apply LAST after roof-joins and
 * roof-refinement/material overlays. Restore in reverse order; do not reapply an
 * upstream geometry controller while this controller is active. Original mesh
 * geometry/material/instance data are never modified. No network or DOM access.
 */
export function refineAnnexeJoins(root,materials={}){
  if(!root?.isObject3D)throw new TypeError('refineAnnexeJoins requires an Object3D');
  if(controllers.has(root)){const c=controllers.get(root);c.apply();return c;}
  root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert();
  const relative=o=>inverse.clone().multiply(o.matrixWorld);
  const translation=o=>new T.Vector3().setFromMatrixPosition(relative(o));
  const objects=[];root.traverse(o=>objects.push(o));
  const notes=[
    'Union clipping study at the existing site-sb/solve plan: central (18,0) R10, wings (14.4,±10.031) R5.9; wall top5.5, roof top7.4. No footprint or upper church endpoint moved.',
    'Actual triangle/plane splitting retains interpolated normals, UVs, colours and material slots. No centroid deletion or plaque/window category suppression.',
    'Nominal wall volumes plus small inferred join piers hide buried trim; ornamental moulding volumes are not individually boolean-unioned. This is not a historical plaque-count reconciliation.',
    'Apply LAST, after roof-joins and roof-refinement; restore this first. Static component transforms are captured. Root movement remains supported. Skinned/instanced annexe targets are skipped with notes.',
  ];
  const addedGroup=new T.Group();addedGroup.name='SB reversible annexe union joins';
  const translationOnly=o=>{
    const m=relative(o),p=translation(o),t=new T.Matrix4().makeTranslation(p.x,p.y,p.z);
    return m.elements.every((v,i)=>Math.abs(v-t.elements[i])<1e-5);
  };
  const complete=PARTS.every(p=>{
    const wall=objects.find(o=>o.userData?.kind==='apse-plinth'&&near(o.userData.radius,p.r)&&near(translation(o).x,p.x)&&near(translation(o).z,p.z));
    const roof=objects.find(o=>o.isMesh&&o.geometry?.type==='CylinderGeometry'&&near(o.geometry.parameters?.radiusTop,p.rt)&&near(o.geometry.parameters?.radiusBottom,p.rb)&&near(translation(o).x,p.x)&&near(translation(o).z,p.z)&&near(translation(o).y,6.45));
    return wall&&roof&&translationOnly(wall)&&translationOnly(roof)&&!roof.isInstancedMesh;
  });
  if(!complete){
    notes.push('BLOCKED: complete unscaled/unrotated three-part annexe not found. No geometry changed; no inferred piers or valleys added.');
    let disposed=false;
    const skipped={addedGroup,notes,apply(){if(disposed)throw new Error('Annexe controller disposed');return skipped;},restore(){return skipped;},dispose(){controllers.delete(root);disposed=true;}};
    controllers.set(root,skipped);return skipped;
  }
  const changes=[],geometries=new Set(),ownedMaterials=new Set();
  const roofs=PARTS.map(p=>prism(p,p.rb,p.rt,5.5,7.4,p.segments));
  const walls=PARTS.map(p=>prism(p,p.r,p.r,0,5.5));
  const returns=[returnSolid(1),returnSolid(-1)],block=boxSolid(14.4,18,0,5.5,-10,10);
  const joinCenters=PARTS.slice(1).map(p=>circleIntersection(PARTS[0],10,p,5.9));
  const piers=joinCenters.map(p=>prism({x:p.x,z:p.y},.34,.34,0,5.5,12,true));
  function belongs(o){for(let p=o.parent;p;p=p.parent){if(p.userData?.kind==='apse-plinth'&&near(p.userData.height,5.5)){const pos=translation(p);return PARTS.findIndex(s=>near(pos.x,s.x)&&near(pos.z,s.z)&&near(p.userData.radius,s.r));}}return -1;}
  const sameCenter=(o,p)=>{const v=translation(o);return near(v.x,p.x)&&near(v.z,p.z)&&near(v.y,6.45);};
  let clipped=0,skipped=0,matchedRoofs=0;
  for(const mesh of objects){
    if(!mesh.isMesh)continue;
    let cutters=null,category='',idx=belongs(mesh);
    if(idx>=0){cutters=[...walls.flatMap((s,j)=>j===idx?[]:[ownedCut(s,j<idx)]),ownedCut(block),...piers];category='wall/ornament';}
    else {
      const par=mesh.geometry?.parameters;
      idx=PARTS.findIndex(p=>sameCenter(mesh,p));
      const isRoof=idx>=0&&mesh.geometry?.type==='CylinderGeometry'&&par&&near(par.height,1.9)&&near(par.thetaLength,Math.PI)&&near(par.radiusTop,PARTS[idx].rt)&&near(par.radiusBottom,PARTS[idx].rb);
      const isOverlay=idx>=0&&['Closed annexe radial roof cuts','Apse lean-to standing seams and rolled eave'].includes(mesh.name);
      if(isRoof||isOverlay){cutters=[...roofs.flatMap((s,j)=>j===idx?[]:[ownedCut(s,j<idx)]),...returns];category='roof';if(isRoof)matchedRoofs++;}
      else if(mesh.name==='Closed straight annexe roof return'){
        // Geometry already in root coordinates; the two sign-distinguished
        // returns are disjoint except their union with the roof volumes.
        cutters=roofs.map(s=>ownedCut(s,true));category='return';
      }else if(mesh.geometry?.type==='BoxGeometry'&&par&&near(par.width,3.6)&&near(par.height,5.5)&&near(par.depth,20)){
        const pos=translation(mesh);if(near(pos.x,16.2)&&near(pos.y,2.75)&&near(pos.z,0)){cutters=[...walls.map(s=>ownedCut(s,true)),...piers];category='return block';}
      }
    }
    if(!cutters)continue;
    if(mesh.isInstancedMesh||mesh.isSkinnedMesh||mesh.geometry.morphAttributes.position){notes.push(`Skipped unsupported ${category}: ${mesh.name||mesh.uuid}`);skipped++;continue;}
    const result=clipGeometry(mesh.geometry,relative(mesh),cutters);
    geometries.add(result.geo);changes.push({mesh,before:mesh.geometry,after:result.geo});clipped+=result.changedTriangles;
  }
  // Add only if the actual three roof/plinth assemblies are present. A partial
  // root should not acquire freestanding inferred architectural pieces.
  const plinths=PARTS.map(p=>objects.find(o=>o.userData?.kind==='apse-plinth'&&near(o.userData.radius,p.r)&&near(translation(o).x,p.x)&&near(translation(o).z,p.z)));
  function material(source,fallback){const m=source?.isMeshStandardMaterial?source.clone():new T.MeshStandardMaterial(fallback);for(const key of ['map','normalMap','bumpMap','roughnessMap','aoMap','displacementMap'])m[key]=null;ownedMaterials.add(m);return m;}
  function add(geo,mat,name){geometries.add(geo);const m=new T.Mesh(geo,mat);m.name=name;m.castShadow=m.receiveShadow=true;addedGroup.add(m);}
  if(plinths.every(Boolean)){
    const source=plinths[0].children.find(o=>o.isMesh&&o.name.endsWith('-stone'))?.material;
    const m=material(source,{color:0xc9c3b2,roughness:.76});
    for(const p of joinCenters){
      const original=new T.CylinderGeometry(.34,.34,5.5,12).translate(p.x,2.75,p.y);
      const {geo}=clipGeometry(original,new T.Matrix4(),[...walls,block].map(s=>ownedCut(s,true)));
      original.dispose();add(geo,m,'Inferred narrow annexe union pier');
    }
  }else notes.push('Partial plinth set: join piers omitted; use complete church root.');
  if(matchedRoofs===3){
    const source=objects.find(o=>o.isMesh&&o.geometry?.type==='CylinderGeometry'&&near(o.geometry.parameters?.radiusTop,8.8))?.material;
    const m=material(materials.copper??source,{color:0x607468,metalness:.35,roughness:.55});
    for(let i=1;i<3;i++){const g=valleyGeometry(PARTS[0],PARTS[i],roofs[0],roofs[i]);if(g)add(g,m,'Annexe fitted copper valley flashing');else notes.push(`No continuous faceted valley found for ${PARTS[i].id}; flashing omitted.`);}
  }else notes.push(`Matched ${matchedRoofs}/3 original annexe roofs; valley flashing omitted for partial scene.`);
  notes.push(`Clipped ${changes.length} mesh buffers; ${clipped} source triangles split or removed, ${skipped} unsupported targets. Original materials/geometry restored exactly on restore().`);
  notes.push('Preserved exposed plaque/window fragments; some ornament at the physical intersection is necessarily truncated behind the inferred 0.68m-wide join pier. Pier width and copper strip width0.13m are provisional, not reference-measured.');
  notes.push('Clipping uses nominal 100-facet wall volumes and exact 32/40-facet roof solids. Tiny decorative overlaps outside nominal wall envelopes may remain away from the join piers. This is not a watertight boolean export of every ornamental solid.');
  let applied=false,disposed=false;
  function apply(){if(disposed)throw new Error('Annexe controller disposed');for(const r of changes)r.mesh.geometry=r.after;root.add(addedGroup);root.updateMatrixWorld(true);applied=true;return controller;}
  function restore(){if(applied){for(const r of changes)r.mesh.geometry=r.before;addedGroup.removeFromParent();applied=false;}return controller;}
  const controller={apply,restore,addedGroup,notes,dispose(){if(disposed)return;restore();geometries.forEach(g=>g.dispose());ownedMaterials.forEach(m=>m.dispose());addedGroup.clear();controllers.delete(root);disposed=true;}};
  controllers.set(root,controller);return apply();
}
