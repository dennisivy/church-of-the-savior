// Shared materials. Every surface in the building uses one of these, so the whole
// building compiles a handful of shader programs and uploads each texture once.
import * as THREE from 'three';

// Uniforms shared by every injected shader (one update reaches all materials).
export const shared = {
  uGrime: { value: 1 },
  uNight: { value: 0 },
  uDay: { value: 1 },
  uInterior: { value: 1 },
};

const TEX = 'assets/textures/';

// ---------------------------------------------------------------------------
// Weathering: cheap procedural noise in world space that breaks up texture tiling
// (macro colour variation, rain streaks, ground splash, rust). No extra textures.
// ---------------------------------------------------------------------------
const NOISE_GLSL = /* glsl */`
float gHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gNoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gHash(i), gHash(i + vec3(1,0,0)), f.x), mix(gHash(i + vec3(0,1,0)), gHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(gHash(i + vec3(0,0,1)), gHash(i + vec3(1,0,1)), f.x), mix(gHash(i + vec3(0,1,1)), gHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float gFbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * gNoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

function f(n) { return Number(n).toFixed(3); }

export function addGrime(mat, { macro = 1, streaks = 1, ground = 1, rust = 0, scale = 1 } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGrime = shared.uGrime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 gw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          gw = instanceMatrix * gw;
        #endif
        vGW = (modelMatrix * gw).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;\nuniform float uGrime;\n' + NOISE_GLSL)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 wp = vGW * ${f(scale)};
          float g = uGrime;
          vec3 c = diffuseColor.rgb;
          float macroN = gFbm(wp * 0.18);
          c *= mix(1.0, 0.8 + 0.4 * macroN, g * ${f(macro)});
          float streak = gFbm(vec3(wp.x * 2.3 + wp.z * 2.3, wp.y * 0.11, 0.0));
          c *= mix(1.0, 1.0 - 0.38 * smoothstep(0.42, 0.78, streak), g * ${f(streaks)});
          float groundN = 1.0 - smoothstep(0.0, 2.4, vGW.y);
          c *= mix(1.0, 0.62, groundN * g * ${f(ground)});
          ${rust ? `float r = smoothstep(0.52, 0.72, gFbm(vGW * 2.7));
          c = mix(c, vec3(0.16, 0.06, 0.025), r * g * ${f(rust)});` : ''}
          diffuseColor.rgb = c;
        }`);
  };
  mat.customProgramCacheKey = () => `grime${macro}${streaks}${ground}${rust}${scale}`;
}

