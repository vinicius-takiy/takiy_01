// Roda o mundo sem tela e conta o que aconteceu.
//
// É o teste que importa neste jogo. Regra ingênua de emergência dá em extinção
// em trinta segundos ou em tédio estável, e as duas coisas passam despercebidas
// olhando bonito na tela. Aqui trezentos anos levam dois segundos.
//
//   node teste/equilibrio.mjs [anos] [semente] [--cronica]
//   node teste/equilibrio.mjs 300 varias        # varre várias sementes

import { Simulacao } from '../src/sim.js';
import { ANO } from '../src/agentes.js';
import { T } from '../src/mundo.js';

const TEC = ['Pedra', 'Cobre', 'Bronze', 'Ferro'];
const anos = Number(process.argv[2]) || 300;
const arg = process.argv[3] || '7';
const verCronica = process.argv.includes('--cronica');
const varias = arg === 'varias';
const sementes = varias ? [7, 42, 1234, 90210, 5] : [Number(arg)];

/** Uma partida completa. Devolve picos, linha do tempo e resumo final. */
function rodar(semente) {
  const sim = new Simulacao(semente);

  // Berço escolhido como um jogador escolheria: o pedaço com mais terra boa em
  // volta. Largar o bando no primeiro tile fértil achado misturava geografia
  // ruim com equilíbrio ruim, e as duas coisas viravam a mesma falha no relatório.
  let berco = null, melhor = -1;
  for (let y = 6; y < sim.mundo.n - 6; y += 3) {
    for (let x = 6; x < sim.mundo.n - 6; x += 3) {
      let nota = 0;
      for (let dy = -8; dy <= 8; dy += 2) {
        for (let dx = -8; dx <= 8; dx += 2) {
          if (!sim.mundo.dentro(x + dx, y + dy)) continue;
          const t = sim.mundo.terreno[sim.mundo.idx(x + dx, y + dy)];
          if (t === T.FERTIL) nota += 3;
          else if (t === T.GRAMA) nota += 2;
          else if (t === T.FLORESTA) nota += 2;
        }
      }
      if (sim.mundo.andavel(x, y) && nota > melhor) { melhor = nota; berco = { x, y }; }
    }
  }
  if (!berco) return null;

  for (let k = 0; k < 10; k++) sim.soltar('humano', berco.x + (sim.sorte() - .5) * 5, berco.y + (sim.sorte() - .5) * 5);
  // Três herbívoros: boi para a tribo criar, capivara na margem e lebre no
  // campo. Os miúdos são o colchão do predador — sem eles a fera come o boi e
  // depois some, que é o que este relatório vinha acusando havia várias rodadas.
  for (let k = 0; k < 26; k++) sim.soltar('rebanho', berco.x + (sim.sorte() - .5) * 26, berco.y + (sim.sorte() - .5) * 26);
  for (let k = 0; k < 22; k++) sim.soltar('capivara', berco.x + (sim.sorte() - .5) * 40, berco.y + (sim.sorte() - .5) * 40);
  for (let k = 0; k < 30; k++) sim.soltar('lebre', berco.x + (sim.sorte() - .5) * 34, berco.y + (sim.sorte() - .5) * 34);
  for (let k = 0; k < 3; k++) sim.soltar('predador', berco.x + (sim.sorte() - .5) * 40, berco.y + (sim.sorte() - .5) * 40);
  // Água povoada, senão a costa é cenário: sem peixe não há pesca, e sem pesca
  // metade do que se afirma sobre tribo de beira d'água não é medido.
  let soltos = 0;
  for (let t = 0; t < 4000 && soltos < 60; t++) {
    const x = Math.round(sim.sorte() * (sim.mundo.n - 1)), y = Math.round(sim.sorte() * (sim.mundo.n - 1));
    if (!sim.mundo.ehAgua(x, y)) continue;
    sim.soltar(soltos % 20 === 19 ? 'jacare' : 'peixe', x, y);
    soltos++;
  }

  // Picos medidos a cada tique: amostrar de vinte em vinte anos deixa passar
  // exatamente o que interessa quando o mundo colapsa entre duas amostras.
  const pico = { humanos: 0, tribos: 0, plantando: 0, pastoreando: 0, minerando: 0,
                 guerras: 0, guerrasEntreParentes: 0, aliancas: 0, maiorTribo: 0, predadores: 0, tec: 0,
                 currais: 0, guardas: 0, gado: 0, peixes: 0, jacares: 0, pescados: 0,
                 bois: 0, capivaras: 0, lebres: 0, brotos: 0, queimando: 0,
                 eraMaxima: 0, pocos: 0, muros: 0, nacoes: 0, naNacao: 0, maiorNacao: 0, filhasComEra: 0 };
  const linha = [];
  const dt = 1 / 12;
  const passos = Math.ceil((anos * ANO) / dt);
  const intervalo = Math.max(5, Math.round(anos / 22));
  let proximo = 0;
  const inicio = Date.now();

  for (let p = 0; p < passos; p++) {
    sim.tique(dt);
    const r = sim.resumo();
    for (const k of Object.keys(pico)) if (k !== 'tec' && r[k] > pico[k]) pico[k] = r[k];
    pico.tec = Math.max(pico.tec, TEC.indexOf(r.tecnologiaMaxima));
    if (sim.ano >= proximo) { proximo += intervalo; linha.push(r); }
    if (sim.humanos.length === 0) { linha.push(r); break; }
  }
  const fim = sim.resumo();
  fim.censo = sim.mundo.censo();
  return { sim, pico, linha, ms: Date.now() - inicio, fim };
}

