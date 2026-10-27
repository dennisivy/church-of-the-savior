// Standalone reference-informed exterior reconstruction. Blender exports supply
// intricate architecture; procedural modules supply shared shells, domes and roofs.
// Frame: x east along the church axis, z south, y up, metres. See PROGRESS.md
// and per-asset manifests for measured/inferred distinctions.
import * as THREE from 'three';
import {addGrime} from './materials.js';
import {instanceRepeatedParts} from './sb/batching.js';
import { createDome, createDomeMaterials } from './sb/domes.js';
import { createTentRidges } from './sb/tent.js';
import { createHeraldry } from './sb/heraldry.js';
import { createArtwork } from './sb/artwork.js';
import { createSecondaryFinial } from './sb/finials.js';
import { createApseArcade, createApsePlinth } from './sb/apses.js';
import { createPlinth } from './sb/plinth.js';
import { createApseRoof, createRoofMaterials, createRoofSeams, createDrainpipes } from './sb/roofs.js';
import { createPaving } from './sb/paving.js';
import { loadCentralCross, loadBlenderAsset } from './sb/blender-assets.js';
import { createMainWalls, createWallMaterials } from './sb/facades.js';
const wallMaterials = createWallMaterials();
import { createDrum, createDrumMaterials } from './sb/drums.js';
const drumMaterials = createDrumMaterials();
drumMaterials.brick=wallMaterials.brick;
for (const key of ['brick','buff']) { drumMaterials[key].normalMap = wallMaterials.brick.normalMap; drumMaterials[key].normalScale.set(.4,.4); drumMaterials[key].userData.normalMap = drumMaterials[key].normalMap; }
const blockOnly = new URLSearchParams(location.search).has('block') || new URL(import.meta.url).searchParams.has('block');
const domeMaterials = createDomeMaterials();
const roofMaterials = createRoofMaterials();
const [artwork,heraldry]=blockOnly?[null,null]:await Promise.all([createArtwork(),createHeraldry()]);
const [finial,porchAsset,centralAsset,facadeAsset,bellAsset,cornerAsset]=blockOnly?[null,null,null,null,null,null]:await Promise.all([loadCentralCross(),loadBlenderAsset('porch'),loadBlenderAsset('central-stack'),loadBlenderAsset('facade-ornament'),loadBlenderAsset('bell-tower'),loadBlenderAsset('corner-drum')]);

const T = THREE;
const S = await fetch('spilled-blood/data/solve.json', { cache: 'reload' }).then((r) => r.json());
const P = Object.fromEntries(Object.entries(S.params).map(([k, v]) => [k, v[0]]));

// ---------------------------------------------------------------- the measurements used (metres)
const M = {
  cube: { u0: -15.7, u1: 14.4, v: 15.0, top: 24.0, plinth: 6.4 },               // (body 30.1 m; cornice 24.0)
  gable: { u0: -8.6, u1: 7.0, spring: 25.3, tip: 31.7 },                       // (the great gables, north and south)
  octagon: { r: 6.5, h0: 24.0, h1: 43.3 },                                      // (13 m across the flats)
  tent: { r0: 5.3, r1: 2.1, h0: 43.3, h1: 56.6 },
  lantern: { r: 2.05, h0: 56.6, h1: 64.5 },
  centralOnion: { h0: 64.5, neck: P.hC2, top: 75.4, d: 6.9 },
  corners: { u: [P.uW, P.uE], v: (P.vW + P.vE) / 2, drumR: 3.4, kok: 27.0, drumTop: 37.0, orb: (P.hW2 + P.hE2) / 2, cross: (P.hW1 + P.hE1) / 2, d: 8.8 },
  bell: { u0: -26.0, u1: -14.6, v: 5.7, vPier: 7.4, shaft: 21.4, kok: 25.9, belfry: 32.3, drum: 40.0, band: 43.2, onionTop: 55.6, orb: P.hB2, cross: P.hB1, d: 10.5, u: P.uB },
  porch: { u0: -23.5, u1: -15.0, v0: 11.0, v1: 21.5, wall: 8.0, gable: 11.0, tent: 21.0, eagle: P.hP },
  apse: { u: 18.0, r: 7.2, wall: 18.5, ringR: 10.0, ringU: 18.0, ringH: 5.5, ringRoof: 7.4 },
  // Photo-informed apse crown axes: align each complete tower (drum/onion/cross)
  // with its fitted roof. Earlier projected-photo uA/uS offsets pierced the slope.
  apseDome: { u: 18.0 + 7.2 / 2, drumR: 2.2, drum0: 22.0, drum1: 33.0, d: 5.0, orb: P.hA2, cross: P.hA1 },
  sideApse: { u: 14.4 + 4.5 / 2, v: P.vS, r: 4.5, wall: 14.0, drumR: 1.3, drum1: 21.5, d: 3.0, orb: P.hS },
};

