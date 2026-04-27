const SHELL_CACHE = 'ege-shell-v1.0.0';
const DYNAMIC_CACHE = 'ege-dynamic-v1.0.0';
const APP_SHELL = [
  '/',
  '/index.html',
  '/assets/app.css',
  '/assets/app.js',
  '/manifest.json',
  '/data/content.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/assets/diagrams/friction_incline.svg',
  '/assets/diagrams/work_angle.svg',
  '/assets/diagrams/coulomb.svg',
  '/assets/diagrams/series.svg',
  '/assets/diagrams/parallel.svg',
  '/assets/diagrams/lens_convex.svg',
  '/assets/diagrams/lens_concave.svg',
  '/assets/diagrams/diffraction.svg',
  '/assets/diagrams/pendulum.svg',
  '/assets/diagrams/spring.svg',
  '/assets/diagrams/ampere.svg'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => ![SHELL_CACHE, DYNAMIC_CACHE].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== location.origin) return;
  if(req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(DYNAMIC_CACHE).then(cache => cache.put('/index.html', copy));
      return res;
    }).catch(() => caches.match('/index.html')));
    return;
  }
  if(url.pathname.startsWith('/data/tasks/') || url.pathname.startsWith('/assets/ege_')) {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => {
      if(res.ok) caches.open(DYNAMIC_CACHE).then(cache => cache.put(req, res.clone()));
      return res;
    }).catch(() => cached || new Response('', {status: 404}))));
    return;
  }
  event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => {
    if(res.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/data/') || url.pathname.startsWith('/icons/'))) {
      caches.open(DYNAMIC_CACHE).then(cache => cache.put(req, res.clone()));
    }
    return res;
  }).catch(() => caches.match('/index.html'))));
});