// ---------------------------------------------------------------------------
// Window glass with "interior mapping": a ray from the camera is traced into an
// imaginary box-shaped room behind each pane, so every window shows a room with
// floor, walls, ceiling, furniture and curtains that shift with parallax.
// The whole room costs one quad (2 triangles). The glass itself is a regular
// PBR surface, so reflections and the Fresnel effect come from the standard path.
// ---------------------------------------------------------------------------
const INTERIOR_GLSL = /* glsl */`
uniform vec3 uRoomMin;
uniform vec3 uRoomMax;
uniform vec2 uWinHalf;
uniform float uNight;
uniform float uDay;
uniform float uInterior;
varying vec3 vIPos;
varying vec3 vICam;
varying vec4 vWin;

float iH(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
vec3 iPal(float s){
  if (s < 0.22) return vec3(0.80, 0.78, 0.72);
  if (s < 0.40) return vec3(0.66, 0.71, 0.68);
  if (s < 0.55) return vec3(0.83, 0.71, 0.56);
  if (s < 0.68) return vec3(0.55, 0.62, 0.70);
  if (s < 0.80) return vec3(0.74, 0.54, 0.47);
  return vec3(0.86, 0.85, 0.82);
}
float boxM(vec2 p, vec2 c, vec2 h){ vec2 d = abs(p - c) - h; return 1.0 - step(0.0, max(d.x, d.y)); }

vec3 interiorColor(){
  vec3 p = vec3(vIPos.xy, 0.0);
  vec3 d = normalize(vIPos - vICam);
  d.z = min(d.z, -0.02);
  float s = vWin.x;
  float lightOn = vWin.z;
  vec3 bmin = uRoomMin;
  vec3 bmax = uRoomMax;
#if INTERIOR_VARIANT == 0
  bmin.x -= iH(s * 3.1) * 0.8; bmax.x += iH(s * 5.7) * 0.8; bmin.z -= iH(s * 9.3) * 2.0;
#endif
  vec3 dd = d + vec3(1e-5);
  vec3 tv = (mix(bmin, bmax, step(0.0, dd)) - p) / dd;
  float t = min(min(tv.x, tv.y), tv.z);
  vec3 h = p + d * t;
  float fy = h.y - bmin.y;
  vec3 col;
  float bright = 1.0;

#if INTERIOR_VARIANT == 0
  // ---------------- apartment ----------------
  vec3 wall = iPal(iH(s * 17.0));
  if (t == tv.z) {
    col = wall;
    float fx = h.x;
    vec2 pc = vec2(mix(bmin.x + 0.8, bmax.x - 0.8, iH(s * 29.0)), 1.6);
    col = mix(col, vec3(0.1), boxM(vec2(fx, fy), pc, vec2(0.36, 0.27)));
    col = mix(col, iPal(iH(s * 31.0)) * vec3(0.6, 0.8, 1.0), boxM(vec2(fx, fy), pc, vec2(0.31, 0.22)));
    float ft = iH(s * 23.0);
    if (ft < 0.42) {
      float sx = mix(bmin.x + 1.1, bmax.x - 1.1, iH(s * 37.0));
      vec3 sc = mix(vec3(0.22, 0.2, 0.18), vec3(0.12, 0.22, 0.32), iH(s * 41.0));
      col = mix(col, sc * 0.75, boxM(vec2(fx, fy), vec2(sx, 0.48), vec2(1.0, 0.3)));
      col = mix(col, sc, boxM(vec2(fx, fy), vec2(sx, 0.22), vec2(1.0, 0.22)));
    } else if (ft < 0.74) {
      float bx = mix(bmin.x + 0.7, bmax.x - 0.7, iH(s * 43.0));
      vec2 cell = floor(vec2(fx * 14.0, fy * 2.8));
      vec3 book = mix(vec3(0.5, 0.14, 0.1), vec3(0.14, 0.24, 0.42), iH(cell.x + cell.y * 7.0)) * (0.45 + 0.6 * iH(cell.x * 3.0 + cell.y));
      vec3 shc = mix(book, vec3(0.28, 0.19, 0.12), step(0.8, fract(fy * 2.8)));
      col = mix(col, shc, boxM(vec2(fx, fy), vec2(bx, 1.0), vec2(0.6, 1.0)));
    } else {
      float dx = mix(bmin.x + 0.7, bmax.x - 0.7, iH(s * 47.0));
      col = mix(col, vec3(0.05, 0.045, 0.04), boxM(vec2(fx, fy), vec2(dx, 1.05), vec2(0.45, 1.05)));
    }
  } else if (t == tv.x) {
    col = wall * 0.86;
    float side = step(0.0, d.x);
    float cz = mix(bmin.z + 0.6, -0.9, iH(s * 53.0 + side));
    vec3 cc = mix(vec3(0.33, 0.23, 0.16), vec3(0.82), step(0.55, iH(s * 59.0 + side)));
    col = mix(col, cc, boxM(vec2(h.z, fy), vec2(cz, 0.95), vec2(0.35, 0.95)));
  } else if (d.y < 0.0) {
    float plank = floor(h.x * 5.0);
    col = vec3(0.4, 0.27, 0.16) * (0.75 + 0.35 * iH(plank + floor(h.z * 0.8 + iH(plank) * 3.0) * 13.0 + s * 7.0));
    vec2 rc = vec2((bmin.x + bmax.x) * 0.5, mix(bmin.z, bmax.z, 0.45));
    col = mix(col, iPal(iH(s * 61.0)) * 0.55, boxM(h.xz, rc, vec2(1.0, 0.8)) * step(0.4, iH(s * 67.0)));
  } else {
    col = vec3(0.86, 0.85, 0.82);
    vec2 lc = vec2((bmin.x + bmax.x) * 0.5, mix(bmin.z, bmax.z, 0.5));
    col += (1.0 - smoothstep(0.1, 0.18, length(h.xz - lc))) * lightOn * vec3(5.0, 3.8, 2.6);
  }
#elif INTERIOR_VARIANT == 1
  // ---------------- corner store ----------------
  bright = 1.6;
  if (t == tv.z || t == tv.x) {
    float u = (t == tv.z) ? h.x : h.z;
    vec2 cell = floor(vec2(u * 7.0, fy * 2.6));
    vec3 prod = vec3(iH(cell.x * 1.7 + cell.y * 9.1), iH(cell.x * 3.1 + cell.y * 2.3), iH(cell.x * 5.3 + cell.y * 7.7));
    prod = mix(vec3(0.85), prod, 0.75) * (0.55 + 0.45 * step(0.25, fract(u * 7.0)));
    float shelf = step(0.82, fract(fy * 2.6));
    col = mix(prod, vec3(0.75), shelf);
    col = mix(vec3(0.82, 0.8, 0.76), col, step(fy, 2.3));
    if (t == tv.x && d.x > 0.0) col = mix(col, vec3(0.75, 0.9, 1.0) * 1.6, step(fy, 2.1) * step(0.08, fract(h.z * 0.9)) * 0.6);
  } else if (d.y < 0.0) {
    vec2 tq = floor(h.xz * 2.5);
    col = mix(vec3(0.82), vec3(0.18), mod(tq.x + tq.y, 2.0));
    col = mix(col, vec3(0.35, 0.22, 0.14), boxM(h.xz, vec2(bmax.x - 1.2, -2.0), vec2(0.6, 1.4)));
  } else {
    col = vec3(0.85);
    float strip = 1.0 - smoothstep(0.03, 0.06, abs(fract(h.x * 0.5) - 0.5));
    col += strip * vec3(6.0, 6.2, 6.4);
  }
#elif INTERIOR_VARIANT == 3
  // ---------------- palace hall ----------------
  bright = 1.15;
  vec3 silk = mix(vec3(0.55, 0.12, 0.1), vec3(0.2, 0.42, 0.3), step(0.5, iH(s * 13.0)));
  silk = mix(silk, vec3(0.86, 0.82, 0.72), step(0.75, iH(s * 19.0)));
  if (t == tv.z || t == tv.x) {
    float u = (t == tv.z) ? h.x : h.z;
    float bay = fract(u * 0.33);
    float pil = 1.0 - step(0.12, bay) * step(bay, 0.88);
    col = mix(silk, vec3(0.93, 0.9, 0.82), step(fy, 1.0));
    col = mix(col, vec3(0.78, 0.6, 0.25), pil);
    col = mix(col, vec3(0.92, 0.88, 0.8), step(bmax.y - bmin.y - 1.2, fy));
    if (t == tv.z) {
      vec2 pc = vec2((bmin.x + bmax.x) * 0.5 + (iH(s * 7.0) - 0.5) * 2.0, 3.0);
      col = mix(col, vec3(0.75, 0.58, 0.22), boxM(vec2(h.x, fy), pc, vec2(0.95, 1.2)));
      col = mix(col, vec3(0.32, 0.26, 0.18) * (0.6 + 0.6 * iH(floor(h.x * 3.0) + floor(fy * 2.0) * 5.0)), boxM(vec2(h.x, fy), pc, vec2(0.82, 1.06)));
    }
  } else if (d.y < 0.0) {
    vec2 q = floor(h.xz * 1.4);
    vec2 f2 = fract(h.xz * 1.4);
    float herring = step(0.5, fract((q.x + q.y) * 0.5));
    col = mix(vec3(0.42, 0.25, 0.12), vec3(0.58, 0.38, 0.18), herring) * (0.8 + 0.2 * step(0.06, min(f2.x, f2.y)));
  } else {
    col = vec3(0.93, 0.9, 0.82);
    vec2 lc = vec2((bmin.x + bmax.x) * 0.5, mix(bmin.z, bmax.z, 0.5));
    float r = length(h.xz - lc);
    col = mix(col, vec3(0.8, 0.62, 0.28), step(abs(r - 1.6), 0.08));
    col += (1.0 - smoothstep(0.35, 0.7, r)) * vec3(4.0, 3.4, 2.4) * (0.4 + lightOn);
  }
#else
  // ---------------- residential lobby ----------------
  bright = 1.3;
  if (t == tv.z) {
    col = vec3(0.78, 0.72, 0.62);
    col = mix(col, vec3(0.42, 0.4, 0.38), boxM(vec2(h.x, fy), vec2(0.0, 1.1), vec2(0.6, 1.1)));
    col = mix(col, vec3(0.3, 0.22, 0.15), step(fy, 0.9) * (1.0 - boxM(vec2(h.x, fy), vec2(0.0, 1.1), vec2(0.6, 1.1))));
  } else if (t == tv.x) {
    col = vec3(0.74, 0.68, 0.58);
    vec2 mb = vec2(h.z * 6.0, fy * 5.0);
    float box = boxM(vec2(h.z, fy), vec2(-3.0, 1.3), vec2(0.9, 0.5));
    col = mix(col, vec3(0.55, 0.42, 0.18) * (0.7 + 0.3 * step(0.12, fract(mb.x)) * step(0.12, fract(mb.y))), box);
    col = mix(col, vec3(0.3, 0.22, 0.15), step(fy, 0.9) * (1.0 - box));
  } else if (d.y < 0.0) {
    vec2 tq = floor(h.xz * 2.0 + 0.5);
    col = mix(vec3(0.85, 0.84, 0.8), vec3(0.08), mod(tq.x + tq.y, 2.0));
  } else {
    col = vec3(0.86, 0.83, 0.76);
    col += (1.0 - smoothstep(0.15, 0.3, length(h.xz - vec2(0.0, -3.0)))) * vec3(5.0, 4.0, 2.6);
  }
  lightOn = 1.0;
#endif

  // Lighting inside the room: daylight falls off with depth, lamps add warm light.
  float depth = -h.z;
  float daylight = uDay * mix(1.0, 0.3, smoothstep(0.0, 5.0, depth));
  vec3 lamp = lightOn * vec3(1.0, 0.74, 0.48) * mix(0.18, 0.65, uNight) * (1.0 - 0.45 * smoothstep(0.0, 6.0, depth));
  vec3 e = min(h - bmin, bmax - h);
  float mid = e.x + e.y + e.z - min(e.x, min(e.y, e.z)) - max(e.x, max(e.y, e.z));
  float ao = 0.5 + 0.5 * smoothstep(0.0, 0.8, mid);
  col = col * (daylight + lamp) * ao * bright;

#if INTERIOR_VARIANT == 0 || INTERIOR_VARIANT == 3
  // Window treatments sit just behind the glass (parallax planes, no geometry).
  float type = vWin.y;
  vec2 hw = uWinHalf;
  float front = uDay * 0.8 + lightOn * mix(0.12, 0.7, uNight);
  if (type > 0.5 && type < 1.5) {
    vec3 cp = p + d * (-0.10 / d.z);
    float panel = hw.x * (1.05 - vWin.w * 0.8);
    float cover = step(hw.x + 0.08 - abs(cp.x), panel);
    float folds = 0.7 + 0.3 * sin(cp.x * 38.0 + sin(cp.y * 2.0 + s * 10.0) * 1.5);
    col = mix(col, iPal(iH(s * 71.0)) * folds * front, cover);
  } else if (type > 1.5 && type < 2.5) {
    vec3 bp = p + d * (-0.06 / d.z);
    float bottom = hw.y + 0.05 - vWin.w * (2.0 * hw.y + 0.1);
    if (bp.y > bottom) {
      float fr = fract(bp.y * 20.0);
      vec3 bc = vec3(0.86, 0.84, 0.79) * (0.6 + 0.4 * fr) * front;
      col = mix(bc, col, step(0.86, fr) * 0.8);
      col = mix(col, bc * 0.7, step(bp.y, bottom + 0.04));
    }
  } else if (type > 2.5) {
    vec3 sp = p + d * (-0.08 / d.z);
    col = mix(col, vec3(0.9, 0.88, 0.84) * (0.85 + 0.15 * sin(sp.x * 30.0)) * front, 0.72);
  }
#endif
  return col * uInterior;
}
`;

