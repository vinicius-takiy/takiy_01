// Soldado com esqueleto de verdade: SkinnedMesh, 15 ossos, poses autorais.
//
// Por que construído em código e não um modelo baixado: nenhum rigged glTF de
// soldado da Segunda Guerra é alcançável daqui (Mixamo exige login, Sketchfab
// está bloqueado, e os samples do Khronos são bonecos genéricos de demonstração
// que ficariam piores que isto). Fazendo à mão, a silhueta é escolhida — o que
// importa quando o inimigo precisa se destacar do barro — e o peso é zero.
//
// A pele é rígida: cada vértice pertence a um osso só. Em low-poly isso lê bem e
// evita o custo e a complicação de pesos suaves.

import * as THREE from 'three';

export const COR = {
  farda:   new THREE.Color(0x5c6440),
  capacete:new THREE.Color(0x40462f),
  pele:    new THREE.Color(0xb2855f),
  couro:   new THREE.Color(0x33291f),
  equipa:  new THREE.Color(0x4b4130),
  madeira: new THREE.Color(0x5f4326),
  aco:     new THREE.Color(0x2a2a2c),
};

/** Ossos: nome, pai, deslocamento em repouso. A ordem é a de criação. */
const ESQUELETO = [
  ['raiz',      null,     [0, 0.92, 0]],
  ['coluna',    'raiz',   [0, 0.20, 0]],
  ['peito',     'coluna', [0, 0.22, 0]],
  ['pescoco',   'peito',  [0, 0.20, 0]],
  ['cabeca',    'pescoco',[0, 0.09, 0]],
  ['ombroD',    'peito',  [-0.21, 0.13, 0]],
  ['cotoveloD', 'ombroD', [0, -0.25, 0]],
  ['maoD',      'cotoveloD', [0, -0.24, 0]],
  ['ombroE',    'peito',  [0.21, 0.13, 0]],
  ['cotoveloE', 'ombroE', [0, -0.25, 0]],
  ['maoE',      'cotoveloE', [0, -0.24, 0]],
  ['quadrilD',  'raiz',   [-0.11, -0.05, 0]],
  ['joelhoD',   'quadrilD', [0, -0.42, 0]],
  ['peD',       'joelhoD',  [0, -0.40, 0]],
  ['quadrilE',  'raiz',   [0.11, -0.05, 0]],
  ['joelhoE',   'quadrilE', [0, -0.42, 0]],
  ['peE',       'joelhoE',  [0, -0.40, 0]],
];

/** Caixas do corpo: osso, cor, centro no espaço do osso, tamanho. */
const PARTES = [
  ['raiz',    'farda',   [0, 0.01, 0],      [0.31, 0.21, 0.21]],
  ['coluna',  'farda',   [0, 0.10, 0],      [0.33, 0.23, 0.22]],
  ['peito',   'farda',   [0, 0.11, 0],      [0.42, 0.30, 0.25]],
  ['peito',   'equipa',  [0, 0.10, -0.16],  [0.30, 0.26, 0.12]],   // mochila
  ['peito',   'couro',   [0, 0.02, 0.13],   [0.40, 0.06, 0.04]],   // correia
  ['pescoco', 'pele',    [0, 0.04, 0],      [0.13, 0.10, 0.13]],
  ['cabeca',  'pele',    [0, 0.05, 0.005],  [0.19, 0.21, 0.19]],
  ['cabeca',  'capacete',[0, 0.15, 0],      [0.25, 0.11, 0.26]],   // calota
  ['cabeca',  'capacete',[0, 0.10, -0.06],  [0.27, 0.04, 0.32]],   // aba traseira
  ['cabeca',  'capacete',[0, 0.10, 0.11],   [0.24, 0.035, 0.09]],  // pala
  ['ombroD',  'farda',   [0, -0.12, 0],     [0.14, 0.27, 0.15]],
  ['cotoveloD','farda',  [0, -0.11, 0],     [0.115, 0.25, 0.125]],
  ['maoD',    'pele',    [0, -0.05, 0],     [0.09, 0.10, 0.09]],
  ['ombroE',  'farda',   [0, -0.12, 0],     [0.14, 0.27, 0.15]],
  ['cotoveloE','farda',  [0, -0.11, 0],     [0.115, 0.25, 0.125]],
  ['maoE',    'pele',    [0, -0.05, 0],     [0.09, 0.10, 0.09]],
  ['quadrilD','farda',   [0, -0.21, 0],     [0.17, 0.43, 0.18]],
  ['joelhoD', 'farda',   [0, -0.19, 0],     [0.14, 0.40, 0.15]],
  ['peD',     'couro',   [0, -0.05, -0.05], [0.145, 0.11, 0.27]],
  ['quadrilE','farda',   [0, -0.21, 0],     [0.17, 0.43, 0.18]],
  ['joelhoE', 'farda',   [0, -0.19, 0],     [0.14, 0.40, 0.15]],
  ['peE',     'couro',   [0, -0.05, -0.05], [0.145, 0.11, 0.27]],
];

