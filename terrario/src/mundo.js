// A grade. Tudo do mundo mora em arrays tipados indexados por tile: é o que
// permite rodar milhares de tiles e centenas de agentes por tique no celular
// sem alocar nada durante a simulação.

export const N = 80;                 // lado da grade
export const TILE = 1;               // metros por tile
export const NIVEL_MAR = 0.28;
/** Segundos de simulação entre duas passadas de clima e vegetação. */
const PASSO_ECO = 0.5;

export const T = {
  AGUA: 0, AREIA: 1, GRAMA: 2, FERTIL: 3, FLORESTA: 4,
  ROCHA: 5, MONTANHA: 6, PLANTACAO: 7, PASTO: 8, TERRA: 9,
  BROTO: 10,
};

/** O que pega fogo, e com que facilidade. Zero não queima. */
export const INFLAMAVEL = {
  [T.FLORESTA]: 1, [T.BROTO]: 0.75, [T.PLANTACAO]: 0.7, [T.GRAMA]: 0.42, [T.PASTO]: 0.36,
};

/** Nome, cor e regras de cada terreno. A cor é o que o jogador lê no mapa. */
export const TERRENOS = {
  // A água tem forragem: é o plâncton, e é o que segura o cardume. Sem um
  // recurso finito na água o peixe só encontrava o teto do código — 57 viravam
  // 600 em vinte anos e ficavam lá. Terra firme não alcança: `acharTile` recusa
  // tile não andável, então isto não vira comida de graça para quem anda.
  [T.AGUA]:      { nome: 'Água',        cor: 0x2f5f7a, andavel: false, forragem: 0.12 },
  [T.AREIA]:     { nome: 'Areia',       cor: 0xc9b98a, andavel: true,  forragem: 0.02 },
  [T.GRAMA]:     { nome: 'Campo',       cor: 0x6f8f4a, andavel: true,  forragem: 0.22 },
  [T.FERTIL]:    { nome: 'Terra fértil',cor: 0x6b5334, andavel: true,  forragem: 0.26 },
  [T.FLORESTA]:  { nome: 'Floresta',    cor: 0x3f6135, andavel: true,  forragem: 0.55 },
  [T.ROCHA]:     { nome: 'Rocha',       cor: 0x7d7a72, andavel: true,  forragem: 0.01 },
  [T.MONTANHA]:  { nome: 'Montanha',    cor: 0x8e8b84, andavel: false, forragem: 0.00 },
  [T.PLANTACAO]: { nome: 'Plantação',   cor: 0xb99a3e, andavel: true,  forragem: 0.06 },
  [T.PASTO]:     { nome: 'Pasto',       cor: 0x87a054, andavel: true,  forragem: 0.28 },
  // terra nua: onde o mundo pelado começa. Quase não alimenta ninguém.
  [T.TERRA]:     { nome: 'Terra nua',   cor: 0x7a6647, andavel: true,  forragem: 0.03 },
  // Broto é floresta que ainda não é. Vira mata se a umidade deixar, e morre de
  // sede se não deixar — é o que faz plantar semente em terra seca não dar nada.
  [T.BROTO]:     { nome: 'Broto',       cor: 0x6f8f52, andavel: true,  forragem: 0.16 },
};

