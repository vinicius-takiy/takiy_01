// Biblioteca de bonecos de bloco. Nada de esfera nem cápsula: cada coisa do
// mundo tem uma silhueta montada em caixas, para que de perto se veja gente,
// bicho e mato — e não manchas coloridas andando.
//
// Cada peça declara um grupo de cor:
//   'tribo'   — pintada com a cor da tribo (roupa). Vem branca na geometria.
//   'natural' — cor de verdade (pele, madeira, metal, folha), sem tingimento.
// São duas malhas instanciadas por figura. Uma só obrigaria a tingir a pele com
// a cor da tribo, que foi como isto começou e ficava errado.

import * as THREE from 'three';

const PELE = 0xc89b72;
const COURO = 0x4a3626;
const MADEIRA = 0x6b4a26;
const METAL = 0x8f96a0;
const PALHA = 0xd8c37e;

/** Peça: centro, tamanho, cor, grupo e rotação opcional. */
const P = (x, y, z, sx, sy, sz, cor, grupo = 'tribo', rx = 0, ry = 0, rz = 0) =>
  ({ x, y, z, sx, sy, sz, cor, grupo, rx, ry, rz });

const CONE = (x, y, z, r, h, lados, cor, grupo, rx = 0, rz = 0) =>
  ({ cone: true, x, y, z, r, h, lados, cor, grupo, rx, rz });

// ------------------------------------------------------------------ humanos
/** Tronco, pernas e braços: igual para todo mundo. A vocação entra na cabeça e
 *  na ferramenta, que é o que se lê de longe. */
function esqueletoHumano() {
  return [
    P(-0.072, 0.13, 0, 0.11, 0.26, 0.12, 0xb0b0b0),   // pernas, um tom abaixo
    P(0.072, 0.13, 0, 0.11, 0.26, 0.12, 0xb0b0b0),
    P(0, 0.40, 0, 0.30, 0.28, 0.17, 0xffffff),        // tronco: cor cheia da tribo
    P(-0.192, 0.40, 0.005, 0.08, 0.26, 0.10, 0xe8e8e8),
    P(0.192, 0.40, 0.005, 0.08, 0.26, 0.10, 0xe8e8e8),
    P(0, 0.645, 0, 0.20, 0.19, 0.19, PELE, 'natural'),
  ];
}

