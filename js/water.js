// ========== WATER (Dashboard, onder de dagstatus-kaart) ==========
// Per dag bijhouden hoeveel er gedronken is. De klant kiest een glas, een fles (500 / 750 / 1000 ml) of een eigen
// hoeveelheid, kiest het aantal en tikt op Toevoegen. Opslag: client_state, key prime_water:
//   { glas: 250, eigen: 300, dagen: { 'JJJJ-MM-DD': [ { id, t:'UU:MM', s:'glas'|'fles'|'eigen', u: ml per stuk, n: aantal, ml: totaal } ] } }
// De coach zet water per klant aan/uit in Config (profile.waterEnabled, standaard aan). Doel: 30 ml per kilo, afgerond op
// 100 ml; zonder gewicht 2000 ml. De kaart wordt als onderdeel van renderDagStatusKaart() (checkin.js) in dezelfde
// plekken (.dagstatus-slot) gezet, dus er staan meerdere kopieën in de pagina: daarom geen id's, alleen onclick.
let waterData = (function() {
  try { const w = JSON.parse(localStorage.getItem('prime_water') || '{}'); return (w && typeof w === 'object') ? w : {}; }
  catch (e) { return {}; }
})();

const WATER_TEGELS = [
  { id: 'glas', icoon: '🥛' },
  { id: 'f500', icoon: '🍼', ml: 500 },
  { id: 'f750', icoon: '🍼', ml: 750 },
  { id: 'f1000', icoon: '🍼', ml: 1000 },
  { id: 'eigen', icoon: '✏️' }
];
const WATER_DOEL_PER_KG = 30;
const WATER_DOEL_ZONDER_GEWICHT = 2000;
const WATER_MAX_DAGEN = 400;
let _waterSel = 'glas';
let _waterAantal = 1;

function waterAan() { return profile.waterEnabled !== false; }
function waterGlasMl() { return waterData.glas > 0 ? waterData.glas : 250; }
function waterEigenMl() { return waterData.eigen > 0 ? waterData.eigen : 300; }
function waterLijst(dag) { return (waterData.dagen && waterData.dagen[dag]) || []; }
function waterTotaal(dag) { return waterLijst(dag).reduce(function(a, x) { return a + (x.ml || 0); }, 0); }
function waterFmt(n) { return Math.round(n).toLocaleString(dateLocale()); }
function waterBewaar() { syncSet('prime_water', waterData); }

// Laatst bekende gewicht (logboek, check-ins), anders het profiel; geen gewicht = 2000 ml.
function waterDoel() {
  let kg = 0;
  try {
    const punten = (typeof weightPunten === 'function') ? weightPunten() : [];
    if (punten.length) kg = punten[punten.length - 1].checkin.weight;
  } catch (e) { kg = 0; }
  if (!(kg > 0) && profile.weight > 0) kg = profile.weight;
  if (!(kg > 0)) return WATER_DOEL_ZONDER_GEWICHT;
  return Math.max(500, Math.round(kg * WATER_DOEL_PER_KG / 100) * 100);
}

