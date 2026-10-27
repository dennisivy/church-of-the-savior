import * as THREE from 'three';

const active = new WeakMap();
const near = (a, b) => Number.isFinite(a) && Math.abs(a - b) < 1e-5;

// Match only the explicit site-sb.js corner-base cylinders. Do not select by
// material (shared with walls) or world positions (caller owns placement).
function isCornerBase(mesh) {
  const p = mesh.geometry?.parameters;
  return mesh.isMesh && !mesh.isSkinnedMesh && mesh.geometry.type === 'CylinderGeometry'
    && p && near(p.radiusTop, 4.2) && near(p.radiusBottom, 4.2)
    && near(p.height, 3) && near(p.thetaStart, 0) && near(p.thetaLength, Math.PI * 2)
    && p.openEnded === false && p.radialSegments === 48;
}

// A closed section revolved around local Y, matching the existing 48-sided
// cylinder. These are continuous profiles, not a claim about ornamental counts.
function ring(profile) {
  const points = [...profile, profile[0]].map(([r, y]) => new THREE.Vector2(r, y));
  const geometry = new THREE.LatheGeometry(points, 48);
  // Metric UVs for the caller's stone maps. Profile arc length is the V axis;
  // horizontal ledges therefore keep a noncollapsed UV dimension too.
  const uv = geometry.getAttribute('uv'), accumulated = [0];
  for (let i = 1; i < points.length; i++) accumulated.push(accumulated[i - 1] + points[i].distanceTo(points[i - 1]));
  for (let i = 0; i < uv.count; i++) {
    const j = i % points.length;
    uv.setXY(i, uv.getX(i) * Math.PI * 2 * points[j].x, accumulated[j]);
  }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Preview-only, reversible corner-base seat and flashing; no invented gable ring.
 *
 * const control = refineCornerBases(root, {stone, copper?});
 * control.restore(); control.apply(); // initially applied; repeated call is safe
 *
 * `root` is the completed church root, after base assembly/instancing. Accepts the
 * entranceMaterials dictionary (`stone` required); copper is optional. Geometry
 * stays in each source cylinder's local space and uses its existing transforms.
 * Absolute site levels: base24, old top27; drum GLB27..37 stays untouched.
 * Only the matched plain cylinder's top is lowered .50m under a closed tapered
 * flashing collar. Its bottom, radius, original material and transform are kept.
 * The original geometry reference is restored exactly; never disposed here.
 * `addedGroup`, `notes`, apply/restore/dispose are exposed for parent integration.
 */
export function refineCornerBases(root, materials = {}) {
  if (!root?.isObject3D) throw new TypeError('refineCornerBases requires a THREE.Object3D root');
  if (!materials.stone?.isMaterial) throw new TypeError('Corner bases require materials.stone');
  if (materials.copper != null && !materials.copper.isMaterial) throw new TypeError('materials.copper must be a Three.js material');
  if (active.has(root)) { const controller = active.get(root); controller.apply(); return controller; }

  const notes = [
    'Fallback scope: continuous stone bed and copper flashing below existing corner drums; no new gables, angels, icons or inscriptions.',
    'Saved c15.jpg and south2023.jpg show layered bases/copper transitions, but not a reliable complete lower-gable count/orientation. Existing corner-drum GLB already has six gables at y27.3..28.86; they are untouched.',
    'Photographic sources: research/elements-domes.md section6; saved research-domes/c15.jpg (Gzen92, CC BY-SA4.0), c10.jpg; sb-photos/south2023.jpg; c-sw.jpg and c-nw.jpg for roof/flashing context.',
    'Profiles, .50m taper height and small projections are fitted to the current R4.2 base / R3.63 drum seat, not surveyed historic dimensions.',
    'No drum, dome, finial, window, facade, roof or source placement is changed. Maximum new radius4.29m; original base radius4.2m.',
    'Only exact closed R4.2/H3/48-segment full-cylinder signatures are matched. Changed base generators need an explicit adapter, not guessed replacement.',
    'Do not replace or rebatch matched base geometries while this controller is applied; restore first. apply() refreshes transforms and source visibility.',
  ];
  const addedGroup = new THREE.Group();addedGroup.name = 'Whole exterior / corner base seats and flashing';
  const sources = [];root.traverse(o => { if (isCornerBase(o)) sources.push(o); });
  const copper = materials.copper ?? new THREE.MeshStandardMaterial({
    name: 'Corner-base patinated copper flashing', color: 0x607468, roughness: .56, metalness: .32,
  });
  const ownedMaterial = materials.copper == null;
  // Local coordinates relative to the unchanged original y25.5 centre.
  // Base remains y24; closed cylinder now ends y26.5, beneath the sloping skirt.
  const geometryCache = new Map(), records = [], overlays = [], ownedGeometry = new Set();
  const profiles = sources.length ? [
    { name: 'lower stone weathering course', material: materials.stone, geometry: ring([
      [4.17, -1.48], [4.25, -1.48], [4.25, -1.43], [4.22, -1.38], [4.22, -1.32], [4.17, -1.32],
    ]) },
    { name: 'stepped seat under flashing', material: materials.stone, geometry: ring([
      [4.17, .76], [4.24, .76], [4.24, .84], [4.27, .88], [4.27, .93], [4.17, .93],
    ]) },
    { name: 'closed sloping copper skirt and drip', material: copper, geometry: ring([
      [4.20, .92], [4.29, .92], [4.29, 1.00], [4.24, 1.05],
      [3.70, 1.48], [3.70, 1.52], [3.56, 1.52], [3.56, 1.45], [4.20, .98],
    ]) },
  ] : [];
  for (const p of profiles) ownedGeometry.add(p.geometry);
  for (const source of sources) {
    const original = source.geometry;
    if (!geometryCache.has(original)) {
      const p = original.parameters;
      const replacement = new THREE.CylinderGeometry(4.2, 4.2, 2.5, p.radialSegments, p.heightSegments, false, 0, Math.PI * 2)
        .translate(0, -.25, 0);
      // Preserve the site's metre-scaled brick UV convention, not normalized
      // cylinder UVs stretched over the whole base after replacement.
      const uv = replacement.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 8.4, uv.getY(i) * 2.5);
      replacement.computeBoundingBox();replacement.computeBoundingSphere();
      geometryCache.set(original, replacement);ownedGeometry.add(replacement);
    }
    records.push({ source, original, replacement: geometryCache.get(original) });
    for (const profile of profiles) {
      const mesh = source.isInstancedMesh
        ? new THREE.InstancedMesh(profile.geometry, profile.material, source.instanceMatrix.count)
        : new THREE.Mesh(profile.geometry, profile.material);
      mesh.name = `Corner base / ${profile.name}`;mesh.matrixAutoUpdate = false;
      mesh.castShadow = source.castShadow;mesh.receiveShadow = source.receiveShadow;
      mesh.layers.mask = source.layers.mask;mesh.renderOrder = source.renderOrder;
      addedGroup.add(mesh);overlays.push({ source, mesh });
    }
  }
  const instanceCount = sources.reduce((n, source) => n + (source.isInstancedMesh ? source.count : 1), 0);
  notes.push(`Matched ${sources.length} source meshes / ${instanceCount} corner bases. Expected four in the current full site; unmatched geometry is left unchanged.`);
  addedGroup.userData = {
    provisional: true, gablesAdded: 0, figurativePanelsAdded: 0, baseCount: instanceCount,
    localHeightRange: [-1.48, 1.52], siteHeightRange: [24.02, 27.02], maximumRadius: 4.29,
    fit: { originalBaseRadius: 4.2, originalBaseHeight: 3, loweredBaseHeight: 2.5, existingDrumSeatRadius: 3.63 },
    notes: [...notes],
  };
  let applied = false, disposed = false;
  function refreshBounds(source) {
    if (source.isInstancedMesh) { source.computeBoundingBox();source.computeBoundingSphere(); }
  }
  function apply() {
    if (disposed) throw new Error('Corner base refinement controller disposed');
    for (const record of records) { record.source.geometry = record.replacement;refreshBounds(record.source); }
    if (addedGroup.parent !== root) root.add(addedGroup);
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert();
    for (const { source, mesh } of overlays) {
      mesh.matrix.multiplyMatrices(inverse, source.matrixWorld);
      mesh.visible = source.visible;
      for (let p = source.parent; p && p !== root; p = p.parent) mesh.visible &&= p.visible;
      if (source.isInstancedMesh) {
        mesh.count = source.count;mesh.instanceMatrix.copy(source.instanceMatrix);mesh.instanceMatrix.needsUpdate = true;
        // Source brick instance colours should not tint the new stone/copper.
        mesh.computeBoundingBox();mesh.computeBoundingSphere();
      }
    }
    addedGroup.updateMatrixWorld(true);applied = true;return controller;
  }
  function restore() {
    if (!applied) return controller;
    for (const record of records) { record.source.geometry = record.original;refreshBounds(record.source); }
    addedGroup.removeFromParent();applied = false;return controller;
  }
  const controller = { apply, restore, addedGroup, notes,
    dispose() {
      if (disposed) return;
      restore();for (const geometry of ownedGeometry) geometry.dispose();if (ownedMaterial) copper.dispose();
      addedGroup.clear();active.delete(root);disposed = true;
    },
  };
  active.set(root, controller);return apply();
}
