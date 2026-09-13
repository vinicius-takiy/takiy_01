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
checar('o pincel responde com animação', await pagina.evaluate(() => window.__terrario.render.totalPulsos > 0));
await pagina.waitForTimeout(300);
const fertil = await pagina.evaluate(() => {
  const { sim } = window.__terrario;
  let n = 0;
  for (const t of sim.mundo.terreno) if (t === 3) n++;
  return n;
});
checar('o pincel de terreno pinta o mundo', fertil > 60, `${fertil} tiles férteis`);
await foto('terra-pintada');

// Mundo pelado não tem mata, e mata não se pinta pronta: planta-se semente e
// espera-se ela beber. Sem madeira a tribo nunca levanta abrigo, então este
// punhado de brotos é o que decide se a partida sai do lugar.
await pagina.locator('.pincel[data-id=semente]').click();
await pagina.locator('#raio').fill('5');
await pagina.mouse.move(meio.x - 90, meio.y - 30);
await pagina.mouse.down();
await pagina.mouse.move(meio.x - 30, meio.y - 10, { steps: 6 });
await pagina.mouse.up();
await pagina.waitForTimeout(250);

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
const matrizHumano = () => pagina.evaluate(() => {
  for (const [nome, figura] of window.__terrario.render.figuras) {
    if (!nome.startsWith('humano:') || !figura.n) continue;
    const malha = figura.tribo || figura.natural;
    return Array.from(malha.instanceMatrix.array.slice(0, 16));
  }
  return [];
});
const matrizAntes = await matrizHumano();
await pagina.waitForTimeout(220);
const matrizDepois = await matrizHumano();
checar('os seres têm movimento procedural', matrizAntes.length > 0 && matrizDepois.some((v, i) => Math.abs(v - matrizAntes[i]) > 0.001));
await foto('semeado');

// --- correr o tempo e ver a civilização acontecer ---
await pagina.locator('#tempo button[data-vel="16"]').click();
await pagina.waitForTimeout(9000);
const depois = await estado();
// no headless com SwiftShader o laço fica em ~10 fps e o mundo anda devagar;
// no aparelho isto é várias vezes mais rápido, então aqui só se afirma que anda.
// A margem era de oito anos e virava vermelho sozinha em máquina carregada — o
// mesmo commit passava e falhava conforme o que mais estivesse rodando. Cinco
// ainda pega relógio parado, que é o defeito que esta linha existe para pegar.
checar('o tempo corre', depois.ano > semeado.ano + 5, `ano ${depois.ano}`);
const mata = await pagina.evaluate(() => {
  const m = window.__terrario.sim.mundo;
  let broto = 0, floresta = 0;
  for (const t of m.terreno) { if (t === 10) broto++; else if (t === 4) floresta++; }
  return { broto, floresta };
});
checar('o broto plantado vira mata com o tempo', mata.floresta > 0,
       `${mata.floresta} de mata, ${mata.broto} ainda broto`);
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
// O eixo do arraste, conferido contra a câmera de verdade e não contra a minha
// própria conta: a direita da tela é (-fz, fx) do vetor para onde a câmera olha.
// Estava girado noventa graus — o dedo na horizontal subia e descia o mapa.
const arraste = await pagina.evaluate(() => {
  const { cam } = window.__terrario;
  const alvo = () => ({ x: cam.alvo.x, z: cam.alvo.z });
  // frente da câmera no chão, tirada da própria posição dela
  const fx = cam.alvo.x - cam.cam.position.x, fz = cam.alvo.z - cam.cam.position.z;
  const nf = Math.hypot(fx, fz) || 1;
  const frente = { x: fx / nf, z: fz / nf };
  const direita = { x: -frente.z, z: frente.x };
  const medir = (dx, dy) => {
    const a = alvo();
    cam.arrastar(dx, dy);
    const m = { x: cam.alvo.x - a.x, z: cam.alvo.z - a.z };
    const n = Math.hypot(m.x, m.z) || 1;
    return { aoLado: (m.x * direita.x + m.z * direita.z) / n,
             aFrente: (m.x * frente.x + m.z * frente.z) / n };
  };
  cam.alvo.set(40, 0, 40); cam.aplicar();
  const horizontal = medir(90, 0);
  cam.alvo.set(40, 0, 40); cam.aplicar();
  const vertical = medir(0, 90);
  return { horizontal, vertical };
});
checar('dedo na horizontal corre o mapa de lado, não para cima',
       arraste.horizontal.aoLado < -0.98,
       `de lado ${arraste.horizontal.aoLado.toFixed(2)}, para a frente ${arraste.horizontal.aFrente.toFixed(2)}`);
checar('dedo na vertical corre o mapa para frente, não de lado',
       arraste.vertical.aFrente > 0.98,
       `para a frente ${arraste.vertical.aFrente.toFixed(2)}, de lado ${arraste.vertical.aoLado.toFixed(2)}`);

checar('arrastar sem pincel move o mapa',
       Math.hypot(depoisCam.x - antesCam.x, depoisCam.z - antesCam.z) > 1,
       `andou ${Math.hypot(depoisCam.x - antesCam.x, depoisCam.z - antesCam.z).toFixed(1)}`);
await foto('camera');

// --- vocações e seguir tribo, que é o jeito de olhar de perto ---
const vocs = await pagina.evaluate(() => window.__debug.vocacoes);
const tipos = Object.entries(vocs || {}).filter(([, n]) => n > 0);
checar('a gente nasce com vocações diferentes', tipos.length >= 3,
       tipos.map(([k, n]) => `${k} ${n}`).join(', '));

