// ========== WATER (Dashboard, onder de dagstatus-kaart) ==========
// Per dag bijhouden hoeveel er gedronken is. De klant kiest een glas, een fles (500 of 1000 ml, de inhoud is aanpasbaar) of een eigen
// hoeveelheid, kiest het aantal en tikt op Toevoegen. Opslag: client_state, key prime_water:
//   { doel: eigen dagdoel in ml (leeg = berekend), glas: 250, eigen: 300, fles: { f500: 500, f1000: 1000 } (eigen inhoud per fles), dagen: { 'JJJJ-MM-DD': [ { id, t:'UU:MM', s:'glas'|'fles'|'eigen', u: ml per stuk, n: aantal, ml: totaal } ] } }
// De coach zet water per klant aan/uit in Config (profile.waterEnabled, standaard aan). Doel: standaard 2000 ml, zelf aan te passen. De kaart wordt als onderdeel van renderDagStatusKaart() (checkin.js) in dezelfde
// plekken (.dagstatus-slot) gezet, dus er staan meerdere kopieën in de pagina: daarom geen id's, alleen onclick.
let waterData = (function() {
  try { const w = JSON.parse(localStorage.getItem('prime_water') || '{}'); return (w && typeof w === 'object') ? w : {}; }
  catch (e) { return {}; }
})();

const WATER_TEGELS = [
  { id: 'glas', icoon: 'glas' },
  { id: 'f500', icoon: 'fles', ml: 500 },
  { id: 'f1000', icoon: 'fles-hoog', ml: 1000 },
  { id: 'eigen', icoon: '✏️' }
];
// Getekende icoontjes (geen emoji: die bestaat niet voor een glas water of waterfles). Vaste blauwe tinten, expliciete paden (geen clipPath: de kaart staat meerdere keren in de pagina).
function waterIcoonHtml(naam) {
  const lijn = 'fill="none" stroke="#185FA5" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"';
  const water = 'fill="#85B7EB" stroke="none"';
  const bel = 'fill="#E6F1FB" stroke="none"';
  let inhoud;
  if (naam === 'glas') {
    inhoud = '<path d="M4.7 9H19.3L18.2 25Q18.1 26.5 16.6 26.5H7.4Q5.9 26.5 5.8 25Z" ' + water + '/>' +
      '<circle cx="10" cy="14" r="0.9" ' + bel + '/><circle cx="14.5" cy="17" r="1" ' + bel + '/><circle cx="11" cy="20" r="0.8" ' + bel + '/><circle cx="15" cy="12" r="0.7" ' + bel + '/>' +
      '<path d="M4 3H20L18.2 25Q18.1 26.5 16.6 26.5H7.4Q5.9 26.5 5.8 25Z" ' + lijn + '/>' +
      '<path d="M6.2 22H17.8" ' + lijn + ' stroke-width="1"/>';
  } else {
    const o = naam === 'fles-hoog' ? 0 : 4; // 1000 ml is hoger dan 500 ml
    const w = 15 + o + 4;
    inhoud = '<path d="M5.5 ' + w + 'H18.5V25Q18.5 27 16.5 27H7.5Q5.5 27 5.5 25Z" ' + water + '/>' +
      '<circle cx="10" cy="' + (w + 3) + '" r="0.9" ' + bel + '/><circle cx="14" cy="' + (w + 6) + '" r="1" ' + bel + '/><circle cx="9.5" cy="' + (w + 8) + '" r="0.7" ' + bel + '/>' +
      '<path d="M9.5 ' + (4 + o) + 'V' + (7 + o) + 'C9.5 ' + (9.5 + o) + ' 5.5 ' + (10 + o) + ' 5.5 ' + (14 + o) + 'V25Q5.5 27 7.5 27H16.5Q18.5 27 18.5 25V' + (14 + o) + 'C18.5 ' + (10 + o) + ' 14.5 ' + (9.5 + o) + ' 14.5 ' + (7 + o) + 'V' + (4 + o) + '" ' + lijn + '/>' +
      '<rect x="8.8" y="' + (1 + o) + '" width="6.4" height="3.2" rx="0.8" fill="#7B8794" stroke="#185FA5" stroke-width="1"/>';
  }
  return '<svg width="24" height="28" viewBox="0 0 24 28" aria-hidden="true">' + inhoud + '</svg>';
}
const WATER_DOEL_STANDAARD = 2000; // advies is 2 tot 3 liter per dag; iedereen bepaalt zelf het doel, standaard 2 liter
const WATER_MAX_DAGEN = 400;
const WATER_DOEL_LIMIETEN = [500, 6000];
let _waterDoelOpen = false; // het doel-invoerveld staat open
let _waterDoelInvoer = null; // getypt doel (nog niet bewaard)
let _waterSel = 'glas';
let _waterAantal = 1;
let _waterInvoer = null; // getypte waarde (eigen hoeveelheid of fleshoud) die nog niet geldig hoeft te zijn; null = niet getypt
const WATER_LIMIETEN = { eigen: [10, 2000], fles: [100, 3000] };

