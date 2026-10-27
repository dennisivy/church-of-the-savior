import * as THREE from 'three';

/**
 * Secondary finials only: one bell, four corners, three apses. No central finial.
 *
 * INTEGRATION / HEIGHT CONTRACT (metres, Three.js Y-up)
 *   const f = createSecondaryFinial({kind:'bell', height:h1-h0, materials:C});
 *   f.position.set(u, h0, v); parent.add(f);
 * Replace the old cross() call, including its sphere, with this group.
 * Local (0,0,0) is the OLD helper's globe centre / existing onion tip, NOT the
 * underside of the globe. The globe straddles y=0; brace anchors extend below it.
 * The highest vertex is exactly `height`. No extra parent scale is needed.
 * Cross lies in YZ (arms north/south), face-on from east/west, matching the
 * drone and apse photographs. Do not apply the central asset's extra rotation.
 *
 * Current src/site-sb.js placements (snapshot, not hard-coded world offsets):
 * bell:       [-20.259,57.332,0],          height=7.875
 * SW / NW:    [-10.506,44.962,+/-10.066],  height=6.1935
 * SE / NE:    [  9.906,44.962,+/-10.066],  height=6.1935
 * main apse:  [22.27,39.562,0],           height=5.574
 * side apses: [17.65,26.136,+/-10.031],   height=3.5 (kind='apse-small')
 * The corner numbers preserve the caller's averaged orb/cross heights.
 *
 * `kind`: 'bell' | 'corner' | 'SW' | 'NW' | 'SE' | 'NE' | 'apse' | 'apse-small'.
 * 'corner' aliases the SW shoulder calibration; directional kinds have their
 * own default brace anchor positions fitted to control points in domes.js.
 * `braceAnchors`: optional FOUR [x,y,z] LOCAL METRE coordinates, supplied in the
 * final YZ cross orientation; overrides defaults when the dome envelope changes.
 * `materials`: {gold, goldSeam?}; accepts createDomeMaterials() or site C.
 * Optional goldSeam is used for recessed collars and sockets, otherwise gold.
 * Defaults share one material dictionary. No textures, fetch, lights or timers.
 * Result has ONE mesh per distinct material identity (one or two draw calls).
 * Caller owns returned geometries; shared/supplied materials remain caller-owned.
 * userData contains counts, measured bounds, source/inference and anchor positions.
 * Closed solid parts intersect at joints; this is not a boolean-unioned print mesh.
 *
 * REFERENCE EVIDENCE
 * research/elements-domes.md §9 and elements-bell-tower.md §19; saved sb-photos
 * east.jpg, c-bell.jpg, c-sw.jpg, c-nw.jpg, c-apse.jpg; research-domes/
 * Cathédrale_Saint-Sauveur-sur-le-Sang-Versé_-_coupole_(02),(03),(12).jpg.
 * 02/03 show beaded shoulder braces, collars and globes but nearly edge-on crosses.
 * 12 shows the apse's paired rails, trefoil tips, crossing scrollwork and crescent.
 * Bell crown is supported by the research and the saved bell views. Corner
 * crescents are unconfirmed and deliberately omitted. Side apse ornament uses a
 * reduced main-apse interpretation. Scroll placement and bead counts are inferred,
 * NOT a claim to reproduce the historic filigree or measured cross dimensions.
 */

const TAU = 2 * Math.PI;
const CONFIG = {
  bell: { nominal:7.875, orb:.061, width:.225, foot:.30, main:.69, upper:.855, crown:true, crescent:false, radius:1.89, drop:3.25036 },
  corner: { nominal:6.1935, orb:.062, width:.225, foot:.30, main:.70, upper:.855, crown:false, crescent:false, radius:2.64, drop:2.7867 },
  apse: { nominal:5.574, orb:.082, width:.285, foot:.30, main:.70, upper:.865, crown:false, crescent:true, radius:1.075, drop:1.57488 },
  'apse-small': { nominal:3.5, orb:.070, width:.25, foot:.30, main:.70, upper:.855, crown:false, crescent:true, radius:.645, drop:1.11264 },
};
const CORNER_ANCHORS = {
  SW: [2.64,2.7867], NW:[2.288,2.62746], SE:[2.112,2.46822], NE:[2.332,2.3090],
};
let sharedMaterials;

export function createSecondaryFinialMaterials() {
  const gold = new THREE.MeshStandardMaterial({color:0xc09b50, metalness:.78, roughness:.32});
  const goldSeam = new THREE.MeshStandardMaterial({color:0x846c38, metalness:.66, roughness:.46});
  gold.name='sb-finial-gold'; goldSeam.name='sb-finial-recessed-gold';
  return {gold,goldSeam};
}

