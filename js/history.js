// ========== HISTORY ==========
function renderHistory() {
  const total = history.length;
  if (total === 0) {
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

  // Verdeling trainingstypes
  const types = { herstel:0, normaal:0, zwaar:0 };
  history.forEach(h => { if(types[h.trainingType] !== undefined) types[h.trainingType]++; });
  document.getElementById('h-training-types').innerHTML = [
    { key:'herstel', label:'🌊 Herstel', color:'#2980b9' },
    { key:'normaal', label:'💪 Normaal', color:'var(--sage)' },
    { key:'zwaar',   label:'🔥 Zwaar',   color:'var(--accent)' },
  ].map(t => `
    <div style="display:flex;align-items:center;gap:6px;font-size:12px">
      <div style="width:8px;height:8px;border-radius:50%;background:${t.color}"></div>
      <span style="color:var(--muted)">${t.label}:</span>
      <strong>${types[t.key]}x</strong>
      <span style="color:var(--muted)">(${total > 0 ? Math.round(types[t.key]/total*100) : 0}%)</span>
    </div>`).join('');

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

  // ── Dag-voor-dag lijst ──
  const typeColor = { herstel:'#2980b9', normaal:'var(--sage)', zwaar:'var(--accent)' };
  document.getElementById('history-list').innerHTML = history.slice(0,30).map(h => {
    const d = new Date(h.date);
    const dateStr = d.toLocaleDateString('nl-NL', { weekday:'short', day:'numeric', month:'short' });
    const co = h.checkout;
    const ci = h.checkin;
    return `<div class="history-item" style="padding:12px 0;border-bottom:0.5px solid var(--sand-dark);display:grid;grid-template-columns:90px 1fr auto;gap:8px;align-items:start">
      <div style="font-size:12px;font-weight:500">${dateStr}</div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span style="font-size:10px;padding:2px 7px;border-radius:10px;font-weight:500;background:${typeColor[h.trainingType]||'var(--muted)'};color:white" title="Trainingstype">${{herstel:'Herstel',normaal:'Normaal',zwaar:'Zwaar'}[h.trainingType]||''}</span>
        ${co ? `<span style="font-size:10px;padding:2px 7px;border-radius:10px;font-weight:500;background:${co.training===3?'var(--sage)':co.training===2?'#f39c12':'#e74c3c'};color:white" title="Training voltooid">${co.training===3?'✓ Training':co.training===2?'½ Training':'✗ Training'}</span>` : ''}
        ${co ? `<span style="font-size:10px;padding:2px 7px;border-radius:10px;font-weight:500;background:${co.food===3?'var(--sage)':co.food===4?'#e74c3c':co.food===2?'#f39c12':'#e74c3c'};color:white" title="Voeding">${co.food===3?'✓ Voeding':co.food===4?'↑ Voeding':co.food===2?'½ Voeding':'✗ Voeding'}</span>` : ''}
      </div>
      <div style="font-size:12px;color:var(--muted)">
        <span style="font-weight:500;color:var(--charcoal)">Training:</span> ${{herstel:'🌊 Herstel', normaal:'💪 Normaal', zwaar:'🔥 Zwaar'}[h.trainingType]||''}
        ${ci ? `· <span title="Slaap: ${['','Slecht','Matig','Goed','Uitstekend'][ci.sleep]||''}">😴${ci.sleep}</span> <span title="Energie ochtend: ${['','Laag','Matig','Goed','Uitstekend'][ci.energy]||''}">⚡${ci.energy}</span> <span title="Stress: ${['','Veel','Redelijk','Weinig','Geen'][ci.stress]||''}">🧘${ci.stress}</span>` : ''}
      </div>
      <div style="font-size:11px;color:var(--muted);text-align:right">
        ${co ? `<span title="${['','Laag','Matig','Goed','Uitstekend'][co.energy]||''} energieniveau">${['','🪫','😑','⚡','🔥'][co.energy]||''} energie einde dag</span>` : '<span style="color:var(--sand-dark)">geen checkout</span>'}
      </div>
    </div>`;
  }).join('');
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

