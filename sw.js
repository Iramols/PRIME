// Service worker: laat PRIME ook zonder internet openen, met de laatst
// bewaarde versie. CACHE_NAME wordt door tools/bump-build.js elke push
// herschreven naar de nieuwe build -- zo krijgt elke push een verse,
// eigen cache-naam en ruimt activate() de vorige(n) automatisch op. Geen
// vaste lijst bestanden vooraf cachen (fragile bij dit soort losse-bestanden-
// zonder-bundelaar-app): alles wat de app opvraagt wordt onderweg bewaard.
const CACHE_NAME = 'prime-cache-20260925-1601';
// Foto's (maaltijden/training, uit Supabase Storage) staan in een eigen,
// vaste cache-naam -- die blijft, in tegenstelling tot CACHE_NAME hierboven,
// gewoon staan bij elke nieuwe build/push. Anders zou elke push (soms meerdere
// per dag) alle al-bewaarde foto's weer weggooien, terwijl foto's zelf niet
// per build wijzigen.
const PHOTO_CACHE_NAME = 'prime-photos-cache';

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME && k !== PHOTO_CACHE_NAME; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); }).then(function () {
      // De allereerste keer dat deze service worker actief wordt, kan hij
      // de navigatie-aanvraag die hem heeft geregistreerd nooit zelf hebben
      // onderschept (die was al onderweg vóórdat hij bestond) -- zonder dit
      // stond er dus pas na een TWEEDE keer laden iets in de cache, en zag
      // je bij de eerste offline-poging alsnog de foutpagina van de browser.
      // Cache de pagina hier daarom meteen zelf.
      return caches.open(CACHE_NAME).then(function (c) {
        return fetch('./', { cache: 'no-store' }).then(function (res) {
          if (res && res.ok) return c.put('./', res);
        }).catch(function () {});
      });
    })
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

  // Supabase (inloggen, database, alles behalve foto's) nooit aanraken --
  // dat moet altijd vers van de server komen. Foto's uit de 'prime-photos'-
  // opslag zijn hierop de uitzondering: dat zijn losse plaatjes, net als een
  // lettertype, en geen live gegevens -- die cachen we dus wél (zie
  // PHOTO_CACHE_NAME hieronder), zodat een eenmaal geziene maaltijd- of
  // trainingsfoto ook zonder internet zichtbaar blijft.
  const eigenOrigin = url.origin === location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const isFoto = url.hostname === 'thxknfjjcxuiktrehjyg.supabase.co' && url.pathname.indexOf('/storage/v1/object/public/prime-photos/') === 0;
  if (!eigenOrigin && !isFont && !isFoto) return;

  if (isFoto) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (res) {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(PHOTO_CACHE_NAME).then(function (c) { c.put(req, copy); });
          }
          return res;
        }).catch(function () { return cached; });
      })
    );
    return;
  }

  // De pagina zelf (navigatie, bv. het openen/herladen van index.html):
  // netwerk-eerst, met de laatst gecachete versie als vangnet zonder
  // internet. Zo krijgt een online bezoeker altijd de verse pagina (met het
  // actuele PRIME_BUILD), en pas zonder internet de bewaarde versie.
  if (req.mode === 'navigate') {
    event.respondWith(
      // cache: 'no-store' -- anders volgt deze fetch() gewoon de normale
      // HTTP-cache van de browser (GitHub Pages stuurt max-age=600 mee), en
      // zou een bezoek van vlak vóór een push soms nog de vorige versie
      // laten zien terwijl je "gewoon" internet had.
      fetch(req, { cache: 'no-store' }).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        // ignoreSearch: de bewaarde pagina staat onder de URL zoals hij
        // toen precies is opgehaald (vaak met een ?b=<build>-parameter van
        // het zelf-ververs-mechanisme erbij). Een latere, kale herlaad-
        // aanvraag zonder die parameter moet 'm alsnog vinden, anders werkt
        // dit vangnet alleen toevallig als de querystring exact overeenkomt.
        return caches.match(req, { ignoreSearch: true }).then(function (cached) {
          return cached || caches.match('./index.html', { ignoreSearch: true });
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
