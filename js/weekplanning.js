// ========== WEEKPLANNING ==========
let geplanning = [];

const WP_KORT  = ['Ma','Di','Wo','Do','Vr','Za','Zo'];
const WP_LANG  = ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag'];
const WP_KORT_EN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const WP_LANG_EN = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DAG_KORT = ['Zo','Ma','Di','Wo','Do','Vr','Za']; // getDay() index
const DAG_KORT_EN = ['Su','Mo','Tu','We','Th','Fr','Sa']; // getDay() index

function wpDagKort(i) { return (currentLang === 'en' ? WP_KORT_EN : WP_KORT)[i]; }
function wpDagLang(i) { return (currentLang === 'en' ? WP_LANG_EN : WP_LANG)[i]; }
function wpGetDayKort(getDayIdx) { return (currentLang === 'en' ? DAG_KORT_EN : DAG_KORT)[getDayIdx]; }

function wpStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function wpDate(str) {
  const [y,m,d] = str.split('-').map(Number);
  return new Date(y, m-1, d);
}
// Geeft de maandag van de week WAARIN d valt (dus vaak terug in de tijd,
// bv. dinsdag -> gisteren), niet de eerstvolgende maandag. De oude formule
// ((8-day)%7) deed dat laatste per ongeluk -- correct voor d=maandag zelf
// (diff 0), maar voor elke andere dag sprong het een hele week te ver
// vooruit. Zelfde, wel al correcte formule als elders in de app
// (bv. wpBouwOverzicht/wpConfirmTrainingCopyInner: wd===0?6:wd-1).
function wpMaandagVanaf(d) {
  const day = d.getDay(); // 0 = zondag .. 6 = zaterdag
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon;
}

function wpLaadData() {
  try {
    geplanning = JSON.parse(localStorage.getItem('prime_planning') || '[]');
  } catch(e) {}
}
function wpSlaPlanningOp(){ syncSet('prime_planning',  geplanning); }

// ─── Helper: vertaal schemaId (ook prog:ID:DAG) naar display ─────────────────
// 'sid' is tegenwoordig altijd 'prog:ID:DAG' (een programmadag) of leeg
// (rustdag) -- de losse dagschema's (TRAINING_SCHEMAS) zijn verwijderd. De
// laatste regel blijft staan als nette fallback voor oude, al opgeslagen
// weekplanningen die nog een kaal schema-id bevatten.
// Zoekt een programma op id, zowel onder de eigen (per-klant) programma's
// als onder de gedeelde PRIME-programma's (localStorage-cache daarvan --
// zie primeProgLijst/'prime_prime_programmas' in programmas.js).
function wpVindProgramma(progId) {
  try {
    const eigen = JSON.parse(localStorage.getItem('prime_programmas') || '[]');
    const alles = [...BUILTIN_PROGRAMMAS, ...eigen];
    const gevonden = alles.find(x => x.id === progId);
    if (gevonden) return gevonden;
  } catch (e) { /* val door naar PRIME-check hieronder */ }
  try {
    const prime = JSON.parse(localStorage.getItem('prime_prime_programmas') || '[]');
    return prime.find(x => x.id === progId) || null;
  } catch (e) { return null; }
}

function wpGetDisplay(sid) {
  if (!sid) return { icon: '\u{1F4A4}', naam: t('weekplan.rest'), sub: '' };
  if (String(sid).startsWith('prog:')) {
    const parts = String(sid).split(':');
    const progId = parts[1], dagIdx = parseInt(parts[2]);
    const p = wpVindProgramma(progId);
    const dag = p ? (p.dagen || {})[dagIdx] : null;
    return { icon: '\u{1F4AA}', naam: dag ? (dispName(dag) || t('weekplan.trainingFallback')) : t('weekplan.trainingFallback'), sub: p ? dispName(p) : '' };
  }
  return { icon: '\u{1F4AA}', naam: String(sid), sub: '' };
}

// ─── Helper: haal oefeningen op voor een schemaId ────────────────────────────
function wpGetOefeningen(sid) {
  if (!sid) return [];
  if (String(sid).startsWith('prog:')) {
    const parts = String(sid).split(':');
    const progId = parts[1], dagIdx = parseInt(parts[2]);
    const p = wpVindProgramma(progId);
    const dag = p ? (p.dagen || {})[dagIdx] : null;
    return dag ? (dag.oefeningen || []) : [];
  }
  return [];
}

function wpLookupStappen(naam) {
  for (var gi = 0; gi < EXTRA_EXERCISES.length; gi++) {
    var exs = EXTRA_EXERCISES[gi].exercises;
    for (var ei = 0; ei < exs.length; ei++) {
      var e = exs[ei];
      if ((e.name === naam || e.naam === naam || e.name_en === naam || e.naam_en === naam) && e.stappen) return e.stappen;
    }
  }
  return '';
}

function wpOefDetail(o) {
  var naam = o.naam || o.name || '';
  var st = o.stappen || wpLookupStappen(naam);
  if (st) return st;
  var sets = o.sets || '';
  var reps = o.reps || '';
  var rust = o.rust || o.rest || '';
  return sets ? (sets + '\xD7' + reps + (rust ? ' \xB7 ' + rust : '')) : reps;
}

