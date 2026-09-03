// Draaimolen '26 – offline cache.
// Navigations: network first (fresh page when online), cache when offline. Everything else: cache first, refreshed in the background.
const VERSION = 'dm26-v2';
const CORE = ['./', './index.html', './icon.png', './apple-touch-icon.png', './manifest.webmanifest'];
const MAP = 'https://cdn.sanity.io/images/ow8hsen7/production/93f2b2ebc605e4849617efccdc46553082013734-1080x1350.png?w=1080&fit=max&auto=format&q=80';
const ours = url => url.origin === self.location.origin || url.href.startsWith('https://cdn.sanity.io/');

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    // cache each file on its own so one slow/failed file never blocks offline support for the rest
    await Promise.allSettled(CORE.map(u => c.add(u)));
    try { const r = await fetch(MAP, {mode: 'cors'}); if (r.ok) await c.put(MAP, r); } catch (err) {}
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (!ours(url)) return;
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const same = url.origin === self.location.origin;
    const good = r => r && (r.ok || r.type === 'opaque');
    if (req.mode === 'navigate') {
      // fresh page if the network answers within 3s, otherwise the cached one
      const r = await withTimeout(fetch(req).catch(() => null), 3000);
      if (good(r)) { c.put('./', r.clone()); return r; }
      return (await c.match('./')) || (await c.match(req, {ignoreSearch: true})) || new Response('Offline and not cached yet', {status: 503});
    }
    const cached = await c.match(req, {ignoreSearch: same});
    const net = fetch(req).then(r => { if (good(r)) c.put(req, r.clone()); return r; }).catch(() => null);
    if (cached) { e.waitUntil(net); return cached; }
    const r = await net; if (r) return r;
    return new Response('', {status: 504});
  })());
});
