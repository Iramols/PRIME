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
  // Zieke dagen vertekenen energie/slaap/stress, dus die tellen niet mee in het gemiddelde.
  const recent7 = history.filter(h => getDagStatus(h.date) !== 'ziek').slice(0, 7);
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
    // Naast de leesbare kwalificatie ("Goed") ook het kale gemiddelde als
    // "3.4/4" eronder, in muted grijs -- zodat je zowel in één oogopslag de
    // kwalificatie ziet als, voor wie het precies wil weten, het exacte
    // gemiddelde.
    el.innerHTML = SCORE_LABELS[metric][tier] +
      '<span style="display:block;font-size:11px;font-weight:400;color:var(--muted);margin-top:2px">' + v + '/4</span>';
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

  // ── Voeding ── Live herberekend uit de daadwerkelijk gelogde data
  // (foodDays, state.js) tegen de huidige doelgrenzen (macroDoelRange() in
  // data.js) -- zelfde aanpak als het "Voeding"-tabblad
  // (renderVoedingVoortgang), i.p.v. de bevroren checkout.food-momentopname
  // van bij het afsluiten van die dag. Zo tonen beide tabbladen altijd
  // hetzelfde percentage, en werkt een latere aanpassing van je
  // caloriegrens (Profiel) ook meteen door in oudere dagen. De dagen die
  // meetellen blijven wel dezelfde als voorheen (elke dag met een
  // check-out), alleen de op-doel/teveel/teweinig-indeling per dag is nu
  // live berekend i.p.v. de oude vaste momentopname.
  const kcalDoelVoeding = getDagDoel().kcal;
  const kcalRangeVoeding = macroDoelRange(kcalDoelVoeding, 'kcal');
  // Alleen werkelijk gegeten (afgevinkt) telt; wat alleen gepland stond telt niet als inname.
  const kcalOpCheckoutDag = h => splitTotals(foodDays[h.date] || []).eaten.kcal;
  const foodDaysHist = metCheckout.filter(h => h.checkout.food > 0 && dagStatusVoedingTelt(h.date));
  const totalVoeding = history.filter(h => dagStatusVoedingTelt(h.date)).length; // ziek/vrij beoordelen we niet
  const opDoel   = foodDaysHist.filter(h => { const k = kcalOpCheckoutDag(h); return k >= kcalRangeVoeding.min && k <= kcalRangeVoeding.max; }).length;
  const teveel   = foodDaysHist.filter(h => kcalOpCheckoutDag(h) > kcalRangeVoeding.max).length;
  const teweinig = foodDaysHist.filter(h => kcalOpCheckoutDag(h) < kcalRangeVoeding.min).length;
  const pctLog   = totalVoeding > 0 ? Math.round(foodDaysHist.length / totalVoeding * 100) : 0;
  document.getElementById('h-food-ondoel').textContent  = foodDaysHist.length > 0 ? Math.round(opDoel/foodDaysHist.length*100)   + '%' : '—';
  document.getElementById('h-food-teveel').textContent  = foodDaysHist.length > 0 ? Math.round(teveel/foodDaysHist.length*100)   + '%' : '—';
  document.getElementById('h-food-teweinig').textContent = foodDaysHist.length > 0 ? Math.round(teweinig/foodDaysHist.length*100) + '%' : '—';
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
  const foodUit = profile.foodEnabled === false; // Voeding staat uit: geen voedingssignalen
  if (!foodUit && pctLog < 40 && total >= 3) signals.push({ kleur:'#f39c12', tekst:t('history.signal.foodRarelyLogged') });
  if (!foodUit && foodDaysHist.length >= 3) {
    const pctOpDoel = opDoel / foodDaysHist.length * 100;
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
  try { renderVoortgangBerichten(); } catch (e) { console.error('renderVoortgangBerichten:', e); }

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

// Gewichtspunten { date, checkin: { weight } } uit logboek, dagrecords en vandaag, oplopend op datum.
let _wgRange = 365; // aantal dagen dat de grafiek toont
function wgKiesRange(n) { _wgRange = n; renderWeightChart(); }
function weightPunten() {
  const per = {};
  history.forEach(h => { if (h.checkin && h.checkin.weight > 0) per[h.date] = h.checkin.weight; });
  if (todayData && todayData.date && todayData.checkin && todayData.checkin.weight > 0) per[todayData.date] = todayData.checkin.weight;
  Object.keys(weightLog).forEach(d => { if (weightLog[d] > 0) per[d] = weightLog[d]; });
  return Object.keys(per).sort().map(d => ({ date: d, checkin: { weight: per[d] } }));
}

function renderWeightChart() {
  const el = document.getElementById('weight-chart');
  if (!el) return;

  // Gewichten uit het logboek (nooit ingekort) aangevuld met wat nog alleen in een dagrecord of vandaag staat; één punt per dag.
  const grens = localDateStr(new Date(Date.now() - _wgRange * 86400000));
  const data = weightPunten().filter(h => h.date >= grens);
  const chips = '<div class="wg-chips">' + [90, 180, 365].map(n =>
    '<button type="button" class="wg-chip' + (n === _wgRange ? ' on' : '') + '" onclick="wgKiesRange(' + n + ')">' + t('weight.range.' + n) + '</button>').join('') + '</div>';

  if (data.length < 2) {
    el.innerHTML = chips + '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">' + t('history.weightChartHint') + '</div>';
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
  const eersteInfo = t('history.firstMeasurementInfo', { kg: weights[0], datum: new Date(data[0].date + 'T12:00:00').toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) });
  const diffColor = diff < 0 ? 'var(--sage)' : diff > 0 ? 'var(--accent)' : 'var(--muted)';

  el.innerHTML = chips + `
    <div style="font-size:12px;color:var(--muted);margin-bottom:10px">
      ${t('history.latestMeasurement')} <strong style="color:var(--charcoal)">${latest} kg</strong>
      ${diffStr ? `&nbsp;<span style="color:${diffColor};font-weight:600">${diffStr} kg</span> ${t('history.vsFirstMeasurement')} ${eersteInfo}` : ''}
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
// (macroDoelRange() in data.js: automatisch ±10%, of de handmatige onder-/
// bovengrens uit Profiel -- dezelfde marge als de "Doel: X–Y kcal"-weergave
// bij Voeding), zodat in één oogopslag te zien is welke dagen binnen of
// buiten die band vielen.
function renderKcalTrendChart() {
  const el = document.getElementById('kcal-trend-chart');
  if (!el) return;

  const _tmVandaag = localDateStr();
  // Alleen werkelijk gegeten (afgevinkt) -- zelfde regel als de macrotrend-grafiek hieronder en de
  // Voeding-voortgang: een plan is geen inname.
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
  const { min: minLimiet, max: maxLimiet } = macroDoelRange(doel.kcal, 'kcal');

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
    .filter(dateStr => foodDays[dateStr] && foodDays[dateStr].some(isEatenItem) && dateStr <= _tmVandaag)
    .sort()
    .slice(-30)
    .map(dateStr => {
      const tot = foodDays[dateStr].filter(isEatenItem).reduce((a,i) => ({
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
      current = dagStatusGatOverbrugd(datums[i-1], datums[i], dagStatus) ? current + 1 : 1;
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
  // Dagen met rust, ziek of vrij tellen niet als "zonder check-in".
  const totaal = Math.round((vandaag - laatste) / (1000*60*60*24));
  let n = 0;
  for (let i = 1; i <= totaal; i++) {
    const d = new Date(laatste); d.setDate(laatste.getDate() + i);
    if (!dagStatusAfwijkend(localDateStr(d))) n++;
  }
  return n;
}


// ========== PROGRAMMA VOORTGANG TAB ==========
function switchHistoryTab(tab) {
  ['stats','voeding','programma'].forEach(t => {
    const btn = document.getElementById('htab-' + t);
    const con = document.getElementById('hstab-content-' + t);
    if (btn) btn.classList.toggle('active', t === tab);
    if (con) con.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'voeding') renderVoedingVoortgang();
  if (tab === 'programma') renderProgrammaVoortgang();
}

// ========== VOEDING VOORTGANG TAB ==========
// Zelfde opzet/stijl als renderProgrammaVoortgang() hieronder (overzichtskaart
// + per-week dagrijen), maar dan voor Voeding. Anders dan Training heeft
// Voeding geen apart "weekplanning"-schema per dag (prime_planning) -- elke
// dag met minstens 1 voedingsitem in foodDays telt gewoon mee, of dat nou een
// dag in het verleden, vandaag, of een voor-later geplande dag is.
function renderVoedingVoortgang() {
  const el = document.getElementById('voeding-voortgang-content');
  if (!el) return;

  // Alleen verleden + vandaag: toekomstige/geplande dagen tellen hier bewust
  // niet mee (was eerder een aparte "Gepland"-teller + rij, op verzoek
  // weggehaald -- deze tab gaat puur over wat je al gegeten/gepland hebt
  // t/m vandaag, niet over wat er nog aankomt).
  const vandaag = localDateStr();
  // Alleen dagen waarop echt iets is gegeten (afgevinkt); wat alleen gepland stond telt niet als inname.
  const dagen = Object.keys(foodDays).filter(d => d <= vandaag && (foodDays[d] || []).some(isEatenItem)).sort();
  if (!dagen.length) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:40px 20px">' +
      '<div style="font-size:40px;margin-bottom:12px">\u{1F37D}️</div>' +
      '<div style="font-family:\'DM Serif Display\',serif;font-size:20px;margin-bottom:8px">' + t('history.noFoodTitle') + '</div>' +
      '<div style="font-size:13px;color:var(--muted)">' + t('history.noFoodHint') + '</div>' +
      '</div>';
    return;
  }

  const doel = getDagDoel();
  // Zelfde marges als de balkjes op Voeding zelf (macroDoelRange in data.js:
  // kcal ±10%, eiwit/koolhydraten/vet ±20%). De groene/rode badge bovenaan
  // een dag gaat puur over calorieën -- Eiwit/Koolh/Vet staan er als losse
  // detailregel bij (zie macroRij hieronder) zodat je altijd ziet wat er
  // wel/niet binnen de marge viel, zonder dat die drie meetellen voor de
  // badge zelf.
  const inRange = (val, doelVal, key) => { const r = macroDoelRange(doelVal, key); return val >= r.min && val <= r.max; };
  const macroDef = [
    { key: 'kcal', label: t('history.macro.cal'), unit: '' },
    { key: 'prot', label: t('history.macro.protein'), unit: 'g' },
    { key: 'carb', label: t('history.macro.carbs'), unit: 'g' },
    { key: 'fat',  label: t('history.macro.fat'), unit: 'g' },
  ];

  const dagenTelt = dagen.filter(d => dagStatusVoedingTelt(d)); // ziek/vrij worden niet beoordeeld
  let doelGehaaldDagen = 0;
  const dagInfo = {};
  const dagPlan = {}; // kcal die die dag wel gepland maar niet afgevinkt was
  dagen.forEach(d => {
    const items = foodDays[d] || [];
    const split = splitTotals(items);
    const tot = { kcal: split.eaten.kcal, prot: split.eaten.prot, carb: split.eaten.carb, fat: split.eaten.fat };
    dagPlan[d] = Math.round(split.planned.kcal);
    if (dagStatusVoedingTelt(d) && inRange(tot.kcal, doel.kcal, 'kcal')) doelGehaaldDagen++;
    dagInfo[d] = tot;
  });
  const pct = dagenTelt.length > 0 ? Math.round(doelGehaaldDagen / dagenTelt.length * 100) : 0;

  const statsHtml =
    '<div class="card" style="margin-bottom:14px">' +
    '<div class="card-label" style="margin-bottom:14px">' + t('history.foodOverview') + '</div>' +
    '<div class="stats-row" style="grid-template-columns:repeat(2,1fr);margin-bottom:10px">' +
      '<div class="stat-card"><div class="stat-val" style="font-size:24px">' + dagenTelt.length + '</div><div class="stat-lbl">' + t('history.stat.logged') + '</div></div>' +
      '<div class="stat-card"><div class="stat-val" style="font-size:24px">' + doelGehaaldDagen + '</div><div class="stat-lbl">' + t('history.stat.goalMet') + '</div></div>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:6px">' + t('history.foodGoalMetSummary', { done: doelGehaaldDagen, total: dagenTelt.length, pct }) + '</div>' +
    '<div style="height:6px;background:var(--sand-dark);border-radius:100px;overflow:hidden">' +
      '<div style="height:100%;background:var(--sage);border-radius:100px;width:' + pct + '%;transition:width 0.5s"></div>' +
    '</div>' +
    '</div>';

  // ── Per week, zelfde groepering als renderProgrammaVoortgang() ──
  const weken = new Map();
  dagen.forEach(d => {
    const dt = new Date(d + 'T00:00:00');
    const wd = dt.getDay();
    const mon = new Date(dt);
    mon.setDate(dt.getDate() - (wd === 0 ? 6 : wd - 1));
    const key = localDateStr(mon);
    if (!weken.has(key)) weken.set(key, []);
    weken.get(key).push(d);
  });

  const wekenHtml = [...weken.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([monStr, dagenInWeek]) => {
    const mon = new Date(monStr + 'T00:00:00');
    const zo  = new Date(mon); zo.setDate(mon.getDate() + 6);
    const label = mon.toLocaleDateString(dateLocale(),{day:'numeric',month:'short'}) + ' – ' +
                  zo.toLocaleDateString(dateLocale(),{day:'numeric',month:'short'});

    const rijen = [...dagenInWeek].sort().map(d => {
      const dt = new Date(d + 'T00:00:00');
      const tot = dagInfo[d];
      const isVandaag = d === vandaag;
      const isVerleden = d < vandaag;
      const kcalTekst = Math.round(tot.kcal) + ' kcal' + (dagPlan[d] > 0 ? ' <span style="font-size:10px;font-weight:400;color:var(--muted)">' + t('history.plannedNotTicked', { kcal: dagPlan[d] }) + '</span>' : '');
      const geslaagd = inRange(tot.kcal, doel.kcal, 'kcal');
      const bg = geslaagd ? 'var(--sage)' : '#c0392b';
      const telt = dagStatusVoedingTelt(d);
      const badge = !telt ? dagStatusBadgeHtml(getDagStatus(d)) : '<span style="font-size:11px;padding:2px 9px;border-radius:10px;font-weight:600;background:' + bg + ';color:white;flex-shrink:0">' +
        (geslaagd ? '✓' : '✗') + ' ' + t('history.foodGoalBadge') + '</span>';

      const macroRij = macroDef.map(m => {
        const doelVal = doel[m.key];
        const { min: rmin, max: rmax } = macroDoelRange(doelVal, m.key);
        const val = Math.round(tot[m.key]);
        const ok = inRange(tot[m.key], doelVal, m.key);
        const kleur = ok ? 'var(--sage)' : '#c0392b';
        return '<div style="font-size:10px;color:' + kleur + '">' + m.label + ' ' + (ok ? '✓' : '✗') +
          '<br><span style="color:var(--muted)">' + val + m.unit + ' (' + rmin + '–' + rmax + ')</span></div>';
      }).join('');

      return '<div style="padding:10px 0;border-bottom:0.5px solid var(--sand-dark);opacity:' + (isVerleden && !isVandaag ? '0.55' : '1') + '">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
        '<div style="width:26px;font-size:11px;font-weight:700;color:var(--muted);flex-shrink:0">' + wpGetDayKort(dt.getDay()) + '</div>' +
        '<div style="font-size:11px;color:var(--muted);width:54px;flex-shrink:0">' + dt.toLocaleDateString(dateLocale(),{day:'numeric',month:'short'}) + '</div>' +
        '<span style="font-size:16px;flex-shrink:0">\u{1F37D}️</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13px;font-weight:' + (isVandaag ? '600' : '400') + ';color:' + (isVandaag ? 'var(--sage)' : 'var(--charcoal)') + '">' +
            kcalTekst +
            (isVandaag ? ' <span style="font-size:10px;background:var(--sage);color:white;padding:2px 7px;border-radius:8px;vertical-align:middle">' + t('weekplan.today') + '</span>' : '') +
          '</div>' +
        '</div>' +
        badge +
        '</div>' +
        (telt ? '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding-left:90px">' + macroRij + '</div>' : '') +
        '</div>';
    }).join('');

    return '<div style="margin-bottom:18px">' +
      '<div style="font-size:11px;font-weight:700;color:var(--sage);letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px">' + label + '</div>' +
      rijen +
      '</div>';
  }).join('');

  el.innerHTML = statsHtml + '<div class="card">' + wekenHtml + '</div>';
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

  const statsHtml =
    '<div class="card" style="margin-bottom:14px">' +
    '<div class="card-label" style="margin-bottom:14px">' + t('history.programOverview') + '</div>' +
    '<div class="stats-row" style="grid-template-columns:repeat(2,1fr);margin-bottom:14px">' +
      '<div class="stat-card"><div class="stat-val" style="font-size:24px">' + verledenCount + '</div><div class="stat-lbl">' + t('history.stat.past') + '</div></div>' +
      '<div class="stat-card"><div class="stat-val" style="font-size:24px">' + volledigDagen + '</div><div class="stat-lbl">' + t('history.stat.complete') + '</div></div>' +
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
      if (!dagStatusTrainingTelt(item.date)) {
        badge = dagStatusBadgeHtml(getDagStatus(item.date)); // rust/ziek/vrij: niet als gemist tonen
      } else if (total > 0) {
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
  for (let i = 0; i < HISTORY_MAX_DAGEN; i++) { // zo ver terug als history bewaard wordt (vroeger vast 60 dagen)
    if (dates.includes(check)) { streak++; }
    else if (i > 0 && !dagStatusAfwijkend(check)) break; // rust-, ziekte- of vrije dag onderbreekt de reeks niet
    const d = new Date(check + 'T00:00:00'); d.setDate(d.getDate() - 1);
    check = localDateStr(d);
  }
  return streak;
}

// Check-ins = aantal echt afgesloten dagen (history.length) -- vroeger
// stond hier een onvoorwaardelijke "+ 1" (bedoeld om een nog niet
// afgesloten "vandaag" vast mee te tellen), maar die telde ook mee als er
// nog NOOIT was ingecheckt, waardoor een gloednieuw account al "1"
// check-in liet zien. Er bestond daarnaast nog een losse, bijna
// identieke updateStats() (zonder de +1, wel het juiste getal) die na
// checkout werd aangeroepen -- maar renderHome() riep bij de eerstvolgende
// Dashboard-weergave alweer deze functie (mét de +1) aan, dus die correcte
// waarde was toch meteen weer overschreven. Nu nog maar één functie.
function updateStreak() {
  const streak = calcStreak();
  document.getElementById('s-streak').textContent = streak;
  document.getElementById('s-checkins').textContent = history.length;
  const energyAvg = history.length > 0 ? Math.round(history.slice(0,7).reduce((a,h) => a + (h.checkout?.energy||0), 0) / Math.min(7, history.length)) : 0;
  document.getElementById('s-avg').textContent = energyAvg > 0 ? ['','🪫','😑','⚡','🔥'][energyAvg] : '—';
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
function calcTrainingCompletionVoorKlant(geplanningArr, wpDoneObj, statusObj) {
  const vandaag = localDateStr();
  const verleden = (geplanningArr || []).filter(p => p.date < vandaag && dagStatusVan(statusObj, p.date) === 'normaal');
  let volledigDagen = 0;
  verleden.forEach(p => {
    if (p.oefSnapshotKeys == null || !p.oefSnapshotKeys.length) return;
    const doneRaw = (wpDoneObj && wpDoneObj[p.date]) || [];
    const done = doneRaw.filter(k => p.oefSnapshotKeys.includes(k));
    if (done.length >= p.oefSnapshotKeys.length) volledigDagen++;
  });
  return { verledenCount: verleden.length, volledigDagen };
}

function calcSignalenVoorKlant(hist, geplanningArr, wpDoneObj, foodDaysObj, profielObj, statusObj) {
  const signals = [];
  hist = (hist || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const total = hist.length;
  if (!total) return signals;
  const vandaag = localDateStr();

  let streak = 0;
  {
    const dates = hist.map(h => h.date);
    let check = vandaag;
    for (let i = 0; i < HISTORY_MAX_DAGEN; i++) {
      if (dates.includes(check)) streak++;
      else if (i > 0 && dagStatusVan(statusObj, check) === 'normaal') break; // rust/ziek/vrij onderbreekt niet
      const d = new Date(check + 'T00:00:00'); d.setDate(d.getDate() - 1);
      check = localDateStr(d);
    }
  }
  if (streak === 0) signals.push({ kleur: '#E24B4A', tekst: t('history.signal.streakBroken') });

  const laatste = new Date(hist[0].date + 'T00:00:00');
  const vd = new Date(vandaag + 'T00:00:00');
  let dagenWeg = 0;
  for (let i = 1; i <= Math.round((vd - laatste) / (1000 * 60 * 60 * 24)); i++) {
    const dd = new Date(laatste); dd.setDate(laatste.getDate() + i);
    if (dagStatusVan(statusObj, localDateStr(dd)) === 'normaal') dagenWeg++; // dagen met rust/ziek/vrij tellen niet
  }
  if (dagenWeg >= 2) signals.push({ kleur: '#E24B4A', tekst: t('history.signal.daysNoCheckin', { n: dagenWeg }) });

  const recent7 = hist.filter(h => dagStatusVan(statusObj, h.date) !== 'ziek').slice(0, 7);
  const avg = key => {
    const vals = recent7.map(h => h.checkin?.[key]).filter(v => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const energie = avg('energy'), stress = avg('stress');
  if (energie !== null && energie < 2.0) signals.push({ kleur: '#f39c12', tekst: t('history.signal.lowEnergy') });
  if (stress !== null && stress < 2.0) signals.push({ kleur: '#f39c12', tekst: t('history.signal.highStress') });

  const { verledenCount, volledigDagen } = calcTrainingCompletionVoorKlant(geplanningArr, wpDoneObj, statusObj);
  if (verledenCount >= 3 && volledigDagen / verledenCount < 0.4) signals.push({ kleur: '#f39c12', tekst: t('history.signal.lowTrainingCompletion') });

  // Live herberekend uit de gelogde data van DEZE klant tegen ZIJN/HAAR
  // eigen doelgrenzen -- zelfde aanpak als renderHistory() (het eigen
  // Statistieken-tabblad), i.p.v. de bevroren checkout.food-momentopname.
  // profielOverride op macroDoelRange() is hier nodig: de globale `profile`
  // is die van de klant die de coach nu toevallig bekijkt, niet van elke
  // klant in dit Signalen-overzicht.
  const foodDaysKlant = foodDaysObj || {};
  const kcalDoelKlant = (profielObj && profielObj.calorieBehoefte && profielObj.calorieBehoefte > 0) ? profielObj.calorieBehoefte : 2000;
  const kcalRangeKlant = macroDoelRange(kcalDoelKlant, 'kcal', profielObj || {});
  const kcalOpCheckoutDagKlant = h => splitTotals(foodDaysKlant[h.date] || []).eaten.kcal; // alleen werkelijk gegeten
  const metCheckout = hist.filter(h => h.checkout);
  const foodDaysArr = metCheckout.filter(h => h.checkout.food > 0 && ['normaal', 'rust'].indexOf(dagStatusVan(statusObj, h.date)) >= 0);
  const totalVoedingKlant = hist.filter(h => ['normaal', 'rust'].indexOf(dagStatusVan(statusObj, h.date)) >= 0).length;
  const opDoel = foodDaysArr.filter(h => { const k = kcalOpCheckoutDagKlant(h); return k >= kcalRangeKlant.min && k <= kcalRangeKlant.max; }).length;
  const pctLog = totalVoedingKlant > 0 ? foodDaysArr.length / totalVoedingKlant * 100 : 0;
  const foodUitKlant = !!(profielObj && profielObj.foodEnabled === false); // Voeding staat uit voor deze klant: geen voedingssignalen
  if (!foodUitKlant && pctLog < 40 && total >= 3) signals.push({ kleur: '#f39c12', tekst: t('history.signal.foodRarelyLogged') });
  if (!foodUitKlant && foodDaysArr.length >= 3) {
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
      cur = dagStatusGatOverbrugd(datums[i-1], datums[i], statusObj) ? cur + 1 : 1;
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
// Overzicht van ALLE deelnemers met wanneer ze akkoord zijn gegaan (of nog niet).
async function renderConsentOverview() {
  const el = document.getElementById('consent-overzicht-content');
  if (!el) return;
  // Zie de toelichting bij renderSignalenTab(): dit gaat over andere klanten,
  // dus geen offline-vangnet mogelijk -- snel en duidelijk melden i.p.v. lang
  // laten wachten.
  if (await probeOfflineNow()) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:24px;color:var(--muted)">' + t('signalen.offline') + '</div>';
    return;
  }
  let clients = [], namen = {}, consents = {};
  try { clients = await fetchClientList(); } catch (e) { return; }
  try { namen = await fetchProfileNames(); } catch (e) {}
  try { consents = await fetchConsents(); } catch (e) {}
  const head = '<div style="font-family:\'DM Serif Display\',serif;font-size:20px;margin-bottom:12px">' + t('consent.coach.title') + '</div>';
  if (!clients.length) { el.innerHTML = ''; return; }
  el.innerHTML = head + '<div class="card">' + clients.map(c => {
    const naam = _fbEsc(namen[c.id] || c.display_name || c.id);
    const cs = consents[c.id];
    let status;
    if (cs) {
      const d = new Date(cs.date);
      const oud = cs.version < CONSENT_VERSION;
      status = '<span style="color:' + (oud ? '#c0392b' : 'var(--sage)') + '">' + t('consent.coach.agreed', { date: d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) }) + ' · v' + _fbEsc(cs.version) + (oud ? ' ' + t('consent.coach.outdated') : '') + '</span>';
    } else {
      status = '<span style="color:var(--coach-only);font-weight:600">' + t('consent.coach.none') + '</span>';
    }
    return '<div class="fb-item" style="display:flex;justify-content:space-between;gap:10px;font-size:13px"><b>' + naam + '</b>' + status + '</div>';
  }).join('') + '</div>';
}

// Rendert twee aparte lijsten uit dezelfde tabel: gewone feedback (idee, tip,
// iets dat niet werkt) en, apart, verzoeken tot verwijdering van gegevens.
function _fbItemsHtml(items, nameOf, kindLabel, reactieVan, antwoordVan) {
  return '<div class="card">' + items.map(f => {
    const d = new Date(f.created_at);
    return '<div class="fb-item" style="' + (f.handled ? 'opacity:0.5' : '') + '">' +
      '<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--muted);margin-bottom:4px">' +
        '<span><b style="color:var(--charcoal)">' + _fbEsc(nameOf(f.client_id)) + '</b> · ' + d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) + '</span>' +
        (kindLabel ? '<span class="fb-soort fb-soort-' + _fbEsc(f.kind) + '">' + _fbEsc(kindLabel[f.kind] || f.kind) + '</span>' : '') +
      '</div>' +
      '<div style="font-size:14px;line-height:1.5;margin-bottom:8px;white-space:pre-wrap">' + _fbEsc(f.message) + '</div>' +
      '<div style="display:flex;gap:8px">' +
        '<button class="btn-sm" onclick="toggleFeedbackHandled(\'' + f.id + '\',' + (!f.handled) + ')">' + (f.handled ? t('feedback.coach.reopen') : t('feedback.coach.handled')) + '</button>' +
        '<button class="btn-sm" onclick="removeFeedback(\'' + f.id + '\')">' + t('feedback.coach.delete') + '</button>' +
      '</div>' + (reactieVan ? msgReactieBlokHtml(f.client_id, 'fb:' + f.id, 'fb', f.message, reactieVan(f.client_id), antwoordVan ? antwoordVan(f.client_id) : {}) : '') + '</div>';
  }).join('') + '</div>';
}
async function renderFeedbackList() {
  const el = document.getElementById('feedback-overzicht-content');
  const elDel = document.getElementById('delete-requests-content');
  if (!el && !elDel) return;
  const kop = key => '<div style="font-family:\'DM Serif Display\',serif;font-size:20px;margin-bottom:12px">' + t(key) + '</div>';
  // Zie de toelichting bij renderSignalenTab(): geen offline-vangnet mogelijk
  // voor andermans feedback/verwijderverzoeken -- snel en duidelijk melden.
  if (await probeOfflineNow()) {
    const offlineHtml = '<div class="card" style="text-align:center;padding:24px;color:var(--muted)">' + t('signalen.offline') + '</div>';
    if (el) el.innerHTML = kop('feedback.coach.title') + offlineHtml;
    if (elDel) elDel.innerHTML = kop('deleteRequests.title') + offlineHtml;
    return;
  }
  let res;
  try { res = await fetchFeedbackList(); } catch (e) { res = { data: [], error: e }; }
  const leeg = key => '<div class="card" style="text-align:center;color:var(--muted);padding:24px">' + t(key) + '</div>';
  if (res.error) {
    const melding = '<div class="card" style="font-size:13px;color:var(--muted)">' + t('feedback.coach.noTable') + '</div>';
    if (el) el.innerHTML = kop('feedback.coach.title') + melding;
    if (elDel) elDel.innerHTML = kop('deleteRequests.title') + melding;
    return;
  }
  let clients = [], namen = {};
  try { clients = await fetchClientList(); } catch (e) {}
  try { namen = await fetchProfileNames(); } catch (e) {}
  const nameOf = id => namen[id] || (clients.find(c => c.id === id) || {}).display_name || 'Coach';
  const kindLabel = { bug: t('feedback.kind.bug'), idea: t('feedback.kind.idea'), other: t('feedback.kind.other') };
  let reactieBulk = null;
  try { reactieBulk = await msgCoachBulk(false); } catch (e) { console.error('msgCoachBulk:', e); }
  const reactieVan = reactieBulk ? (cid => reactieBulk.reacties[cid] || {}) : null;
  const antwoordVan = reactieBulk ? (cid => reactieBulk.antwoorden[cid] || {}) : null;
  const verzoeken = res.data.filter(f => f.kind === 'delete_request');
  const feedback = res.data.filter(f => f.kind !== 'delete_request');
  if (elDel) elDel.innerHTML = kop('deleteRequests.title') + (verzoeken.length ? _fbItemsHtml(verzoeken, nameOf, null) : leeg('deleteRequests.none'));
  if (el) el.innerHTML = kop('feedback.coach.title') + (feedback.length ? _fbItemsHtml(feedback, nameOf, kindLabel, reactieVan, antwoordVan) : leeg('feedback.coach.none'));
}
async function toggleFeedbackHandled(id, handled) {
  const err = await setFeedbackHandled(id, handled);
  if (err) {
    console.error('toggleFeedbackHandled:', err);
    // Zonder dit leek de knop niets te doen: de lijst bleef ongewijzigd
    // (de wijziging was immers niet aangekomen), maar er verscheen nergens
    // een melding waarom.
    try { showToast(t('feedback.coach.actionFailed'), true); } catch (e) {}
  }
  renderFeedbackList();
}
async function removeFeedback(id) {
  if (!confirm(t('feedback.coach.deleteConfirm'))) return;
  const err = await deleteFeedbackRow(id);
  if (err) {
    console.error('removeFeedback:', err);
    try { showToast(t('feedback.coach.actionFailed'), true); } catch (e) {}
  }
  renderFeedbackList();
}

// Toelichtingen van klanten (alleen coach). De gelezen-status staat in de cloud (zie berichten.js); de oude, per apparaat bewaarde
// markering blijft als vangnet meetellen.
function _noteGelezen() { try { return JSON.parse(localStorage.getItem('prime_notes_gelezen') || '{}'); } catch (e) { return {}; } }
function _notesVoorCoach(clientId, notes, reactiesObj, antwObj, alles) {
  const grens = alles ? '' : localDateStr(new Date(Date.now() - 14 * 86400000));
  return Object.keys(notes || {}).filter(function(d) { return d >= grens && notes[d] && notes[d].text && !(((reactiesObj && reactiesObj.verborgen || {})['note:' + d]) >= (notes[d].ts || 0)); }).sort().reverse().slice(0, alles ? 400 : 5).map(function(d) {
    const ts = notes[d].ts || 0;
    return { date: d, text: notes[d].text, ts: ts, nieuw: msgNoteNieuw(clientId, d, ts, reactiesObj, antwObj) };
  });
}
function _noteRijHtml(clientId, n, reactiesObj, antwObj) {
  const dag = new Date(n.date + 'T12:00:00').toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
  const tijd = n.ts ? ', ' + new Date(n.ts).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) : '';
  return '<div class="note-coachrij' + (n.nieuw ? ' nieuw' : '') + '" onclick="event.stopPropagation()">' +
    '<div class="note-coachtekst">💬 ' + _fbEsc(n.text).replace(/\n/g, '<br>') + '</div>' +
    '<div class="note-coachmeta"><span>' + _fbEsc(dag + tijd) + '</span>' +
    '<span class="note-acties"><button type="button" class="note-gelezen" onclick="noteGelezenToggle(event, \'' + clientId + '\', \'' + n.date + '\', ' + n.ts + ', this)">' +
    t(n.nieuw ? 'note.coach.markRead' : 'note.coach.read') + '</button>' +
    '<button type="button" class="note-gelezen note-del" onclick="noteVerberg(event, \'' + clientId + '\', \'' + n.date + '\', this)">' + t('note.coach.delete') + '</button></span></div>' +
    msgReactieBlokHtml(clientId, 'note:' + n.date, 'note', n.text, reactiesObj || {}, antwObj || {}) + '</div>';
}
async function noteGelezenToggle(ev, clientId, datum, ts, knop) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  const rij = knop && knop.closest('.note-coachrij');
  if (!rij) return;
  const wordtGelezen = rij.classList.contains('nieuw'); // nu ongelezen: wordt gelezen
  rij.classList.toggle('nieuw', !wordtGelezen);
  knop.textContent = t(wordtGelezen ? 'note.coach.read' : 'note.coach.markRead');
  try {
    await msgGelezenZet(clientId, 'note:' + datum, ts, wordtGelezen);
  } catch (e) {
    console.error('noteGelezenToggle:', e);
    rij.classList.toggle('nieuw', wordtGelezen); // terugdraaien
    knop.textContent = t(wordtGelezen ? 'note.coach.markRead' : 'note.coach.read');
    try { showToast(t('msg.coach.failed'), true); } catch (e2) { /* geen melding */ }
  }
}

// Coach: een toelichting van een klant verwijderen. Leest de toelichtingen van die klant vers uit de cloud, haalt alleen
// deze dag eruit en schrijft het terug (zoals Config doet met het profiel).
async function noteVerwijder(ev, clientId, datum, knop) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  if (!isPrimeCoach()) return;
  const dag = new Date(datum + 'T12:00:00').toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long' });
  if (!confirm(t('note.coach.confirmDelete', { datum: dag }))) return;
  if (await probeOfflineNow()) { try { showToast(t('config.offline'), true); } catch (e) {} return; }
  if (knop) knop.disabled = true;
  try {
    const data = await fetchClientStateFor(clientId, ['prime_notes']);
    const notes = Object.assign({}, data.prime_notes || {});
    delete notes[datum];
    const res = await getSupabase().from('client_state').upsert({ client_id: clientId, key: 'prime_notes', value: notes, updated_at: new Date().toISOString() });
    if (res.error) throw res.error;
    if (clientId === activeClientId) { // deze klant staat open in deze sessie: ook lokaal bijwerken
      dagNotes = notes;
      syncSet('prime_notes', dagNotes);
      try { renderNoteUI(true); } catch (e) { console.error(e); }
    }
    const gelezen = _noteGelezen();
    delete gelezen[clientId + '|' + datum];
    try { localStorage.setItem('prime_notes_gelezen', JSON.stringify(gelezen)); } catch (e) {}
    const rij = knop && knop.closest('.note-coachrij');
    const kaart = rij && rij.closest('.card');
    if (rij) rij.remove();
    // Een klant zonder signalen en zonder toelichtingen hoort niet meer in de lijst.
    if (kaart && !kaart.querySelector('.note-coachrij') && !kaart.querySelector('[data-signaal]')) kaart.remove();
    try { showToast(t('note.coach.deleted')); } catch (e) {}
    const hs = document.getElementById('screen-history');
    if (hs && hs.classList.contains('active') && typeof renderVoortgangBerichten === 'function') renderVoortgangBerichten();
  } catch (e) {
    console.error('noteVerwijder:', e);
    if (knop) knop.disabled = false;
    try { showToast(t('config.saveFailed'), true); } catch (e2) {}
  }
}

async function renderSignalenTab() {
  const el = document.getElementById('signalen-overzicht-content');
  if (!el) return;
  // Signalen toont live gegevens van ANDERE klanten (niet je eigen,
  // offline-gecachete data) -- dat kan per definitie niet zonder internet.
  // Eerst één keer snel testen (probeOffline(), fase 1) i.p.v. hier en in elk
  // van de aparte fetch-aanroepen hieronder de volle netwerk-timeout af te
  // wachten, dat gaf eerder een lange wachttijd bij meerdere klanten.
  if (await probeOfflineNow()) {
    const offlineHtml = '<div class="card" style="text-align:center;padding:24px;color:var(--muted)">' + t('signalen.offline') + '</div>';
    document.getElementById('consent-overzicht-content') && (document.getElementById('consent-overzicht-content').innerHTML = offlineHtml);
    document.getElementById('feedback-overzicht-content') && (document.getElementById('feedback-overzicht-content').innerHTML = offlineHtml);
    document.getElementById('delete-requests-content') && (document.getElementById('delete-requests-content').innerHTML = offlineHtml);
    el.innerHTML = offlineHtml;
    const elToel = document.getElementById('sig-toelichting-content');
    if (elToel) elToel.innerHTML = offlineHtml;
    return;
  }
  renderConsentOverview();
  renderFeedbackList();
  coachTellingVernieuw(true); // badge en balk bovenaan
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">' + t('signalen.loading') + '</div>';

  let clients;
  try { clients = await fetchClientList(); }
  catch (e) { console.error('renderSignalenTab, fetchClientList:', e); el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">' + t('signalen.loadError') + '</div>'; return; }

  let namen = {};
  try { namen = await fetchProfileNames(); } catch (e) {}
  const resultaten = [];
  for (const c of clients) {
    const data = await fetchClientStateFor(c.id, ['prime_history', 'prime_planning', 'prime_wp_done', 'prime_food_days', 'prime_profile', 'prime_dagstatus', 'prime_notes', 'prime_coach_reacties', 'prime_klant_antwoorden']);
    const signals = calcSignalenVoorKlant(data.prime_history || [], data.prime_planning || [], data.prime_wp_done || {}, data.prime_food_days || {}, data.prime_profile || {}, data.prime_dagstatus || {});
    const reacties = data.prime_coach_reacties || {};
    const antw = data.prime_klant_antwoorden || {};
    resultaten.push({ client: c, signals, notesRaw: data.prime_notes || {}, reacties, antw });
  }
  _sigData = { resultaten, namen };
  sigRenderTrends();
  sigRenderToelichting();
}

// ========== SIGNALEN IN TABS ==========
let _sigTab = 'trends';
let _sigToonAlles = false;
let _sigData = null;
const SIG_TABS = ['trends', 'toelichting', 'feedback', 'toestemming', 'verwijder', 'export'];

function switchSignalenTab(tab) {
  if (SIG_TABS.indexOf(tab) < 0) tab = 'trends';
  _sigTab = tab;
  SIG_TABS.forEach(function(k) {
    const btn = document.getElementById('sigbtn-' + k);
    const pane = document.getElementById('sigpane-' + k);
    if (btn) btn.classList.toggle('active', k === tab);
    if (pane) pane.style.display = k === tab ? 'block' : 'none';
  });
}
// 💬-bolletje van de coach: naar het tabblad waar iets nieuws staat
function sigOpenMeestRelevant() {
  const d = (typeof _coachDetail !== 'undefined' && _coachDetail) || {};
  if ((d.notes || 0) + (d.antw || 0) > 0) switchSignalenTab('toelichting');
  else if ((d.feedback || 0) > 0) switchSignalenTab('feedback');
  else if ((d.verwijder || 0) > 0) switchSignalenTab('verwijder');
}
function sigToonAllesToggle() {
  _sigToonAlles = !_sigToonAlles;
  sigRenderToelichting();
}

function sigRenderTrends() {
  const el = document.getElementById('signalen-overzicht-content');
  if (!el || !_sigData) return;
  const namen = _sigData.namen;
  const lijst = _sigData.resultaten.filter(r => r.signals.length).sort((a, b) => _signalenErnst(a.signals) - _signalenErnst(b.signals));
  if (!lijst.length) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:40px 20px;color:var(--muted)">' + t('signalen.none') + '</div>';
    return;
  }
  el.innerHTML = lijst.map(r => `
    <div class="card" style="cursor:pointer;margin-bottom:12px" onclick="switchToClient('${r.client.id}')">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px"><div style="font-weight:700;font-size:15px;color:var(--charcoal)">${_fbEsc(namen[r.client.id] || r.client.display_name || r.client.id)}</div></div>
      ${r.signals.map(s => `<div data-signaal="1" style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:6px;color:var(--charcoal)"><span style="width:8px;height:8px;border-radius:50%;background:${s.kleur};flex-shrink:0"></span>${s.tekst}</div>`).join('')}
    </div>
  `).join('');
}

// Tabblad Toelichting voor coach: per klant de toelichtingen en gesprekken.
// Standaard: nieuw en lopend (toelichtingen van 14 dagen, eigen berichten van 30 dagen, gesprekken met een ongelezen antwoord);
// met "Toon alles" ook de oudere die niet door jou zijn verwijderd.
function sigRenderToelichting() {
  const el = document.getElementById('sig-toelichting-content');
  if (!el || !_sigData) return;
  const alles = _sigToonAlles;
  const grensMsg = Date.now() - 30 * 86400000;
  const groepen = [];
  _sigData.resultaten.forEach(function(r) {
    const reacties = r.reacties, antw = r.antw;
    const notes = _notesVoorCoach(r.client.id, r.notesRaw, reacties, antw, alles);
    const getoond = notes.map(n => 'note:' + n.date);
    const draden = msgGespreksIds(reacties).concat(Object.keys(antw)).filter((id, i, arr) => arr.indexOf(id) === i).filter(id => {
      if (getoond.indexOf(id) >= 0) return false; // staat al als toelichting
      const draad = msgDraad(reacties, antw, id, reacties.verborgen);
      if (!draad.length) return false;
      if (alles) return true;
      const laatsteKlant = msgLaatsteTs(draad, 'klant');
      const ongelezenAntwoord = laatsteKlant > ((reacties.gelezen || {})[id] || 0);
      return ongelezenAntwoord || (id.indexOf('msg:') === 0 && msgLaatsteTs(draad) >= grensMsg);
    });
    if (!notes.length && !draden.length) return;
    const nieuw = notes.some(n => n.nieuw) || draden.some(id => msgLaatsteTs(msgDraad(reacties, antw, id, reacties.verborgen), 'klant') > ((reacties.gelezen || {})[id] || 0));
    let laatste = 0;
    notes.forEach(n => { laatste = Math.max(laatste, n.ts || 0); });
    draden.forEach(id => { laatste = Math.max(laatste, msgLaatsteTs(msgDraad(reacties, antw, id, reacties.verborgen)) || 0); });
    groepen.push({ r, notes, draden, nieuw, laatste });
  });
  groepen.sort((a, b) => (a.nieuw === b.nieuw ? b.laatste - a.laatste : (a.nieuw ? -1 : 1)));
  const namen = _sigData.namen;
  const knop = '<div class="sig-filter"><button type="button" class="btn-sm" onclick="sigToonAllesToggle()">' + t(alles ? 'sig.toel.showNew' : 'sig.toel.showAll') + '</button></div>';
  if (!groepen.length) {
    el.innerHTML = knop + '<div class="card" style="text-align:center;padding:40px 20px;color:var(--muted)">' + t('sig.toel.none') + '</div>';
    return;
  }
  el.innerHTML = knop + groepen.map(g => `
    <div class="card" style="cursor:pointer;margin-bottom:12px" onclick="switchToClient('${g.r.client.id}')">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px"><div style="font-weight:700;font-size:15px;color:var(--charcoal)">${_fbEsc(namen[g.r.client.id] || g.r.client.display_name || g.r.client.id)}</div><button type="button" class="btn-sm coach-only-btn" style="flex-shrink:0" onclick="event.stopPropagation();msgNieuwOpen('${g.r.client.id}')">✉️</button></div>
      ${g.notes.map(n => _noteRijHtml(g.r.client.id, n, g.r.reacties, g.r.antw)).join('')}
      ${g.draden.map(id => msgDraadKaartHtml(g.r.client.id, id, g.r.reacties, g.r.antw)).join('')}
    </div>
  `).join('');
}
