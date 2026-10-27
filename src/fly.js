// Minimal free-fly camera: WASD + drag to look, E/Q up/down, Shift to sprint, wheel = speed.
import * as THREE from 'three';

export class FlyControls {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.enabled = false;
    this.speed = 8;
    this.keys = new Set();
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.dragging = false;
    this.onKeyStart = null; // called when a movement key is pressed while disabled

    const move = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'ShiftLeft', 'ShiftRight'];
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if(document.body.dataset.visitor && (!document.body.classList.contains('floating') || document.querySelector('dialog[open]'))) return;
      if (!move.includes(e.code)) return;
      if (!this.enabled && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code) && this.onKeyStart) this.onKeyStart();
      this.keys.add(e.code);
      if (this.enabled && e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    let lx = 0, ly = 0;
    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      this.dragging = true; lx = e.clientX; ly = e.clientY;
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener('pointermove', (e) => {
      if (!this.enabled || !this.dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.y -= dx * 0.0025;
      this.euler.x = THREE.MathUtils.clamp(this.euler.x - dy * 0.0025, -1.55, 1.55);
      this.euler.z = 0;
      this.camera.quaternion.setFromEuler(this.euler);
    });
    dom.addEventListener('pointerup', () => { this.dragging = false; });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      if(document.body.dataset.visitor){this.camera.translateZ(Math.max(-10,Math.min(10,e.deltaY*.035)));this.camera.position.y=Math.max(.3,this.camera.position.y);return;}
      this.speed = THREE.MathUtils.clamp(this.speed * (e.deltaY > 0 ? 0.85 : 1.18), 0.5, 120);
    }, { passive: false });
  }

  update(dt) {
    if (!this.enabled) return;
    const k = this.keys, v = new THREE.Vector3();
    if (k.has('KeyW')) v.z -= 1;
    if (k.has('KeyS')) v.z += 1;
    if (k.has('KeyA')) v.x -= 1;
    if (k.has('KeyD')) v.x += 1;
    const up = (k.has('KeyE') || k.has('Space') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
    const sp = this.speed * (k.has('ShiftLeft') || k.has('ShiftRight') ? 4 : 1) * dt;
    if (v.lengthSq()) {
      v.normalize().applyQuaternion(this.camera.quaternion);
      this.camera.position.addScaledVector(v, sp);
    }
    this.camera.position.y += up * sp;
    this.camera.position.y = Math.max(this.camera.position.y, 0.3);
  }
}
