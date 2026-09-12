// Teste de fumaça da tela. O equilíbrio quem mede é `equilibrio.mjs`; aqui a
// pergunta é outra: o mundo aparece, o pincel pinta, a câmera obedece e o
// relógio anda sem quebrar nada no console.
//
//   node teste/fumaca.mjs [--fotos pasta] [--ver]

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const pastaFotos = args.includes('--fotos') ? args[args.indexOf('--fotos') + 1] : null;
const visivel = args.includes('--ver');

const exigir = createRequire(import.meta.url);
function carregarPlaywright() {
  const tentativas = [process.env.PLAYWRIGHT_PATH, 'playwright'].filter(Boolean);
  try { tentativas.push(execSync('npm root -g', { encoding: 'utf8' }).trim() + '/playwright'); } catch {}
  for (const t of tentativas) { try { return exigir(t); } catch { /* tenta o próximo */ } }
  console.error('Playwright não encontrado. Rode: npm i -D playwright');
  process.exit(2);
}
const { chromium } = carregarPlaywright();

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const servidor = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const arquivo = join(RAIZ, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    res.writeHead(200, { 'content-type': TIPOS[extname(arquivo)] || 'application/octet-stream' });
    res.end(await readFile(arquivo));
  } catch { res.writeHead(404).end('nao encontrado'); }
});
await new Promise((r) => servidor.listen(0, r));

const navegador = await chromium.launch({ headless: !visivel });
const contexto = await navegador.newContext({
  viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
});
const pagina = await contexto.newPage();
const problemas = [];
pagina.on('console', (m) => { if (m.type() === 'error') problemas.push('console: ' + m.text()); });
pagina.on('pageerror', (e) => problemas.push('exceção: ' + e.message));
pagina.on('requestfailed', (r) => {
  if (!r.url().endsWith('sw.js')) problemas.push('rede: ' + r.url());
});

const passos = [];
const checar = (nome, ok, detalhe = '') => {
  passos.push(ok);
  console.log(`${ok ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? '  — ' + detalhe : ''}`);
};
let n = 0;
const foto = async (nome) => {
  if (!pastaFotos) return;
  await pagina.screenshot({ path: join(pastaFotos, `${String(++n).padStart(2, '0')}-${nome}.png`) });
};
const estado = () => pagina.evaluate(() => window.__debug ?? null);

