// ========== WEEKMENU'S (Voeding) ==========
// Een weekmenu is een vaste week voeding die je één keer maakt en daarna in de Weekplanning inplant, zoals een
// trainingsprogramma. Opbouw: { id, naam, dagen: { '0': { items: [...] }, ... '6': {...} } } met 0 = maandag t/m 6 = zondag.
// Een item heeft dezelfde vorm als een gelogd item in foodDays (productId of dishId, naam, moment, gram, kcal, eiwit,
// koolhydraten, vet), plus een eigen id (mid) om het in de editor te kunnen aanwijzen.
//  - Eigen weekmenu's staan per klant in weekmenus (state.js, key prime_weekmenus, gesynchroniseerd).
//  - PRIME weekmenu's (gemaakt door de coach, voor iedereen zichtbaar) staan in de Supabase-tabel prime_weekmenus
//    (supabase/prime_weekmenus.sql), met een lokale cache in prime_prime_weekmenus. Klanten kunnen ze laden of
//    kopiëren, alleen de coach kan ze bewerken.
// Inplannen zet de voeding als GEPLAND (eaten:false) in de dagen van de Weekplanning, zoals een gekopieerde dag.

let primeWeekmenus = [];
try { primeWeekmenus = JSON.parse(localStorage.getItem('prime_prime_weekmenus') || '[]'); } catch (e) { primeWeekmenus = []; }

let wmEdit = null;      // { modus: 'eigen' | 'prime', id, dag } zolang een weekmenu in de editor open staat
let _wmContext = null;  // gezet zolang je via "+ Product" / "+ Gerecht" een item voor een weekmenu-dag zoekt
let _wmDirty = false;   // PRIME weekmenu met wijzigingen die nog niet in de cloud staan
let _wmNaamDoel = null; // wat de naam-modal gaat doen
let _wmLaad = null;     // { modus, id } van het weekmenu dat ingepland wordt
let _wmPrimeStempel = 0; // verhoogd bij elke lokale PRIME-wijziging; een oudere cloud-verversing mag die niet overschrijven
const WM_MOMENTEN = ['ontbijt', 'tussendoorOchtend', 'lunch', 'tussendoorMiddag', 'avond', 'tussendoorAvond'];

// ---------- hulpfuncties ----------
function wmLijst(modus) { return modus === 'prime' ? primeWeekmenus : weekmenus; }
function wmVind(modus, id) { return wmLijst(modus).find(function(m) { return m.id === id; }) || null; }
function wmMagBewerken(modus) { return modus === 'eigen' || isPrimeCoach(); }
function wmDagen(menu) { return Object.keys((menu && menu.dagen) || {}).map(Number).sort(function(a, b) { return a - b; }); }
function wmAantalItems(menu) {
  return wmDagen(menu).reduce(function(n, d) { return n + ((menu.dagen[d] && menu.dagen[d].items) || []).length; }, 0);
}
function wmNieuwId() { return 'wm' + Date.now() + Math.floor(Math.random() * 1000); }
function wmEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function wmNaamBestaat(naam, exceptId) {
  const norm = String(naam || '').trim().toLowerCase();
  if (!norm) return false;
  return weekmenus.concat(primeWeekmenus).some(function(m) { return m.id !== exceptId && String(m.naam || '').trim().toLowerCase() === norm; });
}

// Kopie van een gelogd item voor in een weekmenu: zonder logId/eaten, met een eigen id.
function wmSchoonItem(it) {
  const c = Object.assign({}, it);
  delete c.logId; delete c.eaten;
  if (c.photo && String(c.photo).indexOf('data:') === 0) delete c.photo;
  c.mid = newLogId();
  return c;
}

function wmDagTotalen(items) {
  const s = { kcal: 0, prot: 0, carb: 0, fat: 0 };
  (items || []).forEach(function(i) { s.kcal += i.kcal || 0; s.prot += i.prot || 0; s.carb += i.carb || 0; s.fat += i.fat || 0; });
  return { kcal: Math.round(s.kcal), prot: Math.round(s.prot), carb: Math.round(s.carb), fat: Math.round(s.fat) };
}

// ---------- opslaan en cloud ----------
async function fetchPrimeWeekmenusFromCloud() {
  const sb = getSupabase();
  const { data, error } = await withTimeout(
    sb.from('prime_weekmenus').select('id, value'),
    3000, { data: null, error: { message: 'Failed to fetch (timeout)' } }
  );
  if (error) { console.error('fetchPrimeWeekmenusFromCloud:', error); return null; }
  const list = (data || []).map(function(r) { return r.value; });
  try { localStorage.setItem('prime_prime_weekmenus', JSON.stringify(list)); } catch (e) { console.error(e); }
  return list;
}
async function savePrimeWeekmenuToCloud(menu) {
  const sb = getSupabase();
  const { error } = await withTimeout(
    sb.from('prime_weekmenus').upsert({ id: menu.id, value: menu, updated_at: new Date().toISOString() }),
    3000, { error: { message: 'Failed to fetch (timeout)' } }
  );
  if (error) console.error('savePrimeWeekmenuToCloud:', error);
  return error || null;
}
async function deletePrimeWeekmenuFromCloud(id) {
  const sb = getSupabase();
  const { error } = await withTimeout(
    sb.from('prime_weekmenus').delete().eq('id', id),
    3000, { error: { message: 'Failed to fetch (timeout)' } }
  );
  if (error) console.error('deletePrimeWeekmenuFromCloud:', error);
  return error || null;
}
async function primeWeekmenusRefreshFromCloud() {
  const stempel = _wmPrimeStempel;
  const list = await fetchPrimeWeekmenusFromCloud();
  if (!list || stempel !== _wmPrimeStempel) return; // tussendoor lokaal gewijzigd: niet met oudere cloud-gegevens overschrijven
  primeWeekmenus = list;
  const tab = document.getElementById('foodtab-weekmenu');
  if (tab && tab.style.display === 'block' && !wmEdit) renderWeekmenus();
}