function wpBouwOefeningenLijst(oefeningen) {
  if (!oefeningen.length) return '<div style="font-size:12px;color:var(--muted);padding:6px 0">' + t('weekplan.noExercises') + '</div>';
  return oefeningen.map(function(o) {
    var naam = dispName(o);
    var detail = wpOefDetail(o);
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:0.5px solid var(--sand-dark)">' +
      '<div style="flex:1;font-size:12px;color:var(--charcoal)">' + naam + '</div>' +
      '<div style="font-size:11px;color:var(--muted);white-space:nowrap">' + detail + '</div>' +
      '</div>';
  }).join('');
}

// Stabiele sleutel voor een programma-oefening, gebaseerd op de naam
// (het canonieke .naam/.name-veld, nooit de vertaalde dispName() -- zelfde
// regel als elders in de app: alleen .naam/.name zijn identiteits-stabiel).
// Gebruikt voor prime_wp_done i.p.v. de array-positie, zodat afgevinkt-status
// niet verschuift/breekt als het programma later wordt aangepast (oefening
// toegevoegd/verwijderd/verplaatst).
function wpOefKey(oef) { return 'n:' + (oef.naam || oef.name || ''); }

// Oude, vóór deze wijziging opgeslagen prime_wp_done-datums bevatten nog
// numerieke array-posities i.p.v. sleutels. Migreert die eenmalig (per
// datum) naar sleutels, op basis van de op dát migratiemoment actuele
// programma-/adhoc-oefeningen -- best effort, zelfde beperking als de
// eenmalige reparatiepas in renderProgrammaVoortgang() (history.js).
function wpMigreerDoneNaarKeys(dateStr, doneArr) {
  if (!doneArr.length || typeof doneArr[0] !== 'number') return doneArr;
  const entry = geplanning.find(p => p.date === dateStr) || null;
  const geplandeOefeningen = entry ? wpGetOefeningen(entry.schemaId) : [];
  const adhocOefeningen = trainingDays[dateStr] || [];
  const gemigreerd = doneArr.map(function(idx) {
    if (idx < geplandeOefeningen.length) return wpOefKey(geplandeOefeningen[idx]);
    const adhocIdx = idx - geplandeOefeningen.length;
    const o = adhocOefeningen[adhocIdx];
    return o ? 'a:' + o.id : null;
  }).filter(Boolean);
  // Duplicaten kunnen ontstaan als twee oude indices toevallig op dezelfde
  // (huidige) naam uitkomen -- ontdubbelen.
  return [...new Set(gemigreerd)];
}

function wpGetDone(dateStr) {
  let all;
  try { all = JSON.parse(localStorage.getItem('prime_wp_done') || '{}'); }
  catch(e) { return []; }
  const raw = all[dateStr] || [];
  if (raw.length && typeof raw[0] === 'number') {
    if (!geplanning.length) wpLaadData();
    const gemigreerd = wpMigreerDoneNaarKeys(dateStr, raw);
    all[dateStr] = gemigreerd;
    syncSet('prime_wp_done', all);
    return gemigreerd;
  }
  return raw;
}

// Verwijderde (voor deze dag verborgen) oefening-indices van een
// ingepland programma -- de programma-definitie zelf blijft ongewijzigd,
// alleen "voor vandaag/deze dag niet tonen". Zelfde opzet als prime_wp_done.
function wpGetRemoved(dateStr) {
  try { return JSON.parse(localStorage.getItem('prime_wp_removed') || '{}')[dateStr] || []; }
  catch (e) { return []; }
}

function wpRemoveOefForDay(dateStr, oefIdx) {
  let all;
  try { all = JSON.parse(localStorage.getItem('prime_wp_removed') || '{}'); }
  catch (e) { all = {}; }
  const removed = all[dateStr] || [];
  if (!removed.includes(oefIdx)) removed.push(oefIdx);
  all[dateStr] = removed;
  syncSet('prime_wp_removed', all);
}

// Per-dag "overschrijving" van sets/reps/rust/notities voor één
// programma-oefening -- net als bij een gelogd voedingsitem (Voeding)
// dat je aanpast zonder het onderliggende product te wijzigen, past dit
// alleen DEZE ene dag aan, nooit het programma zelf (dat blijft
// ongewijzigd voor elke andere dag waarop het gepland staat). Zie
// openWpExerciseDetail() in training.js.
function wpGetExerciseOverride(dateStr, oefIdx) {
  try { return (JSON.parse(localStorage.getItem('prime_wp_ex_overrides') || '{}')[dateStr] || {})[oefIdx] || null; }
  catch (e) { return null; }
}

function wpSetExerciseOverride(dateStr, oefIdx, sets, notes) {
  let all;
  try { all = JSON.parse(localStorage.getItem('prime_wp_ex_overrides') || '{}'); }
  catch (e) { all = {}; }
  if (!all[dateStr]) all[dateStr] = {};
  all[dateStr][oefIdx] = { sets: sets, notes: notes };
  syncSet('prime_wp_ex_overrides', all);
}

