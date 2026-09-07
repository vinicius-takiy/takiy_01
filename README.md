# Sniper Mobile — Simulador de Tiro de Precisão

Projeto de portfólio: um jogo de sniper para Android/iOS feito em **Unity 6 (URP)**,
com balística real (queda, vento, tempo de voo) e três níveis de dificuldade que
vão do arcade ao simulador puro.

> **Status:** scaffold de código. Os scripts em `Assets/Scripts/` estão prontos.
> Falta criar o projeto Unity, a cena e os assets visuais — o passo a passo está em `docs/`.

---

## A decisão de arquitetura mais importante

Um jogo "híbrido" costuma virar dois jogos e morrer pela metade. Aqui não:

**Existe um único sistema de balística, sempre realista.** O que muda entre os modos
são apenas números num arquivo de configuração (`DifficultyProfile`):

| Parâmetro | Fácil | Normal | Hardcore |
|---|---|---|---|
| `gravityScale` (queda da bala) | 0.3 | 0.8 | 1.0 |
| `windScale` (efeito do vento) | 0.0 | 0.6 | 1.0 |
| `swayAmplitude` (balanço da mira) | 0.2 | 0.8 | 1.5 |
| `holdBreathDuration` (fôlego) | 8s | 5s | 3s |
| `aimAssistRadius` (magnetismo) | 1.2 | 0.3 | 0.0 |
| `showRangefinder` (mostra distância) | ✅ | ✅ | ❌ |
| `showTrajectoryPreview` (linha da bala) | ✅ | ❌ | ❌ |
| `scoreMultiplier` | 1.0x | 1.8x | 3.0x |

Zero código duplicado. Adicionar um quarto modo é criar mais um arquivo, não escrever
mais um sistema.

---

## Os sistemas e onde eles estão

| Arquivo | O que faz |
|---|---|
| `Ballistics/BulletProjectile.cs` | **O coração do jogo.** Bala com física real, integrada à mão para não atravessar paredes |
| `Ballistics/BallisticsSolver.cs` | Prevê trajetória e calcula queda em cm (para o HUD do modo fácil) |
| `Weapons/ScopeController.cs` | Luneta: zoom, balanço da respiração, prender o fôlego |
| `Weapons/RifleController.cs` | Disparo, munição, recuo, assistência de mira |
| `Weapons/WeaponData.cs` | Ficha técnica do rifle (ScriptableObject) |
| `Difficulty/DifficultyProfile.cs` | A tabela acima, como asset editável |
| `Difficulty/DifficultyManager.cs` | Guarda o modo escolhido entre as cenas |
| `Targets/Target.cs` + `Hitbox.cs` | Inimigo, vida, headshot, ragdoll |
| `Targets/TargetPatrol.cs` | IA de patrulha e alerta (NavMesh) |
| `Cinematics/KillCam.cs` | Câmera lenta seguindo a bala nos últimos metros |
| `Mission/MissionManager.cs` | Objetivos, tempo, pontuação, estrelas |
| `Environment/WindManager.cs` | Vento que muda ao longo da fase |
| `Input/TouchAimInput.cs` | Controles de toque (arrastar, pinça, botões) |
| `UI/HudController.cs` | Distância, vento, munição, fôlego, objetivos |
| `UI/DifficultyMenu.cs` | Menu inicial: escolha do modo e melhor resultado |
| `UI/MissionResultScreen.cs` | Fim de missão: pontos, estrelas animadas, recorde |
| `Core/MissionProgress.cs` | Salva melhor resultado por missão e por dificuldade |
| `Core/GameBootstrap.cs` | 60fps, tela sempre acesa, orientação paisagem |

---

## Por onde começar (leia nesta ordem)

1. **[docs/01-setup-unity.md](docs/01-setup-unity.md)** — instalar a Unity e criar o projeto
2. **[docs/02-primeira-cena.md](docs/02-primeira-cena.md)** — montar a cena e dar o primeiro tiro
3. **[docs/03-como-funciona-a-balistica.md](docs/03-como-funciona-a-balistica.md)** — entender o código da bala
4. **[docs/04-modos-de-dificuldade.md](docs/04-modos-de-dificuldade.md)** — configurar os três perfis
5. **[docs/05-build-android.md](docs/05-build-android.md)** — rodar no celular (Unity Remote, USB ou APK)
6. **[docs/06-menu-e-resultado.md](docs/06-menu-e-resultado.md)** — menu de dificuldade e tela de resultado

---

## Roadmap do MVP

Ordem pensada para você ter algo jogável cedo, não para ter tudo pronto no fim.

### Semana 1–2 — O tiro
- [ ] Projeto Unity criado com URP mobile
- [ ] Cena com terreno, um alvo estático e a câmera do jogador
- [ ] Bala voando com queda visível
- [ ] Luneta com zoom e balanço da respiração
- [ ] **Marco:** acertar uma lata a 300m e *sentir* que foi difícil

> Se este marco não for divertido, não avance. Nenhum menu, loja ou progressão
> salva um tiro que não é gostoso de dar.

### Semana 3 — O alvo e o impacto
- [ ] Inimigo humanoide com hitboxes (cabeça / torso / membros)
- [ ] Ragdoll na morte
- [ ] Killcam em câmera lenta
- [ ] Patrulha com NavMesh

### Semana 4 — A missão
- [ ] HUD (distância, vento, munição, fôlego)
- [ ] Objetivos, timer e tela de resultado com estrelas
- [ ] Menu de dificuldade com os três perfis

### Semana 5–6 — O celular
- [ ] Controles de toque ajustados numa tela real
- [ ] Build Android rodando a 60fps
- [ ] 5 missões no mesmo mapa, com posições e horários diferentes

### Depois do MVP
- [ ] Segundo rifle e sistema de attachments
- [ ] Segundo mapa
- [ ] Progressão e moeda
- [ ] Áudio e polimento visual

---

## Orçamento de desempenho (celular médio)

| Métrica | Meta |
|---|---|
| FPS | 60 estável |
| Draw calls | < 150 |
| Triângulos em tela | < 300 mil |
| Texturas | ASTC 6x6, atlas quando possível |
| Iluminação | 100% baked (cena estática permite) |

Cenário parado é a grande vantagem deste gênero: dá para assar toda a luz e usar
occlusion culling agressivo.

---

## O que **não** fazer no MVP

- Mundo aberto — cena estática por missão resolve
- Multiplayer — bala com tempo de voo exige netcode caro
- Loja, moeda e progressão antes do tiro estar bom
- Modelar seus próprios personagens — use Mixamo (grátis) e ajuste depois