const temFita = await pagina.locator('#fita button').count();
checar('a fita lista as tribos', temFita >= 1, `${temFita} tribos`);
if (temFita) {
  const antes = await pagina.evaluate(() => {
    const c = window.__terrario.cam; return { d: c.distancia, x: c.alvo.x, z: c.alvo.z, segue: !!c.seguindo };
  });
  await pagina.locator('#fita button').first().click();
  await pagina.waitForTimeout(1400);
  const dep = await pagina.evaluate(() => {
    const c = window.__terrario.cam;
    return { d: c.distancia, x: c.alvo.x, z: c.alvo.z, segue: !!c.seguindo,
             perto: c.seguindo ? Math.hypot(c.alvo.x - c.seguindo.cx, c.alvo.z - c.seguindo.cy) : 99 };
  });
  checar('tocar na tribo aproxima e acompanha', dep.segue && dep.d <= antes.d,
         `${antes.d.toFixed(0)} → ${dep.d.toFixed(0)}`);
  checar('a câmera chega em cima da tribo', dep.perto < 6, `${dep.perto.toFixed(1)} tiles do centro`);
  checar('o painel da tribo fica preso enquanto segue',
         await pagina.locator('#inspetor.on').count() === 1);
  await foto('seguindo-tribo');
  // zoom bem perto para conferir que dá para ver a gente
  await pagina.mouse.move(422, 200);
  for (let i = 0; i < 6; i++) { await pagina.mouse.wheel(0, -300); await pagina.waitForTimeout(80); }
  await pagina.waitForTimeout(500);
  const perto = await pagina.evaluate(() => window.__terrario.cam.distancia);
  checar('dá para chegar perto da gente', perto < 14, `${perto.toFixed(0)} de distância`);
  await foto('de-perto');
}

// --- pinça não pode pintar: era o defeito relatado, todo zoom despejava seres ---
await pagina.locator('#tempo button[data-vel="0"]').click();   // pausa: morte não é pincelada
await pagina.locator('.pincel[data-id=humano]').click();
await pagina.mouse.move(422, 200);
for (let i = 0; i < 4; i++) { await pagina.mouse.wheel(0, 300); await pagina.waitForTimeout(60); }
await pagina.waitForTimeout(200);
const antesPinca = await estado();
const camAntes = await pagina.evaluate(() => window.__terrario.cam.distancia);
await pagina.evaluate(() => {
  const c = document.querySelector('canvas');
  const ev = (tipo, id, x, y) => c.dispatchEvent(new PointerEvent(tipo, {
    pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 1,
  }));
  // dois dedos afastando: é zoom, não pincelada
  ev('pointerdown', 1, 400, 200);
  ev('pointerdown', 2, 450, 210);
  for (let k = 1; k <= 6; k++) { ev('pointermove', 1, 400 - k * 8, 200 - k * 4); ev('pointermove', 2, 450 + k * 8, 210 + k * 4); }
  ev('pointerup', 1, 352, 176);
  ev('pointerup', 2, 498, 234);
});
await pagina.waitForTimeout(350);
const depoisPinca = await estado();
const camDepois = await pagina.evaluate(() => window.__terrario.cam.distancia);
checar('pinça não solta seres na tela',
       depoisPinca.humanos === antesPinca.humanos,
       `${antesPinca.humanos} -> ${depoisPinca.humanos} pessoas`);
checar('pinça mexe na câmera', Math.abs(camDepois - camAntes) > 0.5,
       `${camAntes.toFixed(0)} -> ${camDepois.toFixed(0)}`);

// --- e um toque com pincel ainda pinta ---
const antesToque = await estado();
await pagina.mouse.click(430, 210);
await pagina.waitForTimeout(300);
const depoisToque = await estado();
checar('um dedo com pincel ainda solta seres', depoisToque.humanos > antesToque.humanos,
       `${antesToque.humanos} -> ${depoisToque.humanos}`);
await pagina.locator('#tempo button[data-vel="16"]').click();
await pagina.waitForTimeout(2500);

// --- madeira e abrigo entraram no jogo ---
const madeira = await pagina.evaluate(() => {
  const { sim } = window.__terrario;
  return { ocas: sim.tribos.reduce((a, t) => a + t.ocas.length, 0),
           lenha: sim.tribos.reduce((a, t) => a + t.madeira, 0) };
});
checar('a mata pintada vira madeira na tribo', madeira.lenha > 0 || madeira.ocas > 0,
       `${madeira.lenha.toFixed(0)} de lenha, ${madeira.ocas} ocas`);

// --- bichos com pata: quatro por bicho, em trote, e olhando para onde andam ---
// Solta bicho na hora: o que se mede aqui é o desenho, e a esta altura da
// partida o rebanho da rodada pode já ter virado jantar. Sem isto a checagem
// passava com zero patas para zero bichos, que é passar sem olhar nada.
const patas1 = await pagina.evaluate(() => {
  const { sim, render, cam } = window.__terrario;
  for (let k = 0; k < 8; k++) {
    sim.soltar('rebanho', cam.alvo.x + (k % 4) * 1.5 - 2, cam.alvo.z + Math.floor(k / 4) * 1.5 - 1);
  }
  render.atualizarSeres(sim, 0.016);
  const f = render.figuras.get('rebanho:pata').natural;
  return { vivos: sim.rebanhos.filter((r) => r.viva).length, patas: f.count,
           matriz: Array.from(f.instanceMatrix.array.slice(0, 48)) };
});
await pagina.waitForTimeout(400);
const patas2 = await pagina.evaluate(() => {
  const f = window.__terrario.render.figuras.get('rebanho:pata').natural;
  return Array.from(f.instanceMatrix.array.slice(0, 48));
});
checar('há bicho em cena para conferir', patas1.vivos > 0, `${patas1.vivos} bichos`);
checar('cada bicho anda com quatro patas', patas1.vivos > 0 && patas1.patas === patas1.vivos * 4,
       `${patas1.patas} patas para ${patas1.vivos} bichos`);