function wpToggleOefDone(dateStr, doneKey) {
  const done = wpGetDone(dateStr); // migreert oude numerieke data indien nodig (en persisteert dat alvast)
  const pos  = done.indexOf(doneKey);
  const wordtGedaan = pos === -1; // wordt nu aangevinkt (was nog niet gedaan)
  if (wordtGedaan) done.push(doneKey); else done.splice(pos, 1);

  let all;
  try { all = JSON.parse(localStorage.getItem('prime_wp_done') || '{}'); }
  catch(e) { all = {}; }
  all[dateStr] = done;
  syncSet('prime_wp_done', all);

  // Bevries de lijst met programma-oefeningen (als sleutels, zie wpOefKey())
  // voor deze dag zodra iemand voor het eerst iets afvinkt (zie
  // renderProgrammaVoortgang() in history.js) -- zo blijft "voortgang" voor
  // deze specifieke dag altijd kloppen met wat er toen daadwerkelijk
  // gepland stond, ook als het programma later wordt uitgebreid/ingekort/
  // verplaatst. Alleen bij het eerste keer afvinken (nog geen snapshot) en
  // alleen als er ook echt een programmadag aan hangt.
  if (wordtGedaan) {
    if (!geplanning.length) wpLaadData();
    const entry = geplanning.find(p => p.date === dateStr);
    if (entry && entry.oefSnapshotKeys == null && entry.schemaId) {
      entry.oefSnapshotKeys = wpGetOefeningen(entry.schemaId).map(wpOefKey);
      wpSlaPlanningOp();
    }
  }

  const isDone = done.includes(doneKey);
  const chk = document.getElementById('wp-chk-' + dateStr + '-' + doneKey);
  const row = document.getElementById('wp-oef-' + dateStr + '-' + doneKey);
  if (chk) chk.classList.toggle('done', isDone);
  if (row) row.style.opacity = isDone ? '0.45' : '1';
}

