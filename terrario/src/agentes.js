// Humanos, rebanhos e predadores.
//
// Nenhum agente sabe o que é "civilização". Cada um só resolve a próxima
// necessidade com o que tem por perto. Plantio, pecuária, mineração e guerra
// aparecem porque a opção mais barata muda conforme o jogador mexe no mundo —
// é essa a peça que precisa ficar de pé, não a lista de tarefas.

import { T, TERRENOS } from './mundo.js';
import { rende } from './tribos.js';

/** Um ano de mundo em segundos de simulação. Toda taxa abaixo é por ano. */
export const ANO = 4;

const VEL = 2.4;                 // tiles por segundo de simulação
// A fera precisa ser mais rápida que a presa E que o humano. Com 1,9 ela era
// mais lenta que os dois e morria de fome perseguindo o almoço a pé.
const VEL_FERA = 3.4;
// O herbívoro existe para ser caçado e domesticado. Apetite alto o transforma
// em concorrente do forrageio humano, e aí ele mata os bandos de fome.
const PASTAGEM = 0.12;
const MAIORIDADE = 15;
const FOME_POR_ANO = 0.52;
const FOME_CRITICA = 0.55;       // acima disto largar tudo e comer
const RAIO_BUSCA = 11;

/** Trabalhos: duração em anos e o que rendem. */
const OBRA = {
  forragear: { dur: 0.22 },
  colher:    { dur: 0.18, rende: 2.4 },
  pastorear: { dur: 0.26, rende: 1.7 },
  cacar:     { dur: 0.45 },
  arar:      { dur: 0.45 },
  cercar:    { dur: 0.5 },
  minerar:   { dur: 0.4, minerio: 2.2 },
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
    this.viva = true;
    this.causa = null;
  }

  get adulto() { return this.idade >= MAIORIDADE; }

  morrer(causa) { this.viva = false; this.causa = causa; }

  atualizar(dt, sim) {
    const anos = dt / ANO;
    this.idade += anos;
    this.fome += anos * FOME_POR_ANO * (this.adulto ? 1 : 0.6);
    this.descanso = Math.max(0, this.descanso - anos);

    if (this.idade > this.expectativa) return this.morrer('velhice');
    if (this.fome >= 1) return this.morrer('fome');

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

    // 2. guerra na fronteira tem precedência sobre obra
    if (this.adulto && this.inimigoPerto(sim)) {
      this.alvo = { x: this.x, y: this.y, obra: 'lutar' };
      return;
    }

    if (this.adulto) {
      // 3. as três viradas de chave, mesmo com a tribo pobre
      if (!t.temPlantacao && t.pop >= 2 && this.acharFertil(sim)) { this.alvo.obra = 'arar'; return; }
      if (!t.temPasto && t.rebanhosProximos >= 3 && this.acharPastagem(sim)) { this.alvo.obra = 'cercar'; return; }
      if (!t.temMina && t.pop >= 5 && !t.faminta && this.acharVeio(sim)) { this.alvo.obra = 'minerar'; return; }
    }

    // 4. celeiro baixo: trabalhar comida
    if (t.porHabitante < 3.6 && this.buscarComida(sim)) return;

    // 5. uma roça por pessoa é a meta; abrir lavoura não espera a tribo engordar
    if (this.adulto && t.temPlantacao && t.plantios < t.pop
        && sim.sorte() < 0.5 * rende(this, 'arar')
        && this.acharFertil(sim)) { this.alvo.obra = 'arar'; return; }

    if (this.adulto && !t.faminta) {
      if (t.temMina && sim.sorte() < 0.35 * rende(this, 'minerar') && this.acharVeio(sim)) { this.alvo.obra = 'minerar'; return; }
      if (t.ocas.length < Math.ceil(t.pop / 3) && sim.sorte() < 0.3 * rende(this, 'construir')) {
        const s = sim.sitioDeOca(t);
        if (s) { this.alvo = { x: s.x, y: s.y, obra: 'construir' }; return; }
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

  /** Comida na ordem do que rende mais por viagem. */
  buscarComida(sim) {
    const { mundo } = sim;
    const t = this.tribo;
    if (t) {
      if (t.temPlantacao && this.acharTile(sim, (i) => mundo.terreno[i] === T.PLANTACAO && mundo.crescer[i] >= 1, true)) {
        this.alvo.obra = 'colher';
        return true;
      }
      if (t.cabecas > 0 && t.temPasto && this.acharTile(sim, (i) => mundo.terreno[i] === T.PASTO, true)) {
        this.alvo.obra = 'pastorear';
        return true;
      }
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
    const presa = sim.presaPerto(this.x, this.y, RAIO_BUSCA + 4);
    if (presa) {
      this.alvo = { x: presa.x, y: presa.y, obra: 'cacar', presa };
      return true;
    }
    return false;
  }

  /** Varre um quadrado ao redor e guarda o melhor tile. Roda só ao trocar de tarefa. */
  acharTile(sim, aceita, dentroDoTerritorio) {
    const { mundo } = sim;
    const t = this.tribo;
    const cx = Math.round(this.x), cy = Math.round(this.y);
    let melhor = null, melhorCusto = Infinity;
    for (let dy = -RAIO_BUSCA; dy <= RAIO_BUSCA; dy++) {
      for (let dx = -RAIO_BUSCA; dx <= RAIO_BUSCA; dx++) {
        const x = cx + dx, y = cy + dy;
        if (!mundo.dentro(x, y)) continue;
        const i = mundo.idx(x, y);
        if (!TERRENOS[mundo.terreno[i]].andavel) continue;
        if (dentroDoTerritorio && t && mundo.dono[i] !== t.id) continue;
        if (!aceita(i)) continue;
        const custo = dx * dx + dy * dy;
        if (custo < melhorCusto) { melhorCusto = custo; melhor = { x, y }; }
      }
    }
    if (!melhor) return false;
    this.alvo = { x: melhor.x, y: melhor.y, obra: null };
    return true;
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

    // dentro de território com pasto, o bicho vira criação
    if (!this.domesticado && mundo.dono[i] !== -1) {
      const t = sim.tribo(mundo.dono[i]);
      if (t && t.temPasto) {
        this.domesticado = true;
        this.tribo = t;
        t.cabecas++;
        sim.cronica(`${t.nome} domestica o primeiro rebanho`, t, 'pecuaria', true);
      }
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

    if (this.descanso <= 0 && this.saciado > 0.5 && sim.rebanhos.length < sim.tetoRebanho) {
      this.descanso = 2.5 + sim.sorte() * 3;
      sim.nascerRebanho(this);
    }

    // com fome, anda atrás de capim; vagar ao acaso num pasto já comido é o que
    // fazia o rebanho inteiro morrer em cima de uma mancha pelada
    if (this.saciado < 0.35 && (!this.alvo || sim.sorte() < 0.05)) {
      const cx = Math.round(this.x), cy = Math.round(this.y);
      let melhor = null, nota = 0.03;
      for (let dy = -10; dy <= 10; dy += 2) {
        for (let dx = -10; dx <= 10; dx += 2) {
          const x = cx + dx, y = cy + dy;
          if (!mundo.andavel(x, y)) continue;
          const c = mundo.comida[mundo.idx(x, y)] - Math.hypot(dx, dy) * 0.012;
          if (c > nota) { nota = c; melhor = { x, y }; }
        }
      }
      if (melhor) this.alvo = melhor;
    }

    if (!this.alvo || Math.hypot(this.alvo.x - this.x, this.alvo.y - this.y) < 0.5) {
      const ancora = this.domesticado && this.tribo ? this.tribo : this;
      const raio = this.domesticado ? 5 : 9;
      for (let k = 0; k < 6; k++) {
        const a = sim.sorte() * Math.PI * 2, d = sim.sorte() * raio;
        const cx = this.domesticado && this.tribo ? this.tribo.cx : this.x;
        const cy = this.domesticado && this.tribo ? this.tribo.cy : this.y;
        const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
        if (mundo.andavel(x, y)) { this.alvo = { x, y }; break; }
      }
      void ancora;
    }
    if (this.alvo) mover(this, this.alvo, 1.1 * dt, mundo);
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
        this.alvo = null;
      } else {
        // Sem esta desistência a fera trava perseguindo presa do outro lado da
        // água: `mover` recusa o passo, ela não anda mais e morre de fome parada.
        // Era isto que extinguia o predador em toda partida, não o equilíbrio.
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

function mover(ag, alvo, passo, mundo) {
  const dx = alvo.x - ag.x, dy = alvo.y - ag.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-4) return;
  const nx = ag.x + (dx / d) * passo, ny = ag.y + (dy / d) * passo;
  if (mundo.andavel(Math.round(nx), Math.round(ny))) { ag.x = nx; ag.y = ny; }
  else ag.alvo = null;
}

export { OBRA };
