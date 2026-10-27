import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { shared } from './materials.js';
import { createImpostor } from './impostor.js';
import { FlyControls } from './fly.js';

// Which building to show: <body data-site="palace"> loads site-palace.js, default is New York.
const siteName = document.body.dataset.site || 'nyc';
let site;
try { site = (await import("./site-sb-scene.js")).default; }
catch(error){
 const box=document.querySelector('#loading .box');
 if(box){box.replaceChildren();const title=document.createElement('div');title.textContent='The model could not load';const detail=document.createElement('p');detail.textContent=error.message;const retry=document.createElement('button');retry.textContent='Retry loading';retry.onclick=()=>location.reload();box.append(title,detail,retry);}
 throw error;
}
document.title = site.title;
if(siteName.startsWith('sb')&&new URLSearchParams(location.search).has('clean')){document.getElementById('stats').style.display='none';const controls=document.getElementById('controls');if(controls)controls.open=false;}

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
if(site.staticShadows)renderer.shadowMap.autoUpdate=false;
renderer.info.autoReset = false; // count shadow passes too

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, site.cameraNear || 0.05, 8000);
camera.position.set(...Object.values(site.presets)[0][1]);

const orbit = new OrbitControls(camera, canvas);
orbit.target.set(...Object.values(site.presets)[0][2]);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.minDistance = site.cameraNear ? site.cameraNear * 1.5 : 0.3;
orbit.maxDistance = 1200;
orbit.maxPolarAngle = Math.PI * 0.497;
orbit.zoomToCursor = true;
const fly = new FlyControls(camera, canvas);

// ---------------------------------------------------------------- sky + sun
const sky = new Sky();
sky.scale.setScalar(6000);
scene.add(sky);
const skyU = sky.material.uniforms;
skyU.turbidity.value = 3.5;
skyU.rayleigh.value = 1.1;
skyU.mieCoefficient.value = 0.004;
skyU.mieDirectionalG.value = 0.82;
// (a site can ask for its own sky: a hazier one lights its colours more truly)
for (const [k, v] of Object.entries(site.sky || {})) skyU[k].value = v;

// Environment map (reflections + ambient light) is rendered from the same sky,
// with a grey ground disc so downward-facing reflections aren't black.
const envScene = new THREE.Scene();
const envSky = new Sky();
envSky.material = sky.material;
envSky.scale.setScalar(80);
envScene.add(envSky);
const envGround = new THREE.Mesh(new THREE.CircleGeometry(60, 32).rotateX(-Math.PI / 2).translate(0, -3, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.09, 0.085, 0.08) }));
envScene.add(envGround);
// (and its own ground for that light: a street's sunlit pavement and fronts throw warm light into the shade)
if (site.bounce) envGround.material.color.setRGB(...site.bounce);
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;
function updateEnv() {
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene, 0.02, 0.1, 200);
  scene.environment = envRT.texture;
}

const sun = new THREE.DirectionalLight(0xffffff, 3.6);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const SE = site.shadow.extent;
Object.assign(sun.shadow.camera, { left: -SE, right: SE, top: SE, bottom: -SE, near: 1, far: site.shadow.far });
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.025;
sun.target.position.set(...site.shadow.target);
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0x8fa6d6, 0x1a1a1a, 0);
scene.add(hemi);

// ---------------------------------------------------------------- building
const manager = new THREE.LoadingManager();
const { mats, assets, generated } = site.createMaterials(renderer, manager);
const full = site.build(mats, 'high');
const mid = site.build(mats, 'mid');
const imp = createImpostor(mats, site.impostor);
const ground = site.buildGround(mats);
scene.add(full, mid, imp.group, ground);
if(site.anisotropy){const anisotropy=Math.min(site.anisotropy,renderer.capabilities.getMaxAnisotropy());scene.traverse(o=>{if(o.isMesh)for(const m of(Array.isArray(o.material)?o.material:[o.material]))for(const key of['map','normalMap','roughnessMap','metalnessMap'])if(m[key]){m[key].anisotropy=anisotropy;m[key].needsUpdate=true;}});}
const LEVELS = { full, mid, impostor: imp.group };

