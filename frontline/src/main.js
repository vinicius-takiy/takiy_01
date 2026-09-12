// Cola tudo e roda o laço. A regra desta fatia: nada aqui pode depender de qual
// esquema de controle está ativo além do que `settings.js` declara — trocar de
// esquema no meio da partida tem que funcionar.

import * as THREE from 'three';
import { construirSetor, montarCeu, CHAO } from './level.js';
import { Jogador } from './player.js';
import { Soldado, EXPOSTOS_AO_MESMO_TEMPO } from './enemy.js';
import { Fuzil, colarMira, melhorAlvo } from './weapon.js';
import { Efeitos } from './fx.js';
import { Som } from './audio.js';
import { Hud } from './hud.js';
import { entrada, aplicarLayout, lerTeclado, limparQuadro, ligarMouse, soltarTudo } from './input.js';
import { cfg, esquemaAtual, ASSIST } from './settings.js';

const FOV_QUADRIL = 74;
const FOV_MIRA = 46;

// ---------- renderizador ----------
const canvas = document.createElement('canvas');
document.body.insertBefore(canvas, document.body.firstChild);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: window.devicePixelRatio < 2,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
// sem curva de tom o Lambert chapado achata o modelo novo: os volumes do capacete
// e dos ombros só aparecem depois disto
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV_QUADRIL, 1, 0.05, 400);
const sol = montarCeu(cena);

const setor = construirSetor();
cena.add(setor.grupo);

const fx = new Efeitos(cena);
const som = new Som();
const jogador = new Jogador(camera);
const fuzil = new Fuzil(camera, cena);
let inimigos = [];

// ---------- estado da partida ----------
const jogo = {
  rodando: false,
  tempo: 0,
  abatidos: 0,
  objetivo: 'Elimine a resistência',
};

const hud = new Hud({
  aoIniciar: () => comecar(),
  aoFecharCfg: () => { jogo.rodando = true; soltarTudo(); },
});
hud.aoMudarEsquema = () => { aplicarLayout(); ajustarMarcasAvanco(); };
hud.telas('menu');
aplicarLayout();
ligarMouse(canvas);

function comecar() {
  som.ligado = cfg.som;
  som.acordar();

  for (const s of inimigos) cena.remove(s.grupo);
  inimigos = setor.coberturas.map((c) => {
    const s = new Soldado(c.pos.clone(), c.altura, Math.atan2(c.pos.x, c.pos.z + 6));
    cena.add(s.grupo);
    return s;
  });

  jogador.pos.set(0, CHAO, -6);
  jogador.vel.set(0, 0, 0);
  jogador.yaw = Math.PI;         // olhando para +Z, o rumo do avanço
  jogador.pitch = 0;
  jogador.vida = jogador.vidaMax;
  jogador.morto = false;
  jogador.danoRecebido = 0;
  jogador.trilho = null;
  fuzil.pente = 8;
  fuzil.reserva = 48;
  fuzil.recarregando = 0;
  fuzil.disparados = fuzil.acertos = 0;
  fx.esconderTudo();

  jogo.rodando = true;
  jogo.tempo = 0;
  jogo.abatidos = 0;
  jogo.objetivo = 'Elimine a resistência';
  entrada.ativo = true;
  soltarTudo();
  ajustarMarcasAvanco();
}

// No esquema sobre trilhos os pontos disponíveis são os que estão perto do
// jogador — não uma sequência fixa. Amarrar isso a um contador quebra assim que
// ele troca de esquema no meio do setor e chega ao ponto pelo caminho errado.
const ALCANCE_AVANCO = 22;

function ajustarMarcasAvanco() {
  const usaTrilho = esquemaAtual().mover === 'trilho' && jogo.rodando;
  for (const p of setor.avancos) {
    if (!p.marca) continue;
    const d = Math.hypot(p.x - jogador.pos.x, p.z - jogador.pos.z);
    p.marca.visible = usaTrilho && d < ALCANCE_AVANCO && d > 1.2;
  }
}

