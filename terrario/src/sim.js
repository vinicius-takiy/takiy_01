// O relógio do mundo: tica agentes, forma tribos, resolve fronteiras e escreve
// a crônica. Nada aqui desenha nada — a simulação roda inteira sem render, que
// é o que permite o teste rodar trezentos anos em segundos e conferir se o
// mundo se sustenta.

import { Mundo, N, T, TERRENOS, mulberry } from './mundo.js';
import { Humano, Rebanho, Predador, ANO } from './agentes.js';
import { Tribo, encontro, comerciar, encontrarSitioDeOca, reiniciarIds, TECNOLOGIAS,
         VOCACOES, CHAVES_VOCACAO, rende, sortearVocacao, temLider } from './tribos.js';

const TETO_HUMANOS = 620;
// 320 herbívoros numa ilha de 80x80 varrem a melhor forragem e matam os bandos
// humanos de fome antes da primeira roça. Medido isolado, o rebanho sozinho
// satura qualquer teto que se dê a ele — então o teto é a régua.
const TETO_REBANHO = 200;
const TETO_PREDADOR = 60;
const PASSO_TRIBOS = 1.0;      // segundos de simulação entre revisões de tribo
const CELA = 8;                // lado da célula do índice espacial, em tiles
const LIMITE_CISAO = 34;       // acima disto a tribo tende a se partir em duas

export class Simulacao {
  constructor(semente = Date.now() & 0xffff) {
    reiniciarIds();
    this.sorte = mulberry(semente);
    this.mundo = new Mundo(semente);
    this.humanos = [];
    this.rebanhos = [];
    this.predadores = [];
    this.tribos = [];
    this.porId = new Map();
    this.cronicas = [];
    this.marcos = new Set();      // marcos já anunciados, para não repetir
    this.tempo = 0;               // segundos de simulação
    this.relogioTribos = 0;
    this.tetoRebanho = TETO_REBANHO;
    this.grade = new Map();       // índice espacial, refeito a cada tique
    this.mortesPorFome = 0;
    this.mortesPorPredador = 0;
    this.mortesEmGuerra = 0;
  }

  get ano() { return Math.floor(this.tempo / ANO); }
  tribo(id) { return this.porId.get(id); }

  // ------------------------------------------------------------- crônica
  cronica(texto, tribo, tipo, umaVezPorTribo = false) {
    if (umaVezPorTribo) {
      const chave = `${tribo ? tribo.id : '-'}:${tipo}`;
      if (this.marcos.has(chave)) return;
      this.marcos.add(chave);
    }
    this.cronicas.push({ ano: this.ano, texto, tipo, cor: tribo ? tribo.cor : 0x9a978c });
    if (this.cronicas.length > 140) this.cronicas.shift();
  }

  // -------------------------------------------------------------- índice
  /** Índice espacial refeito por tique: com menos de mil agentes sai mais
   *  barato reconstruir do que manter atualizado. */
  indexar() {
    this.grade.clear();
    const por = (lista, marca) => {
      for (const a of lista) {
        if (!a.viva) continue;
        const k = ((a.y / CELA) | 0) * 1000 + ((a.x / CELA) | 0);
        let c = this.grade.get(k);
        if (!c) this.grade.set(k, (c = { humanos: [], rebanhos: [] }));
        c[marca].push(a);
      }
    };
    por(this.humanos, 'humanos');
    por(this.rebanhos, 'rebanhos');
  }

