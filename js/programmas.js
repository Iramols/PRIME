// ========== PROGRAMMA'S ==========
// progMode bepaalt welke lijst/opslag actief is: 'normal' (Programma's,
// eigen + vaste programma's, per-klant opgeslagen) of 'prime' (PRIME
// programma's, gedeeld met alle klanten, alleen de coach kan ze wijzigen —
// zie supabase/prime_programs.sql). Vrijwel alle onderstaande functies
// werken bewust op de generieke `progLijst`, die per modus naar de juiste
// onderliggende array wijst, zodat de hele 3-kolommen-editor (dagen/
// oefeningen/detail) voor beide hergebruikt kan worden i.p.v. gedupliceerd.
let progLijst = [];
let progMode = 'normal'; // 'normal' | 'prime'
let progActiefId = null;
let progActiefDagIdx = null;   // welke dag is geselecteerd in kolom 1
let progSelectedOefIdx = null; // welke oefening is geselecteerd in kolom 2 (detail in kolom 3)

// PRIME-programma's: cache-first (snelle eerste render vanuit localStorage),
// daarna ververst vanuit de gedeelde Supabase-tabel zodra de tab geopend
// wordt (zie primeProgRefreshFromCloud()).
let primeProgLijst = [];
try { primeProgLijst = JSON.parse(localStorage.getItem('prime_prime_programmas') || '[]'); } catch(e) {}

const PROG_DAGEN_KORT = ['Ma','Di','Wo','Do','Vr','Za','Zo'];
const PROG_DAGEN_LANG = ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag'];
const PROG_DAGEN_KORT_EN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const PROG_DAGEN_LANG_EN = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function progDagKort(i) { return (currentLang === 'en' ? PROG_DAGEN_KORT_EN : PROG_DAGEN_KORT)[i]; }
function progDagLang(i) { return (currentLang === 'en' ? PROG_DAGEN_LANG_EN : PROG_DAGEN_LANG)[i]; }

// Mag de ingelogde gebruiker de huidige lijst bewerken? Bij 'normal' altijd
// (eigen programma's van de klant zelf); bij 'prime' alleen de coach.
function progCanEdit() { return progMode === 'normal' || isPrimeCoach(); }

function progLaadData() {
  if (progMode === 'prime') {
    progLijst = primeProgLijst;
    return;
  }
  let userProgs = [];
  try { userProgs = JSON.parse(localStorage.getItem('prime_programmas') || '[]'); }
  catch(e) {}
  const builtinIds = new Set(BUILTIN_PROGRAMMAS.map(p => p.id));
  progLijst = [...BUILTIN_PROGRAMMAS, ...userProgs.filter(p => !builtinIds.has(p.id))];
}

// Slaat de huidige wijziging op. Bij 'prime' gebeurt dat per programma
// (upsert naar prime_programs, zie cloud.js) i.p.v. de hele lijst ineens.
function progSlaOp() {
  if (progMode === 'prime') {
    primeProgLijst = progLijst;
    try { localStorage.setItem('prime_prime_programmas', JSON.stringify(primeProgLijst)); } catch(e) { console.error(e); }
    const prog = progLijst.find(p => p.id === progActiefId);
    if (prog) savePrimeProgramToCloud(prog);
    return;
  }
  syncSet('prime_programmas', progLijst.filter(p => !p.builtin));
}

// Ververst primeProgLijst vanuit de gedeelde Supabase-tabel (voor alle
// klanten hetzelfde). Wordt aangeroepen zodra de PRIME-tab geopend wordt;
// de al zichtbare cache-versie blijft intussen gewoon staan.
async function primeProgRefreshFromCloud() {
  const list = await fetchPrimeProgramsFromCloud();
  if (list) {
    primeProgLijst = list;
    if (progMode === 'prime') { progLaadData(); renderProgrammas(); }
  }
}

function renderProgrammas() {
  progLaadData();
  const elId = progMode === 'prime' ? 'primeprog-content' : 'programmas-content';
  const el = document.getElementById(elId);
  if (!el) return;
  const inEditor = progActiefId !== null;
  // De hint-kaart en de zoekbalk horen alleen bij de lijst, niet bij de
  // programma-editor (dagen/oefeningen van één programma) die dezelfde
  // container hergebruikt.
  const hintWrap = document.getElementById(progMode === 'prime' ? 'primeprog-hint-wrap' : 'programma-hint-wrap');
  if (hintWrap) hintWrap.style.display = inEditor ? 'none' : 'flex';
  const searchWrap = document.getElementById(progMode === 'prime' ? 'primeprog-search-wrap' : 'programma-search-wrap');
  if (searchWrap) searchWrap.style.display = inEditor ? 'none' : 'flex';
  el.innerHTML = inEditor ? progBouw3ColEditor() : progBouwLijst();
}