/** O fuzil, preso à mão direita. Frente do soldado é -Z. */
const ARMA = [
  ['maoD', 'madeira', [0, -0.06, -0.30], [0.05, 0.07, 0.34]],   // guarda-mão
  ['maoD', 'aco',     [0, -0.05, -0.56], [0.022, 0.022, 0.30]], // cano
  ['maoD', 'aco',     [0, -0.05, -0.13], [0.042, 0.05, 0.22]],  // culatra
  ['maoD', 'madeira', [0, -0.02, 0.06],  [0.05, 0.09, 0.20]],   // coronha
  ['maoD', 'aco',     [0, -0.005, -0.70],[0.012, 0.04, 0.02]],  // massa de mira
];

const CAIXA = new THREE.BoxGeometry(1, 1, 1);

/**
 * Monta o soldado.
 * @returns {{grupo:THREE.Group, ossos:Record<string,THREE.Bone>, malha:THREE.SkinnedMesh}}
 */
export function criarSoldado() {
  const ossos = {};
  const lista = [];
  for (const [nome, pai, off] of ESQUELETO) {
    const o = new THREE.Bone();
    o.name = nome;
    o.position.set(off[0], off[1], off[2]);
    o.userData.repouso = { pos: o.position.clone(), rot: new THREE.Euler() };
    if (pai) ossos[pai].add(o); 
    ossos[nome] = o;
    lista.push(o);
  }

  const grupo = new THREE.Group();
  grupo.add(ossos.raiz);
  grupo.updateMatrixWorld(true);

  // geometria assada no espaço de vínculo: cada caixa passa pela matriz de
  // repouso do seu osso e vira vértices com peso 1 naquele osso
  const pos = [], nor = [], idx = [], cor = [], si = [], sw = [];
  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();

  for (const [osso, corNome, centro, tam] of [...PARTES, ...ARMA]) {
    const b = lista.indexOf(ossos[osso]);
    m.copy(ossos[osso].matrixWorld)
      .multiply(new THREE.Matrix4().makeTranslation(centro[0], centro[1], centro[2]))
      .multiply(new THREE.Matrix4().makeScale(tam[0], tam[1], tam[2]));
    nm.getNormalMatrix(m);

    const base = pos.length / 3;
    const p = CAIXA.attributes.position, n = CAIXA.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      nor.push(v.x, v.y, v.z);
      const c = COR[corNome];
      cor.push(c.r, c.g, c.b);
      si.push(b, 0, 0, 0);
      sw.push(1, 0, 0, 0);
    }
    for (const i of CAIXA.index.array) idx.push(base + i);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.setIndex(idx);

  const malha = new THREE.SkinnedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  malha.castShadow = true;
  malha.receiveShadow = true;
  malha.add(ossos.raiz);
  malha.bind(new THREE.Skeleton(lista));
  malha.frustumCulled = false;   // a pele move os vértices; a caixa envolvente mente
  grupo.add(malha);

  return { grupo, ossos, malha };
}

/**
 * Poses. Cada uma é um mapa osso -> rotação (e, na raiz, altura).
 * A pose de espiar não existe: é a interpolação entre agachado e mirando, que já
 * é exatamente o que a máquina de estados do inimigo produz em `exposicao`.
 */
