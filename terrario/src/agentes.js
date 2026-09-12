// Humanos, rebanhos e predadores.
//
// Nenhum agente sabe o que é "civilização". Cada um só resolve a próxima
// necessidade com o que tem por perto. Plantio, pecuária, mineração e guerra
// aparecem porque a opção mais barata muda conforme o jogador mexe no mundo —
// é essa a peça que precisa ficar de pé, não a lista de tarefas.

import { T, TERRENOS } from './mundo.js';
import { rende, MADEIRA_CERCA } from './tribos.js';

/** Um ano de mundo em segundos de simulação. Toda taxa abaixo é por ano. */
export const ANO = 4;

const VEL = 2.4;                 // tiles por segundo de simulação
// A fera precisa ser mais rápida que a presa E que o humano. Com 1,9 ela era
// mais lenta que os dois e morria de fome perseguindo o almoço a pé.
const VEL_FERA = 3.4;
// O herbívoro existe para ser caçado e domesticado. Apetite alto o transforma
// em concorrente do forrageio humano, e aí ele mata os bandos de fome.
const PASTAGEM = 0.12;
const MAIORIDADE = 18;
const FOME_POR_ANO = 0.52;
const FOME_CRITICA = 0.55;       // acima disto largar tudo e comer
const RAIO_BUSCA = 11;
// 26 tiles são quase três anos de caminhada: longe demais para uma viagem sem
// reavaliar a fome no meio.
const RAIO_EXPLORAR = 18;
export const MADEIRA_OCA = 9;    // lenha para levantar um abrigo de duas pessoas

/** Trabalhos: duração em anos e o que rendem. */
const OBRA = {
  forragear: { dur: 0.22 },
  colher:    { dur: 0.18, rende: 2.4 },
  pastorear: { dur: 0.26, rende: 1.7 },
  cacar:     { dur: 0.45 },
  arar:      { dur: 0.45 },
  cercar:    { dur: 0.5 },
  pescar:    { dur: 0.3 },
  arrebanhar:{ dur: 0.3 },
  recolher:  { dur: 0.2 },
  vigiar:    { dur: 0.4 },
  enfrentar: { dur: 0.22 },
  minerar:   { dur: 0.4, minerio: 2.2 },
  lenhar:    { dur: 0.34 },
  construir: { dur: 0.6 },
  lutar:     { dur: 0.3 },
};

export class Humano {
  /** `sorte` vem da simulação. Nenhum agente chama Math.random: o mundo tem que
   *  ser reproduzível pela semente, senão o teste de equilíbrio mede ruído — foi
   *  assim que a mesma semente deu extinção em 16 anos e 400 anos de história. */
  constructor(x, y, idade = 18, sorte = Math.random) {
    this.x = x; this.y = y;
    this.idade = idade;
    this.expectativa = 58 + sorte() * 22;
    this.fome = sorte() * 0.3;
    this.tribo = null;
    this.dom = 'lavrador';         // vocação; quem define é a simulação
    this.alvo = null;              // {x, y, obra}
    this.obra = null;
    this.progresso = 0;
    this.travado = 0;
    this.descanso = 0;             // anos até poder gerar outro filho
    this.conduzindo = null;        // bicho que está sendo tocado para o curral
    this.viva = true;
    this.causa = null;
  }

  get adulto() { return this.idade >= MAIORIDADE; }

  morrer(causa) { this.viva = false; this.causa = causa; this.largarBicho(); }

  /** Solta o bicho que estava conduzindo. Sem isto, condutor morto ou distraído
   *  deixa o animal seguindo um fantasma pelo resto da vida. */
  largarBicho() {
    if (!this.conduzindo) return;
    this.conduzindo.conduzido = null;
    this.conduzindo = null;
  }

  atualizar(dt, sim) {
    const anos = dt / ANO;
    this.idade += anos;
    this.fome += anos * FOME_POR_ANO * (this.adulto ? 1 : 0.6);
    this.descanso = Math.max(0, this.descanso - anos);

    if (this.idade > this.expectativa) return this.morrer('velhice');
    if (this.fome >= 1) return this.morrer('fome');

    // Dentro d'água. Acontece quando o jogador pinta água debaixo de gente, e
    // sem isto a pessoa ficava presa para sempre num tile que `mover` recusa —
    // viva, sem tarefa possível, contando como população para todo o resto.
    // Gente nada melhor que boi, mas não indefinidamente.
    if (sim.mundo.ehAgua(Math.round(this.x), Math.round(this.y))) {
      this.nadando = (this.nadando || 0) + anos;
      if (this.nadando > 0.9) return this.morrer('afogado');
      this.alvo = null; this.obra = null;
      this.largarBicho();
      const saida = this.margemMaisPerto(sim);
      if (saida) mover(this, saida, VEL * 0.55 * dt, sim.mundo,
                       (x, y) => sim.mundo.andavel(x, y) || sim.mundo.ehAgua(x, y));
      return;
    }
    this.nadando = 0;

    // Fome no limite larga o que estiver fazendo. `escolherTarefa` só roda com o
    // agente parado, então numa viagem longa dava para morrer de fome a caminho
    // do destino com o celeiro cheio em casa — foi o que a exploração de raio 26
    // provocou assim que entrou.
    if (this.fome > 0.8 && (this.alvo || this.obra) && this.tribo && this.tribo.celeiro >= 1) {
      this.alvo = null;
      this.obra = null;
      // quem larga tudo para comer larga o bicho também, senão ele fica preso a
      // um condutor que nunca mais vai para o curral
      this.largarBicho();
    }

    if (this.obra) return this.trabalhar(anos, sim);
    if (!this.alvo) this.escolherTarefa(sim);
    if (this.alvo) this.caminhar(dt, sim);
  }