// Zelfde kaart-opzet als een oefening bij Vandaag (exCard in training.js):
// fotominiatuur + naam/sets-rust links, afvinken + verwijderen rechts met
// tekstlabel. 'rows' is een array van { oef, doneKey, kind, verwijderIdx?,
// exId? } (zie wpdBouwDagKaart), niet de kale oefening-objecten -- zo
// blijft het afvink-/verwijder-doel kloppen ook als een deel van de lijst
// voor deze dag verborgen is (verwijderde programma-oefeningen).
function wpBouwOefeningenAfvinken(rows, dateStr) {
  if (!rows.length) return '<div style="font-size:12px;color:var(--muted);padding:6px 0">' + t('weekplan.noExercises') + '</div>';
  const done = wpGetDone(dateStr);
  return rows.map(function(row) {
    const o = row.oef, key = row.doneKey;
    const keyEsc = key.replace(/'/g, "\\'"); // voor gebruik in onclick-string
    const naam = dispName(o);
    const isDone = done.includes(key);

    // Voor een programma-oefening telt een per-dag aanpassing (sets/
    // reps/rust, zie openWpExerciseDetail()) mee in wat hier getoond
    // wordt, zonder de programma-definitie zelf aan te raken.
    const override = row.kind === 'prog' ? wpGetExerciseOverride(dateStr, row.verwijderIdx) : null;
    const laatsteSet = override && override.sets && override.sets.length ? override.sets[override.sets.length - 1] : null;
    const detail = laatsteSet
      ? (override.sets.length + '\xD7' + (laatsteSet.reps || '') + (laatsteSet.rest ? ' \xB7 ' + laatsteSet.rest : ''))
      : wpOefDetail(o);

    let photo = o.photo;
    if (!photo && typeof findCanonicalExercise === 'function') {
      const f = findCanonicalExercise(o.name || o.naam);
      if (f && f.photo) photo = f.photo;
    }
    const photoDiv = photo
      ? '<div style="width:50px;height:50px;flex-shrink:0;border-radius:8px;background-image:url(\'' + photo + '\');background-size:cover;background-position:center"></div>'
      : '<div style="width:50px;height:50px;flex-shrink:0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;background:var(--sand)">' + (o.icon || '💪') + '</div>';

    let editBtn = '';
    let delBtn = '';
    if (row.kind === 'prog') {
      const hasDetail = !!(override && (override.notes || (override.sets && override.sets.length)));
      editBtn = '<button class="ex-detail-btn ' + (hasDetail ? 'has-data' : '') + '" onclick="event.stopPropagation();openWpExerciseDetail(\'' + dateStr + '\',' + row.verwijderIdx + ')">'
        + '<span class="ex-detail-icon">✏️</span><span class="ex-detail-label">' + t('extra.detail.editBtn') + '</span></button>';
      delBtn = '<div class="ex-check-wrap" onclick="event.stopPropagation();wpRemoveOefForDay(\'' + dateStr + '\',' + row.verwijderIdx + ');wpdRefreshNaVerwijderen(\'' + dateStr + '\')" style="cursor:pointer"><span style="font-size:16px;color:var(--muted);line-height:1">✕</span><span class="ex-check-label">' + t('common.delete') + '</span></div>';
    } else if (row.kind === 'adhoc') {
      const hasDetail = !!(exerciseNotes[row.exId] && (exerciseNotes[row.exId].notes || (exerciseNotes[row.exId].sets && exerciseNotes[row.exId].sets.length)));
      editBtn = '<button class="ex-detail-btn ' + (hasDetail ? 'has-data' : '') + '" onclick="event.stopPropagation();openExerciseDetail(\'' + row.exId + '\')">'
        + '<span class="ex-detail-icon">✏️</span><span class="ex-detail-label">' + t('extra.detail.editBtn') + '</span></button>';
      delBtn = '<div class="ex-check-wrap" onclick="event.stopPropagation();wpRemoveAdhocForDay(\'' + dateStr + '\',\'' + row.exId + '\');wpdRefreshNaVerwijderen(\'' + dateStr + '\')" style="cursor:pointer"><span style="font-size:16px;color:var(--muted);line-height:1">✕</span><span class="ex-check-label">' + t('common.delete') + '</span></div>';
    }

    return '<div id="wp-oef-' + dateStr + '-' + key + '" style="display:flex;align-items:center;flex-wrap:wrap;row-gap:6px;gap:10px;padding:6px 0;border-bottom:0.5px solid var(--sand-dark);opacity:' + (isDone ? '0.45' : '1') + '">' +
      photoDiv +
      '<div style="flex:1;min-width:120px">' +
        '<div style="font-size:12px;color:var(--charcoal)">' + naam + '</div>' +
        '<div style="font-size:11px;color:var(--muted)">' + detail + '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;row-gap:4px;flex-shrink:0">' +
        '<div class="ex-check-wrap" onclick="wpToggleOefDone(\'' + dateStr + '\',\'' + keyEsc + '\')" style="cursor:pointer"><div id="wp-chk-' + dateStr + '-' + key + '" class="exercise-check' + (isDone ? ' done' : '') + '" title="' + t('weekplan.markDone') + '">✓</div><span class="ex-check-label">' + t('extra.detail.markDone') + '</span></div>' +
        editBtn +
        delBtn +
      '</div>' +
      '</div>';
  }).join('');
}

// Ná het verwijderen van een oefening (voor deze dag) alles opnieuw
// renderen: de dagkaart zelf (renderWeekplanning behoudt wpdOpenDag, dus
// blijft uitgeklapt), en als "Vandaag" ook getoond wordt bij Training,
// die erbij (dezelfde datum kan in allebei de schermen staan).
function wpdRefreshNaVerwijderen(dateStr) {
  renderWeekplanning();
  try {
    if (dateStr === localDateStr() && document.getElementById('training-dag-list')) {
      renderTrainingDag();
      updateTrainingDagBadge();
    }
  } catch (e) { console.error(e); }
}

// Verwijdert één losse (ad-hoc) oefening voor een specifieke dag -- ook
// bruikbaar vanuit Weekplanning voor een dag die niet "vandaag" is
// (i.t.t. removeExtraDag() in training.js, die alleen currentTrainingDate
// aanpast).
function wpRemoveAdhocForDay(dateStr, exId) {
  const lijst = (trainingDays[dateStr] || []).filter(function(e) { return e.id !== exId; });
  trainingDays[dateStr] = lijst;
  syncSet('prime_training_days', trainingDays);
  if (typeof currentTrainingDate !== 'undefined' && dateStr === currentTrainingDate) {
    trainingDagLog = lijst;
  }
}

// ─── Hoofd render ────────────────────────────────────────────────────────────
// Toont voorlopig alleen de week-doorblader-kaarten (zelfde look als
// Voeding); het rooster ("kies training per weekdag") + "plan N weken
// vooruit" is op verzoek weggehaald -- hoe een dag precies gevuld gaat
// worden (los van het huidige geplanning/trainingDays-mechanisme) wordt
// in een volgende stap samen met de coach bepaald.
function renderWeekplanning() {
  wpLaadData();
  const el = document.getElementById('weekplanning-content');
  if (!el) return;
  el.innerHTML = wpdBuildWeekHtml();
}

// ─── Overzicht ───────────────────────────────────────────────────────────────
function wpBouwOverzicht() {
  if (!geplanning.length) return '';

  const weken = new Map();
  geplanning.forEach(item => {
    const d = wpDate(item.date);
    const wd = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (wd === 0 ? 6 : wd - 1));
    const key = wpStr(mon);
    if (!weken.has(key)) weken.set(key, []);
    weken.get(key).push(item);
  });

  const vandaag = wpStr(new Date());

  const wekenHtml = [...weken.entries()].map(([monStr, items]) => {
    const mon = wpDate(monStr);
    const zo  = new Date(mon); zo.setDate(mon.getDate() + 6);
    const label = mon.toLocaleDateString(dateLocale(),{day:'numeric',month:'short'}) + ' – ' +
                  zo.toLocaleDateString(dateLocale(),{day:'numeric',month:'short'});

    const rijen = items.map(item => {
      const d    = wpDate(item.date);
      const disp = wpGetDisplay(item.schemaId);
      const isVandaag  = item.date === vandaag;
      const isVerleden = item.date < vandaag;
      const oefeningen = wpGetOefeningen(item.schemaId);
      const detailId   = 'wp-detail-' + item.date;
      const arrowId    = 'wp-arrow-' + item.date;
      // Ongebruikte weergave (zie comment bij wpBouwOverzicht) -- geen
      // verwijderknop nodig, dus platte 'legacy'-rijen zonder kind.
      const oefRows = oefeningen.map(function(oef) { return { oef: oef, doneKey: wpOefKey(oef), kind: 'legacy' }; });
      const detailHtml = oefeningen.length
        ? '<div id="' + detailId + '" style="display:none;padding:6px 0 4px 90px">' +
          wpBouwOefeningenAfvinken(oefRows, item.date) + '</div>'
        : '';
      return '<div style="border-bottom:0.5px solid var(--sand-dark);opacity:' + (isVerleden ? '0.4' : '1') + '">' +
        '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;cursor:pointer" onclick="wpToggleDagDetail(\'' + item.date + '\')">' +
        '<div style="width:26px;font-size:11px;font-weight:700;color:var(--muted);flex-shrink:0">' + wpGetDayKort(d.getDay()) + '</div>' +
        '<div style="font-size:11px;color:var(--muted);width:54px;flex-shrink:0">' + d.toLocaleDateString(dateLocale(),{day:'numeric',month:'short'}) + '</div>' +
        '<span style="font-size:16px;flex-shrink:0">' + disp.icon + '</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13px;font-weight:' + (isVandaag ? '600' : '400') + ';color:' + (isVandaag ? 'var(--sage)' : 'var(--charcoal)') + '">' +
            disp.naam +
            (isVandaag ? ' <span style="font-size:10px;background:var(--sage);color:white;padding:2px 7px;border-radius:8px;vertical-align:middle">' + t('weekplan.today') + '</span>' : '') +
          '</div>' +
          (disp.sub ? '<div style="font-size:11px;color:var(--muted)">' + disp.sub + '</div>' : '') +
        '</div>' +
        (oefeningen.length ? '<span id="' + arrowId + '" style="font-size:11px;color:var(--muted);flex-shrink:0">▾</span>' : '') +
        '</div>' +
        detailHtml +
        '</div>';
    }).join('');

    return '<div style="margin-bottom:18px">' +
      '<div style="font-size:11px;font-weight:700;color:var(--sage);letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px">' + label + '</div>' +
      rijen + '</div>';
  }).join('');

  return `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <div class="card-label" style="margin-bottom:2px">${t('weekplan.plannedTitle')}</div>
        <div style="font-size:12px;color:var(--muted)">${t('weekplan.plannedSummary', { count: geplanning.length, weeks: weken.size })}</div>
      </div>
      <button class="btn-sm" style="color:var(--accent);border-color:#e8c4a8;background:var(--accent-light)"
              onclick="wpVerwijder()">${t('weekplan.removePlanning')}</button>
    </div>
    ${wekenHtml}
  </div>`;
}

