# Linha de Frente

FPS de trincheira em three.js que roda no Safari do iPhone. Um setor, oito
soldados, um bunker no fim.

**Isto é a fatia 1, e ela não está tentando ser um jogo.** É um laboratório de
controle: a pergunta em teste é se dá para jogar um FPS com movimentação livre no
toque, e qual esquema de controle sobrevive ao polegar. O combate existe só para
dar o que medir.

## Jogar

- **No PC:** abra `index.html`. WASD move, clique na tela para prender o mouse,
  botão esquerdo atira, direito mira, `R` recarrega, `Ctrl` agacha.
- **No iPhone, na mesma rede:** `npm run servir` e abra `http://IP-DO-PC:8080`
  no Safari. Depois **Compartilhar → Adicionar à Tela de Início** para tirar a
  barra do navegador e travar em paisagem.
- **Publicado:** `https://vinicius-takiy.github.io/takiy_01/frontline/`

## Os três esquemas em teste

Trocáveis a qualquer momento pela engrenagem, inclusive no meio da partida.

| Esquema | Como move | Como mira | Para que serve o teste |
|---|---|---|---|
| **Duplo analógico** | Analógico virtual à esquerda | Arrasto na metade direita | A linha de base. É o que todo FPS de celular faz, e é o que costuma frustrar. |
| **Assistido** | Igual | Igual, mas a mira cola no alvo e o tiro sai sozinho | Mede quanto de assistência é preciso para o toque virar jogável. |
| **Sobre trilhos** | Toca no próximo ponto de cobertura e o personagem anda sozinho | Tela inteira | A hipótese de que o formato certo para o toque não é mundo livre. |

Além disso: sensibilidade, quatro níveis de assistência de mira, auto-fogo,
inverter o eixo vertical e layout canhoto. Tudo salvo no aparelho.

**O que olhar ao jogar:** a tela de fim mostra tempo, abatidos, precisão e dano
recebido junto do esquema usado. Jogue o mesmo setor com os três e compare —
principalmente a precisão.

## Como está feito

Nenhum build, nenhum `node_modules` para rodar o jogo. Módulos ES nativos, com o
three.js vendorizado em `vendor/` e resolvido por *import map*. O service worker
guarda tudo, então depois da primeira visita abre offline.

| Arquivo | O que faz |
|---|---|
| `src/main.js` | Laço do jogo, condições de vitória e derrota, orçamento de exposição dos inimigos |
| `src/settings.js` | Os três esquemas e os níveis de assistência. É o coração do experimento |
| `src/input.js` | Analógico virtual, arrasto de mira, botões, teclado e mouse |
| `src/player.js` | Movimento, câmera, vida com regeneração |
| `src/weapon.js` | Garand, recuo, dispersão, **magnetismo de bala e cola de mira** |
| `src/enemy.js` | Soldado de cobertura: agacha, espia, atira, tomba |
| `src/level.js` | O setor inteiro gerado por código — nenhum modelo, nenhuma textura |
| `src/collision.js` | AABBs e raios analíticos. Nada de `Raycaster` no caminho quente |
| `src/fx.js` | Traçantes, poeira e clarão, em pools de tamanho fixo |
| `src/hud.js` | HUD e telas em DOM |
| `src/audio.js` | Tiros sintetizados no WebAudio; nenhum arquivo de som |

Tudo somado dá ~700 KB, e 687 KB disso é o three.js.

## Teste automático

```bash
npm install          # só o Playwright, só para o teste
npm test             # 21 verificações num Chromium do tamanho de um iPhone deitado
npm run test:fotos   # o mesmo, salvando telas em fotos/
```

O teste joga sozinho: anda, troca de esquema no meio da partida, segura o
gatilho, e afirma coisas que importam — que a assistência de mira de fato acerta,
que dá para abater alguém, que trocar de esquema não quebra nada, e que a partida
não acaba em segundos. Serve para mexer no jogo sem precisar de um celular na mão
a cada mudança.

Duas ressalvas honestas: o headless usa SwiftShader (renderização por software),
então o número de quadros ali é um piso de sanidade, **não** uma medida de
iPhone; e as verificações de combate dependem de tiros roteirizados, então medem
que o sistema funciona, não que ele é divertido.

## Limites conhecidos

- Terreno plano de propósito: sem gravidade, sem rampas, sem pulo.
- Os inimigos não andam. Ocupam postos fixos e alternam entre agachar e espiar.
- No máximo dois soldados expostos ao mesmo tempo
  (`EXPOSTOS_AO_MESMO_TEMPO` em `src/enemy.js`). Com os oito atirando juntos o
  combate fica ilegível e o teste de controle vira teste de sorte.
- Sem vibração: o Safari do iPhone não expõe `navigator.vibrate`. O retorno de
  acerto é só visual e sonoro.
- Um setor só. Sem progressão, sem menu de dificuldade, sem outras armas.
