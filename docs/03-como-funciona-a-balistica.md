# 3. Como funciona a balística

Este é o único documento realmente técnico. Se você entender o que está aqui,
entende o jogo inteiro.

---

## Por que não usar um Raycast simples

Um FPS comum faz assim:

```csharp
if (Physics.Raycast(camera.position, camera.forward, out RaycastHit hit))
    hit.collider.GetComponent<Enemy>().TakeDamage(50);
```

O tiro acerta **instantaneamente e em linha reta**. Não existe queda, nem vento,
nem tempo de voo. Para um jogo de tiro a 10 metros, tudo bem. Para um sniper,
isso elimina o jogo: mirar vira apontar e clicar.

## Por que não usar um Rigidbody

Seria o caminho natural: `rigidbody.velocity = direction * 850f` e deixar a Unity
cuidar. O problema é o **tunneling**.

A física roda a cada 0.02s. A 850 m/s, a bala anda **17 metros por passo de física**.
Ela simplesmente teleporta de um lado da parede para o outro sem nunca tocá-la.

## A solução: integrar na mão + raycast no segmento

É o que `BulletProjectile.FixedUpdate()` faz, em quatro etapas:

### Etapa 1 — Somar as forças

```csharp
Vector3 acceleration = Vector3.down * effectiveGravity;   // gravidade
acceleration += WindManager.Instance.Wind * windScale;    // vento

float speed = Velocity.magnitude;
acceleration -= Velocity.normalized * (drag * speed * speed);  // arrasto do ar
```

O arrasto é proporcional ao **quadrado** da velocidade e aponta sempre contra o
movimento — é por isso que a bala perde velocidade rápido no começo e devagar no fim.

### Etapa 2 — Integrar (Euler semi-implícito)

```csharp
Velocity += acceleration * dt;
Vector3 nextPosition = transform.position + Velocity * dt;
```

A ordem importa: atualiza a **velocidade primeiro**, depois usa a velocidade nova
para calcular a posição. Isso é o método de Euler *semi-implícito*, e ele é estável
onde a versão ingênua (posição primeiro) acumularia erro e faria a bala subir sozinha.

### Etapa 3 — Raycast no trecho percorrido

```csharp
Vector3 segment = nextPosition - previousPosition;
if (Physics.Raycast(previousPosition, segment.normalized, out hit, segment.magnitude))
{
    HandleImpact(hit);
    return;
}
```

**Esta é a linha que resolve o tunneling.** Em vez de perguntar "tem algo onde a bala
está?", perguntamos "tem algo no caminho entre onde ela estava e onde ela vai estar?".
Funciona a qualquer velocidade.

### Etapa 4 — Avançar e envelhecer

Move a bala, guarda a posição para o próximo frame, e destrói o objeto se passar do
tempo ou do alcance máximo. Sem isso, cada tiro errado deixaria um objeto vivo para
sempre e o jogo travaria depois de alguns minutos.

---

## A matemática que o jogador precisa sentir

**Queda da bala**, em queda livre:

```
t = distância / velocidade
queda = 0.5 × g × t²
```

Com um .308 (850 m/s) e gravidade real:

| Distância | Tempo de voo | Queda |
|---|---|---|
| 100 m | 0.12 s | 7 cm |
| 300 m | 0.35 s | 61 cm |
| 500 m | 0.59 s | 1.7 m |
| 800 m | 0.94 s | 4.3 m |

A 800 metros você precisa mirar **quatro metros acima** do alvo. É esse número que
transforma um clique em uma decisão. Está implementado em
`BallisticsSolver.EstimateDrop()`.

**Deriva do vento:** com vento de través a 8 m/s a 500m, a bala desloca ~4.7m
lateralmente. Por isso o `WindManager` varia o vento devagar — o jogador precisa
reavaliar a cada tiro, não decorar um valor.

---

## Onde a dificuldade entra

Repare que **nada acima muda entre os modos**. O que muda são multiplicadores lidos
uma única vez, no `Launch()`:

```csharp
effectiveGravity  = gravity * profile.gravityScale;
effectiveWindScale = profile.windScale;
Velocity = direction * muzzleVelocity * profile.bulletSpeedMultiplier;
```

No modo fácil, `gravityScale = 0.3` faz a queda a 500m virar 50cm em vez de 1.7m.
O jogo continua tendo queda — só perdoa mais. Nenhuma linha de código foi duplicada.

---

## Como ajustar o "feel"

| Sensação desejada | Mexa em |
|---|---|
| Tiro mais perdoado | `gravityScale` ↓ ou `bulletSpeedMultiplier` ↑ |
| Bala mais lenta e cinematográfica | `muzzleVelocity` ↓ (tenta 400 antes de 850) |
| Mais tensão na mira | `swayAmplitude` ↑ e `holdBreathDuration` ↓ |
| Vento decisivo | `maxSpeed` do WindManager ↑ |

> **Dica de balanceamento:** uma `muzzleVelocity` de 850 é realista mas o tempo de voo
> fica curto demais para a killcam brilhar. Muitos jogos comerciais usam 300–500 m/s
> justamente para a bala ser *vista* voando. Realismo perde para legibilidade aqui.
