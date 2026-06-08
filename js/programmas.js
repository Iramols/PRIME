// ========== PROGRAMMA'S ==========
let progLijst = [];
let progActiefId = null;
let progActiefDagIdx = null;
let progBibliotheekOpen = false;

const PROG_DAGEN_KORT = ['Ma','Di','Wo','Do','Vr','Za','Zo'];
const PROG_DAGEN_LANG = ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag'];

function progLaadData() {
  try { progLijst = JSON.parse(localStorage.getItem('prime_programmas') || '[]'); }
  catch(e) { progLijst = []; }
}

function progSlaOp() {
  localStorage.setItem('prime_programmas', JSON.stringify(progLijst));
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
      '<div style="font-family:\'DM Serif Display\',serif;font-size:20px;margin-bottom:8px">Nog geen programma\'s</div>' +
      '<div style="font-size:13px;color:var(--muted);margin-bottom:24px">Maak een weekschema met trainingsdagen en oefeningen.</div>' +
      '<button class="btn-primary" onclick="progNieuw()">+ Nieuw programma</button>' +
      '</div>';
  }

  const kaarten = progLijst.map(prog => {
    const aantalDagen = Object.keys(prog.dagen || {}).length;
    const aantalOef   = Object.values(prog.dagen || {}).reduce((a, d) => a + (d.oefeningen || []).length, 0);
    const dagIcons    = Object.keys(prog.dagen || {}).sort((a,b) => Number(a)-Number(b)).map(i => PROG_DAGEN_KORT[Number(i)]).join(' \xB7 ');
    return '<div class="card" style="margin-bottom:12px">' +
      '<div style="margin-bottom:10px">' +
      '<div style="font-family:\'DM Serif Display\',serif;font-size:18px;margin-bottom:3px">' + prog.naam + '</div>' +
      '<div style="font-size:12px;color:var(--muted)">' + aantalDagen + ' trainingsdagen \xB7 ' + aantalOef + ' oefeningen</div>' +
      (dagIcons ? '<div style="font-size:11px;color:var(--sage);margin-top:3px;font-weight:600">' + dagIcons + '</div>' : '') +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn-primary" style="flex:1;min-width:140px;padding:10px" onclick="progLadenInWeekplanning(\'' + prog.id + '\')">\u{1F4C5} Laden in weekplanning</button>' +
      '<button class="btn-sm" onclick="progOpenEditor(\'' + prog.id + '\')">Bewerken</button>' +
      '<button class="btn-sm" style="color:var(--accent);border-color:#e8c4a8;background:var(--accent-light)" onclick="progVerwijder(\'' + prog.id + '\')">Verwijder</button>' +
      '</div>' +
      '</div>';
  }).join('');

  return '<div style="margin-bottom:4px">' + kaarten + '</div>' +
    '<button class="btn-primary" style="width:100%" onclick="progNieuw()">+ Nieuw programma</button>';
}

