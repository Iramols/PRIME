// ========== SUPABASE CLOUD SYNC ==========
// localStorage blijft de snelle lees-cache voor de rest van de app
// (state.js leest nog steeds gewoon uit localStorage); dit bestand is
// de enige plek die met Supabase praat. Bij inloggen wordt de data van
// de actieve klant hierheen gekopieerd (hydrateFromCloud), en elke
// schrijfactie gaat voortaan via syncSet() i.p.v. rechtstreeks
// localStorage.setItem(), zodat lokaal en cloud gelijk blijven.

const SUPABASE_URL = 'https://thxknfjjcxuiktrehjyg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9HrqUSQL_kQ_rBJCHDm44w_24g7HB7U';

// De prime_*-sleutels die naar de cloud gesynchroniseerd worden.
// prime_custom_photos blijft bewust lokaal (gedeelde coach-content, niet klant-specifiek).
const CLOUD_KEYS = [
  'prime_profile',
  'prime_history',
  'prime_today',
  'prime_exdone',
  'prime_planning',
  'prime_wp_done',
  'prime_wp_removed',
  'prime_wp_ex_overrides',
  'prime_weekplan',
  'prime_programmas',
  'prime_custom_products',
  'prime_custom_meals',
  'prime_food_days',
  'prime_exercise_notes',
  'prime_custom_exercises',
  'prime_training_days',
  'prime_consent',
  'prime_onboarding'
];

// Sleutels waarvoor de SERVER altijd gelijk heeft: een lokale kopie mag hier nooit
// naar de cloud teruggeduwd worden. Toestemming en uitleg-gezien horen bij wat
// de coach/de database vastlegt: haalt de coach een akkoord weg (bv. om opnieuw
// te laten geven), dan moet dat ook op een apparaat gelden dat het lokaal nog
// onthoudt. Verschil met gewone data, waar een lokaal nog niet aangekomen
// wijziging juist beschermd wordt (zie hydrateFromCloud).
const SERVER_LEIDEND_KEYS = ['prime_consent', 'prime_onboarding'];

let _sb = null;
let activeClientId = null;

function getSupabase() {
  if (!_sb) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase is nog niet geconfigureerd — vul SUPABASE_URL en SUPABASE_ANON_KEY in js/cloud.js in.');
    }
    _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _sb;
}

// ── Lokale "laatst zelf geschreven"-tijdstippen per sleutel ──
// Bugmelding: afgevinkte oefeningen (en andere voortgang) "resetten"
// soms vanzelf, zonder dat er iets in Training is aangepast. Oorzaak:
// syncSet() hieronder stuurt de cloud-upsert async en zonder wachten
// weg; als de pagina kort daarna herlaadt (bv. om een nieuwe versie te
// zien, of gewoon een normale refresh) VOORDAT die upsert de server
// heeft bereikt, werd dat verzoek door de paginanavigatie afgebroken --
// en haalde hydrateFromCloud() bij het opnieuw opstarten gewoon de oude
// (nog niet bijgewerkte) rij weer op en overschreef daarmee domweg de
// lokale, net gemaakte wijziging. Met een per-sleutel tijdstip van de
// laatste LOKALE schrijfactie kan hydrateFromCloud() zo'n lokaal-nog-
// niet-bevestigde wijziging herkennen en met rust laten i.p.v. hem te
// verliezen. Per klant-id genamespaced, want switchClient() herlaadt de
// pagina met een andere clientId -- zonder die scheiding zou het
// tijdstip van klant A anders ten onrechte klant B's cloud-data kunnen
// blokkeren (of, erger, klant A's lokale rommel naar klant B pushen).
function _syncTsKey(key, clientId) { return key + '__synctime__' + clientId; }
function _localSyncTs(key, clientId) {
  const v = localStorage.getItem(_syncTsKey(key, clientId));
  const n = v ? parseInt(v, 10) : 0;
  return isNaN(n) ? 0 : n;
}
function _markLocalSyncTs(key, clientId, ts) {
  try { localStorage.setItem(_syncTsKey(key, clientId), String(ts)); } catch (e) {}
}

