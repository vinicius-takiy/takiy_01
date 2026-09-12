// Soldado inimigo. Não anda: ocupa um posto de cobertura, agacha, espia, atira e
// volta a agachar. É o mínimo que produz combate legível — e é justamente o
// comportamento que expõe se o esquema de controle dá conta de acertar alguém.

import * as THREE from 'three';
import { bloqueado, raioVsCaixa, raioVsEsfera } from './collision.js';

const MAT = {
  farda:   new THREE.MeshLambertMaterial({ color: 0x4f5a3c }),
  capacete:new THREE.MeshLambertMaterial({ color: 0x353b2c }),
  pele:    new THREE.MeshLambertMaterial({ color: 0xa87e5c }),
  arma:    new THREE.MeshLambertMaterial({ color: 0x2e261c }),
};
const CAIXA = new THREE.BoxGeometry(1, 1, 1);

const ALCANCE = 62;
const MERGULHO = 0.66;        // quanto o corpo baixa ao se esconder

/** Dificuldade única na fatia 1; vira tabela quando houver menu de dificuldade. */
const AJUSTE = {
  reacao: [0.8, 1.7],         // segundos até espiar depois de ver o jogador
  mira: [0.55, 0.95],         // segundos apontando antes de disparar
  descanso: [1.5, 3.2],       // segundos escondido entre rajadas
  tiros: [1, 2],
  intervalo: 0.38,
  danoPorTiro: 8,
  precisaoPerto: 0.42,        // até 12 m
  precisaoLonge: 0.10,        // a 60 m
};

// Quantos soldados podem estar expostos ao mesmo tempo. É o ajuste que mais pesa
// na legibilidade: com os oito atirando juntos não dá para ler nada, e o teste
// de controle vira teste de sorte.
export const EXPOSTOS_AO_MESMO_TEMPO = 2;

const sorteio = ([a, b]) => a + Math.random() * (b - a);

export class Soldado {
  /** @param {THREE.Vector3} pos @param {number} alturaCobertura */
  constructor(pos, alturaCobertura, olhandoPara) {
    this.grupo = new THREE.Group();
    this.grupo.position.copy(pos);
    this.grupo.rotation.y = olhandoPara;
    this.base = pos.clone();
    this.alturaCobertura = alturaCobertura;

    const add = (mat, x, y, z, sx, sy, sz) => {
      const m = new THREE.Mesh(CAIXA, mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.castShadow = true;
      this.grupo.add(m);
      return m;
    };
    add(MAT.farda, 0, 0.42, 0, 0.44, 0.84, 0.3);              // pernas
    this.torso = add(MAT.farda, 0, 1.16, 0, 0.58, 0.66, 0.34);
    add(MAT.farda, -0.38, 1.2, 0.05, 0.16, 0.5, 0.18);        // braços
    add(MAT.farda, 0.38, 1.2, 0.05, 0.16, 0.5, 0.18);
    add(MAT.pele, 0, 1.6, 0, 0.24, 0.26, 0.24);               // cabeça
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), MAT.capacete);
    cap.position.set(0, 1.68, 0);
    cap.castShadow = true;
    this.grupo.add(cap);
    this.arma = add(MAT.arma, 0.2, 1.22, -0.5, 0.07, 0.09, 1.05);
    this.boca = new THREE.Object3D();
    this.boca.position.set(0.2, 1.22, -1.05);
    this.grupo.add(this.boca);