// Slaat een eigen weekmenu meteen op (klein, wordt gesynchroniseerd); een PRIME weekmenu gaat naar de cloud (true = gelukt).
async function wmBewaar(modus, menu) {
  if (modus === 'prime') {
    _wmPrimeStempel++;
    try { localStorage.setItem('prime_prime_weekmenus', JSON.stringify(primeWeekmenus)); } catch (e) { console.error(e); }
    const fout = await savePrimeWeekmenuToCloud(menu);
    if (fout) { try { showToast(t('wm.saveFailed'), true); } catch (e) { console.error(e); } return false; }
    _wmDirty = false;
    return true;
  }
  syncSet('prime_weekmenus', weekmenus);
  return true;
}
function wmWijzig(modus, menu) { // na elke wijziging in de editor
  if (modus === 'prime') { _wmDirty = true; _wmPrimeStempel++; try { localStorage.setItem('prime_prime_weekmenus', JSON.stringify(primeWeekmenus)); } catch (e) { /* cache is optioneel */ } }
  else syncSet('prime_weekmenus', weekmenus);
}

// ---------- tab en lijst ----------
function wmOnTab(tab) {
  if (tab === 'weekmenu') { _wmContext = null; renderWeekmenus(); primeWeekmenusRefreshFromCloud(); }
  else if (tab === 'log' || tab === 'week') _wmContext = null;
  wmUpdateBanner(tab);
}
function wmClearContext() { _wmContext = null; wmUpdateBanner(''); }

function wmUpdateBanner(tab) {
  const el = document.getElementById('wm-banner');
  if (!el) return;
  const toon = !!_wmContext && ['basis', 'primemeals', 'add', 'addmeal'].indexOf(tab) >= 0;
  if (!toon) { el.style.display = 'none'; el.innerHTML = ''; return; }
  const menu = wmVind(_wmContext.modus, _wmContext.id);
  el.innerHTML = '<span>' + t('wm.banner', { naam: wmEsc(menu ? menu.naam : ''), dag: wpDagLang(_wmContext.dag) }) + '</span>' +
    '<button type="button" class="btn-sm" onclick="switchFoodTab(\'weekmenu\')">' + t('wm.banner.back') + '</button>';
  el.style.display = 'flex';
}

function renderWeekmenus() {
  const el = document.getElementById('wm-content');
  if (!el) return;
  try {
    el.innerHTML = wmEdit ? wmBouwEditor() : wmBouwLijst();
  } catch (e) {
    console.error('renderWeekmenus crash:', e);
    el.innerHTML = '<div class="card" style="text-align:center;padding:24px;color:var(--muted)">⚠️ ' + wmEsc((e && e.message) || String(e)) + '</div>';
  }
}

function wmTegelHtml(menu, modus) {
  const dagen = wmDagen(menu).length;
  return '<div class="wm-tegel" onclick="wmOpenKeuze(\'' + modus + '\', \'' + menu.id + '\')">' +
    '<span class="wm-label ' + (modus === 'prime' ? 'wm-label-prime' : 'wm-label-own') + '">' + (modus === 'prime' ? t('wm.label.prime') : t('food.label.own')) + '</span>' +
    '<div class="wm-tegel-naam">' + wmEsc(menu.naam) + '</div>' +
    '<div class="wm-tegel-meta">' + t('wm.daysItems', { d: dagen, n: wmAantalItems(menu) }) + '</div></div>';
}

function wmBouwLijst() {
  const balk = 'display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:8px 12px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:10px;text-align:center';
  let html = '<div onclick="wmNieuw()" style="' + balk + ';border:1.5px dashed var(--sage);background:var(--sage-light);color:var(--sage)">' + t('wm.add') + '</div>' +
    '<div onclick="wmOpenSaveWeek(fwWeekOffset)" style="' + balk + ';border:1.5px solid var(--sage);background:var(--white);color:var(--sage)">' + t('wm.saveWeekBar') + '</div>';
  html += '<div class="card-label" style="margin:14px 0 10px">' + t('wm.mine') + '</div>';
  html += weekmenus.length
    ? '<div class="wm-grid">' + weekmenus.map(function(m) { return wmTegelHtml(m, 'eigen'); }).join('') + '</div>'
    : '<div style="font-size:13px;color:var(--muted);margin-bottom:10px">' + t('wm.none') + '</div>';
  html += '<div class="card-label" style="margin:18px 0 10px">' + t('wm.prime') + '</div>';
  html += primeWeekmenus.length
    ? '<div class="wm-grid">' + primeWeekmenus.map(function(m) { return wmTegelHtml(m, 'prime'); }).join('') + '</div>'
    : '<div style="font-size:13px;color:var(--muted)">' + t('wm.noPrime') + '</div>';
  return html;
}

