// ========== PROGRAMMA'S ==========
let progLijst = [];
let progActiefId = null;
let progActiefDagIdx = null;   // welke dag is geselecteerd in kolom 1
let progSelectedOefIdx = null; // welke oefening is geselecteerd in kolom 2 (detail in kolom 3)
let progBibliotheekOpen = false;

const PROG_DAGEN_KORT = ['Ma','Di','Wo','Do','Vr','Za','Zo'];
const PROG_DAGEN_LANG = ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag'];
const PROG_DAGEN_KORT_EN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const PROG_DAGEN_LANG_EN = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function progDagKort(i) { return (currentLang === 'en' ? PROG_DAGEN_KORT_EN : PROG_DAGEN_KORT)[i]; }
function progDagLang(i) { return (currentLang === 'en' ? PROG_DAGEN_LANG_EN : PROG_DAGEN_LANG)[i]; }

function progLaadData() {
  let userProgs = [];
  try { userProgs = JSON.parse(localStorage.getItem('prime_programmas') || '[]'); }
  catch(e) {}
  const builtinIds = new Set(BUILTIN_PROGRAMMAS.map(p => p.id));
  progLijst = [...BUILTIN_PROGRAMMAS, ...userProgs.filter(p => !builtinIds.has(p.id))];
}

function progSlaOp() {
  syncSet('prime_programmas', progLijst.filter(p => !p.builtin));
}

function renderProgrammas() {
  progLaadData();
  const el = document.getElementById('programmas-content');
  if (!el) return;
  el.innerHTML = progActiefId !== null ? progBouw3ColEditor() : progBouwLijst();
}

// ─── Lijst ───────────────────────────────────────────────────────────────────
function progBouwLijst() {
  if (!progLijst.length) {
    return '<div class="card" style="text-align:center;padding:40px 20px">' +
      '<div style="font-size:40px;margin-bottom:12px">\u{1F4CB}</div>' +
      '<div style="font-family:\'DM Serif Display\',serif;font-size:20px;margin-bottom:8px">' + t('programmas.empty.title') + '</div>' +
      '<div style="font-size:13px;color:var(--muted);margin-bottom:24px">' + t('programmas.empty.hint') + '</div>' +
      '<button class="btn-primary" onclick="progNieuw()">' + t('programmas.new') + '</button>' +
      '</div>';
  }

  const kaarten = progLijst.map(prog => {
    const aantalDagen = Object.keys(prog.dagen || {}).length;
    const aantalOef   = Object.values(prog.dagen || {}).reduce((a, d) => a + (d.oefeningen || []).length, 0);
    // Vaste programma's blijven op kalenderweekdagen staan (Ma/Di/...); eigen
    // programma's hebben een vrije dagreeks, dus die tonen 'Dag 1 · Dag 2 · ...'.
    const dagIcons    = Object.keys(prog.dagen || {}).sort((a,b) => Number(a)-Number(b))
      .map(i => prog.builtin ? progDagKort(Number(i)) : (Number(i) + 1)).join(' \xB7 ');
    const knoppen = prog.builtin
      ? '<button class="btn-primary" style="width:100%;padding:10px" onclick="progLadenInWeekplanning(\'' + prog.id + '\')">' + t('programmas.loadIntoWeekplan') + '</button>'
      : '<button class="btn-primary" style="flex:1;min-width:140px;padding:10px" onclick="progLadenInWeekplanning(\'' + prog.id + '\')">' + t('programmas.loadIntoWeekplan') + '</button>' +
        '<button class="btn-sm" onclick="progOpenEditor(\'' + prog.id + '\')">' + t('common.edit') + '</button>' +
        '<button class="btn-sm" style="color:var(--accent);border-color:#e8c4a8;background:var(--accent-light)" onclick="progVerwijder(\'' + prog.id + '\')">' + t('common.delete') + '</button>';
    return '<div class="card" style="margin-bottom:12px' + (prog.builtin ? ';border-color:var(--sage)' : '') + '">' +
      '<div style="margin-bottom:10px">' +
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
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' + knoppen + '</div>' +
      '</div>';
  }).join('');

  return '<div style="margin-bottom:4px">' + kaarten + '</div>' +
    '<button class="btn-primary" style="width:100%" onclick="progNieuw()">' + t('programmas.new') + '</button>';
}

