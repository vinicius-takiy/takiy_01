// Tribos: quem pertence a quem, até onde vai o território, e o que acontece
// quando dois territórios se encostam.
//
// Toda a diplomacia sai de uma variável só: comida por habitante. Tribo farta
// que encosta em tribo farta faz aliança; se qualquer uma das duas está com
// fome, vira guerra. É pouca regra de propósito — é o que deixa o resultado
// depender do mundo que o jogador montou, e não de uma tabela minha.

import { N, T, TERRENOS } from './mundo.js';

const NOMES = ['Ocre', 'Basalto', 'Junco', 'Corvo', 'Sal', 'Âmbar', 'Lodo', 'Cinza',
               'Raiz', 'Vento', 'Osso', 'Barro', 'Sombra', 'Brasa', 'Musgo', 'Pedra'];
const CORES = [0xd94f3d, 0x3f7fd9, 0x9b59c6, 0xe08b28, 0x2fa39a, 0xd63c8a,
               0xd9c22e, 0x5fa63a, 0xc2603c, 0x4b6ad9, 0x8e44ad, 0x16a085];

export const TECNOLOGIAS = ['Pedra', 'Cobre', 'Bronze', 'Ferro'];

/**
 * As eras da tribo. Não é uma barra de progresso: cada degrau é uma lista de
 * coisas que têm que estar de pé ao mesmo tempo, e uma delas é sempre gente com
 * o ofício certo. É o que dá função à vocação além do bônus de trabalho — sem
 * um pastor a tribo não sai da Aldeia por mais celeiro que tenha.
 *
 * `exige` roda na revisão de tribos, que é a cada segundo de simulação. Nada
 * aqui pode ser caro.
 */
export const ERAS = [
  {
    nome: 'Bando', raio: 1, abrigo: 0, forca: 1, tecnologia: 1,
    conta: 'Vive do que acha.',
    exige: () => true,
  },
  {
    nome: 'Aldeia', raio: 1.1, abrigo: 0.3, forca: 1.15, tecnologia: 0.95,
    conta: 'Lavoura de pé, teto para todos, um lavrador e um construtor.',
    exige: (t) => t.temPlantacao && t.temVagaEmCasa && t.pop >= 8
                && t.porHabitante > 3 && t.temOficio('lavrador') && t.temOficio('construtor'),
  },
  {
    nome: 'Era da Pedra', raio: 1.25, abrigo: 0.7, forca: 1.4, tecnologia: 0.88,
    conta: 'Água própria, curral cercado, um guarda e um pastor.',
    exige: (t) => t.aguaPropria > 0 && t.curral && t.pop >= 14
                && t.temOficio('guarda') && t.temOficio('pastor'),
  },
  {
    nome: 'Era do Bronze', raio: 1.42, abrigo: 1.1, forca: 1.8, tecnologia: 0.78,
    conta: 'Mina, cobre trabalhado, muro erguido, um minerador e um artesão.',
    // Obra é da aldeia (mina, muro); ofício é da nação. Ver `temOficioNaNacao`.
    exige: (t) => t.temMina && t.tecnologia >= 1 && t.muros.length >= 8
                && t.temOficioNaNacao('minerador') && t.temOficioNaNacao('artesao'),
  },
  {
    nome: 'Feudo', raio: 1.62, abrigo: 1.6, forca: 2.3, tecnologia: 0.66,
    conta: 'Muro fechado, celeiro farto, líder à frente, e uma nação de trinta e duas almas.',
    exige: (t) => t.comLider && t.muros.length >= 20 && t.popDaNacao >= 32
                && t.celeiro > t.pop * 6 && t.temOficioNaNacao('artesao') && t.temOficioNaNacao('guarda'),
  },
];
const CUSTO_TEC = [0, 40, 140, 380];

/** Comida por habitante abaixo disto é fome declarada. */
export const LIMIAR_FOME = 1.6;
/** Acima disto a tribo tem excedente e pensa em outra coisa além de comer. */
export const LIMIAR_FARTURA = 4.2;

const BANDO_SEM_TETO = 6;
/** Quanta gente cada fonte sustenta. Rio é fonte grande e de graça; poço é
 *  pequeno, mas é o que uma tribo de sertão consegue cavar. */