// Haalt alle client_state-rijen van de opgegeven klant op en zet ze in
// localStorage onder dezelfde prime_*-sleutel, zodat de bestaande
// state.js/init()-flow ongewijzigd kan blijven werken.
async function hydrateFromCloud(clientId) {
  activeClientId = clientId;
  const sb = getSupabase();
  // Harde tijdslimiet i.p.v. te vertrouwen op navigator.onLine (bleek niet
  // betrouwbaar genoeg, zie withTimeout() hierboven) -- zo wacht dit nooit
  // langer dan 3s, ook niet als de browser zelf nog "online" meldt.
  const { data, error } = await withTimeout(
    sb.from('client_state').select('key, value, updated_at').eq('client_id', clientId),
    3000, { data: null, error: { message: 'Failed to fetch (timeout)' } }
  );

  if (error) {
    if (isNetworkError(error)) {
      // Geen internet: gewoon doorgaan met wat al lokaal staat (van de
      // laatste geslaagde synchronisatie), i.p.v. het opstarten van de app
      // hier af te breken. Zodra er weer verbinding is, lopen syncSet() en
      // een latere hydratie dit vanzelf weer bij.
      console.error('hydrateFromCloud: geen verbinding, ga door met lokale data:', error);
      return;
    }
    throw error;
  }

  const serverKeys = new Set();
  const teHerpushen = []; // sleutels waar de lokale versie "wint" en dus nog naar de cloud moet

  (data || []).forEach(row => {
    if (!CLOUD_KEYS.includes(row.key)) return;
    serverKeys.add(row.key);
    const serverTs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
    const localTs  = _localSyncTs(row.key, clientId);
    if (!SERVER_LEIDEND_KEYS.includes(row.key) && localTs > serverTs && localStorage.getItem(row.key) != null) {
      // Deze pagina heeft zelf recenter (mogelijk nog niet aangekomen)
      // lokaal geschreven dan wat er nu in de cloud staat -- niet
      // overschrijven, straks opnieuw proberen te versturen.
      teHerpushen.push(row.key);
      return;
    }
    try {
      localStorage.setItem(row.key, JSON.stringify(row.value));
      _markLocalSyncTs(row.key, clientId, serverTs);
    } catch (e) {
      // Bv. QuotaExceededError -- zonder deze try/catch brak dit de HELE
      // hydratie (en dus inloggen/klant kiezen) af zodra ook maar ÉÉN
      // sleutel te groot was (bv. eigen gerechten met veel foto's), met
      // een rauwe "Failed to execute 'setItem'"-melding op het
      // login-scherm tot gevolg. De cloud-waarde blijft intact (dat is de
      // bron van waarheid); alleen de lokale snelle cache voor DEZE ene
      // sleutel wordt overgeslagen, de rest van de hydratie gaat door.
      console.error('hydrateFromCloud: localStorage.setItem faalde voor ' + row.key + ':', e);
    }
  });

  // Sleutels zonder cloud-rij: alleen leegmaken als er ook geen "eigen,
  // nog te versturen" lokale claim op staat (dus een écht nieuw/leeg
  // account voor DEZE klant-id, geen slachtoffer van dezelfde race).
  CLOUD_KEYS.forEach(key => {
    if (serverKeys.has(key)) return;
    if (!SERVER_LEIDEND_KEYS.includes(key) && _localSyncTs(key, clientId) > 0 && localStorage.getItem(key) != null) {
      teHerpushen.push(key);
      return;
    }
    localStorage.removeItem(key);
  });

  // Alsnog versturen wat lokaal won, zodat de cloud niet blijvend
  // achterloopt op wat deze pagina al lokaal heeft.
  teHerpushen.forEach(key => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) syncSet(key, JSON.parse(raw));
    } catch (e) { console.error('hydrateFromCloud: herstel-push mislukt voor ' + key + ':', e); }
  });
}

