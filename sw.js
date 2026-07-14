// ============================================================
//   SERVICE WORKER (PWA)
//   Стратегии:
//   - /api/*            — только сеть (не кэшируем ответы AI)
//   - навигация (HTML)  — сеть, при офлайне — кэш
//   - статика и CDN     — кэш, при промахе — сеть с докэшированием
//
//   При изменении статики увеличь версию CACHE_NAME,
//   чтобы у пользователей обновился кэш.
// ============================================================

const CACHE_NAME = 'sasholom-v6';

const PRECACHE = [
  '/',
  '/index.html',
  '/rebbe.html',
  '/style.css?v=3',
  '/script.js?v=3',
  '/rebbe.js?v=1',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
];

// CDN-хосты, чьи ответы кэшируем на лету (иконки, markdown, подсветка, pdf.js)
const RUNTIME_CACHE_HOSTS = [
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// Удаляем кэши старых версий
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Кэшируем только GET; запросы к AI всегда идут в сеть
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  // Навигация: сначала сеть (свежий HTML), офлайн — запрошенная страница
  // из кэша, а если её там нет — главная как запасной вариант
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/index.html'))
      )
    );
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;
  const isCdn = RUNTIME_CACHE_HOSTS.includes(url.hostname);
  if (!isSameOrigin && !isCdn) return;

  // Статика: кэш → сеть с сохранением в кэш
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