/** Toque no mundo, no esquema sobre trilhos: anda até a cobertura tocada. */
function tratarToqueMundo(ndc) {
  if (esquemaAtual().mover !== 'trilho') return;
  const raio = new THREE.Raycaster();
  raio.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -CHAO);
  const alvo = new THREE.Vector3();
  if (!raio.ray.intersectPlane(plano, alvo)) return;

  // o toque não precisa ser preciso: vale a marca mais perto do dedo
  let melhor = null, melhorD = 9;
  for (const p of setor.avancos) {
    if (!p.marca?.visible) continue;
    const d = Math.hypot(p.x - alvo.x, p.z - alvo.z);
    if (d < melhorD) { melhorD = d; melhor = p; }
  }
  if (melhor) jogador.trilho = melhor;
}

// ---------- laço ----------
let anterior = performance.now();
let pulso = 0;

let mediaDt = 1 / 60;

function quadro(agora) {
  requestAnimationFrame(quadro);
  const dt = Math.min(0.05, (agora - anterior) / 1000);
  anterior = agora;
  mediaDt += (dt - mediaDt) * 0.06;

  if (jogo.rodando) passo(dt);
  limparQuadro();
  fx.atualizar(dt);
  renderer.render(cena, camera);
  publicarEstado();
}

/**
 * Janela para fora do jogo. Existe para o teste de fumaça conseguir afirmar algo
 * sobre a partida, e para depurar no celular sem cabo — abre o console e lê.
 */
function publicarEstado() {
  // atalho para o retrato do teste: expõe os objetos vivos, não só números
  window.__jogo = { jogador, inimigos, fuzil, jogo, camera, setor };
  window.__debug = {
    rodando: jogo.rodando,
    x: jogador.pos.x, z: jogador.pos.z,
    vida: Math.round(jogador.vida),
    pente: fuzil.pente, reserva: fuzil.reserva,
    recarregando: fuzil.recarregando > 0,
    disparados: fuzil.disparados, acertos: fuzil.acertos,
    inimigos: inimigos.length,
    vivos: inimigos.filter((s) => s.vivo).length,
    esquema: cfg.esquema,
    tempo: jogo.tempo,
    abatidos: jogo.abatidos,
    fov: camera.fov,
    fps: 1 / Math.max(1e-4, mediaDt),
  };
}

