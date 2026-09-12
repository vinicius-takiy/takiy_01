// Interface: paleta, painel de estado, crônica e inspetor.
//
// A crônica não é enfeite. Ninguém vê um humano decidir plantar; o que se vê é
// "Tribo Ocre começa a plantar". Sem esse texto, a emergência acontece e passa
// despercebida, e o jogo vira um protetor de tela.

import { T, TERRENOS } from './mundo.js';
import { TECNOLOGIAS, VOCACOES, CHAVES_VOCACAO } from './tribos.js';

const el = (id) => document.getElementById(id);

/** A caixa de peças. `ser` e `terreno` são os dois tipos de pincel de verdade. */
export const PINCEIS = [
  { id: 'humano',   nome: 'Humano',  tipo: 'ser', ser: 'humano', quantos: 3, cor: 0xf2eddb },
  { id: 'rebanho',  nome: 'Rebanho', tipo: 'ser', ser: 'rebanho', quantos: 4, cor: 0xc9b48c },
  { id: 'fera',     nome: 'Fera',    tipo: 'ser', ser: 'predador', quantos: 1, cor: 0x8c3a2a },
  { divisor: true },
  { id: 'fertil',   nome: 'Terra fértil', tipo: 'terreno', terreno: T.FERTIL },
  { id: 'campo',    nome: 'Campo',        tipo: 'terreno', terreno: T.GRAMA },
  { id: 'floresta', nome: 'Floresta',     tipo: 'terreno', terreno: T.FLORESTA },
  { id: 'agua',     nome: 'Água',         tipo: 'terreno', terreno: T.AGUA },
  { id: 'areia',    nome: 'Areia',        tipo: 'terreno', terreno: T.AREIA },
  { id: 'rocha',    nome: 'Rocha',        tipo: 'terreno', terreno: T.ROCHA },
  { id: 'montanha', nome: 'Montanha',     tipo: 'terreno', terreno: T.MONTANHA },
  { divisor: true },
  { id: 'apagar',   nome: 'Remover', tipo: 'apagar', cor: 0x6b6b66 },
];

export class Interface {
  constructor({ aoTrocarVelocidade, aoEnquadrar, aoRecomecar, aoComecar, aoSeguir }) {
    this.aoSeguir = aoSeguir;
    this.seguindo = null;
    this.fixado = null;
    this.pincel = null;
    this.raio = 3;
    this.ultimaCronica = 0;
    this.selecionado = null;

    const grupos = el('grupos');
    for (const p of PINCEIS) {
      if (p.divisor) {
        const d = document.createElement('div');
        d.className = 'divisor';
        grupos.appendChild(d);
        continue;
      }
      const b = document.createElement('button');
      b.className = 'pincel';
      b.dataset.id = p.id;
      const cor = p.tipo === 'terreno' ? TERRENOS[p.terreno].cor : p.cor;
      b.innerHTML = `<span class="amostra" style="background:#${cor.toString(16).padStart(6, '0')}"></span>`
                  + `<span class="rot">${p.nome}</span>`;
      b.onclick = () => this.escolher(p.id);
      grupos.appendChild(b);
    }

    el('raio').oninput = (e) => {
      this.raio = Number(e.target.value);
      el('raioOut').textContent = String(this.raio);
    };
    for (const b of document.querySelectorAll('#tempo button')) {
      b.onclick = () => {
        for (const o of document.querySelectorAll('#tempo button')) o.classList.toggle('on', o === b);
        aoTrocarVelocidade(Number(b.dataset.vel));
      };
    }
    el('enquadrar').onclick = aoEnquadrar;
    el('recomecar').onclick = aoRecomecar;
    el('dobrar').onclick = () => {
      const c = el('cronica');
      c.classList.toggle('fechada');
      el('dobrar').textContent = c.classList.contains('fechada') ? '+' : '—';
    };
    el('comecar').onclick = () => { el('abertura').hidden = true; aoComecar(); };
    this.escolher('humano');
  }

  escolher(id) {
    this.pincel = this.pincel?.id === id ? null : PINCEIS.find((p) => p.id === id) || null;
    for (const b of document.querySelectorAll('.pincel')) {
      b.classList.toggle('on', this.pincel && b.dataset.id === this.pincel.id);
    }
  }

  /**
   * Fita de tribos. É o atalho para o que o jogador quer de verdade num jogo
   * assim: escolher uma e acompanhar de perto em vez de olhar o mapa inteiro.
   */
  atualizarFita(sim) {
    const fita = el('fita');
    const vivas = sim.tribos.filter((t) => t.viva && t.pop).slice(0, 14);
    // Só refaz a lista quando o CONJUNTO de tribos muda. Refazer a cada mudança
    // de população fazia o chip escapar debaixo do dedo a cada quadro.
    const chave = vivas.map((t) => t.id).join(',');
    if (chave !== this._chaveFita) {
      this._chaveFita = chave;
      fita.innerHTML = '';
      this._chips = new Map();
      for (const t of vivas) {
        const b = document.createElement('button');
        b.innerHTML = `<b style="background:#${t.cor.toString(16).padStart(6, '0')}"></b><span></span><i></i>`;
        b.querySelector('span').textContent = t.nome;
        b.onclick = () => {
          const mesmo = this.seguindo === t.id;
          this.seguindo = mesmo ? null : t.id;
          this.fixado = this.seguindo;
          if (mesmo) this.limparInspetor();
          this.aoSeguir(mesmo ? null : t);
          this.pintarChips();
        };
        fita.appendChild(b);
        this._chips.set(t.id, b);
      }
    }
    for (const t of vivas) {
      const b = this._chips.get(t.id);
      if (!b) continue;
      b.querySelector('i').textContent = String(t.pop);
      b.classList.toggle('guerra', [...t.relacoes.values()].includes('guerra'));
    }
    this.pintarChips();

    // o painel fixado se atualiza sozinho enquanto a tribo é seguida
    if (this.fixado !== null) {
      const t = sim.tribo(this.fixado);
      if (t && t.viva && t.pop) this.mostrarTribo(sim, t);
      else { this.fixado = null; this.seguindo = null; this.limparInspetor(); }
    }
  }

