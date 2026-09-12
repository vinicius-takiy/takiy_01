// Câmera orbital sobre a grade e o toque que a controla.
//
// A regra do toque é a que faz um jogo de pintar funcionar no celular: com
// pincel na mão, um dedo pinta e dois dedos navegam. Sem essa separação o
// jogador risca o mundo toda vez que tenta olhar em volta.

import * as THREE from 'three';
import { N } from './mundo.js';

const PLANO = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4);

export class Camera {
  constructor(camera, tela, { aoPintar, aoTocar }) {
    this.cam = camera;
    this.tela = tela;
    this.aoPintar = aoPintar;
    this.aoTocar = aoTocar;

    this.alvo = new THREE.Vector3(N / 2, 0, N / 2);
    this.distancia = 74;
    this.azimute = -Math.PI / 4;
    this.elevacao = 0.92;
    this.pincelAtivo = false;

    this.ponteiros = new Map();
    this.pinca = null;
    this.arrastou = 0;
    this._raio = new THREE.Raycaster();
    this._v2 = new THREE.Vector2();

    tela.addEventListener('pointerdown', (e) => this.baixar(e));
    tela.addEventListener('pointermove', (e) => this.mover(e));
    tela.addEventListener('pointerup', (e) => this.soltar(e));
    tela.addEventListener('pointercancel', (e) => this.soltar(e));
    tela.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom(1 + Math.sign(e.deltaY) * 0.12);
    }, { passive: false });
    tela.addEventListener('contextmenu', (e) => e.preventDefault());
    this.aplicar();
  }

  /** Onde no mundo está este ponto da tela. */
  paraMundo(clientX, clientY) {
    const r = this.tela.getBoundingClientRect();
    this._v2.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this._raio.setFromCamera(this._v2, this.cam);
    const p = new THREE.Vector3();
    return this._raio.ray.intersectPlane(PLANO, p) ? p : null;
  }

  baixar(e) {
    this.tela.setPointerCapture(e.pointerId);
    this.ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.arrastou = 0;
    if (this.ponteiros.size === 2) {
      const [a, b] = [...this.ponteiros.values()];
      this.pinca = { d: Math.hypot(a.x - b.x, a.y - b.y), a: Math.atan2(b.y - a.y, b.x - a.x) };
    } else if (this.pincelAtivo && e.button !== 2) {
      const p = this.paraMundo(e.clientX, e.clientY);
      if (p) this.aoPintar(p.x, p.z, true);
    }
  }

  mover(e) {
    const p = this.ponteiros.get(e.pointerId);
    // sem dedo na tela: só mostra onde o pincel cairia
    if (!p) {
      const m = this.paraMundo(e.clientX, e.clientY);
      if (m) this.aoTocar(m.x, m.z);
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    this.arrastou += Math.abs(dx) + Math.abs(dy);

    if (this.ponteiros.size >= 2) {
      const [a, b] = [...this.ponteiros.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      if (this.pinca) {
        this.zoom(this.pinca.d / Math.max(1, d));
        let giro = ang - this.pinca.a;
        if (giro > Math.PI) giro -= Math.PI * 2;
        if (giro < -Math.PI) giro += Math.PI * 2;
        this.azimute -= giro;
        this.elevacao = clamp(this.elevacao - dy * 0.004, 0.25, 1.45);
      }
      this.pinca = { d, a: ang };
      this.aplicar();
      return;
    }

    if (this.pincelAtivo) {
      const m = this.paraMundo(e.clientX, e.clientY);
      if (m) this.aoPintar(m.x, m.z, false);
      return;
    }
    this.arrastar(dx, dy);
  }

  soltar(e) {
    this.ponteiros.delete(e.pointerId);
    if (this.ponteiros.size < 2) this.pinca = null;
    if (this.ponteiros.size === 0 && this.arrastou < 8 && !this.pincelAtivo) {
      const m = this.paraMundo(e.clientX, e.clientY);
      if (m) this.aoTocar(m.x, m.z, true);
    }
  }

  /** Arrastar move o mundo debaixo do dedo, não a câmera: é o gesto esperado. */
  arrastar(dx, dy) {
    const escala = this.distancia * 0.0016;
    const cos = Math.cos(this.azimute), sen = Math.sin(this.azimute);
    this.alvo.x -= (dx * cos - dy * sen) * escala;
    this.alvo.z -= (dx * sen + dy * cos) * escala;
    this.alvo.x = clamp(this.alvo.x, -10, N + 10);
    this.alvo.z = clamp(this.alvo.z, -10, N + 10);
    this.aplicar();
  }

  zoom(fator) {
    this.distancia = clamp(this.distancia * fator, 12, 150);
    this.aplicar();
  }

  aplicar() {
    const h = Math.sin(this.elevacao) * this.distancia;
    const r = Math.cos(this.elevacao) * this.distancia;
    this.cam.position.set(
      this.alvo.x + Math.cos(this.azimute) * r,
      this.alvo.y + h,
      this.alvo.z + Math.sin(this.azimute) * r,
    );
    this.cam.lookAt(this.alvo);
  }

  enquadrarTudo() {
    this.alvo.set(N / 2, 0, N / 2);
    this.distancia = 74;
    this.elevacao = 0.95;
    this.aplicar();
  }
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