// Keuzevenster bij een menu (zelfde venster als bij gerechten en programma's).
function wmOpenKeuze(modus, id) {
  const menu = wmVind(modus, id);
  if (!menu) return;
  const kan = wmMagBewerken(modus);
  const knop = 'font-size:14px;padding:12px;border-radius:10px;cursor:pointer;font-weight:600;font-family:inherit;width:100%;text-align:left';
  const zand = knop + ';border:1px solid var(--sand-dark);background:var(--sand);color:var(--charcoal)';
  document.getElementById('omm-name').textContent = menu.naam;
  document.getElementById('omm-info').textContent = t('wm.daysItems', { d: wmDagen(menu).length, n: wmAantalItems(menu) });
  document.getElementById('omm-actions').innerHTML =
    '<button class="btn-primary" style="margin-bottom:0" onclick="closeOwnMealModal();wmOpenLaden(\'' + modus + '\', \'' + id + '\')">' + t('wm.action.load') + '</button>' +
    '<button style="' + zand + '" onclick="closeOwnMealModal();wmKopieerMenu(\'' + modus + '\', \'' + id + '\')">' + t('food.copy.btn') + '</button>' +
    '<button style="' + zand + '" onclick="closeOwnMealModal();wmOpenEditor(\'' + modus + '\', \'' + id + '\')">' + (kan ? '✏️ ' + t('common.edit') : '👁️ ' + t('programmas.view')) + '</button>' +
    (kan ? '<button style="' + knop + ';border:1px solid #e8c4a8;background:var(--accent-light);color:var(--accent)" onclick="closeOwnMealModal();wmVerwijder(\'' + modus + '\', \'' + id + '\')">🗑️ ' + t('common.delete') + '</button>' : '');
  document.getElementById('own-meal-modal').classList.add('open');
}

async function wmVerwijder(modus, id) {
  const menu = wmVind(modus, id);
  if (!menu || !wmMagBewerken(modus)) return;
  if (!confirm(t('wm.confirmDelete'))) return;
  if (modus === 'prime') {
    _wmPrimeStempel++;
    primeWeekmenus = primeWeekmenus.filter(function(m) { return m.id !== id; });
    try { localStorage.setItem('prime_prime_weekmenus', JSON.stringify(primeWeekmenus)); } catch (e) { console.error(e); }
    const fout = await deletePrimeWeekmenuFromCloud(id);
    if (fout) { try { showToast(t('wm.saveFailed'), true); } catch (e) { console.error(e); } }
  } else {
    weekmenus = weekmenus.filter(function(m) { return m.id !== id; });
    syncSet('prime_weekmenus', weekmenus);
  }
  if (wmEdit && wmEdit.id === id) wmEdit = null;
  renderWeekmenus();
}

// Kopie van een weekmenu (eigen of PRIME) als nieuw eigen weekmenu, met een andere naam.
function wmKopieerMenu(modus, id) {
  const bron = wmVind(modus, id);
  if (!bron) return;
  const kopie = JSON.parse(JSON.stringify(bron));
  kopie.id = wmNieuwId();
  kopie.naam = kopieNaam(bron.naam, function(n) { return wmNaamBestaat(n, null); });
  wmDagen(kopie).forEach(function(d) { (kopie.dagen[d].items || []).forEach(function(it) { it.mid = newLogId(); }); });
  weekmenus = weekmenus.concat([kopie]);
  syncSet('prime_weekmenus', weekmenus);
  wmOpenEditor('eigen', kopie.id);
}

// ---------- modal ----------
function wmModal(html) {
  document.getElementById('wm-modal-box').innerHTML = html;
  document.getElementById('wm-modal').classList.add('open');
}
function wmSluitModal() { document.getElementById('wm-modal').classList.remove('open'); }

