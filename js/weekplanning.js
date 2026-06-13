// ========== WEEKPLANNING ==========
let weekplan = null;
let geplanning = [];
let geselecteerdeWeken = 4;
let activeDagPicker = null;
let wpOpenDagen = new Set();

const WP_KORT  = ['Ma','Di','Wo','Do','Vr','Za','Zo'];
const WP_LANG  = ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag'];
const DAG_KORT = ['Zo','Ma','Di','Wo','Do','Vr','Za']; // getDay() index

function wpStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function wpDate(str) {
  const [y,m,d] = str.split('-').map(Number);
  return new Date(y, m-1, d);
}
function wpMaandagVanaf(d) {
  const day = d.getDay();
  const diff = day === 1 ? 0 : (8 - day) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon;
}

function wpLaadData() {
  try {
    weekplan   = JSON.parse(localStorage.getItem('prime_weekplan') || 'null');
    geplanning = JSON.parse(localStorage.getItem('prime_planning') || '[]');
  } catch(e) {}
  if (!weekplan) weekplan = { dagen: [null,null,null,null,null,null,null] };
}
function wpSlaWeekOp()    { localStorage.setItem('prime_weekplan', JSON.stringify(weekplan)); }
function wpSlaPlanningOp(){ localStorage.setItem('prime_planning',  JSON.stringify(geplanning)); }

// ─── Helper: vertaal schemaId (ook prog:ID:DAG) naar display ─────────────────
function wpGetDisplay(sid) {
  if (!sid) return { icon: '\u{1F4A4}', naam: 'Rust', sub: '' };
  if (String(sid).startsWith('prog:')) {
    const parts = String(sid).split(':');
    const progId = parts[1], dagIdx = parseInt(parts[2]);
    const progs = (() => { try { const u = JSON.parse(localStorage.getItem('prime_programmas') || '[]'); return [...BUILTIN_PROGRAMMAS, ...u]; } catch(e) { return [...BUILTIN_PROGRAMMAS]; } })();
    const p = progs.find(x => x.id === progId);
    const dag = p ? (p.dagen || {})[dagIdx] : null;
    return { icon: '\u{1F4AA}', naam: dag ? (dag.naam || 'Training') : 'Training', sub: p ? p.naam : '' };
  }
  const s = TRAINING_SCHEMAS.find(x => x.id === sid);
  return s ? { icon: s.icon, naam: s.name, sub: s.duur + ' · ' + s.freq }
           : { icon: '\u{1F4AA}', naam: String(sid), sub: '' };
}

// ─── Helper: haal oefeningen op voor een schemaId ────────────────────────────
function wpGetOefeningen(sid) {
  if (!sid) return [];
  if (String(sid).startsWith('prog:')) {
    const parts = String(sid).split(':');
    const progId = parts[1], dagIdx = parseInt(parts[2]);
    const progs = (() => { try { const u = JSON.parse(localStorage.getItem('prime_programmas') || '[]'); return [...BUILTIN_PROGRAMMAS, ...u]; } catch(e) { return [...BUILTIN_PROGRAMMAS]; } })();
    const p = progs.find(x => x.id === progId);
    const dag = p ? (p.dagen || {})[dagIdx] : null;
    return dag ? (dag.oefeningen || []) : [];
  }
  const s = TRAINING_SCHEMAS.find(x => x.id === sid);
  return s ? s.oefeningen : [];
}

