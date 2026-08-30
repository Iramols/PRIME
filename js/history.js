// ========== HISTORY ==========
function resetVoortgang() {
  if (!confirm(t('history.confirmReset'))) return;
  history = [];
  todayData = null;
  exerciseDone = [];
  dagDone = {};
  ['prime_history','prime_today','prime_exdone','prime_wp_done'].forEach(function(k) {
    syncRemove(k);
  });
  renderHistory();
  document.getElementById('checkin-section').style.display = 'block';
  document.getElementById('day-section').style.display = 'none';
}

function renderHistory() {
  const total = history.length;
  if (total === 0) {
    document.getElementById('h-username').textContent = t('history.defaultTitle');
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
    const pct = document.getElementById('h-food-log-pct'); if (pct) pct.textContent = t('history.foodLogPct.default');
    const sig = document.getElementById('h-signals'); if (sig) sig.innerHTML = '<div style="font-size:13px;color:var(--muted)">' + t('history.noData') + '</div>';
    const ec = document.getElementById('energy-chart'); if (ec) ec.innerHTML = '';
    const wc = document.getElementById('weight-chart'); if (wc) wc.innerHTML = '';
    const kc = document.getElementById('kcal-trend-chart'); if (kc) kc.innerHTML = '';
    const mc = document.getElementById('macro-trend-chart'); if (mc) mc.innerHTML = '';
    const mt = document.getElementById('macro-trend-toggles'); if (mt) mt.innerHTML = '';
    return;
  }

  // ── Naam & doel ──
  document.getElementById('h-username').textContent = t('history.usernameStats', { name: profile.name || t('history.defaultUserName') });
  document.getElementById('h-goal').textContent = profile.goal || '';
  const eerste = new Date(history[history.length-1].date);
  const laatste = new Date(history[0].date);
  document.getElementById('h-period').textContent =
    eerste.toLocaleDateString(dateLocale(),{day:'numeric',month:'short'}) + ' → ' +
    laatste.toLocaleDateString(dateLocale(),{day:'numeric',month:'short',year:'numeric'});

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
        e1 > e2 + 0.3 ? t('history.trend.up') : e1 < e2 - 0.3 ? t('history.trend.down') : t('history.trend.stable');
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
  document.getElementById('h-food-log-pct').textContent = pctLog + t('history.pctFoodLoggedSuffix');

  // ── Signalen voor coach ──
  const signals = [];
  if (streak === 0 && total > 0) signals.push({ kleur:'#E24B4A', tekst:t('history.signal.streakBroken') });
  const dagenWeg = calcDagenZonderCheckin();
  if (dagenWeg >= 2) signals.push({ kleur:'#E24B4A', tekst:t('history.signal.daysNoCheckin', { n: dagenWeg }) });
  if (parseFloat(avg(recent7, 'energy')) < 2.0) signals.push({ kleur:'#f39c12', tekst:t('history.signal.lowEnergy') });
  if (parseFloat(avg(recent7, 'stress')) < 2.0) signals.push({ kleur:'#f39c12', tekst:t('history.signal.highStress') });
  if (metCheckout.length >= 3 && volledig / metCheckout.length < 0.4) signals.push({ kleur:'#f39c12', tekst:t('history.signal.lowTrainingCompletion') });
  if (pctLog < 40 && total >= 3) signals.push({ kleur:'#f39c12', tekst:t('history.signal.foodRarelyLogged') });
  if (bestStreak >= 7) signals.push({ kleur:'var(--sage)', tekst:t('history.signal.bestStreak', { n: bestStreak }) });
  if (volledig >= 5) signals.push({ kleur:'var(--sage)', tekst:t('history.signal.trainingsCompleted', { n: volledig }) });
  if (streak >= 7) signals.push({ kleur:'var(--sage)', tekst:t('history.signal.activeStreak', { n: streak }) });

  document.getElementById('h-signals').innerHTML = signals.length > 0
    ? signals.map(s => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:0.5px solid var(--sand-dark)">
          <div style="width:3px;min-height:20px;border-radius:2px;background:${s.kleur};flex-shrink:0;margin-top:2px"></div>
          <div style="font-size:13px;line-height:1.6">${s.tekst}</div>
        </div>`).join('')
    : '<div style="font-size:13px;color:var(--muted)">' + t('history.noSignals') + '</div>';

  // ── Energie trend grafiek ──
  renderEnergyChart();

  // ── Gewicht grafiek ──
  renderWeightChart();

  // ── Calorietrend grafiek (kcal) ──
  renderKcalTrendChart();

  // ── Macrotrend grafiek (eiwit/vet/koolhydraten) ──
  renderMacroTrendChart();
}

function renderEnergyChart() {
  const el = document.getElementById('energy-chart');
  if (!el) return;

  const data = history
    .filter(h => h.checkout && h.checkout.energy > 0)
    .slice(0, 30)
    .reverse();

  if (data.length < 2) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">' + t('history.energyChartHint') + '</div>';
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
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">' + t('history.weightChartHint') + '</div>';
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
      ${t('history.latestMeasurement')} <strong style="color:var(--charcoal)">${latest} kg</strong>
      ${diffStr ? `&nbsp;<span style="color:${diffColor};font-weight:600">${diffStr} kg</span> ${t('history.vsFirstMeasurement')}` : ''}
    </div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
      ${grid}
      <polyline points="${pts}" fill="none" stroke="#4a7c59" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      ${xLabels}
    </svg>`;
}

// Calorietrend-grafiek: totaal gelogde kcal per dag. Bron is foodDays
// (state.js) -- de daadwerkelijk gelogde producten/gerechten per datum --
// zelfde inline-SVG-stijl als de Energie-/Gewichtgrafiek hierboven.
function renderKcalTrendChart() {
  const el = document.getElementById('kcal-trend-chart');
  if (!el) return;

  const data = Object.keys(foodDays)
    .filter(dateStr => foodDays[dateStr] && foodDays[dateStr].length)
    .sort()
    .slice(-30)
    .map(dateStr => ({
      date: dateStr,
      kcal: Math.round(foodDays[dateStr].reduce((a,i) => a + (i.kcal||0), 0))
    }));

  if (data.length < 2) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">' + t('history.calorieChartHint') + '</div>';
    return;
  }

  const W = 300, H = 110;
  const padL = 34, padR = 10, padT = 10, padB = 22;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const n = data.length;

  const maxKcal = Math.max(...data.map(d => d.kcal), 1);
  const yMax = Math.max(Math.ceil(maxKcal * 1.15 / 500) * 500, 500);
  const stepSize = yMax <= 2000 ? 500 : 1000;

  const xPos = i => padL + (n === 1 ? cW / 2 : i * cW / (n - 1));
  const yPos = v => padT + cH - (v / yMax) * cH;

  const gridLines = [];
  for (let v = 0; v <= yMax; v += stepSize) gridLines.push(v);

  const grid = gridLines.map(v => `
    <line x1="${padL}" y1="${yPos(v)}" x2="${W - padR}" y2="${yPos(v)}" stroke="#e8e2d8" stroke-width="0.5"/>
    <text x="${padL - 4}" y="${yPos(v) + 4}" text-anchor="end" font-size="9" fill="#aaa">${v}</text>
  `).join('');

  const pts = data.map((d, i) => `${xPos(i)},${yPos(d.kcal)}`).join(' ');
  const dots = data.map((d, i) => `<circle cx="${xPos(i)}" cy="${yPos(d.kcal)}" r="3.5" fill="#4CAF50" stroke="white" stroke-width="1.2"/>`).join('');

  const step = Math.max(1, Math.floor(n / 6));
  const xLabels = data.map((d, i) => {
    if (i % step !== 0 && i !== n - 1) return '';
    const dt = new Date(d.date + 'T00:00:00');
    return `<text x="${xPos(i)}" y="${H - 4}" text-anchor="middle" font-size="8" fill="#aaa">${dt.getDate()}/${dt.getMonth() + 1}</text>`;
  }).join('');

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
      ${grid}
      <polyline points="${pts}" fill="none" stroke="#4CAF50" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      ${xLabels}
    </svg>`;
}

// Zichtbaarheid van de drie macro-lijnen in de macrotrend-grafiek
// (Statistieken). Op module-niveau onthouden zodat aan/uitvinken alleen de
// grafiek zelf herrendert, niet de hele Voortgang-pagina.
let macroTrendVisible = { prot: true, fat: true, carb: true };

function toggleMacroTrendSeries(key) {
  macroTrendVisible[key] = !macroTrendVisible[key];
  renderMacroTrendChart();
}

// Macrotrend-grafiek: eiwit/vet/koolhydraten per dag (in gram), elk apart
// aan/uit te vinken. Zelfde bron (foodDays) als de calorietrend hierboven,
// los getrokken in een eigen grafiek omdat gram en kcal te ver uit elkaar
// liggen om leesbaar samen op één as te tonen.
function renderMacroTrendChart() {
  const toggleEl = document.getElementById('macro-trend-toggles');
  const chartEl = document.getElementById('macro-trend-chart');
  if (!chartEl) return;

  const SERIES = [
    { key:'prot', label:'E', color:'#2196F3' },
    { key:'fat',  label:'V', color:'#FF5722' },
    { key:'carb', label:'K', color:'#E91E8C' },
  ];

  if (toggleEl) {
    toggleEl.innerHTML = SERIES.map(s => `
      <label style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:${macroTrendVisible[s.key] ? s.color : 'var(--muted)'};cursor:pointer">
        <input type="checkbox" ${macroTrendVisible[s.key] ? 'checked' : ''} onchange="toggleMacroTrendSeries('${s.key}')" style="accent-color:${s.color};width:14px;height:14px;cursor:pointer">${s.label}
      </label>`).join('');
  }

  const data = Object.keys(foodDays)
    .filter(dateStr => foodDays[dateStr] && foodDays[dateStr].length)
    .sort()
    .slice(-30)
    .map(dateStr => {
      const tot = foodDays[dateStr].reduce((a,i) => ({
        prot: a.prot + (i.prot||0), carb: a.carb + (i.carb||0), fat: a.fat + (i.fat||0)
      }), { prot:0, carb:0, fat:0 });
      return { date: dateStr, prot: Math.round(tot.prot), carb: Math.round(tot.carb), fat: Math.round(tot.fat) };
    });

  if (data.length < 2) {
    chartEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">' + t('history.calorieChartHint') + '</div>';
    return;
  }

  const actieveSeries = SERIES.filter(s => macroTrendVisible[s.key]);
  if (!actieveSeries.length) {
    chartEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">' + t('history.calorieChartNoneSelected') + '</div>';
    return;
  }

  const alleWaarden = data.flatMap(d => actieveSeries.map(s => d[s.key]));
  const maxV = Math.max(...alleWaarden, 1);

  const W = 300, H = 130;
  const padL = 30, padR = 10, padT = 10, padB = 22;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const n = data.length;

  const yMax = Math.max(Math.ceil(maxV * 1.15 / 20) * 20, 20);
  const xPos = i => padL + (n === 1 ? cW / 2 : i * cW / (n - 1));
  const yPos = v => padT + cH - (v / yMax) * cH;

  const stepSize = yMax <= 100 ? 20 : yMax <= 300 ? 50 : 100;
  const gridLines = [];
  for (let v = 0; v <= yMax; v += stepSize) gridLines.push(v);

  const grid = gridLines.map(v => `
    <line x1="${padL}" y1="${yPos(v)}" x2="${W - padR}" y2="${yPos(v)}" stroke="#e8e2d8" stroke-width="0.5"/>
    <text x="${padL - 4}" y="${yPos(v) + 4}" text-anchor="end" font-size="9" fill="#aaa">${v}</text>
  `).join('');

  const lijnen = actieveSeries.map(s => {
    const pts = data.map((d, i) => `${xPos(i)},${yPos(d[s.key])}`).join(' ');
    const dots = data.map((d, i) => `<circle cx="${xPos(i)}" cy="${yPos(d[s.key])}" r="3" fill="${s.color}" stroke="white" stroke-width="1"/>`).join('');
    return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
  }).join('');

  const step = Math.max(1, Math.floor(n / 6));
  const xLabels = data.map((d, i) => {
    if (i % step !== 0 && i !== n - 1) return '';
    const dt = new Date(d.date + 'T00:00:00');
    return `<text x="${xPos(i)}" y="${H - 4}" text-anchor="middle" font-size="8" fill="#aaa">${dt.getDate()}/${dt.getMonth() + 1}</text>`;
  }).join('');

  chartEl.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
      ${grid}
      ${lijnen}
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
      '<div style="font-family:\'DM Serif Display\',serif;font-size:20px;margin-bottom:8px">' + t('history.noWeekplanTitle') + '</div>' +
      '<div style="font-size:13px;color:var(--muted)">' + t('history.noWeekplanHint') + '</div>' +
      '</div>';
    return;
  }

  const vandaag = localDateStr();

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
    '<div class="card-label" style="margin-bottom:14px">' + t('history.programOverview') + '</div>' +
    '<div class="stats-row" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">' +
      '<div class="stat-card"><div class="stat-val" style="font-size:24px">' + verleden.length + '</div><div class="stat-lbl">' + t('history.stat.past') + '</div></div>' +
      '<div class="stat-card"><div class="stat-val" style="font-size:24px">' + volledigDagen + '</div><div class="stat-lbl">' + t('history.stat.complete') + '</div></div>' +
      '<div class="stat-card"><div class="stat-val" style="font-size:24px">' + toekomst + '</div><div class="stat-lbl">' + t('history.stat.upcoming') + '</div></div>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:6px">' + t('history.exercisesCompletedSummary', { done: gedaanOef, total: totaalOef, pct }) + '</div>' +
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
    const key = localDateStr(mon);
    if (!weken.has(key)) weken.set(key, []);
    weken.get(key).push(item);
  });

  const wekenHtml = [...weken.entries()].map(([monStr, items]) => {
    const mon = new Date(monStr + 'T00:00:00');
    const zo  = new Date(mon); zo.setDate(mon.getDate() + 6);
    const label = mon.toLocaleDateString(dateLocale(),{day:'numeric',month:'short'}) + ' – ' +
                  zo.toLocaleDateString(dateLocale(),{day:'numeric',month:'short'});

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
          badge = '<span style="font-size:11px;color:var(--muted);flex-shrink:0">' + t('history.exercisesShort', { n: oefs.length }) + '</span>';
        }
      }

      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--sand-dark);opacity:' + (isVerleden && !isVandaag ? '0.55' : '1') + '">' +
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
  const today = localDateStr();
  const dates = history.map(h => h.date);
  let check = today;
  for (let i = 0; i < 60; i++) {
    if (dates.includes(check)) { streak++; }
    else if (i > 0) break;
    const d = new Date(check + 'T00:00:00'); d.setDate(d.getDate() - 1);
    check = localDateStr(d);
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
