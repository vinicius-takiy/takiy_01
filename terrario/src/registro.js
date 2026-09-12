// Registro de mundos: guardar o que você criou e voltar nele depois.
//
// Fica em localStorage, que é o único armazenamento que cumpre as regras da
// casa — sem servidor, sem download, funciona offline. O orçamento é de uns 5
// MB por origem, então o formato importa mais do que a elegância.
//
// Duas economias sustentam o formato. A primeira: relevo e ruído de umidade
// saem da semente, então não se guarda nada disso — na hora de abrir, gera-se o
// mundo com a mesma semente e por cima dele se aplicam os campos salvos. A
// segunda: os campos contínuos (comida, umidade, vigor…) vão de 0 a 1 e cabem
// num byte cada; guardá-los como Float32 multiplicaria o arquivo por quatro sem
// mudar nada que o olho veja.

import { Mundo, T } from './mundo.js';
import { Humano, Rebanho, Predador, Peixe, Jacare } from './agentes.js';
import { Tribo } from './tribos.js';

const CHAVE = 'terrario:mundos';
const VERSAO = 1;

// ---------------------------------------------------------------- bytes
const b64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
};
const deB64 = (txt) => {
  const bin = atob(txt);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/** Float 0..1 num byte. Perde 1/255 de precisão, que é menos do que a
 *  simulação mexe num tique — e economiza três quartos do arquivo. */
const paraByte = (arr) => {
  const out = new Uint8Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(arr[i] * 255)));
  return out;
};
const deByte = (bytes, destino) => {
  for (let i = 0; i < destino.length; i++) destino[i] = bytes[i] / 255;
};

const n2 = (v) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------- guardar
export function empacotar(sim, nome) {
  const m = sim.mundo;
  const tribos = sim.tribos.map((t) => ({
    id: t.id, nome: t.nome, cor: t.cor, cx: n2(t.cx), cy: n2(t.cy),
    celeiro: n2(t.celeiro), minerais: n2(t.minerais), tecnologia: t.tecnologia,
    madeira: n2(t.madeira), cabecas: t.cabecas, idade: n2(t.idade),
    nascimentos: t.nascimentos, mortes: t.mortes,
    temPlantacao: t.temPlantacao, temPasto: t.temPasto, temMina: t.temMina,
    curral: t.curral, ocas: t.ocas.map((o) => [o.x, o.y]),
    relacoes: [...t.relacoes.entries()],
  }));

  const gente = sim.humanos.filter((h) => h.viva).map((h) => [
    n2(h.x), n2(h.y), n2(h.idade), n2(h.expectativa), n2(h.fome),
    h.dom, h.tribo ? h.tribo.id : -1, n2(h.descanso),
  ]);
  const bichos = sim.rebanhos.filter((r) => r.viva).map((r) => [
    n2(r.x), n2(r.y), n2(r.idade), n2(r.expectativa), r.especie,
    r.domesticado ? 1 : 0, r.tribo ? r.tribo.id : -1,
  ]);
  const feras = sim.predadores.filter((p) => p.viva).map((p) => [n2(p.x), n2(p.y), n2(p.idade), n2(p.fome)]);
  const peixes = sim.peixes.filter((p) => p.viva).map((p) => [n2(p.x), n2(p.y), n2(p.idade)]);
  const jacares = sim.jacares.filter((j) => j.viva).map((j) => [n2(j.x), n2(j.y), n2(j.idade), n2(j.fome)]);

  return {
    v: VERSAO,
    nome: nome || `Mundo do ano ${sim.ano}`,
    quando: Date.now(),
    semente: sim.semente,
    pelado: sim.pelado,
    tempo: n2(sim.tempo),
    resumo: { ano: sim.ano, pessoas: gente.length, tribos: tribos.length },
    grade: {
      terreno: b64(m.terreno),
      base: b64(m.base),
      minerio: b64(m.minerio),
      comida: b64(paraByte(m.comida)),
      crescer: b64(paraByte(m.crescer)),
      vigor: b64(paraByte(m.vigor)),
      madeira: b64(paraByte(m.madeira)),
      umidade: b64(paraByte(m.umidade)),
      nutriente: b64(paraByte(m.nutriente)),
    },
    desmatados: [...m.desmatados],
    tribos, gente, bichos, feras, peixes, jacares,
    cronicas: sim.cronicas.slice(-60),
  };
}

// ---------------------------------------------------------------- abrir
/**
 * Refaz a simulação a partir do pacote. Recebe a classe `Simulacao` de fora
 * para não fechar um ciclo de importação — sim.js já importa daqui não, mas o
 * caminho inverso existiria no dia em que precisasse, e ciclo de módulo em ES
 * nativo dá `undefined` silencioso em vez de erro.
 */
