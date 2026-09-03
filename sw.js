// Draaimolen '26 – offline cache. Cache-first for everything the app needs; refreshes in the background when online.
const VERSION = 'dm26-v1';
const CORE = ['./', './index.html', './icon.png', './apple-touch-icon.png', './manifest.webmanifest'];
const MAP = 'https://cdn.sanity.io/images/ow8hsen7/production/93f2b2ebc605e4849617efccdc46553082013734-1080x1350.png?w=1080&fit=max&auto=format&q=80';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(CORE);
    try { const r = await fetch(MAP, {mode: 'no-cors'}); await c.put(MAP, r); } catch (err) {}
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

// stale-while-revalidate: answer from cache at once, update the cache from the network when we can
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const ours = url.origin === self.location.origin || url.href.startsWith('https://cdn.sanity.io/');
  if (!ours) return;
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const cached = await c.match(req, {ignoreSearch: url.origin === self.location.origin});
    const net = fetch(req).then(r => { if (r && (r.ok ||
