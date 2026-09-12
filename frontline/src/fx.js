// Efeitos: traçantes, poeira de impacto e clarão de boca. Tudo em pools de
// tamanho fixo — nada é criado durante o jogo, porque alocar no meio do quadro é
// o caminho mais curto para engasgo no Safari.

import * as THREE from 'three';

const MAX_TRACO = 28;
const MAX_PART = 150;

export class Efeitos {
  constructor(cena) {
    // --- traçantes ---
    this.tracos = Array.from({ length: MAX_TRACO }, () => ({ vida: 0, dur: 0.09 }));
    const g = new THREE.BufferGeometry();
    this.posTraco = new Float32Array(MAX_TRACO * 6);
    g.setAttribute('position', new THREE.BufferAttribute(this.posTraco, 3));
    this.malhaTracos = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
      color: 0xffd88a, transparent: true, opacity: 0.85, depthWrite: false,
    }));
    this.malhaTracos.frustumCulled = false;
    cena.add(this.malhaTracos);

    // --- partículas de impacto ---
    this.parts = Array.from({ length: MAX_PART }, () => ({
      vida: 0, dur: 1, v: new THREE.Vector3(), p: new THREE.Vector3(),
    }));
    const gp = new THREE.BufferGeometry();
    this.posPart = new Float32Array(MAX_PART * 3);
    this.corPart = new Float32Array(MAX_PART * 3);
    gp.setAttribute('position', new THREE.BufferAttribute(this.posPart, 3));
    gp.setAttribute('color', new THREE.BufferAttribute(this.corPart, 3));
    this.malhaParts = new THREE.Points(gp, new THREE.PointsMaterial({
      size: 0.075, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false,
    }));
    this.malhaParts.frustumCulled = false;
    cena.add(this.malhaParts);

    // --- clarão de boca ---
    const tex = clarao();
    this.clarao = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: 0xffd070, transparent: true, depthWrite: false, depthTest: false, opacity: 0,
    }));
    this.clarao.scale.setScalar(0.5);
    this.clarao.renderOrder = 5;
    cena.add(this.clarao);
    this.claraoVida = 0;

    this.esconderTudo();
  }

  esconderTudo() {
    this.posTraco.fill(0);
    this.posPart.fill(0);
    this.malhaTracos.geometry.attributes.position.needsUpdate = true;
    this.malhaParts.geometry.attributes.position.needsUpdate = true;
  }

  traco(de, para) {
    const t = this.tracos.find((x) => x.vida <= 0) || this.tracos[0];
    t.vida = t.dur;
    t.de = de.clone();
    t.para = para.clone();
  }

  /** @param {THREE.Vector3} p @param {THREE.Vector3} normalAprox @param {number} cor */
  impacto(p, normalAprox, cor = 0x8a7d58, n = 7) {
    const c = new THREE.Color(cor);
    for (let i = 0; i < n; i++) {
      const part = this.parts.find((x) => x.vida <= 0);
      if (!part) return;
      part.vida = part.dur = 0.45 + Math.random() * 0.35;
      part.p.copy(p);
      part.v.set(
        normalAprox.x * 1.4 + (Math.random() - 0.5) * 2.4,
        normalAprox.y * 1.1 + Math.random() * 2.0,
        normalAprox.z * 1.4 + (Math.random() - 0.5) * 2.4,
      );
      part.cor = c;
    }
  }

  fogo(posicao) {
    this.clarao.position.copy(posicao);
    this.claraoVida = 0.045;
    this.clarao.material.rotation = Math.random() * Math.PI;
  }

  atualizar(dt) {
    // traçantes
    let i = 0;
    for (const t of this.tracos) {
      if (t.vida > 0) {
        t.vida -= dt;
        this.posTraco[i * 6 + 0] = t.de.x; this.posTraco[i * 6 + 1] = t.de.y; this.posTraco[i * 6 + 2] = t.de.z;
        this.posTraco[i * 6 + 3] = t.para.x; this.posTraco[i * 6 + 4] = t.para.y; this.posTraco[i * 6 + 5] = t.para.z;
      } else {
        for (let k = 0; k < 6; k++) this.posTraco[i * 6 + k] = 0;
      }
      i++;
    }
    this.malhaTracos.geometry.attributes.position.needsUpdate = true;

    // partículas
    i = 0;
    for (const p of this.parts) {
      if (p.vida > 0) {
        p.vida -= dt;
        p.v.y -= 9.4 * dt;
        p.p.addScaledVector(p.v, dt);
        const f = Math.max(0, p.vida / p.dur);
        this.posPart[i * 3] = p.p.x; this.posPart[i * 3 + 1] = p.p.y; this.posPart[i * 3 + 2] = p.p.z;
        this.corPart[i * 3] = p.cor.r * f; this.corPart[i * 3 + 1] = p.cor.g * f; this.corPart[i * 3 + 2] = p.cor.b * f;
      } else {
        this.posPart[i * 3] = 0; this.posPart[i * 3 + 1] = -999; this.posPart[i * 3 + 2] = 0;
      }
      i++;
    }
    this.malhaParts.geometry.attributes.position.needsUpdate = true;
    this.malhaParts.geometry.attributes.color.needsUpdate = true;

    // clarão
    if (this.claraoVida > 0) {
      this.claraoVida -= dt;
      this.clarao.material.opacity = Math.max(0, this.claraoVida / 0.045);
      this.clarao.scale.setScalar(0.34 + (1 - this.claraoVida / 0.045) * 0.3);
    } else {
      this.clarao.material.opacity = 0;
    }
  }
}

/** Textura do clarão, desenhada em canvas: uma estrela borrada. */
function clarao() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,235,1)');
  g.addColorStop(0.25, 'rgba(255,205,110,.85)');
  g.addColorStop(1, 'rgba(255,150,40,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  x.globalCompositeOperation = 'lighter';
  x.strokeStyle = 'rgba(255,230,170,.75)';
  x.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    x.beginPath();
    x.moveTo(32, 32);
    x.lineTo(32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