// ─── Programma editor: dagen | oefeningen | detail naast elkaar ──────────────
// Dagen zijn een vrije, oplopende reeks ('Dag 1', 'Dag 2', ...) i.p.v. vast
// gekoppeld aan kalenderweekdagen -- een programma kan zo een trainingscyclus
// van elke gewenste lengte zijn (bv. een 4-daagse split of een 11-daags blok).
function progBouw3ColEditor() {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog) { progActiefId = null; return progBouwLijst(); }
  if (!prog.dagen) prog.dagen = {};

  const dagIndexen = Object.keys(prog.dagen).map(Number).sort((a,b) => a-b);
  if (progActiefDagIdx === null || !prog.dagen[progActiefDagIdx]) {
    progActiefDagIdx = dagIndexen.length ? dagIndexen[0] : null;
    progSelectedOefIdx = null;
  }
  const geselecteerdeDag = progActiefDagIdx !== null ? prog.dagen[progActiefDagIdx] : null;
  const oefeningen = geselecteerdeDag ? (geselecteerdeDag.oefeningen || []) : [];
  if (progSelectedOefIdx === null || progSelectedOefIdx >= oefeningen.length) {
    progSelectedOefIdx = oefeningen.length ? 0 : null;
  }
  const geselecteerdeOef = progSelectedOefIdx !== null ? oefeningen[progSelectedOefIdx] : null;

  // Kolom 1: dagen
  const dagRijenHtml = dagIndexen.map(i => {
    const dag = prog.dagen[i];
    const naam = (dag.naam_en && currentLang === 'en') ? dag.naam_en : (dag.naam || '');
    const isActief = i === progActiefDagIdx;
    return '<div class="prog-list-row' + (isActief ? ' active' : '') + '" onclick="progDagSelecteer(' + i + ')">' +
      '<span>' + t('programmas.dayLabel', { n: i + 1 }) + (naam ? ' – ' + naam : '') + '</span>' +
      '<button class="prog-list-row-remove" onclick="event.stopPropagation();progDagVerwijder(' + i + ')" title="' + t('common.delete') + '">&#x2715;</button>' +
      '</div>';
  }).join('');

  // Kolom 2: oefeningen van de geselecteerde dag
  let oefRijenHtml;
  if (!geselecteerdeDag) {
    oefRijenHtml = '<div class="prog-list-empty">' + t('programmas.selectDayHint') + '</div>';
  } else if (!oefeningen.length) {
    oefRijenHtml = '<div class="prog-list-empty">' + t('programmas.noExercisesHint') + '</div>';
  } else {
    oefRijenHtml = oefeningen.map((oef, i) => {
      const canonical = findCanonicalExercise(oef.naam);
      const photo = canonical ? canonical.photo : null;
      const isActief = i === progSelectedOefIdx;
      const meta = oef.stappen ? oef.stappen : (oef.sets ? oef.sets + '\xD7 ' + (oef.reps || '') : (oef.reps || ''));
      return '<div class="prog-list-row prog-oef-row' + (isActief ? ' active' : '') + '" onclick="progSelectOef(' + i + ')">' +
        (photo
          ? '<div class="prog-oef-thumb" style="background-image:url(\'' + photo + '\')"></div>'
          : '<div class="prog-oef-thumb prog-oef-thumb-icon">' + (canonical ? canonical.icon : '\u{1F3CB}️') + '</div>') +
        '<div class="prog-oef-info"><div class="prog-oef-name">' + (oef.naam || t('programmas.exercisePlaceholder')) + '</div><div class="prog-oef-meta">' + meta + '</div></div>' +
        '<button class="prog-list-row-remove" onclick="event.stopPropagation();progOefVerwijder(' + i + ')" title="' + t('common.delete') + '">&#x2715;</button>' +
        '</div>';
    }).join('');
  }

  // Kolom 3: sets/notities-detail van de geselecteerde oefening
  const detailHtml = geselecteerdeOef
    ? progBouwOefDetail(geselecteerdeOef)
    : '<div class="prog-list-empty" style="padding:60px 10px">' + t('programmas.selectExerciseHint') + '</div>';

  return '<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">' +
    '<button class="prog-back-btn" onclick="progTerugNaarLijst()">' + t('common.back') + '</button>' +
    '<input type="text" id="prog-naam-input" class="prog-title-input" value="' + prog.naam.replace(/"/g,'&quot;') + '" onchange="progNaamBijwerken(this.value)">' +
    '</div>' +
    progBouwInfoKaart(prog) +
    '<div class="prog-3col">' +

    '<div class="prog-col">' +
    '<div class="prog-col-head"><span>' + t('programmas.trainingDays') + '</span></div>' +
    '<div class="prog-col-actions">' +
    '<button class="prog-col-add" onclick="progDagToevoegen()">' + t('programmas.addDay') + '</button>' +
    '</div>' +
    '<div class="prog-col-body">' + dagRijenHtml + '</div>' +
    '</div>' +

    '<div class="prog-col">' +
    '<div class="prog-col-head"><span>' + t('programmas.exercisesLabel') + '</span></div>' +
    (geselecteerdeDag
      ? '<div class="prog-col-actions">' +
        '<button class="prog-col-add" onclick="progOefToevoegen()">' + t('programmas.addEmptyField') + '</button>' +
        '<button class="prog-col-add' + (progBibliotheekOpen ? ' active' : '') + '" onclick="progToggleBibliotheek()">' + t('programmas.library') + '</button>' +
        '</div>'
      : '') +
    (geselecteerdeDag
      ? '<div class="prog-day-name-row">' +
        '<label>' + t('programmas.dayNameLabel') + '</label>' +
        '<input type="text" class="prog-day-title-input" value="' + (geselecteerdeDag.naam || '').replace(/"/g,'&quot;') + '" placeholder="' + t('programmas.dayNamePlaceholder') + '" onchange="progDagNaamBijwerken(this.value)">' +
        '</div>'
      : '') +
    '<div class="prog-col-body">' + oefRijenHtml + '</div>' +
    (progBibliotheekOpen && geselecteerdeDag ? progBouwBibliotheek(oefeningen) : '') +
    '</div>' +

    '<div class="prog-col prog-col-detail">' + detailHtml + '</div>' +

    '</div>';
}

// Programma-info: beschrijving, doel, niveau en dagen per week -- los van de
// naam (die al bovenaan staat) en los van de dagen/oefeningen zelf. Altijd
// zichtbaar en direct bewerkbaar, net als de rest van de editor (autosave).
function progBouwInfoKaart(prog) {
  return '<div class="card prog-info-kaart">' +
    '<div class="form-row"><label>' + t('programmas.info.description') + '</label>' +
    '<textarea class="prog-info-textarea" placeholder="' + t('programmas.info.descriptionPlaceholder') + '" onchange="progInfoBijwerken(\'beschrijving\',this.value)">' + (prog.beschrijving || '').replace(/</g,'&lt;') + '</textarea>' +
    '</div>' +
    '<div class="prog-info-grid">' +
    '<div class="form-row"><label>' + t('programmas.info.goal') + '</label>' +
    '<input type="text" value="' + (prog.doel || '').replace(/"/g,'&quot;') + '" placeholder="' + t('programmas.info.goalPlaceholder') + '" onchange="progInfoBijwerken(\'doel\',this.value)"></div>' +
    '<div class="form-row"><label>' + t('programmas.info.level') + '</label>' +
    '<select onchange="progInfoBijwerken(\'niveau\',this.value)">' +
    '<option value=""' + (!prog.niveau ? ' selected' : '') + '>—</option>' +
    ['Beginner','Gemiddeld','Gevorderd'].map(lvl =>
      '<option value="' + lvl + '"' + (prog.niveau === lvl ? ' selected' : '') + '>' + t('programmas.level.' + lvl.toLowerCase()) + '</option>'
    ).join('') +
    '</select></div>' +
    '<div class="form-row"><label>' + t('programmas.info.daysPerWeek') + '</label>' +
    '<input type="text" value="' + (prog.dagenPerWeek || '').replace(/"/g,'&quot;') + '" placeholder="' + t('programmas.info.daysPerWeekPlaceholder') + '" onchange="progInfoBijwerken(\'dagenPerWeek\',this.value)"></div>' +
    '</div>' +
    '</div>';
}

function progInfoBijwerken(veld, val) {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (prog) { prog[veld] = val; progSlaOp(); }
}

// Detailpaneel (kolom 3): naam, foto, per-set herhalingen/rust, notities.
// Stappen-oefeningen (Wandelen e.d.) krijgen i.p.v. de sets-tabel één
// stappen-veld, net als voorheen in de tabelweergave.
function progBouwOefDetail(oef) {
  const canonical = findCanonicalExercise(oef.naam);
  const photo = canonical ? canonical.photo : null;
  const photoHtml = '<div class="ed-photo-wrap">' +
    (photo ? '<img src="' + photo + '" alt="">' : '<div style="font-size:48px;text-align:center;padding:40px 0">' + (canonical ? canonical.icon : '\u{1F3CB}️') + '</div>') +
    '</div>';
  const naamInput = '<input type="text" class="prog-detail-title-input" value="' + (oef.naam || '').replace(/"/g,'&quot;') + '" placeholder="' + t('programmas.exercisePlaceholder') + '" onchange="progOefDetailUpdateName(this.value)">';
  const notesHtml = '<div class="divider" style="margin:20px 0"></div>' +
    '<div class="ed-field-label">' + t('extra.detail.notesLabel') + '</div>' +
    '<textarea class="ed-notes" placeholder="' + t('extra.detail.notesPlaceholder') + '" onchange="progOefDetailUpdateNotes(this.value)">' + (oef.notities || '').replace(/</g,'&lt;') + '</textarea>';

  const isStappen = oef.naam === 'Wandelen' || oef.naam === 'Walking' || (oef.stappen !== undefined && oef.stappen !== '');
  if (isStappen) {
    return naamInput + photoHtml +
      '<div class="ed-field-label">' + t('programmas.stepsPerDay') + '</div>' +
      '<input type="text" class="ed-set-input" style="width:100%;box-sizing:border-box;text-align:left" value="' + (oef.stappen || '8000-10000').replace(/"/g,'&quot;') + '" placeholder="' + t('programmas.stepsPlaceholder') + '" onchange="progOefDetailUpdateStappen(this.value)">' +
      notesHtml;
  }

  const sets = (oef.setsDetail && oef.setsDetail.length) ? oef.setsDetail : progOefAfgeleidesSets(oef);
  const setsRowsHtml = sets.map((s, i) => (
    '<div class="ed-set-row">' +
    '<div class="ed-set-grid" style="flex:1">' +
    '<div class="ed-set-num">' + (i + 1) + '</div>' +
    '<input class="ed-set-input" type="text" value="' + (s.reps || '').replace(/"/g,'&quot;') + '" onchange="progOefDetailUpdateSet(' + i + ',\'reps\',this.value)">' +
    '<input class="ed-set-input" type="text" value="' + (s.rest || '').replace(/"/g,'&quot;') + '" onchange="progOefDetailUpdateSet(' + i + ',\'rest\',this.value)">' +
    '</div>' +
    (sets.length > 1 ? '<button class="ed-rm-btn" onclick="progOefDetailRemoveSet(' + i + ')" title="' + t('extra.detail.removeSet') + '">×</button>' : '<span style="width:20px;flex-shrink:0"></span>') +
    '</div>'
  )).join('');

  return naamInput + photoHtml +
    '<div class="ed-field-label">' + t('extra.detail.setsLabel') + '</div>' +
    '<div class="ed-set-grid ed-set-head"><span></span><span>' + t('extra.detail.reps') + '</span><span>' + t('extra.detail.rest') + '</span></div>' +
    setsRowsHtml +
    '<button class="ed-add-set" onclick="progOefDetailAddSet()">' + t('extra.detail.addSet') + '</button>' +
    notesHtml;
}

// Leidt een startpunt voor de sets-tabel af uit de simpele sets/reps/rust-
// velden, voor oefeningen die nog geen losse setsDetail hebben.
function progOefAfgeleidesSets(oef) {
  const n = Number(oef.sets) || 1;
  const restMatch = String(oef.rust || '').match(/(\d+)/);
  return Array.from({ length: n }, () => ({ reps: oef.reps || '', rest: restMatch ? restMatch[1] : '' }));
}

// ─── Acties: programma & dagen ────────────────────────────────────────────────
function progNieuw() {
  const id = 'p' + Date.now() + Math.floor(Math.random() * 1000);
  progLijst.push({ id, naam: t('programmas.newProgramName'), dagen: {} });
  progSlaOp();
  progActiefId = id;
  progActiefDagIdx = null;
  progSelectedOefIdx = null;
  renderProgrammas();
}

function progVerwijder(id) {
  const prog = progLijst.find(p => p.id === id);
  if (!prog || prog.builtin) return;
  if (!confirm(t('programmas.confirmDelete'))) return;
  progLijst = progLijst.filter(p => p.id !== id);
  progSlaOp();
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
  progBibliotheekOpen = false;
  renderProgrammas();
}

function progNaamBijwerken(val) {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (prog) { prog.naam = val; progSlaOp(); }
}

// Selecteert een dag in kolom 1 (toont zijn oefeningen in kolom 2).
function progDagSelecteer(dagIdx) {
  progActiefDagIdx = dagIdx;
  progSelectedOefIdx = null;
  renderProgrammas();
}

function progDagNaamBijwerken(val) {
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
function progSelectOef(oefIdx) {
  progSelectedOefIdx = oefIdx;
  renderProgrammas();
}

function progOefToevoegen() {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog || progActiefDagIdx === null) return;
  const idx = progActiefDagIdx;
  if (!prog.dagen[idx]) prog.dagen[idx] = { naam: '', oefeningen: [] };
  prog.dagen[idx].oefeningen.push({ naam: '', sets: '3', reps: '10', rust: '60 sec', notities: '' });
  progSelectedOefIdx = prog.dagen[idx].oefeningen.length - 1;
  progSlaOp();
  renderProgrammas();
}

function progOefVerwijder(oefIdx) {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog || progActiefDagIdx === null || !prog.dagen[progActiefDagIdx]) return;
  prog.dagen[progActiefDagIdx].oefeningen.splice(oefIdx, 1);
  if (progSelectedOefIdx === oefIdx) progSelectedOefIdx = null;
  else if (progSelectedOefIdx !== null && progSelectedOefIdx > oefIdx) progSelectedOefIdx--;
  progSlaOp();
  renderProgrammas();
}

// ─── Acties: detailpaneel (kolom 3) van de geselecteerde oefening ─────────────
function progGeselecteerdeOef() {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog || progActiefDagIdx === null || progSelectedOefIdx === null) return null;
  const dag = prog.dagen[progActiefDagIdx];
  if (!dag) return null;
  return dag.oefeningen[progSelectedOefIdx] || null;
}

function progOefDetailUpdateName(val) {
  const oef = progGeselecteerdeOef();
  if (!oef) return;
  oef.naam = val;
  progSlaOp();
  renderProgrammas();
}

function progOefDetailUpdateStappen(val) {
  const oef = progGeselecteerdeOef();
  if (!oef) return;
  oef.stappen = val;
  progSlaOp();
  renderProgrammas();
}

function progOefDetailUpdateNotes(val) {
  const oef = progGeselecteerdeOef();
  if (!oef) return;
  oef.notities = val;
  progSlaOp();
}

function progOefDetailUpdateSet(setIdx, veld, val) {
  const oef = progGeselecteerdeOef();
  if (!oef) return;
  if (!oef.setsDetail || !oef.setsDetail.length) oef.setsDetail = progOefAfgeleidesSets(oef);
  if (!oef.setsDetail[setIdx]) return;
  oef.setsDetail[setIdx][veld] = val;
  oef.sets = String(oef.setsDetail.length);
  progSlaOp();
  renderProgrammas();
}

function progOefDetailAddSet() {
  const oef = progGeselecteerdeOef();
  if (!oef) return;
  if (!oef.setsDetail || !oef.setsDetail.length) oef.setsDetail = progOefAfgeleidesSets(oef);
  const last = oef.setsDetail[oef.setsDetail.length - 1];
  oef.setsDetail.push({ reps: last ? last.reps : '', rest: last ? last.rest : '' });
  oef.sets = String(oef.setsDetail.length);
  progSlaOp();
  renderProgrammas();
}

function progOefDetailRemoveSet(setIdx) {
  const oef = progGeselecteerdeOef();
  if (!oef || !oef.setsDetail) return;
  oef.setsDetail.splice(setIdx, 1);
  oef.sets = String(oef.setsDetail.length);
  progSlaOp();
  renderProgrammas();
}

// ─── Bibliotheek: oefening kiezen uit Losse oefeningen ────────────────────────
function progToggleBibliotheek() {
  progBibliotheekOpen = !progBibliotheekOpen;
  renderProgrammas();
}

function progBouwBibliotheek(huidig) {
  const toegevoegdeNamen = new Set((huidig || []).map(o => (o.naam || '').toLowerCase()));

  const groepen = EXTRA_EXERCISES.map(groep => {
    const groepNaam = (currentLang === 'en' && groep.group_en) ? groep.group_en : groep.group;
    const rijen = groep.exercises.map(ex => {
      const naam = dispName(ex);
      const alIn = toegevoegdeNamen.has(naam.toLowerCase());
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--sand-dark)">' +
        '<div style="font-size:18px;flex-shrink:0;width:26px;text-align:center">' + ex.icon + '</div>' +
        '<div style="flex:1;min-width:0">' +
        '<div style="font-size:13px;font-weight:500;color:var(--charcoal)">' + naam + '</div>' +
        '<div style="font-size:11px;color:var(--muted)">' + (ex.stappen ? ex.stappen : (ex.sets ? ex.sets + ' ' + t('programmas.setsAbbr') + ' \xB7 ' + ex.reps + (ex.rest ? ' \xB7 ' + t('programmas.restAbbr') + ' ' + ex.rest : '') : (ex.reps || ''))) + '</div>' +
        '</div>' +
        '<button onclick="progOefUitBibliotheek(\'' + ex.id + '\')" ' +
        'style="flex-shrink:0;padding:5px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:\'DM Sans\',sans-serif;' +
        (alIn
          ? 'border:1.5px solid var(--sage);background:var(--sage-light);color:var(--sage)'
          : 'border:1.5px solid var(--sage);background:var(--sage);color:white') + '">' +
        (alIn ? t('programmas.inList') : t('programmas.addToList')) +
        '</button>' +
        '</div>';
    }).join('');

    return '<div style="margin-bottom:16px">' +
      '<div style="font-size:14px;font-weight:700;color:var(--charcoal);margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid var(--sage)">' +
      groep.icon + ' ' + groepNaam +
      '</div>' +
      rijen +
      '</div>';
  }).join('');

  return '<div style="padding:14px;border-top:1px solid var(--sand-dark);background:var(--sand)">' +
    '<div style="font-size:13px;font-weight:600;color:var(--charcoal);margin-bottom:14px">' + t('programmas.chooseFromLibrary') + '</div>' +
    groepen +
    '</div>';
}

function progOefUitBibliotheek(exId) {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog || progActiefDagIdx === null) return;
  const idx = progActiefDagIdx;
  if (!prog.dagen[idx]) prog.dagen[idx] = { naam: '', oefeningen: [] };

  let gevonden = null;
  for (const groep of EXTRA_EXERCISES) {
    gevonden = groep.exercises.find(e => e.id === exId);
    if (gevonden) break;
  }
  if (!gevonden) return;

  prog.dagen[idx].oefeningen.push({
    naam: dispName(gevonden),
    sets: String(gevonden.sets || ''),
    reps: String(gevonden.reps || ''),
    rust: gevonden.rest || '',
    stappen: gevonden.stappen || '',
    notities: ''
  });
  progSelectedOefIdx = prog.dagen[idx].oefeningen.length - 1;
  progSlaOp();
  renderProgrammas();
}

// ─── Laden in Weekplanning ─────────────────────────────────────────────────────
function progLadenInWeekplanning(id) {
  progLaadData();
  const prog = progLijst.find(p => p.id === id);
  if (!prog) return;

  let weekplanData = null;
  try { weekplanData = JSON.parse(localStorage.getItem('prime_weekplan') || 'null'); }
  catch(e) {}
  if (!weekplanData) weekplanData = { dagen: [null,null,null,null,null,null,null] };

  // Dagen zijn een vrije reeks (Dag 1, Dag 2, ...), niet per se 7 stuks --
  // bij het laden in de kalenderweek herhaalt de cyclus zich vanaf maandag
  // (dag 1 van het programma, dag 8, dag 15, ... vallen dus allemaal op
  // maandag). Bij een programma van 7 dagen of minder komt dit overeen met
  // het oude gedrag (elke programmadag exact op zijn eigen weekdag).
  const aantalDagen = prog.dagen ? Object.keys(prog.dagen).length : 0;
  for (let i = 0; i < 7; i++) {
    weekplanData.dagen[i] = aantalDagen > 0 ? 'prog:' + id + ':' + (i % aantalDagen) : null;
  }

  syncSet('prime_weekplan', weekplanData);
  switchTrainingTab('weekplanning');
}