// ---------- nieuw weekmenu, week bewaren, PRIME opslaan, hernoemen (één naam-venster) ----------
function wmNaamModal(doel, titelKey, waarde, metWeek) {
  _wmNaamDoel = doel;
  let weekHtml = '';
  if (metWeek) {
    let opts = '';
    for (let o = -4; o <= 4; o++) {
      const ma = fwStartOfWeek(o); const zo = new Date(ma); zo.setDate(ma.getDate() + 6);
      const bereik = ma.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) + ' – ' + zo.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
      opts += '<option value="' + o + '"' + (o === doel.offset ? ' selected' : '') + '>' + t('foodweek.weekLabel', { n: fwWeekNumber(ma) }) + ' (' + bereik + ')' + (o === 0 ? ' · ' + t('wm.thisWeek') : '') + '</option>';
    }
    weekHtml = '<div class="form-row"><label>' + t('wm.week.pick') + '</label><select id="wm-week-kies">' + opts + '</select></div>';
  }
  wmModal('<div class="modal-title"><span>' + t(titelKey) + '</span><button class="modal-close" onclick="wmSluitModal()">×</button></div>' +
    weekHtml +
    '<div class="form-row"><label>' + t('wm.name.label') + '</label><input type="text" id="wm-naam" maxlength="60" value="' + wmEsc(waarde || '') + '" placeholder="' + wmEsc(t('wm.name.placeholder')) + '" oninput="wmNaamInput()"></div>' +
    '<div id="wm-naam-hint" style="display:none;font-size:12px;font-weight:600;color:#c0392b;margin:-6px 0 10px"></div>' +
    '<div style="display:flex;gap:10px;margin-top:12px"><button class="btn-primary" style="flex:1" onclick="wmNaamBevestig()">' + t('wm.name.ok') + '</button>' +
    '<button class="btn-sm" style="flex:0 0 auto;padding:0 18px" onclick="wmSluitModal()">' + t('note.cancel') + '</button></div>');
  const inp = document.getElementById('wm-naam');
  if (inp) { inp.focus(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) { /* geen selectie */ } }
}
// Controleert de naam; geeft de foutmelding terug of '' als de naam kan.
function wmNaamFout(naam) {
  if (!naam) return t('wm.name.required');
  if (_wmNaamDoel && _wmNaamDoel.soort === 'prime' && !/^prime-/i.test(naam)) return t('wm.name.primePrefix');
  if (wmNaamBestaat(naam, _wmNaamDoel && _wmNaamDoel.exceptId)) return t('wm.name.exists');
  return '';
}
function wmNaamInput() {
  const hint = document.getElementById('wm-naam-hint');
  const naam = document.getElementById('wm-naam').value.trim();
  const fout = naam ? wmNaamFout(naam) : '';
  hint.textContent = fout; hint.style.display = fout ? 'block' : 'none';
}

function wmLegeDagen() {
  const d = {};
  for (let i = 0; i < 7; i++) d[i] = { items: [] };
  return d;
}
function wmNieuw() { wmNaamModal({ soort: 'nieuw' }, 'wm.name.title.new', '', false); }
function wmOpenSaveWeek(offset) { wmNaamModal({ soort: 'week', offset: offset || 0 }, 'wm.name.title.saveWeek', '', true); }
function wmOpenPrimeOpslaan() {
  if (!isPrimeCoach() || !wmEdit || wmEdit.modus !== 'eigen') return;
  const menu = wmVind('eigen', wmEdit.id);
  if (!menu) return;
  wmNaamModal({ soort: 'prime', bronId: menu.id }, 'wm.name.title.prime', 'PRIME-' + menu.naam.replace(/^PRIME-[ ]*/i, ''), false);
}
function wmHernoem() {
  if (!wmEdit || !wmMagBewerken(wmEdit.modus)) return;
  const menu = wmVind(wmEdit.modus, wmEdit.id);
  if (menu) wmNaamModal({ soort: 'hernoem', exceptId: menu.id }, 'wm.name.title.rename', menu.naam, false);
}

async function wmNaamBevestig() {
  const doel = _wmNaamDoel;
  if (!doel) return;
  const naam = document.getElementById('wm-naam').value.trim();
  const fout = wmNaamFout(naam);
  if (fout) { const h = document.getElementById('wm-naam-hint'); h.textContent = fout; h.style.display = 'block'; return; }

  if (doel.soort === 'nieuw') {
    const menu = { id: wmNieuwId(), naam: naam, dagen: wmLegeDagen() };
    weekmenus = weekmenus.concat([menu]);
    syncSet('prime_weekmenus', weekmenus);
    wmSluitModal();
    wmOpenEditor('eigen', menu.id);
  } else if (doel.soort === 'week') {
    const offset = parseInt((document.getElementById('wm-week-kies') || {}).value, 10) || 0;
    const ma = fwStartOfWeek(offset);
    const menu = { id: wmNieuwId(), naam: naam, dagen: {} };
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(ma); d.setDate(ma.getDate() + i);
      const items = (foodDays[wpStr(d)] || []).map(wmSchoonItem);
      menu.dagen[i] = { items: items };
      n += items.length;
    }
    if (!n) { const h = document.getElementById('wm-naam-hint'); h.textContent = t('wm.week.empty'); h.style.display = 'block'; return; }
    weekmenus = weekmenus.concat([menu]);
    syncSet('prime_weekmenus', weekmenus);
    wmSluitModal();
    try { showToast(t('wm.saved')); } catch (e) { console.error(e); }
    switchFoodTab('weekmenu');
    wmOpenEditor('eigen', menu.id);
  } else if (doel.soort === 'prime') {
    const bron = wmVind('eigen', doel.bronId);
    if (!bron || !isPrimeCoach()) return;
    const kopie = JSON.parse(JSON.stringify(bron));
    kopie.id = wmNieuwId(); kopie.naam = naam;
    primeWeekmenus = primeWeekmenus.concat([kopie]);
    wmSluitModal();
    const ok = await wmBewaar('prime', kopie);
    if (!ok) primeWeekmenus = primeWeekmenus.filter(function(m) { return m.id !== kopie.id; });
    else { try { showToast(t('wm.primeSaved')); } catch (e) { console.error(e); } }
  } else if (doel.soort === 'hernoem') {
    const menu = wmVind(wmEdit.modus, wmEdit.id);
    if (menu) { menu.naam = naam; wmWijzig(wmEdit.modus, menu); }
    wmSluitModal();
    renderWeekmenus();
  }
}

