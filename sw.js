---
layout: none
---
// Each Pages build publishes a matching service worker and timestamped app shell.
const prefix = `kanji-practice:${self.registration.scope}:`;
const cacheName = `${prefix}{{ site.time | date: "%s" }}-{{ site.github.build_revision }}`;
const appShell = [
  './', './index.html', './style.css', './app.js', './data.js', './study.js',
  './manifest.webmanifest', './icons/jinchu-apple.png', './icons/jinchu-192.png', './icons/jinchu-512.png',
  './vendor/ts-fsrs.js',
  './browser.js', './curriculum.js', './kanji-reference.js',
  './art/war-camp.webp', './examples.js',
  './handwriting.js', './guided-practice.js',
  './reading-cue.js', './stroke-order.js',
  './progress-editor.js',
  './grade-vocabulary.js',
  ...Array.from({ length: 32 }, (_, index) => `./stroke-data/${index.toString(16).padStart(2, '0')}.json`),
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
