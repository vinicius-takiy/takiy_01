// Entrada de toque e teclado. Expõe um estado neutro (mover/olhar/botões) que o
// resto do jogo consome sem saber qual esquema está ativo.

import { cfg, esquemaAtual } from './settings.js';

export const entrada = {
  mover: { x: 0, y: 0 },   // -1..1, relativo ao personagem
  olhar: { x: 0, y: 0 },   // delta acumulado no quadro, em radianos
  atirando: false,
  atirouAgora: false,      // borda de subida, para arma semiautomática
  mirando: false,
  agachado: false,
  recarregar: false,
  toqueMundo: null,        // {x,y} normalizado, para o esquema sobre trilhos
  ativo: false,
};

const el = (id) => document.getElementById(id);
const zonaStick = el('stick');
const base = el('stickBase');
const knob = el('stickKnob');
const zonaOlhar = el('olhar');

const RAIO = 56;          // px até o batente do analógico
const MORTO = 0.14;       // zona morta relativa
const RAD_POR_PX = 0.0034; // sensibilidade base

let idStick = -1;
let idOlhar = -1;
let centro = { x: 0, y: 0 };
let ultimoOlhar = { x: 0, y: 0 };
let arrastouOlhar = 0;

/** O esquema sobre trilhos usa a tela inteira para mirar; os outros, só a direita. */
function zonaDeOlharCobreTudo() {
  return esquemaAtual().mirar === 'arrasto-total';
}

export function aplicarLayout() {
  const canhoto = cfg.canhoto;
  const usaStick = esquemaAtual().mover === 'stick';
  zonaStick.hidden = !usaStick;
  zonaStick.style.display = usaStick ? '' : 'none';

  // espelha as zonas para o layout canhoto
  const ladoStick = canhoto ? 'right' : 'left';
  const ladoOutro = canhoto ? 'left' : 'right';
  zonaStick.style[ladoStick] = 'calc(18px + var(--sa' + (canhoto ? 'r' : 'l') + '))';
  zonaStick.style[ladoOutro] = 'auto';

  if (zonaDeOlharCobreTudo()) {
    zonaOlhar.style.width = '100%';
    zonaOlhar.style.left = '0';
    zonaOlhar.style.right = 'auto';
  } else {
    zonaOlhar.style.width = '62%';
    zonaOlhar.style[ladoOutro] = '0';
    zonaOlhar.style[ladoStick] = 'auto';
  }

  for (const [id, dir] of [['atirar', 20], ['mirar', 136], ['recarregar', 30], ['agachar', 122]]) {
    const b = el(id);
    const inset = 'calc(' + dir + 'px + var(--sa' + (canhoto ? 'l' : 'r') + '))';
    b.style[canhoto ? 'left' : 'right'] = inset;
    b.style[canhoto ? 'right' : 'left'] = 'auto';
  }
}

// ---------- analógico de movimento ----------
zonaStick.addEventListener('pointerdown', (ev) => {
  if (idStick !== -1) return;
  idStick = ev.pointerId;
  zonaStick.setPointerCapture(ev.pointerId);
  const r = zonaStick.getBoundingClientRect();
  centro = { x: ev.clientX - r.left, y: ev.clientY - r.top };
  base.style.left = centro.x - 59 + 'px';
  base.style.top = centro.y - 59 + 'px';
  zonaStick.classList.add('on');
  moverKnob(0, 0);
  ev.preventDefault();
});

function moverKnob(dx, dy) {
  knob.style.left = centro.x + dx - 26 + 'px';
  knob.style.top = centro.y + dy - 26 + 'px';
}

zonaStick.addEventListener('pointermove', (ev) => {
  if (ev.pointerId !== idStick) return;
  const r = zonaStick.getBoundingClientRect();
  let dx = ev.clientX - r.left - centro.x;
  let dy = ev.clientY - r.top - centro.y;
  const d = Math.hypot(dx, dy);
  if (d > RAIO) { dx = (dx / d) * RAIO; dy = (dy / d) * RAIO; }
  moverKnob(dx, dy);
  const nx = dx / RAIO;
  const ny = dy / RAIO;
  const n = Math.hypot(nx, ny);
  if (n < MORTO) { entrada.mover.x = 0; entrada.mover.y = 0; }
  else {
    // reescala para que o movimento comece suave logo após a zona morta
    const f = (n - MORTO) / (1 - MORTO) / n;
    entrada.mover.x = nx * f;
    entrada.mover.y = -ny * f;
  }
  ev.preventDefault();
});

function soltarStick(ev) {
  if (ev.pointerId !== idStick) return;
  idStick = -1;
  zonaStick.classList.remove('on');
  entrada.mover.x = 0;
  entrada.mover.y = 0;
}
zonaStick.addEventListener('pointerup', soltarStick);
zonaStick.addEventListener('pointercancel', soltarStick);

// ---------- arrasto de mira ----------
zonaOlhar.addEventListener('pointerdown', (ev) => {
  if (idOlhar !== -1) return;
  idOlhar = ev.pointerId;
  zonaOlhar.setPointerCapture(ev.pointerId);
  ultimoOlhar = { x: ev.clientX, y: ev.clientY };
  arrastouOlhar = 0;
  ev.preventDefault();
});