// ─── Lijst ───────────────────────────────────────────────────────────────────
function progBouwLijst() {
  const q = (document.getElementById(progMode === 'prime' ? 'primeprog-search' : 'programma-search')?.value || '').toLowerCase();
  const lijst = q ? progLijst.filter(p => (p.naam || '').toLowerCase().includes(q) || dispName(p).toLowerCase().includes(q)) : progLijst;

  if (!progLijst.length) {
    const hint = progMode === 'prime' ? t('programmas.prime.emptyHint') : t('programmas.empty.hint');
    return '<div class="card" style="text-align:center;padding:40px 20px">' +
      '<div style="font-size:40px;margin-bottom:12px">\u{1F4CB}</div>' +
      '<div style="font-family:\'DM Serif Display\',serif;font-size:20px;margin-bottom:8px">' + t('programmas.empty.title') + '</div>' +
      '<div style="font-size:13px;color:var(--muted)">' + hint + '</div>' +
      '</div>';
  }
  if (!lijst.length) {
    return '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">' + t('common.noSearchResults') + '</div>';
  }

  const canEdit = progCanEdit();
  const kaarten = lijst.map(prog => {
    const aantalDagen = Object.keys(prog.dagen || {}).length;
    const aantalOef   = Object.values(prog.dagen || {}).reduce((a, d) => a + (d.oefeningen || []).length, 0);
    // Vaste programma's blijven op kalenderweekdagen staan (Ma/Di/...); eigen
    // en PRIME-programma's hebben een vrije dagreeks, dus die tonen 'Dag 1 · Dag 2 · ...'.
    const dagIcons    = Object.keys(prog.dagen || {}).sort((a,b) => Number(a)-Number(b))
      .map(i => prog.builtin ? progDagKort(Number(i)) : (Number(i) + 1)).join(' \xB7 ');
    let knoppen = '<button class="btn-primary" style="flex:1;min-width:140px;padding:10px" onclick="progLadenInWeekplanning(\'' + prog.id + '\')">' + t('programmas.loadIntoWeekplan') + '</button>';
    if (!prog.builtin && canEdit) {
      knoppen += '<button class="btn-sm" onclick="progOpenEditor(\'' + prog.id + '\')">' + t('common.edit') + '</button>' +
        '<button class="btn-sm" style="color:var(--accent);border-color:#e8c4a8;background:var(--accent-light)" onclick="progVerwijder(\'' + prog.id + '\')">' + t('common.delete') + '</button>';
    } else if (!prog.builtin) {
      knoppen += '<button class="btn-sm" onclick="progOpenEditor(\'' + prog.id + '\')">' + t('programmas.view') + '</button>';
    }
    return '<div class="card" style="margin-bottom:12px' + (prog.builtin ? ';border-color:var(--sage)' : '') + '">' +
      '<div style="display:flex;gap:14px;margin-bottom:10px">' +
      (prog.foto
        ? '<div style="width:64px;height:64px;border-radius:10px;flex-shrink:0;background-size:cover;background-position:center;background-image:url(\'' + prog.foto + '\')"></div>'
        : '<div style="width:64px;height:64px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:28px;background:var(--sand)">📋</div>') +
      '<div style="flex:1;min-width:0">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">' +
      '<div style="font-family:\'DM Serif Display\',serif;font-size:18px">' + dispName(prog) + '</div>' +
      (prog.builtin ? '<span style="font-size:10px;font-weight:700;background:var(--sage);color:white;padding:2px 8px;border-radius:8px">' + t('programmas.builtinBadge') + '</span>' : '') +
      '</div>' +
      (dispField(prog, 'beschrijving') ? '<div style="font-size:12px;color:var(--muted);margin-bottom:4px">' + dispField(prog, 'beschrijving') + '</div>' : '') +
      '<div style="font-size:12px;color:var(--muted)">' + t('programmas.daysExercisesSummary', { days: aantalDagen, ex: aantalOef }) + '</div>' +
      (dagIcons ? '<div style="font-size:11px;color:var(--sage);margin-top:3px;font-weight:600">' + dagIcons + '</div>' : '') +
      (prog.doel || prog.niveau || prog.dagenPerWeek
        ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
          (prog.doel ? '<span style="font-size:11px;padding:3px 8px;border-radius:8px;background:var(--sand);color:var(--charcoal)">🎯 ' + prog.doel + '</span>' : '') +
          (prog.niveau ? '<span style="font-size:11px;padding:3px 8px;border-radius:8px;background:var(--sand);color:var(--charcoal)">📊 ' + t('programmas.level.' + prog.niveau.toLowerCase()) + '</span>' : '') +
          (prog.dagenPerWeek ? '<span style="font-size:11px;padding:3px 8px;border-radius:8px;background:var(--sand);color:var(--charcoal)">📅 ' + prog.dagenPerWeek + '</span>' : '') +
          '</div>'
        : '') +
      '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' + knoppen + '</div>' +
      '</div>';
  }).join('');

  return '<div style="margin-bottom:4px">' + kaarten + '</div>';
}