function passo(dt) {
  jogo.tempo += dt;
  pulso += dt;
  lerTeclado();

  const mirando = entrada.mirando;

  // assistência de mira antes do movimento, para o recuo entrar por cima
  const grudado = colarMira(dt, jogador, inimigos, setor.colisores);
  jogador.atualizar(dt, entrada, setor.colisores, mirando);

  if (entrada.toqueMundo) tratarToqueMundo(entrada.toqueMundo);

  // --- arma ---
  fuzil.atualizar(dt, mirando);
  if (entrada.recarregar && fuzil.iniciarRecarga()) som.recarga();
  if (fuzil.vazio && fuzil.recarregando <= 0 && fuzil.reserva > 0) {
    if (fuzil.iniciarRecarga()) som.recarga();
  }

  const nivel = ASSIST[Math.max(0, Math.min(3, cfg.assist | 0))];
  const origem = jogador.olhoMundo(new THREE.Vector3());
  const dir = jogador.direcao(new THREE.Vector3());
  const naMira = melhorAlvo(origem, dir, inimigos, setor.colisores, Math.max(1.4, nivel.cone * 0.6));

  // segurar o botão repete no ritmo da arma: exigir toque por tiro é castigo no toque
  const querAtirar = entrada.atirouAgora || entrada.atirando || (cfg.autofogo && !!naMira);

  if (querAtirar) {
    if (fuzil.podeAtirar) {
      const r = fuzil.disparar(jogador, inimigos, setor.colisores, fx, som);
      if (r.acertou) {
        hud.marcarAcerto(r.matou);
        r.matou ? som.morteInimigo() : som.acerto();
        if (r.matou) jogo.abatidos++;
      }
      if (fuzil.pente === 0) som.garandPing();
    } else if (fuzil.vazio && fuzil.recarregando <= 0) {
      som.gatilhoVazio();
    }
  }

  // --- inimigos ---
  // orçamento de exposição: quem já está de pé consome a vaga do quadro
  const jaExpostos = inimigos.filter((s) => s.vivo && (s.estado === 'espiando' || s.estado === 'atirando')).length;
  const ctx = {
    jogador, colisores: setor.colisores, fx,
    som: som.pronto ? som : null,
    vagas: { n: Math.max(0, EXPOSTOS_AO_MESMO_TEMPO - jaExpostos) },
  };
  let vivos = 0;
  for (const s of inimigos) {
    if (!jogo.congelar) s.atualizar(dt, ctx);
    if (s.vivo) vivos++;
  }

  // --- objetivo ---
  const distBunker = Math.hypot(jogador.pos.x - setor.bunker.x, jogador.pos.z - setor.bunker.z);
  jogo.objetivo = vivos > 0 ? 'Elimine a resistência' : 'Tome o bunker';
  if (vivos === 0 && distBunker < 3.5) return terminar(true);
  if (jogador.morto) return terminar(false);

  // --- câmera e luz ---
  camera.fov += ((mirando ? FOV_MIRA : FOV_QUADRIL) - camera.fov) * Math.min(1, dt * 12);
  camera.updateProjectionMatrix();
  sol.position.set(jogador.pos.x - 15, 40, jogador.pos.z - 9);
  sol.target.position.set(jogador.pos.x, 0, jogador.pos.z + 6);
  sol.target.updateMatrixWorld();

  // marcas de avanço: quais aparecem depende de onde o jogador está agora
  ajustarMarcasAvanco();
  const brilho = 0.62 + Math.abs(Math.sin(pulso * 2.0)) * 0.38;
  for (const p of setor.avancos) {
    if (!p.marca?.visible) continue;
    const { materiais, opacidades } = p.marca.userData;
    materiais.forEach((m, i) => { m.opacity = opacidades[i] * brilho; });
  }

  hud.atualizar({
    vida: jogador.vida, vidaMax: jogador.vidaMax,
    pente: fuzil.pente, reserva: fuzil.reserva,
    recarregando: fuzil.recarregando > 0,
    objetivo: jogo.objetivo, restantes: vivos,
    alvoNaMira: !!naMira || !!grudado,
  });
}

function terminar(vitoria) {
  jogo.rodando = false;
  entrada.ativo = false;
  soltarTudo();
  if (document.pointerLockElement) document.exitPointerLock();
  const precisao = fuzil.disparados ? Math.round((fuzil.acertos / fuzil.disparados) * 100) : 0;
  hud.fim({
    vitoria,
    stats: [
      ['Esquema', esquemaAtual().nome],
      ['Assistência', ASSIST[cfg.assist | 0].rotulo + (cfg.autofogo ? ' + auto-fogo' : '')],
      ['Tempo', jogo.tempo.toFixed(1) + ' s'],
      ['Abatidos', `${jogo.abatidos} de ${inimigos.length}`],
      ['Precisão', `${precisao}% (${fuzil.acertos}/${fuzil.disparados})`],
      ['Dano recebido', Math.round(jogador.danoRecebido)],
    ],
  });
  for (const p of setor.avancos) if (p.marca) p.marca.visible = false;
}

// ---------- janela ----------
function redimensionar() {
  const l = window.innerWidth, a = window.innerHeight;
  renderer.setSize(l, a, false);
  camera.aspect = l / a;
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionar);
addEventListener('orientationchange', () => setTimeout(redimensionar, 120));
redimensionar();

document.addEventListener('visibilitychange', () => {
  if (document.hidden && jogo.rodando) { jogo.rodando = false; hud.telas('cfg', 'jogo'); soltarTudo(); }
});

// primeiro toque destrava o áudio no iOS
addEventListener('pointerdown', () => { if (cfg.som) { som.ligado = true; som.acordar(); } }, { once: true });

requestAnimationFrame(quadro);
document.getElementById('carregando').remove();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
