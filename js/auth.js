// ========== AUTH & KLANTSELECTIE ==========
// Regelt inloggen, sessie-check en (voor de coach) de klantkiezer.
// Pas zodra de juiste klantdata via hydrateFromCloud() in localStorage
// staat, worden de eigenlijke app-scripts geladen — zo lezen de
// top-level `let`-variabelen in state.js altijd de juiste klant-data.

const CLIENT_EMAIL_DOMAIN = '@client.local';

// Het echte, ingelogde Supabase-account-e-mailadres (dus altijd dat van de
// coach zelf, ook als er via "Wissel klant" een klant bekeken wordt — dat
// wisselt alleen activeClientId, niet de sessie). Gebruikt om coach-only
// features zoals PRIME-programma's af te schermen. Wordt gezet in
// resolveSession(), vóórdat de app-scripts geladen worden.
let loggedInEmail = null;
const PRIME_COACH_EMAIL = 'ira.mols@hotmail.com';
function isPrimeCoach() { return loggedInEmail === PRIME_COACH_EMAIL; }

const APP_SCRIPTS = [
  'js/data.js', 'js/state.js', 'js/beheer.js', 'js/checkin.js',
  'js/training.js', 'js/food.js', 'js/coach.js', 'js/programmas.js',
  'js/weekplanning.js', 'js/foodweek.js', 'js/history.js', 'js/export.js', 'js/profile.js', 'js/app.js'
];

function toLoginEmail(input) {
  input = (input || '').trim();
  if (input.includes('@')) return input;
  return input.toLowerCase().replace(/\s+/g, '.') + CLIENT_EMAIL_DOMAIN;
}

// ========== TOESTEMMING (deelnemers, eerste keer inloggen) ==========
// Wordt per deelnemer opgeslagen in client_state (sleutel prime_consent) met
// een versienummer: bij een aangepaste tekst hoeft alleen CONSENT_VERSION
// verhoogd te worden om iedereen opnieuw akkoord te laten geven. De coach
// (ook als die een klant bekijkt) krijgt dit scherm nooit -- toestemming
// hoort bij de deelnemer zelf.
const CONSENT_VERSION = 1;
let _consentResolve = null;
function hasConsent() {
  try {
    const c = JSON.parse(localStorage.getItem('prime_consent') || 'null');
    return !!(c && c.version >= CONSENT_VERSION);
  } catch (e) { return false; }
}
function ensureConsent() {
  if (hasConsent()) return Promise.resolve();
  return new Promise(function(resolve) {
    _consentResolve = resolve;
    hideBootLoader();
    document.getElementById('consent-close').style.display = 'none';
    document.getElementById('consent-agree-block').style.display = '';
    document.getElementById('consent-check').checked = false;
    document.getElementById('consent-agree-btn').disabled = true;
    document.getElementById('consent-overlay').classList.add('open');
  });
}
function acceptConsent() {
  syncSet('prime_consent', { version: CONSENT_VERSION, date: new Date().toISOString() });
  document.getElementById('consent-overlay').classList.remove('open');
  const l = document.getElementById('boot-loader');
  if (l) l.style.display = 'flex';
  if (_consentResolve) { const r = _consentResolve; _consentResolve = null; r(); }
}
// Niet akkoord: geen gegevens vastleggen, gewoon uitloggen (terug naar het inlogscherm).
function declineConsent() { doLogout(); }

// Alleen-lezen weergave vanuit Profiel > Hulp en privacy.
function openConsentView() {
  document.getElementById('consent-agree-block').style.display = 'none';
  document.getElementById('consent-close').style.display = '';
  document.getElementById('consent-overlay').classList.add('open');
}
function closeConsentView() { document.getElementById('consent-overlay').classList.remove('open'); }