// Optional contact shading for the architectural study; all other lab sites retain their renderer.
let composer=null,aoPass=null;
if(site.contactShadows) {
  const [{EffectComposer},{RenderPass},{GTAOPass},{OutputPass}]=await Promise.all([
    import('three/addons/postprocessing/EffectComposer.js'),import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/GTAOPass.js'),import('three/addons/postprocessing/OutputPass.js')]);
  const colorTarget=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:4});
  composer=new EffectComposer(renderer,colorTarget);composer.setPixelRatio(Math.min(devicePixelRatio,2));composer.setSize(innerWidth,innerHeight);
  composer.addPass(new RenderPass(scene,camera));
  aoPass=new GTAOPass(scene,camera,innerWidth,innerHeight);aoPass.updateGtaoMaterial({radius:1.0,thickness:.12,distanceFallOff:1,samples:12});aoPass.blendIntensity=.45;
  composer.addPass(aoPass);composer.addPass(new OutputPass());
  const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=true;input.id='contactShadows';
  input.addEventListener('change',()=>{aoPass.enabled=input.checked;});label.append(input,document.createTextNode(' Contact shadows'));
  document.getElementById('shadows').closest('label').after(label);
}
function renderVisual(){if(composer)composer.render();else renderer.render(scene,camera);}

// ---------------------------------------------------------------- time of day
const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
let bakeTimer = 0;
function setTime(h) {
  const el = THREE.MathUtils.degToRad(62 * Math.sin(Math.PI * (h - 6) / 12));
  const az = THREE.MathUtils.degToRad(90 + 180 * (h - 6) / 12);
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  skyU.sunPosition.value.copy(dir);
  const elDeg = THREE.MathUtils.radToDeg(el);
  const day = smooth(-2, 8, elDeg);
  const night = 1 - smooth(-4, 10, elDeg);
  sun.position.copy(sun.target.position).addScaledVector(dir, site.shadow.far * 0.45);
  sun.intensity = 3.6 * smooth(-1, 6, elDeg);
  sun.color.set(0xffa860).lerp(new THREE.Color(0xfff3e2), smooth(2, 35, elDeg));
  hemi.intensity = 0.35 * night;
  shared.uNight.value = night;
  shared.uDay.value = 0.02 + 0.17 * day;
  renderer.toneMappingExposure = THREE.MathUtils.lerp(0.62, 1.6, night);
  if (site.onTime) site.onTime(mats, night);
  updateEnv();
  renderer.shadowMap.needsUpdate=true;
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  document.getElementById('timeLabel').textContent = `${hh}:${String(mm).padStart(2, '0')}`;
  clearTimeout(bakeTimer);
  bakeTimer = setTimeout(bakeImpostor, 120);
}

function bakeImpostor() {
  if(site.levels&&!site.levels.includes('impostor'))return;
  const vis = new Map();
  imp.bake(renderer, scene, () => {
    for (const o of [full, mid, imp.group, ground, sky]) vis.set(o, o.visible);
    full.visible = true; mid.visible = false; imp.group.visible = false; ground.visible = false; sky.visible = false;
  }, () => { for (const [o, v] of vis) o.visible = v; });
}

// ---------------------------------------------------------------- quality / LOD
let quality = 'full';
let level = null;
const SHADOW_RES = { full: 4096, mid: 2048, impostor: 1024 };
const [LOD_NEAR, LOD_FAR] = site.lod; // metres from the building centre
const center = new THREE.Vector3(...site.center);