export function makeGlass(variant, room) {
  const m = new THREE.MeshStandardMaterial({ color: 0x030405, roughness: 0.03, metalness: 0, envMapIntensity: 1.7 });
  m.defines = { INTERIOR_VARIANT: variant };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRoomMin = { value: room.min };
    sh.uniforms.uRoomMax = { value: room.max };
    sh.uniforms.uWinHalf = { value: room.half };
    sh.uniforms.uNight = shared.uNight;
    sh.uniforms.uDay = shared.uDay;
    sh.uniforms.uInterior = shared.uInterior;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aWin;\nvarying vec3 vIPos;\nvarying vec3 vICam;\nvarying vec4 vWin;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        mat4 iw = modelMatrix;
        #ifdef USE_INSTANCING
          iw = modelMatrix * instanceMatrix;
        #endif
        vIPos = position;
        vICam = (inverse(iw) * vec4(cameraPosition, 1.0)).xyz;
        vWin = aWin;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + INTERIOR_GLSL)
      // Old glass is never perfectly flat: tilt each pane a little so reflections break up.
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(normal + vec3((vWin.x - 0.5) * 0.05, (fract(vWin.x * 7.13) - 0.5) * 0.05, 0.0)
                                  + vec3(sin(vIPos.y * 23.0 + vWin.x * 40.0), 0.0, 0.0) * 0.006);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += interiorColor();');
  };
  m.customProgramCacheKey = () => 'glass' + variant;
  return m;
}

