// ========== HISTORY ==========
function resetVoortgang() {
  if (!confirm('Alle voortgang wissen en opnieuw beginnen?')) return;
  history = [];
  todayData = null;
  exerciseDone = [];
  dagDone = {};
  ['prime_history','prime_today','prime_exdone','prime_wp_done'].forEach(function(k) {
    localStorage.removeItem(k);
  });
  renderHistory();
  document.getElementById('checkin-section').style.display = 'block';
  document.getElementById('day-section').style.display = 'none';
}

function renderHistory() {
  const total = history.length;
  if (total === 0) {
    document.getElementById('h-username').textContent = 'Statistieken';
    document.getElementById('h-goal').textContent = '';
    document.getElementById('h-period').textContent = '';
    ['h-streak','h-best-streak','h-total','h-trainings'].forEach(function(id) {
      const el = document.getElementById(id); if (el) el.textContent = '0';
    });
    ['h-pct-training','h-pct-partial','h-avg-energy','h-avg-sleep','h-avg-stress','h-avg-energy-out','h-food-ondoel','h-food-teveel','h-food-teweinig'].forEach(function(id) {
      const el = document.getElementById(id); if (el) el.textContent = '—';
    });
    const trend = document.getElementById('h-energy-trend'); if (trend) trend.textContent = '';
    const bar = document.getElementById('h-food-log-bar'); if (bar) bar.style.width = '0%';
    const pct = document.getElementById('h-food-log-pct'); if (pct) pct.textContent = '0% van dagen gelogd';
    const sig = document.getElementById('h-signals'); if (sig) sig.innerHTML = '<div style="font-size:13px;color:var(--muted)">Nog geen data beschikbaar.</div>';
    const ec = document.getElementById('energy-chart'); if (ec) ec.innerHTML = '';
    const wc = document.getElementById('weight-chart'); if (wc) wc.innerHTML = '';
    document.getElementById('history-list').innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);font-size:14px">Nog geen data. Doe je eerste check-in!</div>';
    return;
  }

  // ── Naam & doel ──
  document.getElementById('h-username').textContent = (profile.name || 'Gebruiker') + ' — Statistieken';
  document.getElementById('h-goal').textContent = profile.goal || '';
  const eerste = new Date(history[history.length-1].date);
  const laatste = new Date(history[0].date);
  document.getElementById('h-period').textContent =
    eerste.toLocaleDateString('nl-NL',{day:'numeric',month:'short'}) + ' → ' +
    laatste.toLocaleDateString('nl-NL',{day:'numeric',month:'short',year:'numeric'});

  // ── Streak ──
  const streak = calcStreak();
  const bestStreak = calcBestStreak();
  document.getElementById('h-streak').textContent = streak;
  document.getElementById('h-best-streak').textContent = bestStreak;
  document.getElementById('h-total').textContent = total;

  // ── Training ──
  const metCheckout = history.filter(h => h.checkout);
  const volledig = metCheckout.filter(h => h.checkout.training === 3).length;
  const gedeeltelijk = metCheckout.filter(h => h.checkout.training === 2).length;
  document.getElementById('h-trainings').textContent = volledig;
  document.getElementById('h-pct-training').textContent = metCheckout.length > 0 ? Math.round(volledig/metCheckout.length*100) + '%' : '—';
  document.getElementById('h-pct-partial').textContent = metCheckout.length > 0 ? Math.round(gedeeltelijk/metCheckout.length*100) + '%' : '—';

  // ── Energie, slaap, stress (gem. 7 dgn) ──
  const recent7 = history.slice(0, 7);
  const avg = (arr, key) => {
    const vals = arr.map(h => h.checkin?.[key]).filter(v => v > 0);
    return vals.length > 0 ? (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(1) : '—';
  };
  const avgOut = (arr, key) => {
    const vals = arr.map(h => h.checkout?.[key]).filter(v => v > 0);
    return vals.length > 0 ? (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(1) : '—';
  };
  const energyLabels = { '—':'—', '1.0':'🪫 Laag', '1':'🪫 Laag' };
  const fmtScore = v => {
    if (v === '—') return '—';
    const n = parseFloat(v);
    if (n < 1.8) return `${v} 🔴`;
    if (n < 2.5) return `${v} 🟡`;
    return `${v} 🟢`;
  };
  document.getElementById('h-avg-energy').textContent = fmtScore(avg(recent7, 'energy'));
  document.getElementById('h-avg-sleep').textContent = fmtScore(avg(recent7, 'sleep'));
  document.getElementById('h-avg-stress').textContent = fmtScore(avg(recent7, 'stress'));
  document.getElementById('h-avg-energy-out').textContent = fmtScore(avgOut(recent7, 'energy'));

  // Energie trend
  if (recent7.length >= 3) {
    const e1 = parseFloat(avg(recent7.slice(0,3), 'energy'));
    const e2 = parseFloat(avg(recent7.slice(3,7), 'energy'));
    if (!isNaN(e1) && !isNaN(e2)) {
      document.getElementById('h-energy-trend').textContent =
        e1 > e2 + 0.3 ? '↑ Stijgend' : e1 < e2 - 0.3 ? '↓ Dalend' : '→ Stabiel';
    }
  }

  // ── Voeding ──
  const foodDays = metCheckout.filter(h => h.checkout.food > 0);
  const opDoel   = foodDays.filter(h => h.checkout.food === 3).length;
  const teveel   = foodDays.filter(h => h.checkout.food === 4).length;
  const teweinig = foodDays.filter(h => h.checkout.food <= 2 && h.checkout.food > 0).length;
  const pctLog   = total > 0 ? Math.round(foodDays.length / total * 100) : 0;
  document.getElementById('h-food-ondoel').textContent  = foodDays.length > 0 ? Math.round(opDoel/foodDays.length*100)   + '%' : '—';
  document.getElementById('h-food-teveel').textContent  = foodDays.length > 0 ? Math.round(teveel/foodDays.length*100)   + '%' : '—';
  document.getElementById('h-food-teweinig').textContent = foodDays.length > 0 ? Math.round(teweinig/foodDays.length*100) + '%' : '—';
  document.getElementById('h-food-log-bar').style.width = pctLog + '%';
  document.getElementById('h-food-log-pct').textContent = pctLog + '% van dagen voeding gelogd';

  // ── Signalen voor coach ──
  const signals = [];
  if (streak === 0 && total > 0) signals.push({ kleur:'#E24B4A', tekst:'⚠️ Streak gebroken — geen check-in vandaag' });
  const dagenWeg = calcDagenZonderCheckin();
  if (dagenWeg >= 2) signals.push({ kleur:'#E24B4A', tekst:`⚠️ ${dagenWeg} dagen geen check-in — risico op afhaken` });
  if (parseFloat(avg(recent7, 'energy')) < 2.0) signals.push({ kleur:'#f39c12', tekst:'🟡 Energie structureel laag (7 dgn gem. onder 2.0) — bespreek slaap en herstel' });
  if (parseFloat(avg(recent7, 'stress')) < 2.0) signals.push({ kleur:'#f39c12', tekst:'🟡 Stress structureel hoog (7 dgn gem. onder 2.0) — bespreek stressreductie' });
  if (metCheckout.length >= 3 && volledig / metCheckout.length < 0.4) signals.push({ kleur:'#f39c12', tekst:'🟡 Minder dan 40% trainingen volledig gedaan — schema aanpassen?' });
  if (pctLog < 40 && total >= 3) signals.push({ kleur:'#f39c12', tekst:'🟡 Voeding wordt zelden gelogd — bespreek drempel' });
  if (bestStreak >= 7) signals.push({ kleur:'var(--sage)', tekst:`✅ Beste streak: ${bestStreak} dagen — benoem deze prestatie` });
  if (volledig >= 5) signals.push({ kleur:'var(--sage)', tekst:`✅ ${volledig} trainingen volledig voltooid — identiteitsshift bevestigen` });
  if (streak >= 7) signals.push({ kleur:'var(--sage)', tekst:`✅ ${streak} dagen op rij actief — mijlpaal, stuur een persoonlijk bericht` });

  document.getElementById('h-signals').innerHTML = signals.length > 0
    ? signals.map(s => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:0.5px solid var(--sand-dark)">
          <div style="width:3px;min-height:20px;border-radius:2px;background:${s.kleur};flex-shrink:0;margin-top:2px"></div>
          <div style="font-size:13px;line-height:1.6">${s.tekst}</div>
        </div>`).join('')
    : '<div style="font-size:13px;color:var(--muted)">Geen bijzondere signalen — alles loopt goed.</div>';

  // ── Energie trend grafiek ──
  renderEnergyChart();

  // ── Gewicht grafiek ──
  renderWeightChart();

  // ── Dag-voor-dag lijst ──
  document.getElementById('history-list').innerHTML = history.slice(0,30).map(function(h) {
    const d = new Date(h.date);
    const dateStr = d.toLocaleDateString('nl-NL', { weekday:'short', day:'numeric', month:'short' });
    const co = h.checkout;
    const ci = h.checkin;
    return '<div class="history-item" style="padding:12px 0;border-bottom:0.5px solid var(--sand-dark);display:grid;grid-template-columns:90px 1fr auto;gap:8px;align-items:start">'
      + '<div style="font-size:12px;font-weight:500">' + dateStr + '</div>'
      + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'
      + (co ? '<span style="font-size:10px;padding:2px 7px;border-radius:10px;font-weight:500;background:' + (co.training===3?'var(--sage)':co.training===2?'#f39c12':'#e74c3c') + ';color:white" title="Training voltooid">' + (co.training===3?'✓ Training':co.training===2?'\xBD Training':'✗ Training') + '</span>' : '')
      + (co ? '<span style="font-size:10px;padding:2px 7px;border-radius:10px;font-weight:500;background:' + (co.food===3?'var(--sage)':co.food===4?'#e74c3c':co.food===2?'#f39c12':'#e74c3c') + ';color:white" title="Voeding">' + (co.food===3?'✓ Voeding':co.food===4?'↑ Voeding':co.food===2?'\xBD Voeding':'✗ Voeding') + '</span>' : '')
      + '</div>'
      + '<div style="font-size:12px;color:var(--muted)">'
      + (ci ? '<span title="Slaap">😴' + ci.sleep + '</span> <span title="Energie">⚡' + ci.energy + '</span> <span title="Stress">🧘' + ci.stress + '</span>' + (ci.weight ? ' <span style="color:var(--sage)">⚖️ ' + ci.weight + 'kg</span>' : '') : '')
      + '</div>'
      + '<div style="font-size:11px;color:var(--muted);text-align:right">'
      + (co ? '<span>' + (['🪴','😑','⚡','🔥'][co.energy-1]||'') + ' energie einde dag</span>' : '<span style="color:var(--sand-dark)">geen checkout</span>')
      + '</div>'
      + '</div>';
  }).join('');
}

function renderEnergyChart() {
  const el = document.getElementById('energy-chart');
  if (!el) return;

  const data = history
    .filter(h => h.checkout && h.checkout.energy > 0)
    .slice(0, 30)
    .reverse();

  if (data.length < 2) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">Minimaal 2 dagen met checkout nodig voor de grafiek.</div>';
    return;
  }

  const W = 300, H = 110;
  const padL = 28, padR = 10, padT = 10, padB = 22;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const n = data.length;

  const xPos = i => padL + (n === 1 ? cW / 2 : i * cW / (n - 1));
  const yPos = v => padT + cH - ((v - 1) / 3) * cH;

  // Grid + y-labels
  const levels = [
    { v: 1, emoji: '🪫' },
    { v: 2, emoji: '😑' },
    { v: 3, emoji: '⚡' },
    { v: 4, emoji: '🔥' },
  ];
  const grid = levels.map(({ v, emoji }) => `
    <line x1="${padL}" y1="${yPos(v)}" x2="${W - padR}" y2="${yPos(v)}" stroke="#e8e2d8" stroke-width="0.5"/>
    <text x="${padL - 4}" y="${yPos(v) + 4}" text-anchor="end" font-size="9" fill="#aaa">${emoji}</text>
  `).join('');

  // Polyline
  const pts = data.map((h, i) => `${xPos(i)},${yPos(h.checkout.energy)}`).join(' ');

  // Dots
  const dotColor = v => v >= 3.5 ? '#4a7c59' : v >= 2.5 ? '#5a7cc8' : v >= 1.5 ? '#f39c12' : '#e74c3c';
  const dots = data.map((h, i) => {
    const e = h.checkout.energy;
    return `<circle cx="${xPos(i)}" cy="${yPos(e)}" r="3.5" fill="${dotColor(e)}" stroke="white" stroke-width="1.2"/>`;
  }).join('');

  // X-labels: toon max 6 datums
  const step = Math.max(1, Math.floor(n / 6));
  const xLabels = data.map((h, i) => {
    if (i % step !== 0 && i !== n - 1) return '';
    const d = new Date(h.date);
    return `<text x="${xPos(i)}" y="${H - 4}" text-anchor="middle" font-size="8" fill="#aaa">${d.getDate()}/${d.getMonth() + 1}</text>`;
  }).join('');

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
      ${grid}
      <polyline points="${pts}" fill="none" stroke="#4a7c59" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      ${xLabels}
    </svg>`;
}

function renderWeightChart() {
  const el = document.getElementById('weight-chart');
  if (!el) return;

  const data = history
    .filter(h => h.checkin && h.checkin.weight > 0)
    .slice(0, 30)
    .reverse();

  if (data.length < 2) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">Minimaal 2 weegmomenten nodig voor de grafiek.</div>';
    return;
  }

  const weights = data.map(h => h.checkin.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const padding = Math.max((maxW - minW) * 0.3, 1);
  const yMin = Math.floor(minW - padding);
  const yMax = Math.ceil(maxW + padding);

  const W = 300, H = 110;
  const padL = 34, padR = 10, padT = 10, padB = 22;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const n = data.length;

  const xPos = i => padL + (n === 1 ? cW / 2 : i * cW / (n - 1));
  const yPos = v => padT + cH - ((v - yMin) / (yMax - yMin)) * cH;

  const totalRange = yMax - yMin;
  const stepSize = totalRange <= 4 ? 1 : totalRange <= 10 ? 2 : 5;
  const gridStart = Math.ceil(yMin / stepSize) * stepSize;
  const gridLines = [];
  for (let v = gridStart; v <= yMax; v += stepSize) gridLines.push(v);

  const grid = gridLines.map(v => `
    <line x1="${padL}" y1="${yPos(v)}" x2="${W - padR}" y2="${yPos(v)}" stroke="#e8e2d8" stroke-width="0.5"/>
    <text x="${padL - 4}" y="${yPos(v) + 4}" text-anchor="end" font-size="9" fill="#aaa">${v}</text>
  `).join('');

  const pts = data.map((h, i) => `${xPos(i)},${yPos(h.checkin.weight)}`).join(' ');

  const dots = data.map((h, i) => {
    const w = h.checkin.weight;
    return `<circle cx="${xPos(i)}" cy="${yPos(w)}" r="3.5" fill="#4a7c59" stroke="white" stroke-width="1.2"/>`;
  }).join('');

  const step = Math.max(1, Math.floor(n / 6));
  const xLabels = data.map((h, i) => {
    if (i % step !== 0 && i !== n - 1) return '';
    const d = new Date(h.date);
    return `<text x="${xPos(i)}" y="${H - 4}" text-anchor="middle" font-size="8" fill="#aaa">${d.getDate()}/${d.getMonth() + 1}</text>`;
  }).join('');

  const latest = weights[weights.length - 1];
  const diff = +(latest - weights[0]).toFixed(1);
  const diffStr = diff === 0 ? '' : (diff > 0 ? `+${diff}` : `${diff}`);
  const diffColor = diff < 0 ? 'var(--sage)' : diff > 0 ? 'var(--accent)' : 'var(--muted)';

  el.innerHTML = `
    <div style="font-size:12px;color:var(--muted);margin-bottom:10px">
      Laatste meting: <strong style="color:var(--charcoal)">${latest} kg</strong>
      ${diffStr ? `&nbsp;<span style="color:${diffColor};font-weight:600">${diffStr} kg</span> t.o.v. eerste meting` : ''}
    </div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
      ${grid}
      <polyline points="${pts}" fill="none" stroke="#4a7c59" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      ${xLabels}
    </svg>`;
}

function calcBestStreak() {
  if (!history.length) return 0;
  let best = 0, current = 0;
  const sorted = [...history].sort((a,b) => new Date(a.date) - new Date(b.date));
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) { current = 1; }
    else {
      const prev = new Date(sorted[i-1].date);
      const curr = new Date(sorted[i].date);
      const diff = Math.round((curr - prev) / (1000*60*60*24));
      current = diff === 1 ? current + 1 : 1;
    }
    if (current > best) best = current;
  }
  return best;
}