    this.vida = 100;
    this.estado = 'dormindo';
    this.exposicao = 0;         // 0 escondido, 1 espiando
    this.relogio = 0;
    this.tirosRestantes = 0;
    this.morto = false;
    this.tombo = 0;
    this._v = new THREE.Vector3();
  }

  get vivo() { return !this.morto; }

  /** Centro da cabeça no mundo, já considerando o agachamento. */
  cabeca(alvo = new THREE.Vector3()) {
    return alvo.set(this.base.x, this.grupo.position.y + 1.64, this.base.z);
  }

  /** AABB do torso no mundo. */
  caixaTorso() {
    const y = this.grupo.position.y;
    return {
      minX: this.base.x - 0.32, maxX: this.base.x + 0.32,
      minY: y + 0.05, maxY: y + 1.5,
      minZ: this.base.z - 0.3, maxZ: this.base.z + 0.3,
    };
  }

  /** Ponto que o jogador precisa acertar; usado pela assistência de mira. */
  pontoDeMira(alvo = new THREE.Vector3()) {
    return alvo.set(this.base.x, this.grupo.position.y + 1.2, this.base.z);
  }

  /**
   * Testa um tiro do jogador.
   * @returns {{t:number, dano:number, ponto:THREE.Vector3, letal:boolean}|null}
   */
  testarTiro(origem, dir, alcance) {
    if (this.morto || this.exposicao < 0.08) return null;
    const tCabeca = raioVsEsfera(origem, dir, this.cabeca(this._v), 0.21);
    const tTorso = raioVsCaixa(origem, dir, this.caixaTorso());
    let t = Infinity, dano = 0;
    if (tCabeca < tTorso) { t = tCabeca; dano = 100; } else { t = tTorso; dano = 46; }
    if (t >= alcance) return null;
    const ponto = new THREE.Vector3().copy(origem).addScaledVector(dir, t);
    return { t, dano, ponto, letal: dano >= this.vida };
  }

  receberTiro(dano) {
    if (this.morto) return false;
    this.vida -= dano;
    if (this.vida <= 0) {
      this.morto = true;
      this.estado = 'morto';
      return true;
    }
    // levar tiro interrompe a rajada e faz recolher
    this.estado = 'escondido';
    this.relogio = 0.5 + Math.random() * 0.5;
    return false;
  }

  alertar() {
    if (this.estado === 'dormindo') {
      this.estado = 'escondido';
      this.relogio = sorteio(AJUSTE.reacao);
    }
  }

  atualizar(dt, ctx) {
    const { jogador, colisores, fx, som } = ctx;

    if (this.morto) {
      this.tombo = Math.min(1, this.tombo + dt * 3.4);
      const t = this.tombo;
      this.grupo.rotation.z = -t * t * 1.5;
      this.grupo.position.y = this.base.y - t * 0.42;
      return;
    }

    const olho = jogador.olhoMundo(this._v);
    const cabeca = new THREE.Vector3(this.base.x, this.base.y + 1.5, this.base.z);
    const dist = cabeca.distanceTo(olho);
    const enxerga = dist < ALCANCE && !bloqueado(cabeca, olho, colisores);

    if (this.estado === 'dormindo') {
      if (enxerga && dist < 46) this.alertar();
    } else {
      this.relogio -= dt;
      if (this.estado === 'escondido' && this.relogio <= 0) {
        if (enxerga && ctx.vagas.n > 0) {
          ctx.vagas.n--;
          this.estado = 'espiando';
          this.relogio = sorteio(AJUSTE.mira);
        } else {
          this.relogio = 0.45;
        }
      } else if (this.estado === 'espiando' && this.relogio <= 0) {
        if (enxerga) {
          this.estado = 'atirando';
          this.tirosRestantes = Math.round(sorteio(AJUSTE.tiros));
          this.relogio = 0;
        } else { this.estado = 'escondido'; this.relogio = sorteio(AJUSTE.descanso); }
      } else if (this.estado === 'atirando' && this.relogio <= 0) {
        if (this.tirosRestantes > 0 && enxerga) {
          this.disparar(jogador, dist, fx, som);
          this.tirosRestantes--;
          this.relogio = AJUSTE.intervalo;
        } else {
          this.estado = 'escondido';
          this.relogio = sorteio(AJUSTE.descanso);
        }
      }
    }

    // encara o jogador enquanto exposto
    // o -Z local é a frente do soldado: este é o ângulo que o vira para o jogador
    const alvoRot = Math.atan2(this.base.x - jogador.pos.x, this.base.z - jogador.pos.z);
    let d = ((alvoRot - this.grupo.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.grupo.rotation.y += d * Math.min(1, dt * 4);

    // sobe e desce atrás da cobertura
    const expoAlvo = (this.estado === 'espiando' || this.estado === 'atirando') ? 1 : 0;
    this.exposicao += (expoAlvo - this.exposicao) * Math.min(1, dt * 7.5);
    this.grupo.position.y = this.base.y - MERGULHO * (1 - this.exposicao);
    this.torso.rotation.x = (1 - this.exposicao) * 0.45;
  }

  disparar(jogador, dist, fx, som) {
    const boca = this.boca.getWorldPosition(new THREE.Vector3());
    const olho = jogador.olhoMundo(new THREE.Vector3());
    const f = Math.min(1, Math.max(0, (dist - 12) / 48));
    const precisao = AJUSTE.precisaoPerto + (AJUSTE.precisaoLonge - AJUSTE.precisaoPerto) * f;
    const acertou = Math.random() < precisao * (jogador.agachado ? 0.72 : 1);

    const destino = olho.clone();
    if (!acertou) {
      destino.x += (Math.random() - 0.5) * 1.9;
      destino.y += (Math.random() - 0.5) * 1.4;
      destino.z += (Math.random() - 0.5) * 1.9;
    }
    fx.traco(boca, destino);
    fx.fogo(boca);
    som?.tiroInimigo(dist);
    if (acertou) jogador.levarDano(AJUSTE.danoPorTiro);
  }
}