function pickLevel() {
  if (quality !== 'auto') return quality;
  const d = camera.position.distanceTo(center);
  return d < LOD_NEAR ? 'full' : d < LOD_FAR ? 'mid' : 'impostor';
}
function applyLevel(l) {
  if (l === level) return;
  level = l;
  renderer.shadowMap.needsUpdate=true;
  for (const [k, g] of Object.entries(LEVELS)) g.visible = k === l;
  if (sun.shadow.mapSize.x !== SHADOW_RES[l]) {
    sun.shadow.mapSize.set(SHADOW_RES[l], SHADOW_RES[l]);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  renderParts();
}

// ---------------------------------------------------------------- toggles
const allMats = () => [...Object.values(mats), imp.group.children[0].material];
function setWire(on) { renderer.shadowMap.needsUpdate=true; for (const m of allMats()) { m.wireframe = on; } document.getElementById('wire').checked = on; }
function setNormals(on) { for (const m of allMats()) if (m.userData.normalMap) { m.normalMap = on ? m.userData.normalMap : null; m.needsUpdate = true; } }
function setInterior(on) {
  full.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.userData.interiorMat && o.material.defines && 'INTERIOR_VARIANT' in o.material.defines) o.userData.interiorMat = o.material;
    if (o.userData.interiorMat) o.material = on ? o.userData.interiorMat : mats.glassPlain;
  });
  bakeImpostor();
}
function setShadows(on) { sun.castShadow = on; renderer.shadowMap.needsUpdate=true; }

document.querySelectorAll('#quality button').forEach((b) => b.addEventListener('click', () => setQuality(b.dataset.q)));
// (a site can offer fewer levels: the others' buttons hidden)
if (site.levels) document.querySelectorAll('#quality button').forEach((b) => { if (!site.levels.includes(b.dataset.q)) b.style.display = 'none'; });
function setQuality(q) {
  if (site.levels && !site.levels.includes(q)) return;
  quality = q;
  document.querySelectorAll('#quality button').forEach((b) => b.classList.toggle('on', b.dataset.q === q));
}
document.getElementById('wire').addEventListener('change', (e) => setWire(e.target.checked));
document.getElementById('normals').addEventListener('change', (e) => setNormals(e.target.checked));
document.getElementById('interior').addEventListener('change', (e) => setInterior(e.target.checked));
document.getElementById('shadows').addEventListener('change', (e) => setShadows(e.target.checked));
document.getElementById('grime').addEventListener('change', (e) => { shared.uGrime.value = e.target.checked ? 1 : 0; bakeImpostor(); });
const timeInput = document.getElementById('time');
timeInput.value = site.startTime;
timeInput.addEventListener('input', () => setTime(parseFloat(timeInput.value)));

// ---------------------------------------------------------------- camera modes + presets
let mode = 'orbit';
function setMode(m) {
  mode = m;
  fly.enabled = m === 'fly';
  orbit.enabled = m === 'orbit';
  if (m === 'orbit') {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const dist = THREE.MathUtils.clamp(camera.position.distanceTo(center) * 0.6, 4, 60);
    orbit.target.copy(camera.position).addScaledVector(fwd, dist);
    orbit.update();
  }
  tween = null;
  document.getElementById('modeLabel').textContent = m === 'fly' ? 'Fly' : 'Orbit';
}
fly.onKeyStart = () => {if(!document.body.dataset.orbitTour)setMode('fly');};