// ---------------------------------------------------------------------------
// Small textures drawn at runtime (zero download cost).
// ---------------------------------------------------------------------------
export function canvasTex(w, h, draw, { srgb = true, repeat = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function fitText(g, text, x, y, maxW, font, size) {
  let s = size;
  do { g.font = font.replace('$', s); s -= 2; } while (g.measureText(text).width > maxW && s > 10);
  g.fillText(text, x, y);
}

// Sign atlas: both shop signs and the gold-leaf address transom share one texture.
export const SIGN_REGIONS = {
  deli: [0, 0, 2048, 160],
  cafe: [0, 160, 2048, 160],
  number: [0, 320, 700, 192],
};
function signAtlas() {
  return canvasTex(2048, 512, (g, w) => {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#103528'; g.fillRect(0, 0, w, 160);
    g.strokeStyle = '#c9a54a'; g.lineWidth = 6; g.strokeRect(12, 12, w - 24, 136);
    g.fillStyle = '#f2e7c9';
    fitText(g, 'BLEECKER DELI & GROCERY', w / 2, 84, w - 160, 'bold $px Georgia, serif', 96);
    g.fillStyle = '#2a1812'; g.fillRect(0, 160, w, 160);
    g.fillStyle = '#e8c27a';
    fitText(g, 'Café Luna  ·  Espresso Bar', w / 2, 244, w - 220, 'italic bold $px Georgia, serif', 104);
    g.fillStyle = '#06080a'; g.fillRect(0, 320, 700, 192);
    g.fillStyle = '#d6aa3f'; g.font = 'bold 128px Georgia, serif';
    g.fillText('245', 350, 420);
    g.strokeStyle = 'rgba(214,170,63,0.7)'; g.lineWidth = 4; g.strokeRect(150, 345, 400, 150);
  });
}
function awningTex() {
  return canvasTex(256, 64, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#e9e0c8' : '#1d4a3a'; g.fillRect(i * 32, 0, 32, h); }
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 18; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
  }, { repeat: true });
}
function gratingTex() {
  return canvasTex(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64); g.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) g.fillRect(0, i * 16 + 2, 64, 9);
    g.fillRect(0, 0, 6, 64); g.fillRect(32, 0, 6, 64);
  }, { srgb: false, repeat: true });
}
function railCardTex() {
  return canvasTex(256, 128, (g) => {
    g.clearRect(0, 0, 256, 128); g.fillStyle = '#fff';
    g.fillRect(0, 0, 256, 7); g.fillRect(0, 60, 256, 4); g.fillRect(0, 121, 256, 7);
    for (let i = 0; i < 8; i++) g.fillRect(i * 32 + 14, 0, 4, 128);
  }, { srgb: false, repeat: true });
}
function acTex() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#b9b4a8'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#8f8b82';
    for (let y = 14; y < 118; y += 9) g.fillRect(10, y, 108, 4);
    g.strokeStyle = '#a9a59b'; g.lineWidth = 4; g.strokeRect(4, 4, 120, 120);
  });
}