function wpLookupStappen(naam) {
  for (var gi = 0; gi < EXTRA_EXERCISES.length; gi++) {
    var exs = EXTRA_EXERCISES[gi].exercises;
    for (var ei = 0; ei < exs.length; ei++) {
      if ((exs[ei].name || exs[ei].naam) === naam && exs[ei].stappen) return exs[ei].stappen;
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
  if (!oefeningen.length) return '<div style="font-size:12px;color:var(--muted);padding:6px 0">Geen oefeningen beschikbaar.</div>';
  return oefeningen.map(function(o) {
    var naam = o.naam || o.name || '';
    var detail = wpOefDetail(o);
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:0.5px solid var(--sand-dark)">' +
      '<div style="flex:1;font-size:12px;color:var(--charcoal)">' + naam + '</div>' +
      '<div style="font-size:11px;color:var(--muted);white-space:nowrap">' + detail + '</div>' +
      '</div>';
  }).join('');
}

function wpGetDone(dateStr) {
  try { return JSON.parse(localStorage.getItem('prime_wp_done') || '{}')[dateStr] || []; }
  catch(e) { return []; }
}

function wpToggleOefDone(dateStr, oefIdx) {
  let all;
  try { all = JSON.parse(localStorage.getItem('prime_wp_done') || '{}'); }
  catch(e) { all = {}; }
  const done = all[dateStr] || [];
  const pos  = done.indexOf(oefIdx);
  if (pos === -1) done.push(oefIdx); else done.splice(pos, 1);
  all[dateStr] = done;
  localStorage.setItem('prime_wp_done', JSON.stringify(all));
  const isDone = done.includes(oefIdx);
  const chk = document.getElementById('wp-chk-' + dateStr + '-' + oefIdx);
  const row = document.getElementById('wp-oef-' + dateStr + '-' + oefIdx);
  if (chk) chk.classList.toggle('done', isDone);
  if (row) row.style.opacity = isDone ? '0.45' : '1';
}

function wpBouwOefeningenAfvinken(oefeningen, dateStr) {
  if (!oefeningen.length) return '<div style="font-size:12px;color:var(--muted);padding:6px 0">Geen oefeningen beschikbaar.</div>';
  const done = wpGetDone(dateStr);
  return oefeningen.map((o, i) => {
    var naam   = o.naam || o.name || '';
    var detail = wpOefDetail(o);
    var isDone = done.includes(i);
    return '<div id="wp-oef-' + dateStr + '-' + i + '" style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:0.5px solid var(--sand-dark);opacity:' + (isDone ? '0.45' : '1') + '">' +
      '<div style="flex:1;font-size:12px;color:var(--charcoal)">' + naam + '</div>' +
      '<div style="font-size:11px;color:var(--muted);white-space:nowrap">' + detail + '</div>' +
      '<div id="wp-chk-' + dateStr + '-' + i + '" class="exercise-check' + (isDone ? ' done' : '') + '" onclick="wpToggleOefDone(\'' + dateStr + '\',' + i + ')" title="Markeer als gedaan">✓</div>' +
      '</div>';
  }).join('');
}

// ─── Hoofd render ────────────────────────────────────────────────────────────
function renderWeekplanning() {
  wpLaadData();
  activeDagPicker = null;
  wpOpenDagen = new Set();
  const el = document.getElementById('weekplanning-content');
  if (!el) return;
  el.innerHTML =
    wpBouwGrid() +
    '<div id="wp-picker-wrap"></div>' +
    wpBouwInplannen() +
    wpBouwOverzicht();
}

// ─── Weekgrid ────────────────────────────────────────────────────────────────
function wpBouwGrid() {
  const dagen = weekplan.dagen.map((sid, i) => {
    const disp = wpGetDisplay(sid);
    return '<div class="wp-dag" id="wp-dag-' + i + '" onclick="wpTogglePicker(' + i + ')">' +
      '<div class="wp-dag-nm">' + WP_KORT[i] + '</div>' +
      '<div class="wp-dag-ic">' + disp.icon + '</div>' +
      '<div class="wp-dag-lb">' + disp.naam.split(' ').slice(0,2).join(' ') + '</div>' +
      '</div>';
  }).join('');
  return '<div class="card" style="margin-bottom:14px">' +
    '<div class="card-label" style="margin-bottom:6px">Weekschema</div>' +
    '<div style="font-size:13px;color:var(--muted);margin-bottom:14px">Klik op een dag om een training te kiezen</div>' +
    '<div class="wp-dag-grid">' + dagen + '</div>' +
    '</div>';
}

function wpTogglePicker(i) {
  const wrap = document.getElementById('wp-picker-wrap');
  if (!wrap) return;
  if (activeDagPicker === i) {
    activeDagPicker = null;
    wrap.innerHTML = '';
  } else {
    activeDagPicker = i;
    wrap.innerHTML = wpBouwPicker(i);
  }
  document.querySelectorAll('.wp-dag').forEach((el, j) =>
    el.classList.toggle('wp-dag-act', j === activeDagPicker));
}

function wpBouwPicker(i) {
  const opties = [
    { id: null, icon: '\u{1F4A4}', naam: 'Rustdag', sub: 'Geen training' },
    ...TRAINING_SCHEMAS.map(s => ({ id: s.id, icon: s.icon, naam: s.name, sub: s.duur + ' · ' + s.freq }))
  ];
  const huidig = weekplan.dagen[i];
  const oefeningen = wpGetOefeningen(huidig);
  const oefHtml = huidig && oefeningen.length
    ? '<div style="margin-top:12px;padding-top:12px;border-top:1.5px solid var(--sand-dark)">' +
      '<div style="font-size:11px;font-weight:700;color:var(--sage);letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px">Oefeningen</div>' +
      wpBouwOefeningenLijst(oefeningen) +
      '</div>'
    : '';
  return `<div class="card" style="margin-bottom:14px;border-color:var(--sage)">
    <div class="card-label" style="margin-bottom:10px">${WP_LANG[i]} — kies training</div>
    ${opties.map(o => {
      const sel = huidig === o.id;
      return `<div onclick="wpKiesSchema(${i},${o.id ? "'" + o.id + "'" : 'null'})"
        style="display:flex;align-items:center;gap:12px;padding:10px 12px;margin-bottom:6px;
               border-radius:10px;cursor:pointer;transition:all 0.15s;
               background:${sel ? 'var(--sage)' : 'var(--white)'};
               border:1.5px solid ${sel ? 'var(--sage)' : 'var(--sand-dark)'}">
        <span style="font-size:22px;flex-shrink:0">${o.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:${sel ? 'white' : 'var(--charcoal)'};">${o.naam}</div>
          <div style="font-size:11px;color:${sel ? 'rgba(255,255,255,0.75)' : 'var(--muted)'};">${o.sub}</div>
        </div>
        ${sel ? '<span style="color:white;font-weight:700;flex-shrink:0">✓</span>' : ''}
      </div>`;
    }).join('')}
    ${oefHtml}
  </div>`;
}

function wpKiesSchema(dagIdx, schemaId) {
  weekplan.dagen[dagIdx] = schemaId;
  wpSlaWeekOp();
  renderWeekplanning();
}

// ─── Inplannen ───────────────────────────────────────────────────────────────
function wpBouwInplannen() {
  const actief = weekplan.dagen.filter(Boolean).length;
  if (actief === 0) return '<div class="card" style="margin-bottom:14px">' +
    '<div class="card-label" style="margin-bottom:8px">Inplannen</div>' +
    '<div style="font-size:13px;color:var(--muted)">Wijs eerst trainingen toe aan de dagen hierboven.</div>' +
    '</div>';

  const defaultMon = wpStr(new Date());

  return `<div class="card" style="margin-bottom:14px">
    <div class="card-label" style="margin-bottom:14px">Inplannen</div>

    <div style="margin-bottom:16px">
      <label style="font-size:12px;font-weight:600;color:var(--charcoal);display:block;margin-bottom:6px">Startdatum</label>
      <input type="date" id="wp-start" value="${defaultMon}"
        style="padding:10px 14px;border:1.5px solid var(--sand-dark);border-radius:10px;
               font-family:'DM Sans',sans-serif;font-size:14px;color:var(--charcoal);
               background:var(--sand);outline:none;width:100%;max-width:200px">
      <div style="font-size:11px;color:var(--muted);margin-top:4px">Trainingen v\xF3\xF3r deze datum worden overgeslagen</div>
    </div>

    <div style="margin-bottom:20px">
      <label style="font-size:12px;font-weight:600;color:var(--charcoal);display:block;margin-bottom:8px">Aantal weken</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${[1,2,4,6,8,12].map(n =>
          '<button class="wp-w-btn' + (n === geselecteerdeWeken ? ' wp-w-act' : '') +
          '" onclick="wpKiesWeken(' + n + ',this)">' + n + 'w</button>'
        ).join('')}
      </div>
    </div>

    <button class="btn-primary" id="wp-plan-btn" onclick="wpInplannen()">
      ${geplanning.length > 0 ? 'Planning bijwerken →' : (actief * geselecteerdeWeken) + ' trainingen inplannen →'}
    </button>
  </div>`;
}

function wpKiesWeken(n, btn) {
  geselecteerdeWeken = n;
  document.querySelectorAll('.wp-w-btn').forEach(b => b.classList.remove('wp-w-act'));
  btn.classList.add('wp-w-act');
  const planBtn = document.getElementById('wp-plan-btn');
  if (planBtn && geplanning.length === 0) {
    const actief = weekplan.dagen.filter(Boolean).length;
    planBtn.textContent = (actief * n) + ' trainingen inplannen →';
  }
}

function wpInplannen() {
  const inp = document.getElementById('wp-start');
  if (!inp || !inp.value) { alert('Kies een startdatum'); return; }

  const startGekozen = wpDate(inp.value);

  // Vind de maandag van de gekozen week
  const dagVdWeek = startGekozen.getDay();
  const diffToMon = dagVdWeek === 0 ? -6 : 1 - dagVdWeek;
  const maandag = new Date(startGekozen);
  maandag.setDate(startGekozen.getDate() + diffToMon);

  const result = [];
  for (let w = 0; w < geselecteerdeWeken; w++) {
    for (let d = 0; d < 7; d++) {
      const sid = weekplan.dagen[d];
      if (!sid) continue;
      const datum = new Date(maandag);
      datum.setDate(maandag.getDate() + w * 7 + d);
      if (datum < startGekozen) continue; // sla datums voor startdatum over
      result.push({ date: wpStr(datum), schemaId: sid });
    }
  }

  geplanning = result;
  wpSlaPlanningOp();
  renderWeekplanning();
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
    const label = mon.toLocaleDateString('nl-NL',{day:'numeric',month:'short'}) + ' – ' +
                  zo.toLocaleDateString('nl-NL',{day:'numeric',month:'short'});

    const rijen = items.map(item => {
      const d    = wpDate(item.date);
      const disp = wpGetDisplay(item.schemaId);
      const isVandaag  = item.date === vandaag;
      const isVerleden = item.date < vandaag;
      const oefeningen = wpGetOefeningen(item.schemaId);
      const detailId   = 'wp-detail-' + item.date;
      const arrowId    = 'wp-arrow-' + item.date;
      const detailHtml = oefeningen.length
        ? '<div id="' + detailId + '" style="display:none;padding:6px 0 4px 90px">' +
          wpBouwOefeningenAfvinken(oefeningen, item.date) + '</div>'
        : '';
      return '<div style="border-bottom:0.5px solid var(--sand-dark);opacity:' + (isVerleden ? '0.4' : '1') + '">' +
        '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;cursor:pointer" onclick="wpToggleDagDetail(\'' + item.date + '\')">' +
        '<div style="width:26px;font-size:11px;font-weight:700;color:var(--muted);flex-shrink:0">' + DAG_KORT[d.getDay()] + '</div>' +
        '<div style="font-size:11px;color:var(--muted);width:54px;flex-shrink:0">' + d.toLocaleDateString('nl-NL',{day:'numeric',month:'short'}) + '</div>' +
        '<span style="font-size:16px;flex-shrink:0">' + disp.icon + '</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13px;font-weight:' + (isVandaag ? '600' : '400') + ';color:' + (isVandaag ? 'var(--sage)' : 'var(--charcoal)') + '">' +
            disp.naam +
            (isVandaag ? ' <span style="font-size:10px;background:var(--sage);color:white;padding:2px 7px;border-radius:8px;vertical-align:middle">vandaag</span>' : '') +
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
        <div class="card-label" style="margin-bottom:2px">Ingepland</div>
        <div style="font-size:12px;color:var(--muted)">${geplanning.length} trainingen · ${weken.size} weken</div>
      </div>
      <button class="btn-sm" style="color:var(--accent);border-color:#e8c4a8;background:var(--accent-light)"
              onclick="wpVerwijder()">Verwijderen</button>
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
  if (!confirm('Planning verwijderen?')) return;
  geplanning = [];
  wpSlaPlanningOp();
  renderWeekplanning();
}
