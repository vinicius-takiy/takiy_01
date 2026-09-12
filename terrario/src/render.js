// Desenho do mundo.
//
// Duas regras mandam aqui. A primeira é instanciar tudo: a grade inteira é uma
// malha só e cada figura é outra, porque um objeto por coisa derruba o quadro no
// celular antes do jogo começar. A segunda é que cada figura vem em duas malhas,
// uma tingida pela cor da tribo (a roupa) e outra com cor de verdade (pele,
// madeira, folha) — com uma malha só, a pele saía pintada da cor da tribo.

import * as THREE from 'three';
import { N, T, TERRENOS, NIVEL_MAR } from './mundo.js';
import { CHAVES_VOCACAO } from './tribos.js';
import { ESPECIES } from './agentes.js';
import { montarFigura, QUADRIS } from './figuras.js';

const CAIXA = new THREE.BoxGeometry(1, 1, 1);
const ALTURA_MIN = 0.35;
const COR_MAR = 0x397f91;
/** Altura do mar aberto, na mesma conta da lâmina dos tiles: relevo do nível do
 *  mar, menos a mesma folga. Assim a linha da praia é uma só. */
const NIVEL_LAMINA = Math.max(ALTURA_MIN, 0.5 + (NIVEL_MAR - 0.07) * 1.5);

const TETOS = {
  arvore: 2600, moita: 1100, pedra: 800, espiga: 1400, oca: 200, cerca: 900,
  rebanho: 240, predador: 70, humano: 260,
  'rebanho:pata': 240 * 4, 'predador:pata': 70 * 4, peixe: 600, jacare: 40,
  capivara: 220, 'capivara:pata': 220 * 4, lebre: 260, 'lebre:pata': 260 * 4,
  chama: 700, poco: 90, muro: 900,
};

export class Render {
  constructor(cena, mundo) {
    this.mundo = mundo;
    this.cena = cena;
    this.cor = new THREE.Color();
    this._tinta = new THREE.Color();
    this.aux = new THREE.Object3D();
    // YXZ em tudo: a guinada é no mundo, a inclinação e o balanço são no eixo já
    // girado da figura. Na ordem padrão, XYZ, quem está virado para o lado
    // balança para a frente em vez de para o lado — e, pior, bastava uma figura
    // pedir YXZ para todas as seguintes herdarem a ordem, porque o Object3D é
    // reaproveitado. Uma ordem só, declarada aqui, e acabou a surpresa.
    this.aux.rotation.order = 'YXZ';
    this.tempo = 0;
    this.relogioCenario = 0;
    this.assinaturaCercas = '';
    this.figuras = new Map();
    this.entradas = new WeakMap();
    this.efeitos = [];
    this.totalPulsos = 0;
    this.ultimoPulso = { x: -99, y: -99, quando: -99 };

    // ---------- terreno ----------
    this.chao = new THREE.InstancedMesh(
      CAIXA,
      new THREE.MeshStandardMaterial({ vertexColors: false, roughness: 0.94, metalness: 0,
                                       flatShading: true }),
      N * N,
    );
    this.chao.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.chao.receiveShadow = true;
    cena.add(this.chao);
    for (let i = 0; i < N * N; i++) this.escreverTile(i);
    this.chao.instanceMatrix.needsUpdate = true;
    this.chao.instanceColor.needsUpdate = true;

    // ---------- lâmina d'água ----------
    // Uma placa translúcida por tile de água, na altura da terra em volta. O
    // chão é uma malha instanciada só, com um material opaco: não dá para
    // deixar alguns tiles transparentes ali. Daí a segunda malha — é ela que
    // faz um lago parecer lago em vez de um buraco quadrado de parede azul.
    this.lamina = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshPhongMaterial({ color: 0x4d97ab, transparent: true, opacity: 0.72,
                                    shininess: 80, specular: 0xbfe6de,
                                    side: THREE.DoubleSide, depthWrite: false }),
      N * N,
    );
    this.lamina.geometry.rotateX(-Math.PI / 2);
    this.lamina.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.lamina.frustumCulled = false;
    this.lamina.renderOrder = 1;
    this.lamina.count = 0;
    cena.add(this.lamina);