// ========== UITLEG VOOR NIEUWE DEELNEMERS ==========
// Eenmalig na de toestemming (alleen deelnemers): drie korte kaarten. Opgeslagen
// als prime_onboarding in client_state; opnieuw te bekijken via Profiel > Privacy.
const ONBOARDING_VERSION = 1;
let _onbResolve = null, _onbStep = 0, _onbReplay = false;
function hasOnboarded() {
  try {
    const c = JSON.parse(localStorage.getItem('prime_onboarding') || 'null');
    return !!(c && c.version >= ONBOARDING_VERSION);
  } catch (e) { return false; }
}
function showOnboardingStep(i) {
  _onbStep = i;
  document.querySelectorAll('#onboarding-overlay .onb-slide').forEach(s => { s.style.display = parseInt(s.dataset.step, 10) === i ? '' : 'none'; });
  document.querySelectorAll('#onb-dots span').forEach((d, k) => d.classList.toggle('on', k === i));
  document.getElementById('onb-back').style.display = i === 0 ? 'none' : '';
  document.getElementById('onb-next').textContent = t(i === 2 ? 'onb.start' : 'onb.next');
}
function ensureOnboarding() {
  if (hasOnboarded()) return Promise.resolve();
  return new Promise(function(resolve) {
    _onbResolve = resolve; _onbReplay = false;
    hideBootLoader();
    showOnboardingStep(0);
    document.getElementById('onboarding-overlay').classList.add('open');
  });
}
function openOnboardingReplay() {
  _onbReplay = true; _onbResolve = null;
  showOnboardingStep(0);
  document.getElementById('onboarding-overlay').classList.add('open');
}
function onboardingNext() { if (_onbStep < 2) showOnboardingStep(_onbStep + 1); else finishOnboarding(); }
function onboardingBack() { if (_onbStep > 0) showOnboardingStep(_onbStep - 1); }
function finishOnboarding() {
  document.getElementById('onboarding-overlay').classList.remove('open');
  if (_onbReplay) return;
  syncSet('prime_onboarding', { version: ONBOARDING_VERSION, date: new Date().toISOString() });
  // Nog geen naam ingevuld? Dan opent Profiel meteen na het opstarten (zie init in app.js).
  try {
    const p = JSON.parse(localStorage.getItem('prime_profile') || 'null');
    window._primeOpenProfile = !(p && p.name && String(p.name).trim());
  } catch (e) { window._primeOpenProfile = true; }
  const l = document.getElementById('boot-loader');
  if (l) l.style.display = 'flex';
  if (_onbResolve) { const r = _onbResolve; _onbResolve = null; r(); }
}

function hideBootLoader() {
  const l = document.getElementById('boot-loader');
  if (l) l.style.display = 'none';
}

// Toont de app pas als init() (app.js) klaar is, zodat je nooit de kale
// standaard-HTML van het dashboard ("Goedemorgen" + check-in) ziet die daarna
// alsnog wordt omgezet.
function revealApp() {
  document.getElementById('app-shell').style.display = '';
  hideBootLoader();
}

function showLogin(message) {
  hideBootLoader();
  document.getElementById('login-overlay').classList.add('open');
  document.getElementById('client-picker-overlay').classList.remove('open');
  document.getElementById('login-error').textContent = message || '';
}

function hideLogin() {
  document.getElementById('login-overlay').classList.remove('open');
}

function showClientPicker(clients) {
  hideBootLoader();
  const list = document.getElementById('client-picker-list');
  list.innerHTML = '';
  if (!clients.length) {
    list.innerHTML = '<div style="color:var(--muted);font-size:13px">' + t('picker.empty') + '</div>';
  }
  clients.forEach(function(c) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px';

    const openBtn = document.createElement('button');
    openBtn.className = 'btn-sm';
    openBtn.style.cssText = 'flex:1;text-align:left';
    openBtn.textContent = c.display_name || c.id;
    openBtn.onclick = function() { selectClient(c.id); };

    const renameBtn = document.createElement('button');
    renameBtn.className = 'btn-sm';
    renameBtn.title = t('picker.renameTitle');
    renameBtn.textContent = '✏️';
    renameBtn.onclick = function() { renameClient(c.id, c.display_name); };

    row.appendChild(openBtn);
    row.appendChild(renameBtn);
    list.appendChild(row);
  });
  document.getElementById('login-overlay').classList.remove('open');
  document.getElementById('client-picker-overlay').classList.add('open');
}