const AGUA_DO_RIO = 26;
const AGUA_DO_POCO = 15;
/** Cerca não cresce para sempre: curral maior que isto vira uma parede de
 *  mourão atravessando a aldeia inteira. */
const RAIO_CURRAL = 7;
/** Lenha por rodada de cerca. A primeira sai mais barata — cerca de galho. */
export const MADEIRA_CERCA = 6;

let proximoId = 0;

export class Tribo {
  constructor(x, y, usados) {
    this.id = proximoId++;
    const k = this.id % NOMES.length;
    this.nome = NOMES[(k + (usados % 3) * 5) % NOMES.length];
    this.cor = CORES[this.id % CORES.length];
    this.corPropria = this.cor;    // a cor de antes de entrar numa nação
    this.cx = x; this.cy = y;
    this.membros = [];
    this.celeiro = 6;
    this.minerais = 0;
    this.tecnologia = 0;
    this.territorio = new Set();
    this.relacoes = new Map();     // idOutraTribo -> 'neutro' | 'aliada' | 'guerra'
    this.temPlantacao = false;
    this.temPasto = false;
    this.temMina = false;
    this.cabecas = 0;              // animais domesticados
    this.alarme = null;            // {x, y, ate} — fera avistada, guardas acorrem
    this.era = 0;                  // degrau em ERAS
    this.umidadeDaFonte = 0.5;     // média nas fontes; a seca aperta o teto
    // O que a tribo sofreu e não esqueceu. É a única memória do jogo, e é dela
    // que sai mudança de comportamento: quem apanhou de fera põe guarda, quem
    // apanhou de vizinho ergue muro, quem queimou abre clareira maior.
    this.memoria = { fera: 0, guerra: 0, fome: 0, fogo: 0 };
    this.alvoDeSaque = null;       // tribo que esta aqui resolveu tomar
    this.fontes = [];              // {x, y, tipo:'rio'|'poco'} — de onde vem a água
    this.muros = [];               // {x, y} — pedra em volta da aldeia
    this.temCosta = false;         // território encosta em água: dá para pescar
    this.curral = null;            // {x, y, raio} — o pasto cercado
    this.cercas = [];              // tiles de mourão, na volta do curral
    this.rebanhosProximos = 0;     // selvagens pastando no território
    this.plantios = 0;             // roças de pé dentro do território
    this.madeira = 0;              // lenha estocada, para levantar abrigo
    this.comLider = false;         // tem alguém com dom de liderança
    this.mae = null;               // id da tribo de que esta se separou
    this.nascidaEm = 0;            // ano da cisão
    this.nacao = null;             // {id, nome, cor, membros:Set} — a federação
    this.ocas = [];                // {x, y}
    this.viva = true;
    this.nascimentos = 0;
    this.mortes = 0;
    this.idade = 0;
  }

  get pop() { return this.membros.length; }
  get degrau() { return ERAS[this.era]; }
  temOficio(dom) { return this.membros.some((m) => m.viva && m.adulto && m.dom === dom); }

  /**
   * Registra o que doeu. O líder é o que faz a tribo aprender mais depressa —
   * é aqui que "inteligência maior" vira número, e não numa tabela de bônus.
   */
  aprender(tipo, quanto = 1) {
    this.memoria[tipo] = Math.min(12, this.memoria[tipo] + quanto * (this.comLider ? 1.8 : 1));
  }

  /** A memória esfria. Uma geração inteira sem fera e a tribo relaxa de novo. */
  esquecer(anos) {
    for (const k of Object.keys(this.memoria)) {
      this.memoria[k] = Math.max(0, this.memoria[k] - anos * 0.08);
    }
  }

  get ameacada() { return this.memoria.fera + this.memoria.guerra; }

  /**
   * Tribo sem o que comer, com gente de briga, vira saqueadora: em vez de arar,
   * vai tomar o celeiro de quem tem. É o outro caminho para fora da fome, e é o
   * que faz vizinhança rica virar problema em vez de sorte.
   */
  get saqueadora() {
    return this.faminta && this.pop >= 6 && this.guardas + this.cacadores >= 2;
  }
  get cacadores() { return this.membros.filter((m) => m.viva && m.adulto && m.dom === 'cacador').length; }