    // ---------- mar ----------
    // bem maior que a ilha: um plano do tamanho dela mostra a própria borda
    this.mar = new THREE.Mesh(
      new THREE.PlaneGeometry(N * 6, N * 6),
      new THREE.MeshPhongMaterial({ color: COR_MAR, transparent: true, opacity: 0.94,
                                    shininess: 75, specular: 0xb7e1d8 }),
    );
    this.mar.rotation.x = -Math.PI / 2;
    // O mar tem que encostar na areia. A 0,4 sobrava meio metro de barranco de
    // praia à vista em toda a volta da ilha, e a costa lia como corte de bolo.
    this.mar.position.set(N / 2, NIVEL_LAMINA, N / 2);
    cena.add(this.mar);

    // Uma segunda pele quase invisível quebra o plano perfeito do mar e produz
    // reflexos lentos sem textura externa nem custo alto no celular.
    this.marBrilho = new THREE.Mesh(
      new THREE.PlaneGeometry(N * 3.3, N * 3.3, 22, 22),
      new THREE.MeshBasicMaterial({ color: 0xb9eee2, transparent: true, opacity: 0.045,
                                    wireframe: true, depthWrite: false }),
    );
    this.marBrilho.rotation.x = -Math.PI / 2;
    this.marBrilho.rotation.z = 0.18;
    this.marBrilho.position.set(N / 2, this.mar.position.y + 0.025, N / 2);
    cena.add(this.marBrilho);

