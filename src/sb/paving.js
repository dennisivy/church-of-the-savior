import * as T from 'three';
export function createPaving() {
 const size=256,data=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4);
 const noise=(x,y)=>{const a=Math.sin(x*127.1+y*311.7)*43758.5453;return a-Math.floor(a);};
 const edge=(x,y)=>{x=(x+256)%256;y=(y+256)%256;const row=Math.floor(y/64),u=(x+32*(row%2))%64,v=y%64;return Math.min(u,64-u,v,64-v);};
 const h=(x,y)=>Math.min(edge(x,y)/2,1)*.9+noise(x,y)*.08;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4,n=new T.Vector3((h(x-1,y)-h(x+1,y))*.7,(h(x,y-1)-h(x,y+1))*.7,1).normalize();
  const row=Math.floor(y/64),col=Math.floor((x+(row%2)*32)/64)%4,c=(edge(x,y)<1.2?95:145)+noise(col,row)*17+(noise(x,y)-.5)*13;
  data.set([c,c*.98,c*.94,255],i);normal.set([(n.x*.5+.5)*255,(n.y*.5+.5)*255,(n.z*.5+.5)*255,255],i);
 }
 const tex=(a,color)=>{const t=new T.DataTexture(a,size,size);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(70/3.2,54/2.4);t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.needsUpdate=true;if(color)t.colorSpace=T.SRGBColorSpace;return t;};
 return new T.MeshStandardMaterial({map:tex(data,true),normalMap:tex(normal,false),normalScale:new T.Vector2(.4,.4),roughness:.92});
}
