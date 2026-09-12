// M1 Garand: semiautomático, 8 tiros, recarga em bloco. Aqui também mora a
// assistência de mira, que é o botão de volume do experimento — é ela que decide
// se o toque é jogável ou frustrante.

import * as THREE from 'three';
import { raioVsMundo } from './collision.js';
import { cfg, ASSIST } from './settings.js';

const CADENCIA = 0.19;
const RECARGA = 2.3;
const PENTE = 8;
const ALCANCE = 140;
const DISPERSAO_QUADRIL = 0.019;
const DISPERSAO_MIRA = 0.0022;
const CAIXA = new THREE.BoxGeometry(1, 1, 1);

const MAT = {
  madeira: new THREE.MeshLambertMaterial({ color: 0x5b4025 }),
  metal:   new THREE.MeshLambertMaterial({ color: 0x2b2b2e }),
  pele:    new THREE.MeshLambertMaterial({ color: 0xb2855f }),
  manga:   new THREE.MeshLambertMaterial({ color: 0x6b6b4a }),
};

export class Fuzil {
  constructor(camera, cena) {
    this.camera = camera;
    this.pente = PENTE;
    this.reserva = 48;
    this.esfriando = 0;
    this.recarregando = 0;
    this.disparados = 0;
    this.acertos = 0;

    // --- modelo de mão, filho da câmera ---
    // Origem local no eixo do cano. A altura da linha de mira (ALTURA_MIRA) é o
    // número que faz a posição de mira funcionar: basta descer o grupo por ela
    // para os dois pontos de mira caírem no centro exato da tela.
    this.grupo = new THREE.Group();
    const add = (mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(CAIXA, mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.rotation.set(rx, ry, rz);
      this.grupo.add(m);
      return m;
    };
    const ALTURA_MIRA = 0.048;
    add(MAT.metal,   0,  0,      -0.32, 0.017, 0.017, 0.40);          // cano
    add(MAT.madeira, 0, -0.006,  -0.20, 0.044, 0.048, 0.28);          // guarda-mão
    add(MAT.metal,   0,  0.004,   0.02, 0.036, 0.044, 0.20);          // caixa da culatra
    add(MAT.madeira, 0, -0.020,   0.16, 0.048, 0.070, 0.14);          // coronha
    add(MAT.madeira, 0.004, -0.055, 0.03, 0.034, 0.075, 0.05, 0.30);  // punho
    add(MAT.metal,   0, ALTURA_MIRA, -0.50, 0.011, 0.045, 0.020);     // massa de mira
    add(MAT.metal,   0, ALTURA_MIRA,  0.06, 0.030, 0.026, 0.020);     // alça de mira
    add(MAT.metal,  0.026, 0.012, 0.050, 0.030, 0.014, 0.014);        // ferrolho
    add(MAT.metal,  0,    -0.028, -0.300, 0.012, 0.026, 0.030);       // anel da bandoleira

    // Duas mãos na arma e nada além delas. Antebraços inteiros num viewmodel só
    // funcionam se saírem do enquadramento; parados no ar viram blocos soltos no
    // canto da tela, que lê pior do que não ter braço nenhum.
    add(MAT.pele,  0.024, -0.056,  0.028, 0.060, 0.072, 0.088);   // mão do gatilho
    add(MAT.manga, 0.030, -0.060,  0.095, 0.072, 0.082, 0.075);   // punho, só o começo da manga
    add(MAT.pele, -0.008, -0.046, -0.188, 0.056, 0.066, 0.100);   // mão de apoio
    camera.add(this.grupo);
    cena.add(camera);

    this.bocaLocal = new THREE.Object3D();
    this.bocaLocal.position.set(0, 0, -0.55);
    this.grupo.add(this.bocaLocal);

    // As duas poses ficam à MESMA distância da câmera e diferem só em x e y.
    // Aproximar a arma ao mirar parece natural mas põe a coronha a 20 cm do olho,
    // e a essa distância um bloco de 7 cm ocupa um terço da tela.
    const DIST = -0.61;
    this.QUADRIL = new THREE.Vector3(0.11, -0.095, DIST);
    // Mirando: descer pela altura da linha de mira alinha as duas miras no centro.
    this.MIRA = new THREE.Vector3(0, -ALTURA_MIRA, DIST);
    this.grupo.position.copy(this.QUADRIL);
    this.mira = 0;         // 0 quadril, 1 mirando
    this.coice = 0;
  }

  get vazio() { return this.pente === 0; }
  get podeAtirar() { return this.esfriando <= 0 && this.recarregando <= 0 && this.pente > 0; }

  iniciarRecarga() {
    if (this.recarregando > 0 || this.pente === PENTE || this.reserva === 0) return false;
    this.recarregando = RECARGA;
    return true;
  }

  atualizar(dt, mirando) {
    this.esfriando = Math.max(0, this.esfriando - dt);
    if (this.recarregando > 0) {
      this.recarregando -= dt;
      if (this.recarregando <= 0) {
        const falta = Math.min(PENTE - this.pente, this.reserva);
        this.pente += falta;
        this.reserva -= falta;
        this.recarregando = 0;
      }
    }
    this.mira += ((mirando ? 1 : 0) - this.mira) * Math.min(1, dt * 12);
    this.coice = Math.max(0, this.coice - dt * 5.5);

    const alvo = new THREE.Vector3().lerpVectors(this.QUADRIL, this.MIRA, this.mira);
    alvo.z += this.coice * 0.045;
    alvo.y += this.coice * 0.010;
    this.grupo.position.lerp(alvo, Math.min(1, dt * 20));
    this.grupo.rotation.x = this.coice * 0.16;
    this.grupo.rotation.y = (1 - this.mira) * 0.07;   // de quadril a arma fica de viés
    // durante a recarga a arma cai para fora do enquadramento
    if (this.recarregando > 0) {
      const f = Math.sin((1 - this.recarregando / RECARGA) * Math.PI);
      this.grupo.position.y -= f * 0.13;
      this.grupo.rotation.z = f * 0.55;
    } else {
      this.grupo.rotation.z = 0;
    }
  }

  /**
   * Um disparo. Devolve o que foi atingido para quem chamou tratar HUD e som.
   * @returns {{acertou:boolean, matou:boolean, ponto:THREE.Vector3, alvo:any}}
   */
  disparar(jogador, inimigos, colisores, fx, som) {
    this.pente--;
    this.disparados++;
    this.esfriando = CADENCIA;
    this.coice = 1;

    const dispersao = (this.mira > 0.7 ? DISPERSAO_MIRA : DISPERSAO_QUADRIL)
      * (jogador.agachado ? 0.6 : 1)
      * (1 + Math.hypot(jogador.vel.x, jogador.vel.z) * 0.28);

    const dir = jogador.direcao(new THREE.Vector3());
    // magnetismo: dobra o tiro para dentro do alvo se ele estiver no cone
    const nivel = ASSIST[Math.max(0, Math.min(3, cfg.assist | 0))];
    const origem = jogador.olhoMundo(new THREE.Vector3());
    const alvoMag = nivel.cone > 0 ? melhorAlvo(origem, dir, inimigos, colisores, nivel.cone) : null;
    if (alvoMag) dir.copy(alvoMag.ponto).sub(origem).normalize();

    dir.x += (Math.random() - 0.5) * dispersao;
    dir.y += (Math.random() - 0.5) * dispersao;
    dir.z += (Math.random() - 0.5) * dispersao;
    dir.normalize();

    const boca = this.bocaLocal.getWorldPosition(new THREE.Vector3());
    fx.fogo(boca);
    som?.tiroJogador();
    jogador.recuo.y += 0.021 + Math.random() * 0.011;
    jogador.recuo.x += (Math.random() - 0.5) * 0.011;

    // primeiro impacto: parede ou soldado, o que vier antes
    const tParede = raioVsMundo(origem, dir, colisores, ALCANCE);
    let melhor = null;
    for (const s of inimigos) {
      const h = s.testarTiro(origem, dir, Math.min(tParede, ALCANCE));
      if (h && (!melhor || h.t < melhor.t)) melhor = { ...h, alvo: s };
    }

    if (melhor) {
      this.acertos++;
      const matou = melhor.alvo.receberTiro(melhor.dano);
      fx.traco(boca, melhor.ponto);
      fx.impacto(melhor.ponto, dirInversa(dir), 0x9c2b22, matou ? 12 : 6);
      return { acertou: true, matou, ponto: melhor.ponto, alvo: melhor.alvo };
    }

    const ponto = origem.clone().addScaledVector(dir, Math.min(tParede, ALCANCE));
    fx.traco(boca, ponto);
    if (tParede < ALCANCE) fx.impacto(ponto, dirInversa(dir), 0x8a7d58, 6);
    return { acertou: false, matou: false, ponto, alvo: null };
  }
}

function dirInversa(d) {
  return new THREE.Vector3(-d.x * 0.4, 0.6, -d.z * 0.4);
}

/**
 * Soldado visível mais próximo do centro da tela, dentro de um cone em graus.
 * Serve tanto para o magnetismo do tiro quanto para a cola da mira.
 */
export function melhorAlvo(origem, dir, inimigos, colisores, cone) {
  const cosLimite = Math.cos((cone * Math.PI) / 180);
  const v = new THREE.Vector3();
  let melhor = null;
  for (const s of inimigos) {
    if (!s.vivo || s.exposicao < 0.25) continue;
    s.pontoDeMira(v);
    const d = v.clone().sub(origem);
    const dist = d.length();
    if (dist > 90) continue;
    d.divideScalar(dist);
    const cos = d.dot(dir);
    if (cos < cosLimite) continue;
    if (raioVsMundo(origem, d, colisores, dist) < dist - 0.3) continue;
    if (!melhor || cos > melhor.cos) melhor = { cos, dist, ponto: v.clone(), alvo: s };
  }
  return melhor;
}

/**
 * Cola da mira: puxa a câmera de leve na direção do alvo. Roda todo quadro,
 * antes do jogador ser atualizado.
 */
export function colarMira(dt, jogador, inimigos, colisores) {
  const nivel = ASSIST[Math.max(0, Math.min(3, cfg.assist | 0))];
  if (nivel.cola <= 0) return null;
  const origem = jogador.olhoMundo(new THREE.Vector3());
  const dir = jogador.direcao(new THREE.Vector3());
  const alvo = melhorAlvo(origem, dir, inimigos, colisores, nivel.cone * 1.35);
  if (!alvo) return null;

  const para = alvo.ponto.clone().sub(origem).normalize();
  const yawAlvo = Math.atan2(-para.x, -para.z);
  const pitchAlvo = Math.asin(Math.max(-1, Math.min(1, para.y)));
  let dYaw = ((yawAlvo - jogador.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const dPitch = pitchAlvo - jogador.pitch;
  // mais forte quanto mais perto do centro; nunca mira sozinho de longe
  const força = nivel.cola * Math.min(1, dt * 6) * (1 - Math.min(1, alvo.dist / 70));
  jogador.yaw += dYaw * força;
  jogador.pitch += dPitch * força;
  return alvo;
}