// Vervangt localStorage.setItem('prime_x', JSON.stringify(v)) call sites:
// slaat lokaal op (voor directe herlees-snelheid) én synchroniseert async
// naar Supabase voor de actieve klant.
// Eén plek om te herkennen of een mislukte Supabase-aanroep kwam doordat er
// simpelweg geen internet was (i.p.v. een echte fout, zoals een verkeerd
// wachtwoord of een serverprobleem) -- gebruikt bij inloggen, het ophalen
// van het profiel en het hydrateren vanuit de cloud, zodat die alle drie op
// dezelfde manier "geen internet" herkennen en daar hetzelfde (vriendelijk,
// niet-blokkerend) mee omgaan.
function isNetworkError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = String((err && err.message) || err || '');
  return /failed to fetch|networkerror|load failed|network request failed|timeout/i.test(msg);
}

// Bindt een Supabase-aanroep aan een harde tijdslimiet, ONGEACHT wat
// navigator.onLine zegt -- die bleek in de praktijk niet betrouwbaar genoeg
// (meldt soms nog "online" terwijl er geen echte verbinding is), waardoor
// het eerdere vangnet (dat alleen op navigator.onLine vertrouwde) bij het
// opstarten alsnog de volle, lange netwerk-timeout kon afwachten. timeoutData
// is wat teruggegeven wordt als de tijd verstrijkt, in dezelfde vorm als een
// normaal Supabase-antwoord ({ data, error } of { data: { session } }).
function withTimeout(promise, ms, timeoutData) {
  return Promise.race([
    promise,
    new Promise(function (resolve) {
      setTimeout(function () { resolve(timeoutData); }, ms);
    })
  ]);
}

// ---- Verbindingsstatus ----
// PRIME werkt bewust alleen online. Zonder deze melding lijkt het bij een
// wegvallende verbinding alsof afvinken/opslaan 'gewoon' werkt, terwijl het
// alleen lokaal staat. _connOffline volgt de browser (online/offline events),
// _connSaveFailed wordt gezet als een cloud-opslag mislukt terwijl de browser
// zichzelf wel online noemt (bv. zwakke 4G) en gaat weer uit na een geslaagde
// opslag.
let _connOffline = (typeof navigator !== 'undefined' && navigator.onLine === false);
let _connSaveFailed = false;

function updateConnBanner() {
  const el = document.getElementById('conn-banner');
  if (!el) return;
  const msg = _connOffline ? t('conn.offline') : (_connSaveFailed ? t('conn.saveFailed') : '');
  el.textContent = msg;
  el.style.display = msg ? '' : 'none';
}

function noteSyncResult(error) {
  const failed = !!error;
  if (failed === _connSaveFailed) return;
  _connSaveFailed = failed;
  updateConnBanner();
}

window.addEventListener('offline', function() { _connOffline = true; updateConnBanner(); });
window.addEventListener('online', function() { _connOffline = false; _connSaveFailed = false; updateConnBanner(); });
document.addEventListener('DOMContentLoaded', updateConnBanner);

function syncSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Bv. QuotaExceededError als de lokale opslag van de browser vol zit
    // (5-10MB per site). Laat dit bewust NIET de aanroeper laten crashen
    // — de cloud-sync hieronder heeft die beperking niet en kan de data
    // dus nog steeds veilig wegschrijven, ook al lukt de lokale cache niet.
    console.error('localStorage.setItem faalde voor ' + key + ':', e);
  }

  if (!CLOUD_KEYS.includes(key)) return;
  if (!activeClientId) return; // nog niet ingelogd/gehydrateerd

  // Meteen (synchroon, dus ook als de pagina vlak hierna herlaadt vóórdat
  // de upsert hieronder is aangekomen) vastleggen dat DEZE klant-sessie
  // deze sleutel zojuist lokaal heeft bijgewerkt -- zie hydrateFromCloud().
  _markLocalSyncTs(key, activeClientId, Date.now());

  // De cloud-sync hieronder mag NOOIT de aanroeper laten crashen: syncSet()
  // wordt overal aangeroepen vlak vóór een DOM-update (bv. toggleFoodEaten,
  // addProductToLog), en een niet-opgevangen fout hier (bv. Supabase nog
  // niet geconfigureerd, of een synchrone fout in de query-opbouw) zou die
  // DOM-update anders stilletjes overslaan -- de klik lijkt dan "niets te
  // doen", terwijl de lokale opslag (hierboven) al wel gelukt is.
  try {
    const sb = getSupabase();
    sb.from('client_state')
      .upsert({ client_id: activeClientId, key, value, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) console.error('syncSet upsert error voor ' + key + ':', error);
        noteSyncResult(error);
      }, (e) => {
        console.error('syncSet upsert faalde voor ' + key + ':', e);
        noteSyncResult(e);
      });
  } catch (e) {
    console.error('syncSet cloud-sync faalde voor ' + key + ':', e);
  }
}

