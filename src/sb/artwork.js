import * as T from 'three';
// These are isolated mosaics, never full-wall photograph textures.
export async function createArtwork() {
 const metadata=await fetch('assets/spilled-blood/artwork/mapping.json').then(r=>r.json());
 const southwest=await fetch('assets/spilled-blood/porch-southwest/metadata.json').then(r=>{if(!r.ok)throw new Error('South-west porch metadata missing');return r.json();});
 metadata.panels.push({...southwest,path:`assets/spilled-blood/porch-southwest/${southwest.output}`});
 const group=new T.Group(),materials={},assets=[];
 const improved=metadata.panels.some(p=>p.id==='improvednorth-porch-front');
 await Promise.all(metadata.panels.filter(p=>!(improved&&p.id==='north-porch-front')).map(async p=>{
  const path=p.path||`assets/spilled-blood/artwork/${p.output}`,map=await new T.TextureLoader().loadAsync(path);map.colorSpace=T.SRGBColorSpace;
  const material=new T.MeshStandardMaterial({map,roughness:.87,metalness:0,alphaTest:.35,side:T.DoubleSide});materials[p.id]=material;assets.push({path,texture:map});
  let width,height,x,y,z,north=p.id.includes('north');
  if(p.id.includes('great-gable')) {
   const [a,b,lo,hi]=p.plane_bounds_u_h;width=b-a;height=hi-lo;x=(a+b)/2;y=(hi+lo)/2;z=north?-15.46:15.46;
  } else { height=3.15;width=Math.min(4.5,height*p.output_size[0]/p.output_size[1]);x=-19.25;y=7.7;z=north?-21.365:21.365; }
  const mesh=new T.Mesh(new T.PlaneGeometry(width,height),material);mesh.name=`Licensed mosaic: ${p.id}`;mesh.position.set(x,y,z);if(north)mesh.rotation.y=Math.PI;
  if(p.id==='north-west-porch'){mesh.position.set(-24.365,7.7,-16.25);mesh.rotation.y=-Math.PI/2;}
  if(p.id==='south-west-porch'){mesh.position.set(-24.365,7.7,16.25);mesh.rotation.y=-Math.PI/2;}
  mesh.receiveShadow=true;mesh.userData.credit=p.credit;group.add(mesh);
 }));
 return {group,materials,assets,metadata};
}