  // ---------- decisão ----------
  // A ordem aqui é o jogo inteiro. A versão anterior mandava todo mundo buscar
  // comida enquanto o celeiro estivesse baixo — e como o celeiro só sobe se
  // alguém parar para arar, nenhuma tribo jamais escapava da subsistência. Por
  // isso a primeira lavoura, o primeiro pasto e a primeira mina vêm ANTES de
  // encher o celeiro: são o único caminho para fora dele.
  escolherTarefa(sim) {
    const t = this.tribo;

    // 1. fome pessoal manda em tudo
    if (this.fome > FOME_CRITICA) {
      if (t && t.celeiro >= 1) {
        t.celeiro -= 1;
        this.fome = Math.max(0, this.fome - 0.52);
        return;
      }
      if (this.buscarComida(sim)) return;
      return this.vagar(sim);
    }

    if (!t) {
      if (this.buscarComida(sim)) return;
      return this.vagar(sim);
    }

    // 2. Guerra na fronteira tem precedência sobre obra — mas não para todo
    //    mundo. Com a tribo inteira em armas ninguém colhe, e o celeiro de
    //    cento e cinquenta vira catorze em dez anos: a fome mata muito mais que
    //    o inimigo, e foi assim que a semente 7 se extinguiu no ano 192 sem
    //    perder uma batalha. Guarda vai sempre, é o ofício; o resto vai um em
    //    cada três, e ninguém vai de barriga vazia.
    if (this.adulto && !t.faminta && this.inimigoPerto(sim)
        && (this.dom === 'guarda' || sim.sorte() < 0.3)) {
      this.alvo = { x: this.x, y: this.y, obra: 'lutar' };
      return;
    }

    // 2b. Fera rondando a cerca. O guarda vai atrás; os outros seguem a vida.
    //     Sem isto o curral só junta o gado num lugar — e junto e parado ele é
    //     alvo mais fácil do que espalhado.
    if (this.adulto && this.dom === 'guarda' && t.curral) {
      const fera = sim.feraNoCurral(t);
      if (fera) { this.alvo = { x: fera.x, y: fera.y, obra: 'enfrentar' }; return; }
    }

    if (this.adulto) {
      // 3. Lavoura antes de tudo: é a única saída da subsistência, e sem ela
      //    nem casa se levanta — quem passa o dia catando raiz não corta lenha.
      if (!t.temPlantacao && t.pop >= 2 && this.acharFertil(sim)) { this.alvo.obra = 'arar'; return; }
    }

    // 3b. Casa. A ordem do assentamento é essa e nesta ordem: lavoura de pé,
    //     depois telhado, e só então cerca e mina. Abrigo vem antes de encher o
    //     celeiro porque é ele que trava o crescimento — mas nunca antes de
    //     comer: com menos de 2,4 por cabeça, lenha espera.
    //     Falta de teto é condição da tribo inteira, então sem dado a tribo
    //     inteira vai construir junto: trinta e três das cinquenta e uma pessoas
    //     de uma vez, e ninguém na roça. Construtor vai quase sempre; os outros,
    //     metade das vezes.
    if (this.adulto && !t.temVagaEmCasa && t.porHabitante > 2.4
        && sim.sorte() < 0.5 * rende(this, 'construir')) {
      if (t.madeira >= t.custoDaOca(MADEIRA_OCA)) {
        const s = sim.sitioDeOca(t);
        if (s) { this.alvo = { x: s.x, y: s.y, obra: 'construir' }; return; }
      } else if (this.acharMata(sim)) {
        this.alvo.obra = 'lenhar';
        return;
      }
    }

    if (this.adulto) {
      // 3c. Cerca e mina, as duas depois do telhado. A cerca sai da mesma lenha
      //     da oca: cercada antes de abrigada, a tribo fica sem casa, para de
      //     ter filho e morre de velha — foi o que a semente 1234 fez.
      if (!t.temPasto && t.rebanhosProximos >= 3 && t.temVagaEmCasa
          && t.madeira >= MADEIRA_CERCA * 0.5 + t.custoDaOca(MADEIRA_OCA)
          && this.acharPastagem(sim)) { this.alvo.obra = 'cercar'; return; }
      if (!t.temMina && t.pop >= 5 && !t.faminta && this.acharVeio(sim)) { this.alvo.obra = 'minerar'; return; }
    }

    // 4. celeiro baixo: trabalhar comida
    if (t.porHabitante < 3.6 && this.buscarComida(sim)) return;

    // 4c. Guarda de plantão: fica no mourão em vez de ir para a roça. Custa uma
    //     boca que não produz — é o preço de ter rebanho e fronteira.
    if (this.adulto && this.dom === 'guarda' && t.curral) {
      const posto = t.postoDe(this);
      if (posto) { this.alvo = { x: posto.x, y: posto.y, obra: 'vigiar' }; return; }
    }

    // 5. Curral apertado. Ampliar sai da mesma lenha do telhado, então só
    //     acontece com a tribo coberta e com sobra — é essa disputa que decide
    //     se a aldeia cria gado ou abriga gente.
    if (this.adulto && t.curral && t.cabecas >= t.capacidadeCurral && t.temVagaEmCasa
        && t.madeira >= MADEIRA_CERCA + t.custoDaOca(MADEIRA_OCA) && !t.faminta
        && sim.sorte() < 0.4 * rende(this, 'cercar')) {
      this.alvo = { x: Math.round(t.curral.x), y: Math.round(t.curral.y), obra: 'cercar' };
      return;
    }

    // 5b. uma roça por pessoa é a meta; abrir lavoura não espera a tribo engordar
    if (this.adulto && t.temPlantacao && t.plantios < t.pop
        && sim.sorte() < 0.5 * rende(this, 'arar')
        && this.acharFertil(sim)) { this.alvo.obra = 'arar'; return; }

    if (this.adulto && !t.faminta) {
      // Conduzir bicho solto para dentro da cerca. Bicho não entra em curral
      // sozinho: alguém vai buscar e traz tocando. Fica aqui, junto das obras
      // opcionais e com dado, porque na frente da roça e do telhado virou vício:
      // dezessete das vinte e quatro pessoas passavam o dia atrás de boi, as
      // roças caíam de vinte e três para zero e a tribo morria de velha com o
      // celeiro cheio. Pastor faz quase o dobro das vezes — é o ofício dele.
      if (t.curral && !this.conduzindo && t.cabecas < t.capacidadeCurral
          && t.temVagaEmCasa && sim.sorte() < 0.22 * rende(this, 'arrebanhar')) {
        const bicho = sim.bichoSoltoPerto(this, t);
        if (bicho) { this.alvo = { x: bicho.x, y: bicho.y, obra: 'arrebanhar' }; return; }
      }
      if (t.temMina && sim.sorte() < 0.35 * rende(this, 'minerar') && this.acharVeio(sim)) { this.alvo.obra = 'minerar'; return; }
      if (t.madeira >= MADEIRA_OCA && t.ocas.length < Math.ceil(t.pop / 1.7)
          && sim.sorte() < 0.3 * rende(this, 'construir')) {
        const s = sim.sitioDeOca(t);
        if (s) { this.alvo = { x: s.x, y: s.y, obra: 'construir' }; return; }
      }
      if (t.madeira < MADEIRA_OCA * 2 && sim.sorte() < 0.3 && this.acharMata(sim)) {
        this.alvo.obra = 'lenhar';
        return;
      }
    }

    // 6. procriar
    if (this.adulto && this.descanso <= 0 && t.farta && sim.podeNascer(t)) {
      const par = sim.parPerto(this);
      if (par) { sim.nascer(this, par); return; }
    }

    if (this.buscarComida(sim)) return;
    this.vagar(sim);
  }

