// Desenho do mundo. Tudo instanciado: a grade inteira é uma malha só, cada
// espécie é outra. Com 6400 tiles e centenas de agentes, um objeto por coisa
// derrubaria o quadro no celular antes do jogo começar.

import * as THREE from 'three';
import { N, T, TERRENOS, NIVEL_MAR } from './mundo.js';

const CAIXA = new THREE.BoxGeometry(1, 1, 1);
const ALTURA_MIN = 0.35;
const COR_MAR = 0x2b5f80;

/** Altura visual da coluna de um tile. */
function alturaColuna(mundo, i) {
  return Math.max(ALTURA_MIN, 0.5 + mundo.altura[i] * 1.5);
}

export class Render {
  constructor(cena, mundo) {
    this.mundo = mundo;
    this.cena = cena;
    this.cor = new THREE.Color();
    this._tinta = new THREE.Color();
    this.aux = new THREE.Object3D();

    // ---------- terreno ----------
    this.chao = new THREE.InstancedMesh(
      CAIXA,
      new THREE.MeshLambertMaterial({ vertexColors: false }),
      N * N,
    );
    this.chao.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.chao.receiveShadow = true;
    this.chao.castShadow = false;
    cena.add(this.chao);
    for (let i = 0; i < N * N; i++) this.escreverTile(i);
    this.chao.instanceMatrix.needsUpdate = true;
    this.chao.instanceColor.needsUpdate = true;

    // ---------- mar ----------
    // bem maior que a ilha: com N+30 a borda do plano aparecia como um losango
    // no meio do oceano
    const mar = new THREE.Mesh(
      new THREE.PlaneGeometry(N * 6, N * 6),
      new THREE.MeshLambertMaterial({ color: COR_MAR, transparent: true, opacity: 0.9 }),
    );
    mar.rotation.x = -Math.PI / 2;
    mar.position.set(N / 2, NIVEL_MAR * 1.5 + 0.42, N / 2);
    cena.add(mar);
    this.mar = mar;

    // ---------- árvores ----------
    const tronco = new THREE.CylinderGeometry(0.07, 0.09, 0.42, 5);
    tronco.translate(0, 0.21, 0);
    const copa = new THREE.ConeGeometry(0.32, 0.8, 6);
    copa.translate(0, 0.78, 0);
    this.arvores = new THREE.InstancedMesh(
      fundir([tronco, copa], [0x4a3520, 0x2f5a2c]),
      new THREE.MeshLambertMaterial({ vertexColors: true }),
      4200,
    );
    this.arvores.castShadow = true;
    this.arvores.frustumCulled = false;
    cena.add(this.arvores);
    this.refazerArvores();

    // ---------- seres ----------
    this.humanos = this.criarEspecie(corpoHumano(), 520);
    this.rebanhos = this.criarEspecie(corpoRebanho(), 260);
    this.predadores = this.criarEspecie(corpoPredador(), 70);
    this.ocas = this.criarEspecie(corpoOca(), 160);

    // ---------- destaque do pincel ----------
    this.alvoPincel = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.0, 28),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55,
                                    side: THREE.DoubleSide, depthTest: false }),
    );
    this.alvoPincel.rotation.x = -Math.PI / 2;
    this.alvoPincel.renderOrder = 9;
    this.alvoPincel.visible = false;
    cena.add(this.alvoPincel);
  }

  criarEspecie(geo, teto) {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), teto);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.castShadow = true;
    m.frustumCulled = false;
    m.count = 0;
    this.cena.add(m);
    return m;
  }

  /**
   * Cor do tile, sem o dono. A água sai plana e igual à do mar aberto: com o
   * sombreado de relevo aplicado nela, o quadrado da grade aparecia como um
   * losango mais claro no meio do oceano.
   */
  corDoTile(i) {
    const { mundo } = this;
    const tipo = mundo.terreno[i];
    if (tipo === T.AGUA) return this.cor.set(COR_MAR);
    this.cor.set(TERRENOS[tipo].cor);
    if (tipo === T.PLANTACAO) this.cor.lerp(this._tinta.set(0xe0c257), mundo.crescer[i] * 0.8);
    return this.cor.multiplyScalar(0.78 + Math.min(0.45, mundo.altura[i] * 0.22));
  }

  /** Posição e cor de um tile. A cor carrega o dono: é como se lê o mapa. */
  escreverTile(i) {
    const { mundo } = this;
    const x = i % N, y = (i / N) | 0;
    const h = alturaColuna(mundo, i);
    this.aux.position.set(x, h / 2 - 1, y);
    this.aux.scale.set(1, h + 2, 1);
    this.aux.rotation.set(0, 0, 0);
    this.aux.updateMatrix();
    this.chao.setMatrixAt(i, this.aux.matrix);

    this.corDoTile(i);
    this.chao.setColorAt(i, this.cor);
  }

  /** Repinta o território das tribos por cima da cor do terreno. */
  pintarDominios(tribos) {
    const { mundo } = this;
    const porId = new Map(tribos.map((t) => [t.id, t]));
    for (let i = 0; i < N * N; i++) {
      this.corDoTile(i);
      const dono = mundo.dono[i];
      if (dono !== -1) {
        const t = porId.get(dono);
        if (t) this.cor.lerp(this._tinta.set(t.cor), 0.26);
      }
      this.chao.setColorAt(i, this.cor);
    }
    this.chao.instanceColor.needsUpdate = true;
  }

  /** Aplica os tiles que a simulação marcou como mudados. */
  aplicarSujos() {
    const { mundo } = this;
    if (!mundo.sujo.size) return false;
    let mexeuFloresta = false;
    for (const i of mundo.sujo) {
      this.escreverTile(i);
      if (mundo.terreno[i] === T.FLORESTA || mundo.base[i] === T.FLORESTA) mexeuFloresta = true;
    }
    mundo.sujo.clear();
    this.chao.instanceMatrix.needsUpdate = true;
    this.chao.instanceColor.needsUpdate = true;
    if (mexeuFloresta) this.refazerArvores();
    return true;
  }

  refazerArvores() {
    const { mundo } = this;
    let n = 0;
    for (let i = 0; i < N * N; i++) {
      if (mundo.terreno[i] !== T.FLORESTA) continue;
      if (n >= 4200) break;
      const x = i % N, y = (i / N) | 0;
      const j = (i * 2654435761) >>> 0;          // dispersão estável por tile
      const dx = ((j & 255) / 255 - 0.5) * 0.6;
      const dz = (((j >> 8) & 255) / 255 - 0.5) * 0.6;
      const s = 0.75 + ((j >> 16) & 255) / 255 * 0.6;
      this.aux.position.set(x + dx, alturaColuna(mundo, i) - 1, y + dz);
      this.aux.rotation.set(0, ((j >> 4) & 255) / 255 * 6.28, 0);
      this.aux.scale.set(s, s, s);
      this.aux.updateMatrix();
      this.arvores.setMatrixAt(n++, this.aux.matrix);
    }
    this.arvores.count = n;
    this.arvores.instanceMatrix.needsUpdate = true;
  }

  /** Uma passada por quadro em cima dos agentes vivos. */
  atualizarSeres(sim) {
    const { mundo } = this;
    const altura = (x, y) => {
      const xi = Math.round(x), yi = Math.round(y);
      if (!mundo.dentro(xi, yi)) return 0;
      return alturaColuna(mundo, mundo.idx(xi, yi)) - 1;
    };

    let n = 0;
    for (const h of sim.humanos) {
      if (!h.viva || n >= 520) continue;
      this.aux.position.set(h.x, altura(h.x, h.y), h.y);
      const s = h.adulto ? 1 : 0.62;
      this.aux.scale.set(s, s, s);
      this.aux.rotation.set(0, 0, 0);
      this.aux.updateMatrix();
      this.humanos.setMatrixAt(n, this.aux.matrix);
      this.cor.set(h.tribo ? h.tribo.cor : 0xdedede);
      if (h.fome > 0.75) this.cor.lerp(new THREE.Color(0x1a1a1a), 0.45);
      this.humanos.setColorAt(n, this.cor);
      n++;
    }
    this.humanos.count = n;
    this.humanos.instanceMatrix.needsUpdate = true;
    if (this.humanos.instanceColor) this.humanos.instanceColor.needsUpdate = true;

    n = 0;
    for (const r of sim.rebanhos) {
      if (!r.viva || n >= 260) continue;
      this.aux.position.set(r.x, altura(r.x, r.y), r.y);
      this.aux.scale.setScalar(1);
      this.aux.updateMatrix();
      this.rebanhos.setMatrixAt(n, this.aux.matrix);
      this.cor.set(r.domesticado ? 0xf0e6d2 : 0xc9b48c);
      this.rebanhos.setColorAt(n, this.cor);
      n++;
    }
    this.rebanhos.count = n;
    this.rebanhos.instanceMatrix.needsUpdate = true;
    if (this.rebanhos.instanceColor) this.rebanhos.instanceColor.needsUpdate = true;

    n = 0;
    for (const p of sim.predadores) {
      if (!p.viva || n >= 70) continue;
      this.aux.position.set(p.x, altura(p.x, p.y), p.y);
      this.aux.scale.setScalar(1);
      this.aux.updateMatrix();
      this.predadores.setMatrixAt(n, this.aux.matrix);
      this.cor.set(0x8c3a2a);
      this.predadores.setColorAt(n, this.cor);
      n++;
    }
    this.predadores.count = n;
    this.predadores.instanceMatrix.needsUpdate = true;
    if (this.predadores.instanceColor) this.predadores.instanceColor.needsUpdate = true;

    n = 0;
    for (const t of sim.tribos) {
      for (const o of t.ocas) {
        if (n >= 160) break;
        this.aux.position.set(o.x, altura(o.x, o.y), o.y);
        this.aux.scale.setScalar(1);
        this.aux.updateMatrix();
        this.ocas.setMatrixAt(n, this.aux.matrix);
        this.cor.set(t.cor).lerp(new THREE.Color(0x6b5334), 0.45);
        this.ocas.setColorAt(n, this.cor);
        n++;
      }
    }
    this.ocas.count = n;
    this.ocas.instanceMatrix.needsUpdate = true;
    if (this.ocas.instanceColor) this.ocas.instanceColor.needsUpdate = true;
  }

  marcarPincel(x, y, raio, visivel) {
    this.alvoPincel.visible = visivel;
    if (!visivel) return;
    const i = this.mundo.dentro(Math.round(x), Math.round(y))
      ? this.mundo.idx(Math.round(x), Math.round(y)) : 0;
    this.alvoPincel.position.set(x, alturaColuna(this.mundo, i) - 0.92, y);
    this.alvoPincel.scale.setScalar(Math.max(0.6, raio));
  }
}

