// Service worker for /fire-and-mountain/today/ only (its scope is this folder).
// Stale-while-revalidate: show the cached copy instantly, refresh it in the background.
// Bump VERSION on every deploy that changes these files.
const VERSION = 'today-v2';

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
  './', 'today.css', 'today.js', 'today-core.mjs', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png',
  '/fire-and-mountain/shared.css', '/fire-and-mountain/sky.js', '/fire-and-mountain/tarot-links.json',
  ...IMAGE_NAMES.map((name) => `img/${name}.webp`),
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(request, { ignoreSearch: true });
    const network = fetch(request).then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    });
    if (cached) {
      event.waitUntil(network.catch(() => undefined));
      return cached;
    }
    return network;
  })());
});
