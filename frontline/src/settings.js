// Preferências de controle. É o objeto central da fatia 1: trocar esquema em
// tempo real é o experimento, então tudo aqui é lido a cada quadro, não no boot.

const CHAVE = 'frontline.controles.v1';

/** Os três esquemas em teste. `mover` e `mirar` mudam o resto do jogo. */
export const ESQUEMAS = [
  {
    id: 'duplo',
    nome: 'Duplo analógico',
    desc: 'O padrão dos FPS de celular. Analógico virtual à esquerda move, arrastar na metade direita mira.',
    mover: 'stick',
    mirar: 'arrasto',
    autofogoPadrao: false,
    assistPadrao: 1,
  },
  {
    id: 'assistido',
    nome: 'Assistido (estilo CoD Mobile)',
    desc: 'Mesmos controles, mas a mira gruda no inimigo mais próximo do centro e o tiro sai sozinho. Perdoa muito o dedo.',
    mover: 'stick',
    mirar: 'arrasto',
    autofogoPadrao: true,
    assistPadrao: 3,
  },
  {
    id: 'trilho',
    nome: 'Sobre trilhos (uma mão)',
    desc: 'Você não anda: avança de cobertura em cobertura tocando no ponto seguinte. A tela inteira vira mira. É o formato que melhor cabe no toque.',
    mover: 'trilho',
    mirar: 'arrasto-total',
    autofogoPadrao: false,
    assistPadrao: 2,
  },
];

const PADRAO = {
  esquema: 'duplo',
  sensibilidade: 1.2,
  assist: 1,
  autofogo: false,
  invY: false,
  canhoto: false,
  som: true,
};

/** Multiplicadores da assistência de mira, por nível do slider (0–3). */
export const ASSIST = [
  { rotulo: 'Nenhuma', cone: 0, cola: 0, raio: 0 },
  { rotulo: 'Leve', cone: 1.6, cola: 0.18, raio: 0.9 },
  { rotulo: 'Média', cone: 3.0, cola: 0.38, raio: 1.5 },
  { rotulo: 'Forte', cone: 4.5, cola: 0.62, raio: 2.2 },
];

function ler() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return { ...PADRAO };
    return { ...PADRAO, ...JSON.parse(bruto) };
  } catch {
    return { ...PADRAO };
  }
}

export const cfg = ler();

export function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(cfg));
  } catch {
    /* modo privado do Safari: joga sem salvar */
  }
}

export function esquemaAtual() {
  return ESQUEMAS.find((e) => e.id === cfg.esquema) || ESQUEMAS[0];
}

/** Chamado ao trocar de esquema: adota os padrões daquele esquema. */
export function aplicarEsquema(id) {
  const e = ESQUEMAS.find((x) => x.id === id);
  if (!e) return;
  cfg.esquema = id;
  cfg.autofogo = e.autofogoPadrao;
  cfg.assist = e.assistPadrao;
  salvar();
}