  acharFertil(sim) { return this.acharTile(sim, (i) => sim.mundo.terreno[i] === T.FERTIL, true); }
  acharPastagem(sim) { return this.acharTile(sim, (i) => sim.mundo.terreno[i] === T.GRAMA, true); }
  acharVeio(sim) { return this.acharTile(sim, (i) => sim.mundo.minerio[i] > 0, true); }
  /**
   * Lenha vale procurar fora de casa: mata costuma ficar na borda do domínio.
   *
   * Com duas ocas de pé a escolha passa a puxar para perto do centro da aldeia.
   * Não é enfeite: é o que abre a clareira em volta das casas, e clareira é
   * campo de visão — o guarda vê a fera chegando em vez de ela sair de trás de
   * uma árvore colada na cerca. Também é o que faz a floresta recuar de dentro
   * para fora conforme a tribo cresce, em vez de virar buraco de traça.
   */
  acharMata(sim) {
    const t = this.tribo;
    const mata = (i) => sim.mundo.terreno[i] === T.FLORESTA && sim.mundo.madeira[i] > 0.3;
    const aldeia = t && t.ocas.length >= 2 ? { x: t.cx, y: t.cy } : null;
    return this.acharTile(sim, mata, true, RAIO_BUSCA, aldeia)
        || this.acharTile(sim, mata, false);
  }