export const POSES = {
  // Convenção deste rig, verificada em tela: os ossos nascem apontando para -Y,
  // então rotação X POSITIVA joga o membro para a frente (-Z), e rotação Z
  // positiva o traz para o lado +X. Errar esse sinal levanta o braço para trás e
  // faz o fuzil apontar para o céu.
  agachado: {
    // A altura manda nesta pose: para o capacete sumir atrás de um parapeito de
    // ~0,97 m, o centro da cabeça precisa ficar por volta de 0,75 m. Com 0,71 m
    // de coluna, isso obriga quadril baixo E tronco bem inclinado — é por isso
    // que ela parece exagerada fora de contexto e certa atrás da cobertura.
    raiz:      { y: 0.34, rx: 0.52 },
    coluna:    { rx: 0.26 }, peito: { rx: 0.14 }, cabeca: { rx: -0.62 },
    quadrilD:  { rx: 1.30, rz: 0.12 }, joelhoD: { rx: -2.05 }, peD: { rx: 0.62 },
    quadrilE:  { rx: 1.18, rz: -0.10 }, joelhoE: { rx: -1.92 }, peE: { rx: 0.58 },
    ombroD:    { rx: 0.62, rz: 0.26 }, cotoveloD: { rx: -1.42 }, maoD: { rx: 0.46 },
    ombroE:    { rx: 0.74, rz: -0.40 }, cotoveloE: { rx: -1.34 },
  },
  mirando: {
    raiz:      { y: 0.92, rx: 0.05 },
    coluna:    { rx: -0.04 }, peito: { rx: 0.07 }, cabeca: { rx: 0.03 },
    quadrilD:  { rx: 0.20 }, joelhoD: { rx: -0.28 }, peD: { rx: 0.10 },
    quadrilE:  { rx: -0.14 }, joelhoE: { rx: -0.14 }, peE: { rx: 0.06 },
    // mão direita no gatilho, colada ao corpo; esquerda à frente, no guarda-mão
    ombroD:    { rx: 1.20, rz: 0.18 }, cotoveloD: { rx: -1.00 }, maoD: { rx: -0.22 },
    ombroE:    { rx: 1.42, rz: -0.34 }, cotoveloE: { rx: -0.62 },
  },
  morto: {
    raiz:      { y: 0.26, rx: 0.14 },
    coluna:    { rx: 0.08 }, peito: { rx: -0.14 }, cabeca: { rx: 0.52 },
    quadrilD:  { rx: 0.38, rz: 0.32 }, joelhoD: { rx: -0.62 }, peD: { rx: 0 },
    quadrilE:  { rx: -0.16, rz: -0.44 }, joelhoE: { rx: -0.28 }, peE: { rx: 0 },
    ombroD:    { rx: -0.42, rz: 0.82 }, cotoveloD: { rx: -0.28 }, maoD: { rx: 0 },
    ombroE:    { rx: -0.28, rz: -0.92 }, cotoveloE: { rx: -0.22 },
  },
};

/**
 * Escreve nos ossos a mistura de duas poses.
 * @param {number} t 0 = pose `a`, 1 = pose `b`
 * @param {number} pitchTorso inclinação extra do peito, para encarar quem está acima ou abaixo
 */
export function aplicarPose(ossos, a, b, t, pitchTorso = 0) {
  for (const nome in ossos) {
    const pa = a[nome], pb = b[nome];
    if (!pa && !pb) continue;
    const rx = mix(pa?.rx, pb?.rx, t);
    const ry = mix(pa?.ry, pb?.ry, t);
    const rz = mix(pa?.rz, pb?.rz, t);
    ossos[nome].rotation.set(rx, ry, rz);
    if (nome === 'raiz') {
      ossos[nome].position.y = mix(pa?.y ?? 0.92, pb?.y ?? 0.92, t);
    }
  }
  ossos.peito.rotation.x += pitchTorso;
  ossos.cabeca.rotation.x -= pitchTorso * 0.5;
}

const mix = (a = 0, b = 0, t) => a + (b - a) * t;