    // ---------- figuras ----------
    for (const k of CHAVES_VOCACAO) this.criarFigura(`humano:${k}`, TETOS.humano);
    for (const k of ['rebanho', 'rebanho:pata', 'capivara', 'capivara:pata',
                     'lebre', 'lebre:pata', 'predador', 'predador:pata',
                     'peixe', 'jacare', 'chama', 'oca', 'cerca', 'poco', 'muro', 'arvore', 'moita', 'pedra', 'espiga']) {
      this.criarFigura(k, TETOS[k]);
    }
    this.refazerCenario();
    this.refazerAgua();

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
        geos[grupo], new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86,
                                                       metalness: 0, flatShading: true }), teto);
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

  /** Onde fica a superfície da água deste tile, na mesma escala do chão. */
  alturaDaLamina(i) { return Math.max(ALTURA_MIN, 0.5 + this.mundo.superficieDaAgua(i) * 1.5); }

  /** Redesenha a lâmina de todos os tiles de água. Roda quando o mapa muda, não
   *  por quadro: água pintada é evento raro. */
  refazerAgua() {
    const { mundo } = this;
    let n = 0;
    for (let i = 0; i < N * N; i++) {
      if (mundo.terreno[i] !== T.AGUA) continue;
      this.aux.position.set(i % N, this.alturaDaLamina(i), (i / N) | 0);
      this.aux.rotation.set(0, 0, 0);
      this.aux.scale.setScalar(1);
      this.aux.updateMatrix();
      this.lamina.setMatrixAt(n++, this.aux.matrix);
    }
    this.lamina.count = n;
    this.lamina.instanceMatrix.needsUpdate = true;
  }

  /** Cor do tile, sem o dono. A água sai plana e igual à do mar aberto: com o
   *  sombreado de relevo, o quadrado da grade aparecia como um losango claro. */
  corDoTile(i) {
    const { mundo } = this;
    const tipo = mundo.terreno[i];
    if (tipo === T.AGUA) return this.cor.set(COR_MAR);
    this.cor.set(TERRENOS[tipo].cor);
    if (tipo === T.PLANTACAO) this.cor.lerp(this._tinta.set(0xe0c257), mundo.crescer[i] * 0.6);
    if (tipo === T.BROTO) this.cor.lerp(this._tinta.set(0x3f6135), Math.max(0, mundo.crescer[i]) * 0.7);
    this.cor.multiplyScalar(0.78 + Math.min(0.45, mundo.altura[i] * 0.22));
    // chão queimando puxa para a brasa, e o que já queimou fica escuro
    if (mundo.fogo[i] > 0) this.cor.lerp(this._tinta.set(0x8f2f12), 0.35 + mundo.fogo[i] * 0.4);
    return this.cor;
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
    // tile ardendo muda de cor a cada quadro: entra sempre na lista de sujos
    for (const i of mundo.queimando) mundo.sujo.add(i);
    if (!mundo.sujo.size) return false;
    for (const i of mundo.sujo) this.escreverTile(i);
    mundo.sujo.clear();
    this.refazerAgua();
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
  /** Escala de nascimento/construção: cada figura cresce suavemente ao aparecer. */
  escalaEntrada(ser) {
    if (!this.entradas.has(ser)) this.entradas.set(ser, this.tempo);
    const t = Math.min(1, Math.max(0.08, (this.tempo - this.entradas.get(ser)) / 0.45));
    return 1 - (1 - t) ** 3;
  }

  atualizarSeres(sim, dt = 0) {
    this.tempo += dt;
    if (this.mundo.tombadas.length) {
      for (const a of this.mundo.tombadas) this.derrubarArvore(a.x, a.y);
      this.mundo.tombadas.length = 0;
    }
    const nomes = [...CHAVES_VOCACAO.map((k) => `humano:${k}`), 'oca',
                   'rebanho', 'rebanho:pata', 'capivara', 'capivara:pata',
                   'lebre', 'lebre:pata', 'predador', 'predador:pata', 'peixe', 'jacare', 'chama'];
    this.abrirLote(nomes);

    for (const h of sim.humanos) {
      if (!h.viva) continue;
      const entrada = this.escalaEntrada(h);
      const s = (h.adulto ? 1 : 0.66) * entrada;
      this.aux.position.set(h.x, this.alturaEm(h.x, h.y), h.y);
      // vira para onde vai; balança enquanto trabalha, senão de perto o mundo
      // parece travado mesmo com a simulação rodando
      const giro = h.alvo ? Math.atan2(h.alvo.x - h.x, h.alvo.y - h.y) : giroParado(h);
      const g = GESTO[h.obra] || GESTO.padrao;
      const fase = this.tempo * g.ritmo + h.x * 3 + h.y;
      // Golpe é serrote, não senoide: o braço sobe devagar e desce de uma vez.
      // Com seno, machadada, enxadada e lançada tinham todas a mesma cara de
      // gente balançando — que era a queixa de "não dá para ver o que acontece".
      const faina = h.obra ? (g.golpe ? 1 - 2 * Math.abs(((fase / 6.28) % 1) - 0.5) : Math.sin(fase)) : 0;
      const corrida = h.fugindo > 0 ? 1 : 0;
      const passo = h.alvo ? Math.abs(Math.sin(this.tempo * (corrida ? 15 : 9) + h.y)) * (corrida ? 0.13 : 0.07) : 0;
      this.aux.scale.set(s * (1 - Math.abs(faina) * g.encolhe), s * (1 + Math.abs(faina) * g.estica), s);
      // `curva` é a postura fixa da tarefa (agachado na roça, lançado no golpe)
      // e `faina` é o movimento por cima dela. Quem foge corre inclinado.
      this.aux.rotation.set(g.curva + faina * g.balanco + corrida * 0.30, giro, faina * g.torce);
      this.aux.position.y += passo + Math.abs(faina) * g.pulo;
      this.cor.set(h.tribo ? h.tribo.cor : 0xd8d2c0);
      if (h.fome > 0.75) this.cor.lerp(this._tinta.set(0x201a12), 0.45);
      this.por(`humano:${h.dom in FIG_HUMANO ? h.dom : 'lavrador'}`, this.cor);
    }

    // O rebanho tem três estados que dá para ler de longe: andando (trote e
    // corpo no prumo), pastando (focinho no chão, quase parado) e magro (anda
    // sem pastar, e é assim que se vê o pasto acabando antes de o bicho morrer).
    for (const r of sim.rebanhos) {
      if (!r.viva) continue;
      const anda = !!r.alvo;
      // Bicho um pouco menor que o tile. Em tamanho cheio, um curral lotado —
      // e lotado é o normal, três cabeças por pessoa — vira um tapete branco
      // sem chão à vista; com 0,84 lê-se rebanho apertado, que é o que é.
      const fig = FIG_BICHO[r.especie] || 'rebanho';
      const e = ESPECIES[r.especie] || ESPECIES.gado;
      const base = (r.domesticado ? 0.84 : 0.78) * e.escalaDesenho * this.escalaEntrada(r);
      const giro = anda ? Math.atan2(r.alvo.x - r.x, r.alvo.y - r.y) : giroParado(r);
      const passo = this.tempo * (anda ? 8.4 : 1.5) + r.x * 2.1 + r.y * 1.7;
      const balanco = Math.sin(passo);
      const amplitude = anda ? 0.52 : 0.05;
      // focinho no chão quando não está indo a lugar nenhum: é o desenho de
      // "comendo", e o que faz um pasto cheio parecer pasto e não estacionamento
      const focinho = anda ? 0 : 0.30;
      const chao = this.alturaEm(r.x, r.y);
      this.aux.position.set(r.x, chao + Math.abs(balanco) * (anda ? 0.045 : 0.006), r.y);
      this.aux.rotation.set(focinho, giro, balanco * (anda ? 0.05 : 0.015));
      this.aux.scale.setScalar(base);
      this.por(fig);
      this.porPatas(`${fig}:pata`, r.x, chao, r.y, giro, base, passo, amplitude);
    }

    // A fera anda em três marchas: parada, rondando e em cima da presa. A
    // terceira é a que interessa ver chegando na cerca do curral.
    for (const p of sim.predadores) {
      if (!p.viva) continue;
      const mira = p.presa || p.alvo;
      const caca = !!p.presa;
      // Bote: em cima da presa a fera não corre, ela investe. Levanta o dianteiro
      // e desaba para a frente num tranco só. É o que faltava para dar para ver
      // que ela está atacando e não apenas passando por perto.
      const bote = caca && Math.hypot(p.presa.x - p.x, p.presa.y - p.y) < 2.2;
      const base = this.escalaEntrada(p);
      const giro = mira ? Math.atan2(mira.x - p.x, mira.y - p.y) : giroParado(p);
      const passo = this.tempo * (bote ? 9 : caca ? 13 : mira ? 8 : 1.2) + p.x * 1.9 + p.y * 2.3;
      const balanco = bote ? 1 - 2 * Math.abs(((passo / 6.28) % 1) - 0.5) : Math.sin(passo);
      const amplitude = bote ? 1.0 : caca ? 0.72 : mira ? 0.46 : 0.05;
      const chao = this.alturaEm(p.x, p.y);
      // no galope o corpo sobe e encolhe junto com a passada: é o que dá a
      // leitura de esforço que separa a fera rondando da fera atacando
      this.aux.position.set(p.x, chao + Math.abs(balanco) * (bote ? 0.16 : caca ? 0.085 : 0.03), p.y);
      this.aux.rotation.set(bote ? -0.30 + balanco * 0.75 : balanco * (caca ? 0.10 : 0.03), giro, 0);
      const magro = bote ? 1 + balanco * 0.10 : 1;
      this.aux.scale.set(base, base * (1 - Math.abs(balanco) * (caca ? 0.05 : 0.015)), base * magro);
      this.por('predador');
      this.porPatas('predador:pata', p.x, chao, p.y, giro, base, passo, amplitude);
    }

    // Bicho de água anda na lâmina, não no leito: desenhar no chão do tile
    // deixaria o peixe enterrado no fundo, invisível sob a água translúcida.
    for (const p of sim.peixes) {
      if (!p.viva) continue;
      const i = this.mundo.dentro(Math.round(p.x), Math.round(p.y))
        ? this.mundo.idx(Math.round(p.x), Math.round(p.y)) : 0;
      const nada = Math.sin(this.tempo * 7 + p.x * 3 + p.y);
      this.aux.position.set(p.x, this.alturaDaLamina(i) - 0.10 + nada * 0.02, p.y);
      this.aux.rotation.set(0, p.alvo ? Math.atan2(p.alvo.x - p.x, p.alvo.y - p.y) : giroParado(p), nada * 0.25);
      this.aux.scale.setScalar(this.escalaEntrada(p));
      this.por('peixe');
    }

    for (const j of sim.jacares) {
      if (!j.viva) continue;
      const i = this.mundo.dentro(Math.round(j.x), Math.round(j.y))
        ? this.mundo.idx(Math.round(j.x), Math.round(j.y)) : 0;
      const mira = j.presa || j.alvo;
      // Giro da morte: agarrada a presa, o jacaré rola em torno do próprio
      // comprimento. É o gesto que identifica o bicho, e é o que faz um ataque
      // na água ser visível de cima — antes ele só encostava e a presa sumia.
      const agarrou = j.presa && Math.hypot(j.presa.x - j.x, j.presa.y - j.y) < 1.8;
      const rasteja = mira ? Math.sin(this.tempo * 5 + j.x) : Math.sin(this.tempo * 1.1 + j.y);
      this.aux.position.set(j.x, this.alturaDaLamina(i) - (agarrou ? 0.02 : 0.05), j.y);
      this.aux.rotation.set(agarrou ? Math.sin(this.tempo * 11) * 0.12 : 0,
                            mira ? Math.atan2(mira.x - j.x, mira.y - j.y) : giroParado(j),
                            agarrou ? this.tempo * 7 % 6.283 : rasteja * 0.05);
      this.aux.scale.setScalar(this.escalaEntrada(j));
      this.por('jacare');
    }

    // Fogo. Desenhado por quadro porque tremula, e o tile embaixo é repintado
    // junto: incêndio que não se vê não assusta ninguém.
    if (this.mundo.queimando.size) {
      for (const i of this.mundo.queimando) {
        const x = i % N, y = (i / N) | 0;
        const tremor = Math.sin(this.tempo * 13 + i) * 0.5 + Math.sin(this.tempo * 7.3 + i * 2) * 0.5;
        const força = 0.5 + Math.min(1, this.mundo.fogo[i] * 2.2) * 0.7;
        this.aux.position.set(x, this.alturaColuna(i), y);
        this.aux.rotation.set(0, i * 1.7, 0);
        this.aux.scale.set(força * (1 + tremor * 0.09), força * (1.15 + tremor * 0.22), força * (1 + tremor * 0.09));
        this.por('chama');
      }
    }

    for (const t of sim.tribos) {
      for (const o of t.ocas) {
        this.aux.position.set(o.x, this.alturaEm(o.x, o.y), o.y);
        this.aux.rotation.set(0, ((o.x * 31 + o.y * 17) % 6.28), 0);
        this.aux.scale.setScalar(this.escalaEntrada(o));
        this.por('oca', this.cor.set(t.cor));
      }
    }

    this.fecharLote(nomes);

    // espiga muda com a maturação, e cerca só muda quando alguém amplia o
    // curral: nenhuma das duas precisa ser reescrita a cada quadro. Redesenhar
    // mil e trezentos mourões sessenta vezes por segundo já custou dois anos de
    // mundo por partida no headless.
    this.relogioCenario += dt;
    if (this.relogioCenario > 0.7) {
      this.relogioCenario = 0;
    this.assinaturaCercas = '';
      this.refazerCenario();
      this.refazerCercas(sim);
    }
  }

  /**
   * As quatro patas de um bicho, cada uma girando no próprio quadril e em trote
   * diagonal — dianteira esquerda junto com traseira direita. É o motivo de o
   * bicho ser duas figuras e não uma: dentro de uma instância só não há como
   * mover parte da malha, e o rebanho inteiro deslizava de perna dura.
   */
  porPatas(nome, x, chao, z, giro, escala, passo, amplitude) {
    const cg = Math.cos(giro), sg = Math.sin(giro);
    for (const q of QUADRIS) {
      this.aux.position.set(x + (q.x * cg + q.z * sg) * escala,
                            chao + q.y * escala,
                            z + (-q.x * sg + q.z * cg) * escala);
      this.aux.rotation.set(Math.sin(passo + q.fase) * amplitude, giro, 0);
      this.aux.scale.setScalar(escala);
      this.por(nome);
    }
  }

  /** Mourões de todos os currais. Mourão fica de través ao raio: girar pelo
   *  ângulo de saída deixaria toda a cerca apontando para o centro, que lê como
   *  estaca solta e não como volta fechada. */
  refazerCercas(sim) {
    // Cerca, muro e poço só mudam quando alguém constrói, o que acontece umas
    // poucas vezes por século. Reescrever mil pedras a cada meio segundo por
    // nada é o tipo de gasto que não aparece no relógio e aparece na conta.
    let assinatura = '';
    for (const t of sim.tribos) {
      assinatura += `${t.id}:${t.cercas.length}:${t.muros.length}:${t.fontes.length},`;
    }
    if (assinatura === this.assinaturaCercas) return;
    this.assinaturaCercas = assinatura;

    this.abrirLote(['cerca', 'poco', 'muro']);
    for (const t of sim.tribos) {
      if (!t.cercas.length) continue;
      this.cor.set(t.cor);
      for (const m of t.cercas) {
        this.aux.position.set(m.x, this.alturaEm(m.x, m.y), m.y);
        this.aux.rotation.set(0, -(m.ang + Math.PI / 2), 0);
        this.aux.scale.setScalar(this.escalaEntrada(m));
        this.por('cerca', this.cor);
      }
      // muro: de través ao raio, como o mourão, mas em volta da aldeia
      for (const m of t.muros) {
        const ang = Math.atan2(m.y - t.cy, m.x - t.cx);
        this.aux.position.set(m.x, this.alturaEm(m.x, m.y), m.y);
        this.aux.rotation.set(0, -(ang + Math.PI / 2), 0);
        this.aux.scale.setScalar(this.escalaEntrada(m));
        this.por('muro', this.cor);
      }
      for (const f of t.fontes) {
        if (f.tipo !== 'poco') continue;
        this.aux.position.set(f.x, this.alturaEm(f.x, f.y), f.y);
        this.aux.rotation.set(0, ((f.x * 23 + f.y * 11) % 628) / 100, 0);
        this.aux.scale.setScalar(this.escalaEntrada(f));
        this.por('poco', this.cor);
      }
    }
    this.fecharLote(['cerca', 'poco', 'muro']);
  }

  marcarPincel(x, y, raio, visivel) {
    this.alvoPincel.visible = visivel;
    if (!visivel) return;
    const i = this.mundo.dentro(Math.round(x), Math.round(y))
      ? this.mundo.idx(Math.round(x), Math.round(y)) : 0;
    this.alvoPincel.position.set(x, this.alturaColuna(i) + 0.04, y);
    this.alvoPincel.scale.setScalar(Math.max(0.6, raio));
  }

  /** Feedback de pintura/colocação: anel que nasce no chão e se dissolve. */
  pulso(x, y, cor = 0xefc65b) {
    const agora = this.tempo;
    const longe = Math.hypot(x - this.ultimoPulso.x, y - this.ultimoPulso.y) > 1.1;
    if (!longe && agora - this.ultimoPulso.quando < 0.09) return;
    this.ultimoPulso = { x, y, quando: agora };
    const i = this.mundo.dentro(Math.round(x), Math.round(y))
      ? this.mundo.idx(Math.round(x), Math.round(y)) : 0;
    const material = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.7,
      side: THREE.DoubleSide, depthTest: false, depthWrite: false });
    const malha = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.46, 24), material);
    malha.rotation.x = -Math.PI / 2;
    malha.position.set(x, this.alturaColuna(i) + 0.07, y);
    malha.renderOrder = 10;
    this.cena.add(malha);
    this.efeitos.push({ malha, inicio: agora });
    this.totalPulsos++;
    while (this.efeitos.length > 18) this.removerEfeito(this.efeitos.shift());
  }

  /**
   * Árvore tombando. Não é enfeite: sem ver a árvore cair, "derruba a última
   * árvore do lugar" é um tile mudando de cor, e a coisa mais consequente que
   * uma tribo faz com a paisagem passa despercebida.
   */
  derrubarArvore(x, y) {
    const f = this.figuras.get('arvore');
    if (!f || !f.natural) return;
    const i = this.mundo.dentro(x, y) ? this.mundo.idx(x, y) : 0;
    const malha = new THREE.Mesh(f.natural.geometry, f.natural.material);
    malha.position.set(x, this.alturaColuna(i), y);
    // o eixo do tombo é estável por tile: a mesma árvore cai sempre para o
    // mesmo lado, e duas vizinhas não caem em paralelo
    malha.userData.giro = ((x * 31 + y * 17) % 628) / 100;
    this.cena.add(malha);
    this.efeitos.push({ malha, inicio: this.tempo, tipo: 'tombo', dur: 1.5 });
    while (this.efeitos.length > 26) this.removerEfeito(this.efeitos.shift());
  }

  atualizarEfeitos() {
    const tempo = this.tempo;
    this.mar.position.y += (0.4 + Math.sin(tempo * 0.55) * 0.025 - this.mar.position.y) * 0.06;
    this.marBrilho.rotation.z = 0.18 + Math.sin(tempo * 0.08) * 0.035;
    this.marBrilho.material.opacity = 0.035 + (Math.sin(tempo * 0.7) + 1) * 0.012;
    for (let k = this.efeitos.length - 1; k >= 0; k--) {
      const e = this.efeitos[k];
      const idade = (tempo - e.inicio) / (e.dur || 0.62);
      if (idade >= 1) {
        this.removerEfeito(e);
        this.efeitos.splice(k, 1);
        continue;
      }
      if (e.tipo === 'tombo') {
        // acelera como coisa que cai, treme no fim e some
        const t = Math.min(1, idade * 1.45);
        const ang = (Math.PI / 2) * (t * t) + (t >= 1 ? Math.sin(tempo * 24) * 0.02 : 0);
        e.malha.rotation.set(0, e.malha.userData.giro, ang);
        e.malha.scale.setScalar(1 - Math.max(0, idade - 0.75) * 3.2);
        continue;
      }
      const escala = 0.7 + (1 - (1 - idade) ** 3) * 2.7;
      e.malha.scale.setScalar(escala);
      e.malha.material.opacity = (1 - idade) * 0.72;
      e.malha.position.y += 0.0015;
    }
  }

  removerEfeito(e) {
    if (!e) return;
    this.cena.remove(e.malha);
    // o tombo empresta a geometria e o material da malha instanciada de árvore:
    // descartar aqui apagaria todas as árvores do mundo de uma vez
    if (e.tipo === 'tombo') return;
    e.malha.geometry.dispose();
    e.malha.material.dispose();
  }

  /** Solta tudo o que este mundo pôs na cena. */
  descartar() {
    for (const e of [...this.efeitos]) this.removerEfeito(e);
    this.efeitos.length = 0;
    const malhas = [this.chao, this.mar, this.marBrilho, this.alvoPincel];
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
/** Cada herbívoro tem boneco próprio; o gado usa a figura histórica 'rebanho'. */
const FIG_BICHO = { gado: 'rebanho', capivara: 'capivara', lebre: 'lebre' };

/**
 * Como cada trabalho se parece. `curva` é a postura parada da tarefa, `balanco`
 * o quanto o movimento por cima dela vai e volta, e `golpe` troca a senoide por
 * um serrote — sobe devagar, desce de uma vez, que é como se dá machadada.
 */
const GESTO = {
  padrao:    { ritmo: 6.5, curva: 0,    balanco: 0.30, torce: 0.08, pulo: 0.05, encolhe: 0.025, estica: 0.05 },
  lutar:     { ritmo: 9,   curva: 0.16, balanco: 0.60, torce: 0.20, pulo: 0.11, encolhe: 0.05,  estica: 0.03, golpe: true },
  enfrentar: { ritmo: 8,   curva: 0.20, balanco: 0.66, torce: 0.24, pulo: 0.13, encolhe: 0.05,  estica: 0.03, golpe: true },
  lenhar:    { ritmo: 5,   curva: 0.10, balanco: 0.85, torce: 0.05, pulo: 0.03, encolhe: 0.04,  estica: 0.02, golpe: true },
  minerar:   { ritmo: 6.5, curva: 0.14, balanco: 0.70, torce: 0.06, pulo: 0.03, encolhe: 0.04,  estica: 0.02, golpe: true },
  construir: { ritmo: 7.5, curva: 0.08, balanco: 0.45, torce: 0.04, pulo: 0.04, encolhe: 0.03,  estica: 0.03, golpe: true },
  // Roça: agachado sobre o próprio canteiro, indo e voltando devagar. A curva
  // era 0,62 e 0,70 e de perto a pessoa parecia deitada de bruços, não curvada.
  arar:      { ritmo: 3.2, curva: 0.46, balanco: 0.26, torce: 0.05, pulo: 0.02, encolhe: 0.02,  estica: 0.02 },
  colher:    { ritmo: 3.6, curva: 0.52, balanco: 0.22, torce: 0.09, pulo: 0.02, encolhe: 0.02,  estica: 0.02 },
  pastorear: { ritmo: 3.0, curva: 0.30, balanco: 0.18, torce: 0.06, pulo: 0.02, encolhe: 0.02,  estica: 0.02 },
  forragear: { ritmo: 3.4, curva: 0.44, balanco: 0.24, torce: 0.07, pulo: 0.02, encolhe: 0.02,  estica: 0.02 },
  // pescar é ficar quieto na margem, com um tranco de vez em quando
  pescar:    { ritmo: 1.6, curva: 0.06, balanco: 0.14, torce: 0.03, pulo: 0.01, encolhe: 0.01,  estica: 0.01 },
  vigiar:    { ritmo: 0.9, curva: 0,    balanco: 0.05, torce: 0.02, pulo: 0.01, encolhe: 0.01,  estica: 0.01 },
  arrebanhar:{ ritmo: 5,   curva: 0.24, balanco: 0.34, torce: 0.14, pulo: 0.04, encolhe: 0.03,  estica: 0.02 },
  cercar:    { ritmo: 6,   curva: 0.30, balanco: 0.50, torce: 0.06, pulo: 0.03, encolhe: 0.03,  estica: 0.02, golpe: true },
};