  /** Comida na ordem do que rende mais por viagem. */
  buscarComida(sim) {
    const { mundo } = sim;
    const t = this.tribo;
    // O pescador vai ao rio antes de olhar a roça. É o ofício dele, e é o que
    // faz uma tribo de beira d'água comer do rio em vez de só ter margem no
    // mapa: sem esta linha a pesca era um acaso de quem passava perto.
    if (t && t.temCosta && this.dom === 'pescador' && this.pescaria(sim)) return true;
    if (t) {
      if (t.temPlantacao && this.acharTile(sim, (i) => mundo.terreno[i] === T.PLANTACAO && mundo.crescer[i] >= 1, true)) {
        this.alvo.obra = 'colher';
        return true;
      }
      if (t.cabecas > 0 && t.temPasto && this.acharTile(sim, (i) => mundo.terreno[i] === T.PASTO, true)) {
        this.alvo.obra = 'pastorear';
        return true;
      }
      // Margem com peixe também serve a quem não é pescador, com menos vontade.
      if (t.temCosta && sim.sorte() < 0.28 && this.pescaria(sim)) return true;
    }
    // caçador vai atrás de bicho antes de catar mato; é o que faz um bando de
    // caçadores esgotar o rebanho enquanto um de lavradores nem encosta nele
    if (this.dom === 'cacador') {
      const bicho = sim.presaPerto(this.x, this.y, RAIO_BUSCA);
      if (bicho) { this.alvo = { x: bicho.x, y: bicho.y, obra: 'cacar', presa: bicho }; return true; }
    }
    if (this.acharTile(sim, (i) => mundo.comida[i] > 0.12, false)) {
      this.alvo.obra = 'forragear';
      return true;
    }
    // nada por perto: sai à procura em vez de circular no pedaço já comido —
    // mas só quem ainda tem fôlego para a viagem
    if (this.fome < 0.6
        && this.acharTile(sim, (i) => mundo.comida[i] > 0.10, false, RAIO_EXPLORAR)) {
      this.alvo.obra = 'forragear';
      return true;
    }
    const presa = sim.presaPerto(this.x, this.y, RAIO_BUSCA + 4);
    if (presa) {
      this.alvo = { x: presa.x, y: presa.y, obra: 'cacar', presa };
      return true;
    }
    return false;
  }

  /**
   * Acha um lugar de pesca: um peixe ao alcance de exploração e uma margem
   * pisável coladinha nele. O raio é o de exploração, não o de busca — a aldeia
   * fica no meio do território e a margem, na borda. Procurando peixe a onze
   * tiles de quem decide, ninguém enxergava o rio de casa e cem anos de tribo
   * costeira davam zero peixe pescado.
   */
  pescaria(sim) {
    const peixe = sim.peixePerto(this.x, this.y, RAIO_EXPLORAR);
    if (!peixe) return false;
    const achou = this.acharTile(sim, (i) => {
      const x = i % sim.mundo.n, y = (i / sim.mundo.n) | 0;
      return sim.mundo.naMargem(x, y) && Math.hypot(x - peixe.x, y - peixe.y) < 4.5;
    }, false, RAIO_EXPLORAR);
    if (!achou) return false;
    this.alvo.obra = 'pescar';
    return true;
  }

  /**
   * Varre um quadrado ao redor e guarda o melhor tile. Roda só ao trocar de
   * tarefa. `raio` maior é o modo exploração: quando não há nada por perto,
   * vale andar longe em vez de ficar dando voltas no mesmo pedaço gasto.
   */
  acharTile(sim, aceita, dentroDoTerritorio, raio = RAIO_BUSCA, centro = null) {
    const { mundo } = sim;
    const t = this.tribo;
    const cx = Math.round(this.x), cy = Math.round(this.y);
    let melhor = null, melhorCusto = Infinity;
    for (let dy = -raio; dy <= raio; dy++) {
      for (let dx = -raio; dx <= raio; dx++) {
        const x = cx + dx, y = cy + dy;
        if (!mundo.dentro(x, y)) continue;
        const i = mundo.idx(x, y);
        if (!TERRENOS[mundo.terreno[i]].andavel) continue;
        if (dentroDoTerritorio && t && mundo.dono[i] !== t.id) continue;
        if (!aceita(i)) continue;
        // `centro` puxa a escolha para perto de um ponto que não é o do
        // trabalhador — é o que abre clareira em volta da aldeia em vez de cada
        // um derrubar a árvore que estiver debaixo do próprio nariz
        let custo = dx * dx + dy * dy;
        if (centro) custo += 1.8 * ((x - centro.x) ** 2 + (y - centro.y) ** 2);
        if (custo < melhorCusto) { melhorCusto = custo; melhor = { x, y }; }
      }
    }
    if (!melhor) return false;
    this.alvo = { x: melhor.x, y: melhor.y, obra: null };
    return true;
  }

  /** Chão firme mais próximo, para quem caiu na água. */
  margemMaisPerto(sim) {
    const cx = Math.round(this.x), cy = Math.round(this.y);
    for (let raio = 1; raio <= 8; raio++) {
      for (let dy = -raio; dy <= raio; dy++) {
        for (let dx = -raio; dx <= raio; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== raio) continue;
          if (sim.mundo.andavel(cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
        }
      }
    }
    return null;
  }

  inimigoPerto(sim) {
    const t = this.tribo;
    for (const [id, rel] of t.relacoes) {
      if (rel !== 'guerra') continue;
      const outra = sim.tribo(id);
      if (!outra || !outra.viva) continue;
      const d = Math.hypot(outra.cx - this.x, outra.cy - this.y);
      if (d < t.raio + outra.raio + 2) return outra;
    }
    return null;
  }

  vagar(sim) {
    const t = this.tribo;
    const raio = t ? t.raio * 0.8 : 6;
    const cx = t ? t.cx : this.x, cy = t ? t.cy : this.y;
    for (let k = 0; k < 8; k++) {
      const a = sim.sorte() * Math.PI * 2, d = sim.sorte() * raio;
      const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
      if (sim.mundo.andavel(x, y)) { this.alvo = { x, y, obra: 'parado' }; return; }
    }
    this.alvo = null;
  }

  // ---------- movimento ----------
  caminhar(dt, sim) {
    const dx = this.alvo.x - this.x, dy = this.alvo.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.4) {
      if (this.alvo.obra && this.alvo.obra !== 'parado') {
        this.obra = this.alvo.obra;
        this.progresso = 0;
      }
      this.alvo = null;
      this.travado = 0;
      return;
    }
    const passo = VEL * dt;
    let nx = this.x + (dx / d) * passo, ny = this.y + (dy / d) * passo;
    if (!sim.mundo.andavel(Math.round(nx), Math.round(ny))) {
      // contorna: tenta só um eixo antes de desistir do alvo
      if (sim.mundo.andavel(Math.round(this.x + (dx / d) * passo), Math.round(this.y))) ny = this.y;
      else if (sim.mundo.andavel(Math.round(this.x), Math.round(this.y + (dy / d) * passo))) nx = this.x;
      else if (++this.travado > 40) { this.alvo = null; this.travado = 0; return; }
      else return;
    }
    this.x = nx; this.y = ny;
  }

