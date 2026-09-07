# Protótipo web (Three.js)

Um único arquivo, `index.html`, sem build e sem instalação. Prova de que o gênero
roda no iPhone via Safari sem Mac, Xcode ou conta Apple.

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
| Missão, tempo, estrelas | `start()`, `finish()` |

## Limitações do Safari no iPhone que o código já contorna

| Limitação | Solução no arquivo |
|---|---|
| Não trava orientação | Overlay "Gire o celular" via `@media (orientation: portrait)` |
| Pinça dá zoom na página | `touch-action: none` + `preventDefault` nos toques |
| Não há vibração (`navigator.vibrate`) | Marcador de acerto visual no lugar |
| Barra do navegador rouba altura | `viewport-fit=cover` + `env(safe-area-inset-*)` + PWA na Tela de Início |
| Áudio só depois de um toque | Protótipo é mudo; som entra ligado ao botão Iniciar |