function wpToggleDagDetail(dateStr) {
  const detailEl = document.getElementById('wp-detail-' + dateStr);
  const arrowEl  = document.getElementById('wp-arrow-' + dateStr);
  if (!detailEl) return;
  const isOpen = detailEl.style.display !== 'none';
  detailEl.style.display = isOpen ? 'none' : 'block';
  if (arrowEl) arrowEl.textContent = isOpen ? '▾' : '▴';
}

function wpVerwijder() {
  if (!confirm(t('weekplan.confirmRemovePlanning'))) return;
  geplanning = [];
  wpSlaPlanningOp();
  renderWeekplanning();
}

// ─── Weekdoorblader-kaarten (zelfde look als Voeding's Weekplanning) ─────────
// Vervangt (voorlopig alleen visueel, zie overleg met de coach) het
// hierboven staande, vlakke "alle geplande weken op een rij"-overzicht
// (wpBouwOverzicht, nog steeds aanwezig maar niet meer aangeroepen) door
// dezelfde week-voor-week doorbladerbare dagkaarten als
// foodweek.js's buildFoodWeekHtml()/fwBouwDagKaart(): ←/→ weeknavigatie,
// 7 dagkaarten met "vandaag"-badge en "Nog niet ingevuld", uitklapbaar
// naar de oefeningenlijst. De onderliggende data (geplanning/
// trainingDays) en hoe een dag gevuld raakt (rooster + "plan N weken
// vooruit" hierboven) blijven voorlopig ongewijzigd -- welke stap
// daarna volgt (bv. losse oefeningen/programma's rechtstreeks per
// dagkaart plannen, net als "+ Product"/"+ Gerecht" bij Voeding) wordt
// in een volgende stap bepaald.
let wpdWeekOffset = 0; // 0 = huidige week, +1 = volgende week, -1 = vorige week
let wpdOpenDag = null; // datumstring van de uitgeklapte dagkaart, of null