checar('a pata se mexe entre um quadro e outro',
       patas1.matriz.some((v, i) => Math.abs(v - patas2[i]) > 0.0005));

// --- água: lâmina no nível da terra, peixe dentro dela, jacaré em cena ---
// O defeito era este: o tile de água ficava meio metro abaixo da margem e lia
// como um buraco quadrado de parede azul, não como um lago.
const agua = await pagina.evaluate(() => {
  const { sim, render } = window.__terrario;
  const m = sim.mundo;
  // Longe da aldeia de propósito — pintar água em cima da tribo afoga a tribo e
  // as checagens seguintes reprovam por falta de gente — e no chão mais plano
  // que houver por perto: num barranco de rocha a medida do degrau vira ruído,
  // e o teste acusava 0,67 com sete pontos de beirada num lago que estava certo.
  const t0 = sim.tribos[0];
  const base = { x: t0 ? Math.round(t0.cx) : 40, y: t0 ? Math.round(t0.cy) : 40 };
  let cx = 14, cy = 14, melhorNota = -1;
  for (const [ox, oy] of [[22, 22], [-22, 22], [22, -22], [-22, -22], [0, 26], [0, -26], [26, 0], [-26, 0]]) {
    const x = Math.max(8, Math.min(m.n - 9, base.x + ox));
    const y = Math.max(8, Math.min(m.n - 9, base.y + oy));
    let planos = 0, alturas = [];
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      if (!m.andavel(x + dx, y + dy)) continue;
      planos++;
      alturas.push(m.relevo[m.idx(x + dx, y + dy)]);
    }
    if (!alturas.length) continue;
    const espalho = Math.max(...alturas) - Math.min(...alturas);
    const nota = planos - espalho * 40;
    if (nota > melhorNota) { melhorNota = nota; cx = x; cy = y; }
  }
  sim.pintar(cx, cy, 4, { tipo: 'terreno', terreno: 0 });    // T.AGUA
  render.aplicarSujos();
  // Degrau medido tile a tile na beirada, não contra uma margem cinco tiles
  // adiante: o relevo muda sozinho nessa distância e a medida vira ruído.
  let soma = 0, pares = 0;
  for (let y = cy - 8; y <= cy + 8 && pares < 60; y++) {
    for (let x = cx - 8; x <= cx + 8 && pares < 60; x++) {
      if (!m.ehAgua(x, y)) continue;
      // Menor degrau entre os vizinhos de terra, não o primeiro que aparecer:
      // água empoça no ponto baixo, e se um dos lados for barranco de rocha o
      // degrau grande é o certo. O que se afirma é que ela encosta em ALGUM
      // lado — foi medindo o primeiro vizinho que isto acusou 0,52 num lago
      // que, na foto, está rente à margem.
      let menor = Infinity;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!m.andavel(x + dx, y + dy)) continue;
        menor = Math.min(menor, Math.abs(render.alturaDaLamina(m.idx(x, y)) - render.alturaColuna(m.idx(x + dx, y + dy))));
      }
      if (menor < Infinity) { soma += menor; pares++; }
    }
  }
  const antesPeixe = sim.peixes.length;
  sim.pintar(cx, cy, 3, { tipo: 'ser', ser: 'peixe', quantos: 10, aquatico: true });
  sim.pintar(cx, cy, 2, { tipo: 'ser', ser: 'jacare', quantos: 2, aquatico: true });
  // peixe fora d'água é o erro clássico deste pincel
  const encalhados = sim.peixes.filter((p) => !m.ehAgua(Math.round(p.x), Math.round(p.y))).length;
  render.atualizarSeres(sim, 0.016);
  return {
    laminas: render.lamina.count,
    degrau: pares ? soma / pares : 99,
    pares,
    peixes: sim.peixes.length - antesPeixe,
    encalhados,
    peixesEmCena: render.figuras.get('peixe').natural.count,
    jacaresEmCena: render.figuras.get('jacare').natural.count,
  };
});
checar('água pintada ganha lâmina desenhada', agua.laminas > 20, `${agua.laminas} tiles de lâmina`);
checar('a lâmina fica no nível da margem, não no fundo de um buraco',
       agua.pares > 15 && agua.degrau < 0.30,
       `degrau médio de ${agua.degrau.toFixed(2)} em ${agua.pares} pontos de beirada`);
checar('o pincel de peixe só solta dentro da água',
       agua.peixes > 0 && agua.encalhados === 0, `${agua.peixes} soltos, ${agua.encalhados} encalhados`);
checar('peixe e jacaré aparecem em cena',
       agua.peixesEmCena > 0 && agua.jacaresEmCena > 0,
       `${agua.peixesEmCena} peixes, ${agua.jacaresEmCena} jacarés`);
await foto('agua');

// --- clima, semente e fogo ---
const clima = await pagina.evaluate(() => {
  const { sim, render } = window.__terrario;
  const m = sim.mundo;
  const t0 = sim.tribos[0];
  const cx = t0 ? Math.max(8, Math.min(m.n - 9, Math.round(t0.cx) - 20)) : 20;
  const cy = t0 ? Math.max(8, Math.min(m.n - 9, Math.round(t0.cy) - 20)) : 20;

  // semente vira broto, não floresta pronta
  sim.pintar(cx, cy, 3, { tipo: 'terreno', terreno: 10 });   // T.BROTO
  let brotos = 0;
  for (const tipo of m.terreno) if (tipo === 10) brotos++;

  // chuva molha o chão e enche a nuvem
  const antesUmido = m.umidade[m.idx(cx, cy)];
  sim.pintar(cx, cy, 4, { tipo: 'chuva' });
  for (let k = 0; k < 40; k++) sim.tique(1 / 12);
  const depoisUmido = m.umidade[m.idx(cx, cy)];

  // Fogo aceso à mão, para conferir o desenho. Precisa de coisa que queime: num
  // mundo pelado o chão é terra nua, e terra nua não pega — o teste dizia "não
  // acendeu" quando o certo era "não havia o que acender".
  const seco = m.idx(cx + 6, cy + 6);
  m.definir(seco, 4);                        // T.FLORESTA
  m.umidade[seco] = 0.02;
  const acendeu = m.atear(seco) || m.queimando.size > 0;
  render.atualizarSeres(sim, 0.016);
  return {
    brotos, acendeu, ardendo: m.queimando.size,
    chuva: depoisUmido - antesUmido,
    chamas: render.figuras.get('chama').natural.count,
    bichos: {
      capivara: render.figuras.get('capivara').natural.count,
      lebre: render.figuras.get('lebre').natural.count,
    },
  };
});
checar('o pincel de semente planta broto, não floresta pronta',
       clima.brotos > 10, `${clima.brotos} brotos`);