async function renameClient(clientId, currentName) {
  const newName = prompt(t('picker.renamePrompt'), currentName || '');
  if (newName === null || !newName.trim()) return;
  const sb = getSupabase();
  const { error } = await withTimeout(
    sb.from('profiles').update({ display_name: newName.trim() }).eq('id', clientId),
    3000, { error: { message: 'timeout' } }
  );
  if (error) {
    alert(isNetworkError(error) ? t('auth.renameFailedOffline') : t('auth.renameFailed', { msg: error.message }));
    return;
  }
  const clients = await fetchClientList();
  showClientPicker(clients);
}

function hideClientPicker() {
  document.getElementById('client-picker-overlay').classList.remove('open');
}

function selectClient(clientId) {
  sessionStorage.setItem('prime_active_client', clientId);
  bootApp(clientId, true);
}

async function doLogin() {
  // Het Supabase-script komt van een CDN. Was er bij het openen geen internet,
  // dan is het nooit geladen en werkt inloggen pas na een herlaad.
  if (typeof supabase === 'undefined') {
    if (navigator.onLine !== false) { location.reload(); return; }
    showLogin(t('auth.offline'));
    return;
  }
  // Geen internet: niet eens proberen (en dus niet de volledige netwerk-
  // timeout afwachten) -- inloggen kan sowieso niet zonder verbinding.
  if (navigator.onLine === false) { showLogin(t('auth.offline')); return; }
  const emailInput = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-submit');
  btn.disabled = true;
  try {
    const sb = getSupabase();
    const { error } = await withTimeout(
      sb.auth.signInWithPassword({ email: toLoginEmail(emailInput), password: password }),
      3000, { error: { message: 'Failed to fetch (timeout)' } }
    );
    if (error) throw error;
    await resolveSession();
  } catch (err) {
    const offline = isNetworkError(err);
    showLogin(err.message === 'Invalid login credentials'
      ? t('auth.invalidCredentials')
      : offline ? t('auth.offline')
      : t('auth.loginFailed', { msg: err.message }));
  } finally {
    btn.disabled = false;
  }
}

async function doLogout() {
  try { const sb = getSupabase(); await sb.auth.signOut(); } catch (e) { /* nog niet geconfigureerd, geen sessie om uit te loggen */ }
  sessionStorage.removeItem('prime_active_client');
  location.reload();
}

// Klant wisselen herlaadt de pagina (zie APP_SCRIPTS hierboven: alleen zo
// lezen de top-level `let`-variabelen in state.js gegarandeerd de juiste
// klant-data). Zonder internet is zo'n herlaad onbetrouwbaar -- op sommige
// toestellen (vooral mobiel) breekt de navigatie dan al af vóórdat de
// pagina zelf iets kan tonen, zodat de oude klant stil actief blijft en er
// geen melding verschijnt. Daarom eerst checken en, zo ja, helemaal niet
// herladen.
async function switchClient() {
  if (await probeOfflineNow()) {
    try { showToast(t('picker.switchOffline'), true); } catch (e) {}
    return;
  }
  sessionStorage.removeItem('prime_active_client');
  location.reload();
}

// Rechtstreeks naar een specifieke klant wisselen (bv. vanuit de
// Signalen-tab, waar op een klant-kaart geklikt wordt) -- zelfde
// "onthouden + herladen"-mechanisme als de klantkiezer zelf gebruikt.
async function switchToClient(clientId) {
  if (await probeOfflineNow()) {
    try { showToast(t('picker.switchOffline'), true); } catch (e) {}
    return;
  }
  sessionStorage.setItem('prime_active_client', clientId);
  location.reload();
}

