// Tribos: quem pertence a quem, até onde vai o território, e o que acontece
// quando dois territórios se encostam.
//
// Toda a diplomacia sai de uma variável só: comida por habitante. Tribo farta
// que encosta em tribo farta faz aliança; se qualquer uma das duas está com
// fome, vira guerra. É pouca regra de propósito — é o que deixa o resultado
// depender do mundo que o jogador montou, e não de uma tabela minha.

import { N, T } from './mundo.js';

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
    this.rebanhosProximos = 0;     // selvagens pastando no território
    this.plantios = 0;             // roças de pé dentro do território
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
  /** Força em combate: gente vezes o que ela tem na mão. */
  get forca() { return this.pop * (1 + this.tecnologia * 0.55); }

  /** Raio do território, em tiles. Cresce devagar com a população. */
  get raio() { return Math.min(16, 3.2 + Math.sqrt(this.pop) * 2.0); }

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
    if (this.minerais < CUSTO_TEC[prox]) return false;
    this.minerais -= CUSTO_TEC[prox];
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

  if (atual === 'neutro' && espremidas && !(a.farta && b.farta) && sorte() < 0.035) {
    a.definirRelacao(b, 'guerra');
    cronica(`${a.nome} e ${b.nome} disputam a mesma terra`, a, 'guerra');
    return;
  }

  if (atual === 'neutro' && a.farta && b.farta && a.aliadas < 3 && b.aliadas < 3 && sorte() < 0.02) {
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
