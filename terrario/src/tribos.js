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
const CUSTO_TEC = [0, 40, 140, 380];

/** Comida por habitante abaixo disto é fome declarada. */
export const LIMIAR_FOME = 1.6;
/** Acima disto a tribo tem excedente e pensa em outra coisa além de comer. */
export const LIMIAR_FARTURA = 4.2;

const BANDO_SEM_TETO = 6;
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
    this.curral = null;            // {x, y, raio} — o pasto cercado
    this.cercas = [];              // tiles de mourão, na volta do curral
    this.rebanhosProximos = 0;     // selvagens pastando no território
    this.plantios = 0;             // roças de pé dentro do território
    this.madeira = 0;              // lenha estocada, para levantar abrigo
    this.comLider = false;         // tem alguém com dom de liderança
    this.ocas = [];                // {x, y}
    this.viva = true;
    this.nascimentos = 0;
    this.mortes = 0;
    this.idade = 0;
  }

  get pop() { return this.membros.length; }
  get porHabitante() { return this.pop ? this.celeiro / this.pop : 0; }
  get faminta() { return this.porHabitante < LIMIAR_FOME; }
  get farta() { return this.porHabitante > LIMIAR_FARTURA; }
  /** Força em combate: gente vezes o que ela tem na mão, mais quem treina para
   *  isso. O guarda pesa quase como uma pessoa a mais — é o que faz valer a
   *  pena sustentar gente que não produz comida. */
  get forca() { return this.pop * (1 + this.tecnologia * 0.55) + this.guardas * 0.9; }

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
  get raio() { return Math.min(16, 3.2 + Math.sqrt(this.pop) * 2.0); }

  /** Cada oca acolhe duas pessoas. */
  get abrigo() { return this.ocas.length * 2; }

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

  dentroDoCurral(x, y) {
    const c = this.curral;
    return !!c && Math.hypot(x - c.x, y - c.y) <= c.raio;
  }

  /**
   * Posto de vigia deste guarda. A divisão é por ordem estável na lista de
   * guardas, não por sorteio: sorteado, todo mundo acaba amontoado no mesmo
   * canto da cerca e três quartos do curral ficam abertos.
   */
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
    const custo = CUSTO_TEC[prox] * (this.comLider ? 0.78 : 1);
    if (this.minerais < custo) return false;
    this.minerais -= custo;
    this.tecnologia = prox;
    cronica(`${this.nome} domina o ${TECNOLOGIAS[prox].toLowerCase()}`, this, 'tec');
    return true;
  }

  relacaoCom(outra) { return this.relacoes.get(outra.id) || 'neutro'; }

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
    if (atual !== 'aliada' && sorte() < 0.10) {
      a.definirRelacao(b, 'guerra');
      const quem = a.faminta ? a : b;
      cronica(`${quem.nome} ataca ${quem === a ? b.nome : a.nome} por comida`, quem, 'guerra');
    }
    return;
  }

  const diplomacia = (a.comLider ? 1.7 : 1) * (b.comLider ? 1.7 : 1);
  if (atual === 'neutro' && espremidas && !(a.farta && b.farta) && sorte() < 0.035 / diplomacia) {
    a.definirRelacao(b, 'guerra');
    cronica(`${a.nome} e ${b.nome} disputam a mesma terra`, a, 'guerra');
    return;
  }

  if (atual === 'neutro' && a.farta && b.farta && a.aliadas < 3 && b.aliadas < 3 && sorte() < 0.02 * diplomacia) {
    a.definirRelacao(b, 'aliada');
    cronica(`${a.nome} e ${b.nome} selam aliança`, a, 'alianca');
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

// ---------------------------------------------------------------- vocações
/**
 * O que cada pessoa faz melhor. Multiplicadores por obra; o que não estiver na
 * tabela vale 1. É o que faz duas tribos com a mesma terra evoluírem diferente:
 * um bando cheio de caçador esgota o rebanho, um cheio de lavrador atravessa a
 * seca com o celeiro cheio.
 */
export const VOCACOES = {
  lavrador:   { nome: 'Lavrador',   cor: 0x9ad06a, arar: 1.6, colher: 1.5, pastorear: 1.15, cacar: 0.8, minerar: 0.8 },
  cacador:    { nome: 'Caçador',    cor: 0xd08a4a, cacar: 1.8, forragear: 1.35, lutar: 1.3, arar: 0.8, minerar: 0.85 },
  construtor: { nome: 'Construtor', cor: 0xd9cb72, construir: 1.9, cercar: 1.7, minerar: 1.15, cacar: 0.85 },
  minerador:  { nome: 'Minerador',  cor: 0x9aa8c0, minerar: 2.0, cercar: 0.9, arar: 0.85, cacar: 0.85 },
  lider:      { nome: 'Líder',      cor: 0xe0b344, arar: 0.8, colher: 0.85, minerar: 0.8, cacar: 0.8, lutar: 1.15 },
  guarda:     { nome: 'Guarda',     cor: 0xb8574a, lutar: 1.9, enfrentar: 1.9, cercar: 1.2, arar: 0.7, colher: 0.8, minerar: 0.7 },
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
  if (tribo.curral && emGuerra) return 0.16;
  if (tribo.curral || emGuerra) return 0.10;
  return 0.01;
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

  const alvo = { ...MISTURA_ALVO, guarda: fatiaDeGuarda(tribo) };
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