export function desempacotar(Simulacao, pacote) {
  const sim = new Simulacao(pacote.semente, { pelado: pacote.pelado });
  const m = sim.mundo;

  m.terreno.set(deB64(pacote.grade.terreno));
  m.base.set(deB64(pacote.grade.base));
  m.minerio.set(deB64(pacote.grade.minerio));
  deByte(deB64(pacote.grade.comida), m.comida);
  deByte(deB64(pacote.grade.crescer), m.crescer);
  deByte(deB64(pacote.grade.vigor), m.vigor);
  deByte(deB64(pacote.grade.madeira), m.madeira);
  deByte(deB64(pacote.grade.umidade), m.umidade);
  deByte(deB64(pacote.grade.nutriente), m.nutriente);
  m.desmatados = new Set(pacote.desmatados);
  m.tilesDeMata = 0;
  for (const tipo of m.terreno) if (tipo === T.FLORESTA) m.tilesDeMata++;
  for (let i = 0; i < m.terreno.length; i++) m.altura[i] = m.alturaDe(i, m.terreno[i]);
  m.aguaMudou = true;
  m.recalcularUmidade();
  for (let i = 0; i < m.terreno.length; i++) m.tocar(i);

  sim.tempo = pacote.tempo;
  sim.cronicas = pacote.cronicas || [];

  const porId = new Map();
  for (const d of pacote.tribos) {
    const t = new Tribo(d.cx, d.cy, 0);
    Object.assign(t, {
      id: d.id, nome: d.nome, cor: d.cor, cx: d.cx, cy: d.cy,
      celeiro: d.celeiro, minerais: d.minerais, tecnologia: d.tecnologia,
      madeira: d.madeira, cabecas: d.cabecas, idade: d.idade,
      nascimentos: d.nascimentos, mortes: d.mortes,
      temPlantacao: d.temPlantacao, temPasto: d.temPasto, temMina: d.temMina,
      curral: d.curral, ocas: d.ocas.map(([x, y]) => ({ x, y })),
      relacoes: new Map(d.relacoes), membros: [],
    });
    if (t.curral) t.recalcularCerca(m);
    porId.set(t.id, t);
  }
  sim.tribos = [...porId.values()];
  sim.porId = porId;
  Tribo.retomarIds(Math.max(0, ...sim.tribos.map((t) => t.id)) + 1);

  sim.humanos = pacote.gente.map(([x, y, idade, exp, fome, dom, tribo, descanso]) => {
    const h = new Humano(x, y, idade, sim.sorte);
    h.expectativa = exp; h.fome = fome; h.dom = dom; h.descanso = descanso;
    h.tribo = porId.get(tribo) || null;
    if (h.tribo) h.tribo.membros.push(h);
    return h;
  });
  sim.rebanhos = pacote.bichos.map(([x, y, idade, exp, especie, dom, tribo]) => {
    const r = new Rebanho(x, y, sim.sorte, especie);
    r.idade = idade; r.expectativa = exp; r.domesticado = !!dom;
    r.tribo = porId.get(tribo) || null;
    return r;
  });
  sim.predadores = pacote.feras.map(([x, y, idade, fome]) => {
    const p = new Predador(x, y, sim.sorte);
    p.idade = idade; p.fome = fome;
    return p;
  });
  sim.peixes = (pacote.peixes || []).map(([x, y, idade]) => {
    const p = new Peixe(x, y, sim.sorte);
    p.idade = idade;
    return p;
  });
  sim.jacares = (pacote.jacares || []).map(([x, y, idade, fome]) => {
    const j = new Jacare(x, y, sim.sorte);
    j.idade = idade; j.fome = fome;
    return j;
  });
  sim.recontarAgua();
  return sim;
}

// ---------------------------------------------------------------- prateleira
export function listar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? JSON.parse(bruto) : [];
  } catch { return []; }
}

/** Só o cabeçalho de cada mundo: a lista não precisa carregar os 6400 tiles. */
export function indice() {
  return listar().map(({ id, nome, quando, resumo, semente }) => ({ id, nome, quando, resumo, semente }));
}

export function abrir(id) {
  return listar().find((m) => m.id === id) || null;
}

export function apagar(id) {
  const mundos = listar().filter((m) => m.id !== id);
  localStorage.setItem(CHAVE, JSON.stringify(mundos));
  return mundos.length;
}

/**
 * Grava. Devolve `{ok, erro}` — quota estourada é o caso comum e não pode
 * derrubar o jogo: quem está jogando há duas horas não quer perder a partida
 * porque a nona gravação não coube.
 */
export function guardar(sim, nome, id = null) {
  const pacote = empacotar(sim, nome);
  pacote.id = id || `m${Date.now().toString(36)}`;
  const mundos = listar().filter((m) => m.id !== pacote.id);
  mundos.unshift(pacote);
  while (mundos.length > 8) mundos.pop();
  try {
    localStorage.setItem(CHAVE, JSON.stringify(mundos));
    return { ok: true, id: pacote.id };
  } catch (e) {
    // tenta de novo com só este mundo, que é o que o jogador acabou de pedir
    try {
      localStorage.setItem(CHAVE, JSON.stringify([pacote]));
      return { ok: true, id: pacote.id, aviso: 'não coube tudo: os mundos antigos foram descartados' };
    } catch {
      return { ok: false, erro: 'o navegador não tem espaço para guardar este mundo' };
    }
  }
}
