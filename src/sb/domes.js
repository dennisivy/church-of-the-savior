import * as THREE from 'three';

// Synchronous, self-contained exterior studies. Dimensions include the gilded neck,
// but not an orb or cross (the existing site caller supplies those separately).
// radius is the nominal envelope radius, including enamel relief. No world offset.
// Sources: spilled-blood/research/elements-domes.md and data/profiles/*.json.
// These deliberately smoothed controls are interpretations, not measured fits.
const TAU = Math.PI * 2;
const PROFILES = {
  C: [[0, .54], [.12, .59], [.28, .74], [.44, .94], [.60, 1], [.69, .94], [.77, .73], [.84, .38], [.89, .19], [.96, .065], [1, 0]],
  SW: [[0, .65], [.12, .85], [.29, 1], [.40, .98], [.53, .85], [.65, .60], [.76, .32], [.84, .17], [.94, .075], [1, 0]],
  NW: [[0, .62], [.13, .88], [.28, 1], [.40, .96], [.54, .80], [.67, .52], [.79, .26], [.87, .14], [.96, .05], [1, 0]],
  SE: [[0, .72], [.15, .92], [.32, 1], [.44, .96], [.57, .78], [.69, .48], [.79, .22], [.87, .12], [.96, .05], [1, 0]],
  NE: [[0, .66], [.16, .87], [.34, 1], [.47, .97], [.60, .80], [.71, .53], [.81, .25], [.88, .13], [.96, .05], [1, 0]],
  bell: [[0, .80], [.16, .91], [.37, 1], [.48, .97], [.59, .85], [.69, .61], [.77, .36], [.86, .20], [.94, .10], [1, 0]],
  apse: [[0, .67], [.17, .89], [.36, 1], [.50, .96], [.64, .77], [.76, .43], [.85, .18], [.94, .075], [1, 0]],
};
const NECK = { C: .87, SW: .83, NW: .85, SE: .83, NE: .85, bell: .88, apse: .84 };

/** Flat dictionary. Reuse one result across all domes; caller owns disposal. */
export function createDomeMaterials() {
  const enamel = (color) => new THREE.MeshPhysicalMaterial({ color, roughness: .29, metalness: .12, clearcoat: .42, clearcoatRoughness: .23 });
  const mats = {
    white: enamel(0xe8eaec), blue: enamel(0x1fa3cc), green: enamel(0x96b25c),
    olive: enamel(0x8a9d5e), crossBlue: enamel(0x3296ac), yellow: enamel(0xc09b42),
    gold: new THREE.MeshStandardMaterial({ color: 0xc09b50, metalness: .78, roughness: .32 }),
    goldSeam: new THREE.MeshStandardMaterial({ color: 0x846c38, metalness: .66, roughness: .46 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x21373c, metalness: .25, roughness: .48 }),
  };
  for (const [key, material] of Object.entries(mats)) material.name = `sb-dome-${key}`;
  return mats;
}
let sharedMaterials;

// Shape-preserving Hermite interpolation: avoids overshoots at the belly and
// avoids the scallops produced by easing every individual control interval.
function profileAt(points, t) {
  const slopes = points.slice(1).map((p, i) => (p[1] - points[i][1]) / (p[0] - points[i][0]));
  const tangent = (i) => {
    if (i === 0) return slopes[0];
    if (i === points.length - 1) return slopes[i - 1];
    const a = slopes[i - 1], b = slopes[i];
    return a * b <= 0 ? 0 : 2 * a * b / (a + b);
  };
  let i = 0;
  while (i < points.length - 2 && t > points[i + 1][0]) i++;
  const [x, y] = points[i], [xx, yy] = points[i + 1];
  const d = xx - x, u = Math.max(0, Math.min(1, (t - x) / d));
  return (2 * u ** 3 - 3 * u ** 2 + 1) * y + (u ** 3 - 2 * u ** 2 + u) * d * tangent(i)
    + (-2 * u ** 3 + 3 * u ** 2) * yy + (u ** 3 - u ** 2) * d * tangent(i + 1);
}

