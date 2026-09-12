// O setor. Tudo é gerado por código: nenhum modelo, nenhuma textura, nenhum
// download. Caixas com sombreamento chapado, que é o teto realista do que roda
// liso no Safari do iPhone.

import * as THREE from 'three';

export const CHAO = 0;
export const COMPRIMENTO = 96;   // eixo Z, do abrigo inicial ao bunker
export const MEIA_LARGURA = 9;   // barrancos de terra em x = ±9

const MAT = {
  terra:    new THREE.MeshLambertMaterial({ color: 0x6a5c46 }),
  terraEsc: new THREE.MeshLambertMaterial({ color: 0x554a3a }),
  lama:     new THREE.MeshLambertMaterial({ color: 0x7a6c53 }),
  saco:     new THREE.MeshLambertMaterial({ color: 0x9c8f66 }),
  madeira:  new THREE.MeshLambertMaterial({ color: 0x6a5237 }),
  concreto: new THREE.MeshLambertMaterial({ color: 0x807a6b }),
  metal:    new THREE.MeshLambertMaterial({ color: 0x3b3e42 }),
  arame:    new THREE.LineBasicMaterial({ color: 0x2b2b28 }),
};

const CAIXA = new THREE.BoxGeometry(1, 1, 1);

// Arame farpado sólido, com brechas em x -3,4..-1,0 e 3,4..5,8.
const TRECHOS_ARAME = [[-MEIA_LARGURA, -3.4], [-1.0, 3.4], [5.8, MEIA_LARGURA]];

/**
 * Constrói o setor.
 * @returns {{grupo:THREE.Group, colisores:Array, coberturas:Array, avancos:Array, bunker:THREE.Vector3}}
 */