// Laadt de app-scripts één voor één in vaste volgorde (elk pas nadat
// de vorige klaar is), zodat de bestaande laadvolgorde/afhankelijkheden
// intact blijven — en toont daarna de app.
//
// Cache-busting: deze scripts worden pas ná de initiële paginalading
// dynamisch toegevoegd, dus een gewone harde refresh (Ctrl+Shift+R) van
// de pagina ververst ze niet altijd betrouwbaar mee — met name GitHub
// Pages' eigen CDN-caching kan een oudere versie nog een tijd vasthouden.
// PRIME_BUILD (verandert bij elke push, zie tools/bump-build.js) als
// querystring dwingt een verse download af bij een nieuwe versie.
//
// Was eerst Date.now() -- dus een ANDERE, unieke querystring bij elke
// paginalading, ook zonder nieuwe versie. Daardoor kon de service worker
// deze 14 bestanden nooit uit zijn cache herkennen (de URL was immers nog
// nooit eerder gezien) en moest hij ze zonder internet ALLEMAAL, na elkaar,
// eerst laten mislukken -- dat was de belangrijkste oorzaak van het lange
// wachten bij offline opstarten. Met PRIME_BUILD blijft de URL binnen
// dezelfde versie stabiel, dus treft de service worker na de eerste
// geslaagde online lading gewoon een cache-treffer.
const _appScriptsCacheBust = window.PRIME_BUILD || Date.now();

function loadAppScripts(index) {
  index = index || 0;
  if (index >= APP_SCRIPTS.length) return;
  const script = document.createElement('script');
  script.src = APP_SCRIPTS[index] + '?v=' + _appScriptsCacheBust;
  script.onload = function() { loadAppScripts(index + 1); };
  // Zonder dit blijft de keten hangen (tot de 12s-vangnet-timer in bootApp())
  // als er ooit één bestand toch niet lukt (bv. nog nooit gecachet én zonder
  // internet) -- beter zo goed mogelijk doorgaan met de rest.
  script.onerror = function() {
    console.error('loadAppScripts: laden mislukt voor ' + script.src);
    loadAppScripts(index + 1);
  };
  document.body.appendChild(script);
}

async function bootApp(clientId, isCoach) {
  const _l = document.getElementById('boot-loader');
  if (_l) _l.style.display = 'flex';
  await hydrateFromCloud(clientId);
  if (!isCoach) { await ensureConsent(); await ensureOnboarding(); }
  hideLogin();
  hideClientPicker();
  if (isCoach) document.getElementById('switch-client-btn').style.display = '';
  if (isCoach) document.getElementById('reset-voortgang-btn').style.display = '';
  if (isCoach) document.getElementById('signalen-coach-card').style.display = '';
  if (isCoach) document.getElementById('nav-btn-signalen').style.display = '';
  if (isCoach) document.getElementById('nav-btn-coach').style.display = '';
  if (isCoach) document.getElementById('wis-training-btn').style.display = '';
  if (isCoach) document.getElementById('wis-voeding-btn').style.display = '';
  if (isCoach) document.getElementById('nav-btn-beheer').style.display = '';
  if (isCoach) document.getElementById('bnav-more').style.display = '';
  loadAppScripts();
  // Vangnet: lukt init() om welke reden ook niet, toon de app dan toch.
  setTimeout(revealApp, 12000);
}

// Vangnet zonder internet: gebruikt het laatst bewaarde profiel (zie
// resolveSession() hieronder, twee aanroeppunten -- geen sessie kunnen
// bevestigen, en wel een sessie maar de profielcheck niet). userId is null
// als we niet eens meer zeker weten wie er ingelogd is (getSession() zelf
// al te traag/mislukt); dan wordt de bewaarde klant/coach zonder id-check
// vertrouwd -- op één toestel is dat vrijwel altijd hetzelfde account.
async function offlineFallbackBoot(userId) {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem('prime_cached_profile') || 'null'); } catch (e) {}
  if (!cached || (userId && cached.id !== userId)) { showLogin(t('auth.offline')); return; }
  if (cached.role === 'coach') {
    const remembered = sessionStorage.getItem('prime_active_client');
    if (remembered) { await bootApp(remembered, true); return; }
    // Geen klant gekozen (die keuze wisselt per tabblad-sessie, dus wist bij
    // het écht afsluiten van PRIME): toon de klantkiezer met de laatst
    // bewaarde lijst (fetchClientList() valt zelf terug op die cache zonder
    // internet, zie cloud.js). Is er nog nooit een lijst bewaard (dit
    // toestel is nog nooit offline als coach gebruikt), dan kan het helaas
    // niet anders dan hier stoppen.
    const clients = await fetchClientList();
    if (clients.length) { showClientPicker(clients); return; }
    showLogin(t('auth.offline'));
    return;
  }
  await bootApp(cached.id, false);
}

