// ========== PROGRAMMA'S ==========
let progLijst = [];
let progActiefId = null;
let progActiefDagIdx = null;
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
  if (progActiefDagIdx !== null) {
    el.innerHTML = progBouwDagEditor();
  } else if (progActiefId !== null) {
    el.innerHTML = progBouwProgEditor();
  } else {
    el.innerHTML = progBouwLijst();
  }
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
      '<div style="font-size:12px;color:var(--muted)">' + t('programmas.daysExercisesSummary', { days: aantalDagen, ex: aantalOef }) + '</div>' +
      (dagIcons ? '<div style="font-size:11px;color:var(--sage);margin-top:3px;font-weight:600">' + dagIcons + '</div>' : '') +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' + knoppen + '</div>' +
      '</div>';
  }).join('');

  return '<div style="margin-bottom:4px">' + kaarten + '</div>' +
    '<button class="btn-primary" style="width:100%" onclick="progNieuw()">' + t('programmas.new') + '</button>';
}

// ─── Programma editor ────────────────────────────────────────────────────────
// Dagen zijn een vrije, oplopende reeks ('Dag 1', 'Dag 2', ...) i.p.v. vast
// gekoppeld aan kalenderweekdagen -- een programma kan zo een trainingscyclus
// van elke gewenste lengte zijn (bv. een 4-daagse split of een 11-daags blok).
function progBouwProgEditor() {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog) { progActiefId = null; return progBouwLijst(); }
  if (!prog.dagen) prog.dagen = {};

  const dagIndexen = Object.keys(prog.dagen).map(Number).sort((a,b) => a-b);
  const dagRijen = dagIndexen.map(i => {
    const dag = prog.dagen[i];
    const naam = (dag.naam_en && currentLang === 'en') ? dag.naam_en : (dag.naam || '');
    const aantalOef = (dag.oefeningen || []).length;
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;margin-bottom:8px;border-radius:10px;border:1.5px solid var(--sage);background:var(--sage-light)">' +
      '<div style="width:52px;font-size:12px;font-weight:700;color:var(--sage);flex-shrink:0">' + t('programmas.dayLabel', { n: i + 1 }) + '</div>' +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:13px;font-weight:600;color:var(--charcoal)">' + (naam || t('programmas.dayLabel', { n: i + 1 })) + '</div>' +
      '<div style="font-size:11px;color:var(--muted)">' + aantalOef + ' ' + (aantalOef !== 1 ? t('programmas.exercisesPlural') : t('programmas.exerciseSingular')) + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-shrink:0">' +
      '<button class="btn-sm" onclick="progDagBewerken(' + i + ')">' + t('common.edit') + '</button>' +
      '<button class="btn-sm" style="color:var(--accent)" onclick="progDagVerwijder(' + i + ')">&#x2715;</button>' +
      '</div>' +
      '</div>';
  }).join('');

  return '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">' +
    '<button onclick="progTerugNaarLijst()" style="padding:8px 14px;border-radius:10px;border:1.5px solid var(--sand-dark);background:var(--white);color:var(--charcoal);cursor:pointer;font-size:13px;font-family:\'DM Sans\',sans-serif">' + t('common.back') + '</button>' +
    '<div style="font-family:\'DM Serif Display\',serif;font-size:18px">' + t('programmas.editTitle') + '</div>' +
    '</div>' +
    '<div class="card" style="margin-bottom:14px">' +
    '<label style="font-size:12px;font-weight:600;color:var(--charcoal);display:block;margin-bottom:6px">' + t('programmas.nameLabel') + '</label>' +
    '<input type="text" id="prog-naam-input" value="' + prog.naam.replace(/"/g,'&quot;') + '"' +
    ' style="width:100%;padding:10px 14px;border:1.5px solid var(--sand-dark);border-radius:10px;' +
    'font-family:\'DM Sans\',sans-serif;font-size:14px;color:var(--charcoal);background:var(--sand);outline:none;box-sizing:border-box"' +
    ' oninput="progNaamBijwerken(this.value)">' +
    '</div>' +
    '<div class="card-label" style="margin-bottom:10px">' + t('programmas.trainingDays') + '</div>' +
    dagRijen +
    '<button class="btn-primary" style="width:100%;margin-top:4px" onclick="progDagToevoegen()">' + t('programmas.addDay') + '</button>';
}

