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
| **Pastor** | Vai buscar bicho solto e traz tocando; tira quase o dobro do rebanho. Caça e minera mal | Cajado de gancho e bornal |
| **Pescador** | Duas vezes melhor na margem, e vai ao rio antes de olhar a roça. Ara e minera mal | Chapéu de palha largo, vara e cesto |

Guarda, pastor e pescador **não** saem do balde do jogador: o pastor só existe
onde há cerca (13% da gente), o pescador só onde o território encosta em água
(14%), e o guarda, onde há cerca para rondar ou fronteira em
guerra — 10% da gente, 16% com as duas coisas. Soltar um guarda num bando de
cinco é pôr uma boca a mais sem nada para vigiar.

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

## Água viva

A água era um lugar por onde não se anda. Pior: **era um buraco**. O leito caía
para o fundo do mar independentemente do relevo, então um lago pintado no alto
de um planalto virava um poço quadrado de parede azul meio metro abaixo da
margem — e o mar aberto deixava um barranco de praia à vista em toda a volta da
ilha.

Duas correções e uma malha nova. O leito passou a acompanhar o relevo (uma
depressão rasa, não um poço), e cada tile de água ganhou uma **lâmina
translúcida** desenhada à parte, na altura da terra em volta. À parte porque o
chão é uma malha instanciada só, com material opaco: não dá para deixar alguns
tiles transparentes ali. O mar aberto subiu para a mesma conta, e a linha da
praia virou uma só.

Com a água parecendo água, deu para pôr vida dentro dela:

| Bicho | O que faz |
|---|---|
| **Peixe** | Anda em cardume, come plâncton, e só desova com dois vizinhos por perto — mesma regra da manada em terra |
| **Jacaré** | Predador de água. Vive de peixe e pega o que cair lá dentro. Metabolismo de oito anos sem comer, porque o cardume anda junto e deixa quase todo o mar vazio |

E deu para pescar. A margem com peixe é comida que não custa roça nem rebanho —
é o que faz valer a pena instalar uma tribo na costa em vez de só ter praia no
mapa. Quem procura é o **pescador**, e ele procura no raio de exploração, não no
de busca: a aldeia fica no meio do território e a margem, na borda. Medindo a
onze tiles de quem decide, ninguém enxergava o rio de casa e cem anos de tribo
costeira davam **zero** peixe pescado.

O cardume tem capacidade por área — 0,10 peixe por tile de água. Não é teto de
segurança como o de humano: é a densidade que a água sustenta, e ela acompanha o
mapa que você pintou. Um mar grande dá cardume grande; um açude dá cinco peixes.
A 0,30 o cardume batia no limite em vinte anos e ficava lá, com a mesma cara de
"encostou no teto do código" que a população humana já teve.

**Bicho de terra que cai na água** tem pouco tempo: ou acha a margem, ou se
afoga, ou o jacaré chega antes. Ele não entra por vontade — entra em pânico,
fugindo de caçador ou de fera, e é só nesse estado que a água deixa de ser
parede para ele. É raro de propósito: em quatrocentos anos de teste, um bicho
afogado. Precisa de água do lado da caçada.

## A ordem do assentamento

Não é uma lista de tarefas escrita em lugar nenhum: é a ordem em que as opções
ficam mais baratas que as outras. Mas ela tem uma forma, e é esta:

**lavoura → casa → clareira → cerca e mina.**

1. **Lavoura primeiro.** É a única saída da subsistência. Quem passa o dia
   catando raiz não corta lenha, e sem lenha não há casa.
2. **Casa em seguida**, antes de encher o celeiro — é o abrigo que trava o
   crescimento, não a comida. Mas nunca antes de comer: com menos de 2,4 de
   celeiro por cabeça, a lenha espera.
3. **Clareira.** Com duas ocas de pé, a lenha passa a sair de perto de casa em
   vez de onde estiver mais à mão. A floresta recua num anel em volta da aldeia
   — e clareira é campo de visão: o guarda vê a fera chegando em vez de ela sair
   de trás de uma árvore colada na cerca.
4. **Cerca e mina por último**, as duas depois do telhado. A cerca sai da mesma
   lenha da oca.

Duas coisas que a tribo aprendeu a não fazer, e as duas custaram um mundo no
teste:

- **Cercar antes de se abrigar** (semente 1234, extinta no ano 25 com a cerca de
  pé e nenhuma oca).
- **Ir toda para a guerra.** Guerra na fronteira interrompe o trabalho, mas só
  do guarda e de um em cada três dos outros — e de ninguém com fome. Com a tribo
  inteira em armas ninguém colhe: o celeiro de cento e cinquenta virava catorze
  em dez anos e a semente 7 se extinguia no ano 192 **sem perder uma batalha**.
  Pelo mesmo motivo, falta de teto não põe a aldeia inteira para construir ao
  mesmo tempo: trinta e três das cinquenta e uma pessoas de uma vez, e nenhuma
  na roça.

## Bicho não entra em curral sozinho

Antes bastava um bicho selvagem passar por território com pasto e ele virava
criação. Rebanho entrando por conta própria no curral e se cadastrando como
gado — que é exatamente o que nenhum animal faz.

Agora alguém tem que **ir buscar**. Um adulto (o pastor, quase o dobro das
vezes) escolhe um bicho solto perto da cerca, vai até ele e tenta laçar — nem
toda tentativa pega, e o que escapa dispara para longe. Pegou, o bicho passa a
seguir quem o conduz, um pouco mais rápido que a pessoa para não ficar para
trás, e só vira criação quando os dois chegam **dentro** da cerca. Quem larga
tudo para comer larga o bicho também.

Isso ficou junto das obras opcionais e com dado, não na frente da roça. Na
frente, virou vício: dezessete das vinte e quatro pessoas passavam o dia atrás
de boi, as roças caíam de vinte e três para zero e a tribo morria de velha com o
celeiro cheio.

## Bicho sozinho não se multiplica

A reprodução só olhava a barriga. Três animais largados em três cantos do mapa
viravam trinta em uma década, cada um multiplicando sozinho. Agora precisa de
**manada**: dois vizinhos num raio de cinco tiles. É o que faz o rebanho crescer
onde está junto — dentro do curral, por exemplo — e minguar onde ficou espalhado.

E bicho selvagem passou a **andar junto do bando**: ao escolher para onde ir, ele
puxa para o meio dos vizinhos em vez de sortear no vazio. Sem isso o punhado que
você solta se dispersa em uma década e, como manada é o que se reproduz, o
rebanho sumia do mundo sem ninguém caçar.

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
  não há. Tocar o mesmo pincel de novo o desliga. O arraste estava girado
  noventa graus — o dedo na horizontal subia e descia o mapa, porque a conta
  usava o azimute cru em vez da base da câmera. Agora o mundo anda para onde o
  dedo vai.
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

## Clima, semente e fogo

O mapa deixou de ser um desenho parado. Por baixo dele agora corre um campo de
**umidade**, e é ele que manda em quase tudo.

A umidade de base de um tile é a soma de três coisas: o clima do lugar (o mesmo
ruído que desenhou os biomas na geração), a água por perto (uma varredura em
largura a partir de todo tile de água) e o desconto do alto — montanha é seca
mesmo com água ao pé, porque o que escorre não fica. Por cima disso corre um
ciclo lento de décadas secas e décadas chuvosas, e passam **nuvens**, que entram
por uma borda e atravessam o mapa molhando o que encontram. Você também tem um
pincel de **chuva**, mais forte e mais curto que a chuva do mundo.

### Semente, não floresta pronta

O pincel de floresta virou pincel de **semente**. O broto cresce na razão do que
bebe: em terra molhada vira mata em uns oito anos, em terra seca definha e morre.
Plantar num descampado árido não dá nada — que é o ponto.

### O verde anda sozinho

| O que acontece | Quando |
|---|---|
| Terra nua vira campo | Umidade acima de 0,42, verde encostado, e é muito mais rápido onde há esterco |
| Campo vira terra nua | Umidade abaixo de 0,22 |
| Campo vira terra fértil | Muito molhado **e** muito adubado — é o rebanho melhorando a terra em vez de só comê-la |
| Mata semeia o vizinho | Umidade acima de 0,55, devagar: uma frente que avança em décadas |
| Campo molhado brota sozinho | Raro, e tanto mais provável quanto menos mata resta no mundo |

