import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {metricUV} from './entrance-materials.js';
// Reference: user-supplied entrance photograph, 26 Oct 2026. Large dressed
// borders surround rough-faced stone; dimensions fitted to existing model.
export function rusticatedBase(root,M){
 const group=new T.Group();group.name='Reference study / rough-faced lower stone courses';
 const mat=M.granite.clone();mat.name='Warm grey dressed and rock-faced base stone';mat.onBeforeCompile=M.granite.onBeforeCompile;mat.customProgramCacheKey=M.granite.customProgramCacheKey;
 mat.normalMap=M.granite.normalMap;mat.normalScale=new T.Vector2(.72,.72);mat.roughnessMap=M.granite.roughnessMap;mat.roughness=.96;mat.vertexColors=true;mat.flatShading=true;mat.color.setRGB(1.55,1.48,1.34);
 const backing=[];const dressed=M.granite.clone();dressed.name='Dressed warm grey base stone';dressed.onBeforeCompile=M.granite.onBeforeCompile;dressed.customProgramCacheKey=M.granite.customProgramCacheKey;dressed.color.setRGB(1.25,1.21,1.12);dressed.normalScale.set(.38,.38);root.traverse(o=>{if(o.isMesh&&o.name==='Granite arcade and courses')backing.push({o,old:o.material});});
 const pieces=[];let blocks=0;
 const hash=(x,y,s)=>{const q=Math.sin(x*127.1+y*311.7+s*73.31)*43758.5453;return q-Math.floor(q);};
 function block(x0,x1,y0,y1,z,side,seed){
  const w=x1-x0,h=y1-y0;if(w<.12)return;
  const axis=L=>{const a=[0,.018,.04,.052];for(let p=.083;p<L-.07;p+=.045)a.push(p);a.push(L-.052,L-.04,L-.018,L);return a.filter((x,i,b)=>x>=0&&x<=L&&(i===0||x>b[i-1]));};const xs=axis(w),ys=axis(h),nx=xs.length-1,ny=ys.length-1,positions=[],uv=[],colors=[],indices=[];
  const shade=.90+hash(seed,3,8)*.10;
  // A shallow bevel frames the irregular boss. The border remains dressed.
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
   let x=x0+xs[i],y=y0+ys[j];if(i>3&&i<nx-3)x+=(hash(i,j,seed+11)-.5)*.028;if(j>3&&j<ny-3)y+=(hash(i,j,seed+23)-.5)*.028;
   const edge=Math.min(x-x0,x1-x,y-y0,y1-y);
   const relief=edge<.018?.022*edge/.018:edge<.04?.022:.022+.038*Math.min(1,(edge-.04)/.012)+(hash(i,j,seed)-.5)*.009;
   positions.push(x,y,side*(z+.012+relief));uv.push(x,y);
   const c=shade*(edge<.035?1: .96+hash(i,j,seed+19)*.04);colors.push(c,c*.985,c*.96);
  }
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;const tris=hash(i,j,seed+7)>.5?[a,b,c,b,d,c]:[a,b,d,a,d,c];if(side<0)for(let k=0;k<6;k+=3)[tris[k+1],tris[k+2]]=[tris[k+2],tris[k+1]];indices.push(...tris);}
  const face=new T.BufferGeometry();face.setAttribute('position',new T.Float32BufferAttribute(positions,3));face.setAttribute('uv',new T.Float32BufferAttribute(uv,2));face.setAttribute('color',new T.Float32BufferAttribute(colors,3));face.setIndex(indices);face.computeVertexNormals();pieces.push(face.toNonIndexed());face.dispose();
  // Backing and side returns form a real solid border, not a floating plane.
  const box=new T.Mesh(new T.BoxGeometry(w,h,.024).translate((x0+x1)/2,(y0+y1)/2,side*(z+.012)),mat);const g=metricUV(box),cs=new Float32Array(g.attributes.position.count*3);for(let k=0;k<cs.length;k+=3){cs[k]=shade;cs[k+1]=shade*.985;cs[k+2]=shade*.96;}g.setAttribute('color',new T.BufferAttribute(cs,3));pieces.push(g);blocks++;
 }
 for(const side of[-1,1]){
  // Vertical reveals start at .75; don't cover plaques or either arch molding.
  for(let row=0;row<6;row++){
   const y0=.32+row*.53,y1=y0+.495;
   let spans=[[-16,14.7]];
   if(y1>.75)for(const cx of[-11,-3.9,2.3,9.3]){const next=[];for(const [a,b]of spans){if(b<=cx-2.13||a>=cx+2.13)next.push([a,b]);else{if(a<cx-2.13)next.push([a,cx-2.13]);if(b>cx+2.13)next.push([cx+2.13,b]);}}spans=next;}
   for(const [a,b]of spans){let x=a;const first=1.12+(row%2?-.47:0);let n=0;while(x<b-.02){const end=Math.min(b,x+(n++?1.12:first));block(x+.017,end-.017,y0,y1,15.3,side,row*101+n+Math.round(a*9));x=end;}}
  }
 }
 const geo=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());if(!geo.attributes.position.array.every(Number.isFinite))throw new Error('Nonfinite stone block coordinate');const mesh=new T.Mesh(geo,mat);mesh.name='Jointed dressed stone blocks with rough bosses';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
 group.userData={blocks,triangles:geo.attributes.position.count/3,reference:'User photograph 2026-10-26; course dimensions and tooling inferred, no memorial text invented'};
 return {group,material:mat,dressedMaterial:dressed,apply(){root.add(group);for(const r of backing)r.o.material=dressed;},restore(){group.removeFromParent();for(const r of backing)r.o.material=r.old;}};
}