// ---------------------------------------------------------------- materials (the church's own colours)
const mat = (color, o = {}) => new T.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const C = {
  brick: mat(0x8e4a35), granite: mat(0x6f6a66, { roughness: 0.6 }), marble: mat(0xe8e2d4, { roughness: 0.5 }),
  pipe: mat(0x8ca78e, {roughness:.66,metalness:.25}),
  copper: mat(0x5f8a7a, { roughness: 0.55, metalness: 0.3 }), tile: mat(0x3b5aa0, { roughness: 0.4 }),
  gold: mat(0xd4a83c, { roughness: 0.25, metalness: 1 }), glass: mat(0x1d2633, { roughness: 0.2 }),
  enamel: { C: mat(0x6fb3c8, { roughness: 0.3 }), SW: mat(0x2ea6c9, { roughness: 0.3 }), NW: mat(0x6fae4e, { roughness: 0.3 }),
    SE: mat(0x9ec35a, { roughness: 0.3 }), NE: mat(0x5aa86b, { roughness: 0.3 }) },
  stone: mat(0x9c9890, { roughness: 0.9 }), water: mat(0x3b5462, { roughness: 0.15, metalness: 0.3 }),
};

if(!blockOnly){addGrime(C.copper,{macro:1.1,streaks:.25,ground:0,scale:2});addGrime(C.granite,{macro:.8,streaks:.2,ground:.5});}

// ---------------------------------------------------------------- shapes
const g = new T.Group();
const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
const box = (u0, u1, v0, v1, h0, h1, m) => add(new T.BoxGeometry(u1 - u0, h1 - h0, v1 - v0), m, (u0 + u1) / 2, (h0 + h1) / 2, (v0 + v1) / 2);
const cyl = (r0,r1,h0,h1,m,u,v,seg=24) => {const geo=new T.CylinderGeometry(r1,r0,h1-h0,seg);
 if(m===wallMaterials.brick){const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*Math.PI*(r0+r1),uv.getY(i)*(h1-h0));}
 return add(geo,m,u,(h0+h1)/2,v);};