// ─── Programma editor: dagen | oefeningen naast elkaar ───────────────────────
// Dagen zijn een vrije, oplopende reeks ('Dag 1', 'Dag 2', ...) i.p.v. vast
// gekoppeld aan kalenderweekdagen -- een programma kan zo een trainingscyclus
// van elke gewenste lengte zijn (bv. een 4-daagse split of een 11-daags blok).
//
// Oefeningen tonen als kaartjes (foto + naam + sets/rust, "Sets & notities"
// + "Verwijder") -- zelfde stijl als een Weekplanning-dagkaart, i.p.v. de
// vroegere aparte "detail"-kolom met een altijd-open sets-tabel ernaast.
// Bewerken gaat nu via hetzelfde sets/notities-scherm (openExerciseDetailGeneric,
// training.js) als overal elders in de app -- zie progOefBewerken() hieronder.
function progBouw3ColEditor() {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog) { progActiefId = null; return progBouwLijst(); }
  if (!prog.dagen) prog.dagen = {};
  const canEdit = progCanEdit();

  const dagIndexen = Object.keys(prog.dagen).map(Number).sort((a,b) => a-b);
  if (progActiefDagIdx === null || !prog.dagen[progActiefDagIdx]) {
    progActiefDagIdx = dagIndexen.length ? dagIndexen[0] : null;
  }
  const geselecteerdeDag = progActiefDagIdx !== null ? prog.dagen[progActiefDagIdx] : null;
  const oefeningen = geselecteerdeDag ? (geselecteerdeDag.oefeningen || []) : [];

  // Kolom 1: dagen
  const dagRijenHtml = dagIndexen.map(i => {
    const dag = prog.dagen[i];
    const naam = (dag.naam_en && currentLang === 'en') ? dag.naam_en : (dag.naam || '');
    const isActief = i === progActiefDagIdx;
    return '<div class="prog-list-row' + (isActief ? ' active' : '') + '" onclick="progDagSelecteer(' + i + ')">' +
      '<span>' + t('programmas.dayLabel', { n: i + 1 }) + (naam ? ' – ' + naam : '') + '</span>' +
      (canEdit ? '<button class="prog-list-row-remove" onclick="event.stopPropagation();progDagVerwijder(' + i + ')" title="' + t('common.delete') + '">&#x2715;</button>' : '') +
      '</div>';
  }).join('');

  // Kolom 2: oefeningen van de geselecteerde dag, als kaartjes
  let oefRijenHtml;
  if (!geselecteerdeDag) {
    oefRijenHtml = '<div class="prog-list-empty">' + t('programmas.selectDayHint') + '</div>';
  } else if (!oefeningen.length) {
    oefRijenHtml = '<div class="prog-list-empty">' + t('programmas.noExercisesHint') + '</div>';
  } else {
    oefRijenHtml = oefeningen.map((oef, i) => {
      const canonical = findCanonicalExercise(oef.naam);
      const photo = canonical ? canonical.photo : null;
      const meta = oef.stappen ? oef.stappen : (oef.sets ? oef.sets + '\xD7' + (oef.reps || '') + (oef.rust ? ' \xB7 ' + oef.rust : '') : (oef.reps || ''));
      const photoDiv = photo
        ? '<div style="width:50px;height:50px;flex-shrink:0;border-radius:8px;background-image:url(\'' + photo + '\');background-size:cover;background-position:center"></div>'
        : '<div style="width:50px;height:50px;flex-shrink:0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;background:var(--sand)">' + (canonical ? canonical.icon : '\u{1F3CB}️') + '</div>';
      return '<div style="display:flex;align-items:center;flex-wrap:wrap;row-gap:6px;gap:10px;padding:8px 6px;border-bottom:0.5px solid var(--sand-dark)">' +
        photoDiv +
        '<div style="flex:1;min-width:120px">' +
        '<div style="font-size:13px;font-weight:600;color:var(--charcoal)">' + (oef.naam || t('programmas.exercisePlaceholder')) + '</div>' +
        '<div style="font-size:11px;color:var(--muted)">' + meta + '</div>' +
        '</div>' +
        (canEdit
          ? '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;row-gap:4px;flex-shrink:0">' +
            '<button class="ex-detail-btn" onclick="progOefBewerken(' + i + ')"><span class="ex-detail-icon">✏️</span><span class="ex-detail-label">' + t('extra.detail.editBtn') + '</span></button>' +
            '<div class="ex-check-wrap" onclick="progOefVerwijder(' + i + ')" style="cursor:pointer"><span style="font-size:16px;color:var(--muted);line-height:1">✕</span><span class="ex-check-label">' + t('common.delete') + '</span></div>' +
            '</div>'
          : '') +
        '</div>';
    }).join('');
  }

  return '<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">' +
    '<button class="prog-back-btn" onclick="progTerugNaarLijst()">' + t('common.back') + '</button>' +
    '<div class="prog-title-static">' + dispName(prog).replace(/</g,'&lt;') + '</div>' +
    (progMode === 'prime' ? '<span class="prog-prime-badge">' + t('programmas.prime.badge') + '</span>' : '') +
    '</div>' +
    progBouwInfoKaart(prog, canEdit) +
    '<div class="prog-2col">' +

    '<div class="prog-col">' +
    '<div class="prog-col-head"><span>' + t('programmas.trainingDays') + '</span></div>' +
    (canEdit ? '<div class="prog-col-actions"><button class="prog-col-add" onclick="progDagToevoegen()">' + t('programmas.addDay') + '</button></div>' : '') +
    '<div class="prog-col-body">' + dagRijenHtml + '</div>' +
    '</div>' +

    '<div class="prog-col">' +
    '<div class="prog-col-head"><span>' + t('programmas.exercisesLabel') + '</span></div>' +
    (geselecteerdeDag
      ? '<div class="prog-day-name-row">' +
        '<label>' + t('programmas.dayNameLabel') + '</label>' +
        '<input type="text" class="prog-day-title-input" value="' + (geselecteerdeDag.naam || '').replace(/"/g,'&quot;') + '" placeholder="' + t('programmas.dayNamePlaceholder') + '" onchange="progDagNaamBijwerken(this.value)"' + (canEdit ? '' : ' disabled') + '>' +
        '</div>'
      : '') +
    (geselecteerdeDag && canEdit
      ? '<div class="prog-col-actions">' +
        '<button class="prog-col-add" onclick="progOefUitLosseOefeningenKiezen()">' + t('programmas.addEmptyField') + '</button>' +
        '</div>'
      : '') +
    '<div class="prog-col-body">' + oefRijenHtml + '</div>' +
    '</div>' +

    '</div>';
}

