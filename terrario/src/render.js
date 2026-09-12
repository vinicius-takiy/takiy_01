// Desenho do mundo.
//
// Duas regras mandam aqui. A primeira é instanciar tudo: a grade inteira é uma
// malha só e cada figura é outra, porque um objeto por coisa derruba o quadro no
// celular antes do jogo começar. A segunda é que cada figura vem em duas malhas,
// uma tingida pela cor da tribo (a roupa) e outra com cor de verdade (pele,
// madeira, folha) — com uma malha só, a pele saía pintada da cor da tribo.

import * as THREE from 'three';
import { N, T, TERRENOS } from './mundo.js';
import { CHAVES_VOCACAO } from './tribos.js';
import { montarFigura } from './figuras.js';

const CAIXA = new THREE.BoxGeometry(1, 1, 1);
const ALTURA_MIN = 0.35;
const COR_MAR = 0x2b5f80;

const TETOS = {
  arvore: 2600, moita: 1100, pedra: 800, espiga: 1400, oca: 200,
  rebanho: 240, predador: 70, humano: 260,
};

export class Render {
  constructor(cena, mundo) {
    this.mundo = mundo;
    this.cena = cena;
    this.cor = new THREE.Color();
    this._tinta = new THREE.Color();
    this.aux = new THREE.Object3D();
    this.tempo = 0;
    this.relogioCenario = 0;
    this.figuras = new Map();

    // ---------- terreno ----------
    this.chao = new THREE.InstancedMesh(CAIXA, new THREE.MeshLambertMaterial(), N * N);
    this.chao.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.chao.receiveShadow = true;
    cena.add(this.chao);
    for (let i = 0; i < N * N; i++) this.escreverTile(i);
    this.chao.instanceMatrix.needsUpdate = true;
    this.chao.instanceColor.needsUpdate = true;

    // ---------- mar ----------
    // bem maior que a ilha: um plano do tamanho dela mostra a própria borda
    this.mar = new THREE.Mesh(
      new THREE.PlaneGeometry(N * 6, N * 6),
      new THREE.MeshLambertMaterial({ color: COR_MAR, transparent: true, opacity: 0.9 }),
    );
    this.mar.rotation.x = -Math.PI / 2;
    this.mar.position.set(N / 2, 0.4, N / 2);
    cena.add(this.mar);

    // ---------- figuras ----------
    for (const k of CHAVES_VOCACAO) this.criarFigura(`humano:${k}`, TETOS.humano);
    for (const k of ['rebanho', 'predador', 'oca', 'arvore', 'moita', 'pedra', 'espiga']) {
      this.criarFigura(k, TETOS[k]);
    }
    this.refazerCenario();

    // ---------- destaque do pincel ----------
    this.alvoPincel = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.0, 28),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55,
                                    side: THREE.DoubleSide, depthTest: false }),
    );
    this.alvoPincel.rotation.x = -Math.PI / 2;
    this.alvoPincel.renderOrder = 9;
    this.alvoPincel.visible = false;
    cena.add(this.alvoPincel);
  }

  criarFigura(nome, teto) {
    const geos = montarFigura(nome);
    const par = { teto, n: 0 };
    for (const grupo of ['tribo', 'natural']) {
      if (!geos[grupo]) { par[grupo] = null; continue; }
      const m = new THREE.InstancedMesh(
        geos[grupo], new THREE.MeshLambertMaterial({ vertexColors: true }), teto);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = true;
      m.frustumCulled = false;
      m.count = 0;
      this.cena.add(m);
      par[grupo] = m;
    }
    this.figuras.set(nome, par);
    return par;
  }

  /** Põe uma cópia da figura onde `this.aux` está. */
  por(nome, corTribo) {
    const f = this.figuras.get(nome);
    if (!f || f.n >= f.teto) return;
    this.aux.updateMatrix();
    if (f.tribo) {
      f.tribo.setMatrixAt(f.n, this.aux.matrix);
      f.tribo.setColorAt(f.n, corTribo || this._tinta.set(0xbdb6a4));
    }
    if (f.natural) {
      f.natural.setMatrixAt(f.n, this.aux.matrix);
      f.natural.setColorAt(f.n, this._tinta.set(0xffffff));
    }
    f.n++;
  }

  abrirLote(nomes) { for (const n of nomes) this.figuras.get(n).n = 0; }

  fecharLote(nomes) {
    for (const n of nomes) {
      const f = this.figuras.get(n);
      for (const m of [f.tribo, f.natural]) {
        if (!m) continue;
        m.count = f.n;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    }
  }

  // ------------------------------------------------------------- terreno
  alturaColuna(i) { return Math.max(ALTURA_MIN, 0.5 + this.mundo.altura[i] * 1.5); }

  /**
   * Topo do tile. A coluna vai de y=-2 até y=alturaColuna, então é ESSE o chão
   * onde as figuras pisam. Subtrair 1 aqui enterrava gente, bicho e oca um metro
   * abaixo da superfície — só a copa das árvores aparecia, e o mundo parecia
   * vazio mesmo com trinta e cinco pessoas em cena.
   */
  alturaEm(x, y) {
    const xi = Math.round(x), yi = Math.round(y);
    if (!this.mundo.dentro(xi, yi)) return 0;
    return this.alturaColuna(this.mundo.idx(xi, yi));
  }

  /** Cor do tile, sem o dono. A água sai plana e igual à do mar aberto: com o
   *  sombreado de relevo, o quadrado da grade aparecia como um losango claro. */
  corDoTile(i) {
    const { mundo } = this;
    const tipo = mundo.terreno[i];
    if (tipo === T.AGUA) return this.cor.set(COR_MAR);
    this.cor.set(TERRENOS[tipo].cor);
    if (tipo === T.PLANTACAO) this.cor.lerp(this._tinta.set(0xe0c257), mundo.crescer[i] * 0.6);
    return this.cor.multiplyScalar(0.78 + Math.min(0.45, mundo.altura[i] * 0.22));
  }

  escreverTile(i) {
    const x = i % N, y = (i / N) | 0;
    const h = this.alturaColuna(i);
    this.aux.position.set(x, h / 2 - 1, y);
    this.aux.scale.set(1, h + 2, 1);
    this.aux.rotation.set(0, 0, 0);
    this.aux.updateMatrix();
    this.chao.setMatrixAt(i, this.aux.matrix);
    this.corDoTile(i);
    this.chao.setColorAt(i, this.cor);
  }

  pintarDominios(tribos) {
    const porId = new Map(tribos.map((t) => [t.id, t]));
    for (let i = 0; i < N * N; i++) {
      this.corDoTile(i);
      const dono = this.mundo.dono[i];
      if (dono !== -1) {
        const t = porId.get(dono);
        if (t) this.cor.lerp(this._tinta.set(t.cor), 0.26);
      }
      this.chao.setColorAt(i, this.cor);
    }
    this.chao.instanceColor.needsUpdate = true;
  }

  aplicarSujos() {
    const { mundo } = this;
    if (!mundo.sujo.size) return false;
    for (const i of mundo.sujo) this.escreverTile(i);
    mundo.sujo.clear();
    this.chao.instanceMatrix.needsUpdate = true;
    this.chao.instanceColor.needsUpdate = true;
    this.refazerCenario();
    return true;
  }

  // -------------------------------------------------------------- cenário
  /** Mato, pedra e espiga saem do próprio terreno. É o que faz a natureza
   *  aparecer conforme o jogador pinta, em vez de o chão só mudar de cor. */
  refazerCenario() {
    const { mundo } = this;
    const nomes = ['arvore', 'moita', 'pedra', 'espiga'];
    this.abrirLote(nomes);
    for (let i = 0; i < N * N; i++) {
      const tipo = mundo.terreno[i];
      const x = i % N, y = (i / N) | 0;
      const j = (i * 2654435761) >>> 0;                 // dispersão estável por tile
      const dx = ((j & 255) / 255 - 0.5) * 0.62;
      const dz = (((j >> 8) & 255) / 255 - 0.5) * 0.62;
      const s = 0.8 + ((j >> 16) & 255) / 255 * 0.5;
      const yBase = this.alturaColuna(i);
      const girar = ((j >> 4) & 255) / 255 * 6.28;

      if (tipo === T.FLORESTA) {
        this.aux.position.set(x + dx, yBase, y + dz);
        this.aux.rotation.set(0, girar, 0);
        this.aux.scale.setScalar(s);
        this.por('arvore');
      } else if ((tipo === T.GRAMA || tipo === T.PASTO) && (j & 3) === 0) {
        this.aux.position.set(x + dx, yBase, y + dz);
        this.aux.rotation.set(0, girar, 0);
        this.aux.scale.setScalar(0.8 + (j & 15) / 40);
        this.por('moita');
      } else if ((tipo === T.ROCHA || tipo === T.MONTANHA) && (j & 1) === 0) {
        this.aux.position.set(x + dx, yBase, y + dz);
        this.aux.rotation.set(0, girar, 0);
        this.aux.scale.setScalar(0.85 + (j & 31) / 60);
        this.por('pedra');
      } else if (tipo === T.PLANTACAO && mundo.crescer[i] > 0.35) {
        // a roça só ganha forma quando amadurece: dá para ver a colheita chegando
        const alto = 0.45 + mundo.crescer[i] * 0.75;
        for (const [ex, ez] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) {
          this.aux.position.set(x + ex, yBase, y + ez);
          this.aux.rotation.set(0, girar + ex, 0);
          this.aux.scale.set(0.9, alto, 0.9);
          this.por('espiga');
        }
      }
    }
    this.fecharLote(nomes);
  }

  // ---------------------------------------------------------------- seres
  atualizarSeres(sim, dt = 0) {
    this.tempo += dt;
    const nomes = [...CHAVES_VOCACAO.map((k) => `humano:${k}`), 'rebanho', 'predador', 'oca'];
    this.abrirLote(nomes);

    for (const h of sim.humanos) {
      if (!h.viva) continue;
      const s = h.adulto ? 1 : 0.66;
      this.aux.position.set(h.x, this.alturaEm(h.x, h.y), h.y);
      this.aux.scale.set(s, s, s);
      // vira para onde vai; balança enquanto trabalha, senão de perto o mundo
      // parece travado mesmo com a simulação rodando
      const giro = h.alvo ? Math.atan2(h.alvo.x - h.x, h.alvo.y - h.y) : giroParado(h);
      const faina = h.obra ? Math.sin(this.tempo * 6.5 + h.x * 3) : 0;
      this.aux.rotation.set(faina * 0.3, giro, 0);
      this.aux.position.y += Math.abs(faina) * 0.05;
      this.cor.set(h.tribo ? h.tribo.cor : 0xd8d2c0);
      if (h.fome > 0.75) this.cor.lerp(this._tinta.set(0x201a12), 0.45);
      this.por(`humano:${h.dom in FIG_HUMANO ? h.dom : 'lavrador'}`, this.cor);
    }

    for (const r of sim.rebanhos) {
      if (!r.viva) continue;
      this.aux.position.set(r.x, this.alturaEm(r.x, r.y), r.y);
      this.aux.rotation.set(0, r.alvo ? Math.atan2(r.alvo.x - r.x, r.alvo.y - r.y) : giroParado(r), 0);
      this.aux.scale.setScalar(r.domesticado ? 1 : 0.92);
      this.por('rebanho');
    }

    for (const p of sim.predadores) {
      if (!p.viva) continue;
      const mira = p.presa || p.alvo;
      this.aux.position.set(p.x, this.alturaEm(p.x, p.y), p.y);
      this.aux.rotation.set(0, mira ? Math.atan2(mira.x - p.x, mira.y - p.y) : giroParado(p), 0);
      this.aux.scale.setScalar(1);
      this.por('predador');
    }

    for (const t of sim.tribos) {
      for (const o of t.ocas) {
        this.aux.position.set(o.x, this.alturaEm(o.x, o.y), o.y);
        this.aux.rotation.set(0, ((o.x * 31 + o.y * 17) % 6.28), 0);
        this.aux.scale.setScalar(1);
        this.por('oca', this.cor.set(t.cor));
      }
    }

    this.fecharLote(nomes);

    // espiga muda com a maturação, que não suja o tile a cada passo
    this.relogioCenario += dt;
    if (this.relogioCenario > 0.7) { this.relogioCenario = 0; this.refazerCenario(); }
  }

  marcarPincel(x, y, raio, visivel) {
    this.alvoPincel.visible = visivel;
    if (!visivel) return;
    const i = this.mundo.dentro(Math.round(x), Math.round(y))
      ? this.mundo.idx(Math.round(x), Math.round(y)) : 0;
    this.alvoPincel.position.set(x, this.alturaColuna(i) + 0.04, y);
    this.alvoPincel.scale.setScalar(Math.max(0.6, raio));
  }

  /** Solta tudo o que este mundo pôs na cena. */
  descartar() {
    const malhas = [this.chao, this.mar, this.alvoPincel];
    for (const f of this.figuras.values()) for (const m of [f.tribo, f.natural]) if (m) malhas.push(m);
    for (const m of malhas) {
      this.cena.remove(m);
      m.geometry?.dispose?.();
      m.material?.dispose?.();
    }
    this.figuras.clear();
  }
}

const FIG_HUMANO = Object.fromEntries(CHAVES_VOCACAO.map((k) => [k, true]));

/** Ângulo estável para quem está parado: sem isto o boneco pula para o norte. */
const giroParado = (a) => (a.x * 37 + a.y * 17) % 6.28;