// ─── Programma editor ────────────────────────────────────────────────────────
function progBouwProgEditor() {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog) { progActiefId = null; return progBouwLijst(); }

  const dagGrid = PROG_DAGEN_KORT.map((dag, i) => {
    const heeftDag = prog.dagen && prog.dagen[i];
    const naam     = heeftDag ? (prog.dagen[i].naam || '') : '';
    const aantalOef = heeftDag ? (prog.dagen[i].oefeningen || []).length : 0;
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;margin-bottom:8px;border-radius:10px;border:1.5px solid ' +
      (heeftDag ? 'var(--sage)' : 'var(--sand-dark)') + ';background:' +
      (heeftDag ? 'var(--sage-light)' : 'var(--white)') + '">' +
      '<div style="width:28px;font-size:12px;font-weight:700;color:' + (heeftDag ? 'var(--sage)' : 'var(--muted)') + ';flex-shrink:0">' + dag + '</div>' +
      '<div style="flex:1;min-width:0">' +
      (heeftDag
        ? '<div style="font-size:13px;font-weight:600;color:var(--charcoal)">' + (naam || 'Training ' + dag) + '</div>' +
          '<div style="font-size:11px;color:var(--muted)">' + aantalOef + ' oefening' + (aantalOef !== 1 ? 'en' : '') + '</div>'
        : '<div style="font-size:12px;color:var(--muted)">Rustdag</div>') +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-shrink:0">' +
      (heeftDag
        ? '<button class="btn-sm" onclick="progDagBewerken(' + i + ')">Bewerken</button>' +
          '<button class="btn-sm" style="color:var(--accent)" onclick="progDagVerwijder(' + i + ')">&#x2715;</button>'
        : '<button class="btn-sm" onclick="progDagToevoegen(' + i + ')">+ Training</button>') +
      '</div>' +
      '</div>';
  }).join('');

  return '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">' +
    '<button onclick="progTerugNaarLijst()" style="padding:8px 14px;border-radius:10px;border:1.5px solid var(--sand-dark);background:var(--white);color:var(--charcoal);cursor:pointer;font-size:13px;font-family:\'DM Sans\',sans-serif">← Terug</button>' +
    '<div style="font-family:\'DM Serif Display\',serif;font-size:18px">Programma bewerken</div>' +
    '</div>' +
    '<div class="card" style="margin-bottom:14px">' +
    '<label style="font-size:12px;font-weight:600;color:var(--charcoal);display:block;margin-bottom:6px">Naam</label>' +
    '<input type="text" id="prog-naam-input" value="' + prog.naam.replace(/"/g,'&quot;') + '"' +
    ' style="width:100%;padding:10px 14px;border:1.5px solid var(--sand-dark);border-radius:10px;' +
    'font-family:\'DM Sans\',sans-serif;font-size:14px;color:var(--charcoal);background:var(--sand);outline:none;box-sizing:border-box"' +
    ' oninput="progNaamBijwerken(this.value)">' +
    '</div>' +
    '<div class="card-label" style="margin-bottom:10px">Trainingsdagen</div>' +
    dagGrid;
}

