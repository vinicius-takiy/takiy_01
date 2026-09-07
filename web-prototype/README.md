# Protótipo web (Three.js)

Um único arquivo, `index.html`, sem build e sem instalação. Prova de que o gênero
roda no iPhone via Safari sem Mac, Xcode ou conta Apple.

## O jogo

Uma avenida vista do telhado. Três contratos em sequência, cada um com **um alvo
específico** descrito num dossiê, civis andando na mesma calçada, uma janela de
tempo até o alvo fugir e uma regra própria:

| Contrato | Distância | O que ensina |
|---|---|---|
| O Contador | ≈ 240 m | Identificar o alvo entre civis parecidos; atirar quando ele para |
| A Mensageira | ≈ 360 m | Vento de través; um decoy com o mesmo casaco na rua |
| O Chefe | ≈ 540 m | Colete: só cabeça mata; seguranças correm com ele se alertados |

**Onde atirar:** cabeça ou torso matam; braço e perna só ferem e o alvo corre.
O Chefe usa colete, só a cabeça resolve. A tela mostra a queda em centímetros:
mire essa altura acima do ponto desejado.

Errar o tiro espanta a rua e o alvo corre para o ponto de fuga. Acertar um civil
cancela o contrato. Acertar um segurança custa pontos. No Fácil e no Normal uma
seta na borda da luneta aponta para o alvo quando ele está fora de vista.

## Controles de uma mão

- Arraste em qualquer lugar da tela para mirar (sensibilidade dividida pelo zoom)
- **Segure ATIRAR** para prender o fôlego, **solte** para disparar, deslize o dedo
  para fora do botão para cancelar
- Slider vertical à direita ou pinça para o zoom (6× a 24×)
- Toque no nome do contrato ou em **Dossiê** para pausar e reler a descrição

## Rodar

- **Local:** abra `index.html` no navegador do PC. Mouse arrasta a mira,
  `Espaço` atira, `E` liga a luneta, `Z` troca o zoom, `Shift` prende o fôlego.
- **No iPhone, na mesma rede Wi-Fi:** na pasta, rode `npx http-server -p 8080`
  e abra `http://IP-DO-PC:8080` no Safari. Depois **Compartilhar → Adicionar à
  Tela de Início** para tirar a barra do navegador.
- **Publicar:** GitHub Pages, Netlify Drop ou Vercel — arraste a pasta e pronto.

## O que está implementado

Os mesmos sistemas do scaffold Unity, em JavaScript:

| Sistema | Onde no arquivo |
|---|---|
| Perfis de dificuldade (mesma tabela) | `PROFILES` |
| Bala integrada à mão + raycast no segmento | `stepBullets()` |
| Assistência de mira por raio | `aimAssist()` |
| Luneta, zoom, respiração, balanço | `updateBreath()`, `updateSway()` |
| Retículo mildot calibrado (1 mil real, escala com o zoom) | `<g id="mil">` + `unitsPerMil` |
| Vento com bandeiras que reagem | `updateWind()` |
| Alvos com cabeça 5×, torso 1×, membro 0,5× | `makeTarget()` |
| Killcam por proximidade | `updateKillcam()` |
| Contratos, dossiê, janela de fuga, pânico da rua | `CONTRACTS`, `updateNpcs()`, `endContract()` |

## Limitações do Safari no iPhone que o código já contorna

| Limitação | Solução no arquivo |
|---|---|
| Não trava orientação | Overlay "Gire o celular" via `@media (orientation: portrait)` |
| Pinça dá zoom na página | `touch-action: none` + `preventDefault` nos toques |
| Não há vibração (`navigator.vibrate`) | Marcador de acerto visual no lugar |
| Barra do navegador rouba altura | `viewport-fit=cover` + `env(safe-area-inset-*)` + PWA na Tela de Início |
| Áudio só depois de um toque | Protótipo é mudo; som entra ligado ao botão Iniciar |