async function resolveSession() {
  const sb = getSupabase();

  // Eén keer, meteen vooraf, vaststellen of er verbinding is (probeOffline()
  // in cloud.js) -- de stappen hieronder (profielcheck, en straks
  // fetchClientList()/hydrateFromCloud()) hergebruiken dat resultaat i.p.v.
  // elk apart het netwerk te proberen. Zonder dit stapelden de tijdslimieten
  // van alle stappen samen op tot een veelvoud, ook al was elke stap zelf
  // begrensd.
  const offline = await probeOffline();

  // getSession() leest normaal gewoon lokaal (snel), maar kan blijven hangen
  // als Supabase intern een ververs-poging voor een bijna-verlopen token
  // doet. Kortere tijdslimiet als we al weten dat er geen verbinding is.
  let session = null;
  let getSessionTimedOut = false;
  try {
    const result = await withTimeout(sb.auth.getSession(), offline ? 1200 : 3000, { data: { session: null }, _timedOut: true });
    session = result && result.data && result.data.session;
    getSessionTimedOut = !!(result && result._timedOut);
  } catch (e) {}

  if (!session) {
    if (offline || getSessionTimedOut) { await offlineFallbackBoot(null); return; }
    showLogin();
    return;
  }
  loggedInEmail = session.user.email || null;

  if (offline) {
    // Al vastgesteld dat er geen verbinding is: niet nog een keer de
    // profielcheck over het netwerk proberen (die zou toch mislukken en
    // kost alleen tijd) -- meteen naar het vangnet.
    await offlineFallbackBoot(session.user.id);
    return;
  }

  // Zelfde harde tijdslimiet voor de profielcheck (alleen hier als we op dit
  // punt nog niet wisten dat het offline is).
  const { data: profileRow, error } = await withTimeout(
    sb.from('profiles').select('id, role, display_name').eq('id', session.user.id).single(),
    3000, { data: null, error: { message: 'Failed to fetch (timeout)' } }
  );
  if (error || !profileRow) {
    // Geen internet, maar dit toestel is hier al eerder succesvol
    // ingelogd geweest: start de app dan met die laatst bekende rol i.p.v.
    // hier vast te lopen op het inlogscherm -- de sessie zelf (hierboven)
    // komt sowieso al uit Supabase's eigen lokale opslag, alleen déze
    // profielcheck vraagt nog een netwerkverzoek.
    if (isNetworkError(error)) { await offlineFallbackBoot(session.user.id); return; }
    showLogin(t('auth.profileLoadFailed', { msg: error ? error.message : t('auth.unknownUser') }));
    return;
  }

  // Voor de offline-vangnet hierboven: alleen bewaard bij een geslaagde
  // check, dus altijd de meest recent bevestigde rol.
  try { localStorage.setItem('prime_cached_profile', JSON.stringify({ id: profileRow.id, role: profileRow.role })); } catch (e) {}

  if (profileRow.role === 'coach') {
    const remembered = sessionStorage.getItem('prime_active_client');
    if (remembered) { await bootApp(remembered, true); return; }
    const clients = await fetchClientList();
    showClientPicker(clients);
  } else {
    await bootApp(profileRow.id, false);
  }
}

// Stond PRIME bij het openen zonder internet, dan blijft het inlogscherm
// hangen (Supabase-script niet geladen, of sessie/profiel niet op te halen).
// Zodra de verbinding terugkomt herstelt het zichzelf: is het script er niet,
// dan herladen we de pagina; anders proberen we de sessie opnieuw op te lossen
// (bij een bestaande sessie start de app dan vanzelf).
window.addEventListener('online', function() {
  const overlay = document.getElementById('login-overlay');
  if (!overlay || !overlay.classList.contains('open')) return;
  if (typeof supabase === 'undefined') { location.reload(); return; }
  resolveSession().catch(function() {});
});

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    doLogin();
  });
  document.getElementById('logout-btn').addEventListener('click', doLogout);
  document.getElementById('switch-client-btn').addEventListener('click', switchClient);
  resolveSession().catch(function(err) {
    showLogin(t('auth.somethingWrong', { msg: err.message }));
  });
});