export function createSecondaryFinial({ kind='corner', height=6.1935, materials, braceAnchors }={}) {
  const family = Object.hasOwn(CORNER_ANCHORS,kind) ? 'corner' : kind;
  if (!Object.hasOwn(CONFIG,family)) throw new RangeError(`Unknown secondary finial kind: ${kind}`);
  if (!Number.isFinite(height) || height<=0) throw new RangeError('Finial height must be finite and positive');
  const mats=materials ?? (sharedMaterials ??= createSecondaryFinialMaterials());
  if (!mats.gold?.isMaterial || (mats.goldSeam != null && !mats.goldSeam.isMaterial)) throw new TypeError('Finials require gold and optional goldSeam Three.js materials');
  if (braceAnchors !== undefined && (!Array.isArray(braceAnchors) || braceAnchors.length!==4 || braceAnchors.some(p=>!Array.isArray(p) || p.length!==3 || p.some(v=>!Number.isFinite(v)) || p[1]>=0 || Math.hypot(p[0],p[2])<=0))) {
    throw new RangeError('braceAnchors must contain four finite [x,y,z] positions below the globe and away from its axis');
  }
  const cfg=CONFIG[family], buckets=new Map(), parts={};
  const V=(x,y,z=0)=>new THREE.Vector3(x,y,z);
  // Build in XY for simple metalwork drawings, then turn the result into YZ.
  const orient = p=>[-p.z*height,p.y*height,p.x*height];
  function add(geometry,key='gold',label='metalwork') {
    const material=key==='gold' ? mats.gold : (mats.goldSeam ?? mats.gold);
    if (!buckets.has(material)) buckets.set(material,{positions:[],normals:[],indices:[]});
    const b=buckets.get(material), offset=b.positions.length/3;
    const pos=geometry.getAttribute('position'), normal=geometry.getAttribute('normal');
    for (let i=0;i<pos.count;i++) {
      b.positions.push(...orient(V(pos.getX(i),pos.getY(i),pos.getZ(i))));
      b.normals.push(-normal.getZ(i),normal.getY(i),normal.getX(i));
    }
    const ix=geometry.index;
    for (let i=0;i<(ix?.count ?? pos.count);i++) b.indices.push(offset+(ix ? ix.getX(i) : i));
    parts[label]=(parts[label]??0)+1; geometry.dispose();
  }
  function sphere(p,r,key='gold',label='boss',segments=10,rings=6) {
    add(new THREE.SphereGeometry(r,segments,rings).translate(...p),key,label);
  }
  // Capped sweeps, including end disks; unlike open-ended TubeGeometry.
  function tube(points,r,key='gold',label='rail',closed=false,sides=6,axis=V(0,0,1)) {
    const pts=points.map(p=>Array.isArray(p)?V(...p):p), positions=[], indices=[];
    for (let i=0;i<pts.length;i++) {
      const prev=pts[closed?(i+pts.length-1)%pts.length:Math.max(0,i-1)];
      const next=pts[closed?(i+1)%pts.length:Math.min(pts.length-1,i+1)];
      const t=next.clone().sub(prev).normalize();
      let u=t.clone().cross(axis);
      if (u.lengthSq()<1e-8) u=t.clone().cross(V(0,1,0));
      u.normalize();const v=t.clone().cross(u).normalize();
      for(let k=0;k<sides;k++) {
        const p=pts[i].clone().addScaledVector(u,r*Math.cos(k*TAU/sides)).addScaledVector(v,r*Math.sin(k*TAU/sides));
        positions.push(p.x,p.y,p.z);
      }
    }
    for(let i=0;i<(closed?pts.length:pts.length-1);i++) for(let k=0;k<sides;k++) {
      const a=i*sides+k,b=i*sides+(k+1)%sides,c=((i+1)%pts.length)*sides+(k+1)%sides,d=((i+1)%pts.length)*sides+k;
      indices.push(a,b,d,b,c,d);
    }
    if(!closed) {
      const first=positions.length/3;positions.push(...pts[0].toArray(),...pts.at(-1).toArray());
      for(let k=0;k<sides;k++) {
        indices.push(first,(k+1)%sides,k);
        const end=(pts.length-1)*sides;indices.push(first+1,end+k,end+(k+1)%sides);
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();add(g,key,label);
  }
  function loop(x,y,rx,ry,r=.0045,key='gold',label='open scroll',z=0) {
    tube(Array.from({length:16},(_,i)=>[x+rx*Math.cos(i*TAU/16),y+ry*Math.sin(i*TAU/16),z]),r,key,label,true);
  }
  function collar(y,r,t=.004,key='gold') {
    tube(Array.from({length:24},(_,i)=>[r*Math.cos(i*TAU/24),y,r*Math.sin(i*TAU/24)]),t,key,'globe collar',true,6,V(0,1,0));
  }
  function line(a,b,r=.006,key='gold',label='rail'){tube([a,b],r,key,label);}
  function trefoil(x,y,dx,dy,size=.017) {
    const base=Math.atan2(dy,dx);
    // Three touching lobes, with a neck joining the pair of structural rails.
    for(const angle of [base,base+Math.PI/2,base-Math.PI/2]) {
      const xx=x+size*.68*Math.cos(angle), yy=y+size*.68*Math.sin(angle);
      loop(xx,yy,size*.72,size*.72,.0039,'gold','trefoil');
    }
    sphere([x,y,0],.007,'gold','trefoil boss');
  }
  function outlinedBar(a,b,gap=.009,r=.0055) {
    const A=V(...a),B=V(...b),d=B.clone().sub(A).normalize(),perp=V(-d.y,d.x,0).multiplyScalar(gap);
    for(const side of [-1,1]) line(A.clone().addScaledVector(perp,side),B.clone().addScaledVector(perp,side),r);
    line(A.clone().sub(perp),A.clone().add(perp),r);line(B.clone().sub(perp),B.clone().add(perp),r);
  }
  // Globe centre stays exactly at the old h0, with thin lower/upper rolled collars.
  sphere([0,0,0],cfg.orb,'gold','globe',24,16);
  collar(-cfg.orb*.83,cfg.orb*.58,.0045);
  collar(cfg.orb*.84,cfg.orb*.59,.0045);
  collar(cfg.orb+.010,cfg.orb*.62,.004);
  collar(cfg.orb+.018,cfg.orb*.48,.003,'goldSeam');
  add(new THREE.CylinderGeometry(cfg.orb*.48,cfg.orb*.59,.030,24).translate(0,cfg.orb+.005,0),'goldSeam','solid collar socket');
  line([0,cfg.orb*.80,0],[0,.26,0],.010,'gold','globe stem');
  // All three bars are structural, including the slanting Orthodox foot bar.
  const top=cfg.crown?.908:.973;
  outlinedBar([0,.16,0],[0,top,0],.008,.0052);
  outlinedBar([-cfg.width,cfg.main,0],[cfg.width,cfg.main,0],.010,.0062);
  outlinedBar([-cfg.width*.56,cfg.upper,0],[cfg.width*.56,cfg.upper,0],.008,.0052);
  outlinedBar([-cfg.width*.43,cfg.foot-.029,0],[cfg.width*.43,cfg.foot+.029,0],.008,.005);
  for(const [y,w] of [[cfg.main,cfg.width],[cfg.upper,cfg.width*.56]]) for(const side of [-1,1]) trefoil(side*w,y,side,0);
  for(const side of [-1,1]) trefoil(side*cfg.width*.43,cfg.foot+side*.029,side,side*.2,.013);
  if(!cfg.crown) trefoil(0,top,0,1,.016);
  // Restrained open scroll quadrants: outlines from the photos, arrangement inferred.
  for(const sx of [-1,1]) for(const sy of [-1,1]) {
    loop(sx*.038,cfg.main+sy*.035,.027,.023,.0045);
    loop(sx*.062,cfg.main+sy*.047,.013,.015,.0038);
    line([sx*.012,cfg.main+sy*.012,0],[sx*.026,cfg.main+sy*.025,0],.004);
  }
  loop(0,cfg.main,.022,.022,.0045,'gold','crossing rosette',.009);
  sphere([0,cfg.main,.009],.009,'gold','crossing boss');
  if(family==='bell') {
    // Visible knob rhythm, not a fabricated dense historic lace pattern.
    for(const side of [-1,1]) for(let j=1;j<=6;j++) sphere([side*(.025+j*.027),cfg.main+.017,0],.006,'gold','arm bead');
    for(const y of [.37,.43,.49,.55,.79]) sphere([0,y,0],.010,'gold','upright boss');
  }
  if(cfg.crescent) {
    const shape=new THREE.Shape();shape.moveTo(-.074,.205);
    shape.bezierCurveTo(-.075,.105,.075,.105,.074,.205);
    shape.bezierCurveTo(.045,.145,-.045,.145,-.074,.205);
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.009,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.002,bevelThickness:.002,curveSegments:18});
    geo.translate(0,0,-.0045);add(geo,'gold','crescent');
    for(const side of [-1,1]) sphere([side*.074,.205,0],.0045,'gold','crescent tip');
  }
  if(cfg.crown) {
    line([0,.90,0],[0,.935,0],.009,'gold','crown stem');
    add(new THREE.CylinderGeometry(.032,.026,.024,24).translate(0,.926,0),'gold','crown cup');
    collar(.919,.026,.005);collar(.938,.033,.005);
    for(let j=0;j<8;j++) {
      const a=j*TAU/8;
      tube(Array.from({length:13},(_,i)=>{
        const t=i/12,rad=.032*Math.sin(Math.PI*t);
        return [rad*Math.cos(a),.935+.046*t,rad*Math.sin(a)];
      }),.0038,'gold','crown rib');
      sphere([.033*Math.cos(a),.946,.033*Math.sin(a)],.005,'gold','crown pearl');
    }
    sphere([0,.989,0],.011,'gold','crown finial',12,8);
  } else {
    // A tiny terminal bud gives every variant the same exact caller height.
    sphere([0,.993,0],.007,'gold','crest bud',12,8);
  }
  // Four distinct brace planes, two descending from each main arm. Their lower
  // seats match selected dome profile controls at the nominal site dimensions.
  const [radius,drop]=CORNER_ANCHORS[kind]??[cfg.radius,cfg.drop];
  const anchors=braceAnchors?.map(p=>V(p[2]/height,p[1]/height,-p[0]/height)) ??
    Array.from({length:4},(_,i)=>{const a=Math.PI/4+i*TAU/4;return V(Math.cos(a)*radius/cfg.nominal,-drop/cfg.nominal,Math.sin(a)*radius/cfg.nominal);});
  for(let i=0;i<4;i++) {
    const end=anchors[i],start=V(Math.sign(end.x || 1)*cfg.width*.86,cfg.main-.015,Math.sign(end.z || 1)*.009);
    const at=t=>start.clone().lerp(end,t).add(V(0,-.016*Math.sin(Math.PI*t),0));
    tube(Array.from({length:17},(_,j)=>at(j/16)),.0023,'gold','brace cable',false,6);
    for(let j=1;j<=10;j++) sphere(at(j/11).toArray(),j===5||j===7?.013:.005,'gold','brace bead',8,6);
    // One open spindle link per brace, in a plane containing the cable.
    const mid=at(.67),dir=end.clone().sub(start).normalize(),across=dir.clone().cross(V(0,0,1)).normalize();
    tube(Array.from({length:24},(_,j)=>mid.clone().addScaledVector(dir,.040*Math.cos(j*TAU/24)).addScaledVector(across,.012*Math.sin(j*TAU/24))),.0025,'gold','brace link',true,6);
    sphere(end.toArray(),.012,'goldSeam','shoulder socket',10,6);
    sphere(start.toArray(),.009,'gold','arm eye',10,6);
  }
  const group=new THREE.Group();group.name=`sb-secondary-finial-${kind}`;
  let triangles=0;
  for(const [material,b] of buckets) {
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(b.normals,3));geo.setIndex(b.indices);
    geo.computeBoundingBox();geo.computeBoundingSphere();
    const mesh=new THREE.Mesh(geo,material);mesh.name=`${group.name}-${group.children.length}`;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);triangles+=b.indices.length/3;
  }
  const bounds=new THREE.Box3().setFromObject(group);
  group.userData={
    kind,family,height,triangles,drawCalls:group.children.length,parts,
    origin:'old cross helper h0 = globe centre = existing dome tip',
    axes:'Y-up; cross in YZ; faces east/west; no extra rotation required',
    bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},braceAnchors:anchors.map(orient),
    sources:['spilled-blood/research/elements-domes.md §9','spilled-blood/research/elements-bell-tower.md §19','saved research-domes/coupole_(02).jpg','saved research-domes/coupole_(03).jpg','saved research-domes/coupole_(12).jpg','saved sb-photos/east.jpg','saved sb-photos/c-bell.jpg','saved sb-photos/c-sw.jpg','saved sb-photos/c-nw.jpg','saved sb-photos/c-apse.jpg'],
    supported:['Orthodox three-bar silhouette and slanted foot bar','Trefoil bar tips, open crossing ornament, globe and rolled collars','Four beaded shoulder braces','Bell crown','Main apse crescent and broad outlined bars'],
    inferred:['Exact rail thickness, trefoil geometry, scroll arrangement and bead/link counts','Corner ornaments share a family; corner crescents omitted as unconfirmed','Side apse uses a reduced main-apse crescent study','Default anchor radii/heights fitted to current dome profile controls; anchor azimuth and sag inferred','Height follows current site envelope, not published cross-only dimensions'],
    ownership:'Dispose mesh geometries; do not dispose supplied/shared materials while other users remain',
  };
  return group;
}
