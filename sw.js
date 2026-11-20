// Increment the revision whenever a deployed app-shell file changes.
const prefix = `kanji-practice:${self.registration.scope}:`;
const cacheName = `${prefix}3`;
const appShell = [
  './', './index.html', './style.css', './app.js', './data.js', './study.js',
  './manifest.webmanifest', './icons/apple.png', './icons/app-192.png', './icons/app-512.png',
  './vendor/ts-fsrs.js',
  './browser.js', './curriculum.js', './kanji-reference.js',
];
const home = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll(appShell.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(prefix) && key !== cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      return await fetch(request);
    } catch (error) {
      if (request.mode === 'navigate') return cache.match(home);
      throw error;
    }
  })());
});
