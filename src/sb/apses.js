import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createDrumMaterials } from './drums.js';

/**
 * Lower east apse walls, local y=0..height, semicircle facing +X.
 * API and caller-owned materials match the former clipped createDrum wrapper.
 * Existing site callers use sides=20 for the central apse, 12 for side apses.
 * sides controls tessellation and that existing style convention, NOT window count.
 * Five central windows are documented; five side windows remain an inference.
 * Roofs, upper drums, granite annexe and mosaic art belong to the parent assembly.
 */
export function createApseArcade({ radius, height, materials, sides = 20 } = {}) {
  if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(height) || height <= 0)
    throw new RangeError('Apse radius and height must be finite positive metres.');
  if (!Number.isInteger(sides) || sides < 4 || sides > 128 || sides % 2)
    throw new RangeError('Apse sides must be an even integer from 4 to 128.');
  const mats = materials ?? createDrumMaterials();
  for (const key of ['brick', 'buff', 'stone', 'glass', 'copper'])
    if (!mats[key]?.isMaterial) throw new TypeError(`Missing apse material: ${key}`);

  const central = sides >= 16, bays = 5, step = Math.PI / bays;
  const bayWidth = radius * step;
  const unit = Math.min(radius / 4.5, height / 8.5, 1);
  const depth = Math.min(.42 * unit, radius * .12);
  const trim = Math.min(.10 * unit, bayWidth * .04);
  const halfWindow = Math.min(bayWidth * .225, height * .09);
  const bottom = height * (central ? .14 : .18);
  const top = height * (central ? .73 : .72);
  const spring = top - halfWindow;
  const segments = Math.max(12, Math.ceil(sides / bays) * 4);
  const group = new T.Group();
  group.name = central ? 'sb-apse-central-arcade' : 'sb-apse-side-arcade';
  const batches = new Map();
  const windows = [];

  function collect(geometry, key) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    flat.clearGroups();
    // Shapes/cylinders use their normal UVs; repeated curved pieces retain UVs
    // so the caller's shared brick normal map still works.
    if (!batches.has(mats[key])) batches.set(mats[key], []);
    batches.get(mats[key]).push(flat);
  }
  function arch(path, r, sill, headSpring) {
    path.moveTo(-r, sill); path.lineTo(r, sill); path.lineTo(r, headSpring);
    path.absarc(0, headSpring, r, 0, Math.PI, false);
    path.lineTo(-r, sill); path.closePath();
    return path;
  }
  function extrusion(shape, thickness) {
    return new T.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 18 });
  }
  // A flat bay's X coordinate is arc length, Z is radius. Warp ALL faces,
  // including its back, jambs and soffit; no triangles are discarded at a cut.
  function curved(geometry, angle) {
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = angle + p.getX(i) / radius, r = p.getZ(i);
      p.setXYZ(i, Math.sin(a) * r, p.getY(i), Math.cos(a) * r);
    }
    geometry.computeVertexNormals();
    return geometry;
  }
  function panel(shape, thickness, radial, angle, key) {
    collect(curved(extrusion(shape, thickness).translate(0, 0, radial), angle), key);
  }
  function block(w, h, d, x, y, radial, angle, key) {
    // Subdivisions preserve the continuous circular profile on broad ledges.
    const g = new T.BoxGeometry(w, h, d, Math.max(1, Math.ceil(w / (radius * .07))), 1, 1)
      .translate(x, y, radial);
    collect(curved(g, angle), key);
  }
  function archRing(r, sill, headSpring, width, thickness, radial, angle, key) {
    const shape = arch(new T.Shape(), r + width, sill - width, headSpring);
    shape.holes.push(arch(new T.Path(), r, sill, headSpring));
    panel(shape, thickness, radial, angle, key);
  }
  // A profile revolved through precisely pi radians, with explicit end caps.
  // Unlike CylinderGeometry(thetaLength=pi), both radial cuts are closed.
  function band(profile, key) {
    const vertices = [], indices = [], uv = [], n = Math.max(60, sides * 3);
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI;
      for (const [r, y] of profile) {
        vertices.push(Math.sin(a) * r, y, Math.cos(a) * r);
        uv.push(a * radius, y);
      }
    }
    const count = profile.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < count; j++) {
      const k = (j + 1) % count, a = i * count + j, b = i * count + k;
      indices.push(a, b + count, b, a, a + count, b + count);
    }
    const cap = T.ShapeUtils.triangulateShape(profile.map(([r, y]) => new T.Vector2(r, y)), []);
    for (const [a, b, c] of cap) indices.push(a, b, c, n * count + c, n * count + b, n * count + a);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));g.setIndex(indices);g.computeVertexNormals();
    collect(g, key);
  }
  function slab(y, thickness) {
    const shape = new T.Shape();shape.moveTo(0, radius);
    for (let i = 1; i <= 80; i++) {
      const a = i / 80 * Math.PI;shape.lineTo(radius * Math.sin(a), radius * Math.cos(a));
    }
    shape.closePath();
    collect(extrusion(shape, thickness).rotateX(Math.PI / 2).translate(0, y + thickness, 0), 'brick');
  }
  function tube(points, r, angle, key = 'stone', radial = radius + .18 * unit) {
    const world = points.map(([x, y]) => {
      const a = angle + x / radius;return new T.Vector3(radial * Math.sin(a), y, radial * Math.cos(a));
    });
    const curve = new T.CurvePath();
    for (let i = 1; i < world.length; i++) curve.add(new T.LineCurve3(world[i - 1], world[i]));
    collect(new T.TubeGeometry(curve, Math.max(points.length * 2, 12), r, 8, false), key);
    // TubeGeometry is open-ended; shallow spheres close the moulding ends.
    for (const p of [world[0], world.at(-1)]) collect(new T.SphereGeometry(r, 8, 6).translate(...p.toArray()), key);
  }
  function column(angle, offset, y0, y1) {
    const r = .115 * unit, H = y1 - y0;
    const profile = [[0, 1.65], [.035, 1.65], [.07, 1.15], [.10, 1], [.27, .88], [.285, 1.26], [.31, 1.26],
      [.325, .88], [.52, .84], [.535, 1.22], [.56, 1.22], [.575, .84], [.78, .82], [.795, 1.20],
      [.82, 1.20], [.835, .82], [.93, .90], [.96, 1.40], [1, 1.40]];
    const points = [new T.Vector2(0, y0), ...profile.map(([t, scale]) => new T.Vector2(r * scale, y0 + H * t)), new T.Vector2(0, y1)];
    const a = angle + offset / radius, radial = radius + .18 * unit;
    collect(new T.LatheGeometry(points, 12).translate(Math.sin(a) * radial, 0, Math.cos(a) * radial), 'stone');
    for (const [h, w, hh] of [[y0, .44, .13], [y1, .46, .16], [y1 + .12 * unit, .56, .10]])
      block(w * unit, hh * unit, .44 * unit, offset, h, radial, angle, 'stone');
  }

  for (let i = 0; i < bays; i++) {
    const angle = (i + .5) * step;
    const wall = new T.Shape();
    // Subdivide the horizontal outline so the entire masonry face follows the
    // radius, not one chord crossing a curved window recess.
    wall.moveTo(-bayWidth / 2, 0);
    for (let j = 1; j <= segments; j++) wall.lineTo(-bayWidth / 2 + bayWidth * j / segments, 0);
    wall.lineTo(bayWidth / 2, height);
    for (let j = segments - 1; j >= 0; j--) wall.lineTo(-bayWidth / 2 + bayWidth * j / segments, height);
    wall.closePath();wall.holes.push(arch(new T.Path(), halfWindow, bottom, spring));
    panel(wall, depth, radius - depth, angle, 'brick');
    // Slight overlap behind the reveals avoids roundoff cracks. This is real
    // recessed opaque glazing, never a black plane pasted across the wall face.
    panel(arch(new T.Shape(), halfWindow + .012 * unit, bottom - .012 * unit, spring),
      .035 * unit, radius - depth - .035 * unit, angle, 'glass');
    windows.push({ angle, halfWidth: halfWindow, sill: bottom, spring, top, backingRadius: radius - depth });
    for (const [offset, width, projection, key] of [[0, trim, .055, 'buff'], [trim, trim * 1.15, .12, 'brick'],
      [trim * 2.15, trim * .65, .18, central ? 'buff' : 'stone']])
      archRing(halfWindow + offset, bottom - offset, spring, width, projection * unit, radius, angle, key);
    const sillW = 2 * halfWindow + 7 * trim;
    for (const [yy, w, d] of [[bottom - .12 * unit, sillW, .32], [bottom - .22 * unit, sillW + .12 * unit, .40]])
      block(w, .10 * unit, d * unit, 0, yy, radius + .07 * unit, angle, 'stone');
    // Four transoms and a central upright, all confined to the opening.
    const metalR = radius - depth + .04 * unit;
    block(.035 * unit, top - bottom - .06 * unit, .035 * unit, 0, (top + bottom) / 2, metalR, angle, 'copper');
    for (let j = 1; j <= 4; j++)
      block(halfWindow * 2 - .05 * unit, .035 * unit, .04 * unit, 0, bottom + (spring - bottom) * j / 4, metalR, angle, 'copper');

    if (central) {
      // Paired round lobes beneath a triangular marble gablet, seen in east.jpg.
      const base = height * .785, lobe = bayWidth * .235;
      const lobes = [];
      for (const center of [-lobe, lobe]) for (let j = 0; j <= 16; j++) {
        const a = Math.PI - j * Math.PI / 16;lobes.push([center + lobe * Math.cos(a), base + lobe * .65 * Math.sin(a)]);
      }
      tube(lobes, trim * .72, angle);
      tube([[-bayWidth * .38, base + lobe * .36], [0, height * .89], [bayWidth * .38, base + lobe * .36]], trim, angle);
      tube([[-bayWidth * .29, base + lobe * .39], [0, height * .866], [bayWidth * .29, base + lobe * .39]], trim * .45, angle, 'stone', radius + .25 * unit);
      for (const x of [-lobe * 2, 0, lobe * 2]) {
        block(.22 * unit, .27 * unit, .28 * unit, x, base - .09 * unit, radius + .16 * unit, angle, 'stone');
      }
      // Only the relief cross motifs actually visible in the photo; no text/art.
      for (const x of [-bayWidth * .31, bayWidth * .31]) {
        block(.13 * unit, .40 * unit, .13 * unit, x, base - .12 * unit, radius + .23 * unit, angle, 'stone');
        block(.38 * unit, .13 * unit, .13 * unit, x, base - .12 * unit, radius + .23 * unit, angle, 'stone');
      }
      for (const x of [-bayWidth * .30, 0, bayWidth * .30]) {
        const y = height * .909, w = bayWidth * .23, h = height * .045;
        block(w, h, .10 * unit, x, y, radius + .04 * unit, angle, 'buff');
        block(w - .10 * unit, h - .09 * unit, .05 * unit, x, y, radius + .11 * unit, angle, 'brick');
      }
    } else {
      const r = halfWindow + 3.5 * trim, base = spring;
      const path = new T.Path();path.moveTo(-r, base);
      path.bezierCurveTo(-r, top + .20 * unit, -r * .20, top + .12 * unit, 0, height * .835);
      path.bezierCurveTo(r * .20, top + .12 * unit, r, top + .20 * unit, r, base);
      const pts = path.getPoints(24).map(p => [p.x, p.y]);
      tube(pts, trim, angle);tube(pts.map(([x, y]) => [x * .91, y - .08 * unit]), trim * .45, angle, 'buff', radius + .22 * unit);
    }
  }
  // Inter-window supports: single long shafts centrally, paired shafts on sides.
  for (let i = 0; i <= bays; i++) {
    const angle = i * step, offsets = central ? [0] : [-.20 * unit, .20 * unit];
    // At the rear ends only the inward member of a pair is exposed.
    for (const offset of offsets) if (angle + offset / radius >= 0 && angle + offset / radius <= Math.PI)
      column(angle, offset, bottom - .18 * unit, height * (central ? .77 : .70));
  }

  // Closed half-disc floor/ceiling and a real diameter wall seal the rear join.
  slab(0, .10 * unit);slab(height - .10 * unit, .10 * unit);
  collect(new T.BoxGeometry(depth, height, 2 * radius).translate(-depth / 2, height / 2, 0), 'brick');
  band([[radius - depth, 0], [radius + .12 * unit, 0], [radius + .12 * unit, .16 * unit], [radius - depth, .16 * unit]], 'stone');
  const corniceBottom = height * .94;
  band([[radius - depth, corniceBottom], [radius + .08 * unit, corniceBottom],
    [radius + .08 * unit, height * .955], [radius + .20 * unit, height * .965],
    [radius + .27 * unit, height * .98], [radius + .27 * unit, height * .989],
    [radius - depth, height * .989]], 'stone');
  // Narrow copper drip at the spring of the parent-owned tiled half dome.
  band([[radius - .07 * unit, height * .987], [radius + .30 * unit, height * .987],
    [radius + .30 * unit, height * .995], [radius + .07 * unit, height], [radius - .07 * unit, height]], 'copper');
  const teeth = Math.max(30, Math.ceil(Math.PI * radius / (.30 * unit)));
  for (let i = 0; i < teeth; i++) {
    const angle = (i + .5) * Math.PI / teeth;
    block(.13 * unit, .16 * unit, .22 * unit, 0, height * .947, radius + .12 * unit, angle, 'stone');
    if (!central) {
      const w = Math.PI * radius / teeth;
      tube([[-w / 2, height * .878], [0, height * .903], [w / 2, height * .878]], trim * .55, angle, 'buff', radius + .09 * unit);
    }
  }

  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries, false);
    for (const part of geometries) part.dispose();
    if (!geometry) throw new Error('Unable to merge apse geometry.');
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh = new T.Mesh(geometry, material);
    mesh.name = `${group.name}-${Object.keys(mats).find(key => mats[key] === material)}`;
    mesh.castShadow = mesh.receiveShadow = true;group.add(mesh);
  }
  group.userData = {
    kind: central ? 'central-apse' : 'side-apse', radius, height, requestedSides: sides,
    windowCount: bays, windows, insetDepth: depth, facing: '+X', closedRear: true,
    radiusConvention: 'curved wall outer radius; cornice projects up to 0.30m scaled by unit',
    provisional: true,
    references: ['spilled-blood/research/elements-porches-apses-roofs.md §2',
      'saved sb-photos/east.jpg', 'saved sb-photos/southeast.jpg', 'saved sb-photos/c-apse.jpg (roof context only)'],
    uncertainty: ['Five central windows observed; five side windows inferred from four visible.',
      'Window dimensions, reveal depths, column profiles and cornice spacing are photo-informed, not surveyed.',
      'Existing sides=20/12 caller convention selects central/side detailing; tessellation does not change the five bays.',
      'Rear closure is an integration surface, not a reconstruction of the church interior.',
      'Roof tiles, upper drums, granite annexe, plaques and mosaic niches are handled outside this module.'],
  };
  return group;
}

