import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Additive preview; call after annexe union construction. No original edits.
 * Coordinates follow site-sb/annexe-joins. Restore before upstream controllers.
 * Returns detached {group,material,apply,restore}; notes live in group.userData.
 */
export function apseRustication(root, M) {
  if (!root?.isObject3D || !M?.granite?.isMaterial) throw new TypeError('apseRustication needs church root and M.granite.');
  const group = new THREE.Group(); group.name = 'Annexe / dressed borders and rough ashlar bosses';
  const material = M.granite.clone();
  material.name = 'Annexe warm grey rusticated granite';
  material.onBeforeCompile = M.granite.onBeforeCompile;
  material.customProgramCacheKey = M.granite.customProgramCacheKey;
  material.normalMap = M.granite.normalMap; material.roughnessMap = M.granite.roughnessMap;
  material.normalScale = new THREE.Vector2(.72, .72);
  material.roughness = .96; material.vertexColors = true; material.flatShading = true;
  material.color.setRGB(1.55, 1.48, 1.34);
  const notes = [
    'Reference treatment follows the parent user-photo study: rough-faced lower granite with dressed margins, smooth above spring. Course dimensions/tooling are estimates.',
    'Matches latest rusticated-base coloration (linear RGB 1.55/1.48/1.34), deterministic XY jitter and varied diagonals. Flat boss plateaus use only 0.009m peak-to-peak tooling jitter; dressed borders remain regular.',
    'Bounded coverage: one low course below all recesses, plus narrow inter-opening solid piers below spring. No arch rings, plaques, glass, grille, upper wall or roof changes.',
    'Analytic conservative exclusions retain only exterior portions of the three-part annexe union; join piers and nearby fragments are deliberately omitted.',
    'Nominal circles overbound the union clipper 100-facet walls; 0.40m join exclusion protects its inferred R0.34 piers. Straight returns and their historical ashlar allocation remain unresolved.',
    'Construct after all three plinths load. Independent exterior exclusion works with union enabled or disabled; no buried annexe surfaces are added. Static child transforms required.',
    'Apply after upstream annexe/material controllers; restore this first. Original geometry/materials untouched. Dispose only this group geometry and returned material at permanent teardown; retain shared maps.',
  ];
  const specs = [{id:'central',x:18,z:0,r:10,bays:9}, {id:'south',x:14.4,z:10.031,r:5.9,bays:5}, {id:'north',x:14.4,z:-10.031,r:5.9,bays:5}];
  function relative(o) {
    const chain=[]; for(let p=o;p&&p!==root;p=p.parent) chain.unshift(p);
    const m=new THREE.Matrix4();
    for(const p of chain)m.multiply(p.matrixAutoUpdate?new THREE.Matrix4().compose(p.position,p.quaternion,p.scale):p.matrix);
    return m;
  }
  const objects=[];root.traverse(o=>{if(o.userData?.kind==='apse-plinth')objects.push(o);});
  const matched=specs.map(s=>objects.find(o=>{
    const m=relative(o),expected=new THREE.Matrix4().makeTranslation(s.x,0,s.z);
    return Math.abs(o.userData.radius-s.r)<.001 && o.userData.bays===s.bays &&
      Math.abs(o.userData.height-5.5)<.001 && m.elements.every((v,i)=>Math.abs(v-expected.elements[i])<.002);
  }));
  const pieces=[],records=[];let skipped=0;
  const hash=(x,y,seed)=>{const q=Math.sin(x*127.1+y*311.7+seed*73.31)*43758.5453;return q-Math.floor(q);};
  // Circle intersections match annexe-joins' eastern union seam locations.
  const joins=specs.slice(1).map(b=>{
    const a=specs[0],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
    const u=(a.r*a.r-b.r*b.r+d*d)/(2*d),v=Math.sqrt(a.r*a.r-u*u);
    return [-1,1].map(sign=>({x:a.x+u*dx/d-sign*v*dz/d,z:a.z+u*dz/d+sign*v*dx/d})).sort((p,q)=>q.x-p.x)[0];
  });
  function safe(s,a,b,outer) {
    const angle=(a+b)/(2*s.r),middleR=(s.r-.01+outer)/2;
    const x=s.x+middleR*Math.sin(angle),z=s.z+middleR*Math.cos(angle);
    // Every point in the curved block lies inside this conservative disk.
    const reach=outer*(b-a)/(2*s.r)+(outer-(s.r-.01))/2;
    if(specs.some(other=>other!==s&&Math.hypot(x-other.x,z-other.z)-reach<=other.r+.03))return false;
    if(joins.some(p=>Math.hypot(x-p.x,z-p.z)-reach<=.40))return false;
    const boxDistance=(x0,x1,z0,z1)=>Math.hypot(Math.max(x0-x,0,x-x1),Math.max(z0-z,0,z-z1));
    return boxDistance(14.4,18,-10,10)>reach+.03 && boxDistance(-16,14.7,-15.3,15.3)>reach+.03;
  }
  function block(s,a,b,y0,y1,unit,pier,seed) {
    const w=b-a,h=y1-y0;if(w<.13||h<.16)return;
    // Pier offset clears the source's shallow ashlar stacks, but the relief
    // above its dressed margin stays shallow and flat, like the N/S treatment.
    const dressed=pier?.145*unit:.034, boss=dressed+.038*(pier?unit:1);
    const outer=s.r+boss+.006;
    if(!safe(s,a,b,outer)){skipped++;return;}
    const axis=L=>{
      const border=Math.min(.035,L*.16),inner=border+Math.min(.025,L*.10);
      const arr=[0,border,inner];const n=Math.max(1,Math.ceil((L-2*inner)/.10));
      for(let i=1;i<n;i++)arr.push(inner+(L-2*inner)*i/n);
      arr.push(L-inner,L-border,L);return arr;
    };
    const xs=axis(w),ys=axis(h),nx=xs.length,ny=ys.length,N=nx*ny;
    const positions=[],uv=[],colors=[],indices=[];
    const shade=.90+hash(seed,3,8)*.10;
    for(let back=0;back<2;back++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      let x=xs[i],y=ys[j];
      // Move only interior samples, never silhouettes or dressed margin rows.
      // Limit jitter by neighbour spacing so even narrow piers cannot fold.
      if(i>2&&i<nx-3)x+=(hash(i,j,seed+11)-.5)*Math.min(.028,.4*Math.min(xs[i]-xs[i-1],xs[i+1]-xs[i]));
      if(j>2&&j<ny-3)y+=(hash(i,j,seed+23)-.5)*Math.min(.028,.4*Math.min(ys[j]-ys[j-1],ys[j+1]-ys[j]));
      const edge=Math.min(x,w-x,y,h-y),border=Math.min(.035,Math.min(w,h)*.16);
      const ramp=THREE.MathUtils.clamp((edge-border)/.025,0,1);
      const noise=(hash(i,j,seed)-.5)*.009;
      // A small bevel leads into a level dressed border; no broad rounded swell.
      const bevel=Math.min(.018,border*.5);
      const relief=edge<bevel?dressed-.022*(1-edge/bevel):dressed+(boss-dressed)*ramp+noise*ramp;
      const r=back?s.r-.01:s.r+relief,angle=(a+x)/s.r;
      positions.push(s.x+r*Math.sin(angle),y0+y,s.z+r*Math.cos(angle));uv.push(a+x,y0+y);
      const c=shade*(edge<.035?1:.96+hash(i,j,seed+19)*.04);colors.push(c,c*.985,c*.96);
    }
    for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){
      const a=j*nx+i,b=a+1,c=a+nx,d=c+1;
      const tris=hash(i,j,seed+7)>.5?[a,b,c,b,d,c]:[a,b,d,a,d,c];
      indices.push(...tris);
      for(let t=0;t<6;t+=3)indices.push(N+tris[t],N+tris[t+2],N+tris[t+1]);
    }
    const rim=[];
    for(let i=0;i<nx;i++)rim.push(i);
    for(let j=1;j<ny;j++)rim.push(j*nx+nx-1);
    for(let i=nx-2;i>=0;i--)rim.push((ny-1)*nx+i);
    for(let j=ny-2;j>0;j--)rim.push(j*nx);
    for(let i=0;i<rim.length;i++){const a=rim[i],b=rim[(i+1)%rim.length];indices.push(a,N+a,b,b,N+a,N+b);}
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    g.setIndex(indices);g.computeVertexNormals();pieces.push(g.toNonIndexed());g.dispose();
    records.push({part:s.id,arc:[a,b],y:[y0,y1],outerRadius:outer,pier});
  }
  if(matched.every(Boolean))for(let k=0;k<specs.length;k++){
    const s=specs[k],data=matched[k].userData,unit=s.r/10,width=Math.PI*s.r/s.bays;
    const trim=Math.min(.10*unit,width*.025);
    const spring=Math.min(...data.openings.map(o=>o.spring));
    // Leave all three arch rings and jamb/capital profiles untouched. Protected
    // ranges extend beyond opening+5.15 trims, the outside of the thin jamb.
    const exclusions=data.openings.map(o=>[s.r*o.angle-o.halfWidth-5.15*trim-.025,s.r*o.angle+o.halfWidth+5.15*trim+.025]);
    let spans=[[.08,Math.PI*s.r-.08]];
    for(const [lo,hi]of exclusions)spans=spans.flatMap(([a,b])=>b<=lo||a>=hi?[[a,b]]:[[a,Math.min(b,lo)],[Math.max(a,hi),b]].filter(([x,y])=>y>x));
    const lowTop=Math.min(...data.openings.map(o=>o.sill))-3.8*trim-.04;
    for(let a=.08,n=0;a<Math.PI*s.r-.08;a+=1.12,n++)block(s,a+.015,Math.min(a+1.12,Math.PI*s.r-.08)-.015,.15,lowTop,unit,false,100*k+n);
    for(let row=0;row<6;row++){
      const courseBase=.32+row*.53,y0=Math.max(courseBase,lowTop+.035),y1=Math.min(courseBase+.495,spring-.12);if(y1-y0<.16)continue;
      for(const [a,b]of spans)block(s,a+.012,b-.012,y0,y1,unit,true,k*1000+row*31+a);
    }
  }else notes.push('SKIPPED: exact three unscaled translated annexe plinths with opening metadata were not found; no inferred geometry added.');
  let triangles=0;
  if(pieces.length){
    const geometry=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());
    if(!geometry)throw new Error('Apse rustication merge failed.');
    triangles=geometry.attributes.position.count/3;
    if(triangles>150000){geometry.dispose();throw new Error('Apse rustication exceeds 150k triangle limit.');}
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,material);mesh.name='Exposed annexe ashlar / rough bosses and dressed margins';
    mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  }
  group.userData={notes,blocks:records.length,triangles,drawCalls:group.children.length,skippedAtUnion:skipped,coverage:records,provisional:true};
  return {group,material,apply(){if(group.parent!==root)root.add(group);group.visible=true;return group;},restore(){group.removeFromParent();return group;}};
}