// ─── Dag editor ───────────────────────────────────────────────────────────────
function progBouwDagEditor() {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog || progActiefDagIdx === null) { progActiefDagIdx = null; return progBouwProgEditor(); }
  const dagIdx = progActiefDagIdx;
  const dag    = (prog.dagen && prog.dagen[dagIdx]) || { naam: '', oefeningen: [] };
  const oefeningen = dag.oefeningen || [];

  const oefRijen = oefeningen.map(function(oef, i) {
    const isStappen = oef.naam === 'Wandelen' || oef.naam === 'Walking' || (oef.stappen !== undefined && oef.stappen !== '');
    const naamTd = '<td style="padding:4px 6px 4px 0"><input type="text" value="' + (oef.naam || '').replace(/"/g,'&quot;') +
      '" placeholder="' + t('programmas.exercisePlaceholder') + '" onchange="progOefNaamUpdate(' + i + ',this.value)"' +
      ' style="width:100%;padding:6px 8px;border:1px solid var(--sand-dark);border-radius:6px;font-size:12px;font-family:\'DM Sans\',sans-serif;background:var(--sand);box-sizing:border-box"></td>';
    const deleteTd = '<td style="padding:4px 0 4px 4px;text-align:center">' +
      '<button onclick="progOefVerwijder(' + i + ')" style="padding:5px 8px;border-radius:6px;border:none;background:none;color:var(--muted);cursor:pointer;font-size:14px">&#x2715;</button>' +
      '</td>';
    if (isStappen) {
      const stappenVal = (oef.stappen || '8000-10000').replace(/"/g,'&quot;');
      return '<tr>' + naamTd +
        '<td colspan="3" style="padding:4px 3px"><input type="text" value="' + stappenVal +
        '" placeholder="' + t('programmas.stepsPlaceholder') + '" onchange="progOefUpdate(' + i + ',\'stappen\',this.value)"' +
        ' style="width:100%;padding:6px 8px;border:1px solid var(--sage-mid);border-radius:6px;font-size:12px;font-family:\'DM Sans\',sans-serif;background:var(--sage-light);box-sizing:border-box">' +
        '<div style="font-size:10px;color:var(--sage);margin-top:2px">' + t('programmas.stepsPerDay') + '</div></td>' +
        '<td></td>' + deleteTd + '</tr>';
    }
    const hasDetail = oef.setsDetail && oef.setsDetail.length || oef.notities;
    const detailTd = '<td style="padding:4px 0 4px 4px;text-align:center">' +
      '<button onclick="progOefOpenDetail(' + i + ')" title="' + t('extra.detail.editBtn') + '" style="padding:5px 7px;border-radius:6px;border:1px solid ' + (hasDetail ? 'var(--accent)' : 'var(--sand-dark)') + ';background:' + (hasDetail ? 'var(--accent-light)' : 'var(--sand)') + ';cursor:pointer;font-size:12px">📝</button>' +
      '</td>';
    return '<tr>' + naamTd +
      '<td style="padding:4px 3px"><input type="text" value="' + (oef.sets || '').replace(/"/g,'&quot;') +
      '" placeholder="3" onchange="progOefUpdate(' + i + ',\'sets\',this.value)"' +
      ' style="width:44px;padding:6px 4px;border:1px solid var(--sand-dark);border-radius:6px;font-size:12px;text-align:center;font-family:\'DM Sans\',sans-serif;background:var(--sand)"></td>' +
      '<td style="padding:4px 3px"><input type="text" value="' + (oef.reps || '').replace(/"/g,'&quot;') +
      '" placeholder="10" onchange="progOefUpdate(' + i + ',\'reps\',this.value)"' +
      ' style="width:44px;padding:6px 4px;border:1px solid var(--sand-dark);border-radius:6px;font-size:12px;text-align:center;font-family:\'DM Sans\',sans-serif;background:var(--sand)"></td>' +
      '<td style="padding:4px 3px"><input type="text" value="' + (oef.rust || '').replace(/"/g,'&quot;') +
      '" placeholder="60s" onchange="progOefUpdate(' + i + ',\'rust\',this.value)"' +
      ' style="width:48px;padding:6px 4px;border:1px solid var(--sand-dark);border-radius:6px;font-size:12px;text-align:center;font-family:\'DM Sans\',sans-serif;background:var(--sand)"></td>' +
      detailTd + deleteTd + '</tr>';
  }).join('');

  return '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">' +
    '<button onclick="progTerugNaarProg()" style="padding:8px 14px;border-radius:10px;border:1.5px solid var(--sand-dark);background:var(--white);color:var(--charcoal);cursor:pointer;font-size:13px;font-family:\'DM Sans\',sans-serif">' + t('common.back') + '</button>' +
    '<div style="font-family:\'DM Serif Display\',serif;font-size:18px">' + t('programmas.dayLabel', { n: dagIdx + 1 }) + '</div>' +
    '</div>' +
    '<div class="card" style="margin-bottom:14px">' +
    '<label style="font-size:12px;font-weight:600;color:var(--charcoal);display:block;margin-bottom:6px">' + t('programmas.dayNameLabel') + '</label>' +
    '<input type="text" id="prog-dag-naam" value="' + (dag.naam || '').replace(/"/g,'&quot;') +
    '" placeholder="' + t('programmas.dayNamePlaceholder') + '"' +
    ' style="width:100%;padding:10px 14px;border:1.5px solid var(--sand-dark);border-radius:10px;' +
    'font-family:\'DM Sans\',sans-serif;font-size:14px;color:var(--charcoal);background:var(--sand);outline:none;box-sizing:border-box"' +
    ' oninput="progDagNaamBijwerken(this.value)">' +
    '</div>' +
    '<div class="card" style="margin-bottom:14px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
    '<div class="card-label">' + t('programmas.exercisesLabel') + '</div>' +
    '<div style="display:flex;gap:6px">' +
    '<button class="btn-sm" onclick="progOefToevoegen()">' + t('programmas.addEmptyField') + '</button>' +
    '<button class="btn-sm" style="' + (progBibliotheekOpen ? 'background:var(--sage);color:white;border-color:var(--sage)' : '') + '" onclick="progToggleBibliotheek()">' + t('programmas.library') + '</button>' +
    '</div>' +
    '</div>' +
    (oefeningen.length > 0
      ? '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">' +
        '<thead><tr>' +
        '<th style="text-align:left;padding:0 6px 8px 0;font-size:11px;color:var(--muted);font-weight:600">' + t('programmas.col.exercise') + '</th>' +
        '<th style="padding:0 3px 8px;font-size:11px;color:var(--muted);font-weight:600;text-align:center">' + t('programmas.col.sets') + '</th>' +
        '<th style="padding:0 3px 8px;font-size:11px;color:var(--muted);font-weight:600;text-align:center">' + t('programmas.col.reps') + '</th>' +
        '<th style="padding:0 3px 8px;font-size:11px;color:var(--muted);font-weight:600;text-align:center">' + t('programmas.col.rest') + '</th>' +
        '<th style="width:32px"></th>' +
        '<th style="width:32px"></th>' +
        '</tr></thead>' +
        '<tbody>' + oefRijen + '</tbody>' +
        '</table></div>'
      : '<div style="font-size:13px;color:var(--muted);text-align:center;padding:20px 0">' + t('programmas.noExercisesHint') + '</div>') +
    '</div>' +
    (progBibliotheekOpen ? progBouwBibliotheek(oefeningen) : '');
}

// ─── Acties ───────────────────────────────────────────────────────────────────
function progNieuw() {
  const id = 'p' + Date.now() + Math.floor(Math.random() * 1000);
  progLijst.push({ id, naam: t('programmas.newProgramName'), dagen: {} });
  progSlaOp();
  progActiefId = id;
  progActiefDagIdx = null;
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
  renderProgrammas();
}

function progTerugNaarLijst() {
  progActiefId = null;
  progActiefDagIdx = null;
  renderProgrammas();
}

function progTerugNaarProg() {
  progActiefDagIdx = null;
  progBibliotheekOpen = false;
  renderProgrammas();
}

function progNaamBijwerken(val) {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (prog) { prog.naam = val; progSlaOp(); }
}

function progDagNaamBijwerken(val) {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (prog && progActiefDagIdx !== null) {
    if (!prog.dagen[progActiefDagIdx]) prog.dagen[progActiefDagIdx] = { naam: '', oefeningen: [] };
    prog.dagen[progActiefDagIdx].naam = val;
    progSlaOp();
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
  renderProgrammas();
}

function progDagBewerken(dagIdx) {
  progActiefDagIdx = dagIdx;
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
  progSlaOp();
  renderProgrammas();
}

function progOefToevoegen() {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog || progActiefDagIdx === null) return;
  const idx = progActiefDagIdx;
  if (!prog.dagen[idx]) prog.dagen[idx] = { naam: '', oefeningen: [] };
  prog.dagen[idx].oefeningen.push({ naam: '', sets: '3', reps: '10', rust: '60s', notities: '' });
  progSlaOp();
  renderProgrammas();
}

function progOefVerwijder(oefIdx) {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog || progActiefDagIdx === null || !prog.dagen[progActiefDagIdx]) return;
  prog.dagen[progActiefDagIdx].oefeningen.splice(oefIdx, 1);
  progSlaOp();
  renderProgrammas();
}

// Opent hetzelfde sets/notities-detailscherm als bij Losse oefeningen (zie
// training.js), maar dan voor één oefeningregel binnen een programmadag --
// zo kunnen sets stuk voor stuk een eigen herhalingen/rust krijgen, plus een
// vrije notitie, i.p.v. alleen de simpele sets/reps/rust-kolommen.
function progOefOpenDetail(oefIdx) {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog || progActiefDagIdx === null || !prog.dagen[progActiefDagIdx]) return;
  const oef = prog.dagen[progActiefDagIdx].oefeningen[oefIdx];
  if (!oef) return;

  let sets;
  if (oef.setsDetail && oef.setsDetail.length) {
    sets = oef.setsDetail.map(s => ({ ...s }));
  } else {
    const n = Number(oef.sets) || 1;
    const restMatch = String(oef.rust || '').match(/(\d+)/);
    sets = Array.from({ length: n }, () => ({ reps: oef.reps || '', rest: restMatch ? restMatch[1] : '' }));
  }

  const canonical = findCanonicalExercise(oef.naam);

  openExerciseDetailGeneric({
    name: oef.naam || t('programmas.exercisePlaceholder'),
    photo: canonical ? canonical.photo : null,
    icon: canonical ? canonical.icon : '🏋️',
    sets: sets,
    notes: oef.notities || '',
    onSave: function(newSets, newNotes) {
      oef.setsDetail = newSets;
      oef.notities = newNotes;
      oef.sets = String(newSets.length);
      progSlaOp();
      renderProgrammas();
    }
  });
}

function progOefUpdate(oefIdx, veld, val) {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog || progActiefDagIdx === null || !prog.dagen[progActiefDagIdx]) return;
  const oef = prog.dagen[progActiefDagIdx].oefeningen[oefIdx];
  if (oef) { oef[veld] = val; progSlaOp(); }
}

function progOefNaamUpdate(oefIdx, val) {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog || progActiefDagIdx === null || !prog.dagen[progActiefDagIdx]) return;
  const oef = prog.dagen[progActiefDagIdx].oefeningen[oefIdx];
  if (!oef) return;
  oef.naam = val;
  if (val === 'Wandelen' || val === 'Walking') { oef.stappen = oef.stappen || '8000-10000'; oef.sets = ''; oef.reps = ''; oef.rust = ''; }
  progSlaOp();
  renderProgrammas();
}

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

  return '<div class="card" style="border-color:var(--sage)">' +
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
  progSlaOp();
  renderProgrammas();
}

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