checar('chuva molha o chão', clima.chuva > 0.05, `umidade subiu ${clima.chuva.toFixed(2)}`);
checar('fogo acende e aparece em cena', clima.acendeu && clima.chamas > 0,
       `${clima.ardendo} tiles ardendo, ${clima.chamas} chamas`);

// os três herbívoros, cada um com o próprio boneco
const fauna = await pagina.evaluate(() => {
  const { sim, render, cam } = window.__terrario;
  for (let k = 0; k < 6; k++) {
    sim.soltar('capivara', cam.alvo.x + k - 3, cam.alvo.z + 1);
    sim.soltar('lebre', cam.alvo.x + k - 3, cam.alvo.z - 1);
  }
  render.atualizarSeres(sim, 0.016);
  const n = (k) => render.figuras.get(k).natural.count;
  return { boi: n('rebanho'), capivara: n('capivara'), lebre: n('lebre'),
           patas: n('capivara:pata') + n('lebre:pata') };
});
checar('os três herbívoros têm bonecos diferentes',
       fauna.boi > 0 && fauna.capivara > 0 && fauna.lebre > 0,
       `${fauna.boi} bois, ${fauna.capivara} capivaras, ${fauna.lebre} lebres`);
checar('os miúdos também andam com pata', fauna.patas === (fauna.capivara + fauna.lebre) * 4,
       `${fauna.patas} patas`);
await foto('clima-e-fauna');

// --- animação: cada tarefa com o próprio gesto, e a árvore caindo ---
// A queixa era "não dá para ver o que está acontecendo". O que se afirma aqui é
// que gestos diferentes produzem poses diferentes — se todo mundo balançasse
// igual, estas matrizes seriam a mesma.
const gestos = await pagina.evaluate(async () => {
  const { sim, render, cam } = window.__terrario;
  const t = sim.tribos[0];
  if (!t) return null;
  const gente = t.membros.filter((m) => m.viva && m.adulto).slice(0, 4);
  if (gente.length < 3) return null;
  const obras = ['arar', 'lenhar', 'enfrentar'];
  const poses = [];
  for (let k = 0; k < 3; k++) {
    const h = gente[k];
    h.obra = obras[k];
    h.alvo = { x: h.x + 1, y: h.y };
    h.fugindo = 0;
  }
  render.atualizarSeres(sim, 0.016);
  for (let k = 0; k < 3; k++) {
    const h = gente[k];
    const f = render.figuras.get(`humano:${h.dom}`) || render.figuras.get('humano:lavrador');
    void f;
    // a pose sai da rotação em x, que é o que `curva` e `balanco` mexem
    poses.push({ obra: h.obra, curva: h.obra });
  }
  // Mede pela matriz. Amostra em quatro instantes e fica com a maior diferença:
  // as duas poses oscilam no tempo e num instante qualquer elas podem coincidir
  // — foi assim que "arar × enfrentar" reprovou com 0,05 num gesto que difere.
  const ler = (obra) => {
    const h = gente[0];
    h.obra = obra;
    const amostras = [];
    for (let q = 0; q < 4; q++) {
      render.atualizarSeres(sim, 0.11);
      const dom = h.dom in { lavrador: 1, cacador: 1, construtor: 1, minerador: 1,
                             lider: 1, guarda: 1, pastor: 1, pescador: 1 } ? h.dom : 'lavrador';
      const fig = render.figuras.get(`humano:${dom}`);
      const malha = fig.tribo || fig.natural;
      amostras.push(Array.from(malha.instanceMatrix.array.slice(0, 12)));
    }
    return amostras;
  };
  const distancia = (a, b) => {
    let pior = 0;
    for (let q = 0; q < a.length; q++) {
      let d = 0;
      for (let i = 0; i < 12; i++) d += Math.abs(a[q][i] - b[q][i]);
      pior = Math.max(pior, d);
    }
    return pior;
  };
  const arar = ler('arar');
  const lutar = ler('enfrentar');
  const parado = ler(null);
  const difA = distancia(arar, parado);
  const difB = distancia(arar, lutar);
  // árvore caindo
  const antes = render.efeitos.length;
  render.derrubarArvore(Math.round(cam.alvo.x), Math.round(cam.alvo.z));
  const tombos = render.efeitos.filter((e) => e.tipo === 'tombo').length;
  return { poses: poses.length, difA, difB, antes, tombos };
});
checar('trabalhar muda a pose de quem trabalha', gestos && gestos.difA > 0.05,
       gestos ? `diferença ${gestos.difA.toFixed(2)} para quem está parado` : 'sem tribo');
checar('cada tarefa tem gesto próprio', gestos && gestos.difB > 0.05,
       gestos ? `arar × enfrentar diferem em ${gestos.difB.toFixed(2)}` : 'sem tribo');
checar('a árvore derrubada tomba em cena', gestos && gestos.tombos > 0,
       gestos ? `${gestos.tombos} tombando` : 'sem tribo');

