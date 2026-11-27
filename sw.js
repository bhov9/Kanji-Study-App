---
layout: none
---
// Each Pages build publishes a matching service worker and timestamped app shell.
const prefix = `kanji-practice:${self.registration.scope}:`;
const cacheName = `${prefix}{{ site.time | date: "%s" }}-{{ site.github.build_revision }}`;
const appShell = [
  './', './index.html', './style.css', './app.js', './data.js', './study.js',
  './manifest.webmanifest', './icons/jinchu-apple.png', './icons/jinchu-192.png', './icons/jinchu-512.png',
  './stroke-data/KANJIVG-LICENSE.txt', './licenses/CC-BY-SA-4.0.txt',
  './browser.js', './curriculum.js', './kanji-reference.js',
  './art/war-camp.webp', './examples.js',
  './handwriting.js', './guided-practice.js',
  './reading-cue.js', './stroke-order.js',
  './progress-editor.js',
  './feedback.js', './dictionary-readings.js', './reading-mappings.js',
  './grade-vocabulary.js', './word-details.js', './vocabulary.js', './dictionary.js', './dictionary-compounds.js', './section-plans.js', './official-examples.js',
  ...Array.from({ length: 32 }, (_, index) => `./stroke-data/${index.toString(16).padStart(2, '0')}.json`),
];
const home = new URL('./index.html', self.registration.scope).href;

// Keep the optional large cache independent of the study shell and its revision.
const dictionaryURL = new URL('./dictionary/3.6.2+20261123231529/', self.registration.scope).href;
const dictionaryCache = 'jmdict:' + dictionaryURL;
let saving;
async function saveDictionary() {
  const cache = await caches.open(dictionaryCache);
  const url = dictionaryURL + 'manifest.json';
  const previous = await cache.match(url);
  const manifest = previous ?? await fetch(url);
  if (!manifest.ok) throw new Error('Dictionary manifest unavailable');
  const {files} = await manifest.clone().json();
  const present = new Set((await cache.keys()).map(request => request.url));
  const missing = files.map(file => dictionaryURL + file).filter(path => !present.has(path));
  for (let i = 0; i < missing.length; i += 6) await cache.addAll(missing.slice(i,i+6));
  if (!previous) await cache.put(url,manifest);
}

self.addEventListener('message', event => {
  if (event.data !== 'save-dictionary') return;
  saving ??= saveDictionary().finally(() => { saving = null; });
  event.waitUntil(saving.then(() => event.source?.postMessage('dictionary-ready'),
    () => event.source?.postMessage('dictionary-incomplete')));
});

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
    const isDictionary = request.url.startsWith(dictionaryURL);
    const cache = await caches.open(isDictionary ? dictionaryCache : cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (isDictionary && response.ok) {
        try { await cache.put(request,response.clone()); } catch { /* Online lookup can proceed if storage is full. */ }
      }
      return response;
    } catch (error) {
      if (request.mode === 'navigate') return cache.match(home);
      throw error;
    }
  })());
});