  /**
   * Quanta gente a água desta tribo sustenta. É o teto de população que
   * faltava: antes ela crescia até a comida acabar, e mil e duzentas pessoas
   * caçando varriam a fauna do mapa inteiro. Agora quem manda é a fonte, e a
   * fonte encolhe na seca — o que amarra a demografia ao clima.
   */
  get aguaPara() {
    let n = 0;
    for (const f of this.fontes) n += f.tipo === 'rio' ? AGUA_DO_RIO : AGUA_DO_POCO;
    return Math.round(n * (0.55 + this.umidadeDaFonte * 0.75));
  }
  get aguaPropria() { return this.fontes.length; }
  get comSede() { return this.pop > this.aguaPara; }
  get porHabitante() { return this.pop ? this.celeiro / this.pop : 0; }
  get faminta() { return this.porHabitante < LIMIAR_FOME; }
  get farta() { return this.porHabitante > LIMIAR_FARTURA; }
  /** Força em combate: era, gente, o que ela tem na mão, e quem treina para
   *  isso. O guarda pesa quase como uma pessoa a mais — é o que faz valer a
   *  pena sustentar gente que não produz comida. */
  get forca() {
    return (this.pop * (1 + this.tecnologia * 0.55) + this.guardas * 0.9
            + this.muros.length * 0.35) * this.degrau.forca;
  }

  get guardas() { return this.membros.filter((m) => m.viva && m.adulto && m.dom === 'guarda').length; }

  /**
   * Quanto gado cabe dentro da cerca. Um curral apertado é o que manda ampliar,
   * e ampliar custa madeira — a mesma que sustenta o telhado. É de propósito:
   * pasto grande e aldeia coberta disputam a mesma mata.
   */
  get capacidadeCurral() {
    if (!this.curral) return 0;
    // 0,85 cabeça por tile — perto do teto que o rebanho já tinha antes da
    // cerca (três cabeças por pessoa), de propósito. Apertar isto para afinar o
    // visual foi tentador e saiu caro: com 0,45 o curral passa a ser o teto do
    // rebanho, o rebanho é o que rende no pastoreio, e a semente 90210, a mais
    // pobre das cinco, morreu no ano 85. Ampliar cedo, em 70% da lotação, custa
    // mais mata e matou o rebanho selvagem em três sementes. A cerca é para
    // conter o gado num lugar visível, não para estrangular a pecuária.
    return Math.round(Math.PI * this.curral.raio * this.curral.raio * 0.85);
  }

  /** Raio do território, em tiles. Cresce devagar com a população. */
  get raio() { return Math.min(22, (3.2 + Math.sqrt(this.pop) * 2.0) * this.degrau.raio); }

  /** Cada oca acolhe duas pessoas. */
  /** Casa melhor acolhe mais gente: é o que a era faz com a mesma oca. */
  get abrigo() { return Math.round(this.ocas.length * (2 + this.degrau.abrigo)); }

  /**
   * Um punhado de gente dorme ao relento; de seis em diante precisa de teto.
   * Exigir abrigo desde a primeira pessoa travava o bando inicial: ele gastava
   * as primeiras décadas cortando lenha em vez de comer, e morria antes da
   * primeira criança.
   */
  get temVagaEmCasa() {
    if (this.pop < BANDO_SEM_TETO) return true;
    // A cobrança entra aos poucos: nada aos seis, teto para todos aos vinte.
    // Exigir cobertura total desde o começo matava a tribo em mundo pobre de
    // mata — ela precisava de cinco ocas antes do primeiro filho.
    const exigido = Math.min(1, (this.pop - BANDO_SEM_TETO) / 14);
    return this.abrigo >= this.pop * exigido;
  }

  /** As duas primeiras ocas são de galho: uma aldeia nova não tem braço sobrando. */
  custoDaOca(base) { return this.ocas.length < 2 ? Math.round(base * 0.55) : base; }

  /**
   * Ergue o curral, ou empurra a cerca um pouco para fora se ele já existe.
   * O curral fica onde foi feito e não segue o centro da tribo: benfeitoria é
   * coisa de chão. Fazer a cerca perseguir a média das posições jogaria o gado
   * para fora dela toda vez que meia dúzia saísse para caçar.
   */
  cercar(mundo, x, y) {
    if (!this.curral) this.curral = { x, y, raio: 3 };
    else this.curral.raio = Math.min(RAIO_CURRAL, this.curral.raio + 0.9);
    this.recalcularCerca(mundo);
    return this.curral;
  }