// ---------- editor ----------
function wmOpenEditor(modus, id) {
  wmEdit = { modus: modus, id: id, dag: null };
  _wmDirty = false;
  switchFoodTab('weekmenu');
  renderWeekmenus();
}

async function wmTerug() {
  if (wmEdit && wmEdit.modus === 'prime' && _wmDirty && isPrimeCoach()) {
    const menu = wmVind('prime', wmEdit.id);
    if (menu) await wmBewaar('prime', menu);
  }
  wmEdit = null;
  renderWeekmenus();
}

async function wmOpslaanKlik() {
  if (!wmEdit) return;
  const menu = wmVind(wmEdit.modus, wmEdit.id);
  if (!menu || !wmMagBewerken(wmEdit.modus)) return;
  const ok = await wmBewaar(wmEdit.modus, menu);
  if (!ok) return;
  try { showToast(t('wm.saved')); } catch (e) { console.error(e); }
  wmEdit = null;
  renderWeekmenus();
}

function wmZoekItem(mid) {
  const menu = wmEdit && wmVind(wmEdit.modus, wmEdit.id);
  const dag = menu && menu.dagen[wmEdit.dag];
  const items = (dag && dag.items) || [];
  const idx = items.findIndex(function(i) { return String(i.mid) === String(mid); });
  return { menu: menu, items: items, idx: idx };
}

function wmItemHtml(it, kan) {
  const foto = typeof logItemPhoto === 'function' ? logItemPhoto(it) : null;
  const thumb = foto ? '<img src="' + wmEsc(foto) + '" alt="">' : '<span>' + (it.icon || '🍽️') + '</span>';
  const mom = WM_MOMENTEN.indexOf(it.moment) >= 0 ? it.moment : 'avond';
  const opts = WM_MOMENTEN.map(function(m) { return '<option value="' + m + '"' + (m === mom ? ' selected' : '') + '>' + t('moment.' + m) + '</option>'; }).join('');
  return '<div class="wm-item"><div class="wm-thumb">' + thumb + '</div>' +
    '<div class="wm-item-tekst"><div class="wm-item-naam">' + wmEsc(it.name) + '</div>' +
    '<div class="wm-item-meta">' + (it.gram ? Math.round(it.gram) + ' g · ' : '') + (it.kcal || 0) + ' kcal · ' + t('food.macroAbbr.protein') + (it.prot || 0) + 'g</div></div>' +
    (kan
      ? '<button type="button" class="wm-x" aria-label="' + wmEsc(t('common.delete')) + '" onclick="wmItemVerwijder(\'' + it.mid + '\')">✕</button>' +
        '<div class="wm-item-rij"><label>g <input type="number" class="wm-gram" min="1" step="1" value="' + (it.gram ? Math.round(it.gram) : '') + '" onchange="wmGram(\'' + it.mid + '\', this.value)"></label>' +
        '<select class="wm-mom" onchange="wmMoment(\'' + it.mid + '\', this.value)">' + opts + '</select></div>'
      : '') +
    '</div>';
}

function wmBouwEditor() {
  const menu = wmVind(wmEdit.modus, wmEdit.id);
  if (!menu) { wmEdit = null; return wmBouwLijst(); }
  const kan = wmMagBewerken(wmEdit.modus);
  const dagen = wmDagen(menu);
  if (wmEdit.dag === null || !(wmEdit.dag in menu.dagen)) wmEdit.dag = dagen.length ? dagen[0] : null;

  let html = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">' +
    '<button class="prog-back-btn" onclick="wmTerug()">' + t('common.back') + '</button>' +
    '<div class="prog-title-static">' + wmEsc(menu.naam) + '</div>' +
    (wmEdit.modus === 'prime' ? '<span class="prog-prime-badge">' + t('wm.label.prime') + '</span>' : '') +
    (kan ? '<button class="btn-sm' + (wmEdit.modus === 'prime' ? ' coach-only-btn' : '') + '" onclick="wmHernoem()">✏️ ' + t('wm.name.rename') + '</button>' : '') +
    '</div>';
  if (!kan) html += '<div class="wm-leesnotitie">' + t('wm.readonly') + '</div>';

  html += '<div class="wm-dagchips">';
  for (let i = 0; i < 7; i++) {
    if (i in menu.dagen) html += '<button type="button" class="wm-chip' + (i === wmEdit.dag ? ' on' : '') + '" onclick="wmKiesDag(' + i + ')">' + wpDagKort(i) + '</button>';
    else if (kan) html += '<button type="button" class="wm-chip leeg" onclick="wmDagToevoegen(' + i + ')">+ ' + wpDagKort(i) + '</button>';
  }
  html += '</div>';

  if (wmEdit.dag === null) {
    html += '<div class="card" style="text-align:center;color:var(--muted);padding:20px">' + t('wm.noDays') + '</div>';
  } else {
    const dag = menu.dagen[wmEdit.dag];
    const items = dag.items || [];
    const tot = wmDagTotalen(items);
    html += '<div class="card wm-dagkaart"><div class="wm-dagtitel"><span>' + wpDagLang(wmEdit.dag) + '</span>' +
      '<span class="wm-dagtot">' + t('wm.total', { kcal: tot.kcal, p: tot.prot, c: tot.carb, f: tot.fat }) + '</span></div>';
    if (!items.length) html += '<div style="font-size:13px;color:var(--muted);margin:6px 0 12px">' + t('wm.dayEmpty') + '</div>';
    const gezien = {};
    WM_MOMENTEN.concat(['__rest']).forEach(function(m) {
      const groep = items.filter(function(i) { return m === '__rest' ? !gezien[i.mid] : i.moment === m; });
      groep.forEach(function(i) { gezien[i.mid] = true; });
      if (!groep.length) return;
      html += '<div class="wm-moment"><div class="wm-moment-kop">' + (m === '__rest' ? t('moment.avond') : t('moment.' + m)) + '</div>' +
        groep.map(function(i) { return wmItemHtml(i, kan); }).join('') + '</div>';
    });
    if (kan) {
      html += '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn-sm" style="flex:1" onclick="wmVoegToe(\'basis\')">' + t('foodweek.addProductForDay') + '</button>' +
        '<button class="btn-sm" style="flex:1" onclick="wmVoegToe(\'addmeal\')">' + t('foodweek.addMealForDay') + '</button></div>' +
        '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn-sm" style="flex:1" onclick="wmOpenKopieer()">' + t('wm.copyDay') + '</button>' +
        '<button class="btn-sm" style="flex:0 0 auto" onclick="wmDagVerwijder()">' + t('wm.deleteDay') + '</button></div>';
    }
    html += '</div>';
  }

  if (kan) {
    html += '<div style="margin-top:18px"><button class="btn-primary' + (wmEdit.modus === 'prime' ? ' coach-only-btn' : '') + '" style="width:100%" onclick="wmOpslaanKlik()">' + t('programmas.save') + '</button>' +
      '<div style="font-size:12px;color:var(--muted);text-align:center;margin-top:8px">' + t(wmEdit.modus === 'prime' ? 'wm.primeSaveHint' : 'programmas.autosaveHint') + '</div></div>';
    if (isPrimeCoach() && wmEdit.modus === 'eigen') {
      html += '<div style="margin-top:14px"><button class="btn-sm coach-only-btn" style="width:100%" onclick="wmOpenPrimeOpslaan()">' + t('wm.asPrime') + '</button></div>';
    }
  }
  return html;
}

