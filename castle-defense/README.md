# Muralha dos Rabiscos (defesa de muralha, estilo Doodle Magic)

Um arquivo, `index.html`, sem build. Jogo 2D em retrato: os slimes descem pela
estrada, os heróis ficam na muralha e atiram sozinhos. Referência de estilo:
*Doodle Magic: Wizard vs Slime* — papel quadriculado, traço tremido, cores chapadas.

## Loop do jogo

**24 skills** para escolher ao subir de nível, três por vez: Tiro duplo, Perfurante, Chamas,
Gelo, Raio em cadeia, Crítico, Cadência, Força, Reforço, Meteoro, Espinhos, Ímã de XP,
Veneno, Congelar, Estouro, Precisão, Mira, Fúria, Argamassa, Pilhagem, Vampirismo,
Rodopio, Guarda e Volta rápida.

| Camada | O que acontece | Onde no código |
|---|---|---|
| **Mapa de fases** | Dez fases com dificuldade gradual e um chefe no fim de cada uma; vitória dá 1 a 3 estrelas pela vida da muralha e abre a próxima. Modo Infinito abre ao vencer a fase 10 | `LEVELS`, `renderMap()`, `winLevel()` |
| **Dentro da fase** | Ondas fixas, XP por slime, ao subir de nível escolhe 1 de 3 skills (12 skills, com níveis) | `SKILLS`, `openLevelUp()`, `applyHit()` |
| **Chefes** | Príncipe Slime (se parte em 3), Slime Bruxo (invoca a cada 5 s), Golem de Lama (lento, derruba a muralha), Slime Gigante (acelera ao perder vida), Rei Slime (se parte em 6). O item **não é garantido**: 35% no Príncipe, 50% no Bruxo e no Golem, 55% no Gigante, 75% no Rei. Sem item, o chefe paga moedas | `ENEMIES`, `kill()` |
| **Hordas** | A cada 4 ondas vem quase o dobro de inimigos, chegando em metade do tempo. Anunciado no HUD com 🔥 | `startWave()` |
| **Itens** | Cinco slots por herói: arma, cabeça, peitoral, mãos, pés. Raridade comum/raro/épico com 1 a 3 afixos sorteados por slot. Baú compartilhado, venda por moedas | `rollItem()`, `heroBonus()`, `renderEquip()` |
| **Entre fases** | Moedas compram 5 melhorias permanentes, heróis novos e vagas no time (até 3) | `UPGRADES`, `HEROES`, `SLOT_COST` |
| **Interação** | Toque em um slime: todos os heróis focam nele por 4 s | `pointerdown` no canvas |

### Monstros

| Monstro | Truque |
|---|---|
| Slime / Rápido / Gordo | Base: comum, veloz e resistente |
| **Morcego** | Voa em zigue-zague e ignora Espinhos da muralha |
| **Esqueleto** | Levanta uma vez com metade da vida depois de morto |
| **Aranha** | Ao bater, tem 50% de prender o herói em teia: metade da cadência por 3 s |
| **Cogumelo** | Explode ao morrer, ferindo heróis de campo por perto e a muralha |
| **Curandeiro** | Cura 11/s todos os inimigos num raio de 95 px. Mate primeiro |
| **Casco** | Resiste a 60% do dano de projétil. Só golpe corpo a corpo derruba rápido |
| **Zumbi** | Apodrece quem ele bate: dano contínuo no herói por 4 s |
| **Goblin** | Rápido, e rouba suas moedas enquanto bate na muralha |
| **Lobo** | Corre até 48% mais rápido conforme outros lobos estão por perto |
| **Orc** | Golpe em área: acerta todos os heróis de campo num raio de 52 px |
| **Espectro** | Fica intangível 1 s a cada 3 s: projétil atravessa, só corpo a corpo alcança |
| **Dragão** (chefe) | Voa, ignora espinhos e cospe bolas de fogo na muralha. Fases 9 e 10 |

Cada fase tem de 10 a 12 ondas, com mistura própria que introduz os tipos aos poucos.

### Cenário e chefe por fase

Cada fase tem **cenário próprio** desenhado no mesmo traço tremido do resto do jogo
(`THEMES` + `drawScene()`) e um **chefe que combina com o lugar e com os monstros
daquela fase** — nem todo chefe é slime.