export function construirSetor() {
  const grupo = new THREE.Group();
  const colisores = [];
  const sacos = [];   // matrizes para a malha instanciada

  /** Caixa sólida: vira geometria e obstáculo. */
  function bloco(mat, x, y, z, sx, sy, sz, rotY = 0, solido = true, sombra = false) {
    const m = new THREE.Mesh(CAIXA, mat);
    m.position.set(x, y + sy / 2, z);
    m.scale.set(sx, sy, sz);
    m.rotation.y = rotY;
    m.castShadow = sombra;
    m.receiveShadow = true;
    grupo.add(m);
    if (solido) colisores.push(caixaDe(x, y, z, sx, sy, sz, rotY));
    return m;
  }

  /** AABB alinhada aos eixos. Rotações pequenas viram a envoltória. */
  function caixaDe(x, y, z, sx, sy, sz, rotY = 0) {
    const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
    const ex = (sx * c + sz * s) / 2;
    const ez = (sx * s + sz * c) / 2;
    return { minX: x - ex, maxX: x + ex, minY: y, maxY: y + sy, minZ: z - ez, maxZ: z + ez };
  }

  /** Pilha de sacos de areia: instanciada, com desalinhamento para não parecer LEGO. */
  function parapeito(x, z, largura, altura, rotY = 0) {
    const lg = 0.9, al = 0.34, pf = 0.55;
    const n = Math.max(1, Math.round(largura / lg));
    for (let f = 0; f < altura; f++) {
      const off = (f % 2) * lg * 0.5;
      for (let i = 0; i < n; i++) {
        const lx = (i - (n - 1) / 2) * lg + off;
        const m = new THREE.Matrix4();
        const p = new THREE.Vector3(lx, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        m.compose(
          new THREE.Vector3(x + p.x, CHAO + al / 2 + f * al * 0.95, z + p.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY + (Math.random() - 0.5) * 0.22, (Math.random() - 0.5) * 0.1)),
          new THREE.Vector3(lg * 0.98, al, pf),
        );
        sacos.push(m);
      }
    }
    colisores.push(caixaDe(x, CHAO, z, n * lg, altura * al * 0.95, pf, rotY));
    return { x, z, altura: altura * al * 0.95 };
  }

  // ---------- chão e barrancos ----------
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(MEIA_LARGURA * 2 + 8, COMPRIMENTO + 30, 12, 24), MAT.lama);
  chao.rotation.x = -Math.PI / 2;
  chao.position.z = COMPRIMENTO / 2 - 6;
  chao.receiveShadow = true;
  // ondula o terreno de leve; o jogador anda em plano, é só leitura visual
  const pos = chao.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const bx = pos.getX(i), by = pos.getY(i);
    if (Math.abs(bx) > 1.5) pos.setZ(i, Math.sin(bx * 0.7) * Math.cos(by * 0.4) * 0.18 - 0.05);
  }
  pos.needsUpdate = true;
  chao.geometry.computeVertexNormals();
  grupo.add(chao);

  for (const lado of [-1, 1]) {
    bloco(MAT.terra, lado * (MEIA_LARGURA + 1.6), CHAO - 0.4, COMPRIMENTO / 2 - 6, 3.4, 4.4, COMPRIMENTO + 26);
    // crista irregular, no topo de verdade: uma linha reta no horizonte entrega
    // na hora que o cenário é uma caixa só
    for (let z = -12; z < COMPRIMENTO + 14; z += 2.6) {
      const h = 0.5 + Math.random() * 1.1;
      bloco(MAT.terraEsc, lado * (MEIA_LARGURA + 0.4 + Math.random() * 1.2), CHAO + 3.9 - h * 0.4,
            z, 2.2 + Math.random(), h, 2.4 + Math.random(), Math.random() * 0.6, false);
    }
    // faixa mais escura na meia altura, para a parede não virar uma mancha só
    bloco(MAT.terraEsc, lado * (MEIA_LARGURA - 0.05), CHAO + 1.5, COMPRIMENTO / 2 - 6,
          0.5, 0.5, COMPRIMENTO + 26, 0, false);
  }
  // fundos: fecha o setor atrás e adiante
  bloco(MAT.terra, 0, CHAO - 0.4, -13, MEIA_LARGURA * 2 + 6, 5, 3);

  // ---------- crateras ----------
  const crateras = [[-3.4, 16], [4.2, 27], [-5.1, 38], [2.6, 46], [-1.8, 58], [5.4, 66], [-4.6, 74]];
  for (const [x, z] of crateras) {
    const r = 1.7 + Math.random() * 1.1;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.55, 0.5, 9), MAT.terraEsc);
    c.position.set(x, CHAO - 0.22, z);
    c.receiveShadow = true;
    grupo.add(c);
    const borda = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.16, 4, 10), MAT.terra);
    borda.rotation.x = Math.PI / 2;
    borda.position.set(x, CHAO + 0.03, z);
    grupo.add(borda);
  }

  // ---------- coberturas e posições inimigas ----------
  // cada cobertura vira um posto: o soldado agacha atrás e levanta para atirar
  const coberturas = [];
  function posto(x, z, tipo, rotY = 0) {
    let altura = 1.05;
    if (tipo === 'sacos') altura = parapeito(x, z, 2.6, 3, rotY).altura;
    if (tipo === 'caixa') { bloco(MAT.madeira, x, CHAO, z, 1.2, 1.0, 0.9, rotY, true, true); altura = 1.0; }
    if (tipo === 'concreto') { bloco(MAT.concreto, x, CHAO, z, 1.4, 1.15, 1.1, rotY, true, true); altura = 1.15; }
    coberturas.push({ pos: new THREE.Vector3(x, CHAO, z), altura, tipo });
  }

  // trecho 1 — saída do abrigo
  posto(-3.0, 19, 'sacos');
  posto(3.6, 22, 'caixa', 0.3);
  // trecho 2 — terreno aberto
  posto(-5.4, 32, 'concreto', -0.2);
  posto(0.8, 36, 'sacos', 0.15);
  posto(5.2, 41, 'caixa', -0.4);
  // trecho 3 — arame
  posto(-4.0, 56, 'concreto', 0.25);
  posto(3.2, 60, 'sacos', -0.1);
  // trecho 4 — bunker
  posto(-1.2, 78, 'sacos', 0.1);

  // cenário sem função de combate
  bloco(MAT.madeira, 7.0, CHAO, 12, 0.6, 2.4, 0.6);      // poste
  bloco(MAT.madeira, -6.8, CHAO, 30, 2.2, 0.7, 1.4, 0.5, true, true); // carroça destruída
  bloco(MAT.metal, -6.6, CHAO + 0.7, 30.4, 1.1, 0.5, 1.0, 0.5, false, true);
  bloco(MAT.madeira, 6.4, CHAO, 52, 0.5, 2.1, 0.5);
  for (let i = 0; i < 9; i++) {
    const x = (Math.random() * 2 - 1) * (MEIA_LARGURA - 1.5);
    const z = 6 + Math.random() * (COMPRIMENTO - 20);
    bloco(MAT.madeira, x, CHAO, z, 0.22, 0.9 + Math.random() * 0.7, 0.22,
          Math.random() * 3, false); // toco de árvore queimada
  }

  // ---------- arame farpado ----------
  const pontosArame = [];
  for (const zBase of [50, 51.4]) {
    for (let x = -MEIA_LARGURA + 1; x < MEIA_LARGURA - 1; x += 1.15) {
      const h = 0.85;
      bloco(MAT.metal, x, CHAO, zBase, 0.08, h, 0.08, 0, false);
      for (let k = 0; k < 3; k++) {
        const y = CHAO + 0.25 + k * 0.28;
        pontosArame.push(x, y, zBase, x + 1.15, y + (Math.random() - 0.5) * 0.18, zBase);
      }
    }
    // duas brechas no arame, senão não há como avançar
    for (const [de, ate] of TRECHOS_ARAME) {
      colisores.push({ minX: de, maxX: ate, minY: CHAO, maxY: CHAO + 0.85,
                       minZ: zBase - 0.2, maxZ: zBase + 0.2 });
    }
  }
  const geoArame = new THREE.BufferGeometry();
  geoArame.setAttribute('position', new THREE.Float32BufferAttribute(pontosArame, 3));
  grupo.add(new THREE.LineSegments(geoArame, MAT.arame));

  // ---------- bunker ----------
  const zB = 86;
  bloco(MAT.concreto, 0, CHAO, zB, 9.5, 1.15, 5.5, 0, true, true);          // corpo baixo
  bloco(MAT.concreto, 0, CHAO + 1.55, zB, 9.5, 1.35, 5.5, 0, true, true);   // acima da seteira
  bloco(MAT.concreto, -3.6, CHAO + 1.15, zB - 2.6, 2.3, 0.4, 0.4, 0, false);
  bloco(MAT.concreto, 3.6, CHAO + 1.15, zB - 2.6, 2.3, 0.4, 0.4, 0, false);
  bloco(MAT.metal, 0, CHAO, zB - 2.85, 1.3, 2.0, 0.18, 0, false);           // porta
  parapeito(-5.6, zB - 3.2, 3.0, 3, 0.35);
  parapeito(5.6, zB - 3.2, 3.0, 3, -0.35);

  // ---------- pontos de avanço do esquema sobre trilhos ----------
  const avancos = [
    new THREE.Vector3(0, CHAO, 4),
    new THREE.Vector3(-2.4, CHAO, 17),
    new THREE.Vector3(3.0, CHAO, 26),
    new THREE.Vector3(-4.0, CHAO, 34),
    new THREE.Vector3(1.6, CHAO, 44),
    new THREE.Vector3(-2.2, CHAO, 54),   // pela brecha esquerda do arame
    new THREE.Vector3(2.8, CHAO, 63),
    new THREE.Vector3(-1.0, CHAO, 74),
    new THREE.Vector3(0, CHAO, 81),
  ];
  // todos ganham marca: no esquema sobre trilhos o que vale é a proximidade do
  // jogador, não a ordem na lista
  for (const p of avancos) {
    // Anel no chão mais uma coluna: só o anel some no barro a dez metros, e a
    // dez metros é justamente onde ele precisa ser visto para virar alvo de toque.
    const marca = new THREE.Group();
    const cor = 0xf0bc46;
    const anel = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.9, 18), new THREE.MeshBasicMaterial({
      color: cor, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    }));
    anel.rotation.x = -Math.PI / 2;
    anel.position.y = 0.04;
    const coluna = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 1.5, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: cor, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    coluna.position.y = 0.75;
    marca.add(anel, coluna);
    marca.position.set(p.x, CHAO, p.z);
    marca.visible = false;
    marca.userData.materiais = [anel.material, coluna.material];
    marca.userData.opacidades = [0.75, 0.22];
    grupo.add(marca);
    p.marca = marca;
  }

  // ---------- sacos de areia instanciados ----------
  const malhaSacos = new THREE.InstancedMesh(CAIXA, MAT.saco, sacos.length);
  sacos.forEach((m, i) => malhaSacos.setMatrixAt(i, m));
  malhaSacos.instanceMatrix.needsUpdate = true;
  malhaSacos.castShadow = true;
  malhaSacos.receiveShadow = true;
  grupo.add(malhaSacos);

  return { grupo, colisores, coberturas, avancos, bunker: new THREE.Vector3(0, CHAO, zB - 3.6) };
}

/** Céu de guerra: nublado, baixo, sem sol visível. */
export function montarCeu(cena) {
  const cor = new THREE.Color(0x8f9184);
  cena.background = cor;
  cena.fog = new THREE.Fog(cor, 38, 155);

  const hemi = new THREE.HemisphereLight(0xc6c9ba, 0x7d7059, 1.25);
  cena.add(hemi);

  const sol = new THREE.DirectionalLight(0xfff2d8, 1.05);
  sol.position.set(-15, 40, -9);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  const c = sol.shadow.camera;
  c.left = -16; c.right = 16; c.top = 22; c.bottom = -22; c.near = 1; c.far = 90;
  sol.shadow.bias = -0.0016;
  sol.shadow.normalBias = 0.03;
  cena.add(sol);
  cena.add(sol.target);
  return sol;
}