  /** Redesenha o pasto de dentro e a fila de mourões da volta. */
  recalcularCerca(mundo) {
    const c = this.curral;
    this.cercas = [];
    if (!c) return;
    const r = Math.ceil(c.raio) + 1;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx, dy);
        const x = Math.round(c.x) + dx, y = Math.round(c.y) + dy;
        if (!mundo.dentro(x, y)) continue;
        const i = mundo.idx(x, y);
        if (d <= c.raio) {
          // só campo vira pasto: engolir a roça junto derrubaria a lavoura da
          // tribo toda vez que ela ampliasse o curral
          if (mundo.terreno[i] === T.GRAMA || mundo.terreno[i] === T.TERRA) mundo.definir(i, T.PASTO);
        } else if (d <= c.raio + 1 && TERRENOS[mundo.terreno[i]].andavel) {
          this.cercas.push({ x, y, ang: Math.atan2(y - c.y, x - c.x) });
        }
      }
    }
  }

  /** Alguém viu uma fera. O ponto fica quente por uns anos: é o que faz o
   *  guarda largar o posto e ir, mesmo sem ter visto o bicho ele mesmo. */
  darAlarme(x, y, agora) {
    // Três segundos de simulação, uns nove meses de mundo. Com doze segundos o
    // ponto ficava quente três anos e os guardas iam e voltavam sem parar,
    // largando tudo o tempo todo — três das cinco sementes se extinguiam antes
    // do ano 65 sem ninguém trabalhar.
    this.alarme = { x, y, ate: agora + 3 };
  }

  dentroDoCurral(x, y) {
    const c = this.curral;
    return !!c && Math.hypot(x - c.x, y - c.y) <= c.raio;
  }

  /**
   * Posto de vigia deste guarda. A divisão é por ordem estável na lista de
   * guardas, não por sorteio: sorteado, todo mundo acaba amontoado no mesmo
   * canto da cerca e três quartos do curral ficam abertos.
   */
  /** Quantos trechos de muro cabem na volta da aldeia, no tamanho de hoje. */
  get murosQueCabem() { return Math.round(2 * Math.PI * this.raioDoMuro); }
  get raioDoMuro() { return Math.max(4, Math.min(13, this.raio * 0.55)); }

  /** Um lugar vago no anel do muro. Devolve null quando o anel está fechado. */
  sitioDeMuro(mundo, sorte) {
    const r = this.raioDoMuro;
    for (let k = 0; k < 22; k++) {
      const a = sorte() * Math.PI * 2;
      const x = Math.round(this.cx + Math.cos(a) * r);
      const y = Math.round(this.cy + Math.sin(a) * r);
      if (!mundo.andavel(x, y)) continue;
      if (this.muros.some((m) => Math.abs(m.x - x) < 1 && Math.abs(m.y - y) < 1)) continue;
      return { x, y };
    }
    return null;
  }

  /** Dentro do muro. Fera não passa — é o que a cerca de pau não dá. */
  atrasDoMuro(x, y) {
    if (this.muros.length < 8) return false;
    return Math.hypot(x - this.cx, y - this.cy) < this.raioDoMuro;
  }

  postoDe(h) {
    if (!this.cercas.length) return null;
    const turma = this.membros.filter((m) => m.viva && m.adulto && m.dom === 'guarda');
    const k = turma.indexOf(h);
    if (k < 0) return null;
    return this.cercas[Math.floor((k * this.cercas.length) / turma.length) % this.cercas.length];
  }

  recentrar() {
    if (!this.pop) return;
    let sx = 0, sy = 0;
    for (const m of this.membros) { sx += m.x; sy += m.y; }
    // o centro persegue a média em vez de saltar: território que pula de lugar
    // faz a fronteira piscar e a diplomacia disparar sem motivo
    this.cx += (sx / this.pop - this.cx) * 0.05;
    this.cy += (sy / this.pop - this.cy) * 0.05;
  }

  /** Reivindica os tiles ao alcance. Devolve quem ficou vizinho de quem. */
  reivindicar(mundo, donoAntes) {
    const r = Math.ceil(this.raio);
    const r2 = this.raio * this.raio;
    this.territorio.clear();
    const vizinhas = new Set();
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const x = Math.round(this.cx) + dx, y = Math.round(this.cy) + dy;
        if (!mundo.dentro(x, y)) continue;
        const i = mundo.idx(x, y);
        const atual = donoAntes[i];
        if (atual !== -1 && atual !== this.id) { vizinhas.add(atual); continue; }
        this.territorio.add(i);
        mundo.dono[i] = this.id;
      }
    }
    return vizinhas;
  }

  investirEmTecnologia(cronica) {
    const prox = this.tecnologia + 1;
    if (prox >= TECNOLOGIAS.length) return false;
    const custo = CUSTO_TEC[prox] * (this.comLider ? 0.78 : 1) * this.degrau.tecnologia;
    if (this.minerais < custo) return false;
    this.minerais -= custo;
    this.tecnologia = prox;
    cronica(`${this.nome} domina o ${TECNOLOGIAS[prox].toLowerCase()}`, this, 'tec');
    return true;
  }

  relacaoCom(outra) { return this.relacoes.get(outra.id) || 'neutro'; }

  /** Mãe, filha ou irmã. É o que o `encontro` consulta antes de brigar por terra. */
  ehParente(outra) {
    return this.mae === outra.id || outra.mae === this.id
        || (this.mae !== null && this.mae === outra.mae);
  }

  /** Da mesma nação, ou ela mesma. */
  daMesmaNacao(outra) { return this === outra || (!!this.nacao && this.nacao === outra.nacao); }

  /**
   * Gente e ofícios contam pela nação, não pela aldeia. É o que a federação
   * muda de concreto: uma aldeia de doze pessoas com um artesão que mora na
   * aldeia irmã pode subir de era — o feudo é um domínio de várias aldeias sob
   * um senhor, não uma aldeia enorme. Sem nação, a nação é ela mesma.
   */
  get popDaNacao() {
    if (!this.nacao) return this.pop;
    let n = 0;
    for (const t of this.nacao.tribos) if (t.viva) n += t.pop;
    return n;
  }
  temOficioNaNacao(dom) {
    if (this.temOficio(dom)) return true;
    if (!this.nacao) return false;
    for (const t of this.nacao.tribos) if (t.viva && t !== this && t.temOficio(dom)) return true;
    return false;
  }

  get aliadas() { return [...this.relacoes.values()].filter((r) => r === 'aliada').length; }

  definirRelacao(outra, estado) {
    this.relacoes.set(outra.id, estado);
    outra.relacoes.set(this.id, estado);
  }
}

