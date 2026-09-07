# Muralha dos Rabiscos (defesa de muralha, estilo Doodle Magic)

Um arquivo, `index.html`, sem build. Jogo 2D em retrato: os slimes descem pela
estrada, os heróis ficam na muralha e atiram sozinhos. Referência de estilo:
*Doodle Magic: Wizard vs Slime* — papel quadriculado, traço tremido, cores chapadas.

## Loop do jogo

| Camada | O que acontece | Onde no código |
|---|---|---|
| **Dentro da run** | Ondas crescentes, XP por slime, ao subir de nível escolhe 1 de 3 skills (12 skills, com níveis) | `SKILLS`, `openLevelUp()`, `onHit()` |
| **Entre runs** | Moedas compram 5 melhorias permanentes (10 níveis cada), heróis novos e vagas extras na muralha (até 3 heróis juntos) | `UPGRADES`, `HEROES`, `SLOT_COST` |
| **Interação** | Toque em um slime: todos os heróis focam nele por 4 s. Nada mais a fazer com o dedo, de propósito | `pointerdown` no canvas |

Heróis: **Mago** (bola de fogo com explosão), **Arqueira** (flechas rápidas que
atravessam), **Bruxa** (veneno ao longo do tempo). Chefe **Rei Slime** a cada 5 ondas,
que se parte em 6 slimes ao morrer.

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

1. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**
2. Branch: a que contém esta pasta · Folder: **/ (root)** → Save
3. Em ~1 minuto o jogo estará em
   `https://<seu-usuario>.github.io/<repo>/castle-defense/`

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
