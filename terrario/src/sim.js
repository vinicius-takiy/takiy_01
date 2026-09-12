// O relógio do mundo: tica agentes, forma tribos, resolve fronteiras e escreve
// a crônica. Nada aqui desenha nada — a simulação roda inteira sem render, que
// é o que permite o teste rodar trezentos anos em segundos e conferir se o
// mundo se sustenta.

import { Mundo, N, T, TERRENOS, mulberry } from './mundo.js';
import { Humano, Rebanho, Predador, Peixe, Jacare, ANO, MADEIRA_OCA } from './agentes.js';
import { Tribo, encontro, comerciar, encontrarSitioDeOca, reiniciarIds, TECNOLOGIAS, MADEIRA_CERCA,
         VOCACOES, CHAVES_VOCACAO, rende, sortearVocacao, temLider } from './tribos.js';

// Teto de segurança, não regra de jogo: quando a ecologia encosta nele é sinal
// de que falta freio no mundo, e é o que a asserção do teste cobra.
const TETO_HUMANOS = 900;
// 320 herbívoros numa ilha de 80x80 varrem a melhor forragem e matam os bandos
// humanos de fome antes da primeira roça. Medido isolado, o rebanho sozinho
// satura qualquer teto que se dê a ele — então o teto é a régua.
const TETO_REBANHO = 200;
const TETO_PREDADOR = 60;
const TETO_JACARE = 40;
/**
 * Capacidade da água, em peixe por tile. Não é um teto de segurança como o de
 * humano: é a densidade que a água sustenta, e ela acompanha o mapa que o
 * jogador pintou — um mar grande dá cardume grande, um açude dá cinco peixes.
 * A 0,30 o cardume batia no limite em vinte anos e ficava lá, que é a mesma
 * cara de "encostou no teto do código" que a população humana já teve.
 */
const PEIXE_POR_TILE = 0.10;
const PASSO_TRIBOS = 1.0;      // segundos de simulação entre revisões de tribo
const CELA = 8;                // lado da célula do índice espacial, em tiles
const LIMITE_CISAO = 34;       // acima disto a tribo tende a se partir em duas
const UPKEEP_OCA = 0.30;       // lenha por oca por ano só para manter o telhado

export class Simulacao {
  constructor(semente = Date.now() & 0xffff, { pelado = false } = {}) {
    reiniciarIds();
    this.sorte = mulberry(semente);
    this.mundo = new Mundo(semente, pelado);
    this.humanos = [];
    this.rebanhos = [];
    this.predadores = [];
    this.peixes = [];
    this.jacares = [];
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
    this.ferasAbatidasNaCerca = 0;
    this.guardasMortos = 0;
    this.afogados = 0;
    this.pescados = 0;
  }

  get ano() { return Math.floor(this.tempo / ANO); }

  /** Quanto peixe a água deste mundo comporta. Conta uma vez: o mapa muda pouco
   *  e varrer 6400 tiles a cada desova sairia caro à toa. */
  get tetoPeixe() {
    if (this._tetoPeixe === undefined) this.recontarAgua();
    return this._tetoPeixe;
  }

  recontarAgua() {
    let n = 0;
    for (let i = 0; i < this.mundo.terreno.length; i++) if (this.mundo.terreno[i] === T.AGUA) n++;
    this.tilesDeAgua = n;
    this._tetoPeixe = Math.min(600, Math.round(n * PEIXE_POR_TILE));
  }
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
  /** Quantos outros bichos vivos há à volta. É o que autoriza reprodução: bicho
   *  solto no mapa não faz manada, e manada é o que se multiplica. */
  manadaAoRedor(r, raio = 5) {
    let n = 0;
    for (const o of this.perto(r.x, r.y, raio, 'rebanhos')) {
      if (o !== r && o.viva && Math.hypot(o.x - r.x, o.y - r.y) <= raio) n++;
    }
    return n;
  }