// --- registro: guardar o mundo, listar e voltar nele ---
const registro = await pagina.evaluate(async () => {
  const { sim, iface } = window.__terrario;
  localStorage.removeItem('terrario:mundos');
  const antes = { ano: sim.ano, pessoas: sim.humanos.length, tribos: sim.tribos.length,
                  semente: sim.semente, mata: 0 };
  for (const t of sim.mundo.terreno) if (t === 4) antes.mata++;
  document.getElementById('abrirMundos').click();
  document.getElementById('nomeMundo').value = 'mundo de teste';
  document.getElementById('guardarMundo').click();
  const naLista = document.querySelectorAll('#listaMundos li').length;
  const bytes = (localStorage.getItem('terrario:mundos') || '').length;
  // troca por um mundo novo e depois volta: é o gesto que o jogador faz
  document.getElementById('recomecar').click();
  const vazio = window.__terrario.sim.humanos.length;
  document.getElementById('abrirMundos').click();
  document.querySelector('#listaMundos .ler').click();
  const s2 = window.__terrario.sim;
  let mata = 0;
  for (const t of s2.mundo.terreno) if (t === 4) mata++;
  return { antes, naLista, bytes, vazio,
           depois: { ano: s2.ano, pessoas: s2.humanos.length, tribos: s2.tribos.length,
                     semente: s2.semente, mata } };
});
checar('guardar põe o mundo na prateleira', registro.naLista === 1,
       `${registro.naLista} na lista, ${(registro.bytes / 1024).toFixed(0)} kB no armazenamento`);
checar('mundo novo entra vazio', registro.vazio === 0, `${registro.vazio} pessoas`);
checar('voltar ao mundo guardado devolve o ano e a gente',
       registro.depois.ano === registro.antes.ano
       && registro.depois.pessoas === registro.antes.pessoas
       && registro.depois.tribos === registro.antes.tribos,
       `ano ${registro.depois.ano}/${registro.antes.ano}, `
       + `${registro.depois.pessoas}/${registro.antes.pessoas} pessoas, `
       + `${registro.depois.tribos}/${registro.antes.tribos} tribos`);
checar('o terreno volta igual', registro.depois.mata === registro.antes.mata,
       `${registro.depois.mata} de mata contra ${registro.antes.mata}`);
checar('a semente volta junto', registro.depois.semente === registro.antes.semente);
await pagina.evaluate(() => document.getElementById('mundos').classList.remove('on'));

// --- guardar sozinho, e não deixar descartar o que não foi guardado ---
// É o buraco que fez a pergunta aparecer: duas horas de mundo sumiam ao fechar
// a aba ou ao tocar em "Mundo pelado", sem uma palavra e sem cópia nenhuma.
const sozinho = await pagina.evaluate(() => {
  const { iface } = window.__terrario;
  const lista = () => JSON.parse(localStorage.getItem('terrario:mundos') || '[]');
  localStorage.removeItem('terrario:mundos');
  // mundo em curso que ninguém guardou: é este que a gravação sozinha protege
  Object.assign(iface, { idDoMundo: null, nomeDoMundo: '', anoGuardado: 0, semEspaco: false });
  const sim = window.__terrario.sim;
  iface.guardarAoSair();
  const um = lista();
  // sair de novo não empilha rascunho: um slot só, sempre por cima
  iface.anoGuardado = 0;
  iface.guardarAoSair();
  const dois = lista();
  return { quantos: um.length, id: um[0]?.id, ano: um[0]?.resumo.ano, doSim: sim.ano,
           depoisDeDuas: dois.length };
});
checar('sair da aba guarda o mundo sozinho', sozinho.quantos === 1 && sozinho.ano === sozinho.doSim,
       `${sozinho.quantos} na prateleira, ano ${sozinho.ano} de ${sozinho.doSim}`);
checar('o rascunho automático é um só slot', sozinho.depoisDeDuas === 1 && sozinho.id === 'auto',
       `${sozinho.depoisDeDuas} na prateleira, slot "${sozinho.id}"`);

const descarte = await pagina.evaluate(() => {
  const { iface } = window.__terrario;
  const botao = document.getElementById('recomecar');
  const rotulo = botao.textContent;
  // 1. mundo com anos por guardar: o primeiro toque avisa e não apaga nada
  iface.anoGuardado = 0;
  const gente = window.__terrario.sim.humanos.length;
  botao.click();
  const armado = { gente: window.__terrario.sim.humanos.length,
                   rotulo: botao.textContent, aviso: document.getElementById('recado').classList.contains('on') };
  // 2. o segundo toque descarta
  botao.click();
  const depois = window.__terrario.sim.humanos.length;
  botao.textContent = rotulo;
  return { gente, armado, depois };
});
checar('descartar mundo não guardado pede confirmação',
       descarte.gente > 0 && descarte.armado.gente === descarte.gente && descarte.armado.aviso,
       `${descarte.armado.gente} de ${descarte.gente} pessoas seguem lá, botão diz "${descarte.armado.rotulo}"`);
checar('o segundo toque descarta mesmo', descarte.depois === 0, `${descarte.depois} pessoas`);

const semPerda = await pagina.evaluate(() => {
  const { iface } = window.__terrario;
  // Mundo já guardado não faz pergunta: não há o que perder, e um jogo que
  // pergunta duas vezes por nada ensina a pessoa a tocar duas vezes sem ler.
  window.__terrario.sim.soltar('humano', 40, 40);
  iface.anoGuardado = window.__terrario.sim.ano;
  document.getElementById('recomecar').click();
  return window.__terrario.sim.humanos.length;
});
checar('mundo guardado é descartado sem perguntar', semPerda === 0, `${semPerda} pessoas`);

