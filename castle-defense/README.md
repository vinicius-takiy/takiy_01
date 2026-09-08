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

### Heróis

| Herói | Papel | Como joga |
|---|---|---|
| Mago | Muralha | Bola de fogo com explosão pequena |
| Arqueira | Muralha | Flechas rápidas que atravessam um inimigo |
| Bruxa | Muralha | Veneno ao longo do tempo |
| **Cavaleiro** | Campo, tanque | 150 de vida, 18% de armadura. A cada 7 s **salta** sobre o alvo distante e bate no chão (170% de dano em raio de 62 px, provoca e atrasa). A cada 12 s grita e puxa os inimigos num raio de 150 px. Regenera 6/s fora de combate, mas só 20% disso sob ataque: cerco longo derruba ele |
| **Ladina** | Campo, assassina | 95 de vida, esquiva 35% dos golpes, 20% de crítico base, dano alto, rápida |

Heróis de campo levam dano em golpes discretos a cada 0,8 s (por isso a esquiva é
visível como texto), morrem e voltam em 10 s no ponto de origem em frente à muralha.
Slimes que um herói de campo acerta passam a persegui-lo por 3 s. Skills de time
valem para eles também: Tiro duplo vira +35% de dano por nível, Perfurante vira golpe
em área.

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
