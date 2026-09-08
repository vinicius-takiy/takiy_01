# 2. Montar a cena e dar o primeiro tiro

Meta deste documento: **em ~1 hora você atira e vê a bala cair.**
Nada de inimigo, HUD ou menu ainda.

---

## Passo 1 — O chão

1. **GameObject → 3D Object → Plane**
2. No Inspector, mude a `Scale` para `100, 1, 100` (fica um campo de 1km)

## Passo 2 — O jogador

1. **GameObject → Create Empty**, renomeie para `Player`
2. Posicione em `0, 2, 0`
3. Arraste a **Main Camera** para dentro do `Player` (ela vira filha dele)
4. Zere a posição local da câmera: `0, 0, 0`

> Por que essa hierarquia? O `Player` gira na horizontal (eixo Y) e a câmera gira
> na vertical (eixo X). Separar os dois evita a mira ficar torta ao olhar para cima.

## Passo 3 — O cano do rifle

1. Com a `Main Camera` selecionada: **GameObject → Create Empty Child**
2. Renomeie para `Muzzle`, posição local `0, 0, 0.5`

É de onde a bala vai sair.

## Passo 4 — O prefab da bala

1. **GameObject → 3D Object → Sphere**, renomeie para `Bullet`
2. `Scale` = `0.05, 0.05, 0.05`
3. **Remova o Sphere Collider** (a bala detecta colisão por Raycast própria — deixar
   o collider causaria colisões duplicadas)
4. Adicione o componente **BulletProjectile**
5. Adicione um **Trail Renderer** (rastro visível), `Time` = 0.4
6. Arraste o objeto da cena para a pasta `Assets/Prefabs/` → virou prefab
7. **Delete o objeto da cena** (o prefab basta)

## Passo 5 — A ficha do rifle

1. **Assets → Create → Sniper → Rifle**, nomeie `Rifle_308`
2. Valores iniciais realistas:
   - `muzzleVelocity` = 850
   - `damage` = 70
   - `boltActionTime` = 1.6
   - `magazineSize` = 5
   - `zoomFieldsOfView` = `[12, 6, 3]`

## Passo 6 — Ligar tudo na câmera

Selecione a **Main Camera** e adicione três componentes:

**ScopeController**
- `Weapon` → `Rifle_308`
- `Hip Field Of View` → 60

**RifleController**
- `Weapon` → `Rifle_308`
- `Scope` → o próprio ScopeController
- `Bullet Prefab` → o prefab `Bullet`
- `Muzzle` → o objeto `Muzzle`

**TouchAimInput**
- `Aim Pivot` → `Player`
- `Camera Transform` → `Main Camera`
- `Scope` e `Rifle` → os componentes acima

## Passo 7 — Os gerenciadores

1. **Create Empty** chamado `Managers`
2. Adicione **WindManager**
3. Adicione **DifficultyManager**
4. Crie os perfis de dificuldade (veja [04-modos-de-dificuldade.md](04-modos-de-dificuldade.md))
   e arraste-os para o array `Profiles`

## Passo 8 — Um alvo para acertar

1. **3D Object → Cube**, posição `0, 1, 300` (300 metros à frente)
2. `Scale` = `0.5, 1.8, 0.3` (tamanho aproximado de uma pessoa)

## Passo 9 — Atire

Aperte **Play**, segure o botão esquerdo do mouse e arraste para mirar.
Para disparar sem UI ainda, adicione temporariamente este script à câmera:

```csharp
using UnityEngine;
using Sniper.Weapons;

public class DebugFire : MonoBehaviour
{
    private RifleController rifle;
    private ScopeController scope;

    private void Awake()
    {
        rifle = GetComponent<RifleController>();
        scope = GetComponent<ScopeController>();
    }

    private void Update()
    {
        if (Input.GetKeyDown(KeyCode.Space)) rifle.Fire();
        if (Input.GetKeyDown(KeyCode.E))     scope.ToggleScope();
        if (Input.GetKeyDown(KeyCode.Z))     scope.CycleZoom();

        scope.SetHoldingBreath(Input.GetKey(KeyCode.LeftShift));
    }
}
```

| Tecla | Ação |
|---|---|
| Espaço | Atirar |
| E | Ligar/desligar luneta |
| Z | Trocar nível de zoom |
| Shift (segurar) | Prender o fôlego |

---

## O teste que valida tudo

Mire **exatamente** no centro do cubo a 300m e atire.
**A bala deve passar por baixo dele.**

Se passou por baixo: a gravidade está funcionando e você já tem um jogo de sniper.
Agora mire um pouco acima e acerte — essa é a mecânica inteira do gênero.

Se a bala acertou no centro, confira:
- O perfil de dificuldade ativo tem `gravityScale` > 0?
- O `DifficultyManager` está na cena com os perfis preenchidos?

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Bala atravessa o cubo | O `hitMask` do BulletProjectile não inclui a layer do cubo |
| Bala some na hora | O prefab ainda tem o Sphere Collider — remova |
| Nada acontece ao atirar | `Bullet Prefab` vazio no Inspector, ou ainda no cooldown do ferrolho |
| Erro "DifficultyManager não configurado" | Falta o objeto `Managers` na cena |

---

## Passo 10 (opcional) — Ligar a killcam

Só faz sentido depois de existir um inimigo com `Target` na cena.

1. Filho do `Player`: **Camera**, nomeada `KillCamera`
2. **Desative o GameObject** (o `KillCam.cs` liga e desliga sozinho)
3. No Inspector da `KillCamera`:
   - `Depth` = **1** (a Main Camera fica em 0 — depth maior desenha por cima)
   - Desmarque `Audio Listener` (duas AudioListeners na cena geram warning)
4. Crie um Empty `Cinematics` e adicione **KillCam**:
   - `Kill Camera` → `KillCamera`
   - `Rifle` → o `RifleController` da Main Camera

> **Atenção:** a killcam altera `Time.timeScale` **e** `Time.fixedDeltaTime`. Se você
> trocar de cena no meio do efeito sem restaurar os dois, o jogo inteiro fica em câmera
> lenta permanente. O `KillCam.cs` restaura no `OnDisable()` — mantenha esse padrão em
> qualquer outro efeito de slow-motion que você criar.

## Passo 11 (opcional) — O primeiro inimigo

1. Baixe um personagem em [Mixamo](https://mixamo.com) (grátis) e importe o `.fbx`
2. No objeto raiz: **Target** + **NavMeshAgent** + **TargetPatrol**
3. Configure o ragdoll: **GameObject → 3D Object → Ragdoll**, arraste os ossos
4. Arraste os Rigidbodies criados para o array `Ragdoll Bodies` do `Target`
5. Em cada collider do ragdoll, adicione **Hitbox**:
   - Cabeça → `BodyPart.Head`, multiplicador **5**
   - Torso → `BodyPart.Torso`, multiplicador **1**
   - Braços e pernas → `BodyPart.Limb`, multiplicador **0.5**
6. Crie GameObjects vazios como waypoints e arraste para o `TargetPatrol`
7. **Window → AI → Navigation → Bake** para gerar o NavMesh

Com `damage = 70` e vida 100: cabeça (350) mata na hora, torso (70) não mata,
membro (35) quase não faz nada. Ajuste esses números até o headshot parecer justo.