// ---------------------------------------------------------------------------
// Texture loader shared by every site. Records each file for the assets panel.
export function makeLoader(renderer, manager) {
  const loader = new THREE.TextureLoader(manager);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const assets = [];

  function tex(name, map, srgb, tile) {
    const path = `${TEX}${name}/${map}.jpg`;
    const t = loader.load(path);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    t.repeat.set(1 / tile, 1 / tile);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    assets.push({ path, texture: t });
    return t;
  }
  // All geometry UVs are in metres, so `tile` is the real-world size of the texture.
  function pbr(name, tile, params = {}) {
    const arm = tex(name, 'arm', false, tile); // AO / roughness / metal packed in one file
    return new THREE.MeshStandardMaterial({
      map: tex(name, 'diff', true, tile),
      normalMap: tex(name, 'nor_gl', false, tile),
      aoMap: arm,
      roughnessMap: arm,
      ...params,
    });
  }
  return { tex, pbr, assets };
}

// Walls are single-sided planes, so let them cast shadows from both sides.
export function finalizeMaterials(m) {
  for (const mat of Object.values(m)) {
    mat.shadowSide = THREE.DoubleSide;
    if (mat.normalMap) mat.userData.normalMap = mat.normalMap;
  }
}

export function createMaterials(renderer, manager) {
  const { pbr, assets } = makeLoader(renderer, manager);
  const m = {};
  m.brick = pbr('brick_wall_001', 1.1, { color: 0xf2e2da }); // ~14 courses per tile
  addGrime(m.brick, { macro: 1, streaks: 1, ground: 1 });
  m.limestone = pbr('beige_wall_001', 2.4, { color: 0xf3e3c6 });
  addGrime(m.limestone, { macro: 0.7, streaks: 1.1, ground: 1 });
  m.granite = pbr('granite_tile', 2.3, { color: 0xb0b0b0 });
  addGrime(m.granite, { macro: 0.5, streaks: 0.3, ground: 0.4 });
  m.roof = pbr('tarred_gravel', 2.2);
  addGrime(m.roof, { macro: 1, streaks: 0, ground: 0 });
  m.wood = pbr('weathered_planks', 2.0, { color: 0xc4a88c });
  addGrime(m.wood, { macro: 0.8, streaks: 1.2, ground: 0 });
  m.concrete = pbr('concrete_pavement', 1.8);
  addGrime(m.concrete, { macro: 1, streaks: 0, ground: 0, scale: 0.6 });
  m.asphalt = pbr('asphalt_01', 2.08, { color: 0xffffff });
  addGrime(m.asphalt, { macro: 1.2, streaks: 0, ground: 0, scale: 0.4 });

  // Untextured materials: colour + roughness is enough at these sizes.
  m.frame = new THREE.MeshStandardMaterial({ color: 0xe6e1d6, roughness: 0.42 });
  addGrime(m.frame, { macro: 0.5, streaks: 0.8, ground: 0.5 });
  m.iron = new THREE.MeshStandardMaterial({ color: 0x18191a, roughness: 0.55, metalness: 0.35 });
  addGrime(m.iron, { macro: 0.4, streaks: 0, ground: 0, rust: 0.75 });
  m.storeMetal = new THREE.MeshStandardMaterial({ color: 0x2a251f, roughness: 0.35, metalness: 0.7 });
  m.doorWood = new THREE.MeshStandardMaterial({ color: 0x3b2114, roughness: 0.32 });
  m.brass = new THREE.MeshStandardMaterial({ color: 0xc19a4a, roughness: 0.28, metalness: 1 });
  m.galv = new THREE.MeshStandardMaterial({ color: 0x9a9d9e, roughness: 0.45, metalness: 0.75 });
  addGrime(m.galv, { macro: 0.6, streaks: 0.6, ground: 0 });
  m.dark = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.7 });
  m.lamp = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffc977, emissiveIntensity: 0.6, roughness: 0.2 });

  const signs = signAtlas();
  m.sign = new THREE.MeshStandardMaterial({ map: signs, emissiveMap: signs, emissive: 0xffffff, emissiveIntensity: 0.05, roughness: 0.4, metalness: 0.2 });
  m.awning = new THREE.MeshStandardMaterial({ map: awningTex(), roughness: 0.9, side: THREE.DoubleSide });
  m.awning.map.repeat.set(1 / 2, 1);
  addGrime(m.awning, { macro: 0.6, streaks: 0.9, ground: 0 });
  m.ac = new THREE.MeshStandardMaterial({ map: acTex(), roughness: 0.55 });
  addGrime(m.ac, { macro: 0.6, streaks: 1.2, ground: 0 });
  const grate = gratingTex();
  grate.repeat.set(1 / 0.12, 1 / 0.12);
  m.grating = new THREE.MeshStandardMaterial({ color: 0x18191a, roughness: 0.6, metalness: 0.35, alphaMap: grate, alphaTest: 0.5, side: THREE.DoubleSide });
  const rc = railCardTex();
  rc.repeat.set(1 / 0.96, 1);
  m.railCard = new THREE.MeshStandardMaterial({ color: 0x18191a, roughness: 0.6, metalness: 0.35, alphaMap: rc, alphaTest: 0.5, side: THREE.DoubleSide });

  // Glass variants (rooms, store, lobby) + cheap versions for the optimized level.
  const W = 1.25, H = 1.95;
  m.glassRoom = makeGlass(0, { min: new THREE.Vector3(-1.5, -(0.85 + H / 2), -4.0), max: new THREE.Vector3(1.5, 3.2 - 0.3 - 0.85 - H / 2, 0), half: new THREE.Vector2(W / 2, H / 2) });
  m.glassStore = makeGlass(1, { min: new THREE.Vector3(-4.4, -2.1, -6.5), max: new THREE.Vector3(4.4, 1.9, 0), half: new THREE.Vector2(4, 1.5) });
  m.glassLobby = makeGlass(2, { min: new THREE.Vector3(-1.6, -1.7, -8.0), max: new THREE.Vector3(1.6, 1.7, 0), half: new THREE.Vector2(0.33, 0.62) });
  m.glassSimple = new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.05, envMapIntensity: 1.6 });
  m.glassPlain = new THREE.MeshStandardMaterial({ color: 0x0b0e11, roughness: 0.03, envMapIntensity: 1.7 });

  finalizeMaterials(m);

  const generated = [
    { path: 'sign atlas (canvas)', w: 2048, h: 512 },
    { path: 'awning stripes (canvas)', w: 256, h: 64 },
    { path: 'AC grille (canvas)', w: 128, h: 128 },
    { path: 'fire-escape grating (canvas)', w: 64, h: 64 },
    { path: 'railing card (canvas)', w: 256, h: 128 },
  ];
  return { mats: m, assets, generated };
}
