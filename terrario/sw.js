// Cache-first com versão no nome. O jogo é estático e pesa ~700 KB por causa do
// three.js: depois da primeira visita, abre sem rede.
const VERSAO = 'terrario-v1';
const ARQUIVOS = [
  './', './index.html', './manifest.webmanifest',
  './vendor/three.module.min.js',
  './src/main.js', './src/sim.js', './src/mundo.js', './src/agentes.js',
  './src/tribos.js', './src/render.js', './src/camera.js', './src/ui.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (ev) => {
  if (ev.request.method !== 'GET') return;
  ev.respondWith(
    caches.match(ev.request).then((hit) => hit || fetch(ev.request).then((res) => {
      if (res.ok && new URL(ev.request.url).origin === location.origin) {
        const copia = res.clone();
        caches.open(VERSAO).then((c) => c.put(ev.request, copia));
      }
      return res;
    }).catch(() => caches.match('./index.html'))),
  );
});