const HUMANOS = {
  lavrador: () => [
    ...esqueletoHumano(),
    P(0, 0.752, 0, 0.34, 0.030, 0.34, PALHA, 'natural'),      // aba do chapéu
    P(0, 0.775, 0, 0.19, 0.055, 0.19, PALHA, 'natural'),      // copa
    P(0.232, 0.42, 0.10, 0.030, 0.62, 0.030, MADEIRA, 'natural', 0, 0, 0.16),
    P(0.318, 0.70, 0.10, 0.15, 0.045, 0.05, METAL, 'natural', 0, 0, 0.16),
  ],
  cacador: () => [
    ...esqueletoHumano(),
    P(0, 0.66, -0.015, 0.235, 0.225, 0.225, COURO, 'natural'), // capuz
    P(0, 0.60, -0.115, 0.18, 0.18, 0.06, COURO, 'natural'),
    P(-0.235, 0.47, 0.07, 0.026, 0.92, 0.026, MADEIRA, 'natural', 0, 0, -0.10),
    CONE(-0.284, 0.95, 0.07, 0.05, 0.17, 4, 0xd8d2c4, 'natural'),
    P(0.16, 0.44, -0.13, 0.09, 0.22, 0.07, COURO, 'natural', 0.2),   // aljava
  ],
  construtor: () => [
    ...esqueletoHumano(),
    P(0, 0.755, 0, 0.215, 0.075, 0.215, COURO, 'natural'),     // gorro
    P(0, 0.50, -0.165, 0.32, 0.26, 0.13, MADEIRA, 'natural'),  // fardo nas costas
    P(0, 0.50, -0.235, 0.26, 0.20, 0.03, 0x8a6a3c, 'natural'),
    P(0.235, 0.33, 0.09, 0.028, 0.34, 0.028, MADEIRA, 'natural'),
    P(0.235, 0.52, 0.09, 0.13, 0.08, 0.07, METAL, 'natural'),  // marreta
  ],
  minerador: () => [
    ...esqueletoHumano(),
    P(0, 0.757, 0, 0.225, 0.085, 0.225, METAL, 'natural'),     // capacete
    P(0, 0.757, 0.125, 0.075, 0.06, 0.045, 0xffd76a, 'natural'), // lanterna
    P(-0.232, 0.40, 0.09, 0.028, 0.56, 0.028, MADEIRA, 'natural', 0, 0, -0.22),
    P(-0.30, 0.66, 0.09, 0.30, 0.045, 0.045, 0x6f7480, 'natural', 0, 0, 0.42),
  ],
  pescador: () => [
    ...esqueletoHumano(),
    P(0, 0.752, 0, 0.30, 0.028, 0.30, PALHA, 'natural'),           // chapéu de palha largo
    P(0, 0.772, 0, 0.17, 0.05, 0.17, PALHA, 'natural'),
    P(0.235, 0.52, 0.05, 0.024, 1.00, 0.024, MADEIRA, 'natural', 0, 0, 0.22),  // vara
    P(0.40, 0.92, 0.05, 0.012, 0.34, 0.012, 0xd8d2c4, 'natural'),  // linha
    P(-0.20, 0.31, -0.11, 0.15, 0.13, 0.11, 0x7a6a45, 'natural'),  // cesto
  ],
  artesao: () => [
    ...esqueletoHumano(),
    P(0, 0.748, 0, 0.215, 0.065, 0.215, 0x7b5f3a, 'natural'),      // barrete de couro
    P(0.235, 0.30, 0.09, 0.026, 0.30, 0.026, MADEIRA, 'natural'),  // cinzel
    P(0.235, 0.47, 0.09, 0.055, 0.06, 0.055, METAL, 'natural'),
    P(-0.20, 0.30, -0.06, 0.13, 0.13, 0.13, 0x8b877d, 'natural'),  // bloco de pedra no braço
  ],
  pastor: () => [
    ...esqueletoHumano(),
    P(0, 0.745, 0, 0.20, 0.06, 0.20, 0xb6a077, 'natural'),         // touca de lã
    P(0, 0.775, 0, 0.13, 0.04, 0.13, 0xb6a077, 'natural'),
    P(0.238, 0.50, 0.03, 0.026, 1.06, 0.026, MADEIRA, 'natural'),  // cajado
    P(0.238, 1.00, 0.03, 0.026, 0.10, 0.09, MADEIRA, 'natural', 0.9),  // gancho
    P(-0.14, 0.34, -0.10, 0.16, 0.15, 0.09, COURO, 'natural', 0, 0, 0.2),  // bornal
  ],
  guarda: () => [
    ...esqueletoHumano(),
    P(0, 0.758, 0, 0.225, 0.09, 0.225, METAL, 'natural'),          // elmo
    P(0, 0.70, 0.105, 0.035, 0.10, 0.03, METAL, 'natural'),        // nasal
    P(0.245, 0.46, 0.04, 0.028, 1.02, 0.028, MADEIRA, 'natural'),  // lança
    CONE(0.245, 1.03, 0.04, 0.055, 0.20, 4, METAL, 'natural'),
    // escudo na cor da tribo: de longe é o que diz de quem é a cerca
    P(-0.245, 0.40, 0.055, 0.045, 0.34, 0.30, 0xffffff),
    P(-0.278, 0.40, 0.055, 0.022, 0.11, 0.10, METAL, 'natural'),   // umbo
  ],
  lider: () => [
    ...esqueletoHumano(),
    P(0, 0.745, 0, 0.225, 0.055, 0.225, 0x8a3f2c, 'natural'),  // faixa
    CONE(-0.07, 0.86, -0.02, 0.035, 0.20, 4, 0xe0b344, 'natural', 0, -0.3),
    CONE(0, 0.885, -0.02, 0.035, 0.24, 4, 0xf2eddb, 'natural'),
    CONE(0.07, 0.86, -0.02, 0.035, 0.20, 4, 0xe0b344, 'natural', 0, 0.3),
    P(0.235, 0.47, 0.05, 0.030, 0.92, 0.030, MADEIRA, 'natural'),
    CONE(0.235, 0.97, 0.05, 0.07, 0.14, 6, 0xe0b344, 'natural'),
  ],
};

// ------------------------------------------------------------------- bichos
// Bicho é montado em duas figuras: corpo e pata. Uma malha só por bicho é o que
// fazia o rebanho deslizar pelo chão de pernas duras — some quando a câmera
// está longe e é a primeira coisa que se vê quando ela chega perto, que é
// justamente para o que a câmera de perto existe.
//
// E os dois olham para +Z, como a gente. Estavam montados olhando para +X
// enquanto o giro é calculado para +Z, então andavam de lado, feito caranguejo.