// an onion dome: its profile (a bulb swelling past its drum, drawn in to a point) turned round its axis
function onion(u, v, h0, top, d, m, seg = 32) {
  if (!blockOnly) {
    const kind = Object.entries(C.enamel).find(([, material]) => material === m)?.[0] || (d > 8 ? "bell" : "apse");
    const dome = createDome({ kind, height: top - h0, radius: d / 2, materials: domeMaterials, neckStart:kind==='C'?M.centralOnion.neck-h0:undefined });
    dome.position.set(u, h0, v); g.add(dome); return dome;
  }
  const R = d / 2, H = top - h0, pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, y = t * H;
    // (0: the neck on the drum; bulb widest at 35%; pointed tip)
    const r = t < 0.35 ? R * (0.62 + 0.38 * Math.sin((t / 0.35) * Math.PI / 2)) : R * Math.pow(Math.cos(((t - 0.35) / 0.65) * Math.PI / 2), 0.85);
    pts.push(new T.Vector2(Math.max(r, 0.02), y));
  }
  return add(new T.LatheGeometry(pts, seg), m, u, h0, v);
}
function cross(u, v, h0, h1, s = 1, kind='corner') {
  if(!blockOnly){const f=createSecondaryFinial({kind,height:h1-h0,materials:domeMaterials});f.position.set(u,h0,v);g.add(f);return f;}
  cyl(0.12 * s, 0.1 * s, h0, h1, C.gold, u, v, 8);
  const L = (h1 - h0);
  box(u - 0.9 * s, u + 0.9 * s, v - 0.08, v + 0.08, h0 + L * 0.68, h0 + L * 0.68 + 0.18 * s, C.gold);
  box(u - 0.5 * s, u + 0.5 * s, v - 0.08, v + 0.08, h0 + L * 0.85, h0 + L * 0.85 + 0.14 * s, C.gold);
  add(new T.SphereGeometry(0.35 * s, 12, 8), C.gold, u, h0, v);
}
// a keel-shaped (ogee) gable outline: from the springing, curving in to a point
function keelGable(u0, u1, spring, tip, v, dir, m, depth = 0.8) {
  // (from the cornice up: the gable stands on it)
  const w = u1 - u0, b0 = M.cube.top - 0.2, sh = new T.Shape(); sh.moveTo(0, b0); sh.lineTo(w, b0); sh.lineTo(w, spring);
  sh.bezierCurveTo(w, spring + (tip - spring) * 0.55, w / 2 + w * 0.08, tip - (tip - spring) * 0.2, w / 2, tip);
  sh.bezierCurveTo(w / 2 - w * 0.08, tip - (tip - spring) * 0.2, 0, spring + (tip - spring) * 0.55, 0, spring); sh.closePath();
  const geo = new T.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 16 });
  // (standing 0.4 m proud of the wall, in front of the roof's end)
  const o = add(geo, m, u0, 0, dir > 0 ? v - depth + 0.4 : v - 0.4);
  return o;
}

// ---------------------------------------------------------------- the church
const { cube, gable, octagon, tent, lantern, centralOnion, corners, bell, porch, apse, apseDome, sideApse } = M;
// the cube: granite plinth, brick walls, white cornice
let plinth;
const apsePlinthMaterials={granite:C.granite,stone:wallMaterials.stone,brick:wallMaterials.brick,glass:wallMaterials.glass,copper:C.copper,plaque:mat(0x79615b,{roughness:.5})};
if(blockOnly)box(cube.u0-.3,cube.u1+.3,-cube.v-.3,cube.v+.3,0,cube.plinth,C.granite);
else {plinth=createPlinth({u0:cube.u0-.3,u1:cube.u1+.3,v:cube.v+.3,height:cube.plinth,normalMap:wallMaterials.brick.normalMap});g.add(plinth.group);}
if (blockOnly) box(cube.u0, cube.u1, -cube.v, cube.v, cube.plinth, cube.top - 1.2, C.brick);
else g.add(createMainWalls({u0:cube.u0,u1:cube.u1,v:cube.v,h0:cube.plinth,h1:cube.top-1.2,materials:wallMaterials,trim:false}));
box(cube.u0 - 0.5, cube.u1 + 0.5, -cube.v - 0.5, cube.v + 0.5, cube.top - 1.2, cube.top, C.marble);
for (const h of [16.5, 6.4]) box(cube.u0 - 0.15, cube.u1 + 0.15, -cube.v - 0.15, cube.v + 0.15, h - 0.25, h + 0.25, C.marble);
if (!blockOnly) for (const sign of [-1,1]) { const relief=facadeAsset.scene.clone(true);relief.position.z=sign*cube.v;relief.scale.z=sign;g.add(relief); }
if(!blockOnly)g.add(createDrainpipes(C.pipe));
// the windows (dark openings): two storeys, a single in each side bay and three in the middle, both long fronts
if (blockOnly) for (const sgn of [-1, 1]) for (const [s, t] of [[8.6, 11.9], [17.3, 19.4]]) for (const u of [-11.0, -3.6, -0.7, 2.2, 9.3])
  box(u - 0.6, u + 0.6, sgn * cube.v - 0.05, sgn * cube.v + 0.05, s, t, C.glass);
