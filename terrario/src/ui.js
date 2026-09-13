// Interface: paleta, painel de estado, crônica e inspetor.
//
// A crônica não é enfeite. Ninguém vê um humano decidir plantar; o que se vê é
// "Tribo Ocre começa a plantar". Sem esse texto, a emergência acontece e passa
// despercebida, e o jogo vira um protetor de tela.

import { T, TERRENOS } from './mundo.js';
import { indice, abrir, apagar, guardar } from './registro.js';
import { TECNOLOGIAS, VOCACOES, CHAVES_VOCACAO, ERAS } from './tribos.js';

const el = (id) => document.getElementById(id);

// Quanto tempo o botão de descartar fica armado. Dez segundos, não cinco: quem
// toca em "Mundo pelado" por engano lê o aviso, pensa e só então decide, e com
// cinco a janela fechava no meio da leitura — o segundo toque rearmava em vez
// de agir, que é pior do que não perguntar.
const JANELA_DESCARTE = 10000;

/** A caixa de peças. `ser` e `terreno` são os dois tipos de pincel de verdade. */
export const PINCEIS = [
  { id: 'humano',   nome: 'Humano',  tipo: 'ser', ser: 'humano', quantos: 3, cor: 0xf2eddb },
  { id: 'rebanho',  nome: 'Rebanho', tipo: 'ser', ser: 'rebanho', quantos: 4, cor: 0xc9b48c },
  { id: 'fera',     nome: 'Fera',    tipo: 'ser', ser: 'predador', quantos: 1, cor: 0x9a4436 },
  // Aquáticos só caem em tile de água — `aquatico` é o que a simulação lê para
  // não deixar peixe encalhado no campo.
  { id: 'peixe',    nome: 'Peixe',   tipo: 'ser', ser: 'peixe', quantos: 6, cor: 0x7fb6c4, aquatico: true },
  { id: 'jacare',   nome: 'Jacaré',  tipo: 'ser', ser: 'jacare', quantos: 1, cor: 0x4f6b45, aquatico: true },
  { id: 'capivara', nome: 'Capivara',tipo: 'ser', ser: 'capivara', quantos: 4, cor: 0x9c7648 },
  { id: 'lebre',    nome: 'Lebre',   tipo: 'ser', ser: 'lebre', quantos: 5, cor: 0xc9b48c },
  { divisor: true },
  { id: 'fertil',   nome: 'Terra fértil', tipo: 'terreno', terreno: T.FERTIL },
  { id: 'campo',    nome: 'Campo',        tipo: 'terreno', terreno: T.GRAMA },
  { id: 'terra',    nome: 'Terra nua',    tipo: 'terreno', terreno: T.TERRA },
  // Semente, não floresta pronta: o broto vira mata se a umidade deixar, e
  // morre de sede se não deixar. Plantar num descampado seco não dá nada.
  { id: 'semente',  nome: 'Semente',      tipo: 'terreno', terreno: T.BROTO },
  { id: 'agua',     nome: 'Água',         tipo: 'terreno', terreno: T.AGUA },
  { id: 'areia',    nome: 'Areia',        tipo: 'terreno', terreno: T.AREIA },
  { id: 'rocha',    nome: 'Rocha',        tipo: 'terreno', terreno: T.ROCHA },
  { id: 'montanha', nome: 'Montanha',     tipo: 'terreno', terreno: T.MONTANHA },
  { divisor: true },
  { id: 'chuva',    nome: 'Chuva',   tipo: 'chuva', cor: 0x6ea8c9 },
  { id: 'apagar',   nome: 'Remover', tipo: 'apagar', cor: 0x6b6b66 },
];

export class Interface {
  constructor({ aoTrocarVelocidade, aoEnquadrar, aoRecomecar, aoIlhaPronta, aoComecar, aoSeguir,
                aoAbrirMundo, mundoAtual }) {
    this.aoSeguir = aoSeguir;
    this.aoAbrirMundo = aoAbrirMundo;
    this.mundoAtual = mundoAtual;      // devolve a Simulacao viva
    this.idDoMundo = null;             // slot em que este mundo foi guardado
    this.nomeDoMundo = '';             // nome que o jogador deu, se deu
    this.anoGuardado = 0;              // ano da última gravação, para saber o que se perde
    this.ultimoAuto = 0;               // relógio de parede da última gravação sozinha
    this.semEspaco = false;            // quota estourada: para de tentar sozinho
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
      b.innerHTML = `<span class="amostra" style="background:#${cor.toString(16).padStart(6, '0')}">${icone(p.id)}</span>`
                  + `<span class="rot">${p.nome}</span>`;
      b.setAttribute('aria-label', p.nome);
      b.title = p.nome;
      b.onclick = () => this.escolher(p.id);
      grupos.appendChild(b);
    }