function wpdStartOfWeek(offset) {
  const mon = wpMaandagVanaf(new Date());
  const d = new Date(mon);
  d.setDate(mon.getDate() + offset * 7);
  return d;
}

// ISO-8601 weeknummer (zelfde berekening als fwWeekNumber in foodweek.js).
function wpdWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

// Vangnet: net als renderFoodWeek() mag een mislukte render nooit een leeg
// scherm opleveren, en één kapotte dagkaart mag niet de hele week blank trekken.
function wpdBuildWeekHtml() {
  try {
    const monday = wpdStartOfWeek(wpdWeekOffset);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const weekNum = wpdWeekNumber(monday);
    const todayStr = wpStr(new Date());
    const rangeLabel =
      monday.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) + ' – ' +
      sunday.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

    let html = `<div class="card" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <button class="btn-sm" onclick="wpdChangeWeek(-1)" style="padding:8px 14px">←</button>
        <div style="text-align:center">
          <div class="card-label" style="margin-bottom:2px">${t('foodweek.weekLabel', { n: weekNum })}</div>
          <div style="font-size:13px;color:var(--muted)">${rangeLabel}</div>
        </div>
        <button class="btn-sm" onclick="wpdChangeWeek(1)" style="padding:8px 14px">→</button>
      </div>
      ${wpdWeekOffset !== 0 ? `<div style="text-align:center;margin-top:10px">
        <button class="btn-sm" onclick="wpdGoToday()">${t('foodweek.backToThisWeek')}</button>
      </div>` : ''}
    </div>`;

    html += '<div style="display:flex;flex-direction:column;gap:10px">';
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = wpStr(d);
      try {
        html += wpdBouwDagKaart(dateStr, d, i, todayStr);
      } catch (e) {
        console.error('wpdBouwDagKaart crash voor ' + dateStr + ':', e);
        html += `<div class="card" style="padding:16px;font-size:12px;color:var(--muted)">⚠️ ${dateStr}: ${(e && e.message) || String(e)}</div>`;
      }
    }
    html += '</div>';

    return html;
  } catch (e) {
    console.error('wpdBuildWeekHtml crash:', e);
    return `<div class="card" style="text-align:center;padding:30px 20px">
      <div style="font-size:32px;margin-bottom:10px">⚠️</div>
      <div style="font-weight:600;margin-bottom:6px">${t('foodweek.renderError')}</div>
      <div style="font-size:12px;color:var(--muted)">${(e && e.message) || String(e)}</div>
    </div>`;
  }
}

function wpdChangeWeek(delta) {
  wpdWeekOffset += delta;
  wpdOpenDag = null;
  renderWeekplanning();
}

function wpdGoToday() {
  wpdWeekOffset = 0;
  wpdOpenDag = null;
  renderWeekplanning();
}

function wpdBouwDagKaart(dateStr, d, dayIdx, todayStr) {
  const dagNaam = wpDagLang(dayIdx);
  const dateLabel = d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
  const isToday = dateStr === todayStr;
  const isOpen = wpdOpenDag === dateStr;

  const entry = geplanning.find(p => p.date === dateStr) || null;
  const disp = entry ? wpGetDisplay(entry.schemaId) : null;
  const geplandeOefeningen = entry ? wpGetOefeningen(entry.schemaId) : [];
  // Voor deze dag verwijderde programma-oefeningen (zie wpRemoveOefForDay,
  // ook gebruikt bij Vandaag) overslaan; het programma zelf blijft intact.
  const wpVerwijderd = wpGetRemoved(dateStr);
  const geplandeRows = geplandeOefeningen
    .map(function(oef, i) { return { oef: oef, doneKey: wpOefKey(oef), verwijderIdx: i, kind: 'prog' }; })
    .filter(function(x) { return !wpVerwijderd.includes(x.verwijderIdx); });
  const adhocOefeningen = trainingDays[dateStr] || [];
  const adhocRows = adhocOefeningen.map(function(oef, i) {
    return { oef: oef, doneKey: 'a:' + oef.id, kind: 'adhoc', exId: oef.id };
  });
  const alleRows = [...geplandeRows, ...adhocRows];
  const hasData = alleRows.length > 0;

  const header = `
    <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer" onclick="wpdToggleDag('${dateStr}')">
      <div style="width:76px;flex-shrink:0">
        <div style="font-size:12px;font-weight:700;color:${isToday ? 'var(--sage)' : 'var(--charcoal)'}">${dagNaam}</div>
        <div style="font-size:11px;color:var(--muted)">${dateLabel}</div>
      </div>
      ${isToday ? `<span style="font-size:10px;background:var(--sage);color:white;padding:2px 7px;border-radius:8px;flex-shrink:0">${t('weekplan.today')}</span>` : ''}
      <div style="flex:1"></div>
      ${hasData
        ? `<div style="text-align:right">
             <div style="font-family:'DM Serif Display',serif;font-size:16px">${alleRows.length} ${t(alleRows.length === 1 ? 'programmas.exerciseSingular' : 'programmas.exercisesPlural')}</div>
             ${disp && disp.naam ? `<div style="font-size:10px;color:var(--muted)">${disp.icon} ${disp.naam}</div>` : ''}
           </div>`
        : `<div style="font-size:12px;color:var(--muted)">${t('foodweek.notFilledIn')}</div>`}
      <span style="font-size:11px;color:var(--muted);margin-left:8px;flex-shrink:0">${isOpen ? '▴' : '▾'}</span>
    </div>`;

  const detailHtml = alleRows.length
    ? wpBouwOefeningenAfvinken(alleRows, dateStr)
    : `<div style="font-size:12px;color:var(--muted);padding:6px 0">${t('foodweek.noItemsYet')}</div>`;

  // Zelfde knoppenrij als een uitgeklapte dagkaart bij Voeding
  // (fwBouwDagKaart): toevoegen voor déze dag, en (alleen als er al iets
  // staat) kopiëren/alles verwijderen.
  const detail = `
    <div style="display:${isOpen ? 'block' : 'none'};padding:0 16px 14px">
      ${detailHtml}
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn-sm" style="flex:1" onclick="wpdAddForDay('${dateStr}')">${t('training.dag.addExerciseForDay')}</button>
        <button class="btn-sm" style="flex:1" onclick="switchTrainingTab('programmas')">${t('training.dag.addProgramForDay')}</button>
      </div>
      ${hasData ? `<div style="margin-top:8px"><button class="btn-sm" style="width:100%" onclick="wpOpenTrainingCopyModal('${dateStr}')">${t('weekplan.trainingCopy.button')}</button></div>` : ''}
      ${hasData ? `<button class="btn-sm" style="margin-top:8px;width:100%;color:var(--accent);border-color:#e8c4a8;background:var(--accent-light)" onclick="clearTrainingDag('${dateStr}')">${t('food.clearDay.button')}</button>` : ''}
    </div>`;

  return `<div class="card" style="padding:0;overflow:hidden;${isToday ? 'border-color:var(--sage)' : ''}">${header}${detail}</div>`;
}