// the great gables, north and south (brick, from the cornice to the tip), and the barrel roofs of the cross's four
// arms behind them, copper, from the gables back to the octagon
const halfDisc = (r) => {
  const sh=new T.Shape();sh.moveTo(-r,0);sh.lineTo(r,0);
  if(blockOnly)sh.absarc(0,0,r,0,Math.PI,false);
  else {sh.lineTo(r,.9);sh.bezierCurveTo(r,4.0,r*.15,5.4,0,7.0);sh.bezierCurveTo(-r*.15,5.4,-r,4.0,-r,.9);}
  sh.closePath();return sh;
};
for (const sgn of [-1, 1]) {
  keelGable(gable.u0, gable.u1, gable.spring, gable.tip, sgn * cube.v, sgn, C.brick, 1.0);
  const r = (gable.u1 - gable.u0) / 2 - 0.4, len = cube.v - octagon.r;
  const geo = new T.ExtrudeGeometry(halfDisc(r), { depth: len, bevelEnabled: false, curveSegments: 20 });
  add(geo, C.copper, (gable.u0 + gable.u1) / 2, cube.top, sgn > 0 ? octagon.r : -cube.v);
  if(!blockOnly){const seams=createRoofSeams(halfDisc(r),len,C.copper);seams.position.set((gable.u0+gable.u1)/2,cube.top,sgn>0?octagon.r:-cube.v);g.add(seams);}
}
for (const [a, b] of [[cube.u0, -octagon.r], [octagon.r, apse.u]]) {
  const geo = new T.ExtrudeGeometry(halfDisc(7.0), { depth: b - a, bevelEnabled: false, curveSegments: 20 });
  geo.rotateY(Math.PI / 2);
  add(geo, C.copper, a, cube.top, 0);
  if(!blockOnly){const seams=createRoofSeams(halfDisc(7),b-a,C.copper);seams.rotation.y=Math.PI/2;seams.position.set(a,cube.top,0);g.add(seams);}
}
if(!blockOnly)box(cube.u0,cube.u1,-cube.v,cube.v,cube.top,cube.top+.04,C.copper);
// Central stack: original volumes remain available in the comparison mode.
if (blockOnly) {
  cyl(octagon.r,octagon.r,octagon.h0,octagon.h1,C.brick,0,0,8);
  cyl(octagon.r+.4,octagon.r+.4,octagon.h1-.8,octagon.h1,C.marble,0,0,8);
  cyl(tent.r0,tent.r1,tent.h0,tent.h1,C.tile,0,0,8);
  cyl(lantern.r,lantern.r,lantern.h0,lantern.h1,C.brick,0,0,16);
} else g.add(centralAsset.scene.clone(true));
onion(0, 0, centralOnion.h0, centralOnion.top, centralOnion.d, C.enamel.C);
if (blockOnly) cross(0, 0, centralOnion.top, 81.0, 1.6);
else { const asset=finial.scene.clone(true);asset.position.set(0,centralOnion.top,0);asset.rotation.y=Math.PI/2;g.add(asset); }
// the four corner drums: their kokoshnik ring, the arcaded drum, the onion, the cross
for (const [k, u, v] of [['SW', corners.u[0], corners.v], ['NW', corners.u[0], -corners.v], ['SE', corners.u[1], corners.v], ['NE', corners.u[1], -corners.v]]) {
  cyl(corners.drumR + 0.8, corners.drumR + 0.8, cube.top, corners.kok, blockOnly?C.brick:wallMaterials.brick, u, v, 48);
  if (blockOnly) cyl(corners.drumR, corners.drumR, corners.kok, corners.drumTop, C.marble, u, v, 24);
  else {const drum=cornerAsset.scene.clone(true);drum.position.set(u,0,v);g.add(drum);}
  onion(u, v, corners.drumTop, corners.orb - 0.6, corners.d, C.enamel[k]);
  cross(u, v, corners.orb - 0.6, corners.cross, 1.1,k);
}
// the bell tower: its square shaft (stepped piers on the west face), the kokoshnik tiers, the belfry, the drum, the
// inscription band, the gilded onion, the cross
if (blockOnly) {
box(bell.u0, bell.u1, -bell.vPier, bell.vPier, 0, 6.4, C.granite);
box(bell.u0, bell.u1, -bell.v, bell.v, 6.4, bell.shaft, C.brick);
box(bell.u0 - 0.6, bell.u0 + 1.8, -bell.vPier, -bell.v, 6.4, bell.shaft - 4, C.brick);
box(bell.u0 - 0.6, bell.u0 + 1.8, bell.v, bell.vPier, 6.4, bell.shaft - 4, C.brick);
cyl(7.0, 6.2, bell.shaft, bell.kok, C.brick, bell.u, 0, 8);
cyl(5.6, 5.6, bell.kok, bell.belfry, C.marble, bell.u, 0, 8);
cyl(5.0, 4.6, bell.belfry, bell.drum, C.brick, bell.u, 0, 16);
cyl(4.8, 4.8, bell.drum, bell.band, C.marble, bell.u, 0, 24);
} else {const tower=bellAsset.scene.clone(true);tower.position.x=bell.u;g.add(tower);}
onion(bell.u, 0, bell.band, bell.orb - 0.8, bell.d, C.gold);
cross(bell.u, 0, bell.orb - 0.8, bell.cross, 1.6,'bell');
// the porches beside it: their walls, steep gables, tiled tents and eagles
if (blockOnly) for (const sgn of [-1, 1]) {
  const v0 = sgn * porch.v0, v1 = sgn * porch.v1;
  box(porch.u0, porch.u1, Math.min(v0, v1), Math.max(v0, v1), 0, porch.wall, C.brick);
  const pr = new T.ConeGeometry(Math.hypot(porch.u1 - porch.u0, porch.v1 - porch.v0) / 2 * 0.72, porch.gable - porch.wall + 1.5, 4);
  add(pr, C.tile, (porch.u0 + porch.u1) / 2, porch.wall + (porch.gable - porch.wall + 1.5) / 2, sgn * (porch.v0 + porch.v1) / 2).rotation.y = Math.PI / 4;
  cyl(1.6, 0.25, porch.gable, porch.tent, C.tile, (porch.u0 + porch.u1) / 2, sgn * (porch.v0 + porch.v1) / 2, 8);
  add(new T.SphereGeometry(0.6, 10, 8), C.gold, (porch.u0 + porch.u1) / 2, porch.eagle, sgn * (porch.v0 + porch.v1) / 2);
}
if (!blockOnly) for (const sign of [-1,1]) {
  const component=porchAsset.scene.clone(true);component.scale.z=sign;component.position.set(-19.25,0,16.25*sign);g.add(component);
}
// the apses: the low granite ring round them with its copper roof, the central apse and the side apses, their domes
{
  if(!blockOnly)box(cube.u1,apse.ringU,-apse.ringR,apse.ringR,0,apse.ringH,C.granite);
  const ring = new T.CylinderGeometry(apse.ringR, apse.ringR, apse.ringH, 32, 1, false, 0, Math.PI); ring.rotateY(-Math.PI / 2 + Math.PI / 2);
  if(blockOnly)add(ring,C.granite,apse.ringU,apse.ringH/2,0);
  else {ring.dispose();const p=createApsePlinth({radius:apse.ringR,height:apse.ringH,materials:apsePlinthMaterials});p.position.x=apse.ringU;g.add(p);}
  const roof = new T.CylinderGeometry(apse.ringR - 1.2, apse.ringR + 0.4, apse.ringRoof - apse.ringH, 32, 1, false, 0, Math.PI);
  add(roof, C.copper, apse.ringU, (apse.ringH + apse.ringRoof) / 2, 0);
  // Straight returns reconcile the half-round apse with the body's east wall.
  // Photo-derived: drum centre22.27 must sit inside its supporting roof.
  for(const sign of [-1,1])box(cube.u1,apse.u,sign*apse.r-.2,sign*apse.r+.2,apse.ringH,apse.wall,wallMaterials.brick);
  box(cube.u1,apse.u,-apse.r,apse.r,apse.wall-.3,apse.wall,C.copper);
  const wall = new T.CylinderGeometry(apse.r, apse.r, apse.wall - apse.ringH, 32, 1, false, 0, Math.PI);
  if(blockOnly)add(wall, C.brick, apse.u, (apse.wall + apse.ringH) / 2, 0);
  else {wall.dispose();const a=createApseArcade({radius:apse.r,height:apse.wall-apse.ringH,materials:drumMaterials});a.position.set(apse.u,apse.ringH,0);g.add(a);}
  const half = new T.SphereGeometry(apse.r, 24, 12, 0, Math.PI, 0, Math.PI / 2);
  if(blockOnly)add(half.rotateY(Math.PI/2),C.tile,apse.u,apse.wall,0);
  else {half.dispose();const roof=createApseRoof(apse.r,roofMaterials,true);roof.position.set(apse.u,apse.wall,0);g.add(roof);}
  if(blockOnly) for (let i = 0; i < 5; i++) { const a = (i + 0.5) / 5 * Math.PI; const w = add(new T.PlaneGeometry(1.2, 5.5), C.glass, apse.u + Math.sin(a) * (apse.r + 0.02), 12.5, Math.cos(a) * (apse.r + 0.02)); w.rotation.y = a; }
  if(blockOnly)cyl(apseDome.drumR, apseDome.drumR, apseDome.drum0, apseDome.drum1, C.brick, apseDome.u, 0, 16);
  else {const drum=createDrum({radius:apseDome.drumR,height:apseDome.drum1-apseDome.drum0,sides:12,materials:drumMaterials});drum.position.set(apseDome.u,apseDome.drum0,0);g.add(drum);}
  onion(apseDome.u, 0, apseDome.drum1, apseDome.orb - 0.5, apseDome.d, C.gold);
  cross(apseDome.u, 0, apseDome.orb - 0.5, apseDome.cross, 0.9,'apse');
  for (const sgn of [-1, 1]) {
    if(!blockOnly){const p=createApsePlinth({radius:5.9,height:apse.ringH,bays:5,materials:apsePlinthMaterials});p.position.set(cube.u1,0,sgn*sideApse.v);g.add(p);const roof=new T.CylinderGeometry(sideApse.r-.1,6.1,apse.ringRoof-apse.ringH,40,1,false,0,Math.PI);add(roof,C.copper,cube.u1,(apse.ringRoof+apse.ringH)/2,sgn*sideApse.v);}
    const sw = new T.CylinderGeometry(sideApse.r, sideApse.r, sideApse.wall - apse.ringH, 24, 1, false, 0, Math.PI);
    if(blockOnly)add(sw, C.brick, cube.u1, (sideApse.wall + apse.ringH) / 2, sgn * sideApse.v);
    else {sw.dispose();const a=createApseArcade({radius:sideApse.r,height:sideApse.wall-apse.ringH,materials:drumMaterials,sides:12});a.position.set(cube.u1,apse.ringH,sgn*sideApse.v);g.add(a);}
    if(blockOnly)add(new T.SphereGeometry(sideApse.r,20,10,0,Math.PI,0,Math.PI/2).rotateY(Math.PI/2),C.tile,cube.u1,sideApse.wall,sgn*sideApse.v);
    else {const roof=createApseRoof(sideApse.r,roofMaterials);roof.position.set(cube.u1,sideApse.wall,sgn*sideApse.v);g.add(roof);}
    if(blockOnly)cyl(sideApse.drumR,sideApse.drumR,sideApse.wall+1.5,sideApse.drum1,C.brick,sideApse.u,sgn*sideApse.v,12);
    else {const drum=createDrum({radius:sideApse.drumR,height:sideApse.drum1-sideApse.wall-1.5,sides:8,materials:drumMaterials});drum.position.set(sideApse.u,sideApse.wall+1.5,sgn*sideApse.v);g.add(drum);}
    onion(sideApse.u, sgn * sideApse.v, sideApse.drum1, sideApse.orb - 0.3, sideApse.d, C.gold);
    cross(sideApse.u, sgn * sideApse.v, sideApse.orb - 0.3, sideApse.orb + 3.2, 0.6,'apse-small');
  }
}