/** Quadris, em coordenadas do próprio bicho. `fase` é o trote diagonal: a pata
 *  dianteira esquerda sai junto com a traseira direita. */
export const QUADRIS = [
  { x: -0.085, y: 0.185, z: 0.15, fase: 0 },            // dianteira esquerda
  { x: 0.085, y: 0.185, z: -0.15, fase: 0 },            // traseira direita
  { x: 0.085, y: 0.185, z: 0.15, fase: Math.PI },       // dianteira direita
  { x: -0.085, y: 0.185, z: -0.15, fase: Math.PI },     // traseira esquerda
];

/** Pata solta, pendurada abaixo da origem: a origem É o quadril, senão a pata
 *  gira em torno do pé e o bicho parece pisar em bola. */
const pata = (cor) => () => [P(0, -0.095, 0, 0.075, 0.19, 0.075, cor, 'natural')];

/** Rebanho: corpo comprido, cabeça baixa de quem pasta. */
function rebanho() {
  const pelo = 0xe6dcc4;
  return [
    P(0, 0.30, 0, 0.26, 0.26, 0.46, pelo, 'natural'),
    P(0, 0.345, 0.30, 0.19, 0.19, 0.20, pelo, 'natural'),
    P(0, 0.315, 0.405, 0.11, 0.09, 0.06, 0xc9a98d, 'natural'),    // focinho
    P(-0.075, 0.455, 0.30, 0.04, 0.06, 0.055, pelo, 'natural'),   // orelhas
    P(0.075, 0.455, 0.30, 0.04, 0.06, 0.055, pelo, 'natural'),
    P(0, 0.36, -0.255, 0.045, 0.16, 0.045, pelo, 'natural', -0.5),
  ];
}

/** Capivara: baixa e roliça, focinho quadrado, sem rabo. Vive na margem. */
function capivara() {
  const pelo = 0x9c7648, escuro = 0x6f5231;
  return [
    P(0, 0.24, 0, 0.24, 0.22, 0.40, pelo, 'natural'),
    P(0, 0.27, 0.26, 0.19, 0.17, 0.16, pelo, 'natural'),
    P(0, 0.245, 0.35, 0.13, 0.10, 0.05, escuro, 'natural'),      // focinho chato
    P(-0.07, 0.36, 0.28, 0.045, 0.04, 0.045, escuro, 'natural'), // orelhinhas
    P(0.07, 0.36, 0.28, 0.045, 0.04, 0.045, escuro, 'natural'),
  ];
}

/** Lebre: pequena, orelhas compridas, garupa alta. */
function lebre() {
  const pelo = 0xc9b48c, escuro = 0x8d7a58;
  return [
    P(0, 0.145, -0.02, 0.13, 0.13, 0.24, pelo, 'natural'),
    P(0, 0.175, 0.15, 0.11, 0.10, 0.10, pelo, 'natural'),
    P(-0.035, 0.30, 0.14, 0.035, 0.16, 0.05, pelo, 'natural', 0, 0, -0.14),   // orelhas
    P(0.035, 0.30, 0.14, 0.035, 0.16, 0.05, pelo, 'natural', 0, 0, 0.14),
    P(0, 0.15, -0.16, 0.06, 0.06, 0.05, escuro, 'natural'),      // rabinho
  ];
}

/** Fera: mais baixa, mais comprida, focinho à frente e rabo esticado. */
function predador() {
  const pelo = 0x6e4436, escuro = 0x4a2c22;
  return [
    P(0, 0.26, 0, 0.19, 0.19, 0.48, pelo, 'natural'),
    P(0, 0.31, 0.30, 0.16, 0.16, 0.17, pelo, 'natural'),
    P(0, 0.285, 0.41, 0.10, 0.09, 0.09, escuro, 'natural'),
    CONE(-0.055, 0.42, 0.28, 0.045, 0.10, 4, escuro, 'natural'),
    CONE(0.055, 0.42, 0.28, 0.045, 0.10, 4, escuro, 'natural'),
    P(0, 0.32, -0.32, 0.05, 0.26, 0.05, pelo, 'natural', 1.1),
  ];
}

