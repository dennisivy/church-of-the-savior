import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const active = new WeakMap();
const near = (a, b) => Math.abs(a - b) < 1e-4;
const stripInstance = (name = '') => name.replace(/ \(shared instances\)$/, '');
const materialName = (m) => (m.name || '').replace(/\.\d+$/, '');

function isApseMesh(mesh) {
  for (let p = mesh.parent; p; p = p.parent) if (p.name === 'Glazed apse half-dome') return true;
  return false;
}

// These three otherwise unnamed meshes are the exact procedural lean-to roof
// signatures in site-sb.js. No position/colour heuristic selects arbitrary walls.
function isLeanTo(mesh) {
  const p = mesh.geometry?.parameters;
  return mesh.geometry?.type === 'CylinderGeometry' && p && near(p.thetaLength, Math.PI)
    && near(p.height, 1.9) && ((near(p.radiusTop, 8.8) && near(p.radiusBottom, 10.4))
      || (near(p.radiusTop, 4.4) && near(p.radiusBottom, 6.1)));
}

// Add local metric UVs to a private geometry clone, retaining index, groups,
// morph attributes, skin data and instance attributes. Never bake matrixWorld or
// instanceMatrix into geometry: the renderer continues to apply them once.
function withMetricUV(source) {
  const geometry = source.clone();
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = n ? Math.abs(n.getX(i)) : 0, ny = n ? Math.abs(n.getY(i)) : 1, nz = n ? Math.abs(n.getZ(i)) : 0;
    uv[2 * i] = nx > ny && nx > nz ? p.getZ(i) : p.getX(i);
    uv[2 * i + 1] = ny >= nx && ny >= nz ? p.getZ(i) : p.getY(i);
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

function scaleEdges(source) {
  // roofs.js makes every shield tile as five consecutive nonindexed fan faces.
  const p = source.getAttribute('position');
  if (source.index || !p || p.count % 15) return null;
  const positions = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let start = 0; start < p.count; start += 15) {
    c.fromBufferAttribute(p, start + 2);
    for (let k = 1; k < 5; k++) {
      const other = new THREE.Vector3().fromBufferAttribute(p, start + k * 3 + 2);
      if (other.distanceToSquared(c) > 1e-10) return null;
    }
    for (let k = 0; k < 5; k++) {
      a.fromBufferAttribute(p, start + k * 3); b.fromBufferAttribute(p, start + k * 3 + 1);
      // Only the two sloping lower edges of each shield, never every triangle.
      if (a.y >= c.y || b.y >= c.y) continue;
      const depth = Math.min(.014, a.length() * .003);
      const ai = a.clone().multiplyScalar(1 - depth / a.length());
      const bi = b.clone().multiplyScalar(1 - depth / b.length());
      for (const v of [a, ai, b, b, ai, bi]) positions.push(v.x, v.y, v.z);
    }
  }
  if (!positions.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
  return geo;
}

function leanToSeams(geometry) {
  const p = geometry.parameters, pieces = [], steps = p.radialSegments;
  const start = p.thetaStart, span = p.thetaLength, da = span / steps;
  // Follow the existing polygonal cylinder surface, not an ideal cone that can
  // sink under its facets. Seam positions align to the tessellation vertices.
  const point = (angle, t) => {
    const r = THREE.MathUtils.lerp(p.radiusBottom, p.radiusTop, t) + .018;
    return new THREE.Vector3(r * Math.sin(angle), (t - .5) * p.height + .014, r * Math.cos(angle));
  };
  for (let i = 1; i < steps; i++) {
    const angle = start + i * da;
    pieces.push(new THREE.TubeGeometry(new THREE.LineCurve3(point(angle, 0), point(angle, 1)), 1, .016, 4, false));
  }
  // Rolled eave follows the actual faceted half-circle rather than crossing it.
  const eave = new THREE.CurvePath();
  for (let i = 0; i < steps; i++) eave.add(new THREE.LineCurve3(point(start + i * da, 0), point(start + (i + 1) * da, 0)));
  pieces.push(new THREE.TubeGeometry(eave, steps * 2, .025, 5, false));
  const result = mergeGeometries(pieces, false);
  pieces.forEach((g) => g.dispose());
  return result;
}

/**
 * Synchronous, initially applied, reversible roof study. Call after loading and
 * instanceRepeatedParts(). `materials` is the resolved entranceMaterials object.
 * No texture loading, scene lighting changes, or mutation of supplied resources.
 * Repeated calls on the same root return the same controller (no double overlay).
 * restore() reinstates exact material/geometry identities and detaches additions.
 * apply() can be called again to refresh added geometry's transform snapshots.
 */
export function refineRoofs(root, materials = {}) {
  if (!root?.isObject3D) throw new TypeError('refineRoofs requires a THREE.Object3D');
  if (active.has(root)) { const controller = active.get(root); controller.apply(); return controller; }
  const addedGroup = new THREE.Group();
  addedGroup.name = 'SB reversible roof refinements';
  const notes = [
    'Reference-informed study: enamel on copper, glazed ceramic scales and sheet-metal seams; exact relief thickness and PBR values inferred.',
    'Dome identities, silhouettes, positions, patterns and original colours are unchanged; no dome geometry is replaced.',
    'Only ceramic roofs borrow the supplied stone normal map at 0.025 strength; no stone albedo, brick map, AO volume or masonry shader is transferred.',
    'Gold receives no masonry textures. NE yellow enamel remains enamel. Scene lighting and exposure are untouched.',
  ];
  const records = [], overlays = [], cache = new Map(), ownedGeometry = new Set(), ownedMaterials = new Set();
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) meshes.push(o); });
  const copper = new Set();
  for (const mesh of meshes) if (stripInstance(mesh.name) === 'Standing-seam roof ribs' || isLeanTo(mesh)) {
    for (const mat of [].concat(mesh.material)) copper.add(mat);
  }
  function role(mesh, m) {
    const name = materialName(m), objectName = stripInstance(mesh.name);
    if (/^sb-dome-(gold|goldSeam)$/.test(name)) return name.endsWith('goldSeam') ? 'goldSeam' : 'gold';
    if (/^sb-dome-(white|blue|green|olive|crossBlue|yellow)$/.test(name)) return 'enamel';
    if (isApseMesh(mesh) || /^Tent (white|ochre) ridge tiles$/.test(objectName)) return 'glaze';
    // Loader rewrites mesh names but retains this exact asset/material suffix.
    if (/^Blender porch \/ (blue|green|ochre|white)(\.\d+)?$/.test(objectName)) return 'glaze';
    if (copper.has(m) || /^Blender porch \/ copper(\.\d+)?$/.test(objectName)) return 'copper';
    // Central-stack 'green' and 'limestone' span both masonry and roof surfaces:
    // intentionally not reclassified globally. Dome gold stays separately scoped.
    return null;
  }
  function refined(original, kind, micro) {
    const key = `${original.uuid}/${kind}/${micro}`;
    if (cache.has(key)) return cache.get(key);
    const m = original.clone();
    // Three.Material.clone doesn't retain these function-valued custom hooks.
    m.onBeforeCompile = original.onBeforeCompile;
    m.customProgramCacheKey = original.customProgramCacheKey;
    m.name = `${original.name || kind} / roof refinement`;
    if (kind === 'gold' || kind === 'goldSeam') { m.metalness = .92; m.roughness = kind === 'gold' ? .29 : .43; }
    else if (kind === 'copper') { m.metalness = .32; m.roughness = .53; }
    else {
      m.metalness = .035; m.roughness = kind === 'enamel' ? .27 : .32;
      if (m.isMeshPhysicalMaterial) { m.clearcoat = .48; m.clearcoatRoughness = .24; }
      if (micro) { m.normalMap = materials.stone.normalMap; m.normalScale.set(.025, .025); }
    }
    m.needsUpdate = true; cache.set(key, m); ownedMaterials.add(m); return m;
  }
  function addOverlay(source, geometry, material, label) {
    if (!geometry) return;
    ownedGeometry.add(geometry);
    const mesh = source.isInstancedMesh
      ? new THREE.InstancedMesh(geometry, material, source.instanceMatrix.count)
      : new THREE.Mesh(geometry, material);
    mesh.name = label; mesh.matrixAutoUpdate = false;
    mesh.castShadow = source.castShadow; mesh.receiveShadow = source.receiveShadow;
    mesh.layers.mask = source.layers.mask; mesh.renderOrder = source.renderOrder;
    mesh.userData.reference = 'elements-porches-apses-roofs.md: glazed scales and vertical sheet seams';
    addedGroup.add(mesh); overlays.push({ source, mesh });
  }
  for (const mesh of meshes) {
    const originals = [].concat(mesh.material);
    let needsUV = false, changed = false;
    const next = originals.map((m) => {
      const kind = role(mesh, m);
      if (!kind || !m.isMeshStandardMaterial) return m;
      const micro = kind === 'glaze' && !m.normalMap && !m.map && !m.roughnessMap
        && !!materials.stone?.normalMap && materials.stone.normalMap.channel === 0;
      if (micro) needsUV = true;
      changed = true;
      return refined(m, kind, micro);
    });
    if (!changed) continue;
    const geometry = needsUV ? withMetricUV(mesh.geometry) : mesh.geometry;
    if (needsUV) ownedGeometry.add(geometry);
    records.push({ mesh, originalMaterial: mesh.material, originalGeometry: mesh.geometry,
      material: Array.isArray(mesh.material) ? next : next[0], geometry });
    if (isApseMesh(mesh) && !Array.isArray(mesh.material)) {
      const edge = scaleEdges(mesh.geometry);
      // Edge faces have no UVs; preserve colour/PBR but avoid textured artifacts.
      if (edge) addOverlay(mesh, edge, refined(originals[0], 'glaze', false), 'Apse scale lower edge thickness');
    }
    if (isLeanTo(mesh) && !Array.isArray(mesh.material)) {
      addOverlay(mesh, leanToSeams(mesh.geometry), next[0], 'Apse lean-to standing seams and rolled eave');
    }
  }
  let applied = false, disposed = false;
  function apply() {
    if (disposed) throw new Error('Roof refinement controller disposed');
    for (const r of records) { r.mesh.material = r.material; r.mesh.geometry = r.geometry; }
    if (addedGroup.parent !== root) root.add(addedGroup);
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert();
    for (const { source, mesh } of overlays) {
      mesh.matrix.multiplyMatrices(inverse, source.matrixWorld);
      mesh.visible = source.visible;
      for (let p = source.parent; p && p !== root; p = p.parent) mesh.visible &&= p.visible;
      if (source.isInstancedMesh) {
        mesh.count = source.count;
        mesh.instanceMatrix.copy(source.instanceMatrix); mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor = source.instanceColor?.clone() ?? null;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      }
    }
    addedGroup.updateMatrixWorld(true); applied = true;
    return controller;
  }
  function restore() {
    if (!applied) return controller;
    for (const r of records) { r.mesh.material = r.originalMaterial; r.mesh.geometry = r.originalGeometry; }
    addedGroup.removeFromParent(); applied = false;
    return controller;
  }
  notes.push(`Matched ${records.length} meshes; added ${overlays.length} batched edge/seam meshes. Unrecognised objects are left alone.`);
  notes.push('Overlay transforms/ancestor visibility/instance data are refreshed by apply(); call it after component transforms change. Root movement propagates normally. No per-frame hooks installed.');
  notes.push('Do not batch, replace or independently edit matched mesh materials while toggling this controller. Late-loaded objects require a new controller after dispose().');
  const controller = { restore, apply, addedGroup, notes,
    // Optional explicit cleanup after final restore; supplied maps are shared and
    // never disposed. A subsequent refineRoofs(root, materials) can capture anew.
    dispose() {
      if (disposed) return;
      restore(); ownedGeometry.forEach((g) => g.dispose()); ownedMaterials.forEach((m) => m.dispose());
      addedGroup.clear(); active.delete(root); disposed = true;
    },
  };
  active.set(root, controller);
  return apply();
}