// Os testes daqui para baixo precisam de um mundo com tribo de pé, e os dois
// acima acabaram de jogar o mundo fora de propósito. Quem o traz de volta é o
// próprio rascunho automático — que é, afinal, o que ele existe para fazer.
const voltou = await pagina.evaluate(() => {
  document.getElementById('abrirMundos').click();
  document.querySelector('#listaMundos .ler')?.click();
  document.getElementById('mundos').classList.remove('on');
  const s = window.__terrario.sim;
  return { pessoas: s.humanos.length, tribos: s.tribos.length };
});
checar('o rascunho automático traz o mundo de volta',
       voltou.pessoas > 0 && voltou.tribos > 0,
       `${voltou.pessoas} pessoas, ${voltou.tribos} tribos`);

// --- a cerca segura o gado, e a fera passa por cima dela ---
const cerca = await pagina.evaluate(() => {
  const { sim } = window.__terrario;
  const t = sim.tribos[0];
  if (!t) return null;
  t.madeira += 90;
  for (let k = 0; k < 3; k++) t.cercar(sim.mundo, Math.round(t.cx) + 10, Math.round(t.cy));
  t.temPasto = true;
  const c = t.curral;
  sim.soltar('rebanho', c.x, c.y);
  const boi = sim.rebanhos[sim.rebanhos.length - 1];
  boi.domesticado = true; boi.tribo = t; t.cabecas++;
  // A fera nasce DENTRO do curral e mira para fora: o que se mede é se a cerca
  // a segura como segura o boi. Ela é reposta a cada tique se morrer — os
  // guardas da tribo a matam em segundos, e "morreu" não é resposta para
  // "atravessa a cerca?".
  const longe = { x: Math.round(c.x) + Math.ceil(c.raio) + 9, y: Math.round(c.y) };
  // Ninguém de arma na mão enquanto se mede a cerca: guarda e caçador matam a
  // fera em segundos e o teste passa a medir a defesa da tribo, não o mourão.
  const domAntes = t.membros.map((m) => m.dom);
  for (const m of t.membros) m.dom = 'lavrador';
  sim.soltar('predador', c.x, c.y);
  let fera = sim.predadores[sim.predadores.length - 1];
  boi.alvo = { x: Math.round(c.x) + 22, y: Math.round(c.y) };
  boi.panico = 8;
  let saiu = false;
  for (let k = 0; k < 260; k++) {
    if (!fera.viva || !sim.predadores.includes(fera)) {
      sim.soltar('predador', c.x, c.y);
      fera = sim.predadores[sim.predadores.length - 1];
    }
    // O boi é mantido vivo de propósito. A fera que o teste solta dentro do
    // curral — e qualquer outra que passe por perto — o come em segundos, e
    // "foi comido" não é resposta para "atravessa a cerca?", pelo mesmo motivo
    // que a fera é reposta acima. O que se mede aqui é o mourão.
    boi.viva = true; boi.causa = null;
    boi.panico = 8;
    fera.presa = null;
    fera.fome = 0.1;
    fera.alvo = longe;
    sim.tique(1 / 12);
    if (!t.dentroDoCurral(fera.x, fera.y)) saiu = true;
  }
  t.membros.forEach((m, k) => { m.dom = domAntes[k] || m.dom; });
  return { boiDentro: t.dentroDoCurral(boi.x, boi.y),
           fora: Math.hypot(boi.x - c.x, boi.y - c.y).toFixed(1),
           saiu, raio: c.raio.toFixed(1),
           feraLonge: Math.hypot(fera.x - c.x, fera.y - c.y).toFixed(1) };
});
checar('o gado não atravessa a cerca, nem em pânico',
       cerca && cerca.boiDentro,
       cerca ? `curral de raio ${cerca.raio}, boi a ${cerca.fora} do centro` : 'sem tribo');
checar('a fera passa por cima da cerca', cerca && cerca.saiu,
       cerca ? `a fera chegou a ${cerca.feraLonge} do centro, num curral de ${cerca.raio}` : '');

// --- eras: água, poço, muro e o ofício que cada degrau exige ---
const eras = await pagina.evaluate(() => {
  const { sim, render } = window.__terrario;
  const t = sim.tribos[0];
  if (!t) return null;
  const semFonte = t.aguaPara;
  // cava um poço à mão e vê o teto de gente subir
  const cx = Math.round(t.cx), cy = Math.round(t.cy);
  sim.mundo.umidade[sim.mundo.idx(cx + 2, cy)] = 0.9;
  t.fontes.push({ x: cx + 2, y: cy, tipo: 'poco' });
  const comFonte = t.aguaPara;
  // muro: precisa de minério, e fecha o anel
  t.minerais += 600;
  t.era = 2;
  for (let k = 0; k < 40; k++) {
    const p = t.sitioDeMuro(sim.mundo, sim.sorte);
    if (p) t.muros.push(p);
  }
  render.refazerCercas(sim);
  const feraFora = t.atrasDoMuro(t.cx, t.cy) && !t.atrasDoMuro(t.cx + 30, t.cy);
  return {
    semFonte, comFonte, muros: t.muros.length,
    murosEmCena: render.figuras.get('muro').natural.count,
    pocosEmCena: render.figuras.get('poco').natural.count,
    feraFora,
    degraus: sim.constructor.name ? null : null,
  };
});
checar('poço dá teto de gente à tribo', eras && eras.comFonte > eras.semFonte,
       eras ? `de ${eras.semFonte} para ${eras.comFonte} pessoas` : 'sem tribo');
checar('o muro sobe e aparece em cena', eras && eras.murosEmCena === eras.muros && eras.muros > 8,
       eras ? `${eras.muros} trechos, ${eras.murosEmCena} desenhados` : '');
checar('o poço aparece em cena', eras && eras.pocosEmCena > 0);
checar('o muro define um dentro e um fora', eras && eras.feraFora);