// Vervangt localStorage.removeItem('prime_x') call sites: verwijdert
// lokaal én de bijbehorende rij in Supabase voor de actieve klant.
function syncRemove(key) {
  localStorage.removeItem(key);

  if (!CLOUD_KEYS.includes(key)) return;
  if (!activeClientId) return;

  const sb = getSupabase();
  sb.from('client_state')
    .delete()
    .eq('client_id', activeClientId)
    .eq('key', key)
    .then(({ error }) => {
      if (error) console.error('syncRemove delete error voor ' + key + ':', error);
    });
}

// Coach-only: lijst van alle klant-profielen voor de klantkiezer.
// Bewaart bij een geslaagde ophaling een kopie in localStorage, en gebruikt
// die als vangnet zonder internet -- vooral voor de coach: de "welke klant
// bekeek je"-keuze staat alleen in sessionStorage (wist bij het écht
// afsluiten van PRIME, zie resolveSession() in auth.js), dus zonder dit zou
// de coach zonder internet nooit meer bij een klantscherm kunnen komen, ook
// niet bij een klant die hij/zij al eerder online bekeken heeft.
async function fetchClientList() {
  const sb = getSupabase();
  // Harde tijdslimiet: zie de toelichting bij hydrateFromCloud() hierboven.
  const { data, error } = await withTimeout(
    sb.from('profiles').select('id, display_name, role').eq('role', 'client').order('display_name'),
    3000, { data: null, error: { message: 'Failed to fetch (timeout)' } }
  );
  if (error) {
    if (isNetworkError(error)) {
      console.error('fetchClientList: geen verbinding, gebruik bewaarde lijst:', error);
      try { return JSON.parse(localStorage.getItem('prime_cached_clientlist') || '[]'); } catch (e) { return []; }
    }
    throw error;
  }
  try { localStorage.setItem('prime_cached_clientlist', JSON.stringify(data || [])); } catch (e) {}
  return data || [];
}

// Coach-only: haalt een paar specifieke client_state-sleutels op van EEN
// ANDERE klant dan de actieve, voor de Signalen-tab (overzicht over alle
// klanten heen). Schrijft NERGENS naar localStorage of activeClientId --
// alleen lezen, dus de lokale staat van de huidige (actieve) klant blijft
// volledig ongemoeid.
async function fetchClientStateFor(clientId, keys) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('client_state')
    .select('key, value')
    .eq('client_id', clientId)
    .in('key', keys);
  if (error) { console.error('fetchClientStateFor faalde voor ' + clientId + ':', error); return {}; }
  const result = {};
  (data || []).forEach(row => { result[row.key] = row.value; });
  return result;
}

// Maximale bestandsgrootte van een geüploade foto (alle uploadplekken
// controleren hierop en tonen anders een melding zonder op te slaan).
const MAX_PHOTO_BYTES = 200 * 1024;

// ========== FEEDBACK (tabel 'feedback', zie supabase/feedback.sql) ==========
// Deelnemers sturen alleen; de coach leest, markeert en verwijdert.
async function sendFeedback(kind, message) {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return { error: { message: 'niet ingelogd' } };
  const { error } = await sb.from('feedback').insert({
    client_id: session.user.id,
    kind: kind,
    message: message,
    app_build: window.PRIME_BUILD || null,
    user_agent: (navigator.userAgent || '').slice(0, 200)
  });
  return { error: error || null };
}
// Coach-only: de naam die elke deelnemer zelf in Profiel heeft ingevuld
// (prime_profile.name), voor alle klanten in één vraag. Geeft {client_id: naam}.
// De inlognaam (profiles.display_name, bv. miep.tiep@client.local) blijft de
// terugval als iemand nog geen naam heeft ingevuld.
async function fetchProfileNames() {
  const { data, error } = await getSupabase().from('client_state').select('client_id, value').eq('key', 'prime_profile');
  if (error) { console.error('fetchProfileNames:', error); return {}; }
  const map = {};
  (data || []).forEach(r => { if (r.value && r.value.name && String(r.value.name).trim()) map[r.client_id] = String(r.value.name).trim(); });
  return map;
}