function avaliar({ pico, fim }) {
  return [
    ['a humanidade não se extingue', fim.humanos > 0, `${fim.humanos} pessoas`],
    ['a população cresce além do que foi semeado', pico.humanos >= 24, `pico ${pico.humanos}`],
    ['a ecologia segura antes do teto do código', pico.humanos < 1400, `pico ${pico.humanos}`],
    ['surgem várias tribos', pico.tribos >= 3, `pico ${pico.tribos}`],
    ['alguma tribo começa a plantar', pico.plantando > 0, ''],
    ['alguma tribo domestica rebanho', pico.pastoreando > 0, ''],
    ['alguma tribo ergue curral', pico.currais > 0, `pico ${pico.currais}`],
    // Bicho não entra em curral sozinho: gado no rebanho da tribo prova a
    // corrente inteira — cerca de pé, alguém foi buscar e trouxe tocando.
    ['alguém conduz bicho para dentro da cerca', pico.gado > 0, `pico ${pico.gado}`],
    // guarda é o segundo degrau: só aparece quando já há cerca para rondar ou
    // fronteira em guerra. Zero aqui quer dizer que a tribo nunca amadureceu.
    ['a cerca ganha quem a ronde', pico.guardas > 0, `pico ${pico.guardas}`],
    ['alguma tribo abre mina', pico.minerando > 0, ''],
    ['a tecnologia avança', pico.tec > 0, TEC[pico.tec]],
    // Era é o eixo do jogo agora: subir de degrau exige comida, água, obra de
    // pedra e gente com o ofício certo, tudo ao mesmo tempo.
    ['alguma tribo cava poço', pico.pocos > 0, `${pico.pocos} poços`],
    ['alguma tribo chega à Era da Pedra', pico.eraMaxima >= 2, `era ${pico.eraMaxima}`],
    ['alguma tribo ergue muro', pico.muros > 0, `${pico.muros} trechos`],
    ['alguma guerra estoura', pico.guerras > 0, `pico ${pico.guerras}`],
    // Civilização é o que se acumula. Filha que nasce em era zero e em guerra
    // com a mãe devolve a população ao Bando a cada cisão; a nação é o
    // contrário disso — a cisão que soma em vez de dividir.
    ['a filha da cisão herda a era', pico.filhasComEra > 0, `${pico.filhasComEra} filhas com era`],
    ['alguma nação se forma', pico.nacoes > 0, `${pico.nacoes} nações, a maior com ${pico.maiorNacao} almas`],
    ['alguma aliança se forma', pico.aliancas > 0, `pico ${pico.aliancas}`],
    ['o rebanho selvagem sobrevive', fim.rebanhos > 0, `${fim.rebanhos}`],
    ['o predador não se extingue', fim.predadores > 0, `${fim.predadores}`],
    ['o predador não vira praga', pico.predadores <= 60, `pico ${pico.predadores}`],
    ['o cardume não some da água', fim.peixes > 0, `${fim.peixes} peixes`],
    ['o jacaré não se extingue nem vira praga', fim.jacares > 0 && pico.jacares <= 40,
      `${fim.jacares} de pico ${pico.jacares}`],
    ['alguém come do rio', fim.pescados > 0, `${fim.pescados} peixes pescados`],
    ['as três espécies de herbívoro atravessam', fim.bois > 0 && fim.capivaras > 0 && fim.lebres > 0,
      `${fim.bois} bois, ${fim.capivaras} capivaras, ${fim.lebres} lebres`],
    // O teto é rede de segurança. Se as três espécies vivem encostadas nele,
    // quem calibra a fauna é a constante e não o mundo — e era exatamente esse
    // o estado antes: 149/150, 110/110, 150/150.
    ['alguma espécie vive abaixo do próprio teto',
      fim.bois < fim.tetos.gado * 0.92 || fim.capivaras < fim.tetos.capivara * 0.92
      || fim.lebres < fim.tetos.lebre * 0.92,
      `${fim.bois}/${fim.tetos.gado}, ${fim.capivaras}/${fim.tetos.capivara}, ${fim.lebres}/${fim.tetos.lebre}`],
    ['a fauna se espalha pelo mapa', fim.aglomeracao.top5 < 72,
      `${fim.aglomeracao.top5}% em cinco células, maior com ${fim.aglomeracao.maior}`],
    ['o raio acende alguma coisa', fim.tilesQueimados > 0, `${fim.tilesQueimados} tiles queimados`],
    // O mundo tem que se refazer sozinho: mata zero ao fim de trezentos anos é
    // um mapa raspado sem volta, não um ecossistema.
    ['a mata não some do mundo', (fim.censo[4] || 0) > 0, `${fim.censo[4] || 0} tiles de mata`],
    ['o fogo não come o mundo', fim.tilesQueimados < 2600, `${fim.tilesQueimados} tiles queimados`],
  ];
}