// --- nação: a cisão que soma em vez de dividir ---
// Antes a filha nascia neutra e em era zero, a seis tiles da mãe: guerra na
// certa e 42% da população de volta ao Bando a cada racha. É o que travava a
// civilização em aldeia. Aqui se força um racha e se olha o que a filha leva.
const nacao = await pagina.evaluate(() => {
  const { sim } = window.__terrario;
  const mae = sim.tribos[0];
  if (!mae) return null;
  mae.era = Math.max(mae.era, 2);
  mae.celeiro += 600;
  // gente bastante para rachar; a cisão é 20% por revisão acima de 34
  for (let k = 0; k < 44; k++) {
    sim.soltar('humano', mae.cx + (sim.sorte() - .5) * 8, mae.cy + (sim.sorte() - .5) * 8);
    const h = sim.humanos[sim.humanos.length - 1];
    h.tribo = mae; mae.membros.push(h); h.idade = 20;
  }
  // só a filha NOVA conta: o mundo já rodou cem anos e a tribo pode ter filhas
  // de antes, nascidas com a era que a mãe tinha na época
  const antigas = new Set(sim.tribos.map((t) => t.id));
  let filha = null;
  for (let k = 0; k < 60 && !filha; k++) {
    sim.revisarTribos(1);
    filha = sim.tribos.find((t) => t.mae === mae.id && !antigas.has(t.id));
  }
  if (!filha) return { filha: null };
  const aoNascer = { era: filha.era, eraDaMae: mae.era, relacao: filha.relacaoCom(mae),
                     memoria: filha.memoria.fera === mae.memoria.fera };
  // uma geração aliada e a nação se forma
  filha.nascidaEm = sim.ano - 13;
  mae.definirRelacao(filha, 'aliada');
  sim.revisarTribos(1);
  const federada = !!filha.nacao && filha.nacao === mae.nacao;
  const mesmaCor = filha.cor === mae.cor;
  // e o inspetor conta
  document.getElementById('fita').querySelectorAll('button')[0]?.click();
  window.__terrario.iface.inspecionar(sim, Math.round(mae.cx), Math.round(mae.cy));
  const painel = document.querySelector('#inspetor dl').textContent;
  return { filha: filha.nome, aoNascer, federada, mesmaCor, painel: /Nação/.test(painel),
           almas: mae.nacao ? mae.nacao.pop : 0 };
});
checar('a filha da cisão nasce aliada e herda a era',
       nacao && nacao.filha && nacao.aoNascer.relacao === 'aliada' && nacao.aoNascer.era >= nacao.aoNascer.eraDaMae - 1,
       nacao && nacao.filha ? `${nacao.filha}: ${nacao.aoNascer.relacao}, era ${nacao.aoNascer.era} (mãe ${nacao.aoNascer.eraDaMae})` : 'não rachou');
checar('uma geração aliada e a filha entra na nação da mãe', nacao && nacao.federada && nacao.mesmaCor,
       nacao && nacao.federada ? `nação com ${nacao.almas} almas, uma cor só` : 'sem nação');
checar('o inspetor diz a nação', nacao && nacao.painel);

// --- painéis que encolhem: a tela é o jogo ---
const naTela = (sel) => pagina.locator(sel).isVisible();
await pagina.locator('#dobrarEstado').click();
checar('a barra de estado encolhe', await pagina.locator('#estado.fechada').count() === 1);
await pagina.locator('#dobrarEstado').click();
await pagina.locator('#dobrarPaleta').click();
checar('a paleta encolhe e some com os pincéis', !(await naTela('#grupos')));
checar('encolhida, a paleta ainda diz qual é a ferramenta', await naTela('#ferramentaNome'));
await pagina.locator('#dobrarPaleta').click();

await pagina.locator('#modoLimpo').click();
const limpo = { paleta: await naTela('#paleta'), cronica: await naTela('#cronica'),
                estado: await naTela('#estado'), tempo: await naTela('#tempo') };
checar('o modo limpo esconde os painéis', !limpo.paleta && !limpo.cronica && !limpo.estado,
       `paleta ${limpo.paleta}, crônica ${limpo.cronica}, estado ${limpo.estado}`);
checar('o modo limpo mantém o controle de tempo', limpo.tempo);
await foto('modo-limpo');
await pagina.locator('#modoLimpo').click();
checar('o modo limpo devolve os painéis', await naTela('#paleta') && await naTela('#cronica'));

// o botão de modo divide a barra com as velocidades e não pode virar uma delas
await pagina.locator('#tempo button[data-vel="16"]').click();
await pagina.locator('#modoLimpo').click();
await pagina.locator('#modoLimpo').click();
checar('esconder painéis não mexe na velocidade',
       await pagina.locator('#tempo button[data-vel="16"].on').count() === 1);

// --- curral e guarda: a cerca fecha uma volta e o mourão pisa no chão ---
// O surgimento espontâneo é assunto do teste de mundo; aqui o que se verifica é
// que a cerca chega à tela inteira e na altura certa. Figura enterrada um metro
// abaixo do chão já passou despercebida por asserção nenhuma neste projeto.
const curral = await pagina.evaluate(() => {
  const { sim, render } = window.__terrario;
  const t = sim.tribos[0];
  if (!t) return null;
  t.madeira += 80;
  t.cercar(sim.mundo, Math.round(t.cx), Math.round(t.cy));
  const g = t.membros.find((m) => m.viva && m.adulto);
  if (g) g.dom = 'guarda';
  render.atualizarSeres(sim, 0.016);
  render.refazerCercas(sim);   // a cerca é redesenhada por relógio, não por quadro
  const malha = render.figuras.get('cerca').natural;
  const a = malha.instanceMatrix.array;
  let piorDesvio = 0;
  for (let k = 0; k < malha.count; k++) {
    const x = a[k * 16 + 12], y = a[k * 16 + 13], z = a[k * 16 + 14];
    piorDesvio = Math.max(piorDesvio, Math.abs(y - render.alturaEm(x, z)));
  }
  // a malha guarda a cerca de TODAS as tribos, não só a desta: mais de uma
  // pode ter curral a esta altura, e comparar com uma só dá falso vermelho
  const mouroes = sim.tribos.reduce((n, o) => n + o.cercas.length, 0);
  return { mouroes, desteAqui: t.cercas.length, desenhados: malha.count, piorDesvio,
           raio: t.curral.raio, gado: t.capacidadeCurral,
           guarda: render.figuras.get('humano:guarda').natural.count };
});
checar('a tribo cerca um curral', curral && curral.desteAqui > 8,
       curral ? `${curral.desteAqui} mourões, raio ${curral.raio.toFixed(1)}, cabem ${curral.gado}` : 'sem tribo');
