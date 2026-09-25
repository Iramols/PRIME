// Service worker: laat PRIME ook zonder internet openen, met de laatst
// bewaarde versie. CACHE_NAME wordt door tools/bump-build.js elke push
// herschreven naar de nieuwe build -- zo krijgt elke push een verse,
// eigen cache-naam en ruimt activate() de vorige(n) automatisch op. Geen
// vaste lijst bestanden vooraf cachen (fragile bij dit soort losse-bestanden-
// zonder-bundelaar-app): alles wat de app opvraagt wordt onderweg bewaard.
const CACHE_NAME = 'prime-cache-20260925-0935';

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return; // POST/PUT/DELETE (o.a. alles naar Supabase) altijd gewoon doorlaten

  const url = new URL(req.url);

  // version.json drijft het zelf-ververs-mechanisme (zie index.html) en moet
  // dus altijd naar het net -- nooit uit de cache, anders ziet een geopende
  // pagina een update nooit meer.
  if (url.pathname.endsWith('/version.json')) return;

  // Supabase (en andere externe API's) nooit aanraken -- alleen de eigen
  // statische bestanden (HTML/CSS/JS/iconen) en lettertypen cachen.
  const eigenOrigin = url.origin === location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!eigenOrigin && !isFont) return;

  // De pagina zelf (navigatie, bv. het openen/herladen van index.html):
  // netwerk-eerst, met de laatst gecachete versie als vangnet zonder
  // internet. Zo krijgt een online bezoeker altijd de verse pagina (met het
  // actuele PRIME_BUILD), en pas zonder internet de bewaarde versie.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Statische bestanden (css/js/iconen/lettertypen): cache-eerst. Elke build
  // heeft z'n eigen ?v=-parameter in de bestandsnaam, dus een gecachete URL
  // hoort altijd bij precies die ene versie -- geen risico op een oude js-
  // of css-versie die per ongeluk voor een nieuwe build wordt hergebruikt.
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        // Nog nooit opgehaald én geen internet: hier kan de service worker
        // niets aan doen (bv. een nieuw icoon dat nog nooit geladen is).
        return cached;
      });
    })
  );
});