export class Mundo {
  constructor(semente = 1, pelado = false) {
    this.n = N;
    const t = N * N;
    this.terreno   = new Uint8Array(t);
    this.altura    = new Float32Array(t);
    this.comida    = new Float32Array(t);   // forragem disponível, 0..1
    this.crescer   = new Float32Array(t);   // maturação da plantação, 0..1
    this.dono      = new Int16Array(t).fill(-1);
    this.minerio   = new Uint8Array(t);     // 0..3, riqueza do veio
    this.base      = new Uint8Array(t);     // terreno original, para onde a terra volta
    this.vigor     = new Float32Array(t).fill(1); // fertilidade restante, 0..1
    this.madeira   = new Float32Array(t);   // lenha em pé, 0..1, só em floresta
    this.desmatados = new Set();            // tiles derrubados, esperando rebrotar
    this.sujo      = new Set();             // tiles que o render precisa refazer

    // ---------- clima e solo ----------
    this.umidade   = new Float32Array(t);   // água no chão agora, 0..1
    this.umidadeBase = new Float32Array(t); // para onde ela volta sem chuva
    this.nutriente = new Float32Array(t);   // esterco e cinza, 0..1
    this.fogo      = new Float32Array(t);   // quanto já queimou deste tile, 0..1
    this.queimando = new Set();
    this.nuvens    = [];                    // {x, y, dx, dy, raio, vida}
    this.relogioEco = 0;
    this.aguaMudou = true;                  // pede recálculo da umidade de base
    this.chuvaCaida = 0;                    // tiles-ano de chuva, só para relatório
    this.tilesQueimados = 0;
    this.tilesDeMata = 0;                   // contagem viva; `censo()` é caro
    this.raios = [];                        // raios deste passo, a simulação drena

    this.gerar(semente, pelado);
    this.recalcularUmidade();
    this.umidade.set(this.umidadeBase);
  }

  idx(x, y) { return y * N + x; }
  dentro(x, y) { return x >= 0 && y >= 0 && x < N && y < N; }

  /** Marca o tile para o render redesenhar. */
  tocar(i) { this.sujo.add(i); }

  definir(i, tipo) {
    if (this.terreno[i] === tipo) return;
    const antes = this.terreno[i];
    this.terreno[i] = tipo;
    if (tipo === T.FLORESTA) { this.madeira[i] = 1; this.desmatados.delete(i); this.tilesDeMata++; }
    if (antes === T.FLORESTA) this.tilesDeMata--;
    this.comida[i] = TERRENOS[tipo].forragem;
    // broto usa `crescer` como o quanto já cresceu rumo à mata; plantação usa
    // como maturação. São o mesmo campo, e nenhum outro terreno o usa — em
    // ambos os casos ele começa do zero, que é o que esta linha faz.
    if (tipo !== T.PLANTACAO) this.crescer[i] = 0;
    // água entrando ou saindo muda a umidade de base do mapa inteiro
    if (tipo === T.AGUA || antes === T.AGUA) this.aguaMudou = true;
    if (this.fogo[i]) { this.fogo[i] = 0; this.queimando.delete(i); }
    this.altura[i] = this.alturaDe(i, tipo);
    this.tocar(i);
  }

  alturaDe(i, tipo) {
    const base = this.relevo[i];
    if (tipo === T.MONTANHA) return base + 1.6;
    if (tipo === T.ROCHA) return base + 0.45;
    // O leito acompanha o relevo em vez de cair para o fundo do mar. Antes um
    // lago pintado no alto de um planalto virava um poço quadrado de meio metro
    // com parede azul — o "bloco vazio". Agora é uma depressão rasa, e a lâmina
    // d'água (desenhada à parte) fica quase no nível da terra em volta.
    if (tipo === T.AGUA) return base - 0.30;
    return base;
  }

  /**
   * Altura da lâmina d'água neste tile. Sai do relevo cru, não da altura já
   * rebaixada do leito: é isso que faz o lago encostar na margem em vez de
   * ficar no fundo de um buraco.
   */
  superficieDaAgua(i) { return this.relevo[i] - 0.07; }

  ehAgua(x, y) { return this.dentro(x, y) && this.terreno[this.idx(x, y)] === T.AGUA; }

  /** Tem água encostada neste tile? É o que define margem — onde se pesca e
   *  onde o jacaré alcança. */
  naMargem(x, y) {
    return this.ehAgua(x + 1, y) || this.ehAgua(x - 1, y)
        || this.ehAgua(x, y + 1) || this.ehAgua(x, y - 1);
  }