// Coach-only: wanneer elke deelnemer akkoord is gegaan met de voorwaarden
// (client_state.prime_consent = {version, date}). Geeft {client_id: {version, date}}.
async function fetchConsents() {
  const { data, error } = await getSupabase().from('client_state').select('client_id, value').eq('key', 'prime_consent');
  if (error) { console.error('fetchConsents:', error); return {}; }
  const map = {};
  (data || []).forEach(r => { if (r.value && r.value.date) map[r.client_id] = r.value; });
  return map;
}

async function fetchFeedbackList() {
  const sb = getSupabase();
  const { data, error } = await sb.from('feedback').select('*').order('created_at', { ascending: false }).limit(100);
  return { data: data || [], error: error || null };
}
async function setFeedbackHandled(id, handled) {
  const { error } = await getSupabase().from('feedback').update({ handled: handled }).eq('id', id);
  return error || null;
}
async function deleteFeedbackRow(id) {
  const { error } = await getSupabase().from('feedback').delete().eq('id', id);
  return error || null;
}

// ========== FOTO-OPSLAG (Supabase Storage) ==========
// Foto's van eigen producten/gerechten/oefeningen/programma's staan als los
// bestand in de bucket 'prime-photos' (zie supabase/photo_storage.sql); in
// de app-data komt alleen de publieke URL. Geeft die URL terug, of null als
// uploaden niet lukt (geen sessie, bucket nog niet aangemaakt, offline...) --
// aanroepers houden dan gewoon hun lokale base64-voorbeeld als terugval,
// dus een mislukte upload breekt nooit het opslaan zelf.
async function uploadPhotoToStorage(file) {
  try {
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const ext = ((file.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = session.user.id + '/' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '.' + ext;
    const { error } = await sb.storage.from('prime-photos').upload(path, file, { contentType: file.type || undefined, cacheControl: '31536000' });
    if (error) { console.error('uploadPhotoToStorage:', error); return null; }
    return sb.storage.from('prime-photos').getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.error('uploadPhotoToStorage faalde:', e);
    return null;
  }
}

// Eenmalige, idempotente omzetting van al opgeslagen base64-foto's
// (data:image/...) naar Storage-URL's, zodat ze bijna geen ruimte meer in
// de data/lokale opslag innemen. Werkt op de CLOUD-waarde van de sleutels van
// de actieve klant (niet op de lokale cache, die door een eerdere
// quota-fout verouderd kan zijn), en schrijft alleen terug als er echt iets
// vervangen is. Een foto die niet geüpload kan worden blijft gewoon base64.
// De coach ruimt daarbij ook de gedeelde PRIME-gerechten/-programma's op.
let _fotoMigratieBezig = false;
async function migrateBase64PhotosToStorage() {
  if (_fotoMigratieBezig || !activeClientId) return 0;
  _fotoMigratieBezig = true;
  const isData = v => typeof v === 'string' && v.startsWith('data:image/');
  const cache = {};
  let aantal = 0;
  const toUrl = async function(dataUrl) {
    if (cache[dataUrl] !== undefined) return cache[dataUrl];
    let url = null;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      url = await uploadPhotoToStorage(new File([blob], 'foto.' + ext, { type: blob.type }));
    } catch (e) { console.error('foto-migratie: omzetten mislukt:', e); }
    cache[dataUrl] = url;
    if (url) aantal++;
    return url;
  };
  // Vervangt in-place; geeft terug of er iets veranderd is.
  const vervang = async function(node) {
    let changed = false;
    if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) {
        const v = node[k];
        if (isData(v)) {
          const url = await toUrl(v);
          if (url) { node[k] = url; changed = true; }
        } else if (v && typeof v === 'object') {
          if (await vervang(v)) changed = true;
        }
      }
    }
    return changed;
  };
  try {
    const setters = {
      prime_custom_products: v => { customProducts = v; },
      prime_custom_meals: v => { customMeals = v; },
      prime_custom_exercises: v => { customExercises = v; },
      prime_training_days: v => { trainingDays = v; trainingDagLog = trainingDays[currentTrainingDate] || []; },
      prime_programmas: v => {}
    };
    const rows = await fetchClientStateFor(activeClientId, Object.keys(setters));
    for (const key of Object.keys(rows)) {
      const waarde = rows[key];
      if (await vervang(waarde)) { syncSet(key, waarde); setters[key](waarde); }
    }
    if (typeof isPrimeCoach === 'function' && isPrimeCoach()) {
      const meals = await fetchPrimeMealsFromCloud();
      if (meals) {
        for (const m of meals) { if (await vervang(m)) await savePrimeMealToCloud(m); }
        primeMeals = meals;
        try { localStorage.setItem('prime_prime_meals', JSON.stringify(meals)); } catch (e) {}
      }
      const progs = await fetchPrimeProgramsFromCloud();
      if (progs) {
        for (const p of progs) { if (await vervang(p)) await savePrimeProgramToCloud(p); }
        primeProgLijst = progs;
        try { localStorage.setItem('prime_prime_programmas', JSON.stringify(progs)); } catch (e) {}
      }
    }
  } catch (e) {
    console.error('foto-migratie faalde:', e);
  }
  _fotoMigratieBezig = false;
  if (aantal > 0) console.log('foto-migratie: ' + aantal + " foto('s) naar Storage verplaatst");
  return aantal;
}

