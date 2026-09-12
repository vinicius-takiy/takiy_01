// Amarra tudo e roda. O relógio da simulação é separado do relógio de desenho:
// em 16× o mundo dá dezesseis passos por segundo de tela, e é isso que permite
// assistir a séculos sem esperar séculos.

import * as THREE from 'three';
import { Simulacao } from './sim.js';
import { N, T, TERRENOS } from './mundo.js';
import { Render } from './render.js';
import { Camera } from './camera.js';
import { Interface } from './ui.js';

const PASSO = 1 / 12;          // segundos de simulação por passo
const MAX_PASSOS = 40;         // teto por quadro, para 16× não travar o toque

// ---------- cena ----------
const tela = document.createElement('canvas');
document.body.insertBefore(tela, document.body.firstChild);
const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: window.devicePixelRatio < 2,
                                            alpha: true, premultipliedAlpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const cena = new THREE.Scene();
cena.background = null;
cena.fog = new THREE.Fog(0x6faaa5, 92, 235);
const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 500);

cena.add(new THREE.HemisphereLight(0xe8fff7, 0x56452e, 1.35));
const sol = new THREE.DirectionalLight(0xffe6b0, 1.75);
sol.position.set(N * 0.4, 80, N * 0.1);
sol.target.position.set(N / 2, 0, N / 2);
sol.castShadow = true;
sol.shadow.mapSize.set(1024, 1024);
Object.assign(sol.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 200 });
sol.shadow.bias = -0.0012;
cena.add(sol, sol.target);

// ---------- estado ----------
let sim = null;
let render = null;
let velocidade = 1;
let rodando = false;
let acumulado = 0;
let relogioDominios = 0;

const iface = new Interface({
  aoTrocarVelocidade: (v) => { velocidade = v; },
  aoEnquadrar: () => cam.enquadrarTudo(),
  aoRecomecar: () => novoMundo(),
  aoIlhaPronta: () => novoMundo(undefined, false),
  aoComecar: () => { rodando = true; },
  aoSeguir: (t) => cam.seguir(t),
});

const cam = new Camera(camera, tela, {
  aoPintar: (x, y) => {
    if (!sim || !iface.pincel) return;
    sim.pintar(x, y, iface.raio, iface.pincel);
    const cor = iface.pincel.tipo === 'terreno'
      ? TERRENOS[iface.pincel.terreno].cor : (iface.pincel.cor || 0xefc65b);
    render.pulso(x, y, cor);
  },
  aoTocar: (x, y, clique) => {
    if (!sim) return;
    render.marcarPincel(x, y, iface.raio, !!iface.pincel);
    if (clique) iface.inspecionar(sim, x, y);
  },
});

function novoMundo(semente = (Math.random() * 65535) | 0, pelado = true) {
  if (render) render.descartar();
  sim = new Simulacao(semente, { pelado });
  render = new Render(cena, sim.mundo);
  iface.ultimaCronica = 0;
  document.getElementById('linhas').innerHTML = '';
  iface.limparInspetor();
  iface.seguindo = null;
  iface._chaveFita = null;
  document.getElementById('fita').innerHTML = '';
  cam.seguir(null);
  cam.enquadrarTudo();
  window.__terrario = { sim, render, cam, iface };
}

novoMundo();

// ---------- laço ----------
let anterior = performance.now();
let mediaDt = 1 / 60;

function quadro(agora) {
  requestAnimationFrame(quadro);
  const dt = Math.min(0.1, (agora - anterior) / 1000);
  anterior = agora;
  mediaDt += (dt - mediaDt) * 0.05;

  cam.pincelAtivo = !!iface.pincel;

  if (rodando && velocidade > 0) {
    acumulado += dt * velocidade;
    let passos = 0;
    while (acumulado >= PASSO && passos < MAX_PASSOS) {
      sim.tique(PASSO);
      acumulado -= PASSO;
      passos++;
    }
    if (passos === MAX_PASSOS) acumulado = 0;   // não acumula dívida de tempo
  }

  render.aplicarSujos();
  render.atualizarSeres(sim, dt);
  render.atualizarEfeitos();

  // o território muda a cada revisão de tribo, não a cada quadro
  relogioDominios += dt;
  if (relogioDominios > 0.4) { relogioDominios = 0; render.pintarDominios(sim.tribos); }

  cam.acompanhar(dt);
  iface.atualizarEstado(sim);
  iface.atualizarFita(sim);
  iface.atualizarCronica(sim);
  renderer.render(cena, camera);
  publicar();
}

function publicar() {
  const r = sim.resumo();
  window.__debug = { ...r, rodando, velocidade, fps: 1 / Math.max(1e-4, mediaDt),
                     pincel: iface.pincel?.id ?? null, raio: iface.raio };
}

function redimensionar() {
  const l = window.innerWidth, a = window.innerHeight;
  renderer.setSize(l, a, false);
  camera.aspect = l / a;
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionar);
addEventListener('orientationchange', () => setTimeout(redimensionar, 120));
redimensionar();

requestAnimationFrame(quadro);
document.getElementById('carregando').remove();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

export { T };