/**
 * Encontro de fronteira. Três saídas, e a distância entre os centros importa
 * tanto quanto a despensa: território espremido é motivo de guerra mesmo entre
 * duas tribos que estão comendo.
 */
export function encontro(a, b, distancia, cronica, sorte) {
  const atual = a.relacaoCom(b);
  const espremidas = distancia < (a.raio + b.raio) * 0.85;

  if (atual === 'guerra') {
    if (!a.faminta && !b.faminta && !espremidas && sorte() < 0.03) {
      a.definirRelacao(b, 'neutro');
      cronica(`${a.nome} e ${b.nome} depõem as armas`, a, 'paz');
    }
    return;
  }

  // fome rompe aliança antes de virar guerra: aliado com fome deixa de dividir
  if (atual === 'aliada' && (a.faminta || b.faminta) && sorte() < 0.05) {
    a.definirRelacao(b, 'neutro');
    cronica(`${a.nome} e ${b.nome} rompem a aliança`, a, 'rompimento');
    return;
  }

  if (a.faminta || b.faminta) {
    // Saqueadora não espera a sorte virar: tribo com fome, gente de briga e um
    // vizinho de celeiro cheio ao lado ataca três vezes mais. É o outro caminho
    // para fora da fome, e é o que faz vizinhança rica virar problema.
    const faminta = a.faminta ? a : b;
    const outra = faminta === a ? b : a;
    const chance = faminta.saqueadora && outra.porHabitante > faminta.porHabitante * 1.8 ? 0.3 : 0.10;
    if (atual !== 'aliada' && sorte() < chance) {
      a.definirRelacao(b, 'guerra');
      if (faminta.saqueadora) {
        faminta.alvoDeSaque = outra.id;
        cronica(`${faminta.nome} parte para o saque de ${outra.nome}`, faminta, 'saque');
      } else {
        cronica(`${faminta.nome} ataca ${outra.nome} por comida`, faminta, 'guerra');
      }
    }
    return;
  }

  const diplomacia = (a.comLider ? 1.7 : 1) * (b.comLider ? 1.7 : 1);
  const parentes = a.ehParente(b);

  // Disputa de terra é coisa de estranho, quase sempre. A filha nasce a seis
  // tiles da mãe — sempre "espremida" — e sem isto ia à guerra na mesma taxa
  // que um vizinho qualquer: na semente 1234, 41 das 42 tribos tinham mãe e o
  // mundo inteiro era uma família que só sabia brigar. Parente ainda rompe por
  // fome (acima) e ainda pode guerrear depois de romper; só raramente começa
  // por aí.
  const rixa = parentes ? 0.2 : 1;   // briga em família existe, mas é a exceção
  // Vizinho farto também disputa terra — só que menos. A regra antiga isentava
  // o par farto de vez, e num mundo de quinhentas pessoas sem uma faminta a
  // guerra zerava nas cinco sementes: 174 pares espremidos, nenhum brigando.
  // Território é o que dois reinos prósperos querem ao mesmo tempo.
  const fartura = a.farta && b.farta ? 0.3 : 1;
  if (atual === 'neutro' && espremidas && sorte() < 0.035 * rixa * fartura / diplomacia) {
    a.definirRelacao(b, 'guerra');
    cronica(`${a.nome} e ${b.nome} disputam a mesma terra`, a, 'guerra');
    return;
  }

  // Parente neutro faz as pazes mais fácil do que estranho sela aliança, e não
  // precisa estar farto: sangue é o que sobra quando a comida falta.
  if (atual === 'neutro' && parentes && a.aliadas < 4 && b.aliadas < 4 && sorte() < 0.06 * diplomacia) {
    a.definirRelacao(b, 'aliada');
    cronica(`${a.nome} e ${b.nome} se reconciliam`, a, 'alianca');
    return;
  }

  if (atual === 'neutro' && a.farta && b.farta && a.aliadas < 3 && b.aliadas < 3 && sorte() < 0.02 * diplomacia) {
    a.definirRelacao(b, 'aliada');
    cronica(`${a.nome} e ${b.nome} selam aliança`, a, 'alianca');
  }
}