/**
 * Reusable low granite annexe, +X half circle, y=0..height; no site translation.
 * Parent composes central radius=10 and side wings, and owns the lean-to roof.
 * The nine-bay alternation is provisional: references do not establish its count.
 * Optional materials may supply granite, plaque, stone, brick, glass and copper.
 */
export function createApsePlinth({ radius = 10, height = 5.5, materials, bays = 9 } = {}) {
  if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(height) || height <= 0)
    throw new RangeError('Apse plinth radius and height must be finite positive metres.');
  if (!Number.isInteger(bays) || bays < 3 || bays > 32)
    throw new RangeError('Apse plinth bays must be an integer from 3 to 32.');
  const make = (color, roughness) => new T.MeshStandardMaterial({ color, roughness });
  const mats = {
    granite: materials?.granite ?? make(0xb8b3a8, .91),
    stone: materials?.stone ?? make(0xc9c3b2, .76),
    brick: materials?.brick ?? make(0x655754, .85),
    plaque: materials?.plaque ?? make(0x79615b, .35),
    glass: materials?.glass ?? make(0x172825, .31),
    copper: materials?.copper ?? make(0x48564b, .66),
  };
  for (const [key, material] of Object.entries(mats)) if (!material?.isMaterial)
    throw new TypeError(`Invalid apse plinth material: ${key}`);
  const group = new T.Group();group.name = 'sb-apse-plinth';
  const batches = new Map(), unit = Math.min(radius / 10, height / 5.5, 1);
  const width = Math.PI * radius / bays, depth = Math.min(.55 * unit, radius * .12);
  const half = Math.min(width * .34, height * .22), sill = height * .14;
  const spring = height * .79 - half, trim = Math.min(.10 * unit, width * .025);
  const openings = [];
  function collect(g, key) {
    const flat = g.index ? g.toNonIndexed() : g;if (flat !== g) g.dispose();flat.clearGroups();
    if (!batches.has(mats[key])) batches.set(mats[key], []);batches.get(mats[key]).push(flat);
  }
  function extrude(s, d) { return new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 16 }); }
  function warp(g, angle) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = angle + p.getX(i) / radius, r = p.getZ(i);p.setXYZ(i, Math.sin(a) * r, p.getY(i), Math.cos(a) * r);
    }
    g.computeVertexNormals();return g;
  }
  function panel(s, d, r, a, key) { collect(warp(extrude(s, d).translate(0, 0, r), a), key); }
  function arch(p, r, base, head) {
    p.moveTo(-r, base);p.lineTo(r, base);p.lineTo(r, head);p.absarc(0, head, r, 0, Math.PI, false);p.lineTo(-r, base);p.closePath();return p;
  }
  function block(w, h, d, x, y, r, a, key) {
    collect(warp(new T.BoxGeometry(w, h, d, Math.max(1, Math.ceil(w / (radius * .06))), 1, 1).translate(x, y, r), a), key);
  }
  function ring(r, base, head, thickness, projection, a) {
    const s = arch(new T.Shape(), r + thickness, base - thickness, head);
    s.holes.push(arch(new T.Path(), r, base, head));panel(s, projection, radius, a, 'stone');
  }
  // Solid extruded half-discs close both radial ends as well as top/bottom.
  function cap(r, y, h, key) {
    const s = new T.Shape();s.moveTo(0, r);
    for (let j = 1; j <= 100; j++) { const a = j / 100 * Math.PI;s.lineTo(Math.sin(a) * r, Math.cos(a) * r); }
    s.closePath();collect(extrude(s, h).rotateX(Math.PI / 2).translate(0, y + h, 0), key);
  }
  for (let i = 0; i < bays; i++) {
    const a = (i + .5) * Math.PI / bays, glazed = i % 2 === 1;
    const wall = new T.Shape();wall.moveTo(-width / 2, 0);
    for (let j = 1; j <= 16; j++) wall.lineTo(-width / 2 + width * j / 16, 0);
    wall.lineTo(width / 2, height);
    for (let j = 15; j >= 0; j--) wall.lineTo(-width / 2 + width * j / 16, height);
    wall.closePath();wall.holes.push(arch(new T.Path(), half, sill, spring));
    panel(wall, depth, radius - depth, a, 'granite');
    panel(arch(new T.Shape(), half + .015 * unit, sill - .015 * unit, spring), .04 * unit,
      radius - depth - .04 * unit, a, glazed ? 'glass' : 'brick');
    for (let j = 0; j < 3; j++) ring(half + j * trim * 1.4, sill - j * trim * 1.4, spring, trim, (.10 + j * .07) * unit, a);
    openings.push({ angle: a, halfWidth: half, sill, spring, top: spring + half, glazed, backingRadius: radius - depth });
    if (glazed) {
      // Restrained iron grille; exact smithwork unverified.
      for (let j = -3; j <= 3; j++) {
        const x = j * half / 4, upper = spring + Math.sqrt(half * half - x * x) - .05 * unit;
        block(.035 * unit, upper - sill, .04 * unit, x, (sill + upper) / 2, radius - depth + .08 * unit, a, 'copper');
      }
      for (let j = 1; j <= 5; j++) block(half * 1.9, .035 * unit, .045 * unit, 0,
        sill + (spring - sill) * j / 5, radius - depth + .10 * unit, a, 'copper');
    } else {
      // Two smaller arch mouldings meeting at a suspended drop above a blank
      // stepped plaque. No guessed memorial text or unidentified mosaic panels.
      const rr = half * .46, smallBase = spring - half * .18;
      for (const sign of [-1, 1]) {
        const s = arch(new T.Shape(), rr, smallBase, spring);
        s.holes.push(arch(new T.Path(), rr - trim * .7, smallBase + trim * .7, spring));
        const g = extrude(s, .13 * unit).translate(sign * half * .48, 0, radius - depth + .10 * unit);collect(warp(g, a), 'stone');
        const crossY = spring + rr * .20, crossX = sign * half * .48;
        block(rr * .22, rr * .92, .07 * unit, crossX, crossY, radius - depth + .26 * unit, a, 'plaque');
        block(rr * .72, rr * .22, .07 * unit, crossX, crossY + rr * .08, radius - depth + .26 * unit, a, 'plaque');
      }
      block(.15 * unit, .30 * unit, .18 * unit, 0, smallBase - .08 * unit, radius - depth + .16 * unit, a, 'stone');
      const w = half * 1.72, y0 = sill + .12 * unit, y1 = Math.max(y0 + .15 * unit, smallBase - .20 * unit), notch = .13 * unit;
      const s = new T.Shape();s.moveTo(-w / 2, y0);s.lineTo(-w * .27, y0);s.lineTo(-w * .27, y0 + notch);
      s.lineTo(w * .27, y0 + notch);s.lineTo(w * .27, y0);s.lineTo(w / 2, y0);s.lineTo(w / 2, y1);s.lineTo(-w / 2, y1);s.closePath();
      panel(s, .12 * unit, radius - depth + .08 * unit, a, 'plaque');
      for (const x of [-w * .42, w * .42]) for (const y of [y0 + .20 * unit, y1 - .12 * unit]) {
        const angle = a + x / radius, radial = radius - depth + .23 * unit;
        collect(new T.SphereGeometry(.045 * unit, 8, 6).scale(1, 1, .5).translate(0, y, radial).rotateY(angle), 'copper');
      }
    }
    // Short ashlar pier stacks, individually projecting into the light.
    for (const side of [-1, 1]) for (let j = 0; j < 5; j++) {
      block(width * .13, height * .115, .18 * unit, side * width * .445, height * (.11 + j * .135),
        radius + (.025 + (j % 2) * .018) * unit, a, 'granite');
    }
    for (const side of [-1, 1]) {
      const x = side * (half + trim * 4.5);
      block(trim * 1.3, spring - sill, .17 * unit, x, (spring + sill) / 2, radius + .15 * unit, a, 'stone');
      block(trim * 3, .14 * unit, .30 * unit, x, spring, radius + .16 * unit, a, 'stone');
    }
  }
  cap(radius, 0, .12 * unit, 'granite');
  cap(radius + .10 * unit, height - .35 * unit, .14 * unit, 'stone');
  cap(radius + .22 * unit, height - .21 * unit, .12 * unit, 'stone');
  cap(radius + .28 * unit, height - .09 * unit, .09 * unit, 'stone');
  collect(new T.BoxGeometry(depth, height, radius * 2).translate(-depth / 2, height / 2, 0), 'granite');
  const count = Math.max(24, Math.ceil(Math.PI * radius / (.27 * unit)));
  for (let i = 0; i < count; i++) block(.12 * unit, .14 * unit, .20 * unit, 0, height - .38 * unit,
    radius + .11 * unit, (i + .5) * Math.PI / count, 'stone');
  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries, false);for (const g of geometries) g.dispose();
    if (!geometry) throw new Error('Unable to merge apse plinth geometry.');
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh = new T.Mesh(geometry, material);mesh.name = `${group.name}-${Object.keys(mats).find(key => mats[key] === material)}`;
    mesh.castShadow = mesh.receiveShadow = true;group.add(mesh);
  }
  group.userData = { kind: 'apse-plinth', radius, height, bays, openings, insetDepth: depth, facing: '+X', closedRear: true,
    blankPlaqueCount: Math.ceil(bays / 2), grilleCount: Math.floor(bays / 2), provisional: true,
    references: ['spilled-blood/research/elements-porches-apses-roofs.md §2: low ring', 'saved sb-photos/east.jpg'],
    uncertainty: ['Bay count and distribution are configurable approximations, not a mapped allocation of the twenty memorial plaques.',
      'Plaques intentionally blank; no inscriptions or mosaic images supplied.', 'Grille bars and stone profiles simplified from the photograph.',
      'No lean-to roof or straight returns: parent assembles separate central and side sections.'] };
  return group;
}
