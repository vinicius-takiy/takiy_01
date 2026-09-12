// Soldado inimigo. Não anda: ocupa um posto de cobertura, agacha, espia, atira e
// volta a agachar. É o mínimo que produz combate legível — e é justamente o
// comportamento que expõe se o esquema de controle dá conta de acertar alguém.

import * as THREE from 'three';
import { bloqueado, raioVsCaixa, raioVsEsfera } from './collision.js';
import { criarSoldado, aplicarPose, POSES } from './corpo.js';

const ALCANCE = 62;

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
  /** @param {THREE.Vector3} pos @param {number} alturaCobertura altura da cobertura, para referência */
  constructor(pos, alturaCobertura, olhandoPara) {
    const { grupo, ossos } = criarSoldado();
    this.grupo = grupo;
    this.ossos = ossos;
    this.grupo.position.copy(pos);
    this.grupo.rotation.y = olhandoPara;
    this.base = pos.clone();
    this.alturaCobertura = alturaCobertura;

    // boca do cano, presa à mão que segura a arma
    this.boca = new THREE.Object3D();
    this.boca.position.set(0, -0.05, -0.76);
    ossos.maoD.add(this.boca);

    this.vida = 100;
    this.estado = 'dormindo';
    this.exposicao = 0;         // 0 agachado atrás da cobertura, 1 de pé mirando
    this.relogio = 0;
    this.tirosRestantes = 0;
    this.morto = false;
    this.tombo = 0;
    this.flinch = 0;            // tranco ao levar tiro
    this._v = new THREE.Vector3();
    this._w = new THREE.Vector3();
    this.postura(0, 0);
  }

  /** Escreve a pose nos ossos e atualiza as matrizes, que os testes de tiro leem. */
  postura(exposicao, pitchTorso) {
    if (this.morto) {
      aplicarPose(this.ossos, POSES.agachado, POSES.morto, Math.min(1, this.tombo * 1.6));
    } else {
      aplicarPose(this.ossos, POSES.agachado, POSES.mirando, exposicao, pitchTorso);
      if (this.flinch > 0) {
        this.ossos.peito.rotation.x -= this.flinch * 0.35;
        this.ossos.cabeca.rotation.x += this.flinch * 0.3;
      }
    }
    this.grupo.updateMatrixWorld(true);
  }

  get vivo() { return !this.morto; }

  /** Centro da cabeça no mundo, lido do osso — segue a pose sem eu manter número nenhum. */
  cabeca(alvo = new THREE.Vector3()) {
    return this.ossos.cabeca.getWorldPosition(alvo).add(new THREE.Vector3(0, 0.06, 0));
  }

  /** Envoltória do tronco, derivada dos ossos do torso. */
  caixaTorso() {
    const c = new THREE.Box3();
    for (const nome of ['raiz', 'coluna', 'peito', 'pescoco']) {
      c.expandByPoint(this.ossos[nome].getWorldPosition(this._w));
    }
    c.expandByVector(new THREE.Vector3(0.21, 0.10, 0.16));
    return { minX: c.min.x, maxX: c.max.x, minY: c.min.y, maxY: c.max.y, minZ: c.min.z, maxZ: c.max.z };
  }

  /** Ponto que a assistência de mira persegue: o peito, onde quer que ele esteja. */
  pontoDeMira(alvo = new THREE.Vector3()) {
    return this.ossos.peito.getWorldPosition(alvo);
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
    this.flinch = 1;
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
      this.tombo = Math.min(1, this.tombo + dt * 2.6);
      // o corpo afrouxa pela pose; o grupo só acompanha com uma queda de lado
      this.grupo.rotation.z = -this.tombo * this.tombo * 0.75;
      this.postura(0, 0);
      return;
    }

    const olho = jogador.olhoMundo(this._v);
    // a linha de visão parte de onde a cabeça FICARIA de pé, não de onde ela está:
    // o soldado agachado sabe que você está lá, ele só não te vê no instante
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

    // agacha e levanta pela pose: o corpo dobra os joelhos, não afunda no chão
    const expoAlvo = (this.estado === 'espiando' || this.estado === 'atirando') ? 1 : 0;
    this.exposicao += (expoAlvo - this.exposicao) * Math.min(1, dt * 6);
    this.flinch = Math.max(0, this.flinch - dt * 4);

    // inclina o tronco para encarar quem está acima ou abaixo
    const alturaOlho = jogador.pos.y + jogador.olho;
    const pitch = Math.atan2(alturaOlho - (this.base.y + 1.4), Math.max(1, dist)) * this.exposicao;
    this.postura(this.exposicao, Math.max(-0.5, Math.min(0.5, pitch)));
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
