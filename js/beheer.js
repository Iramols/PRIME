// ========== COACH BEHEER ==========
// Opgeslagen foto-overrides in localStorage
function getCustomPhotos() {
  try { return JSON.parse(localStorage.getItem('prime_custom_photos') || '{}'); } catch(e) { return {}; }
}
function saveCustomPhotos(photos) {
  try {
    localStorage.setItem('prime_custom_photos', JSON.stringify(photos));
    return true;
  } catch (e) {
    // Bv. QuotaExceededError zodra alle losse foto-overrides samen de
    // opslaglimiet van de browser raken -- zonder deze try/catch stopte
    // de aanroepende functie (handlePhotoUpload/resetPhoto) hier stil, met
    // een niet-bijgewerkt scherm tot gevolg (leek alsof de upload-knop
    // niets deed). Nu krijgt de coach een duidelijke melding i.p.v. een
    // hapering, zie de aanroepers hieronder.
    console.error('saveCustomPhotos: localStorage.setItem faalde:', e);
    return false;
  }
}

// Laad foto's uit custom-photos.json (voor online gebruik) en merge met localStorage
// Let op: callback is init() zelf (zie loadPhotosFromFile(init) in app.js) --
// de HELE app verschijnt pas als deze functie 'm aanroept. Vroeger gebeurde
// dat pas na een fetch() zonder tijdslimiet en met een bij elke paginalading
// wisselende link (Date.now()) -- zonder internet kon dat dus de volle
// (10-30+ sec.) netwerk-timeout duren vóórdat de app zichtbaar werd, en werd
// dit bestand ook nooit uit de cache van de service worker bediend. Zelfde
// reparatie als bij loadAppScripts() in auth.js: PRIME_BUILD i.p.v. Date.now()
// voor een stabiele, cachebare link, plus withTimeout() (cloud.js) als vangnet.
function loadPhotosFromFile(callback) {
  var done = function() { applyCustomPhotos(); if (callback) callback(); };
  try {
    var url = './custom-photos.json?v=' + (window.PRIME_BUILD || Date.now());
    withTimeout(fetch(url), 3000, null)
      .then(function(r) { return (r && r.ok) ? r.json() : Promise.reject(); })
      .then(function(filePhotos) {
        if (filePhotos && typeof filePhotos === 'object' && Object.keys(filePhotos).length > 0) {
          var local = getCustomPhotos();
          // Bestand is de basis, lokale uploads overschrijven (nieuwer)
          var merged = Object.assign({}, filePhotos, local);
          saveCustomPhotos(merged);
        }
        done();
      })
      .catch(done);
  } catch(e) { done(); }
}

