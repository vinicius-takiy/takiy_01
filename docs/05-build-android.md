# 5. Rodar no celular

Existem três formas, da mais rápida para a mais definitiva:

| Forma | Quando usar | Tempo por teste |
|---|---|---|
| **Unity Remote 5** | Testar toque e mira durante o desenvolvimento | ~5 segundos |
| **Build And Run (USB)** | Medir desempenho real, testar killcam e som | 3–8 minutos |
| **APK instalado** | Mostrar para outras pessoas, portfólio | Uma vez |

---

## Forma 1 — Unity Remote 5 (sem gerar build)

O celular vira **tela e controle** do jogo que está rodando no seu PC. A imagem é
transmitida comprimida (fica borrada), mas o toque é real. É a forma certa de ajustar
sensibilidade da mira, tamanho dos botões e a pinça de zoom.

1. Instale **Unity Remote 5** na Play Store
2. Ative a **Depuração USB** no celular (veja abaixo) e conecte ao PC
3. Na Unity: **Edit → Project Settings → Editor → Unity Remote → Device: Any Android Device**
4. Abra o app no celular, aperte **Play** no editor

Se aparecer tela preta no celular: feche e reabra o app com o editor já em Play.

**Limitação:** o desempenho que você vê é o do PC, não do celular. Nunca use isso
para julgar FPS.

---

## Forma 2 — Build And Run (o jogo rodando de verdade no aparelho)

## Configurar o projeto

**File → Build Settings → Android → Switch Platform** (demora, é normal: a Unity
reimporta todas as texturas no formato do Android).

Em **Player Settings**:

| Campo | Valor |
|---|---|
| Company Name / Product Name | os seus |
| Package Name | `com.seunome.snipermobile` |
| Minimum API Level | Android 8.0 (API 26) |
| Scripting Backend | **IL2CPP** |
| Target Architectures | ✅ ARM64 (obrigatório na Play Store) |
| Default Orientation | Landscape Left |

Em **Quality Settings** (crie um nível "Mobile"):
- Anti-Aliasing: 2x ou desligado
- Shadows: Hard Shadows Only, distância 80m
- VSync: Don't Sync (controle o FPS por código)

Trave o FPS no `Awake` de um script de inicialização:

```csharp
Application.targetFrameRate = 60;
QualitySettings.vSyncCount = 0;
```

## Rodar no aparelho

1. No celular: **Config → Sobre → toque 7x em "Número da versão"** → libera Opções do desenvolvedor
2. **Opções do desenvolvedor → Depuração USB** → ligar
3. Conecte por USB, aceite a autorização
4. Unity: **Build Settings → Build And Run**

## Forma 3 — Compartilhar o APK

Depois de um **Build** (sem Run), a Unity gera um arquivo `.apk`. Envie por
WhatsApp/Drive/cabo; quem receber precisa permitir "instalar de fontes desconhecidas"
quando o Android perguntar.

Para portfólio, esse `.apk` + um vídeo de 30 segundos da killcam vale mais que qualquer
descrição escrita.

---

## Perfilar de verdade

Use o **Profiler** (Window → Analysis → Profiler) **conectado ao aparelho**, nunca no
Editor. O Editor mente: ele roda num PC.

Em Build Settings marque `Development Build` + `Autoconnect Profiler`.

O que olhar, nesta ordem:
1. **CPU: Rendering** alto → draw calls demais. Combine materiais, use atlas
2. **CPU: Scripts** alto → algo caro no `Update`. `FindObjectsByType` a cada frame é o suspeito clássico
3. **Memória** subindo sem parar → objetos não destruídos. Confira o `maxLifetime` da bala

---

## Orçamento de desempenho

| Métrica | Meta em celular médio |
|---|---|
| FPS | 60 estável |
| Draw calls | < 150 |
| Triângulos | < 300 mil |
| Tempo de CPU por frame | < 16 ms |

## As cinco otimizações que mais rendem neste jogo

1. **Iluminação assada (baked)** — o cenário é estático, então zero luz em tempo real.
   Window → Rendering → Lighting → Generate Lighting. É a maior economia disponível.
2. **Occlusion Culling** — Window → Rendering → Occlusion Culling → Bake. Impede
   renderizar o que está atrás de prédios.
3. **LODs** — versões simplificadas dos modelos ao longe. Um inimigo a 500m não precisa
   de 20 mil triângulos.
4. **Compressão ASTC 6x6** nas texturas — padrão da Unity para Android moderno.
5. **Object pooling na bala** — em vez de `Instantiate`/`Destroy` a cada tiro, reaproveite
   objetos de uma pilha. Só vale a pena quando o Profiler mostrar picos de GC; num jogo de
   ferrolho (1 tiro a cada 1.6s) provavelmente não vai aparecer.

## Cuidado específico com a killcam

A killcam mexe em `Time.timeScale` **e** em `Time.fixedDeltaTime`. Se qualquer caminho
de código sair da cena sem restaurar os dois, o jogo inteiro fica em câmera lenta para
sempre — e o bug parece aleatório, porque só aparece se você trocar de cena no meio do efeito.

O `KillCam.cs` restaura no `OnDisable()` justamente por isso. Se você criar outros
efeitos de slow-motion, siga o mesmo padrão.

## iOS

Precisa de um Mac com Xcode. Rodar no *seu* iPhone é grátis (Apple ID comum); a conta
paga (US$ 99/ano) só entra para distribuir a outras pessoas. Caminho completo, incluindo
o que fazer sem Mac, em **[07-ios-iphone.md](07-ios-iphone.md)**.