/**
 * Tecnologia se difunde entre aliadas — e dentro da nação, quase de graça. É
 * o que faz aliança valer alguma coisa além de comida: sem isto cada aldeia
 * tinha que pagar 380 de minério pelo ferro sozinha, e a filha que nascia sem
 * mina ficava na pedra para sempre ao lado da mãe no ferro.
 */
export function difundirTecnologia(a, b, cronica, sorte) {
  if (a.tecnologia === b.tecnologia) return;
  const [sabe, aprende] = a.tecnologia > b.tecnologia ? [a, b] : [b, a];
  const chance = a.daMesmaNacao(b) ? 0.12 : 0.03;
  if (sorte() > chance) return;
  aprende.tecnologia++;
  cronica(`${aprende.nome} aprende o ${TECNOLOGIAS[aprende.tecnologia].toLowerCase()} com ${sabe.nome}`, aprende, 'tec');
}

/**
 * A nação: mãe e filhas que ficaram aliadas viram uma coisa só de nome, de
 * cor e de conta. Não é fusão — cada aldeia segue com o seu celeiro e as suas
 * obras — é o degrau entre "tribo" e "cidade", e é o que deixa uma população
 * espalhada em cinco aldeias chegar ao feudo em vez de cinco bandos.
 */
/** Aldeias por nação. Sem teto a nação engolia o mundo: toda tribo é filha de
 *  alguém, a federação virava um celeiro único de mil pares de aliança, e a
 *  guerra zerava nas cinco sementes — o que o `comerciar` já tinha avisado.
 *  Cinco aldeias é um reino pequeno; a sexta filha funda o dela. */
export const TAMANHO_NACAO = 5;

