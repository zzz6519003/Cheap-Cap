const CACHE_NAME = 'qingpai-pwa-v3';
const PRECACHE_FILES = null;

async function updateCache(request) {
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, copy);
  }
  return response;
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_FILES || ['./', './manifest.json', './icons/icon-192.png', './icons/icon-512.png']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match(event.request) || await caches.match('./index.html') || await caches.match('./');
      if (cached) {
        event.waitUntil(updateCache(event.request).catch(() => undefined));
        return cached;
      }
      return updateCache(event.request);
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) {
      event.waitUntil(updateCache(event.request).catch(() => undefined));
      return cached;
    }
    return updateCache(event.request);
  })());
});