Esse último é rede de segurança, não semeadura. Sem ele a semente 5 terminava
trezentos anos com quatrocentas pessoas vivas e **zero** tiles de mata, sem volta
possível — a rebrota exige mata vizinha, e não havia mais nenhuma. A 0,0045 por
ano, porém, ele plantava nove brotos por ano no mapa inteiro, cobria a ilha,
dobrava a população e apagava o fogo do jogo. Ficou em 0,0006, subindo conforme
a mata some.

**Esterco e cinza** são a mesma variável. Rebanho parado aduba o chão; bicho que
morre aduba onde caiu; incêndio deixa cinza. É o que puxa o verde para onde a
vida esteve.

### Raio e incêndio

Cai um raio a cada poucos anos, em qualquer lugar. Se acertar coisa que queime e
estiver seco, pega. O fogo anda de tile em tile na razão do quanto o vizinho está
seco — mata molhada quase não pega, mata de estiagem pega rápido — e **só a chuva
apaga**. O que sobra é terra nua com cinza.

Quem estiver dentro do fogo morre ou foge em pânico; oca dentro do fogo desaba; e
o raio mata o que acertar. É a primeira coisa neste jogo que destrói o que a
tribo construiu sem ser outra tribo.

## Três herbívoros

Um bicho grande só não sustenta cadeia nenhuma: come muito, cria devagar e, quando
a fera o encontra, some. Foi por isso que "o predador não se extingue" era falha
fixa do relatório em quase toda semente.

| Bicho | Come | Cria | Vive | Domesticável |
|---|---|---|---|---|
| **Gado** | muito | devagar | ~15 anos | sim — é o do curral |
| **Capivara** | pouco | rápido | ~9 anos | não, e não sai da margem |
| **Lebre** | quase nada | muito rápido | ~5 anos | não |

Os miúdos são o colchão: comem pouco, criam rápido e morrem cedo, que é o que
mantém o predador vivo entre uma boiada e outra. Cada espécie tem teto próprio —
com um número compartilhado, o gado (que a tribo protege dentro da cerca) enchia
sozinho os lugares e as outras duas se extinguiam nas cinco sementes.

## Dá para ver o que está acontecendo

A queixa era essa, e era justa: tudo balançava igual. Uma senoide só, o mesmo
gingado para arar, minerar, brigar e pescar — de perto, o jogo virava um mundo
de gente tremendo.

Agora cada tarefa tem **gesto próprio**, e golpe é serrote, não senoide: o braço
sobe devagar e desce de uma vez. É o que separa machadada de enxadada.

| O que se vê | Quem é |
|---|---|
| Curvado sobre o canteiro, indo e voltando devagar | Arando ou colhendo |
| Golpe seco e largo, tronco acompanhando | Lenhando |
| Quase parado na margem, com um tranco de vez em quando | Pescando |
| Parado no mourão, olhando | Guarda de plantão |
| Investida: lançado para a frente, um tranco por vez | Brigando ou enfrentando fera |
| Correndo inclinado, passada curta e rápida | Fugindo de uma fera |

**A árvore cai.** Derrubar a última árvore de um lugar era um tile mudando de
cor; agora a árvore tomba de verdade — acelera como coisa que cai, treme no
chão e some. Vale para o machado e para o incêndio.

**A fera dá o bote.** Em cima da presa ela não corre, investe: levanta o
dianteiro e desaba para a frente num tranco só. E o **jacaré rola** — agarrada a
presa, ele gira em torno do próprio comprimento, que é o gesto que identifica o
bicho e o que faz um ataque na água ser visível de cima.

## Alarme: chamar o guarda

Antes, uma fera circulava a aldeia e ninguém reagia até ela morder alguém.

Agora quem vê uma fera a quatro tiles reage, e a reação depende de quem é. Guarda
e caçador **encaram**: viram para o bicho e vão. Todo o resto **corre** para o
meio da tribo — e deixa o alarme dado. É o alarme que junta os guardas num ponto
só, em vez de cada um enfrentar a sua fera sozinho: guarda que nem viu o bicho
larga o posto e acorre, se estiver a menos de catorze tiles.

Duas travas que o teste exigiu, as duas por extinção em massa:

- **O ponto quente dura nove meses**, não três anos. Com três anos os guardas
  iam e voltavam sem parar, e três das cinco sementes se extinguiam antes do ano
  65 sem ninguém trabalhar.
- **Susto tem descanso.** Sem ele a pessoa foge, chega ao meio da tribo,
  reavalia, vê a mesma fera e foge de novo. Uma banda de doze passava a vida
  correndo em vez de comer. E só fera caçando ou com fome assusta: a de barriga
  cheia já passa longe da aldeia por conta própria.

## O mundo se guarda

Faltava o básico: o que você criou sumia ao fechar a aba. Agora há **Mundos**, na
barra de baixo — nomeia, guarda, lista o que já guardou, abre de volta, apaga.
Fica em `localStorage`, que é o único armazenamento que cumpre as regras da casa:
sem servidor, sem download, funciona offline.

Um mundo dá cerca de **80 kB**, e cabem oito. Duas economias sustentam isso: o
relevo e o ruído de umidade saem da semente, então não se guarda nada disso — na
hora de abrir, gera-se o mundo com a mesma semente e por cima dele se aplicam os
campos salvos; e os campos contínuos (comida, umidade, vigor, nutriente…) vão de
0 a 1 e cabem num byte cada, em vez dos quatro de um Float32.

Volta tudo: ano, gente com idade e vocação, tribos com celeiro, técnica, curral e
relações, rebanho com espécie, peixe, jacaré, o terreno inteiro e as últimas
sessenta linhas da crônica. Se a gravação não couber, o jogo avisa em vez de
morrer — quem está jogando há duas horas não perde a partida porque a nona
gravação estourou a cota.

## A cerca segura

Antes o curral era só uma preferência de destino: bicho assustado atravessava o
mourão como se não houvesse nada ali. Agora o gado **não passa**, nem em pânico
— quem está sendo tocado para dentro é a única exceção, senão nunca entraria. A
fera passa por cima.

## Bicho na roça

Herbívoro come o que estiver debaixo do pé, e roça é comida boa. Mas só vira
problema **em boiada e sem ninguém tomando conta**: seis num raio de três tiles,
e nenhuma pessoa a quatro. Bicho não come a lavoura debaixo do nariz de quem
está capinando.

As duas condições custaram caro para achar. Sem a contagem de bando, um único
boi parado num canteiro anulava exatamente o crescimento da roça e travava a
colheita para sempre — a semente 7 se extinguia no ano 39 com catorze roças
plantadas e nenhuma madurando. Sem a segunda, a tribo pequena, que vive em cima
da própria lavoura, perdia a primeira colheita para o rebanho que o jogador
soltou junto, e morria no ano 14.

Roça pisada não é roça destruída: o bicho come o que está de pé e a terra
continua lá.

## Empate

Nem todo encontro de fronteira tem morto. Em pouco mais de um quarto das brigas
os dois se machucam, largam a luta e voltam com fome. Muda a história que se lê:
uma tribo pode sangrar numa fronteira por décadas sem nunca perder ninguém.

## Na fila

Coisas pedidas que ainda não estão aqui, para não empilhar sistema sobre uma
simulação que já tem seus buracos:

- **Tribo que aprende.** Depois de apanhar de fera e de vizinho, levantar muro e
  pôr guerreiro rondando a região — com o líder conduzindo, inteligência como
  atributo e não só diplomacia.
- **Tribo saqueadora.** A que fica sem suprimento parte para tomar a vila alheia
  em vez de plantar a sua.
- **Matilha.** Feras que se encontram caçarem juntas e atacarem organizadas, a
  ponto de acabar com uma tribo — e a que viu o bando morrer numa aldeia
  aprender a não voltar sozinha.
- **Apagar antes de trocar.** Hoje o pincel de terreno sobrescreve o que havia.
  A ideia é ter que limpar primeiro, e o que se planta somar com o substrato em
  vez de substituí-lo.
- **Nascente e cachoeira.** Uma fonte no alto, a água descendo por gravidade,
  formando rio e enchendo depressão até virar lago — e o verde vindo atrás dela.
- **Bioma por substrato.** A mesma semente dando mata fechada em terra fértil e
  vegetação rala em chão de pedra, em vez de floresta igual em todo lugar.

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