// Programma-info: beschrijving, doel, niveau en dagen per week -- los van de
// naam (die al bovenaan staat) en los van de dagen/oefeningen zelf. Altijd
// zichtbaar en direct bewerkbaar, net als de rest van de editor (autosave).
// Bij PRIME-programma's staat er, alleen voor de coach en alleen op eigen
// (niet-PRIME) programma's, een knop rechts om het huidige programma als
// nieuw PRIME-programma op te slaan.
function progBouwInfoKaart(prog, canEdit) {
  const primeActie = (progMode === 'normal' && isPrimeCoach())
    ? '<div class="prog-info-side">' +
      '<div class="prog-info-side-label">' + t('programmas.prime.sideLabel') + '</div>' +
      '<button class="btn-sm" style="width:100%" onclick="progOpenPrimeSaveModal()">' + t('programmas.prime.saveAs') + '</button>' +
      '</div>'
    : '';
  const dis = canEdit ? '' : ' disabled';
  return '<div class="prog-info-wrap">' +
    '<div class="card prog-info-kaart">' +
    '<div class="form-row"><label>' + t('food.add.photo') + '</label>' +
    '<div style="display:flex;align-items:center;gap:12px">' +
    '<div id="prog-photo-preview" style="width:64px;height:64px;border-radius:8px;background:var(--sand);flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--muted)">' +
    (prog.foto ? '<img src="' + prog.foto + '" style="width:100%;height:100%;object-fit:cover">' : '📋') +
    '</div>' +
    (canEdit
      ? '<label style="cursor:pointer">' +
        '<input type="file" accept="image/*" style="display:none" onchange="handleProgPhoto(event)">' +
        '<span style="font-size:12px;padding:8px 14px;border-radius:8px;border:1px solid var(--sage);color:var(--sage);font-weight:600">' + t('beheer.upload') + '</span>' +
        '</label>'
      : '') +
    '</div>' +
    '<div id="prog-photo-error" style="color:#c0392b;font-size:12px;margin-top:6px"></div>' +
    '</div>' +
    '<div class="form-row"><label>' + t('programmas.info.name') + '</label>' +
    '<input type="text" id="prog-naam-input" value="' + prog.naam.replace(/"/g,'&quot;') + '" placeholder="' + t('programmas.info.namePlaceholder') + '" onchange="progNaamBijwerken(this.value)"' + dis + '></div>' +
    '<div class="form-row"><label>' + t('programmas.info.description') + '</label>' +
    '<textarea class="prog-info-textarea" placeholder="' + t('programmas.info.descriptionPlaceholder') + '" onchange="progInfoBijwerken(\'beschrijving\',this.value)"' + dis + '>' + (prog.beschrijving || '').replace(/</g,'&lt;') + '</textarea>' +
    '</div>' +
    '<div class="prog-info-grid">' +
    '<div class="form-row"><label>' + t('programmas.info.goal') + '</label>' +
    '<input type="text" value="' + (prog.doel || '').replace(/"/g,'&quot;') + '" placeholder="' + t('programmas.info.goalPlaceholder') + '" onchange="progInfoBijwerken(\'doel\',this.value)"' + dis + '></div>' +
    '<div class="form-row"><label>' + t('programmas.info.level') + '</label>' +
    '<select onchange="progInfoBijwerken(\'niveau\',this.value)"' + dis + '>' +
    '<option value=""' + (!prog.niveau ? ' selected' : '') + '>—</option>' +
    ['Beginner','Gemiddeld','Gevorderd'].map(lvl =>
      '<option value="' + lvl + '"' + (prog.niveau === lvl ? ' selected' : '') + '>' + t('programmas.level.' + lvl.toLowerCase()) + '</option>'
    ).join('') +
    '</select></div>' +
    '<div class="form-row"><label>' + t('programmas.info.daysPerWeek') + '</label>' +
    '<input type="text" value="' + (prog.dagenPerWeek || '').replace(/"/g,'&quot;') + '" placeholder="' + t('programmas.info.daysPerWeekPlaceholder') + '" onchange="progInfoBijwerken(\'dagenPerWeek\',this.value)"' + dis + '></div>' +
    '</div>' +
    '</div>' +
    primeActie +
    '</div>';
}

function progInfoBijwerken(veld, val) {
  if (!progCanEdit()) return;
  const prog = progLijst.find(p => p.id === progActiefId);
  if (prog) { prog[veld] = val; progSlaOp(); }
}

function handleProgPhoto(event) {
  if (!progCanEdit()) return;
  const file = event.target.files[0];
  if (!file) return;
  const errorEl = document.getElementById('prog-photo-error');
  if (file.size > 1.5 * 1024 * 1024) {
    errorEl.textContent = t('food.add.photoTooBig');
    return;
  }
  errorEl.textContent = '';
  const reader = new FileReader();
  reader.onload = function(e) {
    const prog = progLijst.find(p => p.id === progActiefId);
    if (!prog) return;
    prog.foto = e.target.result;
    progSlaOp();
    document.getElementById('prog-photo-preview').innerHTML = '<img src="' + prog.foto + '" style="width:100%;height:100%;object-fit:cover">';
  };
  reader.readAsDataURL(file);
}

// Sets/reps/rust/notities aanpassen voor een programma-oefening -- zelfde
// generieke sets/notities-scherm (openExerciseDetailGeneric, training.js)
// als overal elders in de app (bv. openWpExerciseDetail() voor een
// ingeplande programma-oefening in Weekplanning). Bewust GEEN aparte
// stappen-editor voor Wandelen-achtige oefeningen: dat blijft de
// standaardwaarde uit de bibliotheek, aanpassen kan (nog) niet per
// programmadag.
function progOefBewerken(oefIdx) {
  if (!progCanEdit()) return;
  const prog = progLijst.find(p => p.id === progActiefId) || primeProgLijst.find(p => p.id === progActiefId);
  if (!prog || progActiefDagIdx === null || !prog.dagen[progActiefDagIdx]) return;
  const oef = prog.dagen[progActiefDagIdx].oefeningen[oefIdx];
  if (!oef) return;
  const canonical = findCanonicalExercise(oef.naam);
  const sets = (oef.setsDetail && oef.setsDetail.length) ? oef.setsDetail.map(s => ({ ...s })) : progOefAfgeleidesSets(oef);
  openExerciseDetailGeneric({
    name: oef.naam || t('programmas.exercisePlaceholder'),
    photo: canonical ? canonical.photo : null,
    icon: canonical ? canonical.icon : '🏋️',
    sets: sets,
    notes: oef.notities || '',
    onSave: function(newSets, newNotes) {
      progOefBewerkenOpslaan(oefIdx, newSets, newNotes);
    }
  });
}

function progOefBewerkenOpslaan(oefIdx, sets, notes) {
  if (!progCanEdit()) return;
  const prog = progLijst.find(p => p.id === progActiefId) || primeProgLijst.find(p => p.id === progActiefId);
  if (!prog || progActiefDagIdx === null || !prog.dagen[progActiefDagIdx]) return;
  const oef = prog.dagen[progActiefDagIdx].oefeningen[oefIdx];
  if (!oef) return;
  const laatsteSet = sets[sets.length - 1] || {};
  oef.sets = String(sets.length);
  oef.reps = laatsteSet.reps || '';
  oef.rust = laatsteSet.rest || '';
  oef.setsDetail = sets;
  oef.notities = notes || '';
  progSlaOp();
  renderProgrammas();
}

// Leidt een startpunt voor de sets-tabel af uit de simpele sets/reps/rust-
// velden, voor oefeningen die nog geen losse setsDetail hebben.
function progOefAfgeleidesSets(oef) {
  const n = Number(oef.sets) || 1;
  const restMatch = String(oef.rust || '').match(/(\d+)/);
  return Array.from({ length: n }, () => ({ reps: oef.reps || '', rest: restMatch ? restMatch[1] : '' }));
}

// ─── Acties: programma & dagen ────────────────────────────────────────────────
// "+ Programma toevoegen"-tab: eigen (losse) tab i.p.v. een knop onder
// Programma's, net als "+ Oefening toevoegen" naast Losse oefeningen -- en
// net als daar staan alle velden meteen samen in één formulier (naam,
// beschrijving, doel, niveau, dagen per week, foto), i.p.v. eerst alleen
// een naam te vragen en de rest pas later in de editor. Na aanmaken springt
// de coach door naar Programma's om er dagen en oefeningen aan toe te
// voegen via de 3-koloms-editor (dat deel past niet in een plat formulier).
let _aprPhotoData = null;

function resetNewProgramForm() {
  const nameInput = document.getElementById('apr-name');
  if (!nameInput) return;
  nameInput.value = '';
  nameInput.style.borderColor = '';
  document.getElementById('apr-beschrijving').value = '';
  document.getElementById('apr-doel').value = '';
  document.getElementById('apr-niveau').value = '';
  document.getElementById('apr-dagenperweek').value = '';
  document.getElementById('apr-photo-preview').innerHTML = '📋';
  _aprPhotoData = null;
  document.getElementById('apr-error').textContent = '';
}

function handleNewProgramPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  const errorEl = document.getElementById('apr-error');
  if (file.size > 1.5 * 1024 * 1024) {
    errorEl.textContent = t('food.add.photoTooBig');
    return;
  }
  errorEl.textContent = '';
  const reader = new FileReader();
  reader.onload = function(e) {
    _aprPhotoData = e.target.result;
    document.getElementById('apr-photo-preview').innerHTML = '<img src="' + _aprPhotoData + '" style="width:100%;height:100%;object-fit:cover">';
  };
  reader.readAsDataURL(file);
}

function addNewProgram() {
  const nameInput = document.getElementById('apr-name');
  const name = nameInput.value.trim();
  const errorEl = document.getElementById('apr-error');
  if (!name) {
    errorEl.textContent = t('programmas.add.nameRequired');
    nameInput.style.borderColor = '#c0392b';
    return;
  }
  errorEl.textContent = '';
  nameInput.style.borderColor = '';

  progMode = 'normal';
  progLaadData();
  const id = 'p' + Date.now() + Math.floor(Math.random() * 1000);
  progLijst.push({
    id,
    naam: name,
    beschrijving: document.getElementById('apr-beschrijving').value.trim(),
    doel: document.getElementById('apr-doel').value.trim(),
    niveau: document.getElementById('apr-niveau').value,
    dagenPerWeek: document.getElementById('apr-dagenperweek').value.trim(),
    foto: _aprPhotoData || null,
    dagen: {}
  });
  progSlaOp();
  progActiefId = id;
  progActiefDagIdx = null;
  progSelectedOefIdx = null;

  // Bewust _setActiveTrainingTabDom() i.p.v. switchTrainingTab('programmas')
  // -- die laatste reset progActiefId altijd naar null (voor de normale
  // tabklik, die de lijst moet tonen), terwijl we hier juist meteen de
  // editor van het zojuist aangemaakte programma willen openen.
  _setActiveTrainingTabDom('programmas');
  renderProgrammas();
}

function progVerwijder(id) {
  if (!progCanEdit()) return;
  const prog = progLijst.find(p => p.id === id);
  if (!prog || prog.builtin) return;
  if (!confirm(t('programmas.confirmDelete'))) return;
  progLijst = progLijst.filter(p => p.id !== id);
  if (progMode === 'prime') {
    primeProgLijst = progLijst;
    try { localStorage.setItem('prime_prime_programmas', JSON.stringify(primeProgLijst)); } catch(e) { console.error(e); }
    deletePrimeProgramFromCloud(id);
  } else {
    progSlaOp();
  }
  renderProgrammas();
}

function progOpenEditor(id) {
  const prog = progLijst.find(p => p.id === id);
  if (!prog || prog.builtin) return;
  progActiefId = id;
  progActiefDagIdx = null;
  progSelectedOefIdx = null;
  renderProgrammas();
}

function progTerugNaarLijst() {
  progActiefId = null;
  progActiefDagIdx = null;
  progSelectedOefIdx = null;
  renderProgrammas();
}

function progNaamBijwerken(val) {
  if (!progCanEdit()) return;
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog) return;
  prog.naam = val;
  progSlaOp();
  // Header-titel direct bijwerken zonder de hele editor opnieuw te tekenen
  // (dat zou de focus/scroll van andere velden onnodig verstoren).
  const titleEl = document.querySelector('.prog-title-static');
  if (titleEl) titleEl.textContent = dispName(prog);
}

// Selecteert een dag in kolom 1 (toont zijn oefeningen in kolom 2).
function progDagSelecteer(dagIdx) {
  progActiefDagIdx = dagIdx;
  progSelectedOefIdx = null;
  renderProgrammas();
}

function progDagNaamBijwerken(val) {
  if (!progCanEdit()) return;
  const prog = progLijst.find(p => p.id === progActiefId);
  if (prog && progActiefDagIdx !== null) {
    if (!prog.dagen[progActiefDagIdx]) prog.dagen[progActiefDagIdx] = { naam: '', oefeningen: [] };
    prog.dagen[progActiefDagIdx].naam = val;
    progSlaOp();
    renderProgrammas();
  }
}

// Voegt een nieuwe dag toe aan het einde van de reeks (volgend vrij, oplopend nummer).
function progDagToevoegen() {
  if (!progCanEdit()) return;
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog) return;
  if (!prog.dagen) prog.dagen = {};
  const bestaande = Object.keys(prog.dagen).map(Number);
  const nieuwIdx = bestaande.length ? Math.max(...bestaande) + 1 : 0;
  prog.dagen[nieuwIdx] = { naam: '', oefeningen: [] };
  progSlaOp();
  progActiefDagIdx = nieuwIdx;
  progSelectedOefIdx = null;
  renderProgrammas();
}