function wmKiesDag(i) { if (wmEdit) { wmEdit.dag = i; renderWeekmenus(); } }
function wmDagToevoegen(i) {
  const menu = wmEdit && wmVind(wmEdit.modus, wmEdit.id);
  if (!menu || !wmMagBewerken(wmEdit.modus)) return;
  if (!(i in menu.dagen)) menu.dagen[i] = { items: [] };
  wmEdit.dag = i;
  wmWijzig(wmEdit.modus, menu);
  renderWeekmenus();
}
function wmDagVerwijder() {
  const menu = wmEdit && wmVind(wmEdit.modus, wmEdit.id);
  if (!menu || wmEdit.dag === null || !wmMagBewerken(wmEdit.modus)) return;
  if (!confirm(t('wm.confirmDeleteDay'))) return;
  delete menu.dagen[wmEdit.dag];
  wmEdit.dag = null;
  wmWijzig(wmEdit.modus, menu);
  renderWeekmenus();
}
function wmItemVerwijder(mid) {
  const z = wmZoekItem(mid);
  if (!z.menu || z.idx < 0 || !wmMagBewerken(wmEdit.modus)) return;
  z.items.splice(z.idx, 1);
  wmWijzig(wmEdit.modus, z.menu);
  renderWeekmenus();
}
// Hoeveelheid wijzigen: kcal en macro's schalen mee.
function wmGram(mid, waarde) {
  const z = wmZoekItem(mid);
  const nieuw = parseFloat(waarde);
  if (!z.menu || z.idx < 0 || !(nieuw > 0) || !wmMagBewerken(wmEdit.modus)) { renderWeekmenus(); return; }
  const it = z.items[z.idx];
  const oud = it.gram > 0 ? it.gram : nieuw;
  const f = nieuw / oud;
  it.gram = Math.round(nieuw);
  it.kcal = Math.round((it.kcal || 0) * f);
  ['prot', 'carb', 'fat'].forEach(function(k) { it[k] = Math.round((it[k] || 0) * f * 10) / 10; });
  wmWijzig(wmEdit.modus, z.menu);
  renderWeekmenus();
}
function wmMoment(mid, moment) {
  const z = wmZoekItem(mid);
  if (!z.menu || z.idx < 0 || !wmMagBewerken(wmEdit.modus)) return;
  z.items[z.idx].moment = moment;
  wmWijzig(wmEdit.modus, z.menu);
  renderWeekmenus();
}