    // Dica de rolagem: a fileira de pincéis é mais larga que a tela em telefone
    // deitado, e sem isto nada avisa que há mais. As bordas esfumadas ligam e
    // desligam conforme sobra pincel de cada lado.
    const marcarRolagem = () => {
      const resto = grupos.scrollWidth - grupos.clientWidth - grupos.scrollLeft;
      grupos.classList.toggle('temMais', resto > 4);
      grupos.classList.toggle('temAntes', grupos.scrollLeft > 4);
    };
    grupos.addEventListener('scroll', marcarRolagem, { passive: true });
    addEventListener('resize', marcarRolagem);
    addEventListener('orientationchange', () => setTimeout(marcarRolagem, 160));
    marcarRolagem();
    this.marcarRolagem = marcarRolagem;

    el('raio').oninput = (e) => {
      this.raio = Number(e.target.value);
      el('raioOut').textContent = String(this.raio);
    };
    // [data-vel] e não "#tempo button": o botão de modo limpo mora na mesma
    // barra e não é uma velocidade — sem o filtro ele apagava o 1× ao ser tocado
    for (const b of document.querySelectorAll('#tempo button[data-vel]')) {
      b.onclick = () => {
        for (const o of document.querySelectorAll('#tempo button[data-vel]')) o.classList.toggle('on', o === b);
        aoTrocarVelocidade(Number(b.dataset.vel));
      };
    }
    el('enquadrar').onclick = aoEnquadrar;
    // Mundo pelado e Ilha pronta jogam fora a partida em curso. Antes iam
    // direto: duas horas de mundo sumiam num toque errado, sem uma palavra.
    // Agora só vão direto quando não há nada a perder; havendo, o primeiro
    // toque arma o botão e diz o que está em jogo.
    el('recomecar').onclick = () => this.pedirDescarte('recomecar', aoRecomecar);
    el('ilhaPronta').onclick = () => this.pedirDescarte('ilhaPronta', aoIlhaPronta);
    // Todo painel grande encolhe com o mesmo botão e o mesmo gesto. Num
    // telefone deitado, crônica, paleta e barra de estado juntas comem metade
    // da tela — e a tela é o jogo.
    for (const [botao, painel] of [['dobrar', 'cronica'], ['dobrarEstado', 'estado'],
                                   ['dobrarPaleta', 'paleta']]) {
      el(botao).onclick = () => {
        const fechado = el(painel).classList.toggle('fechada');
        el(botao).textContent = fechado ? '+' : '—';
      };
    }
    // Modo limpo: some com tudo de uma vez e deixa só o controle de tempo, que
    // é o único que se usa quando a intenção é olhar o mundo andar.
    el('modoLimpo').onclick = () => {
      const limpo = el('ui').classList.toggle('limpo');
      el('modoLimpo').classList.toggle('on', limpo);
      el('modoLimpo').setAttribute('aria-label', limpo ? 'Mostrar os painéis' : 'Esconder os painéis');
      el('modoLimpo').title = limpo ? 'Mostrar os painéis' : 'Esconder os painéis';
    };
    el('fecharInspetor').onclick = () => this.limparInspetor();
    el('abrirMundos').onclick = () => this.mostrarMundos();
    el('fecharMundos').onclick = () => el('mundos').classList.remove('on');
    el('guardarMundo').onclick = () => {
      const sim = this.mundoAtual();
      if (!sim) return;
      const nome = el('nomeMundo').value.trim() || `Mundo do ano ${sim.ano}`;
      // Guardar por cima do mesmo slot: quem salva de novo o mundo em que está
      // jogando quer atualizar aquele registro, não colecionar oito cópias dele.
      const r = guardar(sim, nome, this.idDoMundo);
      if (r.ok) {
        this.idDoMundo = r.id;
        this.nomeDoMundo = nome;
        this.anoGuardado = sim.ano;
        this.semEspaco = false;
      }
      this.avisar(r.ok ? (r.aviso || `guardado como "${nome}"`) : r.erro);
      this.listarMundos();
    };
    el('comecar').onclick = () => { el('abertura').hidden = true; aoComecar(); };
    this.escolher('humano');
  }

  avisar(texto) {
    el('avisoMundos').textContent = texto || '';
    clearTimeout(this._avisoRelogio);
    this._avisoRelogio = setTimeout(() => { el('avisoMundos').textContent = ''; }, 4000);
  }

  /** Recado curto no alto da tela. O `avisar` acima mora dentro do painel de
   *  mundos e só serve quando ele está aberto; guardar sozinho e descartar
   *  mundo acontecem com o painel fechado. */
  recado(texto, alerta = false, quanto = 3200) {
    const r = el('recado');
    r.textContent = texto || '';
    r.classList.toggle('alerta', !!alerta);
    // Não precisa abrir a paleta encolhida: `.fechada` esconde os pincéis, e o
    // recado mora abaixo deles, na mesma faixa dos botões.
    r.classList.toggle('on', !!texto);
    clearTimeout(this._recadoRelogio);
    if (texto) this._recadoRelogio = setTimeout(() => r.classList.remove('on'), quanto);
  }

  // ------------------------------------------------------- guardar sozinho
  /** Anos de mundo que se perderiam se a aba fechasse agora. */
  aPerder(sim) {
    if (!sim || !sim.humanos.length) return 0;
    return Math.max(0, sim.ano - this.anoGuardado);
  }

  /**
   * Grava sem ninguém pedir. Chamado a cada quadro (ele mesmo se contém) e ao
   * sair da aba.
   *
   * O slot: quem já guardou ou abriu um mundo tem o seu, e é nele que se grava,
   * com o nome que a pessoa deu. Quem nunca guardou vai para o slot reservado
   * `auto` — um só, sempre por cima. Se cada mundo novo abrisse o seu, oito
   * experimentos de dois minutos empurrariam para fora a partida de duas horas
   * que a pessoa guardou à mão, que é o oposto do que isto existe para fazer.
   */
  guardarSozinho(sim, agora = performance.now()) {
    if (this.semEspaco || !sim) return false;
    // Mundo sem gente ou recém-nascido não vale um slot: quem está só
    // experimentando pincel não quer o registro cheio de rascunho.
    if (!sim.humanos.length || sim.ano < 3) return false;
    if (sim.ano - this.anoGuardado < 1) return false;
    const nome = this.nomeDoMundo || `Rascunho do ano ${sim.ano}`;
    const r = guardar(sim, nome, this.idDoMundo || 'auto');
    this.ultimoAuto = agora;
    if (!r.ok) {
      // Sem espaço, insistir a cada trinta segundos só gasta bateria e enche a
      // tela de recado. Cala e deixa o botão Guardar dizer o mesmo quando a
      // pessoa tentar à mão.
      this.semEspaco = true;
      this.recado('Não há espaço no navegador para guardar este mundo.', true, 6000);
      return false;
    }
    this.idDoMundo = r.id;
    this.anoGuardado = sim.ano;
    if (el('mundos').classList.contains('on')) this.listarMundos();
    return true;
  }

  /** Chamado a cada quadro. Trinta segundos de relógio de parede entre uma
   *  gravação e outra: empacotar o mundo custa poucos milissegundos, mas num
   *  telefone a cada quadro isso vira engasgo visível. */
  talvezGuardar(sim) {
    const agora = performance.now();
    if (agora - this.ultimoAuto < 30000) return;
    this.ultimoAuto = agora;          // marca mesmo se não gravar, para não reavaliar em rajada
    this.guardarSozinho(sim, agora);
  }

  /** A aba está indo embora. No Safari do iPhone `beforeunload` não é confiável
   *  — quem avisa é `visibilitychange`/`pagehide`, e é a última chance. */
  guardarAoSair() {
    const sim = this.mundoAtual();
    if (sim) this.guardarSozinho(sim);
  }

  /**
   * Descartar o mundo em curso. Vai direto se não há o que perder; havendo,
   * o primeiro toque arma o botão por cinco segundos e diz quanto está em jogo.
   */
  pedirDescarte(chave, acao) {
    const sim = this.mundoAtual();
    const perde = this.aPerder(sim);
    const desarmar = () => {
      clearTimeout(this._armadoRelogio);
      if (this._armado) {
        el(this._armado).classList.remove('armado');
        el(this._armado).textContent = this._armadoRotulo;
      }
      this._armado = null;
    };
    if (this._armado === chave) { desarmar(); this.recado(''); acao(); return; }
    desarmar();
    if (perde < 1) { acao(); return; }
    this._armado = chave;
    this._armadoRotulo = el(chave).textContent;
    el(chave).classList.add('armado');
    el(chave).textContent = 'Descartar?';
    this.recado(`Este mundo tem ${Math.round(perde)} ano${perde >= 2 ? 's' : ''} `
              + 'que ainda não foram guardados. Toque de novo para descartar, '
              + 'ou abra Mundos e guarde antes.', true, JANELA_DESCARTE);
    this._armadoRelogio = setTimeout(desarmar, JANELA_DESCARTE);
  }

  mostrarMundos() {
    const sim = this.mundoAtual();
    if (sim && !el('nomeMundo').value) el('nomeMundo').value = `Mundo do ano ${sim.ano}`;
    this.listarMundos();
    el('mundos').classList.add('on');
  }

  listarMundos() {
    const lista = el('listaMundos');
    lista.innerHTML = '';
    const mundos = indice();
    if (!mundos.length) {
      const p = document.createElement('p');
      p.className = 'vazio';
      p.textContent = 'Nenhum mundo guardado ainda. Guarde este e ele fica aqui, no próprio aparelho.';
      lista.appendChild(p);
      return;
    }
    for (const m of mundos) {
      const li = document.createElement('li');
      const quando = new Date(m.quando).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      li.innerHTML = '<div class="nome"><b></b><i></i></div>'
                   + '<button class="ler">Abrir</button><button class="apagar">Apagar</button>';
      li.querySelector('b').textContent = m.nome;
      li.querySelector('i').textContent =
        `ano ${m.resumo.ano} · ${m.resumo.pessoas} pessoas · ${m.resumo.tribos} tribos · ${quando}`;
      li.querySelector('.ler').onclick = () => {
        const pacote = abrir(m.id);
        if (!pacote) return this.avisar('esse mundo sumiu do armazenamento');
        this.idDoMundo = m.id;
        this.nomeDoMundo = m.nome;
        this.anoGuardado = m.resumo.ano;
        el('nomeMundo').value = m.nome;
        el('mundos').classList.remove('on');
        this.aoAbrirMundo(pacote);
      };
      li.querySelector('.apagar').onclick = () => {
        apagar(m.id);
        if (this.idDoMundo === m.id) this.idDoMundo = null;
        this.listarMundos();
      };
      lista.appendChild(li);
    }
  }

  escolher(id) {
    this.pincel = this.pincel?.id === id ? null : PINCEIS.find((p) => p.id === id) || null;
    for (const b of document.querySelectorAll('.pincel')) {
      b.classList.toggle('on', this.pincel && b.dataset.id === this.pincel.id);
    }
    el('ferramentaNome').textContent = this.pincel ? this.pincel.nome : 'Explorar o mundo';
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
      p.className = 'nova';
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
    // abreviado de propósito: por extenso isto virava três linhas e o painel
    // crescia até cobrir a fita de tribos
    const CURTO = { lavrador: 'lav', cacador: 'caç', construtor: 'con', minerador: 'min',
                    lider: 'líd', guarda: 'gua', pastor: 'pas', pescador: 'pes',
                    artesao: 'art' };
    const gente = CHAVES_VOCACAO.filter((k) => conta[k])
      .map((k) => `${conta[k]} ${CURTO[k]}`).join(' · ');
    const proxima = ERAS[t.era + 1];
    dl.innerHTML = linhas([
      ['Era', `${ERAS[t.era].nome}`],
      // o que falta para o próximo degrau é a informação mais útil do painel:
      // é ela que diz ao jogador o que pintar ou soltar para a tribo evoluir
      ...(proxima ? [['Para subir', proxima.conta]] : [['', 'no topo do que sabe fazer']]),
      ['Pessoas', `${t.pop}${t.aguaPropria ? ` de ${t.aguaPara} que a água dá` : ' · sem fonte'}`],
      ['Gente', gente || '—'],
      ['Celeiro', `${t.celeiro.toFixed(0)} (${t.porHabitante.toFixed(1)} por cabeça)`],
      ['Técnica', TECNOLOGIAS[t.tecnologia] + (t.comLider ? ' · com líder' : '')],
      ['Roças', t.plantios],
      ['Abrigo', `${t.ocas.length} ocas` + (t.temVagaEmCasa ? '' : ' · sem vaga')],
      ['Madeira', t.madeira.toFixed(0)],
      ['Pedra', `${t.minerais.toFixed(0)}${t.muros.length ? ` · ${t.muros.length} de muro` : ''}`],
      ['Gado', t.cabecas + (t.curral ? ` / ${t.capacidadeCurral} no curral` : ' · solto')],
      ['Situação', t.faminta ? 'passando fome' : t.farta ? 'com fartura' : 'em pé'],
      ['Vizinhas', rel.length ? rel.map(([id, r]) => `${sim.tribo(id)?.nome || '?'} (${r})`).join(', ') : 'nenhuma'],
    ]);
    caixa.classList.add('on');
  }

  limparInspetor() { el('inspetor').classList.remove('on'); this.fixado = null; }
}

