// Far LOD: the full building is rendered once (at load, and again when the sun moves)
// into a texture atlas from five orthographic views. At a distance the whole
// building then becomes a 10-triangle box plus a few low-poly roof pieces.
import * as THREE from 'three';

// opts: { W, D, H, size, extras(add, mats) } — footprint centred on the origin.
export function createImpostor(mats, { W, D, H, size = 1024, extras }) {
  const SIZE = size;
  const HW = W / 2, HD = D / 2;
  const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, {
    type: THREE.HalfFloatType, samples: 4, generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
  });

  // Atlas layout (pixels, y from the bottom). Tall buildings: sides side by side.
  // Wide, low buildings: each side gets a full-width row so texel density stays even.
  const sides = ['front', 'right', 'back', 'left'];
  const len = { front: W, right: D, back: W, left: D };
  const CELLS = {};
  if (H > Math.max(W, D) * 0.6) {
    let x = 0;
    const total = 2 * (W + D);
    for (const s of sides) { const w = Math.round((SIZE * len[s]) / total); CELLS[s] = [x, SIZE / 4, w, (SIZE * 3) / 4]; x += w; }
    CELLS.roof = [0, 0, Math.round((SIZE / 4) * (W / D)), SIZE / 4];
  } else {
    const rowH = Math.round(SIZE * 0.17);
    sides.forEach((s, i) => { CELLS[s] = [0, SIZE - rowH * (i + 1), SIZE, rowH]; });
    const rh = SIZE - rowH * 4;
    CELLS.roof = [0, 0, Math.min(SIZE, Math.round(rh * (W / D))), rh];
  }
  // Each side: outward normal, and the two bottom corners in left→right order seen from outside.
  const SIDES = {
    front: { n: [0, 0, 1], a: [-HW, HD], b: [HW, HD], L: W },
    right: { n: [1, 0, 0], a: [HW, HD], b: [HW, -HD], L: D },
    back: { n: [0, 0, -1], a: [HW, -HD], b: [-HW, -HD], L: W },
    left: { n: [-1, 0, 0], a: [-HW, -HD], b: [-HW, HD], L: D },
  };

  const pos = [], uv = [];
  const u = (px) => px / SIZE;
  for (const [name, s] of Object.entries(SIDES)) {
    const [cx, cy, cw, ch] = CELLS[name];
    const A0 = [s.a[0], 0, s.a[1]], B0 = [s.b[0], 0, s.b[1]], B1 = [s.b[0], H, s.b[1]], A1 = [s.a[0], H, s.a[1]];
    const ua = [u(cx), u(cy)], ub = [u(cx + cw), u(cy)], ub1 = [u(cx + cw), u(cy + ch)], ua1 = [u(cx), u(cy + ch)];
    pos.push(...A0, ...B0, ...B1, ...A0, ...B1, ...A1);
    uv.push(...ua, ...ub, ...ub1, ...ua, ...ub1, ...ua1);
  }
  {
    const [cx, cy, cw, ch] = CELLS.roof;
    const p = [[-HW, H, HD], [HW, H, HD], [HW, H, -HD], [-HW, H, -HD]];
    const t = [[u(cx), u(cy)], [u(cx + cw), u(cy)], [u(cx + cw), u(cy + ch)], [u(cx), u(cy + ch)]];
    for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...p[i]); uv.push(...t[i]); }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geom.computeVertexNormals();

  const group = new THREE.Group();
  group.name = 'building-impostor';
  const box = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ map: rt.texture, alphaTest: 0.5 }));
  box.name = 'impostor box';
  box.userData = { kind: 'merged', label: 'baked facade box' };
  box.castShadow = true;
  group.add(box);

  // Roof silhouette pieces that stick out above the box (reuse existing materials).
  const add = (g, m, label) => { const mesh = new THREE.Mesh(g, m); mesh.userData = { kind: 'merged', label }; mesh.castShadow = true; group.add(mesh); };
  if (extras) extras(add, mats);

  const cam = new THREE.OrthographicCamera();
  const far = Math.max(W, D) + 200;

  // Render the full-detail building into the atlas. `prepare` hides everything else.
  function bake(renderer, scene, prepare, restore) {
    const prevTarget = renderer.getRenderTarget();
    const prevBg = scene.background;
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    prepare();
    scene.background = null;
    renderer.setClearColor(0x000000, 0);
    rt.scissorTest = false;
    rt.viewport.set(0, 0, SIZE, SIZE);
    renderer.setRenderTarget(rt);
    renderer.clear();
    rt.scissorTest = true;

    const views = [];
    for (const [name, s] of Object.entries(SIDES)) {
      const mid = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];
      const dist = far / 2;
      views.push({ cell: CELLS[name], pos: [mid[0] + s.n[0] * dist, H / 2, mid[1] + s.n[2] * dist], look: [mid[0], H / 2, mid[1]], up: [0, 1, 0], hw: s.L / 2, hh: H / 2 });
    }
    views.push({ cell: CELLS.roof, pos: [0, H + far / 2, 0], look: [0, 0, 0], up: [0, 0, -1], hw: HW, hh: HD });

    for (const v of views) {
      cam.left = -v.hw; cam.right = v.hw; cam.top = v.hh; cam.bottom = -v.hh;
      cam.near = 1; cam.far = far;
      cam.position.set(...v.pos); cam.up.set(...v.up); cam.lookAt(...v.look);
      cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      rt.viewport.set(...v.cell); rt.scissor.set(...v.cell);
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
    }
    rt.scissorTest = false;
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClear, prevAlpha);
    scene.background = prevBg;
    restore();
  }

  return { group, bake, texture: rt.texture, bytes: SIZE * SIZE * 8 * 1.33, size: SIZE };
}