zonaOlhar.addEventListener('pointermove', (ev) => {
  if (ev.pointerId !== idOlhar) return;
  const dx = ev.clientX - ultimoOlhar.x;
  const dy = ev.clientY - ultimoOlhar.y;
  ultimoOlhar = { x: ev.clientX, y: ev.clientY };
  arrastouOlhar += Math.abs(dx) + Math.abs(dy);
  // mirando reduz a sensibilidade, como em qualquer FPS
  const s = RAD_POR_PX * cfg.sensibilidade * (entrada.mirando ? 0.45 : 1);
  entrada.olhar.x -= dx * s;
  entrada.olhar.y -= dy * s * (cfg.invY ? -1 : 1);
  ev.preventDefault();
});

function soltarOlhar(ev) {
  if (ev.pointerId !== idOlhar) return;
  idOlhar = -1;
  // toque curto sem arrasto = comando de mundo (avançar no esquema sobre trilhos)
  if (arrastouOlhar < 12) {
    entrada.toqueMundo = {
      x: (ev.clientX / window.innerWidth) * 2 - 1,
      y: -(ev.clientY / window.innerHeight) * 2 + 1,
    };
  }
}
zonaOlhar.addEventListener('pointerup', soltarOlhar);
zonaOlhar.addEventListener('pointercancel', (ev) => { if (ev.pointerId === idOlhar) idOlhar = -1; });

// ---------- botões ----------
function botao(id, aoPressionar, aoSoltar) {
  const b = el(id);
  b.addEventListener('pointerdown', (ev) => {
    ev.stopPropagation(); ev.preventDefault();
    b.classList.add('press');
    b.setPointerCapture(ev.pointerId);
    aoPressionar();
  });
  const fim = (ev) => {
    ev.stopPropagation();
    b.classList.remove('press');
    if (aoSoltar) aoSoltar();
  };
  b.addEventListener('pointerup', fim);
  b.addEventListener('pointercancel', fim);
  return b;
}

botao('atirar', () => { entrada.atirando = true; entrada.atirouAgora = true; }, () => { entrada.atirando = false; });
botao('mirar', () => { entrada.mirando = !entrada.mirando; el('mirar').classList.toggle('press', entrada.mirando); },
      () => { el('mirar').classList.toggle('press', entrada.mirando); });
botao('recarregar', () => { entrada.recarregar = true; });
botao('agachar', () => { entrada.agachado = !entrada.agachado; el('agachar').classList.toggle('press', entrada.agachado); },
      () => { el('agachar').classList.toggle('press', entrada.agachado); });

// ---------- teclado e mouse, para desenvolver no PC ----------
const teclas = new Set();
addEventListener('keydown', (ev) => {
  if (!entrada.ativo) return;
  teclas.add(ev.code);
  if (ev.code === 'KeyR') entrada.recarregar = true;
  if (ev.code === 'ControlLeft' || ev.code === 'KeyC') entrada.agachado = !entrada.agachado;
  if (['KeyW','KeyA','KeyS','KeyD','Space'].includes(ev.code)) ev.preventDefault();
});
addEventListener('keyup', (ev) => teclas.delete(ev.code));

export function lerTeclado() {
  if (!teclas.size) return;
  const x = (teclas.has('KeyD') ? 1 : 0) - (teclas.has('KeyA') ? 1 : 0);
  const y = (teclas.has('KeyW') ? 1 : 0) - (teclas.has('KeyS') ? 1 : 0);
  if (x || y) {
    const n = Math.hypot(x, y);
    entrada.mover.x = x / n;
    entrada.mover.y = y / n;
  }
}

export function ligarMouse(canvas) {
  canvas.addEventListener('mousedown', (ev) => {
    if (!entrada.ativo) return;
    if (document.pointerLockElement !== canvas) { canvas.requestPointerLock(); return; }
    if (ev.button === 0) { entrada.atirando = true; entrada.atirouAgora = true; }
    if (ev.button === 2) entrada.mirando = true;
  });
  addEventListener('mouseup', (ev) => {
    if (ev.button === 0) entrada.atirando = false;
    if (ev.button === 2) entrada.mirando = false;
  });
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  addEventListener('mousemove', (ev) => {
    if (document.pointerLockElement !== canvas) return;
    const s = 0.0022 * cfg.sensibilidade * (entrada.mirando ? 0.45 : 1);
    entrada.olhar.x -= ev.movementX * s;
    entrada.olhar.y -= ev.movementY * s * (cfg.invY ? -1 : 1);
  });
}

/** Zera o que é por-quadro. Chamado no fim de cada update. */
export function limparQuadro() {
  entrada.olhar.x = 0;
  entrada.olhar.y = 0;
  entrada.atirouAgora = false;
  entrada.recarregar = false;
  entrada.toqueMundo = null;
}

export function soltarTudo() {
  entrada.mover.x = entrada.mover.y = 0;
  entrada.atirando = false;
  entrada.mirando = false;
  idStick = idOlhar = -1;
  zonaStick.classList.remove('on');
  teclas.clear();
  el('mirar').classList.remove('press');
}