  pintarChips() {
    if (!this._chips) return;
    for (const [id, b] of this._chips) b.classList.toggle('on', this.seguindo === id);
  }

  atualizarEstado(sim) {
    const r = sim.resumo();
    el('vAno').textContent = String(r.ano);
    el('vPop').textContent = String(r.humanos);
    el('vTribos').textContent = String(r.tribos);
    el('vBichos').textContent = `${r.rebanhos}/${r.predadores}`;
    el('vTec').textContent = r.tribos ? r.tecnologiaMaxima : '—';
  }

  /** Só acrescenta o que é novo: redesenhar a lista inteira faz a rolagem pular. */
  atualizarCronica(sim) {
    const total = sim.cronicas.length;
    if (total === this.ultimaCronica) return;
    const caixa = el('linhas');
    const novas = sim.cronicas.slice(Math.max(0, this.ultimaCronica - Math.max(0, total - sim.cronicas.length)));
    for (const c of novas.slice(-12)) {
      const p = document.createElement('p');
      p.innerHTML = `<b style="background:#${c.cor.toString(16).padStart(6, '0')}"></b>`
                  + `<i>${c.ano}</i><em></em>`;
      p.querySelector('em').textContent = c.texto;
      caixa.appendChild(p);
    }
    while (caixa.children.length > 80) caixa.removeChild(caixa.firstChild);
    caixa.scrollTop = caixa.scrollHeight;
    this.ultimaCronica = total;
  }

  /** Painel do que o jogador tocou: a tribo dali, ou o terreno. */
  inspecionar(sim, x, y) {
    const cx = Math.round(x), cy = Math.round(y);
    const caixa = el('inspetor');
    if (!sim.mundo.dentro(cx, cy)) { caixa.classList.remove('on'); return; }
    const i = sim.mundo.idx(cx, cy);
    const dono = sim.mundo.dono[i];
    const t = dono !== -1 ? sim.tribo(dono) : null;
    const titulo = caixa.querySelector('h3');
    const dl = caixa.querySelector('dl');

    if (t) {
      this.mostrarTribo(sim, t);
      this.fixado = t.id;
      return;
    }
    {
      titulo.querySelector('b').style.background = '#' + TERRENOS[sim.mundo.terreno[i]].cor.toString(16).padStart(6, '0');
      titulo.querySelector('span').textContent = TERRENOS[sim.mundo.terreno[i]].nome;
      dl.innerHTML = linhas([
        ['Forragem', sim.mundo.comida[i].toFixed(2)],
        ['Minério', sim.mundo.minerio[i] || '—'],
        ['Vigor do solo', sim.mundo.base[i] === T.FERTIL ? `${(sim.mundo.vigor[i] * 100).toFixed(0)}%` : '—'],
        ['Dono', 'terra de ninguém'],
      ]);
    }
    caixa.classList.add('on');
  }

  mostrarTribo(sim, t) {
    const caixa = el('inspetor');
    const titulo = caixa.querySelector('h3');
    const dl = caixa.querySelector('dl');
    titulo.querySelector('b').style.background = '#' + t.cor.toString(16).padStart(6, '0');
    titulo.querySelector('span').textContent = `Tribo ${t.nome}`;
    const rel = [...t.relacoes.entries()].filter(([, r]) => r !== 'neutro');
    const conta = {};
    for (const k of CHAVES_VOCACAO) conta[k] = 0;
    for (const m of t.membros) if (m.viva) conta[m.dom] = (conta[m.dom] || 0) + 1;
    const gente = CHAVES_VOCACAO.filter((k) => conta[k])
      .map((k) => `${conta[k]} ${VOCACOES[k].nome.toLowerCase()}${conta[k] > 1 ? 'es' : ''}`)
      .join(', ').replace(/lavradores/g, 'lavradores').replace(/lideres/g, 'líderes');
    dl.innerHTML = linhas([
      ['Pessoas', t.pop],
      ['Gente', gente || '—'],
      ['Celeiro', `${t.celeiro.toFixed(0)} (${t.porHabitante.toFixed(1)} por cabeça)`],
      ['Técnica', TECNOLOGIAS[t.tecnologia] + (t.comLider ? ' · com líder' : '')],
      ['Roças', t.plantios],
      ['Gado', t.cabecas],
      ['Ocas', t.ocas.length],
      ['Situação', t.faminta ? 'passando fome' : t.farta ? 'com fartura' : 'em pé'],
      ['Vizinhas', rel.length ? rel.map(([id, r]) => `${sim.tribo(id)?.nome || '?'} (${r})`).join(', ') : 'nenhuma'],
    ]);
    caixa.classList.add('on');
  }

  limparInspetor() { el('inspetor').classList.remove('on'); this.fixado = null; }
}

const linhas = (pares) => pares.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
