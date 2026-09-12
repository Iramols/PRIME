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
  'prime_training_days'
];

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
  const { data, error } = await sb
    .from('client_state')
    .select('key, value, updated_at')
    .eq('client_id', clientId);

  if (error) throw error;

  const serverKeys = new Set();
  const teHerpushen = []; // sleutels waar de lokale versie "wint" en dus nog naar de cloud moet

  (data || []).forEach(row => {
    if (!CLOUD_KEYS.includes(row.key)) return;
    serverKeys.add(row.key);
    const serverTs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
    const localTs  = _localSyncTs(row.key, clientId);
    if (localTs > serverTs && localStorage.getItem(row.key) != null) {
      // Deze pagina heeft zelf recenter (mogelijk nog niet aangekomen)
      // lokaal geschreven dan wat er nu in de cloud staat -- niet
      // overschrijven, straks opnieuw proberen te versturen.
      teHerpushen.push(row.key);
      return;
    }
    localStorage.setItem(row.key, JSON.stringify(row.value));
    _markLocalSyncTs(row.key, clientId, serverTs);
  });

  // Sleutels zonder cloud-rij: alleen leegmaken als er ook geen "eigen,
  // nog te versturen" lokale claim op staat (dus een écht nieuw/leeg
  // account voor DEZE klant-id, geen slachtoffer van dezelfde race).
  CLOUD_KEYS.forEach(key => {
    if (serverKeys.has(key)) return;
    if (_localSyncTs(key, clientId) > 0 && localStorage.getItem(key) != null) {
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
async function fetchClientList() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('id, display_name, role')
    .eq('role', 'client')
    .order('display_name');
  if (error) throw error;
  return data || [];
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
