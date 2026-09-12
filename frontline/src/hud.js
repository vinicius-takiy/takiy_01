// HUD em DOM, não em canvas: texto nítido em qualquer densidade de tela, custo
// zero de desenho por quadro e a área segura do iPhone resolvida por CSS.

import { cfg, salvar, aplicarEsquema, ESQUEMAS, ASSIST, esquemaAtual } from './settings.js';

const el = (id) => document.getElementById(id);

export class Hud {
  constructor({ aoIniciar, aoFecharCfg }) {
    this.vidaFill = el('vidaFill');
    this.vidaCaixa = el('vida');
    this.balas = el('balas');
    this.recarregando = el('recarregando');
    this.objTxt = el('objTxt');
    this.objSub = el('objSub');
    this.mira = el('mira');
    this.marca = el('marca');
    this.dano = el('dano');
    this.hud = el('hud');
    this.aoIniciar = aoIniciar;
    this.aoFecharCfg = aoFecharCfg;
    this._ultimaVida = 100;

    this.montarConfig();
    el('jogar').onclick = () => { this.telas('jogo'); aoIniciar(); };
    el('denovo').onclick = () => { this.telas('jogo'); aoIniciar(); };
    el('menuCfg').onclick = () => this.telas('cfg', 'menu');
    el('fimCfg').onclick = () => this.telas('cfg', 'fim');
    el('cfgAbrir').onclick = () => this.telas('cfg', 'jogo');
    el('cfgFechar').onclick = () => {
      this.telas(this.voltarPara || 'menu');
      if (this.voltarPara === 'jogo') aoFecharCfg();
    };
  }

  /** @param {'menu'|'jogo'|'fim'|'cfg'} qual */
  telas(qual, voltarPara) {
    if (qual === 'cfg') this.voltarPara = voltarPara;
    for (const [id, visivel] of [['menu', qual === 'menu'], ['fim', qual === 'fim'], ['cfg', qual === 'cfg']]) {
      el(id).hidden = !visivel;
    }
    this.hud.classList.toggle('on', qual === 'jogo');
    for (const id of ['olhar', 'stick', 'atirar', 'mirar', 'recarregar', 'agachar', 'cfgAbrir']) {
      el(id).style.visibility = qual === 'jogo' ? 'visible' : 'hidden';
    }
    if (qual === 'jogo') el('stick').style.visibility = esquemaAtual().mover === 'stick' ? 'visible' : 'hidden';
    this.emJogo = qual === 'jogo';
  }

  montarConfig() {
    const caixa = el('esquemas');
    caixa.innerHTML = '';
    for (const e of ESQUEMAS) {
      const l = document.createElement('label');
      l.className = 'opt';
      l.innerHTML = `<input type="radio" name="esq" value="${e.id}"><span><b>${e.nome}</b><span>${e.desc}</span></span>`;
      caixa.appendChild(l);
      l.querySelector('input').onchange = () => {
        aplicarEsquema(e.id);
        this.sincronizarConfig();
        this.aoMudarEsquema?.();
      };
    }
    const liga = (id, prop, aoMudar) => {
      const c = el(id);
      c.onchange = () => { cfg[prop] = c.type === 'checkbox' ? c.checked : parseFloat(c.value); salvar(); this.sincronizarConfig(); aoMudar?.(); };
      c.oninput = c.onchange;
    };
    liga('sens', 'sensibilidade');
    liga('assist', 'assist');
    liga('autofogo', 'autofogo');
    liga('invY', 'invY');
    liga('canhoto', 'canhoto', () => this.aoMudarEsquema?.());
    liga('som', 'som');
    this.sincronizarConfig();
  }

  sincronizarConfig() {
    const r = document.querySelector(`input[name=esq][value="${cfg.esquema}"]`);
    if (r) r.checked = true;
    el('sens').value = String(cfg.sensibilidade);
    el('sensOut').textContent = cfg.sensibilidade.toFixed(1) + '×';
    el('assist').value = String(cfg.assist);
    el('assistOut').textContent = ASSIST[cfg.assist | 0].rotulo;
    el('autofogo').checked = cfg.autofogo;
    el('invY').checked = cfg.invY;
    el('canhoto').checked = cfg.canhoto;
    el('som').checked = cfg.som;
  }

  atualizar({ vida, vidaMax, pente, reserva, recarregando, objetivo, restantes, alvoNaMira }) {
    const f = Math.max(0, vida / vidaMax);
    this.vidaFill.style.width = (f * 100).toFixed(1) + '%';
    this.vidaCaixa.classList.toggle('ferido', f < 0.4);
    this.dano.style.opacity = String(Math.max(0, 1 - f * 1.6) * 0.95);
    if (vida < this._ultimaVida - 0.5) this.piscarDano();
    this._ultimaVida = vida;

    this.balas.innerHTML = `${pente}<small>/${reserva}</small>`;
    this.recarregando.textContent = recarregando ? 'Recarregando' : (pente === 0 ? 'Sem munição' : '');
    this.objTxt.textContent = objetivo;
    this.objSub.textContent = restantes > 0 ? `${restantes} inimigo${restantes > 1 ? 's' : ''} no setor` : 'setor limpo';
    this.mira.classList.toggle('alvo', !!alvoNaMira);
  }

  piscarDano() {
    this.dano.style.transition = 'none';
    this.dano.style.opacity = '1';
    requestAnimationFrame(() => {
      this.dano.style.transition = 'opacity .35s';
      this.dano.style.opacity = String(Math.max(0, 1 - this._ultimaVida / 100 * 1.6) * 0.95);
    });
  }

  marcarAcerto(letal) {
    this.marca.classList.remove('hit');
    this.marca.classList.toggle('morte', letal);
    void this.marca.offsetWidth;  // reinicia a animação
    this.marca.classList.add('hit');
  }

  fim({ vitoria, stats }) {
    el('fimTitulo').textContent = vitoria ? 'Setor tomado' : 'Você caiu';
    el('fimTexto').textContent = vitoria
      ? 'Agora o que interessa: deu vontade de jogar de novo, ou você lutou mais contra o controle do que contra o inimigo?'
      : 'Foi o inimigo ou foi o polegar? Troque o esquema e repita o mesmo setor.';
    el('fimStats').innerHTML = stats.map(([k, v]) => `<div><span style="opacity:.6">${k}</span> — <b>${v}</b></div>`).join('');
    this.telas('fim');
  }
}