let tween = null;
function goTo(name) {
  if (mode !== 'orbit') setMode('orbit');
  const [, p, t] = site.presets[name];
  tween = { p0: camera.position.clone(), t0: orbit.target.clone(), p1: new THREE.Vector3(...p), t1: new THREE.Vector3(...t), k: 0 };
}
// (for scripted shots: put the camera at p looking at t)
window.__scene = scene; window.__THREE = THREE; window.__camera = camera; window.__renderer = renderer;
if(site.configure)site.configure({scene,renderer,camera,sun,aoPass});
window.__rig = () => ({ camera, target: orbit.target, sun, dt: 0, view: (p, t) => window.__view(p, t) });
// (a picture now, without waiting for the next frame: works while the page is hidden)
window.__shot = (q = .88) => { renderVisual(); return canvas.toDataURL('image/jpeg', q); };
window.__view = (p, t) => { if (mode !== 'orbit') setMode('orbit'); tween = null; camera.position.set(...p); orbit.target.set(...t); orbit.update(); };
// Visitor shell: the study controls remain unchanged on other pages.
if(document.body.dataset.visitor){
 window.__visitor={
  navigate(p,t,duration=3){if(mode!=='orbit')setMode('orbit');fly.keys.clear();const p1=new THREE.Vector3(...p),t1=new THREE.Vector3(...t);const distant=camera.position.distanceTo(p1)>24;const points=[camera.position.clone()];if(distant){const a=camera.position.clone();a.y=Math.max(92,a.y);const b=p1.clone();b.y=Math.max(92,b.y);points.push(a,b);}points.push(p1);tween={p0:camera.position.clone(),t0:orbit.target.clone(),p1,t1,k:0,duration,path:distant?new THREE.CatmullRomCurve3(points):null};if(duration===0)window.__view(p,t);},
  cancel(){tween=null;},dolly(amount){tween=null;camera.translateZ(amount);camera.position.y=Math.max(.3,camera.position.y);},mode(m){setMode(m);fly.keys.clear();fly.speed=20;},key(code,down){down?fly.keys.add(code):fly.keys.delete(code);},stop(){fly.keys.clear();},
 };
 canvas.addEventListener('pointerdown',()=>{tween=null;});canvas.addEventListener('wheel',()=>{tween=null;},{passive:true});
}
const presetBox = document.getElementById('presets');
presetBox.innerHTML = '';
for (const [key, [label]] of Object.entries(site.presets)) {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', () => goTo(key));
  presetBox.append(b);
}

window.addEventListener('keydown', (e) => {
  if(document.body.dataset.visitor)return;
  if (e.target instanceof HTMLInputElement) return;
  if (e.code === 'KeyF') setMode(mode === 'fly' ? 'orbit' : 'fly');
  if (e.code === 'KeyX') setWire(!document.getElementById('wire').checked);
  const q = { Digit1: 'auto', Digit2: 'full', Digit3: 'mid', Digit4: 'impostor' }[e.code];
  if (q) setQuality(q);
});

// ---------------------------------------------------------------- stats panel
const gl = renderer.getContext();
const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
let query = null, queryActive = false, gpuMs = null;
function pollGpu() {
  if (!timer || !query || queryActive) return;
  if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) return;
  if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) {
    const ms = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
    gpuMs = gpuMs == null ? ms : gpuMs * 0.9 + ms * 0.1;
  }
  gl.deleteQuery(query);
  query = null;
}

const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(2) + ' M' : n >= 1e3 ? (n / 1e3).toFixed(1) + ' k' : String(Math.round(n));
const mb = (b) => (b / 1048576).toFixed(1) + ' MB';
const kb = (b) => b < 1048576 ? Math.round(b / 1024) + ' KB' : mb(b);

function trisOf(mesh) {
  const g = mesh.geometry;
  const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
  return n * (mesh.isInstancedMesh ? mesh.count : 1);
}
function renderParts() {
  const rows = [];
  LEVELS[level].traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const kind = o.isInstancedMesh ? `×${o.count}` : o.userData.parts ? `${o.userData.parts} merged` : '';
    rows.push({ label: o.userData.label || o.name, kind, tris: trisOf(o) });
  });
  rows.sort((a, b) => b.tris - a.tris);
  const total = rows.reduce((s, r) => s + r.tris, 0);
  document.getElementById('partsTable').innerHTML =
    `<tr><td class="dim">${rows.length} meshes (passes add calls)</td><td></td><td>${fmt(total)} tris</td></tr>` +
    rows.map((r) => `<tr><td>${r.label}</td><td>${r.kind}</td><td>${fmt(r.tris)}</td></tr>`).join('');
}