// Verwijdert een dag en nummert de resterende dagen daarna opnieuw door, zodat
// 'Dag 1, Dag 2, ...' altijd een aaneengesloten reeks zonder gaten blijft.
function progDagVerwijder(dagIdx) {
  if (!progCanEdit()) return;
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog || !prog.dagen) return;
  if (!confirm(t('programmas.confirmDeleteDay'))) return;
  const overigeIndexen = Object.keys(prog.dagen).map(Number).filter(i => i !== dagIdx).sort((a,b) => a-b);
  const nieuweDagen = {};
  overigeIndexen.forEach((oudIdx, nieuwIdx) => { nieuweDagen[nieuwIdx] = prog.dagen[oudIdx]; });
  prog.dagen = nieuweDagen;
  progActiefDagIdx = null; // opnieuw laten bepalen (eerste dag) bij render
  progSelectedOefIdx = null;
  progSlaOp();
  renderProgrammas();
}

// ─── Acties: oefeningen binnen de geselecteerde dag ───────────────────────────
// "+ Oefening" stuurt door naar het volledige Losse-oefeningen-scherm
// (zoeken, foto's, per spiergroep -- zelfde scherm als vanuit Vandaag/
// Weekplanning) i.p.v. het vroegere kleine, ingeklapte lijstje hier
// inline te tonen. _progPickingForProgram (training.js) zorgt dat het
// sets/notities-scherm daarna weet dat de gekozen oefening bij DEZE
// programmadag moet komen i.p.v. bij Vandaag, en dat de datumkeuze
// (zinloos voor een programma-sjabloon) verborgen blijft. Zie
// progOefUitBibliotheekBevestigen() hieronder en edSubmit() in
// training.js.
function progOefUitLosseOefeningenKiezen() {
  if (!progCanEdit()) return;
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog || progActiefDagIdx === null) return;
  _progPickingForProgram = true;
  switchTrainingTab('oefeningen');
}

