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
  // longe da aldeia de propósito: pintar água em cima da tribo afoga a tribo, e
  // aí as checagens seguintes reprovam por falta de gente, não por defeito
  const t0 = sim.tribos[0];
  const cx = t0 ? Math.max(6, Math.min(m.n - 7, Math.round(t0.cx) + 22)) : 14;
  const cy = t0 ? Math.max(6, Math.min(m.n - 7, Math.round(t0.cy) + 22)) : 14;
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
       agua.pares > 5 && agua.degrau < 0.30,
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
await pagina.locator('#recomecar').click();
await pagina.waitForTimeout(900);
const novo = await estado();
checar('novo mundo recomeça do zero', novo.humanos === 0 && novo.ano < 5, `ano ${novo.ano}, ${novo.humanos} pessoas`);
await foto('novo-mundo');

// --- retrato: o jogo se apresenta como mobile e precisa funcionar nas duas orientações ---
await pagina.setViewportSize({ width: 390, height: 844 });
await pagina.waitForTimeout(250);
const retratoOk = await pagina.evaluate(() => {
  const estado = document.getElementById('estado').getBoundingClientRect();
  const tempo = document.getElementById('tempo').getBoundingClientRect();
  const cronica = document.getElementById('cronica').getBoundingClientRect();
  const paleta = document.getElementById('paleta').getBoundingClientRect();
  return estado.left >= 0 && estado.right <= innerWidth && paleta.left >= 0 && paleta.right <= innerWidth
    && estado.bottom <= tempo.top && tempo.bottom <= cronica.top;
});
checar('a interface se adapta ao modo retrato', retratoOk);
await foto('retrato');

checar('nenhum erro no console', problemas.length === 0, problemas.slice(0, 3).join(' | '));

await navegador.close();
servidor.close();
const falhas = passos.filter((p) => !p).length;
console.log(`\n${passos.length - falhas}/${passos.length} verificações passaram`);
process.exit(falhas ? 1 : 0);
