// Offline support for the flyer canvassing tool.
//
// Scope is this file's own directory, /admin/canvass/, so nothing else on the
// site is ever served by this worker -- the public pages are untouched.
//
// There is no precache list: the build's filenames are hashed, and a manifest
// would have to be generated on every deploy. Instead the first online visit
// populates the caches with exactly what the page used. Offline works from the
// second visit onward, which is fine for a tool you open before heading out.
const V = 'gag-canvass-v1';
const SHELL = `${V}-shell`, DATA = `${V}-data`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL, DATA]);
    for (const k of await caches.keys()) {
      if (k.startsWith('gag-canvass-') && !keep.has(k)) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const fresh = fetch(request)
    .then((r) => {
      if (r.ok) cache.put(request, r.clone());
      return r;
    })
    .catch(() => null);
  return hit || (await fresh) || new Response('offline', { status: 503 });
}

const CACHEABLE = new Set(['script', 'style', 'font', 'image']);

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The sync API must always be live, and the basemap is fetched as byte
  // ranges that the Cache API cannot usefully store.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/tiles/')) return;

  if (url.pathname.startsWith('/canvass/')) {
    return e.respondWith(staleWhileRevalidate(request, DATA));
  }
  if (request.mode === 'navigate' || CACHEABLE.has(request.destination)) {
    return e.respondWith(staleWhileRevalidate(request, SHELL));
  }
});