// ---------- items toevoegen via de bestaande keuzeschermen ----------
// "+ Product" en "+ Gerecht" openen de gewone lijsten; bij het toevoegen in het portiescherm komt het item (in plaats
// van in een dag) in het weekmenu en ga je terug naar de editor (zie wmOnItemAdded, aangeroepen in food.js).
function wmVoegToe(tab) {
  if (!wmEdit || wmEdit.dag === null || !wmMagBewerken(wmEdit.modus)) return;
  _wmContext = { modus: wmEdit.modus, id: wmEdit.id, dag: wmEdit.dag };
  _portionReturnTab = 'weekmenu';
  switchFoodTab(tab);
}
function wmOnItemAdded(values) {
  if (!_wmContext) return false;
  const ctx = _wmContext;
  const menu = wmVind(ctx.modus, ctx.id);
  if (menu && menu.dagen[ctx.dag]) {
    const item = wmSchoonItem(values);
    menu.dagen[ctx.dag].items.push(item);
    wmWijzig(ctx.modus, menu);
    if (ctx.modus === 'prime') wmBewaar('prime', menu);
  }
  try { closePortionModal(); } catch (e) { console.error(e); }
  try { closeMealPortionModal(); } catch (e) { console.error(e); }
  wmEdit = { modus: ctx.modus, id: ctx.id, dag: ctx.dag };
  _wmContext = null;
  switchFoodTab('weekmenu');
  try { showToast(t('wm.itemAdded')); } catch (e) { console.error(e); }
  return true;
}
// Portiescherm en gerechtscherm: dagkeuze verbergen en knoptekst aanpassen zolang je voor een weekmenu toevoegt.
function wmPasModalsAan() {
  const ctx = !!_wmContext;
  [['pm-date-row', 'pm-submit-btn'], ['mpm-date-row', 'mpm-submit-btn']].forEach(function(p) {
    const rij = document.getElementById(p[0]); if (rij) rij.style.display = ctx ? 'none' : 'flex';
    const knop = document.getElementById(p[1]); if (knop && ctx) knop.textContent = t('wm.addToMenu');
  });
}

// ---------- dag kopiëren binnen het menu ----------
function wmOpenKopieer() {
  const menu = wmEdit && wmVind(wmEdit.modus, wmEdit.id);
  if (!menu || wmEdit.dag === null) return;
  const items = menu.dagen[wmEdit.dag].items || [];
  const aanwezig = WM_MOMENTEN.filter(function(m) { return items.some(function(i) { return i.moment === m; }); });
  const momOpts = aanwezig.map(function(m) { return '<option value="' + m + '">' + t('moment.' + m) + '</option>'; }).join('');
  let dagen = '';
  for (let i = 0; i < 7; i++) {
    if (i === wmEdit.dag) continue;
    dagen += '<label class="wm-dagkeuze"><span>' + wpDagKort(i) + '</span><input type="checkbox" class="wm-kopie-dag" value="' + i + '"></label>';
  }
  wmModal('<div class="modal-title"><span>' + t('wm.copy.title') + '</span><button class="modal-close" onclick="wmSluitModal()">×</button></div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">' + t('wm.copy.from', { dag: wpDagLang(wmEdit.dag) }) + '</div>' +
    '<div class="form-row"><label>' + t('wm.copy.what') + '</label>' +
    '<label class="wm-radio"><input type="radio" name="wm-scope" value="all" checked> ' + t('wm.copy.all') + '</label>' +
    (aanwezig.length ? '<label class="wm-radio"><input type="radio" name="wm-scope" value="moment"> ' + t('wm.copy.onlyMoment') + ' <select id="wm-kopie-moment">' + momOpts + '</select></label>' : '') + '</div>' +
    '<div class="form-row"><label>' + t('wm.copy.to') + '</label><div class="wm-dagkeuzes">' + dagen + '</div></div>' +
    '<label class="wm-radio" style="margin:6px 0"><input type="checkbox" id="wm-kopie-vervang" checked> ' + t('wm.copy.replace') + '</label>' +
    '<div id="wm-kopie-fout" style="display:none;font-size:12px;font-weight:600;color:#c0392b;margin:6px 0"></div>' +
    '<div style="display:flex;gap:10px;margin-top:12px"><button class="btn-primary" style="flex:1" onclick="wmKopieerUitvoeren()">' + t('foodweek.copy.confirm') + '</button>' +
    '<button class="btn-sm" style="flex:0 0 auto;padding:0 18px" onclick="wmSluitModal()">' + t('note.cancel') + '</button></div>');
}
function wmKopieerUitvoeren() {
  const menu = wmEdit && wmVind(wmEdit.modus, wmEdit.id);
  if (!menu || wmEdit.dag === null || !wmMagBewerken(wmEdit.modus)) return;
  const doelen = [].slice.call(document.querySelectorAll('.wm-kopie-dag')).filter(function(c) { return c.checked; }).map(function(c) { return parseInt(c.value, 10); });
  if (!doelen.length) { const f = document.getElementById('wm-kopie-fout'); f.textContent = t('wm.copy.choose'); f.style.display = 'block'; return; }
  const alleen = (document.querySelector('input[name="wm-scope"]:checked') || {}).value === 'moment';
  const moment = alleen ? document.getElementById('wm-kopie-moment').value : null;
  const vervang = document.getElementById('wm-kopie-vervang').checked;
  const bron = (menu.dagen[wmEdit.dag].items || []).filter(function(i) { return !alleen || i.moment === moment; });
  doelen.forEach(function(d) {
    if (!(d in menu.dagen)) menu.dagen[d] = { items: [] };
    if (vervang) menu.dagen[d].items = menu.dagen[d].items.filter(function(i) { return alleen && i.moment !== moment; });
    bron.forEach(function(i) { menu.dagen[d].items.push(Object.assign({}, i, { mid: newLogId() })); });
  });
  wmWijzig(wmEdit.modus, menu);
  wmSluitModal();
  renderWeekmenus();
  try { showToast(t('wm.copy.done', { n: doelen.length })); } catch (e) { console.error(e); }
}

