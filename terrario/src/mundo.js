// A grade. Tudo do mundo mora em arrays tipados indexados por tile: é o que
// permite rodar milhares de tiles e centenas de agentes por tique no celular
// sem alocar nada durante a simulação.

export const N = 80;                 // lado da grade
export const TILE = 1;               // metros por tile
export const NIVEL_MAR = 0.28;

export const T = {
  AGUA: 0, AREIA: 1, GRAMA: 2, FERTIL: 3, FLORESTA: 4,
  ROCHA: 5, MONTANHA: 6, PLANTACAO: 7, PASTO: 8, TERRA: 9,
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
    this.gerar(semente, pelado);
  }

  idx(x, y) { return y * N + x; }
  dentro(x, y) { return x >= 0 && y >= 0 && x < N && y < N; }

  /** Marca o tile para o render redesenhar. */
  tocar(i) { this.sujo.add(i); }

  definir(i, tipo) {
    if (this.terreno[i] === tipo) return;
    this.terreno[i] = tipo;
    if (tipo === T.FLORESTA) { this.madeira[i] = 1; this.desmatados.delete(i); }
    this.comida[i] = TERRENOS[tipo].forragem;
    if (tipo !== T.PLANTACAO) this.crescer[i] = 0;
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
        if (tipo === T.FLORESTA) this.madeira[i] = 1;
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
