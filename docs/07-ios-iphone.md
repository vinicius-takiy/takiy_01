# 7. Jogar no iPhone

A regra que define tudo: **só um Mac compila para iOS.** O Xcode, ferramenta da Apple
que gera o app final, não existe para Windows nem Linux. Não há como contornar isso
oficialmente — só alternativas com custo.

Então o primeiro passo é responder: você tem Mac?

---

## Cenário A — Você tem Mac

Caminho limpo e **gratuito** para jogar no seu próprio iPhone.

### O que instalar
1. **Xcode** (App Store do Mac, ~12 GB, grátis)
2. Na Unity Hub: **Installs → ⚙ → Add Modules → iOS Build Support**

### Conta Apple
Não precisa pagar nada para rodar no *seu* aparelho. Um Apple ID comum basta, com
duas limitações:

| Limitação | Efeito prático |
|---|---|
| O app "expira" em 7 dias | Reinstalar pelo Xcode (1 minuto) |
| Máximo de 3 apps assim por vez | Irrelevante para um projeto |

A conta paga (**US$ 99/ano**) só se torna necessária para enviar a outras pessoas
via TestFlight ou publicar na App Store.

### Passo a passo do build
1. Unity: **File → Build Settings → iOS → Switch Platform**
2. **Player Settings → iOS**:

| Campo | Valor |
|---|---|
| Bundle Identifier | `com.seunome.snipermobile` |
| Target minimum iOS Version | 15.0 |
| Architecture | ARM64 |
| Requires Full Screen | ✅ |
| Default Orientation | Landscape Left |
| Graphics API | Metal (padrão, não mude) |

3. **Build** → escolha uma pasta → a Unity gera um **projeto Xcode**, não um app
4. Abra o `.xcodeproj` gerado no Xcode
5. Em **Signing & Capabilities**: marque `Automatically manage signing`, escolha seu
   Apple ID em Team
6. Conecte o iPhone por cabo, selecione-o no topo do Xcode, aperte **▶ Run**
7. No iPhone: **Ajustes → Geral → VPN e Gerenciamento de Dispositivo → confie no desenvolvedor**

Da segunda vez em diante você pode usar **Build And Run** direto da Unity, que
faz os passos 4–6 sozinho.

---

## Cenário B — Você tem PC Windows/Linux

Aqui é preciso ser direto: **você não vai conseguir compilar para o seu iPhone com o
que tem.** As opções, em ordem de recomendação:

### Opção 1 — Comprar um Android usado só para teste ⭐ recomendado
Um Android de entrada usado custa **R$ 300–600** e resolve o problema para sempre:
build em 3 minutos pelo cabo, Profiler real, APK compartilhável.

Para portfólio, ninguém vai perguntar em qual celular você testou. E o jogo vai
funcionar no iPhone depois quando você tiver acesso a um Mac — o código é o mesmo.

### Opção 2 — Unity Remote 5 no iPhone (só para desenvolvimento)
Funciona no Windows, **mas exige o iTunes instalado** (é ele que faz o driver USB
do iPhone). O jogo roda no PC e o iPhone vira tela e controle.

1. Instale o iTunes (versão da Apple, não da Microsoft Store)
2. Instale **Unity Remote 5** na App Store
3. Unity: **Edit → Project Settings → Editor → Unity Remote → Device: Any iOS Device**
4. Abra o app no iPhone com o cabo conectado, aperte **Play** no editor

Serve para ajustar mira, botões e pinça. Não serve para nada que envolva desempenho
ou o app instalado de verdade.

### Opção 3 — Alugar um Mac na nuvem
Serviços como **MacinCloud** ou **MacStadium** alugam um Mac remoto por hora ou mês
(a partir de ~US$ 20–30/mês). Você exporta o projeto Xcode no Windows (a Unity faz
isso normalmente), envia para o Mac remoto, compila lá e instala via cabo… no
aparelho que está do lado do Mac remoto. **Ou seja: não instala no seu iPhone.**
Só faz sentido combinado com uma conta paga + TestFlight, que instala pela internet.

### Opção 4 — Unity Build Automation (nuvem da Unity)
Compila iOS na nuvem sem Mac. Exige conta Apple Developer paga (US$ 99/ano) para
os certificados, e o serviço em si é cobrado por minuto de build (confira o plano
atual, muda com frequência). Distribuição para o seu aparelho via TestFlight.

**Custo total do caminho sem Mac para rodar no seu iPhone: ~US$ 99/ano + build na
nuvem.** Contra R$ 400 de um Android usado, uma vez. A conta não fecha para portfólio.

---

## O que o iPhone exige no código (e o Android não)

### Safe Area — obrigatório
Em paisagem, o **notch / Dynamic Island** fica exatamente onde estariam os botões da
esquerda, e a **barra do gesto de home** rouba a parte de baixo. Botão embaixo do notch
= toque que não funciona = rejeição na revisão da App Store.

Solução já no repositório: `UI/SafeAreaFitter.cs`.

1. No Canvas, crie um painel vazio **`SafeArea`**, anchors esticados (0,0 → 1,1)
2. Adicione **SafeAreaFitter** nele
3. Coloque **toda a UI** (HUD, controles, painel de resultado) como filha do `SafeArea`

Teste no Editor: **Game view → aspecto "iPhone 15 Pro (2556x1179)"** e use o
**Device Simulator** (Window → General → Device Simulator) para ver o notch.

### Outras diferenças que aparecem na hora do build

| Item | O que fazer |
|---|---|
| Vibração no tiro | `Handheld.Vibrate()` funciona; para haptics finos, precisa de plugin |
| Áudio quando o celular está no silencioso | iOS silencia o jogo por padrão. É esperado, não é bug |
| Texturas | ASTC também, igual ao Android |
| Ícone | Precisa de todos os tamanhos; a Unity gera a partir de um 1024×1024 |
| Privacidade | Sem coleta de dados = declaração simples no App Store Connect |

---

## Resumo executivo

| Sua situação | Faça isto |
|---|---|
| Tenho Mac | Xcode grátis + Apple ID grátis → roda no iPhone hoje, custo zero |
| Tenho Windows e quero testar já | Unity Remote 5 + iTunes para o toque; compre um Android usado para o build real |
| Tenho Windows e quero publicar para iOS | Não agora. Termine o jogo no Android, e o build iOS vira um problema de 1 dia quando houver um Mac |
