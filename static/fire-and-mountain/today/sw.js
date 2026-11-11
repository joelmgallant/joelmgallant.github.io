// Service worker for /fire-and-mountain/today/ only (its scope is this folder).
// Code and data are network-first (revalidated, so a deploy shows up on the next load) with the cache as the
// offline fallback; images are cache-first and refresh in the background. Also shows push nudges.
// Bump VERSION on every deploy that changes these files, so installed apps swap to the new worker and reload.
const VERSION = 'today-v8';
const NETWORK_TIMEOUT_MS = 4000;

const IMAGE_NAMES = [
  'moon-new', 'moon-waxing-crescent', 'moon-first-quarter', 'moon-waxing-gibbous', 'moon-full',
  'moon-waning-gibbous', 'moon-last-quarter', 'moon-waning-crescent',
  'stone-ruby', 'stone-onyx', 'stone-pearl', 'stone-diamonds-stacked', 'stone-diamond',
  'element-earth', 'element-fire', 'element-water', 'element-wind', 'element-heart',
  'emblem-fire-tiger', 'emblem-cabin', 'emblem-wood-rat', 'emblem-shore',
  'mood-mischief', 'mood-rest', 'mood-courage', 'mood-crossing', 'mood-feast', 'mood-focus', 'mood-wonder',
  'mood-homecoming', 'mood-celebration', 'mood-patience', 'mood-spark', 'mood-release',
];

const SHELL = [
  './', 'today.css', 'today.js', 'today-core.mjs', 'update.js', 'manifest.webmanifest',
  'exchange.css', 'exchange.js', 'exchange-core.mjs', 'exchange-api.mjs', 'exchange-sounds.mjs', 'exchange-ui.mjs', 'exchange-composer.mjs', 'exchange-join.mjs', 'exchange-recorder.mjs',
  'push-client.mjs', 'push-core.mjs',
  'game.css', 'game.js', 'game-core.mjs', 'game-answer.mjs', 'game-reveal.mjs',
  'icons/icon-192.png', 'icons/icon-512.png',
  '/fire-and-mountain/shared.css', '/fire-and-mountain/sky.js', '/fire-and-mountain/tarot-links.json',
  ...IMAGE_NAMES.map((name) => `img/${name}.webp`),
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })));
    // Day files are cached only as the page fetches them, so future readings never land on the device.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== VERSION).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

const isImage = (url) => /\/(img|icons)\//.test(url.pathname);

async function networkFirst(event, cache) {
  const network = fetch(event.request, { cache: 'no-cache' }).then((response) => {
    if (response.ok) cache.put(event.request, response.clone());
    return response;
  });
  event.waitUntil(network.catch(() => undefined));
  const timeout = new Promise((resolve) => { setTimeout(resolve, NETWORK_TIMEOUT_MS, null); });
  try {
    const response = await Promise.race([network, timeout]);
    if (response) return response;
  } catch { /* offline: fall back to the cache */ }
  return (await cache.match(event.request, { ignoreSearch: true })) ?? network;
}

async function cacheFirst(event, cache) {
  const cached = await cache.match(event.request, { ignoreSearch: true });
  const network = fetch(event.request).then((response) => {
    if (response.ok) cache.put(event.request, response.clone());
    return response;
  });
  if (!cached) return network;
  event.waitUntil(network.catch(() => undefined));
  return cached;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(caches.open(VERSION).then((cache) => (isImage(url) ? cacheFirst(event, cache) : networkFirst(event, cache))));
});

// Push: the exchange Lambda sends { title, body, url, tag } when it's this person's move.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { /* not JSON: show the generic nudge */ }
  event.waitUntil(self.registration.showNotification(data.title ?? 'Fire & Mountain', {
    body: data.body ?? "It's your move.", tag: data.tag, icon: 'icons/icon-192.png', data: { url: data.url ?? './' },
  }));
});

// Tapping a nudge focuses the open app (it refreshes itself on focus) or opens the today page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? './', self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find((client) => client.url.startsWith(self.registration.scope));
    return open ? open.focus() : self.clients.openWindow(target);
  })());
});