  perto(x, y, raio, marca) {
    const r = Math.ceil(raio / CELA);
    const cx = (x / CELA) | 0, cy = (y / CELA) | 0;
    const saida = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const c = this.grade.get((cy + dy) * 1000 + (cx + dx));
        if (c) saida.push(...c[marca]);
      }
    }
    return saida;
  }

  maisPerto(x, y, raio, marca, filtro) {
    let melhor = null, md = raio * raio;
    for (const a of this.perto(x, y, raio, marca)) {
      if (filtro && !filtro(a)) continue;
      const d = (a.x - x) ** 2 + (a.y - y) ** 2;
      if (d < md) { md = d; melhor = a; }
    }
    return melhor;
  }

  presaPerto(x, y, raio) { return this.maisPerto(x, y, raio, 'rebanhos', (r) => r.viva); }
  humanoPerto(x, y, raio) { return this.maisPerto(x, y, raio, 'humanos', (h) => h.viva); }
  parPerto(h) {
    return this.maisPerto(h.x, h.y, 6, 'humanos',
      (o) => o !== h && o.viva && o.adulto && o.tribo === h.tribo && o.descanso <= 0);
  }

  // ---------------------------------------------------------------- tique
  tique(dt) {
    this.tempo += dt;
    this.indexar();
    this.mundo.crescerTudo(dt);

    for (const h of this.humanos) if (h.viva) h.atualizar(dt, this);
    for (const r of this.rebanhos) if (r.viva) r.atualizar(dt, this);
    for (const p of this.predadores) if (p.viva) p.atualizar(dt, this);

    this.recolherMortos();

    this.relogioTribos += dt;
    if (this.relogioTribos >= PASSO_TRIBOS) {
      this.revisarTribos(this.relogioTribos);
      this.relogioTribos = 0;
    }
  }

  recolherMortos() {
    for (const h of this.humanos) {
      if (h.viva || h.contabilizado) continue;
      h.contabilizado = true;
      if (h.tribo) {
        h.tribo.mortes++;
        if (h.causa === 'fome') this.mortesPorFome++;
      }
      if (h.causa === 'predador') this.mortesPorPredador++;
      if (h.causa === 'guerra') this.mortesEmGuerra++;
    }
    if (this.humanos.some((h) => !h.viva)) this.humanos = this.humanos.filter((h) => h.viva);
    if (this.rebanhos.some((r) => !r.viva)) {
      for (const r of this.rebanhos) if (!r.viva && r.domesticado && r.tribo) r.tribo.cabecas--;
      this.rebanhos = this.rebanhos.filter((r) => r.viva);
    }
    if (this.predadores.some((p) => !p.viva)) this.predadores = this.predadores.filter((p) => p.viva);
  }

  // --------------------------------------------------------------- tribos
  revisarTribos(dt) {
    // 1. quem perdeu membros, quem morreu inteira
    for (const t of this.tribos) {
      t.membros = t.membros.filter((m) => m.viva && m.tribo === t);
      t.idade += dt / ANO;
      if (t.pop === 0 && t.viva) {
        t.viva = false;
        this.cronica(`${t.nome} desaparece do mapa`, t, 'fim');
      }
    }
    this.tribos = this.tribos.filter((t) => t.viva);

    // 2. avulsos entram na tribo mais próxima, ou fundam a sua
    const avulsos = this.humanos.filter((h) => h.viva && !h.tribo);
    for (const h of avulsos) {
      let melhor = null, md = Infinity;
      for (const t of this.tribos) {
        const d = Math.hypot(t.cx - h.x, t.cy - h.y);
        if (d < t.raio + 3 && d < md) { md = d; melhor = t; }
      }
      if (melhor) { melhor.membros.push(h); h.tribo = melhor; }
    }
    const sozinhos = this.humanos.filter((h) => h.viva && !h.tribo);
    for (const h of sozinhos) {
      if (h.tribo) continue;
      const bando = sozinhos.filter((o) => !o.tribo && Math.hypot(o.x - h.x, o.y - h.y) < 6);
      if (bando.length < 3) continue;
      const t = new Tribo(h.x, h.y, this.tribos.length);
      for (const m of bando) { m.tribo = t; t.membros.push(m); }
      this.tribos.push(t);
      this.porId.set(t.id, t);
      // celeiro proporcional ao bando: nascer com a despensa fixa do construtor
      // matava a tribo de fome antes da primeira colheita ficar pronta
      t.celeiro = bando.length * 6;
      this.cronica(`Nasce a tribo ${t.nome}, com ${bando.length} pessoas`, t, 'fundacao');
    }

    // 2b. Cisão. Uma tribo de trezentas pessoas não é uma tribo, e sem divisão
    //     nunca existe uma segunda para fazer fronteira — some a guerra, some a
    //     aliança, e o mundo vira um organismo só crescendo até estourar.
    for (const t of [...this.tribos]) {
      if (t.pop < LIMITE_CISAO * (t.comLider ? 1.5 : 1) || this.sorte() > 0.2) continue;
      const ordenados = [...t.membros].sort((a, b) =>
        Math.hypot(b.x - t.cx, b.y - t.cy) - Math.hypot(a.x - t.cx, a.y - t.cy));
      const saem = ordenados.slice(0, Math.floor(t.pop * 0.42)).filter((m) => m.adulto || this.sorte() < 0.5);
      if (saem.length < 4) continue;
      let sx = 0, sy = 0;
      for (const m of saem) { sx += m.x; sy += m.y; }
      const cx = sx / saem.length, cy = sy / saem.length;
      // afasta o novo centro do antigo, senão os dois territórios nascem colados
      const ang = Math.atan2(cy - t.cy, cx - t.cx);
      const nova = new Tribo(cx + Math.cos(ang) * 6, cy + Math.sin(ang) * 6, this.tribos.length);
      for (const m of saem) {
        m.tribo = nova;
        nova.membros.push(m);
        t.membros.splice(t.membros.indexOf(m), 1);
      }
      nova.celeiro = t.celeiro * 0.4;
      t.celeiro *= 0.6;
      nova.tecnologia = t.tecnologia;
      this.tribos.push(nova);
      this.porId.set(nova.id, nova);
      this.cronica(`${t.nome} se divide; parte fundar ${nova.nome}`, nova, 'cisao');
    }

    // 3. território
    this.mundo.dono.fill(-1);
    const ordem = [...this.tribos].sort((a, b) => b.pop - a.pop);
    for (const t of ordem) { t.recentrar(); t.reivindicar(this.mundo, this.mundo.dono); }

    // 3b. quantos bichos selvagens pastam dentro de casa. É o gatilho do pasto:
    //     exigir cabeças já domesticadas criava um impasse sem saída.
    for (const t of this.tribos) t.rebanhosProximos = 0;
    for (const r of this.rebanhos) {
      if (!r.viva || r.domesticado) continue;
      const dono = this.mundo.dono[this.mundo.idx(Math.round(r.x), Math.round(r.y))];
      const t = dono !== -1 ? this.tribo(dono) : null;
      if (t) t.rebanhosProximos++;
    }

    // 3c. quantas roças cada tribo tem de pé. É o número que diz se ainda falta
    //     lavoura, e é o que autoriza arar mais — antes disso a expansão só
    //     acontecia com a tribo já gorda, que é justamente o que ela nunca fica.
    for (const t of this.tribos) {
      let roças = 0;
      for (const i of t.territorio) if (this.mundo.terreno[i] === T.PLANTACAO) roças++;
      t.plantios = roças;
    }

    // 4. fronteiras
    for (let a = 0; a < this.tribos.length; a++) {
      for (let b = a + 1; b < this.tribos.length; b++) {
        const A = this.tribos[a], B = this.tribos[b];
        const d = Math.hypot(A.cx - B.cx, A.cy - B.cy);
        if (d > A.raio + B.raio + 3) continue;
        encontro(A, B, d, (txt, t, tipo) => this.cronica(txt, t, tipo), this.sorte);
        if (A.relacaoCom(B) === 'aliada') comerciar(A, B);
      }
    }

    // 4b. tribo grande abate a fera que entra em casa
    for (const p of this.predadores) {
      if (!p.viva) continue;
      const dono = this.mundo.dono[this.mundo.idx(Math.round(p.x), Math.round(p.y))];
      const t = dono !== -1 ? this.tribo(dono) : null;
      // só perto da aldeia: caçar em todo o território reivindicado extinguia a
      // fera no mundo inteiro assim que as tribos chegavam ao ferro
      const perto = t && Math.hypot(p.x - t.cx, p.y - t.cy) < t.raio * 0.5;
      // quem enfrenta a fera é caçador. Toda tribo abatendo, com a taxa antiga,
      // extinguia a espécie no mundo inteiro assim que as aldeias se espalhavam.
      const temCacador = t && t.membros.some((m) => m.dom === 'cacador' && m.adulto);
      if (t && perto && temCacador && t.pop >= 4 && this.sorte() < 0.02 * (1 + t.tecnologia)) {
        p.viva = false;
        this.cronica(`${t.nome} abate uma fera`, t, 'cacada', true);
      }
    }

    // 4c. o líder é o único que não trabalha melhor em nada — o que ele muda é
    //     a tribo inteira: diplomacia, aprendizado e coesão.
    for (const t of this.tribos) t.comLider = temLider(t);

    // 5. tecnologia
    for (const t of this.tribos) t.investirEmTecnologia((txt, tr, tipo) => this.cronica(txt, tr, tipo));

    // 6. fome coletiva vira aviso, não surpresa
    for (const t of this.tribos) {
      if (t.pop >= 4 && t.faminta) this.cronica(`${t.nome} passa fome`, t, 'fome', true);
    }
  }

  // ---------------------------------------------------------------- obras
  concluirObra(h, obra) {
    const { mundo } = this;
    const t = h.tribo;
    const tec = 1 + (t ? t.tecnologia * 0.32 : 0);
    const bonus = tec * rende(h, obra);
    const i = mundo.idx(Math.round(h.x), Math.round(h.y));

    switch (obra) {
      case 'forragear': {
        const tirado = Math.min(mundo.comida[i], 0.35);
        mundo.comida[i] -= tirado;
        this.depositar(h, tirado * 4.0 * rende(h, 'forragear'));
        break;
      }
      case 'colher': {
        if (mundo.terreno[i] === T.PLANTACAO && mundo.crescer[i] >= 1) {
          mundo.crescer[i] = 0;
          mundo.tocar(i);
          this.depositar(h, 2.4 * bonus);
          mundo.vigor[i] -= 0.12;
          if (mundo.vigor[i] <= 0.02) {
            mundo.vigor[i] = 0;
            mundo.definir(i, T.GRAMA);
            if (t) this.cronica(`Terra de ${t.nome} se esgota`, t, 'esgotamento', true);
          }
        }
        break;
      }
      case 'pastorear': {
        // O rebanho é o teto. Antes isto rendia fixo enquanto houvesse uma cabeça
        // viva, o que virava uma torneira infinita: 39 pessoas com celeiro de 3394.
        if (!t || t.cabecas < 2) break;
        const porCabeca = Math.min(1, t.cabecas / Math.max(1, t.pop * 0.7));
        this.depositar(h, 1.7 * porCabeca * bonus);
        // 10% por pastoreio abatia mais cabeças do que o rebanho parias: a espécie
        // inteira sumia do mundo em algumas décadas
        if (this.sorte() < 0.03) {
          const cab = this.rebanhos.find((r) => r.viva && r.domesticado && r.tribo === t);
          if (cab) cab.viva = false;
        }
        break;
      }
      case 'cacar': {
        // Toda caçada acertando era o que extinguia o rebanho no primeiro ano:
        // dez pessoas dão ~28 caçadas por ano, e o mundo começa com 26 bichos.
        const presa = this.presaPerto(h.x, h.y, 3);
        if (!presa) break;
        if (this.sorte() < (0.38 + (t ? t.tecnologia * 0.09 : 0)) * rende(h, 'cacar')) {
          presa.viva = false;
          this.depositar(h, 2.6);
        } else {
          // escapou: dispara para longe de quem caçou
          const a = Math.atan2(presa.y - h.y, presa.x - h.x);
          presa.alvo = { x: Math.round(presa.x + Math.cos(a) * 9), y: Math.round(presa.y + Math.sin(a) * 9) };
        }
        break;
      }
      case 'arar': {
        if (TERRENOS[mundo.terreno[i]].andavel && mundo.terreno[i] === T.FERTIL) {
          mundo.definir(i, T.PLANTACAO);
          mundo.crescer[i] = 0;
          if (t) { t.temPlantacao = true; this.cronica(`${t.nome} começa a plantar`, t, 'plantio', true); }
        }
        break;
      }
      case 'cercar': {
        if (mundo.terreno[i] === T.GRAMA) {
          mundo.definir(i, T.PASTO);
          if (t) { t.temPasto = true; this.cronica(`${t.nome} cerca um pasto`, t, 'pasto', true); }
        }
        break;
      }
      case 'minerar': {
        if (mundo.minerio[i] > 0 && t) {
          t.minerais += 2.2 * mundo.minerio[i] * bonus;
          if (!t.temMina) {
            t.temMina = true;
            this.cronica(`${t.nome} abre uma mina`, t, 'mina', true);
          }
        }
        break;
      }
      case 'construir': {
        if (t) { t.ocas.push({ x: Math.round(h.x), y: Math.round(h.y) }); }
        break;
      }
      case 'lutar': {
        this.combater(h);
        break;
      }
      default: break;
    }
  }

  depositar(h, comida) {
    if (h.tribo) h.tribo.celeiro += comida;
    else h.fome = Math.max(0, h.fome - comida * 0.30);
  }

  combater(h) {
    const t = h.tribo;
    if (!t) return;
    const inimigo = this.maisPerto(h.x, h.y, 9, 'humanos',
      (o) => o.viva && o.tribo && o.tribo !== t && t.relacaoCom(o.tribo) === 'guerra');
    if (!inimigo) return;
    const meu = t.forca * rende(h, 'lutar');
    const dele = inimigo.tribo.forca * rende(inimigo, 'lutar');
    const chance = meu / (meu + dele);
    const vitima = this.sorte() < chance ? inimigo : h;
    vitima.morrer('guerra');
    // saque: quem vence leva parte do celeiro
    const vencedora = vitima === inimigo ? t : inimigo.tribo;
    const perdedora = vitima === inimigo ? inimigo.tribo : t;
    const saque = Math.min(perdedora.celeiro, 2.5);
    perdedora.celeiro -= saque;
    vencedora.celeiro += saque;
  }

  // ------------------------------------------------------------ nascer
  podeNascer(t) { return this.humanos.length < TETO_HUMANOS && t.celeiro > t.pop * 2.6; }

  nascer(a, b) {
    const bebe = new Humano(a.x + (this.sorte() - 0.5), a.y + (this.sorte() - 0.5), 0, this.sorte);
    bebe.dom = sortearVocacao(this.sorte, a.tribo, a, b);
    bebe.tribo = a.tribo;
    a.tribo.membros.push(bebe);
    a.tribo.nascimentos++;
    a.tribo.celeiro -= 4;
    a.descanso = 5 + this.sorte() * 4;
    b.descanso = 5 + this.sorte() * 4;
    this.humanos.push(bebe);
    if (a.tribo.pop === 12) this.cronica(`${a.tribo.nome} vira uma aldeia`, a.tribo, 'aldeia', true);
  }

  nascerPredador(pai) {
    // a fera não pode crescer além do que a presa sustenta
    // Uma fera come ~0,5 presa por ano; o teto tem que refletir isso. Com
    // presas/6 as feras dobravam antes do rebanho crescer, limpavam o mundo em
    // dezenove anos e morriam junto — o colapso predador-presa de manual.
    if (this.predadores.length >= Math.min(TETO_PREDADOR, 2 + this.rebanhos.length / 15)) return;
    const f = new Predador(pai.x + (this.sorte() - 0.5) * 2, pai.y + (this.sorte() - 0.5) * 2, this.sorte);
    if (!this.mundo.andavel(Math.round(f.x), Math.round(f.y))) return;
    f.idade = 0;
    this.predadores.push(f);
  }

  nascerRebanho(mae) {
    const f = new Rebanho(mae.x + (this.sorte() - 0.5) * 2, mae.y + (this.sorte() - 0.5) * 2, this.sorte);
    if (!this.mundo.andavel(Math.round(f.x), Math.round(f.y))) return;
    f.domesticado = mae.domesticado;
    f.tribo = mae.tribo;
    if (f.domesticado && f.tribo) f.tribo.cabecas++;
    this.rebanhos.push(f);
  }

  abatidoPorPredador(alvo) {
    if (alvo instanceof Humano) {
      alvo.morrer('predador');
      if (alvo.tribo) this.cronica(`Fera mata alguém de ${alvo.tribo.nome}`, alvo.tribo, 'fera', true);
    } else {
      alvo.viva = false;
    }
  }

  sitioDeOca(t) { return encontrarSitioDeOca(this.mundo, t, this.sorte); }

  // ------------------------------------------------------------- pincéis
  /** O jogador pintando no mundo. `pincel` vem da paleta da interface. */
  pintar(cx, cy, raio, pincel) {
    const { mundo } = this;
    const r2 = raio * raio;
    if (pincel.tipo === 'terreno') {
      for (let dy = -raio; dy <= raio; dy++) {
        for (let dx = -raio; dx <= raio; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const x = Math.round(cx) + dx, y = Math.round(cy) + dy;
          if (!mundo.dentro(x, y)) continue;
          const i = mundo.idx(x, y);
          mundo.base[i] = pincel.terreno;
          mundo.vigor[i] = 1;
          mundo.definir(i, pincel.terreno);
        }
      }
      return;
    }
    if (pincel.tipo === 'ser') {
      const quantos = pincel.quantos || 1;
      for (let k = 0; k < quantos; k++) {
        const a = this.sorte() * Math.PI * 2, d = this.sorte() * raio;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        if (!mundo.andavel(Math.round(x), Math.round(y))) continue;
        this.soltar(pincel.ser, x, y);
      }
      return;
    }
    if (pincel.tipo === 'apagar') {
      const alvo = (a) => (a.x - cx) ** 2 + (a.y - cy) ** 2 <= r2;
      for (const h of this.humanos) if (alvo(h)) h.morrer('removido');
      for (const r of this.rebanhos) if (alvo(r)) r.viva = false;
      for (const p of this.predadores) if (alvo(p)) p.viva = false;
      this.recolherMortos();
    }
  }

  soltar(especie, x, y) {
    if (especie === 'humano') {
      if (this.humanos.length >= TETO_HUMANOS) return;
      const h = new Humano(x, y, 16 + this.sorte() * 10, this.sorte);
      h.dom = CHAVES_VOCACAO[(this.sorte() * CHAVES_VOCACAO.length) | 0];
      this.humanos.push(h);
    } else if (especie === 'rebanho') {
      if (this.rebanhos.length >= TETO_REBANHO) return;
      this.rebanhos.push(new Rebanho(x, y, this.sorte));
    } else if (especie === 'predador') {
      if (this.predadores.length >= TETO_PREDADOR) return;
      this.predadores.push(new Predador(x, y, this.sorte));
    }
  }

  // -------------------------------------------------------------- resumo
  resumo() {
    return {
      ano: this.ano,
      humanos: this.humanos.length,
      rebanhos: this.rebanhos.length,
      predadores: this.predadores.length,
      tribos: this.tribos.length,
      comTecnologia: this.tribos.filter((t) => t.tecnologia > 0).length,
      plantando: this.tribos.filter((t) => t.temPlantacao).length,
      pastoreando: this.tribos.filter((t) => t.temPasto).length,
      minerando: this.tribos.filter((t) => t.temMina).length,
      guerras: this.tribos.reduce((s, t) => s + [...t.relacoes.values()].filter((r) => r === 'guerra').length, 0) / 2,
      aliancas: this.tribos.reduce((s, t) => s + [...t.relacoes.values()].filter((r) => r === 'aliada').length, 0) / 2,
      mortesPorFome: this.mortesPorFome,
      mortesPorPredador: this.mortesPorPredador,
      mortesEmGuerra: this.mortesEmGuerra,
      maiorTribo: this.tribos.reduce((m, t) => Math.max(m, t.pop), 0),
      tecnologiaMaxima: TECNOLOGIAS[this.tribos.reduce((m, t) => Math.max(m, t.tecnologia), 0)],
      vocacoes: CHAVES_VOCACAO.reduce((o, k) => {
        o[k] = this.humanos.filter((h) => h.viva && h.dom === k).length;
        return o;
      }, {}),
    };
  }
}

export { N, T, TERRENOS, ANO };