function renderAssets() {
  const res = new Map(performance.getEntriesByType('resource').map((e) => [new URL(e.name).pathname, e]));
  let dl = 0, gpu = 0;
  const rows = assets.map(({ path, texture }) => {
    const e = [...res.entries()].find(([p]) => p.endsWith(path));
    const bytes = e ? (e[1].encodedBodySize || e[1].transferSize) : 0;
    const w = texture.image?.width || 0, h = texture.image?.height || 0;
    const g = w * h * 4 * 1.333;
    dl += bytes; gpu += g;
    return `<tr><td>${path.replace('assets/textures/', '')}</td><td>${w}×${h}</td><td>${kb(bytes)}</td></tr>`;
  });
  for (const t of generated) gpu += t.w * t.h * 4 * 1.333;
  for (const model of site.models || []) { dl += model.bytes; rows.push(`<tr><td>${model.label}</td><td>3D model</td><td>${kb(model.bytes)}</td></tr>`); }
  // Count actual scene textures, including procedural and Blender materials.
  // Each shared texture object is counted once. Render targets are separate.
  gpu=0;const seenTextures=new Set();scene.traverse(o=>{if(!o.isMesh)return;for(const m of (Array.isArray(o.material)?o.material:[o.material]))for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap']){const t=m[key];if(!t||seenTextures.has(t))continue;seenTextures.add(t);const im=t.image;gpu+=(im?.width||0)*(im?.height||0)*4*(t.generateMipmaps?4/3:1);}});
  gpu += imp.bytes + (site.extraTextureBytes || 0);
  const shadowBytes = sun.shadow.mapSize.x * sun.shadow.mapSize.y * 4;
  document.getElementById('assetsTable').innerHTML =
    `<tr><td class="dim">Scene assets (download)</td><td></td><td>${mb(dl)}</td></tr>` +
    `<tr><td class="dim">GPU textures (est.)</td><td></td><td>${mb(gpu)}</td></tr>` +
    `<tr><td class="dim">Shadow map</td><td>${sun.shadow.mapSize.x}²</td><td>${mb(shadowBytes)}</td></tr>` +
    rows.join('') +
    generated.map((t) => `<tr><td>${t.path}</td><td>${t.w}×${t.h}</td><td>0 KB</td></tr>`).join('') +
    `<tr><td>impostor atlas (baked at runtime)</td><td>${imp.size}²</td><td>0 KB</td></tr>` +
    `<tr><td>three.js r170 (CDN; decoder extra)</td><td></td><td>~170 KB gz</td></tr>`;
}

const stat = { frames: 0, acc: 0, fps: 0, cpu: 0 };
function renderStats() {
  const i = renderer.info;
  const fpsClass = stat.fps >= 55 ? 'good' : stat.fps >= 30 ? 'warn' : 'bad';
  const d = camera.position.distanceTo(center);
  document.getElementById('statsTable').innerHTML = `
    <tr><td class="big ${fpsClass}">${stat.fps.toFixed(0)} fps</td><td class="dim">${(1000 / Math.max(stat.fps, 1)).toFixed(1)} ms/frame</td></tr>
    <tr><td>CPU (JS + draw submission)</td><td>${stat.cpu.toFixed(2)} ms</td></tr>
    <tr><td>GPU time</td><td>${gpuMs == null ? '<span class="dim">n/a</span>' : gpuMs.toFixed(2) + ' ms'}</td></tr>
    <tr><td>Draw calls (incl. shadow pass)</td><td>${i.render.calls}</td></tr>
    <tr><td>Triangles drawn (incl. shadow)</td><td>${fmt(i.render.triangles)}</td></tr>
    <tr><td>Geometries / textures</td><td>${i.memory.geometries} / ${i.memory.textures}</td></tr>
    <tr><td>Shader programs</td><td>${i.programs.length}</td></tr>
    <tr><td>Level of detail</td><td>${{ full: 'Full', mid: 'Optimized', impostor: 'Impostor' }[level]}${quality === 'auto' ? ' (auto)' : ''}</td></tr>
    <tr><td>Camera distance</td><td>${d.toFixed(1)} m</td></tr>
    <tr><td>Pixel ratio</td><td>${renderer.getPixelRatio()}</td></tr>`;
}

// ---------------------------------------------------------------- loading
const loadbar = document.getElementById('loadbar');
const loadtext = document.getElementById('loadtext');
manager.onProgress = (url, loaded, total) => {
  loadbar.style.width = `${(loaded / total) * 100}%`;
  loadtext.textContent = `${loaded} / ${total} textures`;
};
manager.onLoad = () => {
  renderer.compile(scene, camera);
  bakeImpostor();
  const el = document.getElementById('loading');
  el.style.opacity = 0;
  setTimeout(() => el.remove(), 400);
  setTimeout(renderAssets, 300);
};
// (a site whose textures all come through its own code has nothing for the loader to wait on)
if (!assets.length || site.assetsReady) setTimeout(() => manager.onLoad(), 1500);

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let statTimer = 0;
setTime(parseFloat(timeInput.value));
applyLevel('full');

function loop() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t0 = performance.now();

  if (tween) {
    tween.k = Math.min(1, tween.k + dt / (tween.duration || 1.2));
    const e = tween.k < 0.5 ? 4 * tween.k ** 3 : 1 - (-2 * tween.k + 2) ** 3 / 2;
    if(tween.path)camera.position.copy(tween.path.getPoint(e));else camera.position.lerpVectors(tween.p0, tween.p1, e);
    orbit.target.lerpVectors(tween.t0, tween.t1, e);
    if (tween.k >= 1) tween = null;
  }
  if (mode === 'orbit') {orbit.update();if(document.body.dataset.orbitTour&&camera.position.y<1.7){camera.position.y=1.7;camera.lookAt(orbit.target);}} else fly.update(dt);
  // (a site that builds as you go: told where the camera is each frame; the sun's shadow can follow)
  if (site.update) site.update({ camera, target: orbit.target, sun, dt, view: (p, t) => window.__view(p, t) });
  applyLevel(pickLevel());

  pollGpu();
  renderer.info.reset();
  if (timer && !query) { query = gl.createQuery(); gl.beginQuery(timer.TIME_ELAPSED_EXT, query); queryActive = true; }
  renderVisual();
  if (queryActive) { gl.endQuery(timer.TIME_ELAPSED_EXT); queryActive = false; }

  stat.cpu = stat.cpu * 0.9 + (performance.now() - t0) * 0.1;
  stat.frames++; stat.acc += dt; statTimer += dt;
  if (stat.acc >= 0.5) { stat.fps = stat.frames / stat.acc; stat.frames = 0; stat.acc = 0; }
  if (statTimer > 0.25) { statTimer = 0; renderStats(); }
}
renderer.setAnimationLoop(loop);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if(composer)composer.setSize(innerWidth,innerHeight);
});

// handy for debugging from the console
Object.assign(window, { THREE, renderer, scene, camera, orbit, full, mid, imp, mats, site, goTo, setQuality, setTime });

// Explicit production API for the orbit-only preview; no UI automation hooks.
if(document.body.dataset.orbitTour){
 window.__orbitTour={
  setup(){orbit.minDistance=4;orbit.maxDistance=260;orbit.zoomToCursor=false;orbit.maxPolarAngle=Math.PI*.98;orbit.enablePan=false;orbit.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;},
  street(on){orbit.maxPolarAngle=Math.PI*.98;orbit.minDistance=on?2:4;},
  pan(on){orbit.mouseButtons.LEFT=on?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;orbit.touches.ONE=on?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;},
  begin(w,h){renderer.setAnimationLoop(null);orbit.enableDamping=false;setQuality('full');renderer.setPixelRatio(1);renderer.setSize(w,h,false);if(composer){composer.setPixelRatio(1);composer.setSize(w,h);}camera.aspect=w/h;camera.updateProjectionMatrix();},
  frame(p,t){window.__view(p,t);site.update?.({camera,target:orbit.target,sun,dt:1/24,view:window.__view});renderVisual();return canvas.toDataURL('image/jpeg',.92);}
 };
}