function waterAan() { return profile.waterEnabled !== false; }
function waterGlasMl() { return waterData.glas > 0 ? waterData.glas : 250; }
function waterEigenMl() { return waterData.eigen > 0 ? waterData.eigen : 300; }
function waterLijst(dag) { return (waterData.dagen && waterData.dagen[dag]) || []; }
function waterTotaal(dag) { return waterLijst(dag).reduce(function(a, x) { return a + (x.ml || 0); }, 0); }
function waterFmt(n) { return Math.round(n).toLocaleString(dateLocale()); }
function waterBewaar() { syncSet('prime_water', waterData); }

// Het dagdoel: een eigen doel (klant of coach), anders 2000 ml. Het advies (2 tot 3 liter) staat als tekst onder de balk.
function waterDoelInfo() {
  if (waterData.doel >= WATER_DOEL_LIMIETEN[0] && waterData.doel <= WATER_DOEL_LIMIETEN[1]) return { ml: Math.round(waterData.doel), soort: 'eigen' };
  return { ml: WATER_DOEL_STANDAARD, soort: 'standaard' };
}
function waterDoel() { return waterDoelInfo().ml; }

function waterDoelUitleg(info) {
  return info.soort === 'eigen' ? t('water.doelEigen', { ml: waterFmt(info.ml) }) : t('water.doelAdvies');
}

function waterDoelHtml(info) {
  if (!_waterDoelOpen) {
    return '<div class="water-doeluitleg"><span>' + waterDoelUitleg(info) + '</span>' +
      '<button type="button" class="water-doelknop" onclick="waterDoelOpenen()">' + t('water.doelAanpassen') + '</button></div>';
  }
  const waarde = _waterDoelInvoer !== null ? _waterDoelInvoer : info.ml;
  return '<div class="water-doeledit"><label class="water-extra">' + t('water.doelLabel') +
    '<input type="number" inputmode="numeric" min="500" max="6000" step="100" value="' + waarde + '" oninput="waterDoelInput(this.value)"></label>' +
    '<div class="water-doelacties"><button type="button" class="btn-sm" onclick="waterDoelOpslaan()">' + t('water.doelOpslaan') + '</button>' +
    (info.soort === 'eigen' ? '<button type="button" class="btn-sm" onclick="waterDoelTerug()">' + t('water.doelTerug') + '</button>' : '') +
    '<button type="button" class="btn-sm" onclick="waterDoelSluiten()">' + t('water.doelAnnuleer') + '</button></div>' +
    '<div class="water-doeluitleg"><span>' + t('water.doelBasis') + '</span></div></div>';
}

function waterStukMl(id) {
  if (id === 'glas') return waterGlasMl();
  if (id === 'eigen') return waterEigenMl();
  const tegel = WATER_TEGELS.find(function(x) { return x.id === id; });
  if (!tegel) return 0;
  const eigen = waterData.fles && waterData.fles[id];
  return eigen > 0 ? eigen : tegel.ml;
}

