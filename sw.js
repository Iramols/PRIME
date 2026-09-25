// Service worker: laat PRIME ook zonder internet openen, met de laatst
// bewaarde versie. Geen vaste lijst bestanden vooraf cachen (fragile bij dit
// soort losse-bestanden-zonder-bundelaar-app): alles wat de app opvraagt
// wordt onderweg bewaard.
//
// CACHE_NAME is bewust een VASTE naam, niet gekoppeld aan het buildnummer.
// (tools/bump-build.js raakt dit bestand dan ook niet aan.) Wisselde deze
// naam elke push mee, dan moest de browser na ELKE push (ook eentje die
// niets met offline te maken had) een hele nieuwe service-worker-cyclus
// doorlopen (installeren, activeren, de pagina zelf opnieuw cachen) voordat
// offline weer betrouwbaar werkte -- bij snel na elkaar pushen (vaak meerdere
// keren per dag) was die cyclus soms nog niet klaar tijdens het testen. Een
// stabiele naam voorkomt dat: de al actieve service worker blijft gewoon
// draaien met zijn opgewarmde cache, en werkt de navigatie-pagina bij elk
// online bezoek gewoon bij (zie de fetch-handler hieronder). Bump dit getal
// met de hand (v1 -> v2) alleen als je bewust wilt dat iedereen een keer een
// volledig verse cache krijgt.
const CACHE_NAME = 'prime-cache-v1';
// Foto's (maaltijden/training, uit Supabase Storage) staan in een eigen,
// vaste cache-naam -- die blijft, in tegenstelling tot CACHE_NAME hierboven,
// gewoon staan bij elke nieuwe build/push. Anders zou elke push (soms meerdere
// per dag) alle al-bewaarde foto's weer weggooien, terwijl foto's zelf niet
// per build wijzigen.
const PHOTO_CACHE_NAME = 'prime-photos-cache';