checar('a cerca inteira chega à tela', curral && curral.desenhados === curral.mouroes,
       curral ? `${curral.desenhados} de ${curral.mouroes}` : '');
checar('o mourão pisa no topo do tile', curral && curral.piorDesvio < 0.01,
       curral ? `desvio ${curral.piorDesvio.toFixed(3)}` : '');
checar('o guarda tem boneco próprio', curral && curral.guarda > 0, curral ? `${curral.guarda} em cena` : '');
await foto('curral');

// --- novo mundo não quebra nada ---
// Dois toques, e os dois de dentro da página: o mundo aqui tem anos por
// guardar, e desde que descartar passou a pedir confirmação é assim que se faz.
// Pelo `locator` do Playwright os dois cliques ficavam a segundos um do outro
// — checagem de estabilidade num laço a dez quadros por segundo — e a janela
// de confirmação fechava no meio, deixando o teste medir o relógio da máquina.
await pagina.evaluate(() => {
  const b = document.getElementById('recomecar');
  b.click();
  if (b.classList.contains('armado')) b.click();
});
await pagina.waitForTimeout(900);
const novo = await estado();
checar('novo mundo recomeça do zero', novo.humanos === 0 && novo.ano < 5, `ano ${novo.ano}, ${novo.humanos} pessoas`);
await foto('novo-mundo');

// --- responsividade: o jogo é de telefone, e telefone tem seis tamanhos ---
// A verificação que faltava. O botão "Mundos" chegou a começar em x=370 numa
// tela de 375 — o painel de guardar, inalcançável, justo o que existe para não
// perder o mundo — e nada acusou, porque ninguém media onde os controles caem.
// Aqui se afirma o mínimo de cada tela: tudo dentro, nada em cima de nada, e a
// paleta sem comer o mundo (media 30% de uma tela de 375 antes desta rodada).
const TELAS = [
  ['SE deitado',    667, 375], ['mini deitado', 812, 375],
  ['15 deitado',    852, 393], ['Max deitado',  932, 430],
  ['SE em pé',      375, 667], ['15 em pé',     393, 852],
];
const medir = () => pagina.evaluate(() => {
  const cx = (e) => { const r = e.getBoundingClientRect();
    return { l: r.left, r: r.right, t: r.top, b: r.bottom, h: r.height }; };
  const fora = [];
  // Todo controle que se toca: se não cabe na tela, não existe.
  for (const e of document.querySelectorAll('#tempo button, #ajustes button, #estado, #paleta, .dobrar')) {
    const c = cx(e);
    if (c.l < -1 || c.r > innerWidth + 1 || c.t < -1 || c.b > innerHeight + 1) {
      fora.push(e.id || e.textContent.trim().slice(0, 12));
    }
  }
  const cai = {};
  for (const id of ['estado', 'tempo', 'fita', 'cronica', 'paleta']) {
    const e = document.getElementById(id);
    if (e && e.offsetParent !== null) cai[id] = cx(e);
  }
  const bate = (a, b) => a && b && a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
  const colide = [];
  for (const [x, y] of [['estado', 'tempo'], ['estado', 'fita'], ['estado', 'cronica'],
                        ['tempo', 'cronica'], ['fita', 'cronica'], ['fita', 'paleta'],
                        ['cronica', 'paleta']]) {
    if (bate(cai[x], cai[y])) colide.push(`${x}×${y}`);
  }
  return { fora, colide, paleta: cai.paleta.h / innerHeight,
           rolaDeitado: document.documentElement.scrollWidth - innerWidth };
});
for (const [nome, l, a] of TELAS) {
  await pagina.setViewportSize({ width: l, height: a });
  await pagina.waitForTimeout(260);
  const m = await medir();
  checar(`${nome}: todo controle cabe na tela`, m.fora.length === 0 && m.rolaDeitado <= 0,
         m.fora.length ? `fora: ${m.fora.join(', ')}` : `${l}×${a}`);
  checar(`${nome}: nenhum painel em cima do outro`, m.colide.length === 0,
         m.colide.join(', ') || `${l}×${a}`);
  // Deitado é o formato apertado: em pé sobra altura e a paleta pode crescer.
  const teto = a < l ? 0.28 : 0.34;
  checar(`${nome}: a paleta deixa o mundo aparecer`, m.paleta <= teto,
         `paleta com ${(m.paleta * 100).toFixed(0)}% da altura, teto ${(teto * 100) | 0}%`);
}
await pagina.setViewportSize({ width: 390, height: 844 });
await pagina.waitForTimeout(250);
await foto('retrato');

checar('nenhum erro no console', problemas.length === 0, problemas.slice(0, 3).join(' | '));

await navegador.close();
servidor.close();
const falhas = passos.filter((p) => !p).length;
console.log(`\n${passos.length - falhas}/${passos.length} verificações passaram`);
process.exit(falhas ? 1 : 0);
