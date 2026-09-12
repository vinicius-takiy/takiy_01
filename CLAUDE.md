# takiy_01

Protótipos de jogo para celular. Quatro jogos rodam no navegador; existe também o
scaffold vazio de um projeto Unity, mantido como referência histórica.

O objetivo declarado do repositório não é publicar um jogo: é **explorar até onde
dá para construir software com IA**. Isso define as escolhas técnicas abaixo, e
elas valem mais do que a conveniência de qualquer mudança isolada.

## Regras do repositório

1. **Web, não Unity.** Unity foi avaliado e descartado: o trabalho de verdade lá
   acontece no Editor (cenas, prefabs, materiais, luz), que é justamente o que
   uma IA não consegue fazer nem verificar. Na web, o jogo inteiro é texto — dá
   para escrever, rodar, tirar print e corrigir sem depender de um humano no
   meio do laço. As pastas `Assets/` e `docs/` são resquício da avaliação
   anterior; não invista nelas sem o usuário pedir.
2. **Sem build.** Nada de bundler, transpiler ou passo de compilação para rodar
   um jogo. Módulos ES nativos, dependências vendorizadas em `vendor/` e import
   map. O critério: abrir o `index.html` tem que funcionar, e publicar tem que
   ser copiar a pasta.
3. **Sem download em tempo de execução.** Sem CDN, sem arquivo de áudio, sem
   modelo 3D, sem fonte externa. Geometria é gerada por código, som é sintetizado
   no WebAudio, ícone é desenhado em canvas. O jogo tem que abrir offline.
4. **iPhone é o alvo.** Paisagem travada por CSS, `touch-action: none`,
   `env(safe-area-inset-*)`, áudio só depois de um toque, e nada de
   `navigator.vibrate` (o Safari não tem). PWA instalável pela Tela de Início.
5. **Português no código.** Nomes, comentários e textos de tela em português,
   como no resto do repositório.
6. **Comentário explica escolha, não sintaxe.** Só comente o que o código não
   diz: por que este número, que armadilha isto evita.

## Verificar antes de entregar

Cada jogo com testes tem os seus. Rode-os depois de qualquer mudança:

```bash
cd frontline && npm test   # 21 verificações de tela
cd terrario  && npm test   # tela + 300 anos de mundo em 5 sementes
```

No `terrario/`, o teste que manda é o `test:mundo`: ele roda a simulação **sem
tela** e afirma que o mundo resultante se sustenta. Mexeu em regra de agente, de
tribo ou de terreno, rode-o — quase todo defeito desse jogo é invisível olhando
a tela por um minuto. E mantenha a simulação livre de `three` e de
`Math.random`: sem determinismo pela semente, o teste mede ruído.

Se mexer no visual, rode `npm run test:fotos` e **olhe as telas** — o teste passa
com o jogo feio, e já pegou um fuzil ocupando um terço da tela que nenhuma
asserção detectaria.

O headless usa SwiftShader (renderização por software): o número de quadros ali
é piso de sanidade, nunca uma medida de iPhone. Não ajuste desempenho com base
nele.

## Os jogos

| Pasta | O que é | Tem teste? |
|---|---|---|
| `terrario/` | Terrário — simulador de mundo com tribos, agricultura, pecuária, mineração, guerra e aliança | sim, dois |
| `frontline/` | Linha de Frente — FPS de trincheira em three.js, e laboratório de esquemas de controle no toque | sim |
| `web-prototype/` | Sniper 300m — três contratos, balística com queda e vento | não |
| `castle-defense/` | Muralha dos Rabiscos — defesa de muralha 2D em estilo caderno | não |

`frontline/` está na fatia 1: o que se está medindo é **se dá para jogar FPS no
toque**, não se o jogo é bom. Antes de adicionar conteúdo (mais setores, mais
armas, progressão), confirme com o usuário — a resposta ao experimento de
controle pode mudar o formato do jogo inteiro.

## Publicação

GitHub Pages, pelo workflow `.github/workflows/pages.yml`. O Pages precisa ser
ligado uma vez à mão em Settings → Pages; o token do Actions não consegue.
Enquanto estiver desligado, o workflow avisa e termina em verde sem publicar.
