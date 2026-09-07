# 6. Menu de dificuldade e tela de resultado

Duas cenas: `MainMenu` e `Mission_01`. Ambas precisam estar em
**File → Build Settings → Scenes In Build**, com `MainMenu` no topo (índice 0).

---

## Regras de UI para celular (valem para as duas cenas)

Ao criar o Canvas (**GameObject → UI → Canvas**), no componente **Canvas Scaler**:

| Campo | Valor | Por quê |
|---|---|---|
| UI Scale Mode | **Scale With Screen Size** | Senão os botões ficam minúsculos em telas grandes |
| Reference Resolution | 1920 × 1080 | Base horizontal |
| Match | 0.5 | Equilibra largura e altura |

Tamanho mínimo de botão: **120 × 120 px** na referência. Dedo não é mouse.

**iPhone:** coloque toda a UI dentro de um painel `SafeArea` com o componente
`SafeAreaFitter`, senão os botões da esquerda ficam embaixo do notch. Detalhes em
[07-ios-iphone.md](07-ios-iphone.md).

---

## Cena `MainMenu`

### Hierarquia

```
MainMenu (cena)
├── Bootstrap          → GameBootstrap
├── Managers           → DifficultyManager (com os 3 perfis)
└── Canvas
    ├── Titulo         (TMP_Text)
    ├── Botoes
    │   ├── Btn_Facil     (Button + TMP_Text filho)
    │   ├── Btn_Normal
    │   └── Btn_Hardcore
    ├── Painel_Detalhes
    │   ├── NomePerfil    (TMP_Text)
    │   ├── Detalhes      (TMP_Text, várias linhas)
    │   └── MelhorResultado (TMP_Text)
    └── Btn_Jogar         (Button)
```

### Ligar o `DifficultyMenu`

Adicione o componente **DifficultyMenu** no `Canvas`:

- `Difficulty Buttons` → tamanho 3: `Btn_Facil`, `Btn_Normal`, `Btn_Hardcore` **(nesta ordem — botão 0 = perfil 0)**
- `Profile Name Text`, `Profile Details Text`, `Best Result Text` → os três textos do painel
- `Play Button` → `Btn_Jogar`
- `Mission Scene Name` → `Mission_01`

Não precisa configurar `OnClick` de nenhum botão: o script faz isso sozinho no `Start()`.

> **Por que o `DifficultyManager` está no menu e não na missão?** Porque ele usa
> `DontDestroyOnLoad` — sobrevive à troca de cena. Se você colocar outro na missão
> (para testar direto), o segundo se autodestrói no `Awake()`. Pode deixar nas duas.

---

## Cena `Mission_01` — tela de resultado

### Hierarquia da UI

```
Canvas
├── HUD                     ← tudo que existe hoje (distância, vento, munição...)
├── Controles               ← botões de atirar, luneta, zoom, fôlego
└── Painel_Resultado        ← DESATIVADO no editor
    ├── Fundo               (Image escura, semitransparente)
    ├── Titulo              (TMP_Text)
    ├── Pontos              (TMP_Text)
    ├── Recorde             (TMP_Text)
    ├── Estrelas
    │   ├── Estrela_1       (Image)
    │   ├── Estrela_2
    │   └── Estrela_3
    ├── Btn_Repetir         (Button)
    └── Btn_Menu            (Button)
```

Agrupe `HUD` e `Controles` dentro de um objeto vazio `Gameplay_UI` —
é ele que o script esconde quando o resultado aparece.

### Ligar o `MissionResultScreen`

Adicione no `Canvas`:

- `Mission` → o `MissionManager` da cena
- `Panel` → `Painel_Resultado`
- `Gameplay Ui Root` → `Gameplay_UI`
- `Title Text`, `Score Text`, `Record Text` → os textos
- `Star Images` → as 3 imagens, da esquerda para a direita
- `Retry Button`, `Menu Button`
- `Menu Scene Name` → `MainMenu`
- `Show Delay` → 2 (segundos para a killcam terminar antes da tela subir)

### Botão de segurar o fôlego

É o único botão que precisa de *pressionar* e *soltar*, não de clique:

1. No `Btn_Folego`, adicione o componente **Event Trigger**
2. **Add New Event Type → Pointer Down** → `TouchAimInput.OnHoldBreathButton` com ✅ marcado
3. **Add New Event Type → Pointer Up** → `TouchAimInput.OnHoldBreathButton` com ☐ desmarcado

Os outros botões (atirar, luneta, zoom, recarregar) são `OnClick` normais ligados
aos métodos `OnFireButton`, `OnScopeButton`, `OnZoomButton`, `OnReloadButton`.

---

## Layout sugerido dos controles (paisagem)

```
┌──────────────────────────────────────────────────────────┐
│ 02:47          [ ] Elimine 3 alvos  1/3        5 / 5     │
│                                                          │
│                                                          │
│  [Luneta]                                    [Zoom]      │
│                          +                               │
│  [Fôlego]                                    [ATIRAR]    │
│  ▓▓▓▓▓░░░                                                │
│ 412 m  queda 118 cm                    --> 4.2 m/s       │
└──────────────────────────────────────────────────────────┘
```

Polegar esquerdo: luneta e fôlego. Polegar direito: zoom e tiro. Centro da tela livre
para arrastar a mira. Isso é o padrão do gênero e existe por um motivo: dá para
segurar o fôlego e atirar ao mesmo tempo sem soltar a mira.

## Teste completo

1. Abra `MainMenu`, aperte Play
2. Escolha **Hardcore**, clique **Jogar**
3. Elimine os alvos → após ~2s a tela sobe, estrelas acendem uma a uma
4. **Menu** → o painel de detalhes do Hardcore agora mostra "Melhor: **-  N pts"
5. Escolha **Fácil** → deve mostrar "Ainda não concluída" (recorde é por dificuldade)
