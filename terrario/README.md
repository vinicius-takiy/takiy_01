# Terrário

Um jogo de criador. **O mundo nasce pelado** — terra nua, areia e pedra, e mais
nada. Mato, terra fértil, minério e bicho são todos coisa sua. Você atribui, e o
resto acontece sozinho: ninguém dá ordem a ninguém.

Quem preferir começar de um mundo já formado tem o botão **Ilha pronta**, que
gera biomas como antes.

**Jogar:** `https://vinicius-takiy.github.io/takiy_01/terrario/`
(ou `npm run servir` e abrir `http://IP-DO-PC:8081` no celular)

## O que emerge

Nenhum agente sabe o que é civilização. Cada um resolve a próxima necessidade
com o que tem por perto — e o que está por perto é o que você pôs lá.

| Você faz | O que acontece |
|---|---|
| Pinta pedra ou montanha | O veio de minério vem junto. Num mundo pelado não existe minério que você não tenha posto |
| Solta humanos num lugar qualquer | Forrageiam; se forem três ou mais perto uns dos outros, fundam uma tribo |
| Pinta terra fértil embaixo deles | Alguém para de forragear e começa a arar. Nasce a lavoura, e a tribo cresce |
| Solta rebanho dentro do território | A tribo domestica os bichos e, quando já estiver abrigada e com lenha sobrando, ergue um curral cercado. A comida deixa de depender de caçada |
| Pinta montanha ou rocha por perto | Com cinco pessoas, abrem uma mina. Minério vira cobre, bronze, ferro |
| Solta humanos longe uns dos outros | Nascem tribos separadas, cada uma explorando sua região |
| Deixa duas tribos crescerem até se encostarem | Se as duas estão comendo bem, fazem aliança e passam a dividir excedente. Se qualquer uma passa fome, é guerra |
| Solta feras onde não há presa | Elas caçam o rebanho; sem rebanho, atacam gente. Onde há curral, aparece guarda para enfrentá-las na cerca |
| Pinta floresta | Vira madeira em pé. Sem ela a tribo não levanta abrigo, e sem abrigo ela para de crescer |
| Não faz nada | A terra lavrada se esgota, precisa de umas quatro décadas de pousio, e a tribo tem que procurar terra nova — que costuma ser a do vizinho |

Tribo grande demais se divide sozinha, e é daí que vem a maioria das guerras:
a tribo filha nasce colada na mãe.

## Gente com vocação

Cada pessoa nasce com um dom, e é ele que faz duas tribos com a mesma terra
evoluírem diferente. Um bando cheio de caçador esgota o rebanho da região; um
cheio de lavrador atravessa a seca com o celeiro cheio.

| Dom | O que muda | Como aparece na tela |
|---|---|---|
| **Lavrador** | Ara e colhe muito melhor; abre roça com mais frequência | Carrega enxada |
| **Caçador** | Acerta mais a caça, forrageia melhor, briga melhor. Vai atrás de bicho antes de catar mato | Carrega lança |
| **Construtor** | Levanta oca e cerca pasto muito mais rápido | Carrega fardo nas costas |
| **Minerador** | Rende o dobro na mina | Carrega picareta |
| **Líder** | Não faz nada melhor com as mãos. Muda a tribo: técnica 22% mais barata, aliança bem mais provável, guerra menos, e a tribo demora mais para rachar | Usa adorno de cabeça |
| **Guarda** | Quase o dobro em combate, e é o único que enfrenta a fera na cerca. Planta e colhe mal | Lança e escudo na cor da tribo |

O guarda é o único dom que **não** sai do balde do jogador: soltar um guarda num
bando de cinco é pôr uma boca a mais sem nada para vigiar. Ele nasce quando a
tribo já tem cerca para rondar ou fronteira em guerra — 10% da gente, 16% se as
duas coisas ao mesmo tempo, e praticamente nenhum numa tribo em paz e sem gado.

Quem nasce puxa a vocação de um dos pais em cerca de um terço das vezes; no
resto, a tribo preenche a lacuna que tem. Herdar sempre engessaria a tribo numa
vocação só; sortear sempre apagaria a identidade que se vê formando.

## Acompanhar uma tribo de perto

A fita de tribos, abaixo do painel de estado, lista quem existe com a cor, o
nome e a população — e fica com a borda vermelha quando a tribo está em guerra.
Tocar numa delas leva a câmera até lá e a mantém acompanhando enquanto a aldeia
anda; o painel da esquerda passa a se atualizar sozinho, mostrando a composição
de vocações, o celeiro, as roças, o gado e com quem ela briga. Tocar de novo
solta. Arrastar o mapa também solta.

Aproximando bastante dá para ver as pessoas indo e voltando, cada uma com a
ferramenta do seu dom, balançando enquanto trabalham.

## Tudo tem forma

Nada é cápsula nem esfera. Cada coisa do mundo é um boneco de bloco montado em
`src/figuras.js`:

- **Gente** com pernas, tronco, braços e cabeça, mais o traço da vocação:
  chapéu de palha e enxada, capuz e lança com aljava, fardo nas costas e
  marreta, capacete com lanterna e picareta, cocar de penas e cajado.
- **Rebanho** de quatro patas, corpo comprido, focinho e rabo; **fera** mais
  baixa e esticada, com orelhas em ponta e cauda erguida.
- **Natureza** que aparece conforme você pinta: árvore com tronco e três
  andares de copa, moita no campo, lajedo na pedra — e feixe de trigo que só
  brota na roça quando ela amadurece, então dá para ver a colheita chegando.
- **Oca** com porta e telhado de seis águas, e um mastro na cor da tribo.

Cada figura vira duas malhas instanciadas: uma tingida pela cor da tribo (a
roupa) e outra com cor de verdade (pele, madeira, folha, metal). Com uma malha
só, a pele saía pintada da cor da tribo — foi assim que isto começou.

## Madeira, abrigo e filho

A corrente que segura a população é esta, e ela é toda de recurso natural:

**mata em pé → lenha → abrigo → filho.**

Ninguém nasce só porque há comida. A tribo precisa de vaga em casa, e casa custa
madeira, que sai de derrubar árvore. Um bando de até seis pessoas dorme ao
relento; daí em diante a cobrança de teto entra aos poucos, chegando a uma vaga
por pessoa lá pelos vinte.

E oca de pé cobra conserto: cerca de um terço de lenha por ano, cada. É esse
detalhe que fecha o ciclo — **uma tribo que derrubou toda a mata começa a perder
telhado**, porque a floresta só rebrota onde ainda sobrou floresta vizinha para
semear. Derrubar sem esperar nascer tem preço, e ele chega décadas depois.

Antes disso, 80% das mortes eram fome, com idade média de trinta anos. Com a
trava de abrigo, a maioria passou a morrer de velhice, perto dos setenta.

A **crônica**, no canto direito, é onde tudo isso vira história. Ela não é
enfeite: você não vê um humano decidir plantar, você lê "Ocre começa a plantar".

## Curral e guarda

Pasto não é mais um tile pintado: é uma **volta de cerca** com mourões desenhados
na borda, e o gado da tribo anda dentro dela. Isso muda três coisas de uma vez.

- **O curral tem capacidade.** Cerca de 0,85 cabeça por tile de área. Cheio, o
  rebanho para de crescer — a cerca é o teto, não um número escondido.
- **Ampliar custa lenha**, a mesma que levanta oca. Cerca e telhado disputam a
  mesma mata, e é essa disputa que decide se a aldeia vira criadora de gado ou
  cresce em gente. Por isso a tribo só ergue e só amplia o curral estando
  coberta e com sobra: cercar antes de se abrigar já matou um mundo inteiro no
  teste (semente 1234, extinta no ano 25 com a cerca de pé e nenhuma oca).
- **Gado junto e parado é alvo fácil** — e é aí que entra o guarda. Ele larga a
  roça, toma posto num mourão (a turma se divide pela volta, não se amontoa num
  canto) e sai ao encontro da fera que chega a cinco tiles da cerca. Ganha na
  maioria das vezes; quando perde, ou morre ou a fera foge para longe.

Guarda também pesa contra vizinho: entra na força da tribo quase como uma pessoa
a mais, e briga 90% melhor. É o que o inspetor mostra em **gua**, e o que faz
uma tribo que não conseguiu aliança ainda assim segurar a fronteira.

## Controles

- **Um dedo** pinta, quando há pincel escolhido na paleta; arrasta o mapa quando
  não há. Tocar o mesmo pincel de novo o desliga.
- **Dois dedos** giram, inclinam e aproximam.
- **Tocar sem pincel** abre o inspetor: quem é a tribo dali, o que ela tem no
  celeiro, com quem está em guerra.
- **Relógio** no canto: pausa, 1×, 4×, 16×. Um ano de mundo são quatro segundos
  em 1×.

### A tela é o jogo

Num telefone deitado, crônica, paleta e barra de estado juntas comiam metade do
mundo. Todo painel grande agora encolhe com o mesmo botão e o mesmo gesto: um
**—** que fecha, um **+** que devolve. Vale para a barra de estado (fica só o
ano), para a crônica (fica só o título) e para a paleta (somem os pincéis e fica
a ferramenta ativa, para você saber o que está pintando). O inspetor tem **×**.

E o botão de cantos, à esquerda do relógio, é o **modo limpo**: some com todos
os painéis de uma vez e deixa o mundo inteiro na tela. Fica só o relógio, que é
o único controle que se usa quando a intenção é olhar. Tocar de novo devolve
tudo como estava — inclusive a velocidade, que ele não encosta.

## Bicho com pata