if (varias) {
  console.log('semente    anos  pess  pico  trib  plant past mina  guer alia  pred   tec   veredito');
  let totalFalhas = 0;
  for (const s of sementes) {
    const r = rodar(s);
    if (!r) { console.log(String(s).padStart(7), '  mundo sem terra firme'); continue; }
    const testes = avaliar(r);
    const falhas = testes.filter(([, ok]) => !ok);
    totalFalhas += falhas.length;
    console.log(
      String(s).padStart(7), String(r.sim.ano).padStart(6), String(r.fim.humanos).padStart(5),
      String(r.pico.humanos).padStart(5), String(r.pico.tribos).padStart(5),
      String(r.pico.plantando).padStart(6), String(r.pico.pastoreando).padStart(4),
      String(r.pico.minerando).padStart(4), String(r.pico.guerras).padStart(5),
      String(r.pico.aliancas).padStart(4), String(r.pico.predadores).padStart(5),
      TEC[r.pico.tec].padStart(7),
      falhas.length ? '  ' + falhas.map(([n]) => n).join('; ') : '  tudo ok');
  }
  console.log(`\n${totalFalhas} falhas somando as ${sementes.length} sementes`);
  process.exit(totalFalhas ? 1 : 0);
}

const r = rodar(sementes[0]);
if (!r) { console.error('mundo sem terra firme; troque a semente'); process.exit(2); }
console.log(`semente ${sementes[0]} · ${r.sim.ano} anos em ${r.ms} ms (${(r.sim.ano / (r.ms / 1000)).toFixed(0)} anos/s)\n`);
console.log('ano   pess  reb  pred trib  planta pasto mina  guerra alianca  maior  tec');
for (const l of r.linha) {
  console.log(
    String(l.ano).padStart(4), String(l.humanos).padStart(5), String(l.rebanhos).padStart(4),
    String(l.predadores).padStart(4), String(l.tribos).padStart(4), String(l.plantando).padStart(7),
    String(l.pastoreando).padStart(5), String(l.minerando).padStart(5), String(l.guerras).padStart(6),
    String(l.aliancas).padStart(7), String(l.maiorTribo).padStart(6), l.tecnologiaMaxima.padStart(7),
  );
}
console.log('\npicos  — pessoas', r.pico.humanos, '· tribos', r.pico.tribos, '· maior', r.pico.maiorTribo,
            '· predadores', r.pico.predadores, '· guerras', r.pico.guerras, '· alianças', r.pico.aliancas,
            '· tec', TEC[r.pico.tec]);
