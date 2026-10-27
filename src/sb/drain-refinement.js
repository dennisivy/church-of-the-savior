import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Synchronous preview controller. Build after the detailed church is loaded.
 * Safe before or after metricUV conversion: cornice selection uses vertex bounds,
 * not BoxGeometry.type/parameters. Keep the original cornice as a separate mesh.
 * Optional materials.pipe overrides the original painted-pipe material.
 * Construction is detached; no base mesh, material, visibility or transform changes.
 */
export function refineDrainage(root, materials = {}) {
  if (!root?.isObject3D) throw new TypeError('refineDrainage requires a church Object3D root.');
  const addedGroup = new THREE.Group();
  addedGroup.name = 'Whole exterior / connected drainage heads';
  const notes = [
    'Preview only. Extends the four existing long-facade pipes; no new drain locations.',
    'Source: coverage-audit.md item 2; roofs.js createDrainpipes; main-body research downpipes.',
    'Cornice height and outer face are read from the existing main-body box, not fixed at 24 m.',
    'Constructor works before or after metricUV geometry conversion; the cornice must remain a separate cuboid mesh.',
    'Doglegs, collector proportions and outlet seating are visual estimates, not surveyed plumbing.',
    'Existing funnels remain as lower transition collars; no old geometry is hidden or replaced.',
    'No material inventory recommendations are applied automatically.',
  ];
  function relativeMatrix(object) {
    const chain = [];
    for (let p = object; p && p !== root; p = p.parent) chain.unshift(p);
    const result = new THREE.Matrix4();
    for (const p of chain) result.multiply(p.matrixAutoUpdate
      ? new THREE.Matrix4().compose(p.position, p.quaternion, p.scale) : p.matrix);
    return result;
  }
  const sources = [];
  root.traverse(o => { if (o.isMesh && o.name === 'Four facade downpipes and collars') sources.push(o); });
  if (sources.length !== 1) throw new Error('Expected one original four-pipe mesh; build drainage once the detailed church is loaded.');
  const source = sources[0], frame = relativeMatrix(source), inverse = frame.clone().invert();
  const material = materials.pipe ?? source.material;
  if (!material?.isMaterial) throw new TypeError('Drainage needs one shared pipe material.');
  // Select the site's continuous main-body cornice by geometry, excluding narrow
  // intermediate bands. Compute bounds without modifying source bounding boxes.
  const cornices = [];
  root.traverse(o => {
    const positions = o.geometry?.attributes?.position;
    if (!o.isMesh || o.isInstancedMesh || !positions) return;
    const transform = inverse.clone().multiply(relativeMatrix(o));
    const box = new THREE.Box3().setFromBufferAttribute(positions).applyMatrix4(transform);
    const size = box.getSize(new THREE.Vector3());
    if (size.x < 25 || size.z < 25 || size.y < .5 || size.y > 2 ||
      box.min.y <= 20 || box.max.y >= 27 || box.min.x >= -7.6 || box.max.x <= 6.4) return;
    // metricUV keeps the cuboid vertices, even when the geometry loses its type
    // and parameters. Reject broad roof/ornament batches with interior vertices.
    const vertex = new THREE.Vector3(), epsilon = 1e-4;
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(transform);
      for (const axis of ['x', 'y', 'z']) {
        if (Math.min(Math.abs(vertex[axis] - box.min[axis]), Math.abs(vertex[axis] - box.max[axis])) > epsilon) return;
      }
    }
    cornices.push(box);
  });
  if (cornices.length !== 1) throw new Error('Main-body cornice is missing or ambiguous; no guessed drainage height applied.');
  const cornice = cornices[0];
  if (cornice.min.y <= 22.1) throw new Error('Cornice leaves insufficient clearance above existing drainage heads.');
  const parts = [], routes = [];
  function put(g) {
    const flat = g.index ? g.toNonIndexed() : g;
    if (g !== flat) g.dispose(); flat.clearGroups(); parts.push(flat);
  }
  function segment(a, b, radius) {
    const d = b.clone().sub(a);
    const g = new THREE.CylinderGeometry(radius, radius, d.length(), 12);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    put(g.translate(...a.clone().add(b).multiplyScalar(.5).toArray()));
  }
  function collar(x, y, z, radius = .111) {
    put(new THREE.TorusGeometry(radius, .018, 6, 12).rotateX(Math.PI / 2).translate(x, y, z));
  }
  for (const sign of [-1, 1]) for (const x of [-7.6, 6.4]) {
    const oldZ = sign * 15.63;
    const edge = sign > 0 ? cornice.max.z : cornice.min.z;
    // 0.65 m clears the existing decorative arcature (which projects beyond
    // the plain cornice box). Head stays slightly below the cornice top.
    const outerZ = edge + sign * .65, lipY = cornice.max.y - .06;
    const neckY = lipY - .49, elbowLow = cornice.min.y - .65, elbowHigh = cornice.min.y - .28;
    const points = [new THREE.Vector3(x, 21.97, oldZ), new THREE.Vector3(x, elbowLow, oldZ),
      new THREE.Vector3(x, elbowHigh, outerZ), new THREE.Vector3(x, neckY + .04, outerZ)];
    for (let i = 1; i < points.length; i++) segment(points[i - 1], points[i], .095);
    // Small closed joint balls soften mitres without open TubeGeometry ends.
    for (const p of points.slice(1, -1)) put(new THREE.SphereGeometry(.098, 12, 8).translate(...p.toArray()));
    collar(x, 22.025, oldZ); collar(x, neckY - .12, outerZ);
    // Hollow collector, rolled lip and closed annular shell. Interior is metal;
    // there is no black card, invented grate or second material.
    const profile = [[.095, neckY], [.11, neckY + .08], [.23, lipY - .10], [.23, lipY],
      [.20, lipY], [.20, lipY - .10], [.075, neckY + .08], [.075, neckY], [.095, neckY]];
    put(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 16).translate(x, 0, outerZ));
    collar(x, lipY - .012, outerZ, .226);
    // Short cornice outlet terminates inside the collector; its wall end is
    // deliberately embedded .10 m into the existing cornice to avoid a gap.
    const inletY = lipY - .16;
    segment(new THREE.Vector3(x, inletY + .035, edge - sign * .10), new THREE.Vector3(x, inletY, outerZ), .085);
    put(new THREE.BoxGeometry(.25, .23, .07).translate(x, inletY + .035, edge + sign * .018));
    // Upper support sits above the highest window head; no window crosses it.
    put(new THREE.BoxGeometry(.065, .10, Math.abs(outerZ - edge)).translate(x, neckY - .12, (outerZ + edge) / 2));
    routes.push({ x, sign, existingHeadTop: 22.01, extensionStart: 21.97, corniceTop: cornice.max.y,
      corniceFace: edge, collectorTop: lipY + .006, collectorZ: outerZ, outletY: inletY,
      centerline: points.map(p => p.toArray()) });
  }
  const geometry = mergeGeometries(parts, false); parts.forEach(p => p.dispose());
  if (!geometry) throw new Error('Drainage merge failed.');
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Four drainage extensions, collectors and cornice outlets';
  mesh.castShadow = mesh.receiveShadow = true; mesh.layers.mask = source.layers.mask;
  addedGroup.add(mesh); addedGroup.matrix.copy(frame); addedGroup.matrixAutoUpdate = false;
  addedGroup.userData = { provisional: true, routes, triangles: geometry.attributes.position.count / 3,
    drawCalls: 1, source: source.name, notes: [...notes] };
  return {
    addedGroup, notes,
    apply() { if (addedGroup.parent !== root) root.add(addedGroup); addedGroup.visible = true; return addedGroup; },
    restore() { addedGroup.removeFromParent(); return addedGroup; },
  };
}
