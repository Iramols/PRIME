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
  'prime_weekplan',
  'prime_programmas',
  'prime_custom_products',
  'prime_custom_meals',
  'prime_food_days',
  'prime_exercise_notes',
  'prime_custom_exercises'
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

// Haalt alle client_state-rijen van de opgegeven klant op en zet ze in
// localStorage onder dezelfde prime_*-sleutel, zodat de bestaande
// state.js/init()-flow ongewijzigd kan blijven werken.
async function hydrateFromCloud(clientId) {
  activeClientId = clientId;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('client_state')
    .select('key, value')
    .eq('client_id', clientId);

  if (error) throw error;

  // Eerst alle cloud-sleutels leegmaken zodat een klant zonder data
  // (nieuw account) niet de vorige klant se lokale resten meekrijgt.
  CLOUD_KEYS.forEach(key => localStorage.removeItem(key));

  (data || []).forEach(row => {
    if (CLOUD_KEYS.includes(row.key)) {
      localStorage.setItem(row.key, JSON.stringify(row.value));
    }
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

  const sb = getSupabase();
  sb.from('client_state')
    .upsert({ client_id: activeClientId, key, value, updated_at: new Date().toISOString() })
    .then(({ error }) => {
      if (error) console.error('syncSet upsert error voor ' + key + ':', error);
    });
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