  // ---------- execução ----------
  trabalhar(anos, sim) {
    this.progresso += anos;
    if (this.progresso < OBRA[this.obra].dur) return;
    const obra = this.obra;
    this.obra = null;
    sim.concluirObra(this, obra);
  }
}

// ---------------------------------------------------------------- rebanhos
export class Rebanho {
  constructor(x, y, sorte = Math.random) {
    this.x = x; this.y = y;
    this.idade = sorte() * 4;
    this.expectativa = 12 + sorte() * 6;
    this.domesticado = false;
    this.conduzido = null;         // humano que está tocando este bicho
    this.panico = 0;               // anos de susto; em pânico o bicho entra na água
    this.afogando = 0;
    this.tribo = null;
    this.alvo = null;
    this.descanso = 2 + sorte() * 3;
    this.viva = true;
  }

  atualizar(dt, sim) {
    const anos = dt / ANO;
    this.idade += anos;
    this.descanso = Math.max(0, this.descanso - anos);
    if (this.idade > this.expectativa) { this.viva = false; return; }

    const { mundo } = sim;
    const i = mundo.idx(Math.round(this.x), Math.round(this.y));
    this.panico = Math.max(0, this.panico - anos);

    // Dentro d'água. Bicho de terra não entra por vontade — entra fugindo — e
    // uma vez lá dentro tem pouco tempo: ou acha a margem, ou se afoga, ou o
    // jacaré chega antes. É o que dá preço a empurrar rebanho para o rio.
    if (mundo.terreno[i] === T.AGUA) {
      this.afogando += anos;
      if (this.afogando > 0.6) { this.viva = false; this.causa = 'afogado'; return; }
      if (!this.saida || !mundo.andavel(this.saida.x, this.saida.y)) {
        this.saida = null;
        for (let raio = 1; raio <= 6 && !this.saida; raio++) {
          for (let dy = -raio; dy <= raio && !this.saida; dy++) {
            for (let dx = -raio; dx <= raio; dx++) {
              const x = Math.round(this.x) + dx, y = Math.round(this.y) + dy;
              if (mundo.andavel(x, y)) { this.saida = { x, y }; break; }
            }
          }
        }
      }
      if (this.saida) mover(this, this.saida, 0.75 * dt, mundo, (x, y) => mundo.andavel(x, y) || mundo.ehAgua(x, y));
      return;
    }
    this.afogando = 0;
    this.saida = null;

    // Bicho não se domestica sozinho. Antes bastava passar por território com
    // pasto e ele virava criação — rebanho selvagem entrando no curral por
    // conta própria, que é justamente o que ninguém faz. Agora alguém tem que
    // ir buscar: a conversão está em `recolher`, quando o condutor chega com
    // ele dentro da cerca.
    if (this.conduzido && (!this.conduzido.viva || this.conduzido.conduzindo !== this)) {
      this.conduzido = null;
    }

    // Pasta o que tem debaixo do pé. `saciado` é a fração do apetite atendida,
    // com memória de pouco mais de um ano — antes era uma soma sem escala clara,
    // e o rebanho oscilava entre bater no teto e sumir do mundo inteiro.
    const apetite = anos * PASTAGEM;
    const pasto = Math.min(mundo.comida[i], apetite);
    mundo.comida[i] -= pasto;
    const fracao = apetite > 0 ? pasto / apetite : 1;
    const memoria = Math.min(1, anos * 0.8);
    this.saciado = (this.saciado ?? 0.7) * (1 - memoria) + fracao * memoria;

    // gado em pasto cercado come do que a tribo traz; senão o rebanho domesticado
    // morre de fome preso num círculo de cinco tiles já pelado
    if (this.domesticado && this.tribo && this.tribo.temPasto) {
      this.saciado = Math.max(this.saciado, 0.72);
    }

    if (this.saciado < 0.25) {
      this.magro = (this.magro || 0) + anos;
      if (this.magro > 6) { this.viva = false; return; }
    } else this.magro = 0;

    // criação não cresce sem quem cuide: três cabeças por pessoa é o teto, e a
    // cerca é o outro — gado além do que o curral comporta viraria de novo a
    // parede branca de cento e vinte cabeças em cima da aldeia
    const t = this.domesticado ? this.tribo : null;
    const cabeExcesso = !!t && (t.cabecas > t.pop * 3
      || (t.curral && t.cabecas >= t.capacidadeCurral));
    // Bicho sozinho não se reproduz. A conta antiga só olhava a barriga, e por
    // isso três animais largados em três cantos do mapa viravam trinta em uma
    // década — cada um multiplicando sozinho. Precisa de manada: dois vizinhos
    // num raio de cinco. É o que faz o rebanho crescer onde está junto (dentro
    // do curral, por exemplo) e minguar onde ficou espalhado.
    if (this.descanso <= 0 && this.saciado > 0.5 && !cabeExcesso
        && sim.rebanhos.length < sim.tetoRebanho && sim.manadaAoRedor(this) >= 2) {
      this.descanso = 3.5 + sim.sorte() * 4;
      sim.nascerRebanho(this);
    }

    // Sendo tocado: anda atrás de quem conduz e não decide nada. Um pouco mais
    // rápido que o humano, senão fica para trás e a condução nunca termina.
    if (this.conduzido) {
      this.alvo = { x: this.conduzido.x, y: this.conduzido.y };
      mover(this, this.alvo, 1.35 * dt, mundo);
      return;
    }

    // Curral: quem é da tribo e tem cerca de pé anda dentro dela. É o que dá
    // sentido a vigiar a cerca — gado espalhado por dezesseis tiles não tem
    // volta que se ronde.
    const curral = this.domesticado && this.tribo && this.tribo.curral
      ? this.tribo.curral : null;
    if (curral && !this.tribo.dentroDoCurral(this.x, this.y)) {
      this.alvo = { x: Math.round(curral.x), y: Math.round(curral.y) };
      mover(this, this.alvo, 1.1 * dt, mundo);
      return;
    }

    // com fome, anda atrás de capim; vagar ao acaso num pasto já comido é o que
    // fazia o rebanho inteiro morrer em cima de uma mancha pelada
    if (this.saciado < 0.35 && (!this.alvo || sim.sorte() < 0.05)) {
      const cx = Math.round(this.x), cy = Math.round(this.y);
      const alcance = curral ? Math.ceil(curral.raio) : 10;
      let melhor = null, nota = 0.03;
      for (let dy = -alcance; dy <= alcance; dy += 2) {
        for (let dx = -alcance; dx <= alcance; dx += 2) {
          const x = cx + dx, y = cy + dy;
          if (!mundo.andavel(x, y)) continue;
          if (curral && !this.tribo.dentroDoCurral(x, y)) continue;
          const c = mundo.comida[mundo.idx(x, y)] - Math.hypot(dx, dy) * 0.012;
          if (c > nota) { nota = c; melhor = { x, y }; }
        }
      }
      if (melhor) this.alvo = melhor;
    }

    if (!this.alvo || Math.hypot(this.alvo.x - this.x, this.alvo.y - this.y) < 0.5) {
      // sem cerca o raio acompanha o tamanho do rebanho: preso em cinco tiles,
      // cento e vinte cabeças viram uma parede branca em cima da aldeia
      let raio = curral ? curral.raio - 0.6
        : this.domesticado && this.tribo ? Math.min(16, 3 + Math.sqrt(this.tribo.cabecas) * 1.1)
        : 9;
      let cx = curral ? curral.x : this.domesticado && this.tribo ? this.tribo.cx : this.x;
      let cy = curral ? curral.y : this.domesticado && this.tribo ? this.tribo.cy : this.y;
      // Bicho selvagem anda junto do bando. Sem isto o punhado que o jogador
      // solta se dispersa em uma década, e como manada é o que se reproduz, o
      // rebanho some do mundo sem ninguém caçar. Rebanho é rebanho: fica perto.
      if (!curral && !this.domesticado) {
        let n = 0, sx = 0, sy = 0;
        for (const o of sim.perto(this.x, this.y, 9, 'rebanhos')) {
          if (o === this || !o.viva || o.domesticado) continue;
          sx += o.x; sy += o.y; n++;
        }
        if (n) { cx = (sx / n + this.x) / 2; cy = (sy / n + this.y) / 2; raio = 5; }
      }
      for (let k = 0; k < 6; k++) {
        const a = sim.sorte() * Math.PI * 2, d = sim.sorte() * raio;
        const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
        if (mundo.andavel(x, y)) { this.alvo = { x, y }; break; }
      }
    }
    // em pânico a água deixa de ser parede: é assim que o bicho fugindo acaba
    // no rio, e é de propósito
    const passavel = this.panico > 0 ? (x, y) => mundo.andavel(x, y) || mundo.ehAgua(x, y) : null;
    if (this.alvo) mover(this, this.alvo, 1.1 * dt, mundo, passavel);
  }
}