let batched=false;
function build(mats) {
  if(heraldry){heraldry.group.position.x=bell.u;g.add(heraldry.group);Object.assign(mats,heraldry.materials);}
  if(plinth) Object.assign(mats,plinth.materials);
  if(artwork){g.add(artwork.group);for(const [k,m] of Object.entries(artwork.materials))mats["art_"+k]=m;}
  if(finial) Object.assign(mats,finial.materials,porchAsset.materials,centralAsset.materials,facadeAsset.materials,bellAsset.materials,cornerAsset.materials);
  for (const [key, material] of Object.entries(roofMaterials)) mats['roof_'+key]=material;
  for (const [key, material] of Object.entries(domeMaterials)) mats['dome_' + key] = material;
  for (const [key, material] of Object.entries(wallMaterials)) mats['wall_' + key] = material;
  for (const [key, material] of Object.entries(drumMaterials)) mats['drum_' + key] = material;
  for (const [k, m] of Object.entries(C)) if (m.isMaterial) mats[k] = m; else for (const [kk, mm] of Object.entries(m)) mats['enamel' + kk] = mm;
  if(!batched){instanceRepeatedParts(g);batched=true;}
  g.traverse(o=>{if(o.isMesh)for(const m of (Array.isArray(o.material)?o.material:[o.material]))mats['surface_'+m.uuid]=m;});
  return g;
}
// the ground: paving round the church, the canal to the west under the bell tower's platform
function buildGround() {
  const grp = new T.Group();
  for (const [a,b] of [[-160,-52],[-28,240]]) {
    const pave=new T.Mesh(new T.PlaneGeometry(b-a,400).rotateX(-Math.PI/2).translate((a+b)/2,0,0),C.stone);
    pave.receiveShadow=true;grp.add(pave);
  }
  const canal = new T.Mesh(new T.PlaneGeometry(24, 400).rotateX(-Math.PI / 2).translate(-40, 0.02, 0), C.water); grp.add(canal);
  const wall = new T.Mesh(new T.BoxGeometry(1, 3, 400), C.granite); wall.position.set(-27.5, -1, 0); grp.add(wall);
  if(!blockOnly){
    C.paving=createPaving();
    const pad=new T.Mesh(new T.PlaneGeometry(70,54).rotateX(-Math.PI/2),C.paving);pad.position.set(4,.08,0);pad.receiveShadow=true;grp.add(pad);
    const base=new T.Mesh(new T.BoxGeometry(70,.8,54),C.granite);base.position.set(4,-.33,0);base.receiveShadow=true;grp.add(base);
    const iron=new T.MeshStandardMaterial({color:'#272d2c',roughness:.6,metalness:.5});
    const rail=new T.InstancedMesh(new T.BoxGeometry(.045,1.05,.045),iron,110),matrix=new T.Matrix4();
    for(let i=0;i<110;i++){matrix.makeTranslation(-30.7,.62,-26.5+i*.486);rail.setMatrixAt(i,matrix);}
    rail.castShadow=true;grp.add(rail);
    for(const y of [.28,1.1]){const r=new T.Mesh(new T.BoxGeometry(.07,.07,54),iron);r.position.set(-30.7,y,0);r.castShadow=true;grp.add(r);}
  }
  return grp;
}
const at = (p, t) => [p, t];
const site = {
  title: blockOnly ? 'Spilled Blood: proportions study' : 'Spilled Blood: exterior study',
  models: finial ? [{label:'Blender central cross', bytes:finial.manifest.bytes},{label:'Blender porch (reused twice)',bytes:porchAsset.manifest.bytes},{label:'Central tower',bytes:centralAsset.manifest.geometry.bytes},{label:'Façade relief (reused twice)',bytes:facadeAsset.manifest.bytes},{label:'Bell tower',bytes:bellAsset.manifest.bytes||bellAsset.manifest.glbBytes||9621780},{label:'Corner drum (reused four times)',bytes:cornerAsset.manifest.bytes||cornerAsset.manifest.geometry.bytes}] : [],
  createMaterials: () => ({ mats: {}, assets: [...(artwork?.assets||[]),...(heraldry?.assets||[])], generated: [] }),
  assetsReady: true,
  build: (mats, detail) => (detail === 'high' ? build(mats) : new THREE.Group()),
  buildGround,
  levels: ['full'],
  staticShadows: true,
  anisotropy: 8,
  contactShadows: !blockOnly && !new URLSearchParams(location.search).has('noao'),
  cameraNear: .5,
  center: [0, 30, 0],
  lod: [1e9, 1e9],
  shadow: { extent: 70, target: [0, 35, 0], far: 300 },
  impostor: { W: 1, D: 1, H: 1, size: 64 },
  startTime: 13.5,
  sky: { turbidity: 9, rayleigh: 0.45, mieCoefficient: 0.006 },
  bounce: [0.42, 0.37, 0.31],
  presets: {
    overview: ['Whole building', ...at([-85, 78, 110], [0, 35, 0])],
    finial: ['Blender cross', ...at([12, 78, 4], [0, 77, 0])],
    dome: ['Central dome', ...at([12, 72, 16], [0, 68.5, 0])],
    corners: ['Corner domes', ...at([25, 47, 35], [corners.u[1], 40, corners.v])],
    lantern: ['Lantern detail', ...at([7, 62, 10], [0, 60.5, 0])],
    drum: ['Corner arcade', ...at([20, 34, 24], [corners.u[1], 32, corners.v])],
    eagle: ['Porch eagle', ...at([-21.5,23.3,20.5],[-19.25,22.3,16.25])],
    shrine: ['West shrine', ...at([-37,6,4],[-26.4,3.6,0])],
    porch: ['Entrance detail', ...at([-27,6,31], [-19.25,5,21.35])],
    porchwest: ['West porch mosaic', ...at([-35,8,20], [-24.365,7.5,16.25])],
    windows: ['Window depth', ...at([-5, 12, 24], [-3.6, 10.3, 15])],
    south: ['South', ...at([-20, 6, 140], [-2, 30, 0])],
    heraldry: ['Heraldic tiles', ...at([-26,16,-13],[-22.8,16,-5.85])],
    north: ['North', ...at([2, 18, -140], [0, 35, 0])],
    west: ['West (canal)', ...at([-110, 20, 30], [-10, 32, 0])],
    east: ['East', ...at([130, 30, -35], [0, 35, 0])],
    apses: ['Apse detail', ...at([65, 22, -25], [17, 17, 0])],
    above: ['From above', ...at([0, 160, 2], [0, 0, 0])],
    aerial: ['Three-quarter', ...at([-78, 76, 100], [0, 35, 0])],
  },
};

const requestedPreset = new URLSearchParams(location.search).get("view");
if (site.presets[requestedPreset]) site.presets = { [requestedPreset]: site.presets[requestedPreset], ...site.presets };
export default site;
