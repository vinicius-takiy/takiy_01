# Terrário

Um jogo de criador. O mundo começa vazio: você pinta o terreno, solta seres em
cima e o resto acontece sozinho. Ninguém dá ordem a ninguém.

**Jogar:** `https://vinicius-takiy.github.io/takiy_01/terrario/`
(ou `npm run servir` e abrir `http://IP-DO-PC:8081` no celular)

## O que emerge

Nenhum agente sabe o que é civilização. Cada um resolve a próxima necessidade
com o que tem por perto — e o que está por perto é o que você pôs lá.

| Você faz | O que acontece |
|---|---|
| Solta humanos num lugar qualquer | Forrageiam; se forem três ou mais perto uns dos outros, fundam uma tribo |
| Pinta terra fértil embaixo deles | Alguém para de forragear e começa a arar. Nasce a lavoura, e a tribo cresce |
| Solta rebanho dentro do território | A tribo cerca um pasto e domestica os bichos; a comida deixa de depender de caçada |
| Pinta montanha ou rocha por perto | Com cinco pessoas, abrem uma mina. Minério vira cobre, bronze, ferro |
| Solta humanos longe uns dos outros | Nascem tribos separadas, cada uma explorando sua região |
| Deixa duas tribos crescerem até se encostarem | Se as duas estão comendo bem, fazem aliança e passam a dividir excedente. Se qualquer uma passa fome, é guerra |
| Solta feras onde não há presa | Elas caçam o rebanho; sem rebanho, atacam gente |
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

A **crônica**, no canto direito, é onde tudo isso vira história. Ela não é
enfeite: você não vê um humano decidir plantar, você lê "Ocre começa a plantar".

## Controles

- **Um dedo** pinta, quando há pincel escolhido na paleta; arrasta o mapa quando
  não há. Tocar o mesmo pincel de novo o desliga.
- **Dois dedos** giram, inclinam e aproximam.
- **Tocar sem pincel** abre o inspetor: quem é a tribo dali, o que ela tem no
  celeiro, com quem está em guerra.
- **Relógio** no canto: pausa, 1×, 4×, 16×. Um ano de mundo são quatro segundos
  em 1×.

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
npm run test:tela  # 17 verificações num Chromium do tamanho de um celular
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

- **Mundos variam muito.** Em cinco sementes de teste, três viram civilizações
  grandes e duas patinam. Num sandbox isso é resultado, não defeito — mas
  significa que às vezes vale apertar "Novo mundo".
- A ilha é fixa em 80×80 tiles, com teto de 500 pessoas e 200 animais.
- Não há salvamento: fechar a aba encerra o mundo.
- Tribos não migram. Elas se dividem e a filha se afasta, mas ninguém abandona
  uma região esgotada para recomeçar longe.
- Não há madeira, barco nem pesca, e a ilha é uma só: o mar é cenário, não
  caminho.
- De perto se vê quem é quem e para onde vai, mas não há animação de interação
  — ninguém abraça, luta corpo a corpo ou entrega comida na mão do outro.
- Os números de quadros medidos no teste vêm de renderização por software; não
  servem para estimar desempenho no aparelho.
