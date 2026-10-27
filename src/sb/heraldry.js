import * as THREE from 'three';

/** Individually sourced heraldry and masked north/west shrine icons, in bell-local glTF coordinates.
 * Parent: group.position.x = bell.u; add group once beside the bell-tower GLB.
 * Nothing is repeated or projected onto unsupported faces. Rejects failed loads.
 */
export async function createHeraldry() {
  const base = 'assets/spilled-blood/heraldry/';
  const response = await fetch(`${base}mapping.json`);
  if (!response.ok) throw new Error(`Heraldry metadata: HTTP ${response.status}`);
  const metadata = await response.json();
  const group = new THREE.Group();
  group.name = 'Photo-supported bell-tower heraldry and icons';
  group.userData.credit = metadata.source;
  group.userData.coordinates = metadata.coordinates;
  const materials = {}, assets = [];
  const loader = new THREE.TextureLoader();
  // Sequential loading keeps manifest/draw order deterministic and makes
  // cleanup on failure complete (no pending asynchronous textures remain).
  try {
    for (const panel of metadata.panels) {
      const path = `${base}${panel.file}`;
      const texture = await loader.loadAsync(path);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      const credit = panel.credit ?? metadata.source;
      assets.push({ path, texture, credit, id: panel.id });
      const material = new THREE.MeshStandardMaterial({
        map: texture, roughness: 0.88, metalness: 0,
        side: THREE.FrontSide, alphaTest: panel.alpha_test ?? 0,
      });
      materials[panel.id] = material;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(panel.width_m, panel.height_m), material,
      );
      mesh.name = `Photographed heraldic tile: ${panel.id}`;
      mesh.position.fromArray(panel.position_local);
      mesh.rotation.y = panel.rotation_y_radians;
      mesh.receiveShadow = true;
      mesh.userData = { credit, placement: panel };
      group.add(mesh);
    }
  } catch (error) {
    for (const mesh of group.children) mesh.geometry.dispose();
    for (const material of Object.values(materials)) material.dispose();
    for (const asset of assets) asset.texture.dispose();
    throw error;
  }
  return { group, materials, assets };
}
