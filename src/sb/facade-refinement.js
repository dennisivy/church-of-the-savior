import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Additive, synchronous detail for the current site-sb main-body coordinates.
 * Pass the resolved entranceMaterials() dictionary (stone and granite required).
 * Construction is detached; apply/restore attach/detach only addedGroup.
 * Coordinates are metres in root-local church space; no existing mesh is edited.
 */
export function refineFacades(root, materials) {
  if (!root?.isObject3D) throw new TypeError('refineFacades requires a THREE.Object3D root.');
  for (const key of ['stone', 'granite']) {
    if (!materials?.[key]?.isMaterial) throw new TypeError(`Missing entrance material: ${key}`);
  }
  const addedGroup = new THREE.Group();
  addedGroup.name = 'Whole exterior / modest facade profile refinement';
  const batches = new Map();
  const openings = [];
  const notes = [
    'Provisional profiles: reference-informed, not surveyed. Current site-sb coordinates are fixed.',
    'Twenty north/south windows: narrow inner stone fillets, retaining existing Blender jambs and hoods.',
    'Eight north/south granite base arches: two shallow face courses and spring blocks outside existing recesses.',
    'Two east return windows: inner fillets plus two small sill brackets each. East window count remains inferred.',
    'Existing curved apse arcades already have layered trim; no duplicate arcades or new bays are added.',
    'No bell-tower work: its existing Blender ornament, mosaics and uncertain heights are retained.',
    'No footprint, glass, opening, roof, portrait, inscription, porch or material changes.',
  ];
  function put(geometry, material, matrix) {
    geometry.applyMatrix4(matrix);
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.clearGroups();
    // Metric planar UVs on each triangle, including the moulding end surfaces.
    // Do not import entrance-materials.js: that module has asynchronous fetches.
    const p = g.attributes.position, uv = new Float32Array(p.count * 2);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      const normal = b.sub(a).cross(c.sub(a));
      const axis = Math.abs(normal.y) > Math.max(Math.abs(normal.x), Math.abs(normal.z)) ? 'y'
        : Math.abs(normal.x) > Math.abs(normal.z) ? 'x' : 'z';
      for (let k = i; k < i + 3; k++) {
        uv[k * 2] = axis === 'x' ? p.getZ(k) : p.getX(k);
        uv[k * 2 + 1] = axis === 'y' ? p.getZ(k) : p.getY(k);
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(g);
  }
  function box(x, y, z, w, h, d, material, matrix) {
    put(new THREE.BoxGeometry(w, h, d).translate(x, y, z), material, matrix);
  }
  // A U-shaped solid arch/jamb molding. No bottom rail crosses the opening.
  // Both arcs share the original spring: clearance is maintained at the head.
  function molding(x, sill, spring, inner, outer, back, depth, material, matrix) {
    const s = new THREE.Shape();
    s.moveTo(x - outer, sill); s.lineTo(x - outer, spring);
    s.absarc(x, spring, outer, Math.PI, 0, true);
    s.lineTo(x + outer, sill); s.lineTo(x + inner, sill);
    s.lineTo(x + inner, spring); s.absarc(x, spring, inner, 0, Math.PI, false);
    s.lineTo(x - inner, sill); s.closePath();
    put(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 24 })
      .translate(0, 0, back), material, matrix);
  }
  function window(x, sill, top, r, matrix, east = false) {
    const spring = top - r;
    // Small clearance also protects the arched opening against chord error.
    // On N/S, outer edge .660 stays inside the existing voussoir radius .670.
    const back = east ? .205 : -.025;
    molding(x, sill, spring, r + .018, r + .060, back, east ? .075 : .13, materials.stone, matrix);
    molding(x, sill, spring, r + .029, r + .049, back + (east ? .075 : .13), .025, materials.stone, matrix);
    if (east) {
      // The existing sill bottom is 17.14: bracket tops meet it exactly.
      for (const dx of [-.61, .61]) {
        box(x + dx, sill - .17, .205, .20, .12, .33, materials.stone, matrix);
        box(x + dx, sill - .30, .16, .13, .14, .22, materials.stone, matrix);
      }
    }
    openings.push({ kind: 'window', x, sill, spring, radius: r, matrix: matrix.toArray() });
  }
  for (const sign of [-1, 1]) {
    const matrix = new THREE.Matrix4().makeRotationY(sign < 0 ? Math.PI : 0);
    matrix.setPosition(0, 0, sign * 15);
    for (const [sill, top] of [[8.6, 11.9], [17.3, 19.4]]) {
      // Match facades.js world x positions on both sides, not a rotated copy.
      for (const x of [-11, -3.6, -.7, 2.2, 9.3]) window(sign * x, sill, top, .6, matrix);
    }
    const base = matrix.clone().setPosition(0, 0, sign * 15.3);
    for (const worldX of [-11, -3.9, 2.3, 9.3]) {
      const x = sign * worldX;
      // Existing arch: half-width 1.95, sill .9, spring 3.55; front .20.
      // Added courses overlap the original stone, never the recessed field.
      molding(x, .90, 3.55, 1.975, 2.065, .185, .070, materials.granite, base);
      molding(x, .90, 3.55, 2.000, 2.040, .255, .035, materials.granite, base);
      for (const dx of [-2.035, 2.035]) {
        box(x + dx, 3.55, .245, .15, .12, .13, materials.granite, base);
      }
      openings.push({ kind: 'blind-base-arch', x, sill: .9, spring: 3.55, radius: 1.95, matrix: base.toArray() });
    }
  }
  const east = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  east.setPosition(14.4, 0, 0);
  for (const x of [-10.6, 10.6]) window(x, 17.25, 20.1, .675, east, true);

  let triangles = 0;
  for (const [material, parts] of batches) {
    const geometry = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    if (!geometry) throw new Error('Facade refinement geometry merge failed.');
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    triangles += geometry.attributes.position.count / 3;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Facade profiles / ${material === materials.granite ? 'granite arcade' : 'stone windows'}`;
    mesh.castShadow = mesh.receiveShadow = true;
    addedGroup.add(mesh);
  }
  addedGroup.userData = {
    provisional: true, triangles, drawCalls: addedGroup.children.length,
    openings, groundFootprintChanged: false, minimumHeight: .9,
    sources: ['research/elements-main-body.md sections 2a–2c, 3, 4', 'research/elements-bell-tower.md'],
    notes: [...notes],
  };
  return {
    addedGroup, notes,
    apply() { if (addedGroup.parent !== root) root.add(addedGroup); addedGroup.visible = true; return addedGroup; },
    restore() { addedGroup.removeFromParent(); return addedGroup; },
  };
}