console.log('mortes — fome', r.fim.mortesPorFome, '· fera', r.fim.mortesPorPredador, '· guerra', r.fim.mortesEmGuerra);
const censo = r.fim.censo;
console.log('nação  — nações', r.fim.nacoes, '· tribos federadas', r.fim.naNacao, 'de', r.fim.tribos,
            '· maior', r.fim.maiorNacao, 'almas · guerras entre parentes no pico', r.pico.guerrasEntreParentes, 'de', r.pico.guerras);
console.log('civil  — era máxima', r.pico.eraMaxima, '· poços', r.fim.pocos, '· muro', r.fim.muros,
            '· com sede', r.fim.comSede, '· eras agora',
            r.sim.tribos.map((t) => t.era).sort((a, b) => b - a).slice(0, 8).join(''));
console.log('mapa   — mata', censo[4] || 0, '· broto', censo[10] || 0, '· campo', censo[2] || 0,
            '· fértil', censo[3] || 0, '· terra nua', censo[9] || 0,
            '| queimados', r.fim.tilesQueimados, '· raio', r.fim.mortosPorRaio, '· fogo', r.fim.mortosNoFogo);
console.log('bicho  — bois', r.fim.bois, '· capivaras', r.fim.capivaras, '· lebres', r.fim.lebres,
            '| em', r.fim.aglomeracao.celulas, 'células, top5', r.fim.aglomeracao.top5 + '%');
console.log('fera   — vivas', r.fim.predadores, '· matilhas', r.fim.matilhas,
            '· vindas da mata', r.fim.ferasVindasDaMata, '· abatidas na cerca', r.fim.ferasAbatidasNaCerca);
console.log('fim    —', Object.entries(r.sim.fimDoBicho).sort((a, b) => b[1] - a[1])
            .slice(0, 8).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('água   — peixes', r.fim.peixes, '· jacarés', r.fim.jacares, '· pescados', r.fim.pescados,
            '· bichos afogados', r.fim.afogados, '· tribos com margem', r.fim.pescando);

if (verCronica) {
  console.log('\ncrônica:');
  for (const c of r.sim.cronicas) console.log(`  ano ${String(c.ano).padStart(4)}  ${c.texto}`);
}

const testes = avaliar(r);
console.log();
let falhas = 0;
for (const [nome, ok, detalhe] of testes) {
  if (!ok) falhas++;
  console.log(`${ok ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? '  — ' + detalhe : ''}`);
}
console.log(`\n${testes.length - falhas}/${testes.length}`);
process.exit(falhas ? 1 : 0);