// ========== PRIME-PROGRAMMA'S (gedeeld, coach-only bewerkbaar) ==========
// Deze lopen bewust NIET via CLOUD_KEYS/syncSet (dat is per-klant-scoped in
// client_state), maar via een eigen, voor iedereen leesbare Supabase-tabel
// (prime_programs, zie supabase/prime_programs.sql), zodat elke klant
// dezelfde PRIME-programma's ziet ongeacht welk klant-account actief is.
// localStorage blijft wel gebruikt als snelle cache/offline-fallback.

async function fetchPrimeProgramsFromCloud() {
  const sb = getSupabase();
  const { data, error } = await sb.from('prime_programs').select('id, value');
  if (error) { console.error('fetchPrimeProgramsFromCloud:', error); return null; }
  const list = (data || []).map(row => row.value);
  try { localStorage.setItem('prime_prime_programmas', JSON.stringify(list)); } catch (e) { console.error(e); }
  return list;
}

async function savePrimeProgramToCloud(prog) {
  const sb = getSupabase();
  const { error } = await sb.from('prime_programs')
    .upsert({ id: prog.id, value: prog, updated_at: new Date().toISOString() });
  if (error) console.error('savePrimeProgramToCloud:', error);
}

async function deletePrimeProgramFromCloud(id) {
  const sb = getSupabase();
  const { error } = await sb.from('prime_programs').delete().eq('id', id);
  if (error) console.error('deletePrimeProgramFromCloud:', error);
}

// ========== PRIME-GERECHTEN (gedeeld, coach-only bewerkbaar) ==========
// Zelfde opzet als hierboven, maar dan voor "Voeding > PRIME gerechten"
// (zie supabase/prime_meals.sql).

async function fetchPrimeMealsFromCloud() {
  const sb = getSupabase();
  const { data, error } = await sb.from('prime_meals').select('id, value');
  if (error) { console.error('fetchPrimeMealsFromCloud:', error); return null; }
  const list = (data || []).map(row => row.value);
  try { localStorage.setItem('prime_prime_meals', JSON.stringify(list)); } catch (e) { console.error(e); }
  return list;
}

async function savePrimeMealToCloud(meal) {
  const sb = getSupabase();
  const { error } = await sb.from('prime_meals')
    .upsert({ id: meal.id, value: meal, updated_at: new Date().toISOString() });
  if (error) console.error('savePrimeMealToCloud:', error);
}

async function deletePrimeMealFromCloud(id) {
  const sb = getSupabase();
  const { error } = await sb.from('prime_meals').delete().eq('id', id);
  if (error) console.error('deletePrimeMealFromCloud:', error);
}