/** Junta geometrias com uma cor fixa por peça, em vertexColors. */
function fundir(geos, cores) {
  const pos = [], nor = [], cor = [], idx = [];
  const c = new THREE.Color();
  let base = 0;
  geos.forEach((g, k) => {
    const p = g.attributes.position, nn = g.attributes.normal;
    c.set(cores[k]);
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(nn.getX(i), nn.getY(i), nn.getZ(i));
      cor.push(c.r, c.g, c.b);
    }
    const ind = g.index ? [...g.index.array] : [...Array(p.count).keys()];
    for (const i of ind) idx.push(base + i);
    base += p.count;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  g.setIndex(idx);
  return g;
}

// As silhuetas são propositalmente distintas: de longe, num mapa colorido, o
// que se lê é a forma, não a cor.
function corpoHumano() {
  const corpo = new THREE.CylinderGeometry(0.16, 0.2, 0.5, 5);
  corpo.translate(0, 0.25, 0);
  const cabeca = new THREE.SphereGeometry(0.14, 6, 5);
  cabeca.translate(0, 0.6, 0);
  return fundir([corpo, cabeca], [0xffffff, 0xe8c9a6]);
}
function corpoRebanho() {
  const tronco = new THREE.BoxGeometry(0.5, 0.28, 0.28);
  tronco.translate(0, 0.28, 0);
  const cabeca = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  cabeca.translate(0.32, 0.34, 0);
  return fundir([tronco, cabeca], [0xffffff, 0xffffff]);
}
function corpoPredador() {
  const tronco = new THREE.BoxGeometry(0.52, 0.2, 0.22);
  tronco.translate(0, 0.2, 0);
  const cabeca = new THREE.ConeGeometry(0.14, 0.3, 4);
  cabeca.rotateZ(-Math.PI / 2);
  cabeca.translate(0.36, 0.24, 0);
  return fundir([tronco, cabeca], [0xffffff, 0xffffff]);
}
function corpoOca() {
  const parede = new THREE.CylinderGeometry(0.34, 0.38, 0.3, 6);
  parede.translate(0, 0.15, 0);
  const telhado = new THREE.ConeGeometry(0.46, 0.42, 6);
  telhado.translate(0, 0.5, 0);
  return fundir([parede, telhado], [0xffffff, 0x8a6a3c]);
}