await pagina.goto(`http://127.0.0.1:${servidor.address().port}/index.html`, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(1200);

checar('abertura aparece', await pagina.locator('#abertura').isVisible());
checar('canvas com WebGL', await pagina.evaluate(() => {
  const c = document.querySelector('canvas');
  return !!(c && (c.getContext('webgl2') || c.getContext('webgl')));
}));
checar('paleta montada', await pagina.locator('.pincel').count() >= 10);
await foto('abertura');

await pagina.locator('#comecar').click();
await pagina.waitForTimeout(600);
const inicial = await estado();
checar('mundo gerado', inicial !== null && inicial.ano >= 0);
checar('começa sem gente', inicial.humanos === 0, `${inicial.humanos}`);
await foto('mundo-vazio');

// --- pintar terra fértil e soltar humanos, que é o gesto central do jogo ---
const meio = { x: 422, y: 210 };
await pagina.locator('.pincel[data-id=fertil]').click();
await pagina.locator('#raio').fill('6');
await pagina.mouse.move(meio.x, meio.y);
await pagina.mouse.down();
await pagina.mouse.move(meio.x + 60, meio.y + 20, { steps: 8 });
await pagina.mouse.up();
await pagina.waitForTimeout(300);
const fertil = await pagina.evaluate(() => {
  const { sim } = window.__terrario;
  let n = 0;
  for (const t of sim.mundo.terreno) if (t === 3) n++;
  return n;
});
checar('o pincel de terreno pinta o mundo', fertil > 60, `${fertil} tiles férteis`);
await foto('terra-pintada');

await pagina.locator('.pincel[data-id=humano]').click();
await pagina.locator('#raio').fill('3');
for (let i = 0; i < 4; i++) {
  await pagina.mouse.click(meio.x + i * 12, meio.y + 8);
  await pagina.waitForTimeout(60);
}
await pagina.locator('.pincel[data-id=rebanho]').click();
await pagina.mouse.click(meio.x + 70, meio.y + 26);
await pagina.waitForTimeout(300);
const semeado = await estado();
checar('o pincel de seres solta humanos', semeado.humanos >= 8, `${semeado.humanos}`);
checar('o pincel de seres solta rebanho', semeado.rebanhos >= 1, `${semeado.rebanhos}`);
await foto('semeado');

// --- correr o tempo e ver a civilização acontecer ---
await pagina.locator('#tempo button[data-vel="16"]').click();
await pagina.waitForTimeout(9000);
const depois = await estado();
// no headless com SwiftShader o laço fica em ~10 fps e o mundo anda devagar;
// no aparelho isto é várias vezes mais rápido, então aqui só se afirma que anda
checar('o tempo corre', depois.ano > semeado.ano + 8, `ano ${depois.ano}`);
checar('surge tribo', depois.tribos >= 1, `${depois.tribos}`);
checar('a crônica registra a história', await pagina.locator('#linhas p').count() > 0,
       `${await pagina.locator('#linhas p').count()} linhas`);
checar('quadros fluindo (renderização por software)', depois.fps > 10, depois.fps.toFixed(0) + ' fps');
await foto('civilizacao');

// --- inspetor ---
await pagina.locator('.pincel[data-id=rebanho]').click();   // desliga o pincel
await pagina.waitForTimeout(100);
await pagina.mouse.click(meio.x + 20, meio.y + 10);
await pagina.waitForTimeout(400);
checar('tocar sem pincel abre o inspetor', await pagina.locator('#inspetor.on').count() === 1);
await foto('inspetor');

// --- câmera: dois dedos aproximam, um dedo arrasta ---
const antesCam = await pagina.evaluate(() => {
  const c = window.__terrario.cam; return { d: c.distancia, x: c.alvo.x, z: c.alvo.z };
});
await pagina.mouse.move(meio.x, meio.y);
await pagina.mouse.wheel(0, -600);
await pagina.waitForTimeout(200);
await pagina.mouse.move(300, 200);
await pagina.mouse.down();
await pagina.mouse.move(430, 250, { steps: 8 });
await pagina.mouse.up();
await pagina.waitForTimeout(200);
const depoisCam = await pagina.evaluate(() => {
  const c = window.__terrario.cam; return { d: c.distancia, x: c.alvo.x, z: c.alvo.z };
});
checar('a roda aproxima a câmera', depoisCam.d < antesCam.d, `${antesCam.d.toFixed(0)} → ${depoisCam.d.toFixed(0)}`);
checar('arrastar sem pincel move o mapa',
       Math.hypot(depoisCam.x - antesCam.x, depoisCam.z - antesCam.z) > 1,
       `andou ${Math.hypot(depoisCam.x - antesCam.x, depoisCam.z - antesCam.z).toFixed(1)}`);
await foto('camera');

// --- novo mundo não quebra nada ---
await pagina.locator('#recomecar').click();
await pagina.waitForTimeout(900);
const novo = await estado();
checar('novo mundo recomeça do zero', novo.humanos === 0 && novo.ano < 5, `ano ${novo.ano}, ${novo.humanos} pessoas`);
await foto('novo-mundo');

checar('nenhum erro no console', problemas.length === 0, problemas.slice(0, 3).join(' | '));

await navegador.close();
servidor.close();
const falhas = passos.filter((p) => !p).length;
console.log(`\n${passos.length - falhas}/${passos.length} verificações passaram`);
process.exit(falhas ? 1 : 0);