// ---------- laden in de Weekplanning ----------
function wmOpenLaden(modus, id) {
  const menu = wmVind(modus, id);
  if (!menu) return;
  _wmLaad = { modus: modus, id: id };
  const metItems = wmDagen(menu).filter(function(d) { return (menu.dagen[d].items || []).length; });
  if (!metItems.length) { alert(t('wm.load.empty')); return; }
  const chips = metItems.map(function(d) {
    return '<label class="wm-dagkeuze"><span>' + wpDagKort(d) + '</span><input type="checkbox" class="wm-laad-dag" value="' + d + '" checked onchange="wmLaadPreview()"></label>';
  }).join('');
  wmModal('<div class="modal-title"><span>' + t('wm.load.title') + '</span><button class="modal-close" onclick="wmSluitModal()">×</button></div>' +
    '<div style="font-weight:700;margin-bottom:12px">' + wmEsc(menu.naam) + '</div>' +
    '<div class="form-row"><label>' + t('wm.load.start') + '</label><input type="date" id="wm-laad-start" value="' + fdTodayStr() + '" onchange="wmLaadPreview()"></div>' +
    '<div class="form-row"><label>' + t('wm.load.weeks') + '</label><input type="number" id="wm-laad-weken" min="1" max="52" step="1" value="4" oninput="wmLaadPreview()"></div>' +
    '<div class="form-row"><label>' + t('wm.load.days') + '</label><div class="wm-dagkeuzes">' + chips + '</div></div>' +
    '<label class="wm-radio" style="margin:6px 0"><input type="checkbox" id="wm-laad-skip" checked onchange="wmLaadPreview()"> ' + t('wm.load.skip') + '</label>' +
    '<div id="wm-laad-preview" class="wm-preview"></div>' +
    '<div style="display:flex;gap:10px;margin-top:12px"><button class="btn-primary" style="flex:1" onclick="wmLaadUitvoeren()">' + t('wm.load.go') + '</button>' +
    '<button class="btn-sm" style="flex:0 0 auto;padding:0 18px" onclick="wmSluitModal()">' + t('note.cancel') + '</button></div>');
  wmLaadPreview();
}

// Welke datums worden gevuld, overgeslagen (al voeding) of zijn voorbij.
function wmLaadBereken() {
  const menu = _wmLaad && wmVind(_wmLaad.modus, _wmLaad.id);
  const res = { plan: [], overslaan: 0, voorbij: 0, menu: menu };
  if (!menu) return res;
  const startVal = (document.getElementById('wm-laad-start') || {}).value;
  const weken = Math.min(52, Math.max(1, parseInt((document.getElementById('wm-laad-weken') || {}).value, 10) || 1));
  if (!startVal) return res;
  const dagen = [].slice.call(document.querySelectorAll('.wm-laad-dag')).filter(function(c) { return c.checked; }).map(function(c) { return parseInt(c.value, 10); });
  const skip = !!(document.getElementById('wm-laad-skip') || {}).checked;
  const cur = wpDate(startVal);
  for (let n = 0; n < weken * 7; n++) {
    const wd = cur.getDay() === 0 ? 6 : cur.getDay() - 1; // 0 = maandag
    const dateStr = wpStr(cur);
    const dag = menu.dagen[wd];
    if (dagen.indexOf(wd) >= 0 && dag && (dag.items || []).length) {
      if (isDagAfgesloten(dateStr)) res.voorbij++;
      else if (skip && (foodDays[dateStr] || []).length) res.overslaan++;
      else res.plan.push({ dateStr: dateStr, wd: wd });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return res;
}
function wmLaadPreview() {
  const el = document.getElementById('wm-laad-preview');
  if (!el) return;
  const r = wmLaadBereken();
  let tekst = t('wm.load.preview', { n: r.plan.length });
  if (r.overslaan) tekst += ' · ' + t('wm.load.skipped', { n: r.overslaan });
  if (r.voorbij) tekst += ' · ' + t('wm.load.past', { n: r.voorbij });
  el.textContent = tekst;
}
function wmLaadUitvoeren() {
  const r = wmLaadBereken();
  if (!r.menu) return;
  if (!r.plan.length) { alert(t('wm.load.none')); return; }
  r.plan.forEach(function(p) {
    const kopieen = r.menu.dagen[p.wd].items.map(function(it) {
      const c = Object.assign({}, it, { logId: newLogId(), eaten: false });
      delete c.mid;
      return c;
    });
    foodDays[p.dateStr] = (foodDays[p.dateStr] || []).concat(kopieen);
    if (p.dateStr === currentLogDate) dayLog = [].concat(foodDays[p.dateStr]);
  });
  syncSet('prime_food_days', foodDays);
  wmSluitModal();
  const start = wpMaandagVanaf(wpDate(r.plan[0].dateStr));
  fwWeekOffset = Math.round((start - fwStartOfWeek(0)) / (7 * 86400000));
  fwOpenDag = null;
  try { updateMacroTotals(); } catch (e) { console.error(e); }
  try { updateLogBadge(); } catch (e) { console.error(e); }
  switchFoodTab('week');
  try { showToast(t('wm.load.done', { n: r.plan.length })); } catch (e) { console.error(e); }
}