| Fase | Cenário | Novo na mistura | Chefe |
|---|---|---|---|
| 1 | Vila: casinhas ao longe e capim | Slime | Príncipe Slime (14 dano, se parte em 3) |
| 2 | Moinho: pás girando e cerca | Rápido, Goblin | **Rei Goblin** (rouba moedas e chama goblins) |
| 3 | Ponte: rio atravessando e tábuas | Gordo | **Troll da Ponte** (cura 15/s sozinho) |
| 4 | Pântano: poças e juncos | Lobo, Morcego | Slime Bruxo (invoca reforços) |
| 5 | Colina: árvores secas e lápides | Aranha, Cogumelo | **Rainha Aranha** (teia + ninhada) |
| 6 | Floresta torta: mata fechada | Esqueleto | **Lorde Esqueleto** (levanta e chama os seus) |
| 7 | Ruínas: colunas quebradas | Zumbi, Espectro | **Rei Espectro** (some 1 s a cada 3 s) |
| 8 | Desfiladeiro: paredões dos dois lados | Casco, Orc | **Chefe Orc** (área de 72 px, enlouquece) |
| 9 | Vale da névoa: pinheiros e neblina | Curandeiro | Dragão (voa e cospe fogo) |
| 10 | Trono: tapete, tochas e o trono | Tudo junto | **Rei Slime** + Dragão |

Golem de Lama (45 de dano, o mais forte) e Slime Gigante ficaram guardados para o
**Infinito**, junto com todos os outros no sorteio de chefe a cada 5 ondas.

Os chefes novos reaproveitam a silhueta do bicho que manda na fase, em tamanho de
chefe — as formas em `SHAPES` já escalam pelo raio — com **coroa** para a realeza
(Rei Goblin, Rainha Aranha, Lorde Esqueleto, Rei Espectro). O Troll tem corpo próprio.

### Dificuldade: vem da FASE, não da onda

Antes a vida do monstro subia **15% por onda** dentro da mesma fase, o que fazia a
onda 10 ter mais que o dobro da vida da onda 1 — a dificuldade vinha de avançar as
ondas, não de avançar no jogo. Agora é o contrário:

- **Dentro da fase** a vida quase não mexe (4% por onda). O que cresce é a
  **quantidade** de monstros por onda, e a cada 4 ondas vem uma horda.
- **Entre fases** sobem juntos vida (`L.hp`: 0,75 → 3,40 da fase 1 à 10),
  velocidade (`L.spd`) e, novidade, **poder de ataque** (`dpsMul()`: +6% por fase,
  1,00 → 1,54). O dano do monstro não era escalado por nada antes.
- O **volume por onda** também pesa mais por fase: `3,8 + onda×0,6 + fase×0,95`.

Verificado em partidas automatizadas: fase 1 com o time inicial (só o Mago, zero
melhorias) fecha em 100% de muralha — continua sendo tutorial; fase 2 com Mago +
Arqueira fecha inteira; fase 5 com time de cinco fecha sem levar dano.

## Sobre o bug do dinheiro quase infinito

Um jogador teve o save corrompido: `coins: 48.689.953`, `runs: 1.741`, `kills: 184.488`.
`runs` só incrementa quando uma partida termina de verdade — 1.741 é a prova de que o
fim de onda disparou em rajada, somando o bônus de moedas repetidas vezes antes do
estado do jogo mudar.

Duas correções estruturais:
- **Trava de disparo único** (`G.waveClearedAt`): o bônus de fim de onda só pode ser dado
  uma vez por onda. A trava guarda o **número da onda já premiada** em vez de um booleano
  que precisava ser zerado em `startWave()` — um booleano assim ficava preso em `true`
  para sempre se qualquer coisa no meio do caminho falhasse, e a fase encalhava.
- **Teto de moedas** (`COIN_CAP = 999.999`): nenhuma partida legítima chega perto disso.
  Toda soma passa por `addCoins()`, que arredonda e trava no teto.
- **Piso de moedas (saldo negativo)**: um jogador ficou com `coins: -721` e não conseguia
  mais comprar nada. As compras debitavam direto (`profile.coins -= custo`) confiando só
  no botão desabilitado. Agora todo débito passa por `pay()`, que **recusa** se não houver
  saldo, e `clampCoins()` prende o saldo entre 0 e o teto em todo ponto de escrita —
  `NaN` e `undefined` viram 0. `Save.sanitize()` conserta saves já estragados na abertura.