// Callback vanuit edSubmit() (training.js) zodra je in de "+ Oefening"-
// flow hierboven een oefening hebt gekozen en de sets/rust/notities
// hebt ingevuld -- voegt 'm toe aan de actieve programmadag en stuurt
// je terug naar de editor van datzelfde programma/dezelfde dag.
function progOefUitBibliotheekBevestigen(exId, sets, notes) {
  _progPickingForProgram = false;
  if (progCanEdit()) {
    const prog = progLijst.find(p => p.id === progActiefId) || primeProgLijst.find(p => p.id === progActiefId);
    const ex = typeof findAnyExtraExercise === 'function' ? findAnyExtraExercise(exId) : null;
    if (prog && ex && progActiefDagIdx !== null) {
      if (!prog.dagen[progActiefDagIdx]) prog.dagen[progActiefDagIdx] = { naam: '', oefeningen: [] };
      const laatsteSet = sets[sets.length - 1] || {};
      prog.dagen[progActiefDagIdx].oefeningen.push({
        naam: dispName(ex),
        sets: String(sets.length),
        reps: laatsteSet.reps || '',
        rust: laatsteSet.rest || '',
        setsDetail: sets,
        stappen: ex.stappen || '',
        notities: notes || ''
      });
      progSelectedOefIdx = prog.dagen[progActiefDagIdx].oefeningen.length - 1;
      progSlaOp();
    }
  }
  closeExerciseDetail();
  // Rechtstreeks de zichtbare tab bijwerken (_setActiveTrainingTabDom,
  // training.js) i.p.v. switchTrainingTab(): die laatste reset bij
  // "primeprog" ook meteen progActiefId/progActiefDagIdx (voor
  // rechtstreekse navigatie naar de lijst) ÉN triggert een
  // primeProgRefreshFromCloud() -- die kan de wijziging hierboven
  // overschrijven met nog-niet-bijgewerkte clouddata als de eigen
  // upsert (progSlaOp(), hierboven) nog niet klaar is (race condition
  // -- dit was de oorzaak van "een toegevoegde oefening verdwijnt
  // weer" bij PRIME-programma's). progMode/progActiefId/
  // progActiefDagIdx staan hier al goed (nooit aangeraakt), dus is
  // geen reset/herstel nodig.
  _setActiveTrainingTabDom(progMode === 'prime' ? 'primeprog' : 'programmas');
  renderProgrammas();
}