export class Nacao {
  constructor(sede) {
    this.id = sede.id;
    this.nome = sede.nome;
    this.cor = sede.cor;
    this.sede = sede;
    this.tribos = new Set([sede]);
    sede.nacao = this;
  }
  get pop() { let n = 0; for (const t of this.tribos) if (t.viva) n += t.pop; return n; }
  get vivas() { return [...this.tribos].filter((t) => t.viva); }
  get cheia() { return this.vivas.length >= TAMANHO_NACAO; }
  admitir(t) {
    this.tribos.add(t);
    t.nacao = this;
    t.cor = this.cor;        // no mapa, a nação é uma cor só
    for (const o of this.tribos) if (o !== t && o.viva) t.definirRelacao(o, 'aliada');
  }
  expulsar(t) {
    this.tribos.delete(t);
    t.nacao = null;
    t.cor = t.corPropria;
  }
}

/**
 * Aliadas dividem excedente, mas em conta-gotas e só de quem sobra para quem
 * falta. Igualar as despensas transformava a rede de aliados num celeiro único
 * e mundial — ninguém passava fome, e sem fome nunca havia guerra.
 */
export function comerciar(a, b) {
  const rico = a.porHabitante >= b.porHabitante ? a : b;
  const pobre = rico === a ? b : a;
  if (rico.porHabitante < LIMIAR_FARTURA) return;
  const doacao = Math.min(0.6, rico.celeiro - LIMIAR_FARTURA * rico.pop);
  if (doacao <= 0) return;
  rico.celeiro -= doacao;
  pobre.celeiro += doacao;
}

export function encontrarSitioDeOca(mundo, tribo, sorte) {
  for (let tentativa = 0; tentativa < 24; tentativa++) {
    const a = sorte() * Math.PI * 2;
    const d = sorte() * tribo.raio * 0.55;
    const x = Math.round(tribo.cx + Math.cos(a) * d);
    const y = Math.round(tribo.cy + Math.sin(a) * d);
    if (!mundo.andavel(x, y)) continue;
    const i = mundo.idx(x, y);
    if (mundo.terreno[i] === T.PLANTACAO || mundo.terreno[i] === T.AGUA) continue;
    if (tribo.ocas.some((o) => Math.abs(o.x - x) < 2 && Math.abs(o.y - y) < 2)) continue;
    return { x, y };
  }
  return null;
}

export function reiniciarIds() { proximoId = 0; }
/** Depois de abrir um mundo salvo, o contador tem que continuar de onde parou —
 *  senão a próxima tribo nasce com o id de uma que já existe. */
export function retomarIds(n) { proximoId = Math.max(proximoId, n); }
Tribo.retomarIds = retomarIds;

// ---------------------------------------------------------------- vocações
/**
 * O que cada pessoa faz melhor. Multiplicadores por obra; o que não estiver na
 * tabela vale 1. É o que faz duas tribos com a mesma terra evoluírem diferente:
 * um bando cheio de caçador esgota o rebanho, um cheio de lavrador atravessa a
 * seca com o celeiro cheio.
 */
export const VOCACOES = {
  lavrador:   { nome: 'Lavrador',   cor: 0x9ad06a, arar: 1.6, colher: 1.5, pastorear: 1.15, cacar: 0.8, minerar: 0.8 },
  cacador:    { nome: 'Caçador',    cor: 0xd08a4a, cacar: 1.8, forragear: 1.35, lutar: 1.3, enfrentar: 1.3, arar: 0.8, minerar: 0.85 },
  construtor: { nome: 'Construtor', cor: 0xd9cb72, construir: 1.9, cercar: 1.7, minerar: 1.15, cacar: 0.85 },
  minerador:  { nome: 'Minerador',  cor: 0x9aa8c0, minerar: 2.0, cercar: 0.9, arar: 0.85, cacar: 0.85 },
  lider:      { nome: 'Líder',      cor: 0xe0b344, arar: 0.8, colher: 0.85, minerar: 0.8, cacar: 0.8, lutar: 1.15 },
  guarda:     { nome: 'Guarda',     cor: 0xb8574a, lutar: 1.9, enfrentar: 1.9, cercar: 1.2, arar: 0.7, colher: 0.8, minerar: 0.7 },
  pastor:     { nome: 'Pastor',     cor: 0x8fb0a0, arrebanhar: 1.9, pastorear: 1.8, recolher: 1.5, cacar: 0.7, minerar: 0.7, lutar: 0.85 },
  pescador:   { nome: 'Pescador',   cor: 0x5f97b0, pescar: 2.1, forragear: 1.15, arar: 0.8, minerar: 0.7, lutar: 0.85 },
  artesao:    { nome: 'Artesão',    cor: 0xc08a5a, construir: 1.5, cavarPoco: 1.9, erguerMuro: 2.0, cercar: 1.4, minerar: 1.2, cacar: 0.7 },
};

