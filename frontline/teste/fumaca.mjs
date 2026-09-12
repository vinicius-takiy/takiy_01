// Teste de fumaça: sobe o jogo num Chromium do tamanho de um iPhone deitado,
// joga sozinho por alguns segundos e falha se algo no console quebrar.
// Serve para eu (ou o CI) verificar uma mudança sem precisar de um celular.
//
//   node teste/fumaca.mjs [--fotos pasta] [--ver]

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

// Playwright pode estar local (npm i -D playwright) ou global. Resolve os dois,
// senão o teste só roda em quem instalou do jeito certo.
const exigir = createRequire(import.meta.url);
function carregarPlaywright() {
  const tentativas = [process.env.PLAYWRIGHT_PATH, 'playwright'].filter(Boolean);
  try { tentativas.push(execSync('npm root -g', { encoding: 'utf8' }).trim() + '/playwright'); } catch {}
  for (const t of tentativas) {
    try { return exigir(t); } catch { /* tenta o próximo */ }
  }
  console.error('Playwright não encontrado. Rode: npm i -D playwright');
  process.exit(2);
}
const { chromium, devices } = carregarPlaywright();
const args = process.argv.slice(2);
const pastaFotos = args.includes('--fotos') ? args[args.indexOf('--fotos') + 1] : null;
const visivel = args.includes('--ver');

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.txt': 'text/plain',
};

const servidor = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const arquivo = join(RAIZ, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    const corpo = await readFile(arquivo);
    res.writeHead(200, { 'content-type': TIPOS[extname(arquivo)] || 'application/octet-stream' });
    res.end(corpo);
  } catch {
    res.writeHead(404).end('nao encontrado');
  }
});
await new Promise((r) => servidor.listen(0, r));
const base = `http://127.0.0.1:${servidor.address().port}/index.html`;