  /** Bicho selvagem que vale a pena ir buscar: perto do condutor e perto o
   *  bastante do curral para a viagem terminar antes de dar fome nele. */
  bichoSoltoPerto(h, t) {
    const c = t.curral;
    if (!c) return null;
    let melhor = null, md = 13;
    for (const r of this.rebanhos) {
      if (!r.viva || r.domesticado || r.conduzido) continue;
      if (Math.hypot(r.x - c.x, r.y - c.y) > c.raio + 18) continue;
      const d = Math.hypot(r.x - h.x, r.y - h.y);
      if (d < md) { md = d; melhor = r; }
    }
    return melhor;
  }

  /** Fera rondando a cerca. Um pouco além dela: o guarda sai ao encontro. */
  feraNoCurral(t) {
    const c = t.curral;
    if (!c) return null;
    let melhor = null, md = c.raio + 5;
    for (const p of this.predadores) {
      if (!p.viva) continue;
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < md) { md = d; melhor = p; }
    }
    return melhor;
  }
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
    for (const p of this.peixes) if (p.viva) p.atualizar(dt, this);
    for (const j of this.jacares) if (j.viva) j.atualizar(dt, this);

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
      if (h.causa === 'fera') { this.mortesPorPredador++; this.guardasMortos++; }
      if (h.causa === 'afogado') this.afogados++;
    }
    if (this.humanos.some((h) => !h.viva)) this.humanos = this.humanos.filter((h) => h.viva);
    if (this.rebanhos.some((r) => !r.viva)) {
      for (const r of this.rebanhos) {
        if (r.viva) continue;
        if (r.causa === 'afogado') this.afogados++;
        if (r.domesticado && r.tribo) r.tribo.cabecas--;
      }
      this.rebanhos = this.rebanhos.filter((r) => r.viva);
    }
    if (this.predadores.some((p) => !p.viva)) this.predadores = this.predadores.filter((p) => p.viva);
    if (this.peixes.some((p) => !p.viva)) this.peixes = this.peixes.filter((p) => p.viva);
    if (this.jacares.some((j) => !j.viva)) this.jacares = this.jacares.filter((j) => j.viva);
  }

  // ------------------------------------------------------------- água
  cardumeAoRedor(p, raio = 6) {
    let n = 0;
    for (const o of this.peixes) {
      if (o === p || !o.viva) continue;
      if (Math.hypot(o.x - p.x, o.y - p.y) <= raio && ++n >= 2) return n;
    }
    return n;
  }

  peixePerto(x, y, raio) {
    let melhor = null, md = raio;
    for (const p of this.peixes) {
      if (!p.viva) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < md) { md = d; melhor = p; }
    }
    return melhor;
  }

  /** Bicho de terra que caiu na água. É a refeição grande do jacaré. */
  afogadoPerto(x, y, raio) {
    let melhor = null, md = raio;
    for (const r of this.rebanhos) {
      if (!r.viva || !this.mundo.ehAgua(Math.round(r.x), Math.round(r.y))) continue;
      const d = Math.hypot(r.x - x, r.y - y);
      if (d < md) { md = d; melhor = r; }
    }
    return melhor;
  }

  abatidoNaAgua(alvo) {
    alvo.viva = false;
    if (alvo.causa === undefined) alvo.causa = 'jacare';
  }

  nascerPeixe(mae) {
    const p = new Peixe(mae.x + (this.sorte() - 0.5), mae.y + (this.sorte() - 0.5), this.sorte);
    if (!this.mundo.ehAgua(Math.round(p.x), Math.round(p.y))) { p.x = mae.x; p.y = mae.y; }
    this.peixes.push(p);
  }

  nascerJacare(pai) {
    if (this.jacares.length >= Math.min(TETO_JACARE, 2 + this.peixes.length / 20)) return;
    const j = new Jacare(pai.x, pai.y, this.sorte);
    this.jacares.push(j);
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
      let roças = 0, costa = false;
      for (const i of t.territorio) {
        if (this.mundo.terreno[i] === T.PLANTACAO) roças++;
        if (!costa && this.mundo.naMargem(i % N, (i / N) | 0)) costa = true;
      }
      t.plantios = roças;
      t.temCosta = costa;
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

    // 4d. Manutenção do abrigo. É o freio que faltava: sem ele a população
    //     encostava no teto do código e ficava lá, porque nada mais crescia com
    //     ela. Com ele, cada oca de pé cobra lenha todo ano, e uma tribo que
    //     derrubou a mata inteira começa a perder telhado — que é exatamente o
    //     preço de não esperar a árvore nascer.
    const anos = dt / ANO;
    for (const t of this.tribos) {
      if (!t.ocas.length) continue;
      const conserto = t.ocas.length * anos * UPKEEP_OCA;
      if (t.madeira >= conserto) {
        t.madeira -= conserto;
      } else if (this.sorte() < conserto - t.madeira) {
        t.madeira = 0;
        t.ocas.pop();
        this.cronica(`Uma oca de ${t.nome} desaba por falta de madeira`, t, 'ruina', true);
      }
    }

    // 5. tecnologia
    for (const t of this.tribos) t.investirEmTecnologia((txt, tr, tipo) => this.cronica(txt, tr, tipo));

    // 6. fome coletiva vira aviso, não surpresa
    for (const t of this.tribos) {
      if (t.pop >= 4 && t.faminta) this.cronica(`${t.nome} passa fome`, t, 'fome', true);
      // sem mata não há abrigo, e sem abrigo a tribo para de crescer: é o aviso
      // que diz ao jogador para pintar floresta
      if (t.pop >= 3 && !t.temVagaEmCasa && t.madeira < t.custoDaOca(MADEIRA_OCA) && t.farta) {
        this.cronica(`${t.nome} precisa de madeira para abrigar mais gente`, t, 'semLenha', true);
      }
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
          // escapou: dispara para longe de quem caçou, e em pânico — o que
          // significa que a água deixa de ser parede. É daí que sai a cena de
          // bicho fugindo para dentro do rio e não voltando.
          const a = Math.atan2(presa.y - h.y, presa.x - h.x);
          presa.alvo = { x: Math.round(presa.x + Math.cos(a) * 9), y: Math.round(presa.y + Math.sin(a) * 9) };
          presa.panico = 0.9;
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
        if (!t) break;
        // a primeira cerca é de galho torto e sai pela metade; ampliar já cobra
        // a lenha cheia, porque é aí que a cerca disputa com o telhado
        const custo = t.curral ? MADEIRA_CERCA : Math.round(MADEIRA_CERCA * 0.5);
        if (t.madeira < custo) break;
        t.madeira -= custo;
        const novo = !t.curral;
        t.cercar(mundo, Math.round(h.x), Math.round(h.y));
        t.temPasto = true;
        if (novo) this.cronica(`${t.nome} ergue um curral`, t, 'pasto', true);
        else this.cronica(`${t.nome} amplia o curral`, t, 'curral', true);
        break;
      }
      case 'arrebanhar': {
        // pega o bicho e passa a tocá-lo até o curral; quem entrega é 'recolher'
        if (!t || !t.curral || h.conduzindo) break;
        let bicho = null, md = 2.4;
        for (const r of this.rebanhos) {
          if (!r.viva || r.domesticado || r.conduzido) continue;
          const d = Math.hypot(r.x - h.x, r.y - h.y);
          if (d < md) { md = d; bicho = r; }
        }
        if (!bicho) break;
        // bicho selvagem se assusta: nem toda tentativa pega
        if (this.sorte() > 0.55 + rende(h, 'arrebanhar') * 0.2) {
          const a = Math.atan2(bicho.y - h.y, bicho.x - h.x);
          bicho.alvo = { x: Math.round(bicho.x + Math.cos(a) * 7), y: Math.round(bicho.y + Math.sin(a) * 7) };
          break;
        }
        bicho.conduzido = h;
        h.conduzindo = bicho;
        h.alvo = { x: Math.round(t.curral.x), y: Math.round(t.curral.y), obra: 'recolher' };
        break;
      }
      case 'recolher': {
        const bicho = h.conduzindo;
        h.conduzindo = null;
        if (!bicho) break;
        bicho.conduzido = null;
        if (!bicho.viva || !t || !t.dentroDoCurral(bicho.x, bicho.y)) break;
        bicho.domesticado = true;
        bicho.tribo = t;
        t.cabecas++;
        this.cronica(`${t.nome} recolhe o primeiro rebanho ao curral`, t, 'pecuaria', true);
        break;
      }
      case 'pescar': {
        const peixe = this.peixePerto(h.x, h.y, 5);
        if (!peixe) break;
        // Sem rede, pescar erra muito. A técnica melhora, e o pescador é quem
        // faz disso ofício — senão qualquer um na margem esvazia o cardume.
        if (this.sorte() < (0.34 + (t ? t.tecnologia * 0.10 : 0)) * rende(h, 'pescar')) {
          peixe.viva = false;
          this.pescados++;
          this.depositar(h, 2.2 * (1 + (t ? t.tecnologia * 0.2 : 0)));
          if (t) this.cronica(`${t.nome} come do rio`, t, 'pesca', true);
        }
        break;
      }
      case 'vigiar': {
        // O plantão em si não produz nada: o efeito do guarda está em estar ali
        // quando a fera chega, e em pesar na força da tribo contra vizinho.
        break;
      }
      case 'enfrentar': {
        // o índice espacial só cobre gente e rebanho; a lista de feras é curta
        // o bastante para varrer inteira
        let fera = null, md = 2.4;
        for (const p of this.predadores) {
          if (!p.viva) continue;
          const d = Math.hypot(p.x - h.x, p.y - h.y);
          if (d < md) { md = d; fera = p; }
        }
        if (!fera) break;
        // O guarda leva vantagem, senão não compensa sustentar quem não planta.
        const chance = Math.min(0.9, 0.5 + (t ? t.tecnologia * 0.08 : 0) + (rende(h, 'enfrentar') - 1) * 0.22);
        if (this.sorte() < chance) {
          fera.viva = false;
          this.ferasAbatidasNaCerca++;
          this.cronica(`Guarda de ${t.nome} abate uma fera na cerca`, t, 'guarda', true);
        } else if (this.sorte() < 0.35) {
          h.morrer('fera');
          this.cronica(`Um guarda de ${t.nome} morre para a fera`, t, 'guardaMorto', true);
        } else {
          // enxotada: a fera larga a caça e some por um tempo
          fera.presa = null;
          const a = this.sorte() * Math.PI * 2, d = 16 + this.sorte() * 14;
          const nx = Math.round(fera.x + Math.cos(a) * d), ny = Math.round(fera.y + Math.sin(a) * d);
          fera.alvo = mundo.andavel(nx, ny) ? { x: nx, y: ny } : null;
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
      case 'lenhar': {
        if (mundo.terreno[i] !== T.FLORESTA || !t) break;
        const tirado = Math.min(mundo.madeira[i], 0.34);
        mundo.madeira[i] -= tirado;
        t.madeira += tirado * 9 * rende(h, 'construir');
        if (mundo.madeira[i] <= 0.02) {
          // mata derrubada vira campo e entra na fila da rebrota, que só anda se
          // sobrar floresta vizinha para semear
          mundo.madeira[i] = 0;
          mundo.desmatados.add(i);
          mundo.definir(i, T.GRAMA);
          this.cronica(`${t.nome} derruba a última árvore do lugar`, t, 'desmate', true);
        }
        break;
      }
      case 'construir': {
        const custo = t ? t.custoDaOca(MADEIRA_OCA) : Infinity;
        if (!t || t.madeira < custo) break;
        t.madeira -= custo;
        t.ocas.push({ x: Math.round(h.x), y: Math.round(h.y) });
        this.cronica(`${t.nome} levanta o primeiro abrigo`, t, 'abrigo', true);
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
  /**
   * Comida e teto. Só comida fazia a população disparar e depois morrer de fome:
   * 80% das mortes eram inanição, com idade média de trinta anos. Exigir vaga em
   * casa amarra o crescimento ao que a tribo consegue construir.
   */
  podeNascer(t) {
    return this.humanos.length < TETO_HUMANOS
        && t.celeiro > t.pop * 2.6
        && t.temVagaEmCasa;
  }

  nascer(a, b) {
    const bebe = new Humano(a.x + (this.sorte() - 0.5), a.y + (this.sorte() - 0.5), 0, this.sorte);
    bebe.dom = sortearVocacao(this.sorte, a.tribo, a, b);
    bebe.tribo = a.tribo;
    a.tribo.membros.push(bebe);
    a.tribo.nascimentos++;
    a.tribo.celeiro -= 4;
    // uma criança por casal a cada oito a catorze anos: com cinco, a população
    // batia no teto do código antes de a ecologia dizer qualquer coisa
    a.descanso = 6 + this.sorte() * 5;
    b.descanso = 6 + this.sorte() * 5;
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
          // pedra pintada pelo jogador vem com veio: num mundo pelado o minério
          // também tem que ser coisa que ele põe, senão mineração nunca acontece
          if (pincel.terreno === T.ROCHA || pincel.terreno === T.MONTANHA) {
            mundo.minerio[i] = this.sorte() > 0.45 ? 1 + Math.floor(this.sorte() * 3) : 0;
          } else if (mundo.minerio[i]) {
            mundo.minerio[i] = 0;
          }
          mundo.definir(i, pincel.terreno);
        }
      }
      // pintou terreno: a conta de água mudou, e com ela o teto do cardume
      this._tetoPeixe = undefined;
      return;
    }
    if (pincel.tipo === 'ser') {
      const quantos = pincel.quantos || 1;
      for (let k = 0; k < quantos; k++) {
        const a = this.sorte() * Math.PI * 2, d = this.sorte() * raio;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        // peixe e jacaré só caem na água; o resto, só em chão firme
        const cabe = pincel.aquatico ? mundo.ehAgua(Math.round(x), Math.round(y))
                                     : mundo.andavel(Math.round(x), Math.round(y));
        if (!cabe) continue;
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
      // guarda não vem do balde do jogador: ele nasce da tribo que já tem cerca
      // ou fronteira quente. Soltar guarda num bando de cinco é pôr uma boca a
      // mais sem nada para vigiar.
      const balde = CHAVES_VOCACAO.filter((k) => k !== 'guarda' && k !== 'pastor' && k !== 'pescador');
      h.dom = balde[(this.sorte() * balde.length) | 0];
      this.humanos.push(h);
    } else if (especie === 'rebanho') {
      if (this.rebanhos.length >= TETO_REBANHO) return;
      this.rebanhos.push(new Rebanho(x, y, this.sorte));
    } else if (especie === 'predador') {
      if (this.predadores.length >= TETO_PREDADOR) return;
      this.predadores.push(new Predador(x, y, this.sorte));
    } else if (especie === 'peixe') {
      if (this.peixes.length >= this.tetoPeixe) return;
      this.peixes.push(new Peixe(x, y, this.sorte));
    } else if (especie === 'jacare') {
      if (this.jacares.length >= TETO_JACARE) return;
      this.jacares.push(new Jacare(x, y, this.sorte));
    }
  }

  // -------------------------------------------------------------- resumo
  resumo() {
    return {
      ano: this.ano,
      humanos: this.humanos.length,
      rebanhos: this.rebanhos.length,
      predadores: this.predadores.length,
      peixes: this.peixes.length,
      jacares: this.jacares.length,
      pescando: this.tribos.filter((t) => t.temCosta).length,
      pescados: this.pescados,
      afogados: this.afogados,
      tribos: this.tribos.length,
      comTecnologia: this.tribos.filter((t) => t.tecnologia > 0).length,
      plantando: this.tribos.filter((t) => t.temPlantacao).length,
      pastoreando: this.tribos.filter((t) => t.temPasto).length,
      currais: this.tribos.filter((t) => t.curral).length,
      gado: this.tribos.reduce((n, t) => n + t.cabecas, 0),
      guardas: this.tribos.reduce((n, t) => n + t.guardas, 0),
      ferasAbatidasNaCerca: this.ferasAbatidasNaCerca,
      guardasMortos: this.guardasMortos,
      minerando: this.tribos.filter((t) => t.temMina).length,
      abrigos: this.tribos.reduce((s, t) => s + t.ocas.length, 0),
      semAbrigo: this.tribos.filter((t) => t.pop >= 3 && !t.temVagaEmCasa).length,
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