/**
 * createDome({ kind: 'C'|'SW'|'NW'|'SE'|'NE'|'bell'|'apse', height, radius, materials })
 * Returns a Group at the origin, y=[0,height]. One mesh per distinct material
 * identity, no per-tile objects or material groups. No fetch or texture assets.
 * Pass the complete dictionary from createDomeMaterials(); default is shared.
 * Dispose returned mesh geometries yourself; do not dispose shared materials
 * until every dome using them has been released.
 */
export function createDome({ kind = 'C', height = 10, radius = 4, materials, neckStart } = {}) {
  if (!Object.hasOwn(PROFILES, kind)) throw new RangeError(`Unknown dome kind: ${kind}`);
  if (!Number.isFinite(height) || !Number.isFinite(radius) || height <= 0 || radius <= 0) {
    throw new RangeError('Dome height and radius must be finite and positive');
  }
  const mats = materials ?? (sharedMaterials ??= createDomeMaterials());
  const buckets = new Map();
  const group = new THREE.Group();
  group.name = `sb-dome-${kind}`;
  const end = NECK[kind], points = PROFILES[kind];
  const vertical=(t)=>neckStart==null?t*height:(t<=end?t/end*neckStart:neckStart+(height-neckStart)*(t-end)/(1-end));
  const radial = (t) => radius * profileAt(points, t);
  const point = (a, t, inset = 0) => {
    const r = radial(t) + inset;
    return new THREE.Vector3(r * Math.sin(a), vertical(t), r * Math.cos(a));
  };
  const triangle = (key, a, b, c, normals) => {
    const mat = mats[key];
    if (!mat?.isMaterial) throw new TypeError(`Missing dome material: ${key}`);
    if (!buckets.has(mat)) buckets.set(mat, { key, positions: [], normals: [] });
    const bucket = buckets.get(mat);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    for (const [i, v] of [a, b, c].entries()) {
      bucket.positions.push(v.x, v.y, v.z);
      const normal = normals ? normals[i] : n;
      bucket.normals.push(normal.x, normal.y, normal.z);
    }
  };
  // With p=(sin(a)*r,y,cos(a)*r), d/da CROSS d/dt points OUT.
  // Smooth shell normals use the same parameter ordering as triangle winding.
  const patch = (key, surface, a0, a1, t0, t1, columns = 4, rows = 3) => {
    const verts = [], norms = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
      const a = a0 + (a1 - a0) * i / columns, t = t0 + (t1 - t0) * j / rows;
      verts.push(surface(a, t));
      const da = surface(a + 1e-5, t).sub(surface(a - 1e-5, t));
      const dt = surface(a, Math.min(.999999, t + 1e-5)).sub(surface(a, Math.max(0, t - 1e-5)));
      const n = da.cross(dt).normalize();
      if (t === 1) n.set(0, 1, 0);
      norms.push(n);
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i, b = a + 1, c = b + columns + 1, d = c - 1;
      triangle(key, verts[a], verts[b], verts[d], [norms[a], norms[b], norms[d]]);
      if (t1 !== 1 || j !== rows - 1) triangle(key, verts[b], verts[c], verts[d], [norms[b], norms[c], norms[d]]);
    }
  };
  // Backing is radially inside the entire ornament, including its straight
  // triangle chords. Do not fade a world-space inset to zero at the ends:
  // that lets the smooth shell pierce recessed enamel and hide flat crosses.
  const shell = (key) => patch(key, (a, t) => point(a, t, -.22 * radial(t)), 0, TAU, 0, end, 112, 48);

  // Tile bases conform to the curved onion. A raised apex creates actual facets
  // and silhouette relief; flat tiles are curved patches, not tangent cards.
  const tile = (key, a, t, da, dt, relief = 0, diamond = false, lift = .002) => {
    if (!relief && !diamond) {
      patch(key, (u, v) => point(u, v, radial(v) * lift), a - da, a + da, t - dt, t + dt, 3, 2);
      return;
    }
    const corners = diamond
      ? [[a - da, t], [a, t - dt], [a + da, t], [a, t + dt]]
      : [[a - da, t - dt], [a + da, t - dt], [a + da, t + dt], [a - da, t + dt]];
    const rim = corners.map(([u, v]) => point(u, v, radial(v) * lift));
    const peak = point(a, t, radial(t) * lift + relief);
    for (let i = 0; i < 4; i++) triangle(key, rim[i], rim[(i + 1) % 4], peak);
  };

  if (kind === 'C') {
    // Positive angular twist: right-hand rise, white/blue/green clockwise above.
    const twist = 115 * Math.PI / 180;
    const lobe = (a, t) => {
      const scallop = .925 + .075 * Math.sin(6 * a) ** 2;
      const r = radial(t) * scallop;
      const angle = a + twist * t / end;
      return new THREE.Vector3(r * Math.sin(angle), vertical(t), r * Math.cos(angle));
    };
    for (let i = 0; i < 12; i++) {
      const a0 = i * TAU / 12, a1 = (i + 1) * TAU / 12;
      patch(['white', 'blue', 'green'][i % 3], lobe, a0, a1, 0, end, 8, 64);
      // Fine dark plate joints, nine curved plates per lobe; no gold on bulb.
      for (let j = 1; j < 9; j++) {
        const t = j * end / 9;
        patch('dark', (a, v) => {
          const p = lobe(a, v); p.x *= 1.001; p.z *= 1.001; return p;
        }, a0, a1, t - .00065, t + .00065, 8, 1);
      }
    }
  } else if (kind === 'NW') {
    shell('gold');
    for (let rib = 0; rib < 8; rib++) {
      const center = rib * TAU / 8;
      const ribSurface = (a, t) => {
        const f = Math.cos((a - center) / .24 * Math.PI / 2);
        return point(a, t, radial(t) * (-.065 + .065 * Math.max(0, f)));
      };
      patch(rib % 2 ? 'green' : 'blue', ribSurface, center - .24, center + .24, 0, end, 8, 48);
      for (let row = 1; row < 12; row++) {
        const t = row * end / 12;
        patch('dark', (a, v) => ribSurface(a, v).add(new THREE.Vector3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(radius * .001)), center - .24, center + .24, t - .0007, t + .0007, 8, 1);
      }
      const a = center + TAU / 16;
      for (let row = 0; row < 5; row++) {
        const t = .08 + row * .155;
        tile('dark', a, t, .143, .064, 0, true, -.035);
        tile('gold', a, t, .123, .054, 0, true, -.028);
        tile('white', a, t, .091, .043, radius * .043 * profileAt(points, t), true, -.020);
        const gap = t + .078;
        for (const side of [-1, 1]) tile('white', a + side * .067, gap, .053, .023, radius * .025 * profileAt(points, gap), false, -.025);
      }
    }
  } else if (kind === 'SW' || kind === 'NE') {
    const cols = kind === 'SW' ? 28 : 30, rows = kind === 'SW' ? 17 : 20;
    shell(kind === 'SW' ? 'gold' : 'dark');
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const t = (row + .5) * end / rows, a = (col + .5) * TAU / cols;
      let key, raised = true;
      if (kind === 'SW') {
        const band = (col + row) % 4;
        key = ['green', 'white', 'blue', 'blue'][band]; raised = band < 2;
      } else {
        key = (row + col) % 2 ? 'white' : 'olive';
        for (let tier = 0; tier < 7; tier++) {
          const dy = Math.abs(row - (1 + tier * 3));
          const dx0 = ((col - (tier % 2) * 3) % 6 + 6) % 6;
          const dx = Math.min(dx0, 6 - dx0);
          if (dx + dy <= 1) { key = tier % 2 ? 'yellow' : 'crossBlue'; raised = false; break; }
        }
      }
      const relief = raised ? radius * .055 * profileAt(points, t) : 0;
      tile(key, a, t, TAU / cols * .466, end / rows * .465, relief, false, -.018);
    }
  } else if (kind === 'SE') {
    shell('dark');
    // 19 coloured courses, 14 coloured squares per course. Gold diamonds sit
    // halfway between courses and columns (14 more per circumferential repeat).
    for (let row = 0; row < 19; row++) for (let col = 0; col < 14; col++) {
      const t = (row + .5) * end / 19, a = col * TAU / 14;
      const key = row % 2 === 0 ? 'white' : col % 2 ? 'green' : 'blue';
      tile(key, a, t, TAU / 14 * .28, end / 19 * .41, radius * .052 * profileAt(points, t), false, -.012);
      const gt = (row + 1) * end / 19;
      if (row < 18) tile('gold', a + TAU / 28, gt, TAU / 14 * .20, end / 19 * .38, radius * .043 * profileAt(points, gt), true, -.010);
    }
  } else {
    // A single partitioned surface: seams replace gold faces, never overlap a
    // backing shell. Identical samples on adjacent panel edges prevent both
    // z-fighting and cracks. Aligned columns are a provisional sheet layout.
    const rows = kind === 'bell' ? 10 : 9, cols = kind === 'bell' ? 32 : 24;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a0 = i * TAU / cols, a1 = (i + 1) * TAU / cols;
      const t0 = j * end / rows, t1 = (j + 1) * end / rows;
      const aa = [a0, ...Array.from({ length: 4 }, (_, k) => a0 + .0018 + (a1 - a0 - .0036) * k / 3), a1];
      const tt = [t0, ...Array.from({ length: 5 }, (_, k) => t0 + .0008 + (t1 - t0 - .0016) * k / 4), t1];
      for (let y = 0; y < tt.length - 1; y++) for (let x = 0; x < aa.length - 1; x++) {
        const seam = x === 0 || y === 0 || x === aa.length - 2 || y === tt.length - 2;
        patch(seam ? 'goldSeam' : 'gold', point, aa[x], aa[x + 1], tt[y], tt[y + 1], 1, 1);
      }
    }
  }
  // Smooth, pointed gilded neck and a thin basal welt. The tip is exactly height.
  patch('gold', point, 0, TAU, end, 1, 64, 18);
  patch(kind === 'C' ? 'dark' : 'gold', (a, t) => point(a, t, radius * .002), 0, TAU, 0, .009, 112, 1);
  // Close the bottom with downward-facing triangles, all on y=0.
  for (let i = 0; i < 112; i++) triangle('dark', new THREE.Vector3(), point((i + 1) * TAU / 112, 0), point(i * TAU / 112, 0));

  let triangles = 0;
  for (const [material, data] of buckets) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${group.name}-${data.key}`;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh); triangles += data.positions.length / 9;
  }
  group.userData = {
    kind, height, radius, triangles, drawCalls: group.children.length,
    study: true, includes: 'onion and pointed gold neck; excludes drum, orb and cross',
    sources: ['spilled-blood/research/elements-domes.md', 'spilled-blood/data/profiles/'],
    uncertainty: [
      'Visually plausible study, not an exact reconstruction. Dimensions are supplied by the caller.',
      'Smoothed selected silhouette controls; raw profiles contain occlusions and neck artifacts. NW and NE have no saved individual profile.',
      'Central/full-height belly ~60%, bell ~37%, SE ~32%; inferred transition controls are provisional.',
      'Central twist 115 degrees is estimated; corner row counts ±2, NW five diamonds per gore estimated.',
      'NE yellow crosses may be enamel rather than gold leaf; rendered as enamel. Photo palette is not a paint specification.',
      'Relief depths, seam widths, neck transitions and gold sheet column counts are visual estimates.',
    ],
  };
  return group;
}