// -------------------------------------------------------------- predadores
export class Predador {
  constructor(x, y, sorte = Math.random) {
    this.x = x; this.y = y;
    this.idade = sorte() * 3;
    this.expectativa = 12 + sorte() * 6;
    this.fome = sorte() * 0.4;
    this.alvo = null;
    this.presa = null;
    this.emperrado = 0;
    this.viva = true;
  }

  atualizar(dt, sim) {
    const anos = dt / ANO;
    this.idade += anos;
    this.fome += anos * 0.38;
    if (this.idade > this.expectativa || this.fome >= 1) { this.viva = false; return; }

    if (this.presa && !this.presa.viva) { this.presa = null; this.alvo = null; }

    if (!this.presa && this.fome > 0.42) {
      this.presa = sim.presaPerto(this.x, this.y, 12);
      // gente é o último recurso: sem esta trava a fera vira praga e limpa o
      // mundo antes de qualquer tribo existir
      if (!this.presa && this.fome > 0.72) this.presa = sim.humanoPerto(this.x, this.y, 12);
    }

    if (this.presa) {
      const d = Math.hypot(this.presa.x - this.x, this.presa.y - this.y);
      if (d < 0.8) {
        sim.abatidoPorPredador(this.presa);
        this.fome = Math.max(0, this.fome - 0.75);
        this.fartas = (this.fartas || 0) + 1;
        // só cria filhote quem está comendo bem: é o que amarra o predador à presa
        if (this.fartas >= 3 && this.idade > 2) { this.fartas = 0; sim.nascerPredador(this); }
        this.presa = null;
        // De barriga cheia a fera muda de região em vez de ficar em cima do
        // mesmo rebanho até acabar com ele.
        const a = sim.sorte() * Math.PI * 2, d = 14 + sim.sorte() * 16;
        const nx = Math.round(this.x + Math.cos(a) * d), ny = Math.round(this.y + Math.sin(a) * d);
        this.alvo = sim.mundo.andavel(nx, ny) ? { x: nx, y: ny } : null;
      } else {
        // Sem esta desistência a fera trava perseguindo presa do outro lado da
        // água: `mover` recusa o passo, ela não anda mais e morre de fome parada.
        // Era isto que extinguia o predador em toda partida, não o equilíbrio.
        // presa perseguida entra em pânico, e bicho em pânico atravessa água
        if (this.presa.panico !== undefined) this.presa.panico = 0.9;
        const antes = this.x + this.y;
        mover(this, this.presa, VEL_FERA * dt, sim.mundo);
        if (Math.abs(this.x + this.y - antes) < 1e-6) {
          if (++this.emperrado > 25) { this.presa = null; this.alvo = null; this.emperrado = 0; }
        } else this.emperrado = 0;
      }
      return;
    }

    if (!this.alvo || Math.hypot(this.alvo.x - this.x, this.alvo.y - this.y) < 0.6) {
      const evitaAldeia = this.fome < 0.6;
      for (let k = 0; k < 8; k++) {
        const a = sim.sorte() * Math.PI * 2, d = 3 + sim.sorte() * 9;
        const x = Math.round(this.x + Math.cos(a) * d), y = Math.round(this.y + Math.sin(a) * d);
        if (!sim.mundo.andavel(x, y)) continue;
        // com a barriga cheia a fera fica no mato; faminta, entra na aldeia
        if (evitaAldeia && sim.mundo.dono[sim.mundo.idx(x, y)] !== -1 && k < 6) continue;
        this.alvo = { x, y };
        break;
      }
    }
    if (this.alvo) mover(this, this.alvo, VEL_FERA * 0.5 * dt, sim.mundo);
  }
}