export const CHAVES_VOCACAO = Object.keys(VOCACOES);

/** Mistura que uma tribo tende a buscar. A soma não precisa dar 1. */
const MISTURA_ALVO = { lavrador: 0.34, cacador: 0.19, construtor: 0.16, minerador: 0.15, lider: 0.06 };

/**
 * Quanto guarda a tribo quer. Guarda não produz comida: uma tribo em paz e sem
 * rebanho para vigiar que criasse guarda estaria só sustentando gente ociosa —
 * e é por isso que a proporção depende da situação, não é fixa. Guarda aparece
 * quando há cerca para rondar ou guerra na fronteira, que é como o jogador vê
 * a tribo amadurecer: primeiro o curral, depois quem toma conta dele.
 */
function fatiaDeGuarda(tribo) {
  const emGuerra = [...tribo.relacoes.values()].includes('guerra');
  // O que a tribo sofreu entra na conta: cada lembrança de fera ou de ataque
  // vale mais um por cento de guarda, até dobrar a fatia. É a forma mais direta
  // de "aprender": quem apanhou treina mais gente para não apanhar de novo.
  const licao = Math.min(0.12, tribo.ameacada * 0.012);
  if (tribo.curral && emGuerra) return 0.16 + licao;
  if (tribo.curral || emGuerra) return 0.10 + licao;
  return 0.01 + licao;
}

/** Pastor só faz sentido com cerca de pé: é quem vai buscar bicho solto e quem
 *  tira mais do rebanho. Sem curral é uma boca a mais no forrageio. */
function fatiaDePastor(tribo) {
  return tribo.curral ? 0.13 : 0.01;
}

/** Pescador só onde há margem. Numa tribo de sertão é uma boca a mais. */
function fatiaDePescador(tribo) {
  return tribo.temCosta ? 0.14 : 0.01;
}

/** Artesão é ofício de era: quem levanta poço e muro. Antes da Aldeia não há
 *  obra de pedra para ele fazer, e ele vira uma boca a mais na roça. */
function fatiaDeArtesao(tribo) {
  return tribo.era >= 1 ? 0.12 : 0.01;
}

export function rende(h, obra) {
  const v = VOCACOES[h.dom];
  return (v && v[obra]) || 1;
}

/**
 * Vocação de quem nasce: puxa dos pais, senão preenche a lacuna da tribo.
 * Herdar sempre engessa a tribo numa vocação só; sortear sempre apaga a
 * identidade que o jogador vê se formando.
 */
export function sortearVocacao(sorte, tribo, pai, mae) {
  if (pai && sorte() < 0.32) return pai.dom;
  if (mae && sorte() < 0.32) return mae.dom;
  if (!tribo || !tribo.pop) return CHAVES_VOCACAO[(sorte() * CHAVES_VOCACAO.length) | 0];

  const tem = {};
  for (const k of CHAVES_VOCACAO) tem[k] = 0;
  for (const m of tribo.membros) if (m.dom) tem[m.dom]++;

  const alvo = { ...MISTURA_ALVO, guarda: fatiaDeGuarda(tribo), pastor: fatiaDePastor(tribo),
                 pescador: fatiaDePescador(tribo), artesao: fatiaDeArtesao(tribo) };
  let faltaMais = null, maiorFalta = -Infinity;
  for (const k of CHAVES_VOCACAO) {
    const falta = alvo[k] * tribo.pop - tem[k];
    if (falta > maiorFalta) { maiorFalta = falta; faltaMais = k; }
  }
  // um pouco de acaso, senão toda tribo converge para a mesma composição
  return sorte() < 0.75 ? faltaMais : CHAVES_VOCACAO[(sorte() * CHAVES_VOCACAO.length) | 0];
}

/** Tribo com líder negocia melhor, aprende mais rápido e demora mais a rachar. */
export function temLider(tribo) {
  return tribo.membros.some((m) => m.dom === 'lider' && m.adulto);
}