function waterStukMl(id) {
  if (id === 'glas') return waterGlasMl();
  if (id === 'eigen') return waterEigenMl();
  const tegel = WATER_TEGELS.find(function(x) { return x.id === id; });
  return tegel ? tegel.ml : 0;
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
  const doel = waterDoel();
  const pct = Math.min(100, Math.round(tot / doel * 100));
  const rest = tot >= doel ? t('water.done') : t('water.left', { n: waterFmt(doel - tot) });
  const tegels = WATER_TEGELS.map(function(x) {
    const sub = x.id === 'glas' ? waterGlasMl() + ' ml' : (x.id === 'eigen' ? t('water.ownMl') : x.ml + ' ml');
    const naam = x.id === 'glas' ? t('water.glass') : (x.id === 'eigen' ? t('water.own') : t('water.bottle'));
    return '<button type="button" class="water-tegel' + (x.id === _waterSel ? ' sel' : '') + '" aria-pressed="' + (x.id === _waterSel) + '" onclick="waterKies(\'' + x.id + '\')">' +
      '<span class="water-icoon" aria-hidden="true">' + x.icoon + '</span><span>' + naam + '</span><small>' + sub + '</small></button>';
  }).join('');
  let extra = '';
  if (_waterSel === 'glas') {
    extra = '<label class="water-extra">' + t('water.glassSize') + '<select onchange="waterGlasZet(this.value)">' +
      [150, 200, 250, 300, 400].map(function(v) { return '<option' + (v === waterGlasMl() ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></label>';
  } else if (_waterSel === 'eigen') {
    extra = '<label class="water-extra">' + t('water.ownLabel') + '<input type="number" inputmode="numeric" min="10" max="2000" step="10" value="' + waterEigenMl() + '" oninput="waterEigenInput(this.value)"></label>';
  }
  const lijst = waterLijst(dag).map(function(x) {
    return '<div class="water-rij"><span><span class="water-tijd">' + escapeHtml(x.t || '') + '</span>' + escapeHtml(waterNaam(x)) + '</span>' +
      '<span class="water-rij-ml">+' + waterFmt(x.ml) + ' ml<button type="button" class="water-x" aria-label="' + t('water.remove') + '" onclick="waterVerwijder(' + x.id + ')">×</button></span></div>';
  }).join('');
  return '<div class="card water-kaart">' +
    '<div class="water-kop"><span class="ds-titel">💧 ' + t('water.title') + '</span><span class="water-doel">' + t('water.goal', { n: waterFmt(doel) }) + '</span></div>' +
    '<div class="water-stand"><span class="water-tot">' + waterFmt(tot) + '</span><span class="water-eenheid">ml</span><span class="water-rest">' + rest + '</span></div>' +
    '<div class="water-balk"><div class="water-vul" style="width:' + pct + '%"></div></div>' +
    '<div class="water-vraag">' + t('water.pick') + '</div>' +
    '<div class="water-tegels">' + tegels + '</div>' + extra +
    '<div class="water-actie"><div class="water-stap"><button type="button" aria-label="' + t('water.less') + '" onclick="waterAantalWijzig(-1)">−</button><span class="water-aantal">' + _waterAantal + '</span><button type="button" aria-label="' + t('water.more') + '" onclick="waterAantalWijzig(1)">+</button></div>' +
    '<button type="button" class="btn-sm water-add" onclick="waterVoegToe()">' + t('water.add', { ml: waterFmt(waterStukMl(_waterSel) * _waterAantal) }) + '</button></div>' +
    (lijst ? '<div class="water-lijst">' + lijst + '</div>' : '<div class="water-leeg">' + t('water.empty') + '</div>') +
    '</div>';
}

function waterHerteken() {
  try { renderDagStatusKaart(); } catch (e) { console.error('waterHerteken:', e); }
}
function waterKies(id) { _waterSel = id; _waterAantal = 1; waterHerteken(); }
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
  if (n >= 10 && n <= 2000) {
    waterData = Object.assign({}, waterData, { eigen: n });
    waterBewaar();
  }
  const ml = (n >= 10 && n <= 2000) ? n * _waterAantal : 0;
  document.querySelectorAll('.water-add').forEach(function(b) { b.textContent = t('water.add', { ml: waterFmt(ml) }); });
}
function waterVoegToe() {
  const u = waterStukMl(_waterSel);
  if (!(u >= 10 && u <= 2000)) { try { showToast(t('water.invalid'), true); } catch (e) {} return; }
  const dag = localDateStr();
  const d = new Date();
  const nu = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  const rij = { id: Date.now() * 100 + Math.floor(Math.random() * 100), t: nu, s: _waterSel === 'glas' ? 'glas' : (_waterSel === 'eigen' ? 'eigen' : 'fles'), u: u, n: _waterAantal, ml: u * _waterAantal };
  const dagen = Object.assign({}, waterData.dagen || {});
  dagen[dag] = [rij].concat(dagen[dag] || []);
  const sleutels = Object.keys(dagen).sort();
  while (sleutels.length > WATER_MAX_DAGEN) delete dagen[sleutels.shift()];
  waterData = Object.assign({}, waterData, { dagen: dagen });
  waterBewaar();
  _waterAantal = 1;
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