  /**
   * Ruído de valor com oitavas, em [0,1]². Dois campos independentes: relevo e
   * umidade. Antes eu deslocava a amostra somando ao tile antes de dividir por N,
   * o que jogava a coordenada para fora de [0,1] — o clamp achatava a umidade
   * numa constante e o mundo nascia sem um único tile de terra fértil.
   */
  campoDeRuido(semente) {
    const r = mulberry(semente);
    const oitavas = [];
    for (let o = 0; o < 4; o++) {
      const lado = 4 << o;
      const g = new Float32Array((lado + 1) * (lado + 1));
      for (let k = 0; k < g.length; k++) g[k] = r();
      oitavas.push({ lado, g });
    }
    return (nx, ny) => {
      nx = Math.min(0.9999, Math.max(0, nx));
      ny = Math.min(0.9999, Math.max(0, ny));
      let v = 0, amp = 1, soma = 0;
      for (const { lado, g } of oitavas) {
        const fx = nx * lado, fy = ny * lado;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = suave(fx - x0), ty = suave(fy - y0);
        const at = (x, y) => g[y * (lado + 1) + x];
        const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
        const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
        v += (a + (b - a) * ty) * amp;
        soma += amp;
        amp *= 0.5;
      }
      return v / soma;
    };
  }

  /**
   * @param pelado Só relevo, areia e pedra: sem mata, sem terra fértil e sem
   *   veio de minério. É o mundo em que a natureza também é obra do jogador.
   */
  gerar(semente, pelado = false) {
    const r = mulberry(semente ^ 0x5f3a);
    const relevoDe = this.campoDeRuido(semente);
    const umidadeDe = this.campoDeRuido(semente * 7919 + 13);

    this.relevo = new Float32Array(N * N);
    // guardado: é ele que decidiu onde nasceu mata e onde nasceu campo, e a
    // umidade de base tem que concordar com isso. Na primeira versão a umidade
    // saía só da distância até a água, discordava do mapa gerado e "corrigia"
    // o mundo inteiro: 2055 tiles de mata viravam 389 em vinte anos.
    this.ruidoUmidade = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = this.idx(x, y);
        // afunda as bordas para o mundo virar uma ilha, e não uma laje cortada
        const bx = Math.min(x, N - 1 - x) / (N * 0.5);
        const by = Math.min(y, N - 1 - y) / (N * 0.5);
        const borda = Math.min(1, Math.min(bx, by) * 3.2);
        const h = relevoDe(x / N, y / N) * borda;
        this.relevo[i] = h * 2.4;

        // o ruído é uma média de uniformes: fica apertado em torno de 0,5, então
        // os cortes de bioma têm que ser apertados também
        const umid = umidadeDe(x / N, y / N);
        this.ruidoUmidade[i] = umid;
        let tipo;
        if (h < NIVEL_MAR) tipo = T.AGUA;
        else if (h < NIVEL_MAR + 0.045) tipo = T.AREIA;
        else if (h > 0.74) tipo = T.MONTANHA;
        else if (h > 0.66) tipo = T.ROCHA;
        else if (pelado) tipo = T.TERRA;
        else if (umid > 0.56) tipo = T.FLORESTA;
        else if (umid > 0.46) tipo = T.FERTIL;
        else tipo = T.GRAMA;

        this.terreno[i] = tipo;
        this.base[i] = tipo;
        if (tipo === T.FLORESTA) { this.madeira[i] = 1; this.tilesDeMata++; }
        this.comida[i] = TERRENOS[tipo].forragem;
        this.altura[i] = this.alturaDe(i, tipo);
        if (!pelado && (tipo === T.MONTANHA || tipo === T.ROCHA) && r() > 0.55) {
          this.minerio[i] = 1 + Math.floor(r() * 3);
        }
      }
    }
  }

  andavel(x, y) {
    if (!this.dentro(x, y)) return false;
    return TERRENOS[this.terreno[this.idx(x, y)]].andavel;
  }

  /**
   * Umidade de base: distância até a água mais próxima. Uma varredura em
   * largura a partir de todo tile de água — 6400 tiles, e só quando o mapa de
   * água muda, que é evento raro. É esta a conta que faz a beira do rio ser
   * verde e o meio do platô ser seco, sem eu precisar pintar nada disso.
   */
  recalcularUmidade() {
    const t = N * N;
    const dist = new Int16Array(t).fill(-1);
    const fila = new Int32Array(t);
    let cabeca = 0, cauda = 0;
    for (let i = 0; i < t; i++) if (this.terreno[i] === T.AGUA) { dist[i] = 0; fila[cauda++] = i; }
    while (cabeca < cauda) {
      const i = fila[cabeca++];
      const x = i % N, y = (i / N) | 0, d = dist[i];
      if (d >= 22) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.dentro(nx, ny)) continue;
        const j = this.idx(nx, ny);
        if (dist[j] !== -1) continue;
        dist[j] = d + 1;
        fila[cauda++] = j;
      }
    }
    for (let i = 0; i < t; i++) {
      const d = dist[i] === -1 ? 24 : dist[i];
      // Três parcelas: o clima do lugar (o mesmo ruído que desenhou os biomas),
      // a água por perto, e o desconto do alto — montanha é seca mesmo com água
      // ao pé, porque o que escorre não fica.
      const perto = Math.max(0, 1 - d / 12) * 0.35;
      // `relevo` vai de 0 a 2,4, não de 0 a 1 — descontar a partir de 0,55
      // punia o planalto inteiro e deixava a ilha toda com umidade 0,04, o
      // chão do clamp. Semente plantada no meio do mapa morria de sede sempre.
      const alto = Math.min(0.4, Math.max(0, this.relevo[i] - 1.35) * 0.5);
      this.umidadeBase[i] = Math.max(0.04, Math.min(1, 0.18 + this.ruidoUmidade[i] * 0.95 + perto - alto));
    }
    this.aguaMudou = false;
  }

  /** Uma chuva. `forca` é quanto de umidade ela entrega por ano no centro. */
  chover(x, y, raio = 7, vida = 3, forca = 0.9) {
    this.nuvens.push({ x, y, dx: 0, dy: 0, raio, vida, forca });
  }

  /**
   * Clima, vegetação e fogo. Roda em passo próprio, não a cada tique: são três
   * varreduras de 6400 tiles, e a 12 tiques por segundo isso é dinheiro jogado
   * fora — o mato não cresce mais rápido por ser olhado mais vezes.
   */
  ecologia(dt, sorte) {
    this.relogioEco += dt;
    if (this.relogioEco < PASSO_ECO) return;
    const passo = this.relogioEco;
    this.relogioEco = 0;
    const anos = passo / 4;                  // ANO vale 4 s; agentes.js manda nisso
    if (this.aguaMudou) this.recalcularUmidade();

    // A forragem e a maturação vinham num laço por TIQUE sobre os 6400 tiles —
    // 460 milhões de visitas numa varredura de trezentos anos, para um mato que
    // não cresce mais rápido por ser olhado mais vezes. Entram aqui, no mesmo
    // passo do clima, com o dt acumulado: o resultado é o mesmo e custa 8× menos.
    this.crescerTudo(passo);
    this.moverNuvens(passo, anos, sorte);
    this.assentarUmidade(anos);
    this.espalharVegetacao(anos, sorte);
    this.arderFogo(anos, sorte);
  }

  /** Nuvens andam, molham e se desfazem; de vez em quando nasce uma nova. */
  moverNuvens(passo, anos, sorte) {
    // uma frente a cada poucos anos, entrando pela borda e atravessando o mapa
    if (sorte() < anos * 0.55 && this.nuvens.length < 5) {
      const borda = (sorte() * 4) | 0;
      const p = sorte() * N;
      const ang = sorte() * Math.PI * 2;
      this.nuvens.push({
        x: borda === 0 ? 0 : borda === 1 ? N : p,
        y: borda === 2 ? 0 : borda === 3 ? N : p,
        dx: Math.cos(ang) * 2.6, dy: Math.sin(ang) * 2.6,
        raio: 6 + sorte() * 9, vida: 4 + sorte() * 7, forca: 0.5 + sorte() * 0.7,
      });
    }
    for (const n of this.nuvens) {
      n.x += n.dx * passo * 0.25;
      n.y += n.dy * passo * 0.25;
      n.vida -= anos;
      const r = Math.ceil(n.raio);
      const cx = Math.round(n.x), cy = Math.round(n.y);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > n.raio * n.raio) continue;
          const x = cx + dx, y = cy + dy;
          if (!this.dentro(x, y)) continue;
          const i = this.idx(x, y);
          const peso = 1 - Math.sqrt(d2) / n.raio;
          this.umidade[i] = Math.min(1, this.umidade[i] + anos * n.forca * peso);
          this.chuvaCaida += anos * peso * 0.001;
          // chuva apaga fogo, e é a única coisa que apaga
          if (this.fogo[i] > 0) {
            this.fogo[i] -= anos * n.forca * peso * 2.2;
            if (this.fogo[i] <= 0) { this.fogo[i] = 0; this.queimando.delete(i); this.tocar(i); }
          }
        }
      }
    }
    this.nuvens = this.nuvens.filter((n) => n.vida > 0 && n.x > -20 && n.y > -20 && n.x < N + 20 && n.y < N + 20);
  }

  /** Sem chuva a umidade volta para a de base, que é a distância até a água. */
  assentarUmidade(anos) {
    const t = N * N;
    const f = Math.min(1, anos * 0.55);
    // Décadas secas e décadas chuvosas. Sem isto a umidade de base é constante,
    // nada nunca seca e o verde só sabe avançar — o mapa fica sendo um desenho
    // parado outra vez, só que mais verde.
    this.faseClima = (this.faseClima || 0) + anos * 0.09;
    this.clima = 0.86 + Math.sin(this.faseClima) * 0.16 + Math.sin(this.faseClima * 2.7) * 0.06;
    for (let i = 0; i < t; i++) {
      const alvo = this.umidadeBase[i] * this.clima;
      this.umidade[i] += (alvo - this.umidade[i]) * f;
      if (this.nutriente[i] > 0) this.nutriente[i] = Math.max(0, this.nutriente[i] - anos * 0.03);
    }
  }

  /**
   * A vegetação anda sozinha, e quem manda é a umidade.
   *
   * Broto vira mata se beber, e morre de sede se não beber — é o que faz
   * plantar semente em terra seca não dar nada e plantar na beira do rio dar
   * floresta. Campo avança para a terra nua onde há água e esterco, e recua
   * para terra nua onde secou. Campo muito regado e muito adubado vira terra
   * fértil: é assim que o rebanho melhora a terra em vez de só comê-la.
   */
  espalharVegetacao(anos, sorte) {
    const t = N * N;
    for (let i = 0; i < t; i++) {
      const tipo = this.terreno[i];
      const u = this.umidade[i];
      const nut = this.nutriente[i];

      if (tipo === T.BROTO) {
        // cresce com o que bebe; abaixo de 0,3 não cresce, abaixo de 0,18 morre
        this.crescer[i] += anos * (u - 0.30) * 0.55 * (1 + nut);
        if (this.crescer[i] >= 1) { this.definir(i, T.FLORESTA); continue; }
        if (this.crescer[i] < -0.6) { this.definir(i, T.TERRA); continue; }
        continue;
      }

      // Só terra nua vira campo. Areia não: praia é praia por causa do mar, não
      // por seca, e deixar a grama comê-la apagava as trezentas praias da ilha.
      if (tipo === T.TERRA) {
        // só avança se houver verde encostado para semear, e se houver água
        if (u < 0.42 || sorte() > anos * (0.35 + nut * 0.9)) continue;
        if (this.vizinhoVerde(i)) this.definir(i, T.GRAMA);
        continue;
      }

      if (tipo === T.GRAMA || tipo === T.PASTO) {
        if (u < 0.22 && sorte() < anos * 0.30) { this.definir(i, T.TERRA); continue; }
        // Semente que veio de longe: em campo bem molhado nasce broto sozinho,
        // sem precisar de mata vizinha. É o piso do mundo — sem ele, uma tribo
        // que derrubasse a última árvore deixava o mapa sem floresta para
        // sempre, e "ecossistema que se autonutre" deixa de ser verdade.
        // A taxa é minúscula e tem que ser: a 0,0045 por ano isto plantava nove
        // brotos por ano no mapa inteiro, cobria a ilha de mata, dobrava a
        // população e apagava o fogo do jogo — nada mais secava o bastante para
        // pegar. É rede de segurança, não semeadura.
        // Sucessão: quanto menos mata há no mundo, mais fácil um campo molhado
        // brotar. Com mata de sobra é um fio de água; num mapa raspado é a
        // única volta possível — e sem ela a semente 5 terminava trezentos anos
        // com 400 pessoas e ZERO floresta, sem caminho de retorno.
        const carencia = Math.max(0, 1 - this.tilesDeMata / 400);
        if (tipo === T.GRAMA && u > 0.68 && sorte() < anos * (0.0006 + 0.0045 * carencia)) {
          this.definir(i, T.BROTO);
          continue;
        }
        // esterco e chuva engordam o campo até virar terra de plantar
        if (tipo === T.GRAMA && u > 0.62 && nut > 0.45 && sorte() < anos * 0.22) {
          this.base[i] = T.FERTIL;
          this.vigor[i] = 1;
          this.definir(i, T.FERTIL);
        }
        continue;
      }

      if (tipo === T.FERTIL && u < 0.26 && sorte() < anos * 0.22) { this.definir(i, T.GRAMA); continue; }
      if (tipo === T.FLORESTA) {
        if (u < 0.20 && sorte() < anos * 0.18) { this.definir(i, T.GRAMA); continue; }
        // A mata semeia sozinha o vizinho, se ele estiver úmido. É devagar de
        // propósito: é uma frente que avança em décadas. Sem isto a floresta só
        // sabia encolher — a semente 5 terminava trezentos anos com novecentas
        // pessoas vivas e ZERO tiles de mata, sem volta possível, porque a
        // rebrota exige mata vizinha e não havia mais nenhuma.
        if (u > 0.55 && sorte() < anos * 0.045) {
          const x = i % N, y = (i / N) | 0;
          const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][(sorte() * 4) | 0];
          if (!this.dentro(x + dx, y + dy)) continue;
          const j = this.idx(x + dx, y + dy);
          const vz = this.terreno[j];
          if ((vz === T.GRAMA || vz === T.TERRA) && this.umidade[j] > 0.5) this.definir(j, T.BROTO);
        }
      }
    }
  }

  /** Quantos tiles de cada terreno. Caro: 6400 posições. Chame para relatório,
   *  nunca por tique — contar isto dentro de `resumo()` custou trinta segundos
   *  numa varredura de trezentos anos que levava seis. */
  censo() {
    const c = {};
    for (const tipo of this.terreno) c[tipo] = (c[tipo] || 0) + 1;
    return c;
  }

  vizinhoVerde(i) {
    const x = i % N, y = (i / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!this.dentro(x + dx, y + dy)) continue;
      const v = this.terreno[this.idx(x + dx, y + dy)];
      if (v === T.GRAMA || v === T.PASTO || v === T.FERTIL || v === T.FLORESTA || v === T.BROTO) return true;
    }
    return false;
  }

  /**
   * Raio e incêndio. O raio cai em terreno seco e inflamável; o fogo anda de
   * tile em tile na razão do quanto o vizinho está seco, e só a chuva apaga.
   * O que sobra é terra nua com cinza — que é adubo, e é por onde o campo volta.
   */
  arderFogo(anos, sorte) {
    // Um raio a cada poucos anos. Cai em qualquer lugar; só pega onde há o que
    // queimar e está seco, que é o que amarra incêndio a estiagem.
    if (sorte() < anos * 0.35) {
      const x = (sorte() * N) | 0, y = (sorte() * N) | 0;
      const i = this.idx(x, y);
      this.raios.push({ x, y });
      const inf = INFLAMAVEL[this.terreno[i]] || 0;
      if (inf > 0 && sorte() < inf * Math.max(0, 1 - this.umidade[i] * 1.15)) this.atear(i);
    }

    if (!this.queimando.size) return;
    for (const i of [...this.queimando]) {
      const inf = INFLAMAVEL[this.terreno[i]] || 0;
      if (inf <= 0) { this.queimando.delete(i); this.fogo[i] = 0; continue; }
      this.fogo[i] += anos * 1.6;
      const x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!this.dentro(x + dx, y + dy)) continue;
        const j = this.idx(x + dx, y + dy);
        if (this.fogo[j] > 0) continue;
        const infV = INFLAMAVEL[this.terreno[j]] || 0;
        if (infV <= 0) continue;
        // Espalhar amarrado à seca, e com folga: a 2,4 × (1-u) o fogo comia
        // meio mapa com umidade normal. Assim, mato molhado quase não pega e
        // mato seco pega rápido, que é o comportamento que interessa ver.
        // O limiar era 1,55 e na prática mata nenhuma pegava: a umidade de base
        // de floresta fica em 0,7 e nem na seca chegava lá. Com 1,15 a mata
        // molhada ainda quase não pega e a mata de estiagem pega de verdade.
        if (sorte() < anos * 1.6 * infV * Math.max(0, 1 - this.umidade[j] * 1.15)) this.atear(j);
      }
      if (this.fogo[i] >= 1) {
        this.queimando.delete(i);
        this.fogo[i] = 0;
        // cinza: o incêndio empobrece o mapa e aduba o chão ao mesmo tempo
        this.nutriente[i] = Math.min(1, this.nutriente[i] + 0.55);
        this.umidade[i] = Math.max(0, this.umidade[i] - 0.25);
        this.madeira[i] = 0;
        this.desmatados.delete(i);
        this.tilesQueimados++;
        this.definir(i, T.TERRA);
      }
    }
  }

  atear(i) {
    if (!(INFLAMAVEL[this.terreno[i]] > 0) || this.fogo[i] > 0) return false;
    this.fogo[i] = 0.001;
    this.queimando.add(i);
    this.tocar(i);
    return true;
  }

  /** Regeneração da forragem e maturação das plantações, por tique. */
  /**
   * Rebrota da mata. Só cresce onde havia mata e só se sobrou floresta vizinha
   * para semear — derrubar tudo de uma região deixa a região sem mata para
   * sempre, que é o preço de não esperar a árvore nascer.
   */
  rebrotar(dt) {
    if (!this.desmatados.size) return;
    for (const i of this.desmatados) {
      const x = i % N, y = (i / N) | 0;
      let semente = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (this.dentro(x + dx, y + dy) && this.terreno[this.idx(x + dx, y + dy)] === T.FLORESTA) {
          semente = true; break;
        }
      }
      if (!semente) continue;
      this.madeira[i] += dt * 0.012;
      if (this.madeira[i] >= 1) {
        this.madeira[i] = 1;
        this.desmatados.delete(i);
        this.definir(i, T.FLORESTA);
      }
    }
  }

  crescerTudo(dt) {
    this.rebrotar(dt);
    const t = N * N;
    for (let i = 0; i < t; i++) {
      const tipo = this.terreno[i];
      const teto = TERRENOS[tipo].forragem;
      if (this.comida[i] < teto) {
        this.comida[i] = Math.min(teto, this.comida[i] + dt * 0.10 * teto);
      }
      // (o pousio e a rebrota da mata rodam abaixo, fora deste laço)
      // terra que foi lavrada até o fim volta a ser campo e leva umas quatro
      // décadas para virar fértil de novo. É essa espera que empurra as tribos
      // para terra nova — e é onde a briga por território começa.
      if (this.vigor[i] < 1 && this.base[i] === T.FERTIL && tipo === T.GRAMA) {
        this.vigor[i] = Math.min(1, this.vigor[i] + dt * 0.012);
        if (this.vigor[i] >= 1) this.definir(i, T.FERTIL);
      }
      if (tipo === T.PLANTACAO && this.crescer[i] < 1) {
        // um ciclo de plantação leva pouco mais de um ano de mundo
        this.crescer[i] = Math.min(1, this.crescer[i] + dt * 0.20);
        if (this.crescer[i] >= 1) this.tocar(i);
      }
    }
  }
}

const suave = (t) => t * t * (3 - 2 * t);

/** Gerador determinístico: o mesmo mundo para a mesma semente, sempre. */
export function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
