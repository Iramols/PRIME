// ========== AUTH & KLANTSELECTIE ==========
// Regelt inloggen, sessie-check en (voor de coach) de klantkiezer.
// Pas zodra de juiste klantdata via hydrateFromCloud() in localStorage
// staat, worden de eigenlijke app-scripts geladen — zo lezen de
// top-level `let`-variabelen in state.js altijd de juiste klant-data.

const CLIENT_EMAIL_DOMAIN = '@client.local';

const APP_SCRIPTS = [
  'js/data.js', 'js/state.js', 'js/beheer.js', 'js/checkin.js',
  'js/training.js', 'js/food.js', 'js/coach.js', 'js/programmas.js',
  'js/weekplanning.js', 'js/foodweek.js', 'js/history.js', 'js/profile.js', 'js/app.js'
];

function toLoginEmail(input) {
  input = (input || '').trim();
  if (input.includes('@')) return input;
  return input.toLowerCase().replace(/\s+/g, '.') + CLIENT_EMAIL_DOMAIN;
}

function showLogin(message) {
  document.getElementById('login-overlay').classList.add('open');
  document.getElementById('client-picker-overlay').classList.remove('open');
  document.getElementById('login-error').textContent = message || '';
}

function hideLogin() {
  document.getElementById('login-overlay').classList.remove('open');
}

function showClientPicker(clients) {
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
  const { error } = await sb.from('profiles').update({ display_name: newName.trim() }).eq('id', clientId);
  if (error) { alert(t('auth.renameFailed', { msg: error.message })); return; }
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
  const emailInput = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-submit');
  btn.disabled = true;
  try {
    const sb = getSupabase();
    const { error } = await sb.auth.signInWithPassword({ email: toLoginEmail(emailInput), password: password });
    if (error) throw error;
    await resolveSession();
  } catch (err) {
    showLogin(err.message === 'Invalid login credentials'
      ? t('auth.invalidCredentials')
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

function switchClient() {
  sessionStorage.removeItem('prime_active_client');
  location.reload();
}

// Laadt de app-scripts één voor één in vaste volgorde (elk pas nadat
// de vorige klaar is), zodat de bestaande laadvolgorde/afhankelijkheden
// intact blijven — en toont daarna de app.
function loadAppScripts(index) {
  index = index || 0;
  if (index >= APP_SCRIPTS.length) return;
  const script = document.createElement('script');
  script.src = APP_SCRIPTS[index];
  script.onload = function() { loadAppScripts(index + 1); };
  document.body.appendChild(script);
}

async function bootApp(clientId, isCoach) {
  await hydrateFromCloud(clientId);
  hideLogin();
  hideClientPicker();
  document.getElementById('app-shell').style.display = '';
  if (isCoach) document.getElementById('switch-client-btn').style.display = '';
  loadAppScripts();
}

async function resolveSession() {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showLogin(); return; }

  const { data: profileRow, error } = await sb
    .from('profiles')
    .select('id, role, display_name')
    .eq('id', session.user.id)
    .single();
  if (error || !profileRow) { showLogin(t('auth.profileLoadFailed', { msg: error ? error.message : t('auth.unknownUser') })); return; }

  if (profileRow.role === 'coach') {
    const remembered = sessionStorage.getItem('prime_active_client');
    if (remembered) { await bootApp(remembered, true); return; }
    const clients = await fetchClientList();
    showClientPicker(clients);
  } else {
    await bootApp(profileRow.id, false);
  }
}

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
