import * as T from 'three';
import {addGrime} from '../materials.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Provisional masonry scale. Surface detail is a small shared normal map;
// window reveals and stone surrounds are actual geometry.
let sharedWallMaterials;
export function createWallMaterials() {
  if(sharedWallMaterials)return sharedWallMaterials;
  const size=512, pixels=new Uint8Array(size*size*4), colour=new Uint8Array(size*size*4), rough=new Uint8Array(size*size*4);
  const hash=(x,y)=>{const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);};
  const grid=(x,y)=>{x=(x+size)%size;y=(y+size)%size;const row=Math.floor(y/64),u=(x+(row%2)*64)%size;return {row,col:Math.floor(u/128),edge:Math.min(u%128,128-u%128,y%64,64-y%64)};};
  const height=(x,y)=>{const {edge}=grid(x,y);return Math.min(1,edge/2.5)*.7+(hash(x,y)-.5)*.09;};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const n=new T.Vector3((height(x-1,y)-height(x+1,y))*.85,(height(x,y-1)-height(x,y+1))*.85,1).normalize(),i=(y*size+x)*4;
    pixels[i]=Math.round((n.x*.5+.5)*255);pixels[i+1]=Math.round((n.y*.5+.5)*255);pixels[i+2]=Math.round((n.z*.5+.5)*255);pixels[i+3]=255;
    const {row,col,edge}=grid(x,y),variation=(hash(col,row)-.5)*17+(hash(x,y)-.5)*7;
    const base=edge<1.4?[125,111,94]:[159,120,91];
    for(let c=0;c<3;c++){colour[i+c]=Math.round(base[c]+variation);rough[i+c]=Math.round(215+hash(x,y)*20);}
    colour[i+3]=rough[i+3]=255;
  }
  const make=(data,srgb=false)=>{const t=new T.DataTexture(data,size,size);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(1/1.08,1/.60);t.needsUpdate=true;t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;if(srgb)t.colorSpace=T.SRGBColorSpace;return t;};
  const normal=make(pixels),albedo=make(colour,true),roughness=make(rough);
  const brick=new T.MeshStandardMaterial({color:'#ffffff',map:albedo,roughness:.96,roughnessMap:roughness,normalMap:normal,normalScale:new T.Vector2(.65,.65)});
  brick.userData.normalMap=normal;
  addGrime(brick,{macro:.6,streaks:.22,ground:.3});
  return sharedWallMaterials={brick,stone:new T.MeshStandardMaterial({color:'#d9d3c4',roughness:.67}),glass:new T.MeshStandardMaterial({color:'#192c35',roughness:.24,metalness:.32}),frame:new T.MeshStandardMaterial({color:'#463e36',roughness:.6})};
}
function arch(w,sill,top) {
  const r=w/2,spring=top-r,p=new T.Shape();
  p.moveTo(-r,sill);p.lineTo(r,sill);p.lineTo(r,spring);p.absarc(0,spring,r,0,Math.PI,false);p.closePath();return p;
}
export function createMainWalls({u0,u1,v,h0,h1,materials,trim=true}) {
  const group=new T.Group(),buckets=new Map();
  const put=(geo,mat,matrix)=>{
    if(matrix)geo.applyMatrix4(matrix);const g=geo.index?geo.toNonIndexed():geo;
    if(g!==geo)geo.dispose();if(!buckets.has(mat))buckets.set(mat,[]);buckets.get(mat).push(g);
  };
  const box=(x,y,z,w,h,d,mat,matrix)=>put(new T.BoxGeometry(w,h,d).translate(x,y,z),mat,matrix);
  const thickness=.65;
  for(const side of [-1,1]){
    const frame=new T.Matrix4().makeRotationY(side===1?0:Math.PI);frame.setPosition(0,0,side*v);
    // Mirroring the north coordinates makes these match the south blockout.
    const left=side===1?u0:-u1,right=side===1?u1:-u0;
    const outline=new T.Shape();outline.moveTo(left,h0);outline.lineTo(right,h0);outline.lineTo(right,h1);outline.lineTo(left,h1);outline.closePath();
    for(const [sill,top] of [[8.6,11.9],[17.3,19.4]])for(const original of [-11,-3.6,-.7,2.2,9.3]){
      const x=original*side,w=1.2,window=arch(w,sill,top);
      const points=window.getPoints(24).map(p=>new T.Vector2(p.x+x,p.y));
      outline.holes.push(new T.Path(points));
      put(new T.ShapeGeometry(window,24).translate(x,0,-thickness-.015),materials.glass,frame);
      // Narrow timber/metal mullion, horizontal transoms and stone sill.
      box(x,(sill+top-.6)/2,-thickness+.03,.055,top-.6-sill,.08,materials.frame,frame);
      for(const y of [sill+.15,sill+(top-sill)*.52])box(x,y,-thickness+.035,w,.06,.08,materials.frame,frame);
      if (trim) {
      box(x,sill-.10,.09,w+.48,.20,.5,materials.stone,frame);
      for(const dx of [-1,1])box(x+dx*(w/2+.115),(sill+top-.6)/2,.065,.15,top-.6-sill,.19,materials.stone,frame);
      const ring=new T.Shape();ring.absarc(0,top-w/2,w/2+.20,0,Math.PI,false);ring.absarc(0,top-w/2,w/2+.045,Math.PI,0,true);ring.closePath();
      put(new T.ExtrudeGeometry(ring,{depth:.18,bevelEnabled:false,curveSegments:24}).translate(x,0,-.02),materials.stone,frame);
      }
    }
    put(new T.ExtrudeGeometry(outline,{depth:thickness,bevelEnabled:false,curveSegments:24}).translate(0,0,-thickness),materials.brick,frame);
  }
  // East/west and caps close the wall shell, including its inner top edge.
  // Upper return windows are visible beside the apses and behind the porches.
  // Their positions remain photo estimates. Planar metre UVs avoid stretching
  // a single small brick texture over the entire thirty-metre end wall.
  for(const sign of [-1,1]){
    const frame=new T.Matrix4().makeRotationY(sign*Math.PI/2);frame.setPosition(sign>0?u1:u0,0,0);
    const face=new T.Shape();face.moveTo(-v,h0);face.lineTo(v,h0);face.lineTo(v,h1);face.lineTo(-v,h1);face.closePath();
    for(const x of [-10.6,10.6]){
      const sill=17.25,top=20.1,w=1.35,opening=arch(w,sill,top);
      face.holes.push(new T.Path(opening.getPoints(24).map(p=>new T.Vector2(p.x+x,p.y))));
      put(new T.ShapeGeometry(opening,24).translate(x,0,-thickness-.015),materials.glass,frame);
      box(x,(sill+top-.675)/2,-thickness+.035,.06,top-sill-.675,.07,materials.frame,frame);
      for(const y of [17.5,18.65])box(x,y,-thickness+.035,w,.06,.07,materials.frame,frame);
      const ring=arch(w+.45,sill-.15,top+.225);ring.holes.push(new T.Path(opening.getPoints(24)));
      put(new T.ExtrudeGeometry(ring,{depth:.23,bevelEnabled:false,curveSegments:20}).translate(x,0,-.02),materials.stone,frame);
      box(x,sill-.20,.13,w+.75,.22,.5,materials.stone,frame);
      for(const dx of [-1,1]){
        put(new T.CylinderGeometry(.13,.17,top-sill-.7,10).translate(x+dx*(w/2+.4),(top+sill-.7)/2,.19),materials.stone,frame);
        box(x+dx*(w/2+.4),sill+.07,.16,.45,.3,.45,materials.stone,frame);
        box(x+dx*(w/2+.4),top-.7,.16,.45,.3,.45,materials.stone,frame);
      }
    }
    put(new T.ExtrudeGeometry(face,{depth:thickness,bevelEnabled:false,curveSegments:24}).translate(0,0,-thickness),materials.brick,frame);
    for(const y of [h1-.16,h1-.45])box(0,y,.12,2*v,.15,.35,materials.stone,frame);
    for(let x=-v+.3;x<v;x+=.6)box(x,h1-.7,.09,.22,.22,.25,materials.stone,frame);
  }
  for(const y of [h0+.03,h1-.03])box((u0+u1)/2,y,0,u1-u0,.06,2*v,materials.brick);
  for(const [mat,geos] of buckets){
    const geometry=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());
    const mesh=new T.Mesh(geometry,mat);mesh.name=mat===materials.brick?'Masonry with recessed openings':mat===materials.stone?'Arched window surrounds':mat===materials.glass?'Recessed window glass':'Window mullions';
    mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  }
  group.userData.study='Window positions follow saved blockout with photo-estimated end-wall returns; surrounds are simplified.';
  return group;
}
