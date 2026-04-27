const SHELL_CACHE = 'ege-shell-v7.0.0';
const DYNAMIC_CACHE = 'ege-dynamic-v7.0.0';
const APP_SHELL = [
  '/',
  '/index.html',
  '/assets/app.css?v=7.0.0',
  '/assets/app.js?v=7.0.0',
  '/manifest.json',
  '/data/content.json?v=7.0.0',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/assets/diagrams/ampere.svg',
  '/assets/diagrams/coulomb.svg',
  '/assets/diagrams/diffraction.svg',
  '/assets/diagrams/friction_incline.svg',
  '/assets/diagrams/lens_concave.svg',
  '/assets/diagrams/lens_convex.svg',
  '/assets/diagrams/math/circle_elements.svg',
  '/assets/diagrams/math/combinatorics.svg',
  '/assets/diagrams/math/cube.svg',
  '/assets/diagrams/math/derivative_tangent.svg',
  '/assets/diagrams/math/logarithm.svg',
  '/assets/diagrams/math/number_theory.svg',
  '/assets/diagrams/math/parallelogram.svg',
  '/assets/diagrams/math/powers_roots.svg',
  '/assets/diagrams/math/probability_scheme.svg',
  '/assets/diagrams/math/progression.svg',
  '/assets/diagrams/math/pyramid.svg',
  '/assets/diagrams/math/quadratic_parabola.svg',
  '/assets/diagrams/math/rhombus.svg',
  '/assets/diagrams/math/right_triangle.svg',
  '/assets/diagrams/math/solids.svg',
  '/assets/diagrams/math/trapezoid.svg',
  '/assets/diagrams/math/triangle_area.svg',
  '/assets/diagrams/math/unit_circle.svg',
  '/assets/diagrams/math/vectors_plane.svg',
  '/assets/diagrams/parallel.svg',
  '/assets/diagrams/pendulum.svg',
  '/assets/diagrams/series.svg',
  '/assets/diagrams/spring.svg',
  '/assets/diagrams/work_angle.svg'
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
