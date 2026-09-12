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
    this.seguindo = null;          // tribo que a câmera acompanha

    this.ponteiros = new Map();
    this.pinca = null;
    this.arrastou = 0;
    this.pendente = null;
    this.pintando = false;
    this.cancelado = false;
    this._raio = new THREE.Raycaster();
    this._v2 = new THREE.Vector2();

    tela.addEventListener('pointerdown', (e) => this.baixar(e));
    tela.addEventListener('pointermove', (e) => this.mover(e));
    tela.addEventListener('pointerup', (e) => this.soltar(e));
    tela.addEventListener('pointercancel', (e) => this.soltar(e));
    tela.addEventListener('wheel', (e) => {
      e.preventDefault();
      // proporcional ao giro: um degrau fixo por evento faz o zoom de trackpad
      // parecer travado e exige dez rolagens para chegar perto
      const passo = Math.max(-0.6, Math.min(0.6, e.deltaY * 0.0015));
      this.zoom(1 + passo);
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
    // sintético (teste) não tem captura; não é motivo para derrubar o gesto
    try { this.tela.setPointerCapture(e.pointerId); } catch { /* segue */ }
    this.ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.arrastou = 0;

    if (this.ponteiros.size >= 2) {
      const [a, b] = [...this.ponteiros.values()];
      this.pinca = { d: Math.hypot(a.x - b.x, a.y - b.y), a: Math.atan2(b.y - a.y, b.x - a.x) };
      // Chegou o segundo dedo: isto é pinça, não pincelada. Cancela qualquer
      // pintura pendente e para a que já tiver começado — pintar no primeiro
      // pointerdown fazia toda tentativa de zoom despejar um punhado de seres.
      this.pendente = null;
      this.pintando = false;
      this.cancelado = true;
      return;
    }

    this.cancelado = false;
    this.pintando = false;
    this.pendente = this.pincelAtivo && e.button !== 2 ? { x: e.clientX, y: e.clientY } : null;
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

    if (this.cancelado) return;

    if (this.pincelAtivo) {
      // a pincelada só começa depois que o dedo anda: enquanto ele está parado
      // ainda pode virar pinça
      if (this.pendente && this.arrastou > 7) {
        const inicio = this.paraMundo(this.pendente.x, this.pendente.y);
        if (inicio) this.aoPintar(inicio.x, inicio.z, true);
        this.pendente = null;
        this.pintando = true;
      }
      if (this.pintando) {
        const m = this.paraMundo(e.clientX, e.clientY);
        if (m) this.aoPintar(m.x, m.z, false);
      }
      return;
    }
    this.arrastar(dx, dy);
  }

  soltar(e) {
    this.ponteiros.delete(e.pointerId);
    if (this.ponteiros.size < 2) this.pinca = null;
    if (this.ponteiros.size > 0) return;

    // toque curto que nunca virou pinça: aí sim vale uma pincelada só
    if (!this.cancelado && this.pendente && this.arrastou < 8) {
      const m = this.paraMundo(this.pendente.x, this.pendente.y);
      if (m) this.aoPintar(m.x, m.z, true);
    } else if (!this.cancelado && !this.pincelAtivo && this.arrastou < 8) {
      const m = this.paraMundo(e.clientX, e.clientY);
      if (m) this.aoTocar(m.x, m.z, true);
    }
    this.pendente = null;
    this.pintando = false;
  }

  /** Arrastar move o mundo debaixo do dedo, não a câmera: é o gesto esperado. */
  arrastar(dx, dy) {
    this.seguindo = null;   // mexeu na câmera, parou de seguir
    const escala = this.distancia * 0.0016;
    const cos = Math.cos(this.azimute), sen = Math.sin(this.azimute);
    this.alvo.x -= (dx * cos - dy * sen) * escala;
    this.alvo.z -= (dx * sen + dy * cos) * escala;
    this.alvo.x = clamp(this.alvo.x, -10, N + 10);
    this.alvo.z = clamp(this.alvo.z, -10, N + 10);
    this.aplicar();
  }

  zoom(fator) {
    // Abaixo de ~9 a câmera entra no terreno e só se veem faces de tile.
    this.distancia = clamp(this.distancia * fator, 9, 150);
    this.aplicar();
  }

  /** Chamado por quadro: persegue o centro da tribo sem teleportar a câmera. */
  acompanhar(dt) {
    if (!this.seguindo || !this.seguindo.viva || !this.seguindo.pop) { this.seguindo = null; return; }
    const f = Math.min(1, dt * 3.5);
    this.alvo.x += (this.seguindo.cx - this.alvo.x) * f;
    this.alvo.z += (this.seguindo.cy - this.alvo.z) * f;
    this.aplicar();
  }

  seguir(tribo) {
    this.seguindo = tribo;
    if (tribo) {
      // salta para cima dela na hora: quem pede para seguir não quer esperar a
      // câmera atravessar o mapa devagar
      this.alvo.x = tribo.cx;
      this.alvo.z = tribo.cy;
      this.distancia = Math.min(this.distancia, 19);
    }
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
    this.seguindo = null;
    this.alvo.set(N / 2, 0, N / 2);
    this.distancia = 74;
    this.elevacao = 0.95;
    this.aplicar();
  }
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