/** `passavel` decide o que é chão para este bicho. Peixe e jacaré andam onde o
 *  resto se afoga, e bicho em pânico entra na água que normalmente recusa. */
function mover(ag, alvo, passo, mundo, passavel = null) {
  const dx = alvo.x - ag.x, dy = alvo.y - ag.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-4) return;
  const nx = ag.x + (dx / d) * passo, ny = ag.y + (dy / d) * passo;
  const ok = passavel ? passavel(Math.round(nx), Math.round(ny)) : mundo.andavel(Math.round(nx), Math.round(ny));
  if (ok) { ag.x = nx; ag.y = ny; }
  else ag.alvo = null;
}

const naAgua = (mundo) => (x, y) => mundo.ehAgua(x, y);

// ------------------------------------------------------------------- água
const VEL_PEIXE = 1.6;
/** Quanto plâncton um peixe come por ano. Baixo de propósito: peixe voraz
 *  raspa o mar e o cardume desaba junto, o mesmo colapso da fera com a presa. */
const PLANCTON = 0.12;
const VEL_JACARE = 2.6;

/**
 * Peixe. Existe para dar à água o que a terra tem: uma cadeia. Sem ele a água
 * era só um lugar por onde não se anda, e uma tribo na costa não tinha nada a
 * ganhar por estar ali.
 */
export class Peixe {
  constructor(x, y, sorte = Math.random) {
    this.x = x; this.y = y;
    this.idade = sorte() * 3;
    this.expectativa = 6 + sorte() * 5;
    this.descanso = 1 + sorte() * 2;
    this.alvo = null;
    this.viva = true;
  }

