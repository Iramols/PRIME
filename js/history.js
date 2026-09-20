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
    ['h-avg-energy','h-avg-sleep','h-avg-stress','h-avg-energy-out','h-food-ondoel','h-food-teveel','h-food-teweinig'].forEach(function(id) {
      const el = document.getElementById(id); if (!el) return;
      el.textContent = '—';
      // Score-tegels (energie/slaap/stress) kregen sinds kort een dynamische
      // rood/geel/groen-kleur i.p.v. een vaste kleur -- zonder deze reset
      // bleef bij een lege geschiedenis de kleur van de vorige render
      // (bv. rood) achter op een kale "—".
      el.style.color = 'var(--muted)';
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

  // ── Training ── ("Trainingen voltooid" = zelfde telling als "Volledig"
  // op Programma voortgang: dagen waarvan ALLE oefeningen zijn afgevinkt,
  // i.p.v. het losse zelf-gerapporteerde antwoord bij de avond check-out.)
  const metCheckout = history.filter(h => h.checkout);
  const { verledenCount, volledigDagen } = wpVoortgangStats();
  const volledig = volledigDagen;
  document.getElementById('h-trainings').textContent = volledig;

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
  // Toont een leesbare kwalificatie i.p.v. het kale gemiddelde ("3.9/4") --
  // en geeft de tekst zelf dezelfde rood/geel/groen-kleur als de bol die
  // er voorheen los naast stond, i.p.v. steeds de vaste categorie-kleur
  // (salie/blauw/accent) van die meting. Zo hoeven kleur van tekst en bol
  // niet meer los van elkaar geïnterpreteerd te worden.
  const SCORE_KLEUR = { laag: '#E24B4A', midden: '#f39c12', hoog: 'var(--sage)' };
  const SCORE_LABELS = {
    energy: { laag: t('history.score.energyLow'), midden: t('history.score.energyMid'), hoog: t('history.score.energyHigh') },
    sleep:  { laag: t('history.score.sleepLow'),  midden: t('history.score.sleepMid'),  hoog: t('history.score.sleepHigh') },
    stress: { laag: t('history.score.stressLow'), midden: t('history.score.stressMid'), hoog: t('history.score.stressHigh') },
  };
  const setScoreEl = (id, metric, v) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (v === '—') { el.textContent = '—'; el.style.color = 'var(--muted)'; return; }
    const n = parseFloat(v);
    const tier = n < 1.8 ? 'laag' : n < 2.5 ? 'midden' : 'hoog';
    el.textContent = SCORE_LABELS[metric][tier];
    el.style.color = SCORE_KLEUR[tier];
  };
  setScoreEl('h-avg-energy', 'energy', avg(recent7, 'energy'));
  setScoreEl('h-avg-sleep', 'sleep', avg(recent7, 'sleep'));
  setScoreEl('h-avg-stress', 'stress', avg(recent7, 'stress'));
  setScoreEl('h-avg-energy-out', 'energy', avgOut(recent7, 'energy'));

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
  if (verledenCount >= 3 && volledig / verledenCount < 0.4) signals.push({ kleur:'#f39c12', tekst:t('history.signal.lowTrainingCompletion') });
  if (pctLog < 40 && total >= 3) signals.push({ kleur:'#f39c12', tekst:t('history.signal.foodRarelyLogged') });
  if (foodDays.length >= 3) {
    const pctOpDoel = opDoel / foodDays.length * 100;
    if (pctOpDoel < 65) signals.push({ kleur:'#E24B4A', tekst:t('history.signal.foodOnTargetLow') });
    else if (pctOpDoel <= 80) signals.push({ kleur:'#f39c12', tekst:t('history.signal.foodOnTargetMid') });
    else signals.push({ kleur:'var(--sage)', tekst:t('history.signal.foodOnTargetHigh') });
  }
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
    <line x1="${padL}" y1="${yPos(v)}" x2="${W - padR}" y2="${yPos(v)}" stroke="#efece4" stroke-width="0.5"/>
    <text x="${padL - 4}" y="${yPos(v) + 4}" text-anchor="end" font-size="9" fill="#aaa">${emoji}</text>
  `).join('');

  // Polyline + subtel verloop-vlak eronder (zelfde sage als de lijn, zie
  // toelichting bij de nieuwe look van de Voortgang-grafieken hieronder).
  const pts = data.map((h, i) => `${xPos(i)},${yPos(h.checkout.energy)}`).join(' ');
  const vlak = `${padL},${yPos(1)} ` + pts + ` ${xPos(n - 1)},${yPos(1)}`;

  // X-labels: toon max 6 datums
  const step = Math.max(1, Math.floor(n / 6));
  const xLabels = data.map((h, i) => {
    if (i !== n - 1 && (i % step !== 0 || n - 1 - i < step)) return ''; // laatste datum altijd; een stapdatum vlak ervoor overslaan
    const d = new Date(h.date);
    return `<text x="${xPos(i)}" y="${H - 4}" text-anchor="middle" font-size="8" fill="#aaa">${d.getDate()}/${d.getMonth() + 1}</text>`;
  }).join('');

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
      <defs><linearGradient id="egyFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4a7c59" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="#4a7c59" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}
      <polygon points="${vlak}" fill="url(#egyFill)"/>
      <polyline points="${pts}" fill="none" stroke="#4a7c59" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
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
    <line x1="${padL}" y1="${yPos(v)}" x2="${W - padR}" y2="${yPos(v)}" stroke="#efece4" stroke-width="0.5"/>
    <text x="${padL - 4}" y="${yPos(v) + 4}" text-anchor="end" font-size="9" fill="#aaa">${v} kg</text>
  `).join('');

  const pts = data.map((h, i) => `${xPos(i)},${yPos(h.checkin.weight)}`).join(' ');
  const vlak = `${padL},${yPos(yMin)} ` + pts + ` ${xPos(n - 1)},${yPos(yMin)}`;

  const step = Math.max(1, Math.floor(n / 6));
  const xLabels = data.map((h, i) => {
    if (i !== n - 1 && (i % step !== 0 || n - 1 - i < step)) return ''; // laatste datum altijd; een stapdatum vlak ervoor overslaan
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
      <defs><linearGradient id="wgtFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4a7c59" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="#4a7c59" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}
      <polygon points="${vlak}" fill="url(#wgtFill)"/>
      <polyline points="${pts}" fill="none" stroke="#4a7c59" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${xLabels}
    </svg>`;
}

// Calorietrend-grafiek: totaal gelogde kcal per dag. Bron is foodDays
// (state.js) -- de daadwerkelijk gelogde producten/gerechten per datum --
// zelfde inline-SVG-stijl als de Energie-/Gewichtgrafiek hierboven. Toont
// ook het kcal-doel (getDagDoel()) als min/max-band met stippellijnen
// (±10%, dezelfde marge als de "Doel: X–Y kcal"-weergave bij Voeding), zodat
// in één oogopslag te zien is welke dagen binnen of buiten die band vielen.
function renderKcalTrendChart() {
  const el = document.getElementById('kcal-trend-chart');
  if (!el) return;

  const _tmVandaag = localDateStr();
  const data = Object.keys(foodDays)
    .filter(dateStr => foodDays[dateStr] && foodDays[dateStr].length && dateStr <= _tmVandaag && sumItems(foodDays[dateStr].filter(isEatenItem)).kcal > 0)
    .sort()
    .slice(-30)
    .map(dateStr => ({
      date: dateStr,
      kcal: Math.round(sumItems(foodDays[dateStr].filter(isEatenItem)).kcal)
    }));

  if (data.length < 2) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">' + t('history.calorieChartHint') + '</div>';
    return;
  }

  const doel = getDagDoel();
  const minLimiet = Math.round(doel.kcal * 0.9);
  const maxLimiet = Math.round(doel.kcal * 1.1);

  const W = 300, H = 110;
  // Rechts extra ruimte (padR 28) voor de limiet-getallen, zodat ze naast de
  // grafiek staan i.p.v. over de lijn heen.
  const padL = 46, padR = 28, padT = 10, padB = 22;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const n = data.length;

  // yMax houdt ook rekening met de limietlijnen, anders vallen die buiten
  // beeld als alle gelogde dagen (ver) onder het doel zaten.
  const maxKcal = Math.max(...data.map(d => d.kcal), maxLimiet, 1);
  const yMax = Math.max(Math.ceil(maxKcal * 1.15 / 500) * 500, 500);
  const stepSize = yMax <= 2000 ? 500 : 1000;

  const xPos = i => padL + (n === 1 ? cW / 2 : i * cW / (n - 1));
  const yPos = v => padT + cH - (v / yMax) * cH;

  const gridLines = [];
  for (let v = 0; v <= yMax; v += stepSize) gridLines.push(v);

  // Eenheid ("kcal") achter elk getal i.p.v. kaal -- behalve bij 0, dat
  // blijft gewoon "0". Iets kleiner lettertype (8 i.p.v. 9) zodat dit
  // past zonder de linkerkant van de grafiek te laten overlappen.
  const grid = gridLines.map(v => `
    <line x1="${padL}" y1="${yPos(v)}" x2="${W - padR}" y2="${yPos(v)}" stroke="#efece4" stroke-width="0.5"/>
    <text x="${padL - 4}" y="${yPos(v) + 4}" text-anchor="end" font-size="8" fill="#aaa">${v === 0 ? '0' : v + ' kcal'}</text>
  `).join('');

  const limietLijnen = [minLimiet, maxLimiet].map(v => `
    <line x1="${padL}" y1="${yPos(v)}" x2="${W - padR}" y2="${yPos(v)}" stroke="#c8855a" stroke-width="1" stroke-dasharray="4,3"/>
    <text x="${W - padR + 3}" y="${yPos(v) + 3}" text-anchor="start" font-size="8" fill="#c8855a">${v}</text>
  `).join('');

  const pts = data.map((d, i) => `${xPos(i)},${yPos(d.kcal)}`).join(' ');
  const vlak = `${padL},${yPos(0)} ` + pts + ` ${xPos(n - 1)},${yPos(0)}`;

  const step = Math.max(1, Math.floor(n / 6));
  const xLabels = data.map((d, i) => {
    if (i !== n - 1 && (i % step !== 0 || n - 1 - i < step)) return ''; // laatste datum altijd; een stapdatum vlak ervoor overslaan
    const dt = new Date(d.date + 'T00:00:00');
    return `<text x="${xPos(i)}" y="${H - 4}" text-anchor="middle" font-size="8" fill="#aaa">${dt.getDate()}/${dt.getMonth() + 1}</text>`;
  }).join('');

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
      <defs><linearGradient id="kcalFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4a7c59" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="#4a7c59" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}
      ${limietLijnen}
      <polygon points="${vlak}" fill="url(#kcalFill)"/>
      <polyline points="${pts}" fill="none" stroke="#4a7c59" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
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

  // Gedempte, volwassen kleuren i.p.v. de felle basiskleuren van hiervoor --
  // zelfde reden als bij de andere Voortgang-grafieken (zie geschiedenis).
  const SERIES = [
    { key:'prot', label:'E', color:'#1B7FA8', bg:'#e5f0f5' },
    { key:'fat',  label:'V', color:'#B8823D', bg:'#f5ece0' },
    { key:'carb', label:'K', color:'#9C4F6E', bg:'#f2e5ea' },
  ];

  if (toggleEl) {
    // Chip-achtige knopjes i.p.v. kale checkboxjes: actief = gekleurd
    // vlakje, uit = grijs -- de checkbox zelf blijft functioneel maar
    // onzichtbaar (visually-hidden, niet display:none, zodat toetsenbord-
    // focus/labeltoegankelijkheid behouden blijft).
    toggleEl.innerHTML = SERIES.map(s => {
      const actief = macroTrendVisible[s.key];
      return `
      <label style="display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:4px 11px;border-radius:10px;cursor:pointer;background:${actief ? s.bg : 'var(--sand)'};color:${actief ? s.color : 'var(--muted)'}">
        <input type="checkbox" ${actief ? 'checked' : ''} onchange="toggleMacroTrendSeries('${s.key}')" style="position:absolute;opacity:0;width:1px;height:1px">${s.label}
      </label>`;
    }).join('');
  }

  const _tmVandaag = localDateStr();
  const data = Object.keys(foodDays)
    .filter(dateStr => foodDays[dateStr] && foodDays[dateStr].length && dateStr <= _tmVandaag)
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
  const padL = 40, padR = 10, padT = 10, padB = 22;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const n = data.length;

  const yMax = Math.max(Math.ceil(maxV * 1.15 / 20) * 20, 20);
  const xPos = i => padL + (n === 1 ? cW / 2 : i * cW / (n - 1));
  const yPos = v => padT + cH - (v / yMax) * cH;

  const stepSize = yMax <= 100 ? 20 : yMax <= 300 ? 50 : 100;
  const gridLines = [];
  for (let v = 0; v <= yMax; v += stepSize) gridLines.push(v);

  // Eenheid ("gr") achter elk getal i.p.v. kaal -- behalve bij 0. Iets
  // kleiner lettertype (8 i.p.v. 9) zodat dit past.
  const grid = gridLines.map(v => `
    <line x1="${padL}" y1="${yPos(v)}" x2="${W - padR}" y2="${yPos(v)}" stroke="#efece4" stroke-width="0.5"/>
    <text x="${padL - 4}" y="${yPos(v) + 4}" text-anchor="end" font-size="8" fill="#aaa">${v === 0 ? '0' : v + ' gr'}</text>
  `).join('');

  const lijnen = actieveSeries.map(s => {
    const pts = data.map((d, i) => `${xPos(i)},${yPos(d[s.key])}`).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');

  const step = Math.max(1, Math.floor(n / 6));
  const xLabels = data.map((d, i) => {
    if (i !== n - 1 && (i % step !== 0 || n - 1 - i < step)) return ''; // laatste datum altijd; een stapdatum vlak ervoor overslaan
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
  // Ontdubbel eerst op datum -- een dag kon (vóór de fix die dubbel
  // afsluiten voorkwam, zie eerdere commit) meerdere keren in history
  // terechtkomen. Zo'n duplicaat gaf hier een dagverschil van 0 tussen
  // twee identieke datums, wat de opeenvolgende-dagenteller ten onrechte
  // liet resetten en de beste streak te laag liet uitkomen (bv. 13 i.p.v.
  // de daadwerkelijke, langere streak die calcStreak() wél correct telt).
  const datums = [...new Set(history.map(h => h.date))].sort();
  let best = 0, current = 0;
  for (let i = 0; i < datums.length; i++) {
    if (i === 0) { current = 1; }
    else {
      const prev = new Date(datums[i-1] + 'T00:00:00');
      const curr = new Date(datums[i] + 'T00:00:00');
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

  if (!geplanning.length) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:40px 20px">' +
      '<div style="font-size:40px;margin-bottom:12px">\u{1F4C5}</div>' +
      '<div style="font-family:\'DM Serif Display\',serif;font-size:20px;margin-bottom:8px">' + t('history.noWeekplanTitle') + '</div>' +
      '<div style="font-size:13px;color:var(--muted)">' + t('history.noWeekplanHint') + '</div>' +
      '</div>';
    return;
  }

  const vandaag = localDateStr();

  // (De eenmalige v1/v2/v3-snapshot-resets die hier stonden zijn
  // verwijderd: ze dienden om oude, inmiddels allang gerepareerde bugs
  // (premature bevriezing, per-dag-verwijderde oefeningen niet gefilterd,
  // gelijknamige-oefeningen-botsing) één keer per apparaat recht te
  // trekken. Die migratie is intussen overal handmatig/via de app zelf al
  // gebeurd. Het bleek zelf een risico geworden: op een browser/apparaat
  // dat de lokale vlag nog nooit had gezet (bv. na het wissen van
  // browserdata, of gewoon een nieuw apparaat) wiste dit blok alsnog ALLE
  // bevroren tellingen en schreef dat direct, ongebeveiligd terug --
  // precies het "trainingen zijn weer gereset"-patroon. Zie
  // wpFreezeSnapshotKeys()/wpApplyPlanningChanges() (weekplanning.js) voor
  // hoe bevriezen/wijzigen nu wél veilig gebeurt.)

  // Bevries het aantal oefeningen voor een dag pas zodra die dag definitief
  // in het verleden ligt -- daarvoor kan de oefeningenlijst nog wijzigen
  // (oefeningen doorschuiven/naar voren halen naar een andere dag) en moet
  // "voortgang" dus gewoon de actuele (nog niet bevroren) lijst volgen.
  // Eenmaal bevroren blijft dit staan, ook als het programma zelf later
  // nog wordt aangepast. Gebruikt de per-dag ZICHTBARE lijst (dus mét een
  // eventuele "voor deze dag verwijderd"-oefening eruit gefilterd, zie
  // wpGetZichtbareOefeningen()) -- niet het kale, ongefilterde sjabloon.
  // Toegepast via wpFreezeSnapshotKeys() (weekplanning.js), die vlak vóór
  // het opslaan zelf altijd eerst vers vanuit localStorage ververst --
  // zie die functie voor waarom (voorkomt dat een verouderde/andere
  // sessie een net elders bevroren snapshot overschrijft).
  const teBevriezen = [];
  geplanning.forEach(item => {
    if (item.date < vandaag && item.oefSnapshotKeys == null) {
      item.oefSnapshotKeys = wpGetZichtbareOefeningen(item.date, item.schemaId).map(wpOefKey);
      teBevriezen.push({ date: item.date, oefSnapshotKeys: item.oefSnapshotKeys });
    }
  });
  if (teBevriezen.length) wpFreezeSnapshotKeys(teBevriezen);

  // ── Stats ── (gedeelde telling met "Trainingen voltooid" op de
  // Statistieken-tab, zie wpVoortgangStats() in weekplanning.js)
  const { verledenCount, volledigDagen, totaalOef, gedaanOef } = wpVoortgangStats();
  const pct = totaalOef > 0 ? Math.round(gedaanOef / totaalOef * 100) : 0;
  const toekomst = geplanning.filter(p => p.date >= vandaag).length;

  const statsHtml =
    '<div class="card" style="margin-bottom:14px">' +
    '<div class="card-label" style="margin-bottom:14px">' + t('history.programOverview') + '</div>' +
    '<div class="stats-row" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">' +
      '<div class="stat-card"><div class="stat-val" style="font-size:24px">' + verledenCount + '</div><div class="stat-lbl">' + t('history.stat.past') + '</div></div>' +
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

  // Op datum sorteren i.p.v. op toevoegvolgorde in prime_planning -- die
  // volgorde klopt niet altijd (bv. een dag die later alsnog is toegevoegd,
  // zoals bij een handmatige correctie, staat dan achteraan in de array en
  // zou anders ook als laatste week/rij getoond worden, ook al ligt hij
  // chronologisch veel eerder).
  const wekenHtml = [...weken.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([monStr, items]) => {
    const mon = new Date(monStr + 'T00:00:00');
    const zo  = new Date(mon); zo.setDate(mon.getDate() + 6);
    const label = mon.toLocaleDateString(dateLocale(),{day:'numeric',month:'short'}) + ' – ' +
                  zo.toLocaleDateString(dateLocale(),{day:'numeric',month:'short'});

    const rijen = [...items].sort((a, b) => a.date.localeCompare(b.date)).map(item => {
      const d         = new Date(item.date + 'T00:00:00');
      const disp      = wpGetDisplay(item.schemaId);
      // Bevroren lijst (oefSnapshotKeys) voor dagen waar al afgevinkt is,
      // anders gewoon de actuele (per-dag zichtbare) oefeningen uit het
      // programma -- zie de toelichting hierboven bij de eenmalige
      // reparatiepas.
      const oefsNu       = wpGetZichtbareOefeningen(item.date, item.schemaId);
      const snapshotKeys = item.oefSnapshotKeys != null ? item.oefSnapshotKeys : oefsNu.map(wpOefKey);
      const doneRaw      = wpGetDone(item.date);
      const done         = doneRaw.filter(k => snapshotKeys.includes(k));
      const total        = snapshotKeys.length;
      const isVandaag = item.date === vandaag;
      const isVerleden= item.date < vandaag;

      let badge = '';
      if (total > 0) {
        if (isVerleden || isVandaag) {
          const allDone  = done.length >= total;
          const noneDone = done.length === 0;
          const bg = allDone ? 'var(--sage)' : noneDone ? 'var(--sand-dark)' : '#f39c12';
          const fg = (allDone || !noneDone) ? 'white' : 'var(--muted)';
          badge = '<span style="font-size:11px;padding:2px 9px;border-radius:10px;font-weight:600;background:' + bg + ';color:' + fg + ';flex-shrink:0">' +
            (allDone ? '✓ ' : '') + done.length + '/' + total + '</span>';
        } else {
          badge = '<span style="font-size:11px;color:var(--muted);flex-shrink:0">' + t('history.exercisesShort', { n: total }) + '</span>';
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

// ========== SIGNALEN-TAB (coach-only, overzicht over alle klanten) ==========
// Zelfde berekeningen als de "Signalen voor coach"-kaart in renderHistory()
// hierboven, maar hier bewust losgetrokken tot pure functies die expliciete
// data als parameter krijgen (i.p.v. de globale history/foodDays/localStorage
// van de ACTIEVE klant te lezen) -- zodat we per andere klant kunnen
// doorrekenen zonder ooit de lokale staat van de huidige klant aan te raken.

// Zelfde formule als wpVoortgangStats() (weekplanning.js), maar dan met
// meegegeven data i.p.v. rechtstreeks localStorage te lezen. Gebruikt
// bewust alleen al BEVROREN oefSnapshotKeys (die staan al gewoon in de
// meegestuurde prime_planning-data van de andere klant) -- zonder bevroren
// snapshot kunnen we een dag niet narekenen zonder ook de programma's van
// die andere klant op te halen, dus die tellen we dan simpelweg niet mee.
function calcTrainingCompletionVoorKlant(geplanningArr, wpDoneObj) {
  const vandaag = localDateStr();
  const verleden = (geplanningArr || []).filter(p => p.date < vandaag);
  let volledigDagen = 0;
  verleden.forEach(p => {
    if (p.oefSnapshotKeys == null || !p.oefSnapshotKeys.length) return;
    const doneRaw = (wpDoneObj && wpDoneObj[p.date]) || [];
    const done = doneRaw.filter(k => p.oefSnapshotKeys.includes(k));
    if (done.length >= p.oefSnapshotKeys.length) volledigDagen++;
  });
  return { verledenCount: verleden.length, volledigDagen };
}

function calcSignalenVoorKlant(hist, geplanningArr, wpDoneObj) {
  const signals = [];
  hist = (hist || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const total = hist.length;
  if (!total) return signals;
  const vandaag = localDateStr();

  let streak = 0;
  {
    const dates = hist.map(h => h.date);
    let check = vandaag;
    for (let i = 0; i < 60; i++) {
      if (dates.includes(check)) streak++;
      else if (i > 0) break;
      const d = new Date(check + 'T00:00:00'); d.setDate(d.getDate() - 1);
      check = localDateStr(d);
    }
  }
  if (streak === 0) signals.push({ kleur: '#E24B4A', tekst: t('history.signal.streakBroken') });

  const laatste = new Date(hist[0].date + 'T00:00:00');
  const vd = new Date(vandaag + 'T00:00:00');
  const dagenWeg = Math.round((vd - laatste) / (1000 * 60 * 60 * 24));
  if (dagenWeg >= 2) signals.push({ kleur: '#E24B4A', tekst: t('history.signal.daysNoCheckin', { n: dagenWeg }) });

  const recent7 = hist.slice(0, 7);
  const avg = key => {
    const vals = recent7.map(h => h.checkin?.[key]).filter(v => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const energie = avg('energy'), stress = avg('stress');
  if (energie !== null && energie < 2.0) signals.push({ kleur: '#f39c12', tekst: t('history.signal.lowEnergy') });
  if (stress !== null && stress < 2.0) signals.push({ kleur: '#f39c12', tekst: t('history.signal.highStress') });

  const { verledenCount, volledigDagen } = calcTrainingCompletionVoorKlant(geplanningArr, wpDoneObj);
  if (verledenCount >= 3 && volledigDagen / verledenCount < 0.4) signals.push({ kleur: '#f39c12', tekst: t('history.signal.lowTrainingCompletion') });

  const metCheckout = hist.filter(h => h.checkout);
  const foodDaysArr = metCheckout.filter(h => h.checkout.food > 0);
  const opDoel = foodDaysArr.filter(h => h.checkout.food === 3).length;
  const pctLog = total > 0 ? foodDaysArr.length / total * 100 : 0;
  if (pctLog < 40 && total >= 3) signals.push({ kleur: '#f39c12', tekst: t('history.signal.foodRarelyLogged') });
  if (foodDaysArr.length >= 3) {
    const pctOpDoel = opDoel / foodDaysArr.length * 100;
    if (pctOpDoel < 65) signals.push({ kleur: '#E24B4A', tekst: t('history.signal.foodOnTargetLow') });
    else if (pctOpDoel <= 80) signals.push({ kleur: '#f39c12', tekst: t('history.signal.foodOnTargetMid') });
    else signals.push({ kleur: 'var(--sage)', tekst: t('history.signal.foodOnTargetHigh') });
  }

  const datums = [...new Set(hist.map(h => h.date))].sort();
  let bestStreak = 0, cur = 0;
  for (let i = 0; i < datums.length; i++) {
    if (i === 0) cur = 1;
    else {
      const prev = new Date(datums[i-1] + 'T00:00:00'), curr = new Date(datums[i] + 'T00:00:00');
      const diff = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      cur = diff === 1 ? cur + 1 : 1;
    }
    if (cur > bestStreak) bestStreak = cur;
  }
  if (bestStreak >= 7) signals.push({ kleur: 'var(--sage)', tekst: t('history.signal.bestStreak', { n: bestStreak }) });
  if (volledigDagen >= 5) signals.push({ kleur: 'var(--sage)', tekst: t('history.signal.trainingsCompleted', { n: volledigDagen }) });
  if (streak >= 7) signals.push({ kleur: 'var(--sage)', tekst: t('history.signal.activeStreak', { n: streak }) });

  return signals;
}

function _signalenErnst(signals) {
  if (signals.some(s => s.kleur === '#E24B4A')) return 0;
  if (signals.some(s => s.kleur === '#f39c12')) return 1;
  return 2;
}

// ========== FEEDBACK VAN DEELNEMERS (coach, onder Signalen) ==========
function _fbEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
async function renderFeedbackList() {
  const el = document.getElementById('feedback-overzicht-content');
  if (!el) return;
  let res;
  try { res = await fetchFeedbackList(); } catch (e) { res = { data: [], error: e }; }
  const head = '<div style="font-family:\'DM Serif Display\',serif;font-size:20px;margin-bottom:12px">' + t('feedback.coach.title') + '</div>';
  if (res.error) {
    el.innerHTML = head + '<div class="card" style="font-size:13px;color:var(--muted)">' + t('feedback.coach.noTable') + '</div>';
    return;
  }
  if (!res.data.length) {
    el.innerHTML = head + '<div class="card" style="text-align:center;color:var(--muted);padding:24px">' + t('feedback.coach.none') + '</div>';
    return;
  }
  let clients = [], namen = {};
  try { clients = await fetchClientList(); } catch (e) {}
  try { namen = await fetchProfileNames(); } catch (e) {}
  const nameOf = id => namen[id] || (clients.find(c => c.id === id) || {}).display_name || 'Coach';
  const kindLabel = { bug: t('feedback.kind.bug'), idea: t('feedback.kind.idea'), other: t('feedback.kind.other'), delete_request: t('feedback.kind.delete_request') };
  el.innerHTML = head + '<div class="card">' + res.data.map(f => {
    const d = new Date(f.created_at);
    const isDel = f.kind === 'delete_request';
    return '<div class="fb-item" style="' + (f.handled ? 'opacity:0.5' : '') + '">' +
      '<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--muted);margin-bottom:4px">' +
        '<span><b style="color:var(--charcoal)">' + _fbEsc(nameOf(f.client_id)) + '</b> · ' + d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) + '</span>' +
        '<span style="padding:1px 8px;border-radius:10px;font-weight:600;' + (isDel ? 'background:#fdecea;color:#c0392b' : 'background:var(--sand);color:var(--muted)') + '">' + _fbEsc(kindLabel[f.kind] || f.kind) + '</span>' +
      '</div>' +
      '<div style="font-size:14px;line-height:1.5;margin-bottom:8px;white-space:pre-wrap">' + _fbEsc(f.message) + '</div>' +
      '<div style="display:flex;gap:8px">' +
        '<button class="btn-sm" onclick="toggleFeedbackHandled(\'' + f.id + '\',' + (!f.handled) + ')">' + (f.handled ? t('feedback.coach.reopen') : t('feedback.coach.handled')) + '</button>' +
        '<button class="btn-sm" onclick="removeFeedback(\'' + f.id + '\')">' + t('feedback.coach.delete') + '</button>' +
      '</div></div>';
  }).join('') + '</div>';
}
async function toggleFeedbackHandled(id, handled) {
  const err = await setFeedbackHandled(id, handled);
  if (err) console.error('toggleFeedbackHandled:', err);
  renderFeedbackList();
}
async function removeFeedback(id) {
  if (!confirm(t('feedback.coach.deleteConfirm'))) return;
  const err = await deleteFeedbackRow(id);
  if (err) console.error('removeFeedback:', err);
  renderFeedbackList();
}

async function renderSignalenTab() {
  const el = document.getElementById('signalen-overzicht-content');
  if (!el) return;
  renderFeedbackList();
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">' + t('signalen.loading') + '</div>';

  let clients;
  try { clients = await fetchClientList(); }
  catch (e) { console.error('renderSignalenTab, fetchClientList:', e); el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">' + t('signalen.loadError') + '</div>'; return; }

  let namen = {};
  try { namen = await fetchProfileNames(); } catch (e) {}
  const resultaten = [];
  for (const c of clients) {
    const data = await fetchClientStateFor(c.id, ['prime_history', 'prime_planning', 'prime_wp_done']);
    const signals = calcSignalenVoorKlant(data.prime_history || [], data.prime_planning || [], data.prime_wp_done || {});
    if (signals.length) resultaten.push({ client: c, signals });
  }
  resultaten.sort((a, b) => _signalenErnst(a.signals) - _signalenErnst(b.signals));

  if (!resultaten.length) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:40px 20px;color:var(--muted)">' + t('signalen.none') + '</div>';
    return;
  }

  el.innerHTML = resultaten.map(r => `
    <div class="card" style="cursor:pointer;margin-bottom:12px" onclick="switchToClient('${r.client.id}')">
      <div style="font-weight:700;font-size:15px;margin-bottom:10px;color:var(--charcoal)">${_fbEsc(namen[r.client.id] || r.client.display_name || r.client.id)}</div>
      ${r.signals.map(s => `<div style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:6px;color:var(--charcoal)"><span style="width:8px;height:8px;border-radius:50%;background:${s.kleur};flex-shrink:0"></span>${s.tekst}</div>`).join('')}
    </div>
  `).join('');
}