function progOefVerwijder(oefIdx) {
  if (!progCanEdit()) return;
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog || progActiefDagIdx === null || !prog.dagen[progActiefDagIdx]) return;
  prog.dagen[progActiefDagIdx].oefeningen.splice(oefIdx, 1);
  if (progSelectedOefIdx === oefIdx) progSelectedOefIdx = null;
  else if (progSelectedOefIdx !== null && progSelectedOefIdx > oefIdx) progSelectedOefIdx--;
  progSlaOp();
  renderProgrammas();
}

// (Het vroegere detailpaneel -- progGeselecteerdeOef/progOefDetailUpdate*/
// progBouwOefDetail -- is vervangen door progOefBewerken()/
// progOefBewerkenOpslaan() hierboven, die het gedeelde sets/notities-
// scherm gebruiken i.p.v. een altijd-open kolom ernaast.)

// (De vroegere inline "Bibliotheek"-uitklapper -- progToggleBibliotheek/
// progBouwBibliotheek/progOefUitBibliotheek -- is vervangen door
// progOefUitLosseOefeningenKiezen()/progOefUitBibliotheekBevestigen()
// hierboven, die het volledige Losse-oefeningen-scherm hergebruiken
// i.p.v. een eigen, kleinere lijst.)

// ─── Programma inplannen (startdatum + aantal weken + weekdagen) ─────────────
// "Laden in weekplanning" opent nu een modaal (zelfde opzet als een
// 'workout inplannen'-scherm) i.p.v. het programma stilzwijgend over de
// huidige kalenderweek te cyclen: de coach kiest zelf een startdatum, het
// aantal weken en op welke weekdagen het programma terugkeert. De
// programmadagen (Dag 1, Dag 2, ...) worden daarna cyclisch over precies
// die gekozen weekdagen verdeeld, voor het gekozen aantal weken.
let progScheduleProgId = null;

function progLadenInWeekplanning(id) {
  progLaadData();
  let prog = progLijst.find(p => p.id === id);
  // Kan ook een PRIME-programma zijn terwijl 'normal' actief is (of andersom
  // als deze ooit los aangeroepen wordt) -- val terug op de andere lijst.
  if (!prog) prog = primeProgLijst.find(p => p.id === id);
  if (!prog) return;
  if (!prog.dagen || !Object.keys(prog.dagen).length) {
    alert(t('weekplan.scheduleNoDays'));
    return;
  }

  progScheduleProgId = id;
  const aantalDagen = Object.keys(prog.dagen).length;
  const aantalOef = Object.values(prog.dagen).reduce((a, d) => a + (d.oefeningen || []).length, 0);
  document.getElementById('sched-program-name').textContent =
    dispName(prog) + ' · ' + t('programmas.daysExercisesSummary', { days: aantalDagen, ex: aantalOef });
  document.getElementById('sched-start-date').value = wpStr(new Date());
  document.getElementById('sched-weeks').value = 1;
  document.getElementById('sched-days-wrap').innerHTML = [0,1,2,3,4,5,6].map(i => `
    <label style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;font-size:11px;color:var(--muted)">
      <span>${wpDagKort(i)}</span>
      <input type="checkbox" class="sched-day-chk" data-day="${i}" style="width:16px;height:16px;accent-color:var(--sage);cursor:pointer">
    </label>`).join('');
  document.getElementById('schedule-program-modal').classList.add('open');
}

