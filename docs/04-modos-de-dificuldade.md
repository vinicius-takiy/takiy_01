# 4. Configurar os três modos de dificuldade

## Criar os perfis

No Unity: **Assets → Create → Sniper → Perfil de Dificuldade**, três vezes.
Salve em `Assets/Data/Difficulty/`.

### Fácil — "Sniper de celular"
Referência: Sniper 3D, Hitman Sniper. Qualquer pessoa acerta no primeiro tiro.

```
displayName            = Fácil
gravityScale           = 0.3
windScale              = 0.0
bulletSpeedMultiplier  = 1.5
swayAmplitude          = 0.2
holdBreathDuration     = 8
aimAssistRadius        = 1.2
aimAssistStrength      = 0.7
showRangefinder        = true
showWindIndicator      = false
showTrajectoryPreview  = true
scoreMultiplier        = 1.0
```

### Normal — o padrão
Tem queda e vento, mas a informação está na tela. É onde 80% dos jogadores ficam.

```
displayName            = Normal
gravityScale           = 0.8
windScale              = 0.6
bulletSpeedMultiplier  = 1.0
swayAmplitude          = 0.8
holdBreathDuration     = 5
aimAssistRadius        = 0.3
aimAssistStrength      = 0.25
showRangefinder        = true
showWindIndicator      = true
showTrajectoryPreview  = false
scoreMultiplier        = 1.8
```

### Hardcore — o simulador
Sem telêmetro, sem indicador de vento, sem assistência. O jogador estima a distância
pelo tamanho do alvo na luneta e lê o vento pela vegetação e pela bandeira do cenário.

```
displayName            = Hardcore
gravityScale           = 1.0
windScale              = 1.0
bulletSpeedMultiplier  = 1.0
swayAmplitude          = 1.5
holdBreathDuration     = 3
aimAssistRadius        = 0.0
aimAssistStrength      = 0.0
showRangefinder        = false
showWindIndicator      = false
showTrajectoryPreview  = false
scoreMultiplier        = 3.0
```

## Ligar no gerenciador

No objeto `Managers` da cena, componente **DifficultyManager**:
- `Profiles` → tamanho 3, na ordem: Fácil (0), Normal (1), Hardcore (2)
- `Default Profile Index` → 1

A escolha é salva em `PlayerPrefs` e sobrevive ao fechar o jogo.

## Botão de troca no menu

Ligue cada botão da UI ao método `DifficultyManager.SetProfile(int)`,
passando 0, 1 ou 2 no Inspector. Não precisa escrever código.

---

## O que torna o modo Hardcore realmente jogável

Tirar a informação da tela só é justo se ela existir **no mundo**. Sem isso, o
hardcore vira adivinhação — e adivinhação não é dificuldade, é frustração.

Coloque no cenário:

| Pista | Substitui |
|---|---|
| Bandeiras, roupa no varal, fumaça de chaminé | Indicador de vento |
| Postes, carros, portas (tamanhos conhecidos) | Telêmetro |
| Retículo mildot na luneta | Cálculo de distância pelo tamanho do alvo |
| Vegetação balançando | Direção e força do vento |

**A regra do mildot:** um alvo de altura conhecida que ocupa *N* mils na luneta está a
`distância = (altura em metros × 1000) / N` metros. Uma pessoa de 1.8m ocupando 3 mils
está a 600m. Ensine isso ao jogador no tutorial do modo hardcore — é o que faz ele se
sentir um atirador de verdade em vez de um jogador sem HUD.

## Como testar o balanceamento

Jogue a mesma fase nos três modos e cronometre. Metas razoáveis:

| Modo | Tiros para acertar um alvo a 400m |
|---|---|
| Fácil | 1 |
| Normal | 1–2 |
| Hardcore | 2–4 (com tiros de correção) |

Se o hardcore exigir mais de 5 tiros, o problema não é o jogador — é a falta de pistas
visuais no cenário.
