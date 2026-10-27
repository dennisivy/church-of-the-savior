import * as T from 'three';

// Repeated Blender parts share vertex buffers and become instanced draws.
// Mirrored parts retain ordinary meshes: negative instance scales are unsupported.
export function instanceRepeatedParts(root){
 root.updateMatrixWorld(true);const inverse=new T.Matrix4().copy(root.matrixWorld).invert(),buckets=new Map();
 root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material)||o.matrixWorld.determinant()<0||o.children.length)return;
  const key=o.geometry.uuid+'/'+o.material.uuid+'/'+o.castShadow+'/'+o.receiveShadow;
  if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);
 });
 let saved=0;
 for(const meshes of buckets.values()){
  if(meshes.length<2)continue;const first=meshes[0],batch=new T.InstancedMesh(first.geometry,first.material,meshes.length);
  batch.name=first.name+' (shared instances)';batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;
  meshes.forEach((o,i)=>{batch.setMatrixAt(i,new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));o.removeFromParent();});
  batch.instanceMatrix.needsUpdate=true;batch.computeBoundingBox();batch.computeBoundingSphere();root.add(batch);saved+=meshes.length-1;
 }
 root.userData.instancingDrawsSaved=saved;return saved;
}