// ------------------------------------------------------------------ cenário
function arvore() {
  return [
    P(0, 0.22, 0, 0.13, 0.44, 0.13, 0x54381f, 'natural'),
    P(0, 0.56, 0, 0.66, 0.26, 0.66, 0x2f6130, 'natural'),
    P(0, 0.76, 0, 0.48, 0.22, 0.48, 0x367037, 'natural'),
    P(0, 0.93, 0, 0.28, 0.18, 0.28, 0x3d7c3e, 'natural'),
  ];
}

function oca() {
  return [
    P(0, 0.16, 0, 0.62, 0.32, 0.62, 0x9c8562, 'natural'),
    P(0, 0.155, 0.315, 0.20, 0.26, 0.03, 0x2a1f14, 'natural'),   // porta
    CONE(0, 0.50, 0, 0.52, 0.40, 6, 0x8a6a3c, 'natural'),
    P(0, 0.74, 0, 0.06, 0.14, 0.06, 0xffffff),   // mastro na cor da tribo
  ];
}

function moita() {
  return [
    P(0, 0.11, 0, 0.30, 0.22, 0.30, 0x4a6b35, 'natural'),
    P(0.10, 0.20, -0.06, 0.18, 0.14, 0.18, 0x557a3c, 'natural'),
  ];
}

function pedra() {
  return [
    P(0, 0.13, 0, 0.42, 0.26, 0.38, 0x8b877d, 'natural'),
    P(0.11, 0.28, 0.06, 0.22, 0.16, 0.20, 0x9a968c, 'natural'),
  ];
}

/** Peixe: corpo curto e cauda em leque. Nada logo abaixo da lâmina. */
function peixe() {
  const escama = 0x7fb6c4, barriga = 0xcfe4e6;
  return [
    P(0, 0, 0, 0.16, 0.11, 0.30, escama, 'natural'),
    P(0, -0.035, 0.02, 0.11, 0.05, 0.24, barriga, 'natural'),
    P(0, 0, -0.20, 0.02, 0.13, 0.11, escama, 'natural'),           // cauda
    P(0, 0.08, 0.01, 0.02, 0.07, 0.12, escama, 'natural'),         // dorsal
  ];
}

/** Jacaré: comprido, baixo, focinho longo e cristas nas costas. */
function jacare() {
  const couro = 0x4f6b45, escuro = 0x39492f;
  return [
    P(0, 0, 0, 0.20, 0.11, 0.52, couro, 'natural'),
    P(0, 0.005, 0.36, 0.13, 0.08, 0.26, couro, 'natural'),         // focinho
    P(0, 0.055, 0.20, 0.055, 0.045, 0.055, 0xd8c98a, 'natural'),   // olhos
    P(-0.075, 0.06, 0.22, 0.04, 0.04, 0.04, escuro, 'natural'),
    P(0.075, 0.06, 0.22, 0.04, 0.04, 0.04, escuro, 'natural'),
    CONE(0, 0.09, 0.02, 0.05, 0.09, 4, escuro, 'natural'),         // crista
    CONE(0, 0.09, -0.14, 0.05, 0.09, 4, escuro, 'natural'),
    P(0, -0.01, -0.42, 0.09, 0.075, 0.34, couro, 'natural'),       // cauda
  ];
}

/** Poço: boca de pedra e um sarilho de madeira. É a obra que dá teto de gente
 *  à tribo, então tem que se ver de longe que ela está lá. */
function poco() {
  const pedra = 0x8b877d, clara = 0x9e9a90;
  return [
    P(0, 0.10, 0, 0.62, 0.20, 0.62, pedra, 'natural'),
    P(0, 0.20, 0, 0.44, 0.06, 0.44, 0x2b3138, 'natural'),          // a água escura no fundo
    P(-0.26, 0.42, 0, 0.07, 0.45, 0.07, MADEIRA, 'natural'),
    P(0.26, 0.42, 0, 0.07, 0.45, 0.07, MADEIRA, 'natural'),
    P(0, 0.62, 0, 0.60, 0.07, 0.10, MADEIRA, 'natural'),           // travessa
    P(0, 0.50, 0, 0.13, 0.12, 0.13, clara, 'natural'),             // balde
  ];
}

/** Muro: bloco de pedra assentado, com ameia. Fera não pula. */
function muro() {
  const pedra = 0x8f8b81, junta = 0x7c786f;
  return [
    P(0, 0.30, 0, 0.94, 0.60, 0.44, pedra, 'natural'),
    P(0, 0.61, 0, 0.96, 0.06, 0.46, junta, 'natural'),
    P(-0.28, 0.70, 0, 0.24, 0.14, 0.40, pedra, 'natural'),         // ameias
    P(0.28, 0.70, 0, 0.24, 0.14, 0.40, pedra, 'natural'),
  ];
}

