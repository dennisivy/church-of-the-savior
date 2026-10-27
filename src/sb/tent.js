import * as T from 'three';

// Eight yellow/white tiled ridge bands described in the saved dome references.
// Tile count and band width are provisional, independently adjustable here.
export function createTentRidges({r0,r1,h0,h1,white}) {
  const group=new T.Group();
  const yellow=new T.MeshStandardMaterial({color:'#d5bb6e',roughness:.4,metalness:.05});
  const rows=28, length=Math.hypot(r0-r1,h1-h0)/rows;
  const geometry=new T.BoxGeometry(.22,length*.97,.12);
  const bands=[white,yellow].map((material,i)=>{
    const mesh=new T.InstancedMesh(geometry,material,8*rows/2);
    mesh.name=i?'Tent ochre ridge tiles':'Tent white ridge tiles';
    mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
  });
  const matrix=new T.Matrix4(), rotation=new T.Quaternion(), up=new T.Vector3(0,1,0),unit=new T.Vector3(1,1,1);
  const counters=[0,0];
  for(let side=0;side<8;side++) {
    const angle=side*Math.PI/4;
    const bottom=new T.Vector3(Math.sin(angle)*(r0+.06),h0,Math.cos(angle)*(r0+.06));
    const top=new T.Vector3(Math.sin(angle)*(r1+.06),h1,Math.cos(angle)*(r1+.06));
    rotation.setFromUnitVectors(up,top.clone().sub(bottom).normalize());
    for(let row=0;row<rows;row++) {
      matrix.compose(bottom.clone().lerp(top,(row+.5)/rows),rotation,unit);
      const k=row%2;bands[k].setMatrixAt(counters[k]++,matrix);
    }
  }
  for(const band of bands){band.instanceMatrix.needsUpdate=true;band.computeBoundingSphere();}
  return {group,yellow};
}