function wpdToggleDag(dateStr) {
  wpdOpenDag = wpdOpenDag === dateStr ? null : dateStr;
  renderWeekplanning();
}

// Zet de actieve oefen-datum op deze dag en springt naar Losse oefeningen,
// zodat de bestaande oefening-toggle-selectie hergebruikt wordt om voor
// déze dag iets toe te voegen i.p.v. voor vandaag (zelfde patroon als
// fwAddForDay() bij Voeding).
function wpdAddForDay(dateStr) {
  _trainingReturnTab = 'weekplanning';
  switchTrainingLogDate(dateStr);
  switchTrainingTab('oefeningen');
}

// ─── Training kopiëren (vanuit Vandaag) ───────────────────────────────────────
// Zelfde opzet als fwOpenCopyModal/fwConfirmCopyInner in foodweek.js, maar
// dan voor de training van één dag. Kopieert alles wat bij die dag hoort:
// zowel de toegewezen programmadag (geplanning/prime_planning, schemaId)
// als de losse, ad-hoc oefeningen die via "Vandaag" zijn toegevoegd
// (trainingDays/prime_training_days -- sinds kort net als foodDays een
// per-datum store, zie state.js/training.js), precies zoals Voeding's
// kopieerfunctie alle voeding van een dag meeneemt.
let wpTrainingCopySourceDate = null;

function wpBuildTrainingCopyDayChecks() {
  const wrap = document.getElementById('tc-days-wrap');
  if (!wrap) return;
  wrap.innerHTML = [0,1,2,3,4,5,6].map(i => `
    <label style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;font-size:11px;color:var(--muted)">
      <span>${wpDagKort(i)}</span>
      <input type="checkbox" class="tc-day-chk" data-day="${i}" style="width:16px;height:16px;accent-color:var(--sage);cursor:pointer">
    </label>`).join('');
}

function wpOpenTrainingCopyModal(dateStr) {
  wpTrainingCopySourceDate = dateStr;

  document.getElementById('tc-mode-simple').checked = true;
  document.getElementById('tc-mode-advanced').checked = false;
  document.getElementById('tc-advanced-block').style.display = 'none';
  document.getElementById('tc-simple-date').value = '';

  document.getElementById('tc-start-date').value = dateStr;
  document.getElementById('tc-end-date').value = '';
  document.getElementById('tc-end-date-mode').checked = true;
  document.getElementById('tc-end-weeks-mode').checked = false;
  document.getElementById('tc-end-date').disabled = false;
  document.getElementById('tc-weeks').value = 4;
  document.getElementById('tc-weeks').disabled = true;

  wpBuildTrainingCopyDayChecks();
  document.getElementById('trainingcopy-modal').classList.add('open');
}

function wpCloseTrainingCopyModal() {
  document.getElementById('trainingcopy-modal').classList.remove('open');
}

function wpTrainingCopySetMode(mode) {
  document.getElementById('tc-advanced-block').style.display = mode === 'advanced' ? 'block' : 'none';
}

