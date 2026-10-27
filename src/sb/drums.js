import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Flat, reusable material dictionary; no browser/canvas or random texture dependency. */
export function createDrumMaterials() {
  const material = (color, roughness, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  return {
    brick: material(0x8b5a3e, 0.88),
    buff: material(0xc2a06a, 0.86),
    stone: material(0xe1e1dc, 0.75),
    glass: material(0x142821, 0.27, 0.12), // Opaque backing seals every glazed opening.
    copper: material(0x607468, 0.65, 0.35),
  };
}

// Counterclockwise outline: straight jambs and a true semicircular head.
function arch(path, halfWidth, bottom, spring) {
  path.moveTo(-halfWidth, bottom);
  path.lineTo(halfWidth, bottom);
  path.lineTo(halfWidth, spring);
  path.absarc(0, spring, halfWidth, 0, Math.PI, false);
  path.lineTo(-halfWidth, bottom);
  path.closePath();
  return path;
}

/**
 * Metres; radius is the wall polygon's circumradius, as in site-sb.js cylinders.
 * Returns a Group centered on X/Z, with all geometry in local y = 0..height.
 * Corner uses sides (default 16; use 12 for the research-estimated arcade).
 * Lantern and central always use eight faces. Materials, if supplied, must be
 * the complete flat { brick, buff, stone, glass, copper } material dictionary.
 */
export function createDrum({ radius, height, sides = 16, kind = 'corner', materials } = {}) {
  if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(height) || height <= 0)
    throw new RangeError('Drum radius and height must be finite positive metres.');
  if (!['corner', 'lantern', 'central'].includes(kind)) throw new RangeError('Unknown drum kind.');
  if (!Number.isInteger(sides) || sides < 4 || sides > 128 || (kind === 'corner' && sides % 2))
    throw new RangeError('Drum sides must be an integer 4..128, even for alternating corner bays.');
  const mats = materials ?? createDrumMaterials();
  for (const key of ['brick', 'buff', 'stone', 'glass', 'copper'])
    if (!mats[key]?.isMaterial) throw new TypeError(`Missing drum material: ${key}`);

  const count = kind === 'corner' ? sides : 8;
  const angle = Math.PI / count;
  const apothem = radius * Math.cos(angle);
  const faceWidth = 2 * radius * Math.sin(angle);
  // Full-size site drums use .24 m. Small maquettes scale down to avoid inversion.
  const depth = Math.min(0.24, apothem * 0.2, height * 0.1);
  const trim = Math.min(faceWidth * 0.085, height * 0.025, 0.17);
  const halfWindow = Math.min(faceWidth * (kind === 'central' ? 0.18 : 0.21), height * 0.13);
  const bottom = height * (kind === 'central' ? 0.28 : 0.2);
  const spring = height * (kind === 'central' ? 0.79 : 0.73) - halfWindow;
  const wallKey = kind === 'lantern' ? 'buff' : 'brick';
  const group = new THREE.Group();
  group.name = `sb-drum-${kind}`;
  const batches = new Map();
  // Merge by actual material identity, including repeated moldings/brackets.
  function collect(geometry, key, rotation = 0) {
    geometry.rotateY(rotation);
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    flat.clearGroups();
    const material = mats[key];
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(flat);
  }
  function block(w, h, d, x, y, z, key, rotation) {
    collect(new THREE.BoxGeometry(w, h, d).translate(x, y, z), key, rotation);
  }
  function extrude(shape, thickness) {
    return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 12 });
  }
  function band(r, y0, y1, key) {
    collect(new THREE.CylinderGeometry(r, r, y1 - y0, count, 1, false)
      .translate(0, (y0 + y1) / 2, 0), key);
  }

  for (let i = 0; i < count; i++) {
    // Align faces with the CylinderGeometry vertex convention used by the site.
    const rotation = (i + 0.5) * 2 * angle;
    const glazed = kind !== 'corner' || i % 2 === 0;
    const face = new THREE.Shape();
    face.moveTo(-faceWidth / 2, 0);
    face.lineTo(faceWidth / 2, 0);
    face.lineTo(faceWidth / 2, height);
    face.lineTo(-faceWidth / 2, height);
    face.closePath();
    face.holes.push(arch(new THREE.Path(), halfWindow, bottom, spring));
    // Extrusion generates the inward jambs, arch soffit and bottom reveal as
    // well as front/back wall faces. Adjacent extrusions overlap behind seams.
    collect(extrude(face, depth).translate(0, 0, apothem - depth), wallKey, rotation);

    // A solid arch-shaped back meets the reveal exactly; blind bays are brick.
    const backingThickness = depth * 0.08;
    collect(extrude(arch(new THREE.Shape(), halfWindow, bottom, spring), backingThickness)
      .translate(0, 0, apothem - depth - backingThickness), glazed ? 'glass' : wallKey, rotation);

    // Projecting stone arch and jambs form a volumetric ring, not a decal.
    const molding = arch(new THREE.Shape(), halfWindow + trim, bottom - trim, spring);
    molding.holes.push(arch(new THREE.Path(), halfWindow, bottom, spring));
    collect(extrude(molding, trim * 0.85).translate(0, 0, apothem - trim * 0.1), kind === 'lantern' ? 'buff' : 'stone', rotation);
    // A second shallow outer brick ring distinguishes the buff lantern arches.
    if (kind === 'lantern') {
      const outer = arch(new THREE.Shape(), halfWindow + 2 * trim, bottom - 2 * trim, spring);
      outer.holes.push(arch(new THREE.Path(), halfWindow + trim, bottom - trim, spring));
      collect(extrude(outer, trim * 0.4).translate(0, 0, apothem), 'buff', rotation);
    }
    block(2 * halfWindow + 3 * trim, trim, depth + 2 * trim, 0,
      bottom - trim / 2, apothem - depth / 2 + trim, 'stone', rotation);

    // Small corbels in two tiers below the continuous projecting cornice.
    for (const x of [-faceWidth * 0.32, 0, faceWidth * 0.32]) {
      block(trim * 1.1, height * 0.027, trim * 1.6, x, height * 0.89,
        apothem + trim * 0.4, 'stone', rotation);
      block(trim * 0.8, height * 0.023, trim * 1.1, x, height * 0.864,
        apothem + trim * 0.2, 'stone', rotation);
    }
    // Pendant corner brackets; these remain deliberately simplified carvings.
    block(trim * 1.6, height * 0.035, trim * 1.5, faceWidth * 0.46,
      height * 0.76, apothem, 'stone', rotation);
    collect(new THREE.ConeGeometry(trim * 0.65, height * 0.035, 4)
      .rotateZ(Math.PI).translate(faceWidth * 0.46, height * 0.725, apothem), 'stone', rotation);
  }

  // Closed shallow polygon slabs, never a solid cylinder behind the openings.
  band(radius, 0, height * 0.035, wallKey);
  band(radius + trim * 0.3, height * 0.91, height * 0.94, 'stone');
  band(radius + trim, height * 0.94, height * 0.975, 'stone');
  band(radius + trim * 1.15, height * 0.975, height, 'copper');

  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries, false);
    for (const part of geometries) part.dispose();
    if (!geometry) throw new Error('Unable to merge drum geometry.');
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${group.name}-${Object.keys(mats).find(key => mats[key] === material)}`;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.userData = {
    kind, radius, height, sides: count, requestedSides: sides,
    radiusConvention: 'wall polygon circumradius; cornice projects beyond radius',
    windowCount: kind === 'corner' ? count / 2 : 8,
    blindArchCount: kind === 'corner' ? count / 2 : 0,
    insetDepth: depth, provisional: true,
    source: 'spilled-blood/research/elements-domes.md, sections 1 and 6; src/site-sb.js',
    uncertainty: [
      'Window widths, vertical positions, wall depth and ornamental profiles are provisional, not surveyed.',
      'Corner research estimates 12 arches / 6 windows; caller-controlled sides defaults to 16 / 8 windows.',
      'Corner cylindrical masonry is approximated by planar polygon faces.',
      'Central keel kokoshniks, corner baluster columns, sawtooth friezes and lantern base kokoshniks are not reconstructed here.',
      'Lantern uses double buff brick rings; central/corner stone molding profiles remain simplified.',
    ],
  };
  return group;
}