function waterSoort(id) { return id === 'glas' ? 'glas' : (id === 'eigen' ? 'eigen' : 'fles'); }
// De hoeveelheid per stuk die nu op het scherm geldt: wat er getypt is, anders de opgeslagen maat. 0 = ongeldig.
function waterNuMl(id) {
  const ml = (_waterInvoer !== null && (id === 'eigen' || waterSoort(id) === 'fles')) ? _waterInvoer : waterStukMl(id);
  const lim = WATER_LIMIETEN[waterSoort(id)];
  return (!lim || (ml >= lim[0] && ml <= lim[1])) ? ml : 0;
}

function waterNaam(x) {
  const aantal = x.n > 1 ? x.n + ' × ' : '';
  if (x.s === 'glas') return aantal + t('water.glass') + ' ' + x.u + ' ml';
  if (x.s === 'fles') return aantal + t('water.bottle') + ' ' + x.u + ' ml';
  return aantal + t('water.own');
}

function waterKaartHtml() {
  if (!waterAan()) return '';
  const dag = localDateStr();
  const tot = waterTotaal(dag);
  const info = waterDoelInfo();
  const doel = info.ml;
  const pct = Math.min(100, Math.round(tot / doel * 100));
  const rest = tot >= doel ? t('water.done') : t('water.left', { n: waterFmt(doel - tot) });
  const tegels = WATER_TEGELS.map(function(x) {
    const sub = x.id === 'glas' ? waterGlasMl() + ' ml' : (x.id === 'eigen' ? t('water.ownMl') : waterStukMl(x.id) + ' ml');
    const naam = x.id === 'glas' ? t('water.glass') : (x.id === 'eigen' ? t('water.own') : t('water.bottle'));
    return '<button type="button" class="water-tegel' + (x.id === _waterSel ? ' sel' : '') + '" aria-pressed="' + (x.id === _waterSel) + '" onclick="waterKies(\'' + x.id + '\')">' +
      '<span class="water-icoon" aria-hidden="true">' + (x.icoon === 'glas' || x.icoon.indexOf('fles') === 0 ? waterIcoonHtml(x.icoon) : x.icoon) + '</span><span>' + naam + '</span><small>' + sub + '</small></button>';
  }).join('');
  let extra = '';
  if (_waterSel === 'glas') {
    extra = '<label class="water-extra">' + t('water.glassSize') + '<select onchange="waterGlasZet(this.value)">' +
      [150, 200, 250, 300, 400].map(function(v) { return '<option' + (v === waterGlasMl() ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></label>';
  } else if (_waterSel === 'eigen') {
    extra = '<label class="water-extra">' + t('water.ownLabel') + '<input type="number" inputmode="numeric" min="10" max="2000" step="10" value="' + waterEigenMl() + '" oninput="waterEigenInput(this.value)"></label>';
  }
  else if (waterSoort(_waterSel) === 'fles') {
    extra = '<label class="water-extra">' + t('water.bottleSize') + '<input type="number" inputmode="numeric" min="100" max="3000" step="50" value="' + waterStukMl(_waterSel) + '" oninput="waterFlesInput(this.value)" onchange="waterFlesKlaar(this.value)"></label>';
  }
  const lijst = waterLijst(dag).map(function(x) {
    return '<div class="water-rij"><span><span class="water-tijd">' + escapeHtml(x.t || '') + '</span>' + escapeHtml(waterNaam(x)) + '</span>' +
      '<span class="water-rij-ml">+' + waterFmt(x.ml) + ' ml<button type="button" class="water-x" aria-label="' + t('water.remove') + '" onclick="waterVerwijder(' + x.id + ')">×</button></span></div>';
  }).join('');
  return '<div class="card water-kaart">' +
    '<div class="water-kop"><span class="ds-titel">💧 ' + t('water.title') + '</span><span class="water-doel">' + t('water.goal', { n: waterFmt(doel) }) + '</span></div>' +
    '<div class="water-stand"><span class="water-tot">' + waterFmt(tot) + '</span><span class="water-eenheid">ml</span><span class="water-rest">' + rest + '</span></div>' +
    '<div class="water-balk"><div class="water-vul" style="width:' + pct + '%"></div></div>' +
    waterDoelHtml(info) +
    '<div class="water-vraag">' + t('water.pick') + '</div>' +
    '<div class="water-tegels">' + tegels + '</div>' + extra +
    '<div class="water-actie"><div class="water-stap"><button type="button" aria-label="' + t('water.less') + '" onclick="waterAantalWijzig(-1)">−</button><span class="water-aantal">' + _waterAantal + '</span><button type="button" aria-label="' + t('water.more') + '" onclick="waterAantalWijzig(1)">+</button></div>' +
    '<button type="button" class="btn-sm water-add" onclick="waterVoegToe()">' + t('water.add', { ml: waterFmt(waterNuMl(_waterSel) * _waterAantal) }) + '</button></div>' +
    (lijst ? '<div class="water-lijst">' + lijst + '</div>' : '<div class="water-leeg">' + t('water.empty') + '</div>') +
    '</div>';
}

function waterDoelOpenen() { _waterDoelOpen = true; _waterDoelInvoer = null; waterHerteken(); }
function waterDoelSluiten() { _waterDoelOpen = false; _waterDoelInvoer = null; waterHerteken(); }
function waterDoelInput(v) { _waterDoelInvoer = Math.round(Number(v)) || 0; }
function waterDoelOpslaan() {
  const n = _waterDoelInvoer !== null ? _waterDoelInvoer : waterDoel();
  if (!(n >= WATER_DOEL_LIMIETEN[0] && n <= WATER_DOEL_LIMIETEN[1])) { try { showToast(t('water.doelInvalid'), true); } catch (e) {} return; }
  waterData = Object.assign({}, waterData, { doel: n });
  waterBewaar();
  waterDoelSluiten();
}
function waterDoelTerug() {
  const nieuw = Object.assign({}, waterData);
  delete nieuw.doel;
  waterData = nieuw;
  waterBewaar();
  waterDoelSluiten();
}

function waterHerteken() {
  try { renderDagStatusKaart(); } catch (e) { console.error('waterHerteken:', e); }
}
function waterKies(id) { _waterSel = id; _waterAantal = 1; _waterInvoer = null; waterHerteken(); }
function waterAantalWijzig(d) { _waterAantal = Math.min(10, Math.max(1, _waterAantal + d)); waterHerteken(); }
function waterGlasZet(v) {
  const n = parseInt(v, 10);
  if (!(n >= 50 && n <= 1000)) return;
  waterData = Object.assign({}, waterData, { glas: n });
  waterBewaar();
  waterHerteken();
}
// Tijdens het typen alleen de bedragen op de knop bijwerken (geen volledige hertekening: die zou de invoer en de klik verstoren).
function waterEigenInput(v) {
  const n = Math.round(Number(v));
  _waterInvoer = n > 0 ? n : 0;
  if (waterNuMl('eigen') > 0) {
    waterData = Object.assign({}, waterData, { eigen: n });
    waterBewaar();
  }
  waterKnopBijwerken();
}
// Fles: de inhoud aanpassen. Tijdens het typen alleen de knop (en de tegel) bijwerken; de maat wordt bewaard zodra hij geldig is.
function waterFlesInput(v) {
  const n = Math.round(Number(v));
  _waterInvoer = n > 0 ? n : 0;
  if (waterNuMl(_waterSel) > 0) {
    const fles = Object.assign({}, waterData.fles || {});
    fles[_waterSel] = n;
    waterData = Object.assign({}, waterData, { fles: fles });
    waterBewaar();
    document.querySelectorAll('.water-tegel.sel small').forEach(function(el) { el.textContent = n + ' ml'; });
  }
  waterKnopBijwerken();
}
// Klaar met typen: een ongeldige maat terugzetten op de laatst bewaarde en melden.
function waterFlesKlaar(v) {
  const lim = WATER_LIMIETEN.fles;
  const n = Math.round(Number(v));
  if (!(n >= lim[0] && n <= lim[1])) { try { showToast(t('water.bottleInvalid'), true); } catch (e) {} }
  _waterInvoer = null;
  waterHerteken();
}
function waterKnopBijwerken() {
  const ml = waterNuMl(_waterSel) * _waterAantal;
  document.querySelectorAll('.water-add').forEach(function(b) { b.textContent = t('water.add', { ml: waterFmt(ml) }); });
}
function waterVoegToe() {
  const u = waterNuMl(_waterSel);
  if (!(u > 0)) { try { showToast(t(waterSoort(_waterSel) === 'fles' ? 'water.bottleInvalid' : 'water.invalid'), true); } catch (e) {} return; }
  const dag = localDateStr();
  const d = new Date();
  const nu = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  const rij = { id: Date.now() * 100 + Math.floor(Math.random() * 100), t: nu, s: waterSoort(_waterSel), u: u, n: _waterAantal, ml: u * _waterAantal };
  const dagen = Object.assign({}, waterData.dagen || {});
  dagen[dag] = [rij].concat(dagen[dag] || []);
  const sleutels = Object.keys(dagen).sort();
  while (sleutels.length > WATER_MAX_DAGEN) delete dagen[sleutels.shift()];
  waterData = Object.assign({}, waterData, { dagen: dagen });
  waterBewaar();
  _waterAantal = 1;
  _waterInvoer = null;
  waterHerteken();
}
function waterVerwijder(id) {
  const dag = localDateStr();
  const dagen = Object.assign({}, waterData.dagen || {});
  dagen[dag] = (dagen[dag] || []).filter(function(x) { return x.id !== id; });
  waterData = Object.assign({}, waterData, { dagen: dagen });
  waterBewaar();
  waterHerteken();
}

// ========== WATER-TREND (Voortgang, onder de Voeding-kaart) ==========
// Zelfde stijl als de gewichtsgrafiek, zonder Importeren/Toevoegen. Elke dag vanaf de eerste invoer telt mee, ook dagen zonder
// water (0 ml, lege rode cirkel op de onderlijn). Vandaag telt pas mee zodra er iets gedronken is. Bij 1 jaar het gemiddelde
// per week (365 losse punten zijn op een telefoon te druk). De gestippelde lijn is het doel van nu.
let _waRange = 90; // aantal dagen dat de grafiek toont
function waKiesRange(n) { _waRange = n; renderWaterChart(); }

function waterDagenReeks() {
  const dagen = waterData.dagen || {};
  const vandaag = localDateStr();
  const totaal = function(d) { return waterTotaal(d); };
  const met = Object.keys(dagen).filter(function(d) { return totaal(d) > 0; }).sort();
  if (!met.length) return [];
  const start = new Date(met[0] + 'T12:00:00');
  const eind = new Date(vandaag + 'T12:00:00');
  const reeks = [];
  for (let d = new Date(start); d <= eind; d.setDate(d.getDate() + 1)) {
    const s = localDateStr(d);
    reeks.push({ date: s, ml: totaal(s) });
  }
  if (reeks.length && reeks[reeks.length - 1].date === vandaag && reeks[reeks.length - 1].ml === 0) reeks.pop(); // een lopende lege dag nog niet
  return reeks;
}

function renderWaterChart() {
  const kaart = document.getElementById('h-water-card');
  if (!kaart) return;
  kaart.style.display = waterAan() ? '' : 'none';
  const el = document.getElementById('water-chart');
  if (!el || !waterAan()) return;
  const sub = document.getElementById('water-chart-sub');

  const alle = waterDagenReeks();
  const d = alle.slice(Math.max(0, alle.length - _waRange));
  const chips = '<div class="wg-chips">' + [90, 180, 365].map(function(n) {
    return '<button type="button" class="wg-chip' + (n === _waRange ? ' on' : '') + '" onclick="waKiesRange(' + n + ')">' + t('weight.range.' + n) + '</button>';
  }).join('') + '</div>';
  const perWeek = _waRange === 365;
  if (sub) sub.textContent = t(perWeek ? 'water.trend.subWeek' : 'water.trend.subDay');
  if (d.length < 2) {
    el.innerHTML = chips + '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">' + t('water.trend.hint') + '</div>';
    return;
  }

  const doel = waterDoel();
  const gem = d.reduce(function(a, x) { return a + x.ml; }, 0) / d.length;
  const gehaald = d.filter(function(x) { return x.ml >= doel; }).length;
  const zonder = d.filter(function(x) { return x.ml === 0; }).length;
  let punten = d.map(function(x) { return { date: x.date, ml: x.ml }; });
  if (perWeek) {
    punten = [];
    for (let i = 0; i < d.length; i += 7) {
      const s = d.slice(i, i + 7);
      punten.push({ date: s[0].date, ml: s.reduce(function(a, x) { return a + x.ml; }, 0) / s.length });
    }
  }
  const n = punten.length;
  if (n < 2) { el.innerHTML = chips + '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">' + t('water.trend.hint') + '</div>'; return; }

  const W = 300, H = 120, padL = 34, padR = 10, padT = 10, padB = 22;
  const cW = W - padL - padR, cH = H - padT - padB;
  const hoogste = Math.max(doel, Math.max.apply(null, punten.map(function(p) { return p.ml; })));
  const yMax = Math.max(3500, Math.ceil((hoogste + 300) / 500) * 500);
  const X = function(i) { return padL + i * cW / (n - 1); };
  const Y = function(v) { return padT + cH - v / yMax * cH; };
  let grid = '';
  for (let v = 0; v <= yMax; v += 1000) {
    grid += '<line x1="' + padL + '" y1="' + Y(v) + '" x2="' + (W - padR) + '" y2="' + Y(v) + '" stroke="#efece4" stroke-width="0.5"/>' +
      '<text x="' + (padL - 4) + '" y="' + (Y(v) + 3) + '" text-anchor="end" font-size="9" fill="#aaa">' + (v / 1000) + ' L</text>';
  }
  const pts = punten.map(function(p, i) { return X(i) + ',' + Y(p.ml); }).join(' ');
  const vlak = padL + ',' + Y(0) + ' ' + pts + ' ' + X(n - 1) + ',' + Y(0);
  const doellijn = '<line x1="' + padL + '" y1="' + Y(doel) + '" x2="' + (W - padR) + '" y2="' + Y(doel) + '" stroke="#378ADD" stroke-width="1" stroke-dasharray="4 3"/>';
  let nul = '';
  if (!perWeek) punten.forEach(function(p, i) { if (p.ml === 0) nul += '<circle cx="' + X(i) + '" cy="' + Y(0) + '" r="' + (_waRange === 90 ? 2.2 : 1.6) + '" fill="none" stroke="#c0392b" stroke-width="1"/>'; });
  const stap = Math.max(1, Math.floor(n / 6));
  const xLabels = punten.map(function(p, i) {
    if (i !== n - 1 && (i % stap !== 0 || n - 1 - i < stap)) return '';
    const dt = new Date(p.date + 'T12:00:00');
    return '<text x="' + X(i) + '" y="' + (H - 5) + '" text-anchor="middle" font-size="8" fill="#aaa">' + dt.getDate() + '/' + (dt.getMonth() + 1) + '</text>';
  }).join('');

  el.innerHTML = chips +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:10px;line-height:1.6">' + t('water.trend.summary', { avg: waterFmt(gem), hit: gehaald, n: d.length, zero: zonder }) + '</div>' +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block" role="img" aria-label="' + t('water.trend.aria') + '">' +
      '<defs><linearGradient id="watFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4a7c59" stop-opacity="0.14"/><stop offset="100%" stop-color="#4a7c59" stop-opacity="0"/></linearGradient></defs>' +
      grid + '<polygon points="' + vlak + '" fill="url(#watFill)"/>' + doellijn +
      '<polyline points="' + pts + '" fill="none" stroke="#4a7c59" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' + nul + xLabels +
    '</svg>' +
    '<div class="water-leg"><span><i style="width:16px;border-top:2px solid #4a7c59"></i>' + t(perWeek ? 'water.trend.legWeek' : 'water.trend.legDay') + '</span>' +
    '<span><i style="width:16px;border-top:1.5px dashed #378ADD"></i>' + t('water.trend.legGoal', { ml: waterFmt(doel) }) + '</span>' +
    (perWeek ? '' : '<span><i style="width:8px;height:8px;border-radius:50%;border:1px solid #c0392b"></i>' + t('water.trend.legZero') + '</span>') + '</div>';
}
