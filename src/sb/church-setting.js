import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Standalone synchronous buildGround replacement. Metres, Y up; dt in seconds.
 * No fetch, DOM, image downloads, renderer changes or lights owned by this module.
 */
export function createChurchSetting() {
  const group = new THREE.Group(); group.name = 'Church setting / canal, granite and ironwork';
  const standard = (name, color, roughness, metalness = 0) => new THREE.MeshStandardMaterial({name,color,roughness,metalness});
  const materials = {
    paving: standard('Setting / warm granite paving', '#aaa39b', .93),
    red: standard('Setting / muted red granite bands', '#805c56', .85),
    bank: standard('Setting / embankment granite', '#8d8982', .88),
    coping: standard('Setting / dressed granite coping', '#b4aea3', .82),
    outer: standard('Setting / outer pavement', '#807d79', .97),
    iron: standard('Setting / graphite iron', '#20282a', .6, .6),
    grass: standard('Setting / narrow lawn', '#586143', 1),
    bed: standard('Setting / submerged canal bed', '#263a38', 1),
    lantern: new THREE.MeshStandardMaterial({name:'Setting / lantern glass',color:'#c5c7b1',roughness:.34,metalness:.2,emissive:'#8d713f',emissiveIntensity:.08}),
    water: new THREE.MeshPhysicalMaterial({name:'Setting / canal water',color:'#304a4c',roughness:.27,metalness:.15,clearcoat:.65,clearcoatRoughness:.2}),
  };
  // Local, deterministic fine granite grain and restrained slab joints. UVs are
  // metres, not a single stretched photograph; physical bands/curbs are geometry.
  const size=256, rgb=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4);
  const grain=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
  const edge=(x,y)=>{x=(x+size)%size;y=(y+size)%size;const row=Math.floor(y/128),u=(x+row*64)%128,v=y%128;return Math.min(u,128-u,v,128-v);};
  const h=(x,y)=>Math.min(1,edge(x,y)/1.3)*.55;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,c=(edge(x,y)<1?157:224)+(grain(x,y)-.5)*9;
    rgb.set([c,c*.985,c*.96,255],i);
    const n=new THREE.Vector3((h(x-1,y)-h(x+1,y))*.32,(h(x,y-1)-h(x,y+1))*.32,1).normalize();
    normal.set([(n.x*.5+.5)*255,(n.y*.5+.5)*255,(n.z*.5+.5)*255,255],i);
  }
  const texture=(data,color)=>{
    const t=new THREE.DataTexture(data,size,size);t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.repeat.set(1/2.4,1/1.6);t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;
    if(color)t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;
  };
  materials.paving.map=texture(rgb,true);materials.paving.normalMap=texture(normal,false);materials.paving.normalScale.set(.28,.28);
  materials.outer.map=materials.paving.map;materials.outer.normalMap=materials.paving.normalMap;materials.outer.normalScale.set(.15,.15);

  const batches=new Map(),instances=new Map();
  function collect(geometry,material){
    const flat=geometry.index?geometry.toNonIndexed():geometry;if(flat!==geometry)geometry.dispose();flat.clearGroups();
    // Three-axis metric UV projection for horizontal tops and vertical banks.
    const p=flat.attributes.position,uv=new Float32Array(p.count*2),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);const n=b.sub(a).cross(c.sub(a));
      const axis=Math.abs(n.y)>Math.max(Math.abs(n.x),Math.abs(n.z))?'y':Math.abs(n.x)>Math.abs(n.z)?'x':'z';
      for(let j=i;j<i+3;j++){uv[j*2]=axis==='x'?p.getZ(j):p.getX(j);uv[j*2+1]=axis==='y'?p.getZ(j):p.getY(j);}}
    flat.setAttribute('uv',new THREE.BufferAttribute(uv,2));if(!batches.has(material))batches.set(material,[]);batches.get(material).push(flat);
  }
  const boxGeo=new THREE.BoxGeometry(1,1,1),rodGeo=new THREE.CylinderGeometry(1,1,1,8),tipGeo=new THREE.ConeGeometry(1,1,6);
  function instance(geo,mat,position,scale,quaternion=new THREE.Quaternion()){
    let byMaterial=instances.get(geo);if(!byMaterial){byMaterial=new Map();instances.set(geo,byMaterial);}
    if(!byMaterial.has(mat))byMaterial.set(mat,[]);
    byMaterial.get(mat).push(new THREE.Matrix4().compose(new THREE.Vector3(...position),quaternion,new THREE.Vector3(...scale)));
  }
  const box=(x,y,z,w,h,d,mat,yaw=0)=>instance(boxGeo,mat,[x,y,z],[w,h,d],new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw));
  const rod=(x,y,z,r,h,mat=materials.iron)=>instance(rodGeo,mat,[x,y,z],[r,h,r]);
  function beam(a,b,y,width,height,mat){const dx=b[0]-a[0],dz=b[1]-a[1];box((a[0]+b[0])/2,y,(a[1]+b[1])/2,Math.hypot(dx,dz),height,width,mat,Math.atan2(-dz,dx));}
  function slab(points,top,depth,material){
    const s=new THREE.Shape();points.forEach(([x,z],i)=>i?s.lineTo(x,z):s.moveTo(x,z));s.closePath();
    collect(new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:1}).rotateX(Math.PI/2).translate(0,top,0),material);
  }
  const westEdge=[[-22,-180],[-22,-35]];
  for(let i=1;i<=18;i++){const a=i*Math.PI/36;westEdge.push([-22-9*Math.sin(a),-26-9*Math.cos(a)]);}
  westEdge.push([-31,26]);
  for(let i=1;i<=18;i++){const a=i*Math.PI/36;westEdge.push([-22-9*Math.cos(a),26+9*Math.sin(a)]);}
  westEdge.push([-22,180]);
  slab([...westEdge,[140,180],[140,-180]],0,4.4,materials.outer);
  const oppositeBankX=-40; // Reference-fit estimate, replacing the inherited -52 boundary.
  slab([[-140,-180],[oppositeBankX,-180],[oppositeBankX,180],[-140,180]],0,4.4,materials.outer);
  const waterOutline=[[oppositeBankX,-180],...westEdge,[oppositeBankX,180]];
  slab(waterOutline,-4.35,.10,materials.bed);
  slab(waterOutline,-1.35,.035,materials.water);
  const platformEdge=westEdge.filter(p=>Math.abs(p[1])<=35);
  slab([...platformEdge,[43,35],[43,-35]],.08,.08,materials.paving);

  // Build coursed granite faces and separated coping blocks on the actual bank
  // line. Continuous closed terrain below prevents any holes at corner joints.
  const bankPaths=[westEdge,[[oppositeBankX,-180],[oppositeBankX,180]]];
  for(const path of bankPaths)for(let k=1;k<path.length;k++){
    const a=path[k-1],b=path[k],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(len/1.4);
    for(let j=0;j<n;j++){
      const at=t=>[THREE.MathUtils.lerp(a[0],b[0],t),THREE.MathUtils.lerp(a[1],b[1],t)];
      beam(at((j+.012)/n),at((j+.988)/n),.12,.54,.24,materials.coping);
      for(let row=0;row<5;row++)beam(at((j+.012)/n),at((j+.988)/n),-.23-row*.43,.12,.408,materials.bank);
    }
  }
  const uPath=(radius)=>{
    const points=[[-28,-radius],[10,-radius]];
    for(let i=1;i<=80;i++){const a=-Math.PI/2+i*Math.PI/80;points.push([10+radius*Math.cos(a),radius*Math.sin(a)]);}
    points.push([-28,radius]);return points;
  };
  // Actual thin inlaid ribbons, never a grid of bright raised blocks.
  for(const r of [25.8,27.0]){const path=uPath(r);for(let i=1;i<path.length;i++)beam(path[i-1],path[i],.083,.32,.006,materials.red);}
  beam([-28.8,-25.8],[-28.8,25.8],.083,.32,.006,materials.red);
  const inApproach=(a,b)=>{
    const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
    return (Math.abs(z)>27&&x>-25&&x<-13)||(x>37&&Math.abs(z)<4.2);
  };
  // Subdivide straight lengths too, so explicit approach gaps aren't bridged.
  function subdivide(path,spacing){const out=[path[0]];for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/spacing);
    for(let j=1;j<=n;j++)out.push([THREE.MathUtils.lerp(a[0],b[0],j/n),THREE.MathUtils.lerp(a[1],b[1],j/n)]);}return out;}
  const lawn=subdivide(uPath(28.05),.65);
  for(let i=1;i<lawn.length;i++)if(!inApproach(lawn[i-1],lawn[i]))beam(lawn[i-1],lawn[i],.095,1.05,.026,materials.grass);

  function railPanel(a,b,base,canal){
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]),H=canal?1.16:1.35;
    beam(a,b,base+.07,canal?.40:.22,.14,materials.coping);
    for(const y of [.25,H])beam(a,b,base+y,.045,.055,materials.iron);
    const n=Math.max(2,Math.ceil(len/.22));
    for(let j=1;j<n;j++){
      const x=THREE.MathUtils.lerp(a[0],b[0],j/n),z=THREE.MathUtils.lerp(a[1],b[1],j/n);
      rod(x,base+(H+.25)/2,z,.014,H-.25);
    }
    if(canal){
      // Open oval motifs between slender bars, simplified from canal railings.
      const tangent=new THREE.Vector3((b[0]-a[0])/len,0,(b[1]-a[1])/len);
      for(let j=0;j<2;j++){
        const cx=THREE.MathUtils.lerp(a[0],b[0],(j+.5)/2),cz=THREE.MathUtils.lerp(a[1],b[1],(j+.5)/2),pts=[];
        for(let k=0;k<=16;k++){const t=k*Math.PI/8;pts.push(new THREE.Vector3(cx+tangent.x*Math.cos(t)*len*.17,base+.7+Math.sin(t)*.30,cz+tangent.z*Math.cos(t)*len*.17));}
        collect(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),20,.012,5,false),materials.iron);
      }
    }
  }
  function post(x,z,base,stone){
    if(stone){box(x,base+.68,z,.30,1.20,.30,materials.bank);box(x,base+1.31,z,.40,.12,.40,materials.coping);}
    else {rod(x,base+.77,z,.035,1.40);instance(tipGeo,materials.iron,[x,base+1.52,z],[.065,.16,.065]);}
  }
  const low=subdivide(uPath(29),1.75);
  for(let i=1;i<low.length;i++)if(!inApproach(low[i-1],low[i])){
    railPanel(low[i-1],low[i],.08,false);post(...[low[i-1][0],low[i-1][1],.08,false]);
    if(i===low.length-1||inApproach(low[i],low[Math.min(i+1,low.length-1)]))post(low[i][0],low[i][1],.08,false);
  }
  // Short contextual stretches, not a populated city or a speculative garden fence.
  for(const path of [westEdge.filter(p=>Math.abs(p[1])<=35),[[oppositeBankX,-65],[oppositeBankX,65]],[[-22,-65],[-22,-35]],[[-22,35],[-22,65]]]){
    const panels=subdivide(path,2.15);
    for(let i=1;i<panels.length;i++){railPanel(panels[i-1],panels[i],.24,true);post(panels[i-1][0],panels[i-1][1],.24,i%3===1);}
    post(panels.at(-1)[0],panels.at(-1)[1],.24,true);
  }
  function lamp(x,z){
    box(x,.16,z,.58,.16,.58,materials.coping);rod(x,.38,z,.17,.40);rod(x,1.93,z,.063,2.85);
    for(const y of [.62,2.92,3.15])rod(x,y,z,.10,.08);
    box(x,3.43,z,.30,.53,.30,materials.lantern);
    for(const dx of [-.17,.17])for(const dz of [-.17,.17])box(x+dx,3.43,z+dz,.025,.60,.025,materials.iron);
    box(x,3.14,z,.43,.08,.43,materials.iron);
    instance(tipGeo,materials.iron,[x,3.87,z],[.34,.32,.34]);rod(x,4.08,z,.035,.16);
  }
  for(const p of [[-28.5,-23],[-28.5,23],[-23,-43],[-23,43],[-8,-29.7],[-8,29.7],[29.5,-23],[29.5,23],[40,7]])lamp(...p);

  for(const [material,parts]of batches){const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());
    if(!geometry)throw new Error('Setting geometry merge failed.');geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,material);mesh.name=material.name;mesh.receiveShadow=true;mesh.castShadow=material!==materials.water;group.add(mesh);}
  for(const [geometry,byMaterial]of instances)for(const [material,matrices]of byMaterial){
    const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
    mesh.name=material.name+' / repeated setting components';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
  const time={value:0};
  materials.water.onBeforeCompile=shader=>{
    shader.uniforms.settingTime=time;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vSettingXZ;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvSettingXZ=(modelMatrix*vec4(position,1.0)).xz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vSettingXZ; uniform float settingTime;')
      .replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
        vec2 p=vSettingXZ;
        // Four nonparallel wind-riffle components; slow spatial phase modulation
        // breaks long straight crests without a scrolling stripe texture.
        float w1=sin(dot(p,vec2(1.37,.83))+settingTime*.29+.55*sin(dot(p,vec2(.19,-.13))));
        float w2=sin(dot(p,vec2(-2.11,3.07))-settingTime*.41+.43*cos(dot(p,vec2(.11,.23))));
        float w3=sin(dot(p,vec2(5.73,1.61))+settingTime*.57+.38*sin(dot(p,vec2(-.31,.17))));
        float w4=sin(dot(p,vec2(-3.29,-7.19))-settingTime*.73+.31*cos(dot(p,vec2(.27,.09))));
        vec2 ripple=.0060*w1*vec2(.855,.518)+.0045*w2*vec2(-.567,.824)
                   +.0030*w3*vec2(.963,.271)+.0020*w4*vec2(-.416,-.909);
        normal=normalize(normal+mat3(viewMatrix)*vec3(ripple.x,0.0,ripple.y));`);
  };
  materials.water.customProgramCacheKey=()=> 'church-setting-water-v2-riffles';
  const notes=[
    'Reference: elements-porches-apses-roofs.md section 4 and saved A.Savin Spb_06-2017_img47 overhead (Free Art Licence). No photograph used as a texture.',
    'Ground0, church pavement+0.08m, water-1.35m, closed terrain down to-4.4m. Water level and depth are visual estimates.',
    'Inferred reference-fit canal: opposite bank x=-40, platform bank x=-31 (9m nominal span); ordinary east bank x=-22 (18m span), with 9m rounded projection. Research estimates 7.5–8.5m at the platform and 17–19m normally; coping reduces visible water width slightly. The previous x=-52 was inherited scene geometry, not a user-requested coordinate.',
    'Red bands and narrow U-shaped lawn/low rail follow overhead organization. Radius29m fits current x[-27,30],z[-24,24] church envelope rather than claiming surveyed radius22m.',
    'North/south approach gaps approximately x=-25..-13 at z±29; east access around z±4.2. Openings and all rail/lamp spacing are inferred for this preview.',
    'Simplified canal oval iron panels, spear posts and nine unlit/emissive-glass lamps; no invented elaborate Mikhailovsky Garden fence, figures, traffic or buildings.',
    'Water normal-only animation, no displacement or external reflections. Parent owns lighting/environment and calls update(dtSeconds). No renderer or camera state changed.',
  ];
  const unique=new Set();let uniqueTriangles=0,renderedTriangles=0;
  group.traverse(o=>{if(!o.isMesh)return;const n=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
    renderedTriangles+=n*(o.isInstancedMesh?o.count:1);if(!unique.has(o.geometry)){unique.add(o.geometry);uniqueTriangles+=n;}});
  group.userData={notes,uniqueTriangles,renderedTriangles,drawCalls:group.children.length,platformHeight:.08,waterHeight:-1.35,
    canal:{oppositeBankX,platformBankX:-31,ordinaryBankX:-22,platformSpan:9,ordinarySpan:18,inferred:true},
    churchEnvelope:{x:[-27,30],z:[-24,24]},approaches:{northSouthX:[-25,-13],northSouthZ:[-29,29],eastZ:[-4.2,4.2]}};
  return {group,materials,notes,update(dt){if(Number.isFinite(dt)&&dt>0)time.value=(time.value+Math.min(dt,.1))%10000;}};
}