const iphone = devices['iPhone 13'];
const navegador = await chromium.launch({ headless: !visivel });
const contexto = await navegador.newContext({
  ...iphone,
  viewport: { width: 844, height: 390 },   // deitado
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
const pagina = await contexto.newPage();

const problemas = [];
pagina.on('console', (m) => { if (m.type() === 'error') problemas.push('console: ' + m.text()); });
pagina.on('pageerror', (e) => problemas.push('exceção: ' + e.message));
pagina.on('requestfailed', (r) => problemas.push('rede: ' + r.url() + ' — ' + r.failure()?.errorText));

const passos = [];
const checar = (nome, ok, detalhe = '') => {
  passos.push({ nome, ok, detalhe });
  console.log(`${ok ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? '  — ' + detalhe : ''}`);
};

let n = 0;
const foto = async (nome) => {
  if (!pastaFotos) return;
  await pagina.screenshot({ path: join(pastaFotos, `${String(++n).padStart(2, '0')}-${nome}.png`) });
};

await pagina.goto(base, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(900);

// expõe o estado interno para o teste conseguir afirmar alguma coisa
await pagina.addInitScript(() => {});
checar('menu aparece', await pagina.locator('#menu').isVisible());
checar('canvas existe', await pagina.locator('canvas').count() === 1);
checar('WebGL ativo', await pagina.evaluate(() => {
  const c = document.querySelector('canvas');
  return !!(c && (c.getContext('webgl2') || c.getContext('webgl')));
}));
await foto('menu');

// abre e fecha os controles
await pagina.locator('#menuCfg').click();
await pagina.waitForTimeout(250);
checar('painel de controles abre', await pagina.locator('#cfg').isVisible());
checar('três esquemas listados', await pagina.locator('#esquemas .opt').count() === 3);
await foto('controles');
await pagina.locator('#cfgFechar').click();
await pagina.waitForTimeout(200);

// começa a partida
await pagina.locator('#jogar').click();
await pagina.waitForTimeout(700);
checar('HUD ligado', await pagina.locator('#hud.on').count() === 1);
checar('munição cheia', (await pagina.locator('#balas').innerText()).startsWith('8'));
await foto('inicio');

const meio = { x: 422, y: 195 };
const estado = () => pagina.evaluate(() => window.__debug ?? null);
const emJogo = async () => (await pagina.locator('#fim').isHidden()) && (await pagina.locator('#cfg').isHidden());

/** Empurra o analógico virtual por um tempo. */
async function andar(dx, dy, ms) {
  await pagina.mouse.move(120, 300);
  await pagina.mouse.down();
  await pagina.mouse.move(120 + dx, 300 + dy, { steps: 6 });
  await pagina.waitForTimeout(ms);
  await pagina.mouse.up();
}

/** Arrasta na zona de mira. */
async function mirar(dx, dy) {
  await pagina.mouse.move(700, 195);
  await pagina.mouse.down();
  await pagina.mouse.move(700 + dx, 195 + dy, { steps: 4 });
  await pagina.mouse.up();
}

/** Segura o gatilho: a arma repete sozinha na cadência dela. */
async function segurarGatilho(ms) {
  const c = await pagina.locator('#atirar').boundingBox();
  if (!c) return;
  await pagina.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await pagina.mouse.down();
  await pagina.waitForTimeout(ms);
  await pagina.mouse.up();
}

const antesDeAndar = await estado();
await andar(0, -60, 2000);
await foto('avancou');
const depoisDeAndar = await estado();
checar('o analógico move o jogador',
       Math.abs(depoisDeAndar.z - antesDeAndar.z) > 1.5,
       `z ${antesDeAndar.z.toFixed(1)} -> ${depoisDeAndar.z.toFixed(1)}`);
checar('avança para o inimigo (+Z)', depoisDeAndar.z > antesDeAndar.z);

// A pergunta que importa: com assistência forte, um dedo desastrado acerta?
await pagina.locator('#cfgAbrir').tap();
await pagina.waitForTimeout(200);
await pagina.locator('input[name=esq][value=assistido]').check();
await pagina.locator('#cfgFechar').tap();
await pagina.waitForTimeout(300);
checar('esquema assistido liga o auto-fogo', await pagina.locator('#autofogo').isChecked());

for (let i = 0; i < 8 && await emJogo(); i++) {
  await mirar(30 - (i % 4) * 18, ((i % 3) - 1) * 8);
  await segurarGatilho(500);
}
await foto('combate');

const combate = await estado();
checar('a arma disparou', combate.disparados > 0, `${combate.disparados} tiros`);
checar('a assistência de mira acerta', combate.acertos > 0,
       `${combate.acertos} acertos em ${combate.disparados} tiros`);
checar('dá para abater alguém', combate.abatidos > 0, `${combate.abatidos} abatidos`);
checar('munição foi consumida', combate.pente < 8 || combate.recarregando || combate.reserva < 48,
       `pente ${combate.pente}, reserva ${combate.reserva}`);
checar('oito soldados no setor', combate.inimigos === 8, String(combate.inimigos));
// SwiftShader no headless: isto é um piso de sanidade, não uma medida de celular
checar('o laço não engasga (renderização por software)', combate.fps > 12, combate.fps.toFixed(0) + ' fps');
checar('a partida não acaba em segundos', combate.tempo > 8 || !(await emJogo()),
       `${combate.tempo.toFixed(0)} s de partida`);

if (await emJogo()) {
  await pagina.locator('#recarregar').tap();
  await pagina.locator('#agachar').tap();
  await pagina.locator('#mirar').tap();
  await pagina.waitForTimeout(800);
  await foto('mirando-agachado');
  const m = await estado();
  checar('mirar aproxima o campo de visão', m.fov < 70, 'fov ' + m.fov.toFixed(1));
  await pagina.locator('#mirar').tap();
  await pagina.locator('#agachar').tap();

  await pagina.locator('#cfgAbrir').tap();
  await pagina.waitForTimeout(200);
  await pagina.locator('input[name=esq][value=trilho]').check();
  await pagina.locator('#cfgFechar').tap();
  await pagina.waitForTimeout(400);
  checar('analógico some no esquema sobre trilhos',
         await pagina.locator('#stick').evaluate((e) => getComputedStyle(e).visibility === 'hidden'));
  const antesTrilho = await estado();
  await pagina.touchscreen.tap(meio.x, 300);
  await pagina.waitForTimeout(2200);
  const depoisTrilho = await estado();
  const andou = Math.hypot(depoisTrilho.x - antesTrilho.x, depoisTrilho.z - antesTrilho.z);
  checar('tocar no ponto de avanço move o jogador', andou > 0.8, `andou ${andou.toFixed(1)} m`);
  await foto('trilho');
}

checar('nenhum erro no console', problemas.length === 0, problemas.slice(0, 4).join(' | '));

await navegador.close();
servidor.close();

const falhas = passos.filter((p) => !p.ok);
console.log(`\n${passos.length - falhas.length}/${passos.length} verificações passaram`);
process.exit(falhas.length ? 1 : 0);