## A fase que não terminava

Outro jogador concluiu a fase 2 e ficou preso: nenhuma tela de resultado, e a única saída
era encerrar a run pela pausa. A causa é a ordem dentro de `winLevel()` — ela chamava
`Save.save()` e `renderMenu()` **antes** de `setState('over')`. Se qualquer uma dessas
falhasse (um save com campo nulo, por exemplo), a tela nunca subia e o jogo ficava em
`play` com o campo vazio: sem ondas, sem vitória, sem saída.

Três camadas de proteção, todas verificadas com falha injetada de propósito num teste:
1. `winLevel()` e `endRun()` **sobem a tela primeiro** e só depois salvam/redesenham, cada
   um desses passos em `try/catch`.
2. O bloco de fim de onda inteiro está em `try/catch`, com saída segura para a tela de fim.
3. **Watchdog**: se passarem 6 s com o campo limpo e a fase não avançar nem terminar, o
   jogo destrava sozinho em vez de deixar o jogador preso.

### Heróis: time de até cinco

**3 na muralha + 2 no campo**, no máximo — as vagas são compradas uma a uma
(400, 1.200, 2.200 e 3.400 moedas).

| Herói | Papel | Custo | Como joga |
|---|---|---|---|
| Mago | Muralha | inicial | Bola de fogo com explosão pequena |
| Arqueira | Muralha | 300 | Flechas rápidas que atravessam um inimigo |
| Bruxa | Muralha | 800 | Veneno ao longo do tempo |
| **Domador** | Muralha | 1.200 | Atira da muralha e mantém a **Fera** lutando no campo. A Fera volta sozinha se cair e **não ocupa vaga** |
| Cavaleiro | Campo, tanque | 500 | 150 de vida, salta sobre o grupo a cada 7 s e provoca a cada 12 s |
| Ladina | Campo, assassina | 900 | 95 de vida, esquiva 35%, 20% de crítico base |
| **Lanceiro** | Campo, linha de frente | 1.400 | 175 de vida, 32% de armadura, alcance de 54 px, bate devagar e provoca a cada 14 s |
| **Bárbaro** | Campo, dano em área | 1.600 | 125 de vida e quase nenhuma defesa; **cada golpe acerta todos num raio de 48 px** |

**Todo herói tem vida agora, inclusive quem fica na muralha.** Antes o herói de muralha
era intocável. Agora, quando um monstro chega na ameia, ele divide o estrago: **metade
vai para a muralha e metade para o herói que está bem ali em cima** (`wallHeroNear()` +
`heroDot()`). Quem está na muralha compensa com armadura alta (26–32%, luta atrás da
ameia) e regeneração; se cair, volta depois de alguns segundos, como os de campo.

Por causa disso, duas skills mudaram de escopo: **Guarda** (+armadura e +vida) e **Volta
rápida** (voltar mais cedo) agora valem para **todos** os heróis. Só **Vampirismo** e
**Rodopio** continuam restritas a corpo a corpo — e são escondidas da escolha de nível
quando o time não tem ninguém no campo, para não oferecer skill inútil.

**A Fera** é um herói de campo escondido (`hidden: true`): não aparece na loja, não conta
vaga, e nasce junto com o Domador em `buildTeam()`. Com isso ela reaproveita toda a IA,
o desenho, a morte e o respawn dos heróis de campo, sem código novo de companheiro.

`Save.sanitize()` conserta saves antigos na abertura: tira herói que não existe mais,
tira a Fera do time salvo, corta o time para caber em 3 muralha / 2 campo e prende
`slots` entre 1 e 5.

## Como o progresso fica salvo

Três camadas, em ordem de confiabilidade crescente:

| Camada | Quando salva | Sobrevive a |
|---|---|---|
| `localStorage` | A cada compra, fim de onda e fim de run | Fechar o Safari, reiniciar o celular |
| Nuvem (`db` do artefato publicado no claude.ai) | Mesmos momentos, com atraso de 0,8 s para agrupar escritas | Trocar de aparelho, limpar dados do Safari |
| Código de progresso (Trocar perfil → Copiar / Importar) | Quando você pede | Levar o save para o PWA instalado, outro navegador ou outra pessoa |
| Backend próprio com login (não implementado) | — | Usuários de verdade, vários jogadores |