function calcDagenZonderCheckin() {
  if (!history.length) return 0;
  const laatste = new Date(history[0].date);
  const vandaag = new Date();
  vandaag.setHours(0,0,0,0);
  laatste.setHours(0,0,0,0);
  return Math.round((vandaag - laatste) / (1000*60*60*24));
}


// ========== PROGRAMMA VOORTGANG TAB ==========
function switchHistoryTab(tab) {
  ['stats','programma'].forEach(t => {
    const btn = document.getElementById('htab-' + t);
    const con = document.getElementById('hstab-content-' + t);
    if (btn) btn.classList.toggle('active', t === tab);
    if (con) con.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'programma') renderProgrammaVoortgang();
}

function renderProgrammaVoortgang() {
  const el = document.getElementById('programma-voortgang-content');
  if (!el) return;

  let geplanning = [];
  try { geplanning = JSON.parse(localStorage.getItem('prime_planning') || '[]'); } catch(e) {}
  let wpDone = {};
  try { wpDone = JSON.parse(localStorage.getItem('prime_wp_done') || '{}'); } catch(e) {}

  if (!geplanning.length) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:40px 20px">' +
      '<div style="font-size:40px;margin-bottom:12px">\u{1F4C5}</div>' +
      '<div style="font-family:\'DM Serif Display\',serif;font-size:20px;margin-bottom:8px">Geen weekplanning</div>' +
      '<div style="font-size:13px;color:var(--muted)">Plan eerst trainingen in via Training → Weekplanning.</div>' +
      '</div>';
    return;
  }

  const vandaag = new Date().toISOString().split('T')[0];
  const DAGKORT  = ['Zo','Ma','Di','Wo','Do','Vr','Za'];

  // ── Stats ──
  const verleden = geplanning.filter(p => p.date < vandaag);
  let totaalOef = 0, gedaanOef = 0, volledigDagen = 0;
  verleden.forEach(p => {
    const oefs = wpGetOefeningen(p.schemaId);
    const done = (wpDone[p.date] || []).filter(i => i < oefs.length);
    totaalOef  += oefs.length;
    gedaanOef  += done.length;
    if (oefs.length > 0 && done.length >= oefs.length) volledigDagen++;
  });
  const pct = totaalOef > 0 ? Math.round(gedaanOef / totaalOef * 100) : 0;
  const toekomst = geplanning.filter(p => p.date >= vandaag).length;

  const statsHtml =
    '<div class="card" style="margin-bottom:14px">' +
    '<div class="card-label" style="margin-bottom:14px">Overzicht</div>' +
    '<div class="stats-row" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">' +
      '<div class="stat-card"><div class="stat-val" style="font-size:24px">' + verleden.length + '</div><div class="stat-lbl">Geweest</div></div>' +
      '<div class="stat-card"><div class="stat-val" style="font-size:24px">' + volledigDagen + '</div><div class="stat-lbl">Volledig</div></div>' +
      '<div class="stat-card"><div class="stat-val" style="font-size:24px">' + toekomst + '</div><div class="stat-lbl">Nog gepland</div></div>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:6px">' + gedaanOef + ' van ' + totaalOef + ' oefeningen afgerond (' + pct + '%)</div>' +
    '<div style="height:6px;background:var(--sand-dark);border-radius:100px;overflow:hidden">' +
      '<div style="height:100%;background:var(--sage);border-radius:100px;width:' + pct + '%;transition:width 0.5s"></div>' +
    '</div>' +
    '</div>';

  // ── Per week ──
  const weken = new Map();
  geplanning.forEach(item => {
    const d  = new Date(item.date + 'T00:00:00');
    const wd = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (wd === 0 ? 6 : wd - 1));
    const key = mon.toISOString().split('T')[0];
    if (!weken.has(key)) weken.set(key, []);
    weken.get(key).push(item);
  });

  const wekenHtml = [...weken.entries()].map(([monStr, items]) => {
    const mon = new Date(monStr + 'T00:00:00');
    const zo  = new Date(mon); zo.setDate(mon.getDate() + 6);
    const label = mon.toLocaleDateString('nl-NL',{day:'numeric',month:'short'}) + ' – ' +
                  zo.toLocaleDateString('nl-NL',{day:'numeric',month:'short'});

    const rijen = items.map(item => {
      const d         = new Date(item.date + 'T00:00:00');
      const disp      = wpGetDisplay(item.schemaId);
      const oefs      = wpGetOefeningen(item.schemaId);
      const done      = (wpDone[item.date] || []).filter(i => i < oefs.length);
      const isVandaag = item.date === vandaag;
      const isVerleden= item.date < vandaag;

      let badge = '';
      if (oefs.length > 0) {
        if (isVerleden || isVandaag) {
          const allDone  = done.length >= oefs.length;
          const noneDone = done.length === 0;
          const bg = allDone ? 'var(--sage)' : noneDone ? 'var(--sand-dark)' : '#f39c12';
          const fg = (allDone || !noneDone) ? 'white' : 'var(--muted)';
          badge = '<span style="font-size:11px;padding:2px 9px;border-radius:10px;font-weight:600;background:' + bg + ';color:' + fg + ';flex-shrink:0">' +
            (allDone ? '✓ ' : '') + done.length + '/' + oefs.length + '</span>';
        } else {
          badge = '<span style="font-size:11px;color:var(--muted);flex-shrink:0">' + oefs.length + ' oef.</span>';
        }
      }

      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--sand-dark);opacity:' + (isVerleden && !isVandaag ? '0.55' : '1') + '">' +
        '<div style="width:26px;font-size:11px;font-weight:700;color:var(--muted);flex-shrink:0">' + DAGKORT[d.getDay()] + '</div>' +
        '<div style="font-size:11px;color:var(--muted);width:54px;flex-shrink:0">' + d.toLocaleDateString('nl-NL',{day:'numeric',month:'short'}) + '</div>' +
        '<span style="font-size:16px;flex-shrink:0">' + disp.icon + '</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13px;font-weight:' + (isVandaag ? '600' : '400') + ';color:' + (isVandaag ? 'var(--sage)' : 'var(--charcoal)') + '">' +
            disp.naam +
            (isVandaag ? ' <span style="font-size:10px;background:var(--sage);color:white;padding:2px 7px;border-radius:8px;vertical-align:middle">vandaag</span>' : '') +
          '</div>' +
          (disp.sub ? '<div style="font-size:11px;color:var(--muted)">' + disp.sub + '</div>' : '') +
        '</div>' +
        badge +
        '</div>';
    }).join('');

    return '<div style="margin-bottom:18px">' +
      '<div style="font-size:11px;font-weight:700;color:var(--sage);letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px">' + label + '</div>' +
      rijen +
      '</div>';
  }).join('');

  el.innerHTML = statsHtml + '<div class="card">' + wekenHtml + '</div>';
}

// ========== STREAK & STATS ==========
function calcStreak() {
  if (!history.length) return 0;
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  const dates = history.map(h => h.date);
  let check = today;
  for (let i = 0; i < 60; i++) {
    if (dates.includes(check)) { streak++; }
    else if (i > 0) break;
    const d = new Date(check); d.setDate(d.getDate() - 1);
    check = d.toISOString().split('T')[0];
  }
  return streak;
}

function updateStreak() {
  const streak = calcStreak();
  document.getElementById('s-streak').textContent = streak;
  document.getElementById('s-checkins').textContent = history.length + 1;
  const energyAvg = history.length > 0 ? Math.round(history.slice(0,7).reduce((a,h) => a + (h.checkout?.energy||0), 0) / Math.min(7, history.length)) : 0;
  document.getElementById('s-avg').textContent = energyAvg > 0 ? ['','🪫','😑','⚡','🔥'][energyAvg] : '—';
}

function updateStats() {
  const streak = calcStreak();
  document.getElementById('s-streak').textContent = streak;
  document.getElementById('s-checkins').textContent = history.length;
}