Rebanho e fera são montados em duas figuras, corpo e pata, e cada uma das quatro
patas gira no próprio quadril, em **trote diagonal** — dianteira esquerda junto
com traseira direita. Uma malha só por bicho não tem como mover parte de si, e o
rebanho inteiro deslizava pelo chão de perna dura. De longe não se via; de perto,
que é exatamente para o que a câmera de perto existe, era a primeira coisa.

Dá para ler o que o bicho está fazendo sem clicar em nada:

| O que se vê | O que é |
|---|---|
| Focinho no chão, quase parado | Pastando |
| Trote com o corpo no prumo | Indo a algum lugar — atrás de capim, ou de volta ao curral |
| Galope, corpo subindo e encolhendo na passada | Fera em cima da presa |
| Passo curto e cabeça erguida | Fera rondando |

E os dois passaram a olhar para onde andam. Estavam montados olhando para +X
enquanto o giro é calculado para +Z, então o rebanho inteiro andava de lado,
feito caranguejo — noventa graus de erro que ninguém vê num bloco branco a
quarenta tiles de distância e que salta aos olhos assim que a câmera desce.

## Como está feito

Sem build, sem `node_modules` para jogar, sem download em tempo de execução:
módulos ES nativos, three.js vendorizado em `vendor/`, terreno gerado por ruído
de valor escrito à mão, ícone desenhado em canvas. O service worker guarda tudo,
então depois da primeira visita abre offline.

| Arquivo | O que faz |
|---|---|
| `src/mundo.js` | A grade em arrays tipados: terreno, relevo, forragem, vigor do solo, minério, dono |
| `src/agentes.js` | Humano, rebanho e fera. A ordem das decisões do humano **é** o jogo |
| `src/tribos.js` | Território, cisão, diplomacia, comércio e a tabela de vocações |
| `src/sim.js` | O relógio: tica agentes, forma tribos, resolve fronteiras, escreve a crônica |
| `src/figuras.js` | Biblioteca de bonecos de bloco: gente, bicho, mato, oca |
| `src/render.js` | Malhas instanciadas — a grade inteira é um objeto só |
| `src/camera.js` | Câmera orbital e a regra de um dedo/dois dedos |
| `src/ui.js` | Paleta, painel, crônica e inspetor |

A simulação não importa three.js. É de propósito: ela roda inteira sem tela, e é
isso que permite o teste abaixo.

## Testes

```bash
npm install        # só o Playwright, só para o teste de tela
npm test           # os dois
npm run test:mundo # 300 anos × 5 sementes, sem tela, em segundos
npm run test:tela  # 26 verificações em paisagem e retrato no tamanho de um celular
npm run test:fotos # o mesmo, salvando telas em fotos/
```

`test:mundo` é o teste que importa neste jogo. Regra ingênua de emergência dá em
extinção em trinta segundos ou em tédio estável, e as duas coisas passam
despercebidas olhando bonito na tela. Ele afirma treze coisas sobre o mundo
resultante e já pegou, entre outros:

- extinção da humanidade em treze anos;
- simulação não determinística (mesma semente dando 16 e 400 anos), por
  `Math.random` solto nos construtores dos agentes;
- mundo gerado sem um único tile de terra fértil, porque a umidade era amostrada
  fora do domínio do ruído;
- impasse na pecuária: precisava de cabeças para cercar pasto e de pasto para
  domesticar cabeças;
- armadilha da subsistência: ninguém arava com o celeiro baixo, e o celeiro
  nunca subia sem alguém arar;
- a fera mais lenta que a presa e que o humano, morrendo de fome perseguindo o
  almoço a pé;
- colapso predador-presa de manual: feras dobrando a cada dois abates, limpando
  o mundo em dezenove anos e morrendo junto.

## Limites conhecidos

- **Mundos variam muito.** Nas cinco sementes de teste todas atravessam os
  trezentos anos, mas terminam entre 56 e 739 pessoas, e uma delas faz um ciclo
  malthusiano completo: sobe a 862 e desaba para 280. Num sandbox isso é
  resultado, não defeito.
- A ilha é fixa em 80×80 tiles. O teto de 900 pessoas é de segurança, não regra
  de jogo: quando a ecologia encosta nele, é sinal de que falta freio no mundo,
  e o teste cobra isso.
- Não há salvamento: fechar a aba encerra o mundo.
- Tribos não migram. Elas se dividem e a filha se afasta, mas ninguém abandona
  uma região esgotada para recomeçar longe.
- Há madeira, mas não há barco nem pesca, e a ilha é uma só: o mar é cenário,
  não caminho.
- De perto se vê quem é quem e para onde vai, mas as figuras são rígidas: elas
  giram e balançam ao trabalhar, e não movem pernas nem braços. Também não há
  animação de interação — ninguém luta corpo a corpo nem entrega comida na mão
  do outro.
- Os números de quadros medidos no teste vêm de renderização por software; não
  servem para estimar desempenho no aparelho.
