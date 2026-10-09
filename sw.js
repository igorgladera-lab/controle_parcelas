// sw.js — Service Worker do Valores Mãe
// Versão: 1.0
//
// Objetivo: permitir instalação como PWA no Android (o Chrome exige um
// Service Worker com fetch handler) e dar suporte básico a carregamento
// offline do "shell" da aplicação.
//
// Estratégia:
//  - NÃO faz cache do index.html (wrapper StatiCrypt) para evitar que a
//    versão encriptada antiga fique presa no cache.
//  - Faz cache apenas dos ícones e do manifest, que raramente mudam.
//  - Requisições de navegação vão sempre à rede; se falharem, tenta cache.

const CACHE = 'valores-mae-v1';
const ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ---------- INSTALL ----------
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      // addAll falha se algum recurso não existir; usamos add individual
      // com catch para não quebrar a instalação caso falte algum ícone.
      return Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch(() => {
            // ignora falhas individuais (ex: ícone ausente)
          })
        )
      );
    })
  );
});

// ---------- ACTIVATE ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---------- FETCH ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só tratamos GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Não mexer em requisições cross-origin
  if (url.origin !== self.location.origin) return;

  // Navegação (documento HTML): sempre rede primeiro.
  // Isso garante que a versão mais recente do wrapper StatiCrypt
  // seja sempre carregada. Se a rede falhar, cai para o cache
  // (útil apenas se o usuário tiver cache anterior).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Demais recursos (ícones, manifest): cache primeiro, rede como fallback.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // guarda cópia em cache se for resposta válida do mesmo origin
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});