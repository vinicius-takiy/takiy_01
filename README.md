# takiy_01 — protótipos de jogo para celular

Quatro jogos jogáveis no navegador, mais o scaffold de um projeto Unity.

| Pasta | O que é |
|---|---|
| [`terrario/`](terrario/) | **Terrário** — simulador de mundo: pinte terreno, solte seres e veja civilizações surgirem sozinhas |
| [`frontline/`](frontline/) | **Linha de Frente** — FPS de trincheira em three.js e laboratório de esquemas de controle no toque, com teste automático |
| [`castle-defense/`](castle-defense/) | **Muralha dos Rabiscos** — defesa de muralha 2D em estilo caderno, com progresso salvo e PWA instalável |
| [`web-prototype/`](web-prototype/) | **Sniper 300m** — três contratos numa cidade, balística com queda e vento, controles de uma mão |
| [`Assets/Scripts/`](Assets/Scripts/) + [`docs/`](docs/) | Scaffold de um simulador de sniper em Unity, com passo a passo para iniciantes |
| `index.html` | Página inicial que lista os jogos |

## Jogar

Depois de ligar o GitHub Pages (veja abaixo):
`https://vinicius-takiy.github.io/takiy_01/`

## Ligar o GitHub Pages

Precisa ser feito **uma vez**, por alguém com acesso de admin ao repositório. Nem o
conector do GitHub nem o token do GitHub Actions têm permissão para criar o site: a
API responde `Resource not accessible by integration`.

Em **Settings → Pages**, escolha uma das duas fontes:

1. **Deploy from a branch** — Branch `claude/sniper-game-mobile-simulator-dw4abz`,
   pasta `/ (root)`. Serve o repositório como está, sem Actions. Mais simples.
2. **GitHub Actions** — usa `.github/workflows/pages.yml`, que copia apenas
   `index.html`, `castle-defense/`, `web-prototype/`, `frontline/` e `terrario/` para o site.

Enquanto o Pages estiver desligado, o workflow termina em verde com um aviso e não
publica nada.

## Documentação

- [`terrario/README.md`](terrario/README.md) — o que emerge de cada combinação, controles, limites conhecidos
- [`frontline/README.md`](frontline/README.md) — os três esquemas de controle, como rodar o teste, limites conhecidos
- [`castle-defense/README.md`](castle-defense/README.md) — loop do jogo, como o progresso é salvo, PWA
- [`web-prototype/README.md`](web-prototype/README.md) — sistemas do sniper e limites do Safari mobile
- [`docs/`](docs/) — sete guias do projeto Unity, do setup ao build Android e iOS