// Een gewone fetch() zonder internet kan, afhankelijk van het besturings-
// systeem/netwerkstack, een hele tijd (soms 10-30+ sec.) blijven hangen
// voordat hij daadwerkelijk als mislukt wordt gezien. Zonder tijdslimiet
// zou "zonder internet openen" dus wel via het cache-vangnet lukken, maar
// pas na die hele wachttijd -- dat voelt hetzelfde aan als vastlopen. Elke
// fetch() in dit bestand loopt daarom via deze helper.
function fetchMetTijdslimiet(request, opties, ms) {
  return Promise.race([
    fetch(request, opties),
    new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error('fetch-tijdslimiet overschreden')); }, ms);
    })
  ]);
}

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
        return fetchMetTijdslimiet('./', { cache: 'no-store' }, 3000).then(function (res) {
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
  // dat moet altijd vers van de server komen. Foto's zijn hierop de
  // uitzondering: dat zijn losse plaatjes, net als een lettertype, en geen
  // live gegevens -- die cachen we dus wél (zie PHOTO_CACHE_NAME hieronder),
  // zodat een eenmaal geziene maaltijd- of trainingsfoto ook zonder internet
  // zichtbaar blijft. Twee bronnen: eigen Supabase Storage-opslag
  // ('prime-photos', voor door de coach geüploade foto's) én
  // images.pexels.com (de standaard-foto's bij tientallen producten/
  // oefeningen in data.js en custom-photos.json -- zonder dit stonden
  // Voeding en Training zonder internet dus grotendeels zonder foto's).
  const eigenOrigin = url.origin === location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const isFoto = (url.hostname === 'thxknfjjcxuiktrehjyg.supabase.co' && url.pathname.indexOf('/storage/v1/object/public/prime-photos/') === 0)
    || url.hostname === 'images.pexels.com';
  if (!eigenOrigin && !isFont && !isFoto) return;

  if (isFoto) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetchMetTijdslimiet(req, {}, 3000).then(function (res) {
          // Een gewone <img src="..."> naar een ander domein (images.pexels.com)
          // gaat zonder 'crossorigin'-attribuut in no-cors-modus, en dat
          // levert een "opaque" Response op: die heeft altijd status 0 en
          // res.ok === false, ook als de foto prima is opgehaald -- res.ok
          // controleren zou zulke foto's dus NOOIT cachen. Cachen zodra de
          // fetch zelf niet is mislukt (res bestaat) is voor dit soort
          // externe plaatjes het best haalbare.
          if (res) {
            const copy = res.clone();
            caches.open(PHOTO_CACHE_NAME).then(function (c) { c.put(req, copy); });
          }
          return res;
        }).catch(function () { return cached || new Response('', { status: 504, statusText: 'Offline' }); });
      })
    );
    return;
  }

  // De pagina zelf (navigatie, bv. het openen/herladen van index.html):
  // netwerk-eerst, met de laatst gecachete versie als vangnet zonder
  // internet. Zo krijgt een online bezoeker altijd de verse pagina (met het
  // actuele PRIME_BUILD), en pas zonder internet de bewaarde versie.
  if (req.mode === 'navigate') {
    event.respondWith((async function () {
      // respondWith() MOET altijd een geldige Response krijgen -- lukt dat
      // hieronder om wat voor reden dan ook nergens, dan geeft
      // offlineFallbackPage() (helemaal onderaan) alsnog een zelfgemaakte,
      // nette PRIME-pagina terug i.p.v. dat de browser zijn eigen kale
      // "site niet bereikbaar"-foutpagina toont.
      try {
        // cache: 'no-store' -- anders volgt deze fetch() gewoon de normale
        // HTTP-cache van de browser (GitHub Pages stuurt max-age=600 mee), en
        // zou een bezoek van vlak vóór een push soms nog de vorige versie
        // laten zien terwijl je "gewoon" internet had.
        const res = await fetchMetTijdslimiet(req, { cache: 'no-store' }, 3000);
        const copy = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        return res;
      } catch (e) {
        try {
          // ignoreSearch: de bewaarde pagina staat onder de URL zoals hij
          // toen precies is opgehaald (vaak met een ?b=<build>-parameter van
          // het zelf-ververs-mechanisme erbij). Een latere, kale herlaad-
          // aanvraag zonder die parameter moet 'm alsnog vinden, anders werkt
          // dit vangnet alleen toevallig als de querystring exact overeenkomt.
          const cached = await caches.match(req, { ignoreSearch: true });
          if (cached) return cached;
          const cachedIndex = await caches.match('./index.html', { ignoreSearch: true });
          if (cachedIndex) return cachedIndex;
        } catch (e2) {}
        return offlineFallbackPage();
      }
    })());
    return;
  }

  // Statische bestanden (css/js/iconen/lettertypen): cache-eerst. Elke build
  // heeft z'n eigen ?v=-parameter in de bestandsnaam, dus een gecachete URL
  // hoort altijd bij precies die ene versie -- geen risico op een oude js-
  // of css-versie die per ongeluk voor een nieuwe build wordt hergebruikt.
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetchMetTijdslimiet(req, {}, 3000).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        // Nog nooit opgehaald én geen internet: hier kan de service worker
        // niets aan doen (bv. een nieuw icoon dat nog nooit geladen is). Een
        // geldige (lege) Response i.p.v. undefined -- anders laat ook een
        // los sub-bestand respondWith() zonder Response komen te zitten.
        return cached || new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});

// Zelfgemaakte, minimale pagina (geen externe lettertypen/stijlen nodig --
// die kunnen zelf ook net ontbreken) voor het geval een navigatie-aanvraag
// zonder internet ECHT nergens iets gecachet vindt (bv. dit toestel heeft
// PRIME nog nooit met internet geopend). Puur een nette uitleg i.p.v. de
// kale foutpagina van de browser zelf.
function offlineFallbackPage() {
  const html = '<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>PRIME by Anneke</title>' +
    '<style>' +
    'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:#f5f0e8;color:#2a2a2a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;padding:20px;box-sizing:border-box}' +
    '.card{background:#fff;border-radius:14px;box-shadow:0 2px 16px rgba(0,0,0,0.08);padding:32px 28px;max-width:380px;text-align:center}' +
    'h1{font-size:20px;margin:0 0 12px;color:#4a7c59}' +
    'p{font-size:14px;line-height:1.6;color:#6b6b6b;margin:0 0 20px}' +
    'button{background:#4a7c59;color:#fff;border:none;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:600;cursor:pointer}' +
    '</style></head><body>' +
    '<div class="card">' +
    '<h1>PRIME</h1>' +
    '<p>Geen verbinding, en dit toestel heeft nog geen eerdere versie van PRIME bewaard. ' +
    'Open PRIME eerst een keer met internet, en probeer het daarna opnieuw zonder internet.</p>' +
    '<button onclick="location.reload()">Opnieuw proberen</button>' +
    '</div></body></html>';
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