// ─── Dag editor ───────────────────────────────────────────────────────────────
function progBouwDagEditor() {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog || progActiefDagIdx === null) { progActiefDagIdx = null; return progBouwProgEditor(); }
  const dagIdx = progActiefDagIdx;
  const dag    = (prog.dagen && prog.dagen[dagIdx]) || { naam: '', oefeningen: [] };
  const oefeningen = dag.oefeningen || [];

  const oefRijen = oefeningen.map((oef, i) => {
    return '<tr>' +
      '<td style="padding:4px 6px 4px 0"><input type="text" value="' + (oef.naam || '').replace(/"/g,'&quot;') +
      '" placeholder="Oefening..." onchange="progOefUpdate(' + i + ',\'naam\',this.value)"' +
      ' style="width:100%;padding:6px 8px;border:1px solid var(--sand-dark);border-radius:6px;font-size:12px;font-family:\'DM Sans\',sans-serif;background:var(--sand);box-sizing:border-box"></td>' +
      '<td style="padding:4px 3px"><input type="text" value="' + (oef.sets || '').replace(/"/g,'&quot;') +
      '" placeholder="3" onchange="progOefUpdate(' + i + ',\'sets\',this.value)"' +
      ' style="width:44px;padding:6px 4px;border:1px solid var(--sand-dark);border-radius:6px;font-size:12px;text-align:center;font-family:\'DM Sans\',sans-serif;background:var(--sand)"></td>' +
      '<td style="padding:4px 3px"><input type="text" value="' + (oef.reps || '').replace(/"/g,'&quot;') +
      '" placeholder="10" onchange="progOefUpdate(' + i + ',\'reps\',this.value)"' +
      ' style="width:44px;padding:6px 4px;border:1px solid var(--sand-dark);border-radius:6px;font-size:12px;text-align:center;font-family:\'DM Sans\',sans-serif;background:var(--sand)"></td>' +
      '<td style="padding:4px 3px"><input type="text" value="' + (oef.rust || '').replace(/"/g,'&quot;') +
      '" placeholder="60s" onchange="progOefUpdate(' + i + ',\'rust\',this.value)"' +
      ' style="width:48px;padding:6px 4px;border:1px solid var(--sand-dark);border-radius:6px;font-size:12px;text-align:center;font-family:\'DM Sans\',sans-serif;background:var(--sand)"></td>' +
      '<td style="padding:4px 0 4px 4px;text-align:center">' +
      '<button onclick="progOefVerwijder(' + i + ')" style="padding:5px 8px;border-radius:6px;border:none;background:none;color:var(--muted);cursor:pointer;font-size:14px">&#x2715;</button>' +
      '</td></tr>';
  }).join('');

  return '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">' +
    '<button onclick="progTerugNaarProg()" style="padding:8px 14px;border-radius:10px;border:1.5px solid var(--sand-dark);background:var(--white);color:var(--charcoal);cursor:pointer;font-size:13px;font-family:\'DM Sans\',sans-serif">← Terug</button>' +
    '<div style="font-family:\'DM Serif Display\',serif;font-size:18px">' + PROG_DAGEN_LANG[dagIdx] + '</div>' +
    '</div>' +
    '<div class="card" style="margin-bottom:14px">' +
    '<label style="font-size:12px;font-weight:600;color:var(--charcoal);display:block;margin-bottom:6px">Naam van de dag</label>' +
    '<input type="text" id="prog-dag-naam" value="' + (dag.naam || '').replace(/"/g,'&quot;') +
    '" placeholder="bijv. Push dag, Benen, Volledig lichaam"' +
    ' style="width:100%;padding:10px 14px;border:1.5px solid var(--sand-dark);border-radius:10px;' +
    'font-family:\'DM Sans\',sans-serif;font-size:14px;color:var(--charcoal);background:var(--sand);outline:none;box-sizing:border-box"' +
    ' oninput="progDagNaamBijwerken(this.value)">' +
    '</div>' +
    '<div class="card" style="margin-bottom:14px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
    '<div class="card-label">Oefeningen</div>' +
    '<div style="display:flex;gap:6px">' +
    '<button class="btn-sm" onclick="progOefToevoegen()">+ Leeg veld</button>' +
    '<button class="btn-sm" style="' + (progBibliotheekOpen ? 'background:var(--sage);color:white;border-color:var(--sage)' : '') + '" onclick="progToggleBibliotheek()">\u{1F4DA} Bibliotheek</button>' +
    '</div>' +
    '</div>' +
    (oefeningen.length > 0
      ? '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">' +
        '<thead><tr>' +
        '<th style="text-align:left;padding:0 6px 8px 0;font-size:11px;color:var(--muted);font-weight:600">Oefening</th>' +
        '<th style="padding:0 3px 8px;font-size:11px;color:var(--muted);font-weight:600;text-align:center">Sets</th>' +
        '<th style="padding:0 3px 8px;font-size:11px;color:var(--muted);font-weight:600;text-align:center">Reps</th>' +
        '<th style="padding:0 3px 8px;font-size:11px;color:var(--muted);font-weight:600;text-align:center">Rust</th>' +
        '<th style="width:32px"></th>' +
        '</tr></thead>' +
        '<tbody>' + oefRijen + '</tbody>' +
        '</table></div>'
      : '<div style="font-size:13px;color:var(--muted);text-align:center;padding:20px 0">Nog geen oefeningen. Kies uit de bibliotheek of voeg een leeg veld toe.</div>') +
    '</div>' +
    (progBibliotheekOpen ? progBouwBibliotheek(oefeningen) : '');
}

// ─── Acties ───────────────────────────────────────────────────────────────────
function progNieuw() {
  const id = 'p' + Date.now() + Math.floor(Math.random() * 1000);
  progLijst.push({ id, naam: 'Nieuw programma', dagen: {} });
  progSlaOp();
  progActiefId = id;
  progActiefDagIdx = null;
  renderProgrammas();
}

function progVerwijder(id) {
  if (!confirm('Programma verwijderen?')) return;
  progLijst = progLijst.filter(p => p.id !== id);
  progSlaOp();
  renderProgrammas();
}

function progOpenEditor(id) {
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

function progDagToevoegen(dagIdx) {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog) return;
  if (!prog.dagen) prog.dagen = {};
  prog.dagen[dagIdx] = { naam: PROG_DAGEN_LANG[dagIdx], oefeningen: [] };
  progSlaOp();
  progActiefDagIdx = dagIdx;
  renderProgrammas();
}

function progDagBewerken(dagIdx) {
  progActiefDagIdx = dagIdx;
  renderProgrammas();
}

function progDagVerwijder(dagIdx) {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog || !prog.dagen) return;
  delete prog.dagen[dagIdx];
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

function progOefUpdate(oefIdx, veld, val) {
  const prog = progLijst.find(p => p.id === progActiefId);
  if (!prog || progActiefDagIdx === null || !prog.dagen[progActiefDagIdx]) return;
  const oef = prog.dagen[progActiefDagIdx].oefeningen[oefIdx];
  if (oef) { oef[veld] = val; progSlaOp(); }
}

function progToggleBibliotheek() {
  progBibliotheekOpen = !progBibliotheekOpen;
  renderProgrammas();
}

function progBouwBibliotheek(huidig) {
  const toegevoegdeNamen = new Set((huidig || []).map(o => o.naam.toLowerCase()));

  const groepen = EXTRA_EXERCISES.map(groep => {
    const rijen = groep.exercises.map(ex => {
      const alIn = toegevoegdeNamen.has(ex.name.toLowerCase());
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--sand-dark)">' +
        '<div style="font-size:18px;flex-shrink:0;width:26px;text-align:center">' + ex.icon + '</div>' +
        '<div style="flex:1;min-width:0">' +
        '<div style="font-size:13px;font-weight:500;color:var(--charcoal)">' + ex.name + '</div>' +
        '<div style="font-size:11px;color:var(--muted)">' + ex.sets + ' sets \xB7 ' + ex.reps + ' \xB7 rust ' + ex.rest + '</div>' +
        '</div>' +
        '<button onclick="progOefUitBibliotheek(\'' + ex.id + '\')" ' +
        'style="flex-shrink:0;padding:5px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:\'DM Sans\',sans-serif;' +
        (alIn
          ? 'border:1.5px solid var(--sage);background:var(--sage-light);color:var(--sage)'
          : 'border:1.5px solid var(--sage);background:var(--sage);color:white') + '">' +
        (alIn ? '✓ In lijst' : '+ Voeg toe') +
        '</button>' +
        '</div>';
    }).join('');

    return '<div style="margin-bottom:16px">' +
      '<div style="font-size:14px;font-weight:700;color:var(--charcoal);margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid var(--sage)">' +
      groep.icon + ' ' + groep.group +
      '</div>' +
      rijen +
      '</div>';
  }).join('');

  return '<div class="card" style="border-color:var(--sage)">' +
    '<div style="font-size:13px;font-weight:600;color:var(--charcoal);margin-bottom:14px">Kies uit bibliotheek</div>' +
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
    naam: gevonden.name,
    sets: String(gevonden.sets),
    reps: String(gevonden.reps),
    rust: gevonden.rest,
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

  for (let i = 0; i < 7; i++) {
    weekplanData.dagen[i] = (prog.dagen && prog.dagen[i]) ? 'prog:' + id + ':' + i : null;
  }

  localStorage.setItem('prime_weekplan', JSON.stringify(weekplanData));
  switchTrainingTab('weekplanning');
}