const linhas = (pares) => pares.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

/** Ícones vetoriais pequenos, monocromáticos e offline. */
function icone(id) {
  const caminhos = {
    humano: '<circle cx="12" cy="6" r="3"/><path d="M7 21v-4.5a5 5 0 0 1 10 0V21M9 12l-3 5m9-5 3 5"/>',
    rebanho: '<path d="M5 10.5h11a3 3 0 0 1 3 3v2H7a3 3 0 0 1-3-3v-1a1 1 0 0 1 1-1Z"/><path d="M17 11V8l3 1v4M8 16v3m7-3v3"/>',
    fera: '<path d="m4 15 2-7 4 3 5-4 5 3-2 7-7 2Z"/><path d="m6 8-1-3 4 2m6 0 4-2-1 4"/>',
    fertil: '<path d="M4 18c5-1 11-1 16 0M6 14c4-1 8-1 12 0M9 10c2-.5 4-.5 6 0"/><path d="M12 10V5m0 0-3 2m3-2 3 2"/>',
    campo: '<path d="M5 19c1-5 2-8 4-12m2 12c0-6 1-10 3-14m1 14c1-4 2-7 4-10"/>',
    terra: '<path d="M4 18c4-2 12-2 16 0M5 13c3 1 5 1 7 0s5-1 7 0M8 8h.01M15 7h.01"/>',
    semente: '<path d="M12 21c0-5 1-8 4-10M12 21c0-4-1-6-3-8"/><path d="M16 5c2 3 1 6-2 6-2 0-3-2-2-4s3-2 4-2Z"/>',
    agua: '<path d="M12 3S6 10 6 14a6 6 0 0 0 12 0c0-4-6-11-6-11Z"/><path d="M9 15c1 2 3 3 5 2"/>',
    areia: '<circle cx="8" cy="9" r="1"/><circle cx="16" cy="7" r="1"/><circle cx="14" cy="15" r="1"/><path d="M4 19c5-2 11-2 16 0"/>',
    rocha: '<path d="m5 17 2-8 5-4 6 5 1 7-5 2-6-1Z"/><path d="m7 9 5 3 6-2"/>',
    montanha: '<path d="m3 19 7-13 3 5 2-3 6 11Z"/><path d="m8 10 2 2 2-2 1 1"/>',
    capivara: '<path d="M5 15h9a4 4 0 0 0 4-4v-1h1M5 15v3m4-3v3m5-3v3"/><path d="M4 15v-3a3 3 0 0 1 3-3h7"/>',
    lebre: '<path d="M7 18h7a3 3 0 0 0 3-3 3 3 0 0 0-3-3H9a2 2 0 0 0-2 2Z"/><path d="M14 12V7m3 5V8"/><path d="M7 18v2m7-2v2"/>',
    chuva: '<path d="M7 15a4 4 0 0 1 .6-8 5 5 0 0 1 9.5 1.3A3.4 3.4 0 0 1 17 15Z"/><path d="M9 18l-1 3m4-3-1 3m4-3-1 3"/>',
    peixe: '<path d="M4 12c3-4 8-5 12-3l4-3-1 6 1 6-4-3c-4 2-9 1-12-3Z"/><circle cx="9" cy="11" r=".9"/>',
    jacare: '<path d="M3 14h10l4-3 4 1-3 3 3 1-4 1-4-1H4Z"/><path d="M8 12v-1m3 1v-1"/>',
    apagar: '<path d="m6 7 11 11m1-11L7 18"/><circle cx="12" cy="12" r="9"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${caminhos[id] || ''}</svg>`;
}