function wpTrainingCopySetEndMode(mode) {
  document.getElementById('tc-end-date').disabled = mode !== 'date';
  document.getElementById('tc-weeks').disabled = mode !== 'weeks';
}

function wpConfirmTrainingCopy() {
  try {
    wpConfirmTrainingCopyInner();
  } catch (e) {
    console.error('wpConfirmTrainingCopy error:', e);
    alert(t('foodweek.copy.unexpectedError', { msg: (e && e.message) || String(e) }));
  }
}

function wpConfirmTrainingCopyInner() {
  if (!wpTrainingCopySourceDate) return;
  const bron = geplanning.find(p => p.date === wpTrainingCopySourceDate);
  const bronOefeningen = trainingDays[wpTrainingCopySourceDate] || [];
  if (!bron && !bronOefeningen.length) { alert(t('foodweek.copy.emptySource')); return; }

  let targets = [];
  const isAdvanced = document.getElementById('tc-mode-advanced').checked;

  if (!isAdvanced) {
    const val = document.getElementById('tc-simple-date').value;
    if (!val) { alert(t('foodweek.copy.chooseDate')); return; }
    targets = [val];
  } else {
    const days = [...document.querySelectorAll('.tc-day-chk')].filter(c => c.checked).map(c => parseInt(c.dataset.day, 10));
    if (!days.length) { alert(t('foodweek.copy.chooseDays')); return; }

    const startVal = document.getElementById('tc-start-date').value;
    if (!startVal) { alert(t('foodweek.copy.chooseStartDate')); return; }
    const start = wpDate(startVal);

    const endMode = document.getElementById('tc-end-weeks-mode').checked ? 'weeks' : 'date';
    let end;
    if (endMode === 'date') {
      const endVal = document.getElementById('tc-end-date').value;
      if (!endVal) { alert(t('foodweek.copy.chooseEndDate')); return; }
      end = wpDate(endVal);
    } else {
      const weeks = parseInt(document.getElementById('tc-weeks').value, 10) || 1;
      end = new Date(start);
      end.setDate(start.getDate() + weeks * 7 - 1);
    }

    const cur = new Date(start);
    while (cur <= end) {
      const wd = cur.getDay();
      const idx = wd === 0 ? 6 : wd - 1;
      if (days.includes(idx)) targets.push(wpStr(cur));
      cur.setDate(cur.getDate() + 1);
    }
    if (!targets.length) { alert(t('foodweek.copy.noMatchingDays')); return; }
  }

  let count = 0;
  let trainingDaysGewijzigd = false;
  let wpDoneGewijzigd = false;
  let alleWpDone;
  try { alleWpDone = JSON.parse(localStorage.getItem('prime_wp_done') || '{}'); } catch(e) { alleWpDone = {}; }

  targets.forEach(dateStr => {
    if (dateStr === wpTrainingCopySourceDate) return; // niet naar zichzelf kopiëren

    // De geplande programmadag (schemaId): één per dag, dus vervangt een
    // eventueel al geplande dag i.p.v. te stapelen.
    if (bron) {
      geplanning = geplanning.filter(p => p.date !== dateStr);
      geplanning.push({ date: dateStr, schemaId: bron.schemaId });
      // Een (opnieuw) toegewezen programmadag begint altijd volledig
      // onafgevinkt -- oefeningen worden pas afgevinkt bij daadwerkelijke
      // uitvoering, niet door te kopiëren. Zonder dit konden eventuele
      // achtergebleven afgevinkte oefeningen van een eerdere toewijzing op
      // deze datum (bv. gelijknamige oefeningen in een ander programma)
      // meteen als "al gedaan" blijven meetellen.
      if (alleWpDone[dateStr] && alleWpDone[dateStr].length) {
        delete alleWpDone[dateStr];
        wpDoneGewijzigd = true;
      }
    }

    // Losse, ad-hoc oefeningen: net als bij Voeding's kopieerfunctie
    // toegevoegd aan wat er op de doeldag al staat i.p.v. dat te vervangen.
    if (bronOefeningen.length) {
      const bestaand = trainingDays[dateStr] || [];
      trainingDays[dateStr] = [...bestaand, ...bronOefeningen.map(ex => ({ ...ex }))];
      trainingDaysGewijzigd = true;
    }

    count++;
  });

  if (count === 0) { alert(t('foodweek.copy.noMatchingDays')); return; }

  if (bron) wpSlaPlanningOp();
  if (trainingDaysGewijzigd) syncSet('prime_training_days', trainingDays);
  if (wpDoneGewijzigd) syncSet('prime_wp_done', alleWpDone);
  wpCloseTrainingCopyModal();

  const toastMsg = count === 1 ? t('foodweek.copy.successOne') : t('foodweek.copy.successMany', { n: count });
  try { renderWeekplanning(); } catch (e) { console.error('renderWeekplanning na kopieren:', e); }
  try { renderTrainingDag(); } catch (e) { console.error('renderTrainingDag na kopieren:', e); }
  try { showToast(toastMsg); } catch (e) { console.error('showToast na kopieren:', e); }
}