// Exporteer alle custom foto's als custom-photos.json (sla op in projectmap en push)
function exportCustomPhotosFile() {
  var photos = getCustomPhotos();
  if (Object.keys(photos).length === 0) {
    alert(t('beheer.noCustomPhotos'));
    return;
  }
  var json = JSON.stringify(photos, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'custom-photos.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function switchBeheerTab(tab) {
  ['training','producten'].forEach(t => {
    document.getElementById('btab-' + t).classList.toggle('active', t === tab);
    document.getElementById('btab-content-' + t).style.display = t === tab ? 'block' : 'none';
  });
  renderBeheerTab(tab);
}

function renderBeheerTab(tab) {
  try {
  const photos = getCustomPhotos();
  let items = [];

  if (tab === 'training') {
    var typeLabel = {herstel:t('beheer.group.recovery'), normaal:t('beheer.group.normal'), zwaar:t('beheer.group.heavy')};
    ['herstel','normaal','zwaar'].forEach(function(type) {
      (EXERCISES[type] || []).forEach(function(ex) {
        if (!items.find(function(i) { return i.key === 'ex-' + ex.name; }))
          items.push({ key: 'ex-' + ex.name, label: dispName(ex), group: typeLabel[type], currentPhoto: photos['ex-' + ex.name] || ex.photo || '' });
        (ex.alts || []).forEach(function(alt) {
          if (!items.find(function(i) { return i.key === 'ex-' + alt.name; }))
            items.push({ key: 'ex-' + alt.name, label: dispName(alt), group: typeLabel[type] + t('beheer.group.alts'), currentPhoto: photos['ex-' + alt.name] || alt.photo || '' });
        });
      });
    });
    EXTRA_EXERCISES.forEach(function(group) {
      group.exercises.forEach(function(ex) {
        if (!items.find(function(i) { return i.key === 'ex-' + ex.name; })) {
          items.push({ key: 'ex-' + ex.name, label: dispName(ex), group: group.group, currentPhoto: photos['ex-' + ex.name] || ex.photo || '' });
        }
      });
    });
    items = items.filter(function(item, idx, self) { return self.findIndex(function(i) { return i.key === item.key; }) === idx; });
  } else if (tab === 'producten') {
    var catLabel = {fruit:t('cat.fruit'), groente:t('cat.groente'), vlees:t('cat.vlees'), vis:t('cat.vis'), zuivel:t('cat.zuivel'), granen:t('cat.granen'), noten:t('cat.noten'), overig:t('cat.overig')};
    PRODUCTS.forEach(function(p) {
      var cat = catLabel[p.cat] || p.cat || t('cat.overig');
      items.push({ key: 'prod-' + p.name, label: dispName(p), group: cat, currentPhoto: photos['prod-' + p.name] || p.photo || '' });
    });
  }

  // Groepeer
  var groups = {};
  items.forEach(function(item) {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  });

  var el = document.getElementById('btab-content-' + tab);
  var html = '';

  Object.keys(groups).forEach(function(group) {
    html += '<div style="margin-bottom:24px">';
    html += '<div style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:12px">' + group + '</div>';
    html += '<div style="display:flex;flex-direction:column;gap:10px">';

    groups[group].forEach(function(item) {
      var isCustom = item.currentPhoto && item.currentPhoto.startsWith('data:');
      var safeKey = item.key.replace(/'/g, "\\'");
      var safeTab = tab.replace(/'/g, "\\'");

      html += '<div class="card" style="padding:12px 16px;display:flex;align-items:center;gap:14px">';

      // Foto preview
      html += '<div style="width:64px;height:48px;border-radius:8px;flex-shrink:0;overflow:hidden;background:var(--sand)">';
      if (item.currentPhoto) {
        html += '<img src="' + item.currentPhoto + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'">';
      } else {
        html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:10px">' + t('beheer.noCustomPhoto') + '</div>';
      }
      html += '</div>';

      // Label
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-weight:600;font-size:13px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + item.label + '</div>';
      html += isCustom
        ? '<div style="font-size:10px;color:var(--sage)">' + t('beheer.customActive') + ' · ' + t('photo.maxHint') + '</div>'
        : '<div style="font-size:10px;color:var(--muted)">' + t('beheer.defaultPhoto') + ' · ' + t('photo.maxHint') + '</div>';
      html += '</div>';

      // Knoppen
      html += '<div style="display:flex;gap:8px;flex-shrink:0">';
      html += '<label style="cursor:pointer">';
      html += '<input type="file" accept="image/*" style="display:none" onchange="handlePhotoUpload(event,\'' + safeKey + '\',\'' + safeTab + '\')">';
      html += '<span style="font-size:12px;padding:6px 12px;border-radius:8px;border:1px solid var(--sage);color:var(--sage);font-weight:600;white-space:nowrap">' + t('beheer.upload') + '</span>';
      html += '</label>';
      if (isCustom) {
        html += '<button onclick="resetPhoto(\'' + safeKey + '\',\'' + safeTab + '\')" style="font-size:12px;padding:6px 10px;border-radius:8px;border:1px solid var(--sand-dark);background:none;color:var(--muted);cursor:pointer">' + t('beheer.reset') + '</button>';
      }
      html += '</div>';

      html += '</div>'; // card
    });

    html += '</div></div>'; // group
  });

  el.innerHTML = html;
  } catch(err) {
    document.getElementById('btab-content-' + tab).innerHTML =
      '<div class="card" style="color:red;padding:16px">' + t('beheer.loadError', { msg: err.message }) + '</div>';
    console.error('renderBeheerTab error:', err);
  }
}


function handlePhotoUpload(event, key, tab) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > MAX_PHOTO_BYTES) {
    alert(t('beheer.photoTooBig', { kb: Math.round(file.size / 1024), max: MAX_PHOTO_BYTES / 1024 }));
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const photos = getCustomPhotos();
    photos[key] = e.target.result;
    if (!saveCustomPhotos(photos)) { alert(t('beheer.storageFullError')); return; }
    applyCustomPhotos();
    renderBeheerTab(tab);
  };
  reader.readAsDataURL(file);
}

function resetPhoto(key, tab) {
  const photos = getCustomPhotos();
  photos[key] = null; // null overschrijft de bestandsversie ook na refresh
  if (!saveCustomPhotos(photos)) { alert(t('beheer.storageFullError')); return; }
  applyCustomPhotos();
  renderBeheerTab(tab);
}

function applyCustomPhotos() {
  const photos = getCustomPhotos();
  // custom-photos.json bevat oude Pexels-links per oefeningnaam. Heeft een oefening
  // inmiddels een eigen foto in images/ (bv. de nieuwe illustraties), dan mag zo'n
  // oude link die niet meer overschrijven. Zelf geüploade foto's (data-URL) wél.
  const magOverschrijven = (huidig, nieuw) => !(huidig && String(huidig).indexOf('images/') === 0 && String(nieuw).indexOf('https://images.pexels.com/') === 0);
  // Pas toe op EXERCISES
  ['herstel','normaal','zwaar'].forEach(type => {
    (EXERCISES[type] || []).forEach(ex => {
      if (photos['ex-' + ex.name] && magOverschrijven(ex.photo, photos['ex-' + ex.name])) ex.photo = photos['ex-' + ex.name];
      (ex.alts || []).forEach(alt => {
        if (photos['ex-' + alt.name] && magOverschrijven(alt.photo, photos['ex-' + alt.name])) alt.photo = photos['ex-' + alt.name];
      });
    });
  });
  // Pas toe op EXTRA_EXERCISES
  EXTRA_EXERCISES.forEach(group => {
    group.exercises.forEach(ex => {
      if (photos['ex-' + ex.name] && magOverschrijven(ex.photo, photos['ex-' + ex.name])) ex.photo = photos['ex-' + ex.name];
    });
  });
  // Pas toe op MEALS
  ['herstel','normaal','zwaar'].forEach(type => {
    const data = MEALS[type] || {};
    ['ontbijt','lunch','avond','snack'].forEach(moment => {
      (data[moment] || []).forEach(meal => {
        if (photos['meal-' + meal.name]) meal.photo = photos['meal-' + meal.name];
      });
    });
  });
  // Pas toe op PRODUCTS (flat array)
  (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []).forEach(function(p) {
    if (photos['prod-' + p.name]) p.photo = photos['prod-' + p.name];
  });
}


// ========== CONFIG (alleen coach): opties per klant aan/uit zetten ==========
// Matrix: klanten onder elkaar, opties als kolommen met een schuifje per klant en bovenaan een kolom "alles aan / uit".
// De waarden staan in het profiel van de klant (client_state.prime_profile). Een nieuwe optie toevoegen = één regel bij
// CONFIG_OPTIES (+ vertalingen). 'standaard' bepaalt wanneer een klant als afwijkend (oranje rand) wordt getoond.
// Een optie kan een 'aantal' hebben (− / +): een getal dat bij de optie hoort, zoals het aantal regels van de toelichting.
const CONFIG_OPTIES = [
  {
    key: 'trainingEnabled',
    label: 'config.opt.training',
    hint: 'config.opt.trainingHint',
    standaard: true,
    get: function(p) { return p.trainingEnabled !== false; },
    set: function(p, v) { p.trainingEnabled = !!v; }
  },
  {
    key: 'noteEnabled',
    label: 'config.opt.note',
    hint: 'config.opt.noteHint',
    standaard: false,
    get: function(p) { return p.noteEnabled === true; },
    set: function(p, v) { p.noteEnabled = !!v; if (v && !(parseInt(p.noteLines, 10) >= 1)) p.noteLines = 4; },
    aantal: {
      key: 'noteLines',
      eenheid: 'config.lines',
      min: 1,
      max: 10,
      standaard: 4,
      get: function(p) { const n = parseInt(p.noteLines, 10); return n >= 1 && n <= 10 ? n : 4; },
      set: function(p, v) { p.noteLines = v; }
    }
  }
];

let _configKlanten = []; // klant-id's met een profiel, uit de laatste weergave (voor "alles aan/uit")

function _configStapHtml(clientId, o, prof, aan) {
  const a = o.aantal;
  const w = a.get(prof);
  return '<span class="cfg-stap' + (aan ? '' : ' uit') + '" data-w="' + w + '">' +
    '<button type="button" class="cfg-stap-knop" aria-label="-" onclick="configStap(\'' + clientId + '\', \'' + o.key + '\', -1, this)">−</button>' +
    '<span class="cfg-stap-w' + (w !== a.standaard ? ' afw' : '') + '">' + t(a.eenheid, { n: w }) + '</span>' +
    '<button type="button" class="cfg-stap-knop" aria-label="+" onclick="configStap(\'' + clientId + '\', \'' + o.key + '\', 1, this)">+</button></span>';
}

async function renderConfigTab() {
  const el = document.getElementById('config-content');
  if (!el || !isPrimeCoach()) return;
  if (await probeOfflineNow()) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:24px;color:var(--muted)">' + t('config.offline') + '</div>';
    return;
  }
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">' + t('signalen.loading') + '</div>';
  let clients;
  try { clients = await fetchClientList(); }
  catch (e) { console.error('renderConfigTab, fetchClientList:', e); el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">' + t('signalen.loadError') + '</div>'; return; }
  let namen = {};
  try { namen = await fetchProfileNames(); } catch (e) { /* namen zijn optioneel */ }
  if (!clients.length) { el.innerHTML = '<div class="card" style="text-align:center;padding:24px;color:var(--muted)">' + t('config.noClients') + '</div>'; return; }

  const rijen = [];
  _configKlanten = [];
  for (const c of clients) {
    let prof = null;
    try { const data = await fetchClientStateFor(c.id, ['prime_profile']); prof = data.prime_profile || null; } catch (e) { console.error(e); }
    if (prof) _configKlanten.push(c.id);
    const naam = _fbEsc(namen[c.id] || c.display_name || c.id);
    const cellen = CONFIG_OPTIES.map(function(o) {
      if (!prof) return '<td class="cfg-leeg">–</td>';
      const aan = o.get(prof);
      const afw = aan !== o.standaard;
      return '<td><label class="cfg-sw' + (afw ? ' afw' : '') + '"><input type="checkbox" ' + (aan ? 'checked ' : '') +
        'onchange="configZet(\'' + c.id + '\', \'' + o.key + '\', this.checked, this)"><span class="cfg-sl"></span></label>' +
        (o.aantal ? _configStapHtml(c.id, o, prof, aan) : '') + '</td>';
    }).join('');
    rijen.push('<tr><td class="cfg-naam">' + naam + (prof ? '' : '<span class="cfg-geen">' + t('config.noProfile') + '</span>') + '</td>' + cellen + '</tr>');
  }
  const kop = CONFIG_OPTIES.map(function(o) {
    return '<th>' + t(o.label) +
      '<span class="cfg-alle"><a href="#" onclick="configAlles(\'' + o.key + '\', true);return false">' + t('config.allOn') + '</a> · ' +
      '<a href="#" onclick="configAlles(\'' + o.key + '\', false);return false">' + t('config.allOff') + '</a></span></th>';
  }).join('');
  el.innerHTML = '<div class="card cfg-kaart"><div class="cfg-scroll"><table class="cfg-tabel"><thead><tr><th>' + t('config.clientCol') + '</th>' + kop + '</tr></thead><tbody>' +
    rijen.join('') + '</tbody></table></div><div class="cfg-legenda">' + t('config.legend') + '</div></div>';
}

// Schrijft één optie (of het aantal van een optie, bij deel) voor één klant. Leest het profiel van die klant vers uit de
// cloud, wijzigt alleen dit veld en schrijft het terug, zodat andere profielgegevens (naam, doelen) niet worden
// overschreven. true = gelukt.
async function _configSchrijf(clientId, optie, waarde, deel) {
  const data = await fetchClientStateFor(clientId, ['prime_profile']);
  if (!data.prime_profile) return false;
  const prof = Object.assign({}, data.prime_profile);
  (deel || optie).set(prof, waarde);
  const res = await getSupabase().from('client_state').upsert({ client_id: clientId, key: 'prime_profile', value: prof, updated_at: new Date().toISOString() });
  if (res.error) throw res.error;
  // Staat deze klant nu open in deze sessie, dan meteen ook lokaal bijwerken.
  if (clientId === activeClientId) {
    (deel || optie).set(profile, waarde);
    syncSet('prime_profile', profile);
    try { applyTrainingVisibility(); } catch (e) { console.error(e); }
    try { if (typeof renderNoteUI === 'function') renderNoteUI(true); } catch (e) { console.error(e); }
  }
  return true;
}

async function configZet(clientId, optieKey, waarde, vinkje) {
  const optie = CONFIG_OPTIES.find(function(o) { return o.key === optieKey; });
  if (!optie || !isPrimeCoach()) return;
  const terug = function() { if (vinkje) vinkje.checked = !waarde; };
  if (await probeOfflineNow()) { try { showToast(t('config.offline'), true); } catch (e) {} terug(); return; }
  try {
    const gelukt = await _configSchrijf(clientId, optie, waarde);
    if (!gelukt) { try { showToast(t('config.noProfile'), true); } catch (e) {} terug(); return; }
    if (vinkje && vinkje.parentNode) {
      vinkje.parentNode.classList.toggle('afw', waarde !== optie.standaard);
      const stap = vinkje.parentNode.parentNode.querySelector('.cfg-stap');
      if (stap) stap.classList.toggle('uit', !waarde);
    }
    try { showToast(t('config.saved')); } catch (e) {}
  } catch (e) {
    console.error('configZet:', e);
    try { showToast(t('config.saveFailed'), true); } catch (e2) {}
    terug();
  }
}

// Het getal bij een optie (bv. aantal regels) met − of + verhogen of verlagen.
async function configStap(clientId, optieKey, delta, knop) {
  const optie = CONFIG_OPTIES.find(function(o) { return o.key === optieKey; });
  if (!optie || !optie.aantal || !isPrimeCoach() || !knop) return;
  const a = optie.aantal;
  const cel = knop.closest('.cfg-stap');
  if (!cel || cel.classList.contains('bezig')) return;
  const huidig = parseInt(cel.dataset.w, 10);
  const nieuw = Math.min(a.max, Math.max(a.min, huidig + delta));
  if (nieuw === huidig) return;
  if (await probeOfflineNow()) { try { showToast(t('config.offline'), true); } catch (e) {} return; }
  cel.classList.add('bezig');
  try {
    const gelukt = await _configSchrijf(clientId, optie, nieuw, a);
    if (!gelukt) { try { showToast(t('config.noProfile'), true); } catch (e) {} return; }
    cel.dataset.w = nieuw;
    const w = cel.querySelector('.cfg-stap-w');
    if (w) { w.textContent = t(a.eenheid, { n: nieuw }); w.classList.toggle('afw', nieuw !== a.standaard); }
    try { showToast(t('config.saved')); } catch (e) {}
  } catch (e) {
    console.error('configStap:', e);
    try { showToast(t('config.saveFailed'), true); } catch (e2) {}
  } finally {
    cel.classList.remove('bezig');
  }
}

// "Alles aan" / "alles uit" voor één optie bij alle klanten met een profiel (met een bevestiging vooraf).
async function configAlles(optieKey, waarde) {
  const optie = CONFIG_OPTIES.find(function(o) { return o.key === optieKey; });
  if (!optie || !isPrimeCoach() || !_configKlanten.length) return;
  if (!confirm(t('config.confirmAll', { optie: t(optie.label), stand: t(waarde ? 'config.on' : 'config.off'), n: _configKlanten.length }))) return;
  if (await probeOfflineNow()) { try { showToast(t('config.offline'), true); } catch (e) {} return; }
  let ok = 0, fout = 0;
  for (const id of _configKlanten.slice()) {
    try { if (await _configSchrijf(id, optie, waarde)) ok++; else fout++; }
    catch (e) { console.error('configAlles:', e); fout++; }
  }
  try { showToast(fout ? t('config.bulkPartly', { n: ok, f: fout }) : t('config.bulkDone', { n: ok }), !!fout); } catch (e) {}
  renderConfigTab();
}