function progCloseScheduleModal() {
  document.getElementById('schedule-program-modal').classList.remove('open');
}

function progConfirmSchedule() {
  if (!progScheduleProgId) return;
  progLaadData();
  let prog = progLijst.find(p => p.id === progScheduleProgId);
  if (!prog) prog = primeProgLijst.find(p => p.id === progScheduleProgId);
  if (!prog) { progCloseScheduleModal(); return; }

  const dagIndexen = Object.keys(prog.dagen || {}).map(Number).sort((a,b) => a-b);
  if (!dagIndexen.length) { progCloseScheduleModal(); return; }

  const startVal = document.getElementById('sched-start-date').value;
  if (!startVal) { alert(t('foodweek.copy.chooseStartDate')); return; }
  const weeks = parseInt(document.getElementById('sched-weeks').value, 10) || 1;
  const selectedWeekdays = [...document.querySelectorAll('.sched-day-chk')].filter(c => c.checked).map(c => parseInt(c.dataset.day, 10));
  if (!selectedWeekdays.length) { alert(t('foodweek.copy.chooseDays')); return; }

  const start = wpDate(startVal);
  const end = new Date(start);
  end.setDate(start.getDate() + weeks * 7 - 1);

  const targets = [];
  const cur = new Date(start);
  while (cur <= end) {
    const wd = cur.getDay(); // 0=Zo..6=Za
    const idx = wd === 0 ? 6 : wd - 1; // 0=Ma..6=Zo, zelfde volgorde als sched-days-wrap
    if (selectedWeekdays.includes(idx)) targets.push(wpStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  if (!targets.length) { alert(t('foodweek.copy.noMatchingDays')); return; }

  // Cyclisch door de programmadagen heen: eerste gekozen datum krijgt Dag 1,
  // de volgende Dag 2, enzovoort, en begint weer bij Dag 1 zodra het einde
  // van de programmareeks bereikt is.
  targets.forEach((dateStr, i) => {
    const dagIdx = dagIndexen[i % dagIndexen.length];
    geplanning = geplanning.filter(p => p.date !== dateStr);
    geplanning.push({ date: dateStr, schemaId: 'prog:' + progScheduleProgId + ':' + dagIdx });
  });

  wpSlaPlanningOp();
  progCloseScheduleModal();
  try { showToast(t('weekplan.scheduleSuccess', { n: targets.length })); } catch(e) { console.error(e); }
  switchTrainingTab('weekplanning');
}

// ─── Opslaan als PRIME-programma ───────────────────────────────────────────────
// Kloont het huidige (eigen) programma naar een nieuw, gedeeld PRIME-
// programma. De naam krijgt altijd de vaste prefix 'PRIME-' -- dat deel is
// niet aanpasbaar in het modaal, alleen het stuk erna.
function progOpenPrimeSaveModal() {
  if (!isPrimeCoach() || progMode !== 'normal') return;
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog) return;
  document.getElementById('prime-save-suffix').value = '';
  document.getElementById('prime-save-error').textContent = '';
  document.getElementById('prime-save-modal').classList.add('open');
  document.getElementById('prime-save-suffix').focus();
}

function closePrimeSaveModal() {
  document.getElementById('prime-save-modal').classList.remove('open');
}

function confirmPrimeSave() {
  if (!isPrimeCoach() || progMode !== 'normal') return;
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog) return;
  const suffix = document.getElementById('prime-save-suffix').value.trim();
  if (!suffix) {
    document.getElementById('prime-save-error').textContent = t('programmas.prime.nameRequired');
    return;
  }
  const nieuw = {
    id: 'prime' + Date.now() + Math.floor(Math.random() * 1000),
    naam: 'PRIME-' + suffix,
    foto: prog.foto || null,
    beschrijving: prog.beschrijving || '',
    doel: prog.doel || '',
    niveau: prog.niveau || '',
    dagenPerWeek: prog.dagenPerWeek || '',
    dagen: JSON.parse(JSON.stringify(prog.dagen || {}))
  };
  primeProgLijst.push(nieuw);
  try { localStorage.setItem('prime_prime_programmas', JSON.stringify(primeProgLijst)); } catch(e) { console.error(e); }
  savePrimeProgramToCloud(nieuw);

  closePrimeSaveModal();
  try { showToast(t('programmas.prime.saved')); } catch(e) { console.error(e); }

  // Meteen naar het nieuwe PRIME-programma springen, ter bevestiging.
  switchTrainingTab('primeprog');
  progActiefId = nieuw.id;
  progActiefDagIdx = null;
  progSelectedOefIdx = null;
  renderProgrammas();
}