  atualizar(dt, sim) {
    const anos = dt / ANO;
    this.idade += anos;
    this.descanso = Math.max(0, this.descanso - anos);
    if (this.idade > this.expectativa) { this.viva = false; return; }

    const { mundo } = sim;
    const i = mundo.idx(Math.round(this.x), Math.round(this.y));
    // come plâncton do tile, mesma mecânica do pasto em terra
    const apetite = anos * PLANCTON;
    const comeu = Math.min(mundo.comida[i], apetite);
    mundo.comida[i] -= comeu;
    const fracao = apetite > 0 ? comeu / apetite : 1;
    const memoria = Math.min(1, anos * 0.8);
    this.saciado = (this.saciado ?? 0.7) * (1 - memoria) + fracao * memoria;
    if (this.saciado < 0.25) {
      this.magro = (this.magro || 0) + anos;
      if (this.magro > 4) { this.viva = false; return; }
    } else this.magro = 0;

    // Peixe solto não desova, mesma regra da manada em terra: cardume é o que
    // se multiplica. Sem isso um peixe perdido num poço enche o mapa sozinho.
    if (this.descanso <= 0 && this.saciado > 0.5 && sim.peixes.length < sim.tetoPeixe
        && sim.cardumeAoRedor(this) >= 2) {
      this.descanso = 2.4 + sim.sorte() * 2.6;
      sim.nascerPeixe(this);
    }

    if (!this.alvo || Math.hypot(this.alvo.x - this.x, this.alvo.y - this.y) < 0.5) {
      // nada junto do cardume, e só onde há água
      let n = 0, sx = 0, sy = 0;
      for (const o of sim.peixes) {
        if (o === this || !o.viva) continue;
        if (Math.hypot(o.x - this.x, o.y - this.y) > 7) continue;
        sx += o.x; sy += o.y; n++;
        if (n > 8) break;
      }
      const cx = n ? (sx / n + this.x) / 2 : this.x;
      const cy = n ? (sy / n + this.y) / 2 : this.y;
      // com fome o cardume se desfaz e cada um procura água farta: é o que
      // espalha o peixe em vez de deixá-lo morrer em cima de um trecho raspado
      const largura = this.saciado < 0.4 ? 9 : (n ? 4 : 7);
      let melhorNota = -1;
      for (let k = 0; k < 8; k++) {
        const a = sim.sorte() * Math.PI * 2, d = sim.sorte() * largura;
        const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
        if (!mundo.ehAgua(x, y)) continue;
        const nota = mundo.comida[mundo.idx(x, y)];
        if (nota > melhorNota) { melhorNota = nota; this.alvo = { x, y }; }
      }
    }
    if (this.alvo) mover(this, this.alvo, VEL_PEIXE * dt, mundo, naAgua(mundo));
  }
}

/**
 * Jacaré. Predador de água: vive de peixe e pega o que cair lá dentro. É o que
 * transforma "entrar na água" numa decisão com preço, em vez de num lugar
 * aonde simplesmente não se vai.
 */
export class Jacare {
  constructor(x, y, sorte = Math.random) {
    this.x = x; this.y = y;
    this.idade = sorte() * 3;
    this.expectativa = 16 + sorte() * 8;
    // metabolismo lento de propósito: jacaré que precisa comer toda hora limpa
    // o cardume e morre junto, o mesmo colapso que a fera de terra já deu
    this.fome = sorte() * 0.4;
    this.alvo = null;
    this.presa = null;
    this.fartas = 0;
    this.viva = true;
  }

  atualizar(dt, sim) {
    const anos = dt / ANO;
    this.idade += anos;
    // Metabolismo de jacaré: oito anos até a fome matar. Com 0,22 ao ano ele
    // tinha quatro anos e meio, e como o cardume anda junto — deixando quase
    // todo o mar vazio — o que estivesse longe do cardume morria antes de
    // achá-lo. Extinção no ano 104, toda partida.
    this.fome += anos * 0.12;
    if (this.idade > this.expectativa || this.fome >= 1) { this.viva = false; return; }

    const { mundo } = sim;
    if (this.presa && !this.presa.viva) { this.presa = null; this.alvo = null; }

    if (!this.presa && this.fome > 0.35) {
      // o que caiu na água vem antes do peixe: é a refeição grande
      this.presa = sim.afogadoPerto(this.x, this.y, 7) || sim.peixePerto(this.x, this.y, 16);
    }

    if (this.presa) {
      const d = Math.hypot(this.presa.x - this.x, this.presa.y - this.y);
      if (d < 0.9) {
        const grande = this.presa instanceof Peixe ? 0 : 1;
        sim.abatidoNaAgua(this.presa);
        this.fome = Math.max(0, this.fome - (grande ? 0.85 : 0.4));
        this.fartas += grande ? 2 : 1;
        // Três refeições, não cinco. Uma delas sustenta o jacaré por três anos,
        // então cinco eram dezesseis anos — quase a vida inteira dele — e a
        // espécie vivia de dois ou três indivíduos, morrendo por azar.
        if (this.fartas >= 3 && this.idade > 3) { this.fartas = 0; sim.nascerJacare(this); }
        this.presa = null;
      } else {
        const antes = this.x + this.y;
        mover(this, this.presa, VEL_JACARE * dt, mundo, naAgua(mundo));
        // presa em terra firme: o jacaré não sai atrás, desiste
        if (Math.abs(this.x + this.y - antes) < 1e-6) { this.presa = null; this.alvo = null; }
      }
      return;
    }

    if (!this.alvo || Math.hypot(this.alvo.x - this.x, this.alvo.y - this.y) < 0.6) {
      for (let k = 0; k < 8; k++) {
        const a = sim.sorte() * Math.PI * 2, d = 2 + sim.sorte() * 7;
        const x = Math.round(this.x + Math.cos(a) * d), y = Math.round(this.y + Math.sin(a) * d);
        if (mundo.ehAgua(x, y)) { this.alvo = { x, y }; break; }
      }
    }
    if (this.alvo) mover(this, this.alvo, VEL_JACARE * 0.45 * dt, mundo, naAgua(mundo));
  }
}

export { OBRA };
