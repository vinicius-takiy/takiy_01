// Jogador: movimento, câmera, vida. O terreno é plano de propósito — sem
// gravidade, sem rampas. Num protótipo de controle, tropeçar em geometria é
// ruído que atrapalha a leitura do teste.

import * as THREE from 'three';
import { resolverCirculo } from './collision.js';
import { CHAO } from './level.js';

const RAIO = 0.36;
const OLHO_EM_PE = 1.62;
const OLHO_AGACHADO = 1.02;
const VEL_ANDANDO = 3.6;
const VEL_AGACHADO = 1.9;
const VEL_MIRANDO = 1.7;
const ACEL = 14;
const LIMITE_PITCH = Math.PI / 2 - 0.04;

export class Jogador {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, CHAO, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.olho = OLHO_EM_PE;
    this.vida = 100;
    this.vidaMax = 100;
    this.semLevarDano = 0;
    this.agachado = false;
    this.recuo = { x: 0, y: 0 };      // deslocamento de recuo, some sozinho
    this.balanco = 0;                 // fase do passo
    this.trilho = null;               // destino do esquema sobre trilhos
    this.morto = false;
    this.danoRecebido = 0;            // acumulado, só para o placar
  }

  girar(dx, dy) {
    this.yaw += dx;
    this.pitch = Math.max(-LIMITE_PITCH, Math.min(LIMITE_PITCH, this.pitch + dy));
  }

  levarDano(n) {
    if (this.morto) return;
    this.vida = Math.max(0, this.vida - n);
    this.danoRecebido += n;
    this.semLevarDano = 0;
    if (this.vida <= 0) this.morto = true;
  }

  /** Direção para onde a câmera aponta, já com o recuo aplicado. */
  direcao(alvo = new THREE.Vector3()) {
    const p = this.pitch + this.recuo.y;
    const y = this.yaw + this.recuo.x;
    alvo.set(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
    return alvo;
  }

  /** Olho no espaço do mundo, sem o balanço de passo. */
  olhoMundo(alvo = new THREE.Vector3()) {
    return alvo.set(this.pos.x, this.pos.y + this.olho, this.pos.z);
  }

  atualizar(dt, entrada, colisores, mirando) {
    // --- rotação ---
    this.girar(entrada.olhar.x, entrada.olhar.y);
    this.recuo.x *= Math.max(0, 1 - dt * 7);
    this.recuo.y *= Math.max(0, 1 - dt * 7);

    // --- altura do olho ---
    this.agachado = entrada.agachado;
    const alvoOlho = this.agachado ? OLHO_AGACHADO : OLHO_EM_PE;
    this.olho += (alvoOlho - this.olho) * Math.min(1, dt * 11);

    // --- velocidade desejada ---
    let vx = 0, vz = 0;
    if (this.trilho) {
      // sobre trilhos: caminha sozinho até o ponto tocado
      const dx = this.trilho.x - this.pos.x;
      const dz = this.trilho.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.35) this.trilho = null;
      else { const v = 3.2; vx = (dx / d) * v; vz = (dz / d) * v; }
    } else {
      let velMax = VEL_ANDANDO;
      if (this.agachado) velMax = VEL_AGACHADO;
      else if (mirando) velMax = VEL_MIRANDO;
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      const frente = entrada.mover.y, lado = entrada.mover.x;
      vx = (-sy * frente + cy * lado) * velMax;
      vz = (-cy * frente - sy * lado) * velMax;
    }

    this.vel.x += (vx - this.vel.x) * Math.min(1, dt * ACEL);
    this.vel.z += (vz - this.vel.z) * Math.min(1, dt * ACEL);

    // --- move e resolve, um eixo de cada vez para deslizar nas paredes ---
    this.pos.x += this.vel.x * dt;
    resolverCirculo(this.pos, RAIO, colisores, this.pos.y + this.olho);
    this.pos.z += this.vel.z * dt;
    resolverCirculo(this.pos, RAIO, colisores, this.pos.y + this.olho);
    this.pos.y = CHAO;

    // --- balanço de passo ---
    const rapidez = Math.hypot(this.vel.x, this.vel.z);
    this.balanco += dt * rapidez * 2.4;
    const amp = mirando ? 0.008 : 0.026;
    const bobY = Math.sin(this.balanco * 2) * amp * Math.min(1, rapidez / VEL_ANDANDO);
    const bobX = Math.sin(this.balanco) * amp * 0.8 * Math.min(1, rapidez / VEL_ANDANDO);

    // --- regeneração ---
    this.semLevarDano += dt;
    if (!this.morto && this.semLevarDano > 4 && this.vida < this.vidaMax) {
      this.vida = Math.min(this.vidaMax, this.vida + 19 * dt);
    }

    // --- aplica na câmera ---
    this.camera.position.set(this.pos.x + bobX, this.pos.y + this.olho + bobY, this.pos.z);
    this.camera.rotation.set(this.pitch + this.recuo.y, this.yaw + this.recuo.x, 0, 'YXZ');
  }
}