O objeto salvo é um só (`profile`): moedas, níveis das melhorias, heróis
desbloqueados, time, recordes e um **snapshot da run em andamento** gravado ao fim
de cada onda (o botão "Continuar run" volta para a onda seguinte).

Regra de conflito: o que tiver `updatedAt` maior vence, local ou nuvem. Simples e
suficiente para um jogador; um produto real precisaria de merge por campo.

**Perfis:** a nuvem do artefato não separa dados por login nesta conta, então o
jogo usa um nome de perfil (`saves/<nome>`). Como só quem está logado na conta abre
o artefato, na prática o perfil é seu. Fora do claude.ai (este arquivo aberto
direto ou hospedado), `window.claude` não existe e o jogo cai para só local.

## PWA: instalar como app

A pasta já é um PWA completo: `manifest.webmanifest`, `sw.js` (funciona offline
depois da primeira visita) e ícones em `icons/`. Falta só hospedar em HTTPS.

### Publicar de graça no GitHub Pages

O repositório já tem tudo pronto: `index.html` na raiz listando os jogos, `.nojekyll`
e o workflow `.github/workflows/pages.yml`. Falta **ligar o Pages uma vez** — nem o
conector do GitHub nem o token do Actions conseguem fazer isso (a API responde
`Resource not accessible by integration`), só uma pessoa com acesso de admin.

Vá em **Settings → Pages** e escolha um dos dois:

| Opção | O que marcar | Quando usar |
|---|---|---|
| **Servir do branch** (mais simples) | Source: *Deploy from a branch* · Branch: `claude/sniper-game-mobile-simulator-dw4abz` · Folder: `/ (root)` | Publica o repositório como está, sem Actions. Atualiza a cada push |
| **Via Actions** | Source: *GitHub Actions* | Usa o workflow deste repositório, que copia só os jogos para o site |

Endereço final: `https://vinicius-takiy.github.io/takiy_01/castle-defense/`

> Se escolher *GitHub Actions* e o deploy falhar com "Branch is not allowed to deploy
> to github-pages", vá em **Settings → Environments → github-pages** e libere este
> branch, ou faça o merge para `main`.

### Instalar

| Aparelho | Como |
|---|---|
| iPhone (Safari) | Compartilhar → **Adicionar à Tela de Início**. Não existe botão de instalar no iOS. |
| Android (Chrome) | O jogo mostra o botão **Instalar** no menu; ou menu ⋮ → Instalar app |
| Desktop (Chrome/Edge) | Ícone de instalar na barra de endereço |

### O que o iPhone faz de diferente (e como o jogo lida)

- **Memória separada:** o app na Tela de Início não vê o `localStorage` do Safari.
  Progresso feito no Safari não aparece no app instalado. Solução no jogo: **Trocar
  perfil → Copiar código** no Safari, **Importar código** no app.
- **Sem nuvem fora do claude.ai:** `window.claude` só existe dentro do artefato.
  No PWA o jogo salva só localmente (e exporta/importa por código).
- **Sem notificações push** a menos que instalado (iOS 16.4+). Não usadas aqui.
- **Sem splash screen automática:** exigiria uma imagem por tamanho de tela
  (`apple-touch-startup-image`). Ficou de fora.

### Atualizar o jogo depois de publicado

Mude `VERSION` em `sw.js` (ex.: `muralha-v2`) a cada alteração. O service worker novo
descarta o cache antigo na ativação; sem isso o celular pode continuar rodando a
versão anterior por um bom tempo.

## Rodar

- Abra `index.html` no navegador. Mouse clica nos slimes para focar.
- No iPhone: hospede em GitHub Pages ou abra o artefato publicado; **Compartilhar →
  Adicionar à Tela de Início** dá tela cheia.

## Para evoluir

1. Som (precisa de um toque antes no iOS; ligue ao botão "Nova run")
2. Mais tipos de inimigo com comportamento (voador que ignora espinhos, curandeiro)
3. Skills por herói em vez de por time
4. Missões diárias e um segundo mapa desbloqueável
5. Login de verdade (Supabase) quando houver mais de um jogador