/** Chama: três línguas de fogo empilhadas. Só aparece em tile que está ardendo. */
function chama() {
  return [
    CONE(0, 0.22, 0, 0.30, 0.46, 5, 0xd95b23, 'natural'),
    CONE(0.10, 0.30, 0.06, 0.16, 0.40, 5, 0xef8b2c, 'natural'),
    CONE(-0.08, 0.34, -0.05, 0.12, 0.34, 5, 0xf6c344, 'natural'),
  ];
}

/** Mourão de cerca: dois postes e duas travessas. O topo de um deles leva a cor
 *  da tribo — é o que faz dois currais vizinhos não virarem a mesma cerca. */
function cerca() {
  return [
    P(-0.38, 0.24, 0, 0.085, 0.48, 0.085, 0x6b4a26, 'natural'),
    P(0.38, 0.24, 0, 0.085, 0.48, 0.085, 0x6b4a26, 'natural'),
    P(0, 0.38, 0, 0.86, 0.055, 0.045, 0x7d5a30, 'natural'),
    P(0, 0.20, 0, 0.86, 0.055, 0.045, 0x7d5a30, 'natural'),
    P(-0.38, 0.50, 0, 0.105, 0.045, 0.105, 0xffffff),
  ];
}

/** Feixe de trigo: só aparece quando a roça amadurece. */
function espiga() {
  return [
    P(0, 0.13, 0, 0.055, 0.26, 0.055, 0xb99a3e, 'natural'),
    P(0, 0.30, 0, 0.10, 0.12, 0.10, 0xe0c257, 'natural'),
  ];
}

export const FIGURAS = {
  ...Object.fromEntries(Object.entries(HUMANOS).map(([k, f]) => [`humano:${k}`, f])),
  rebanho, predador, arvore, oca, moita, pedra, espiga, cerca, peixe, jacare,
  capivara, lebre, chama, poco, muro,
  'rebanho:pata': pata(0x584a38), 'predador:pata': pata(0x4a2c22),
  'capivara:pata': pata(0x6f5231), 'lebre:pata': pata(0x8d7a58),
};

/**
 * Monta a figura em até duas geometrias, uma por grupo de cor.
 * @returns {{tribo: THREE.BufferGeometry|null, natural: THREE.BufferGeometry|null}}
 */
export function montarFigura(nome) {
  const fabrica = FIGURAS[nome];
  if (!fabrica) throw new Error('figura desconhecida: ' + nome);
  const pecas = fabrica();
  const saida = {};
  for (const grupo of ['tribo', 'natural']) {
    const doGrupo = pecas.filter((p) => p.grupo === grupo);
    saida[grupo] = doGrupo.length ? juntar(doGrupo) : null;
  }
  return saida;
}

const CAIXA = new THREE.BoxGeometry(1, 1, 1);
const conePara = new Map();

function juntar(pecas) {
  const pos = [], nor = [], cor = [], idx = [];
  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  let base = 0;

  for (const p of pecas) {
    let g;
    if (p.cone) {
      const chave = `${p.r}:${p.h}:${p.lados}`;
      if (!conePara.has(chave)) conePara.set(chave, new THREE.ConeGeometry(p.r, p.h, p.lados));
      g = conePara.get(chave);
      m.makeRotationFromEuler(new THREE.Euler(p.rx || 0, 0, p.rz || 0));
      m.setPosition(p.x, p.y, p.z);
    } else {
      g = CAIXA;
      m.makeRotationFromEuler(new THREE.Euler(p.rx || 0, p.ry || 0, p.rz || 0));
      m.scale(new THREE.Vector3(p.sx, p.sy, p.sz));
      m.setPosition(p.x, p.y, p.z);
    }
    nm.getNormalMatrix(m);
    c.set(p.cor);
    const ap = g.attributes.position, an = g.attributes.normal;
    for (let i = 0; i < ap.count; i++) {
      v.fromBufferAttribute(ap, i).applyMatrix4(m);
      pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(an, i).applyMatrix3(nm).normalize();
      nor.push(v.x, v.y, v.z);
      cor.push(c.r, c.g, c.b);
    }
    const ind = g.index ? [...g.index.array] : [...Array(ap.count).keys()];
    for (const i of ind) idx.push(base + i);
    base += ap.count;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  geo.setIndex(idx);
  return geo;
}
