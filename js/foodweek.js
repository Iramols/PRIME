// ========== VOEDING WEEKPLANNING ==========
// Weekoverzicht van gelogde voeding: per dag kcal/eiwit/koolh/vet zien
// (als er al iets ingevuld is) en voor elke dag van de week — verleden,
// vandaag of toekomst — voeding kunnen toevoegen. Herbruikt de datum-
// helpers uit weekplanning.js (wpStr/wpDate/wpMaandagVanaf/wpDagLang),
// die eerder in APP_SCRIPTS geladen wordt.
let fwWeekOffset = 0; // 0 = huidige week, +1 = volgende week, -1 = vorige week
let fwOpenDag = null; // datumstring van de uitgeklapte dag-kaart, of null

function fwStartOfWeek(offset) {
  const mon = wpMaandagVanaf(new Date());
  const d = new Date(mon);
  d.setDate(mon.getDate() + offset * 7);
  return d;
}

// ISO-8601 weeknummer.
function fwWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function fwDayTotals(dateStr) {
  const items = foodDays[dateStr] || [];
  return items.reduce((a, i) => ({
    kcal: a.kcal + i.kcal, prot: a.prot + i.prot, carb: a.carb + i.carb, fat: a.fat + i.fat
  }), { kcal: 0, prot: 0, carb: 0, fat: 0 });
}

function renderFoodWeek() {
  const el = document.getElementById('foodweek-content');
  if (!el) return;

  const monday = fwStartOfWeek(fwWeekOffset);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const weekNum = fwWeekNumber(monday);
  const todayStr = fdTodayStr();
  const rangeLabel =
    monday.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) + ' – ' +
    sunday.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

  let html = `<div class="card" style="margin-bottom:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
      <button class="btn-sm" onclick="fwChangeWeek(-1)" style="padding:8px 14px">←</button>
      <div style="text-align:center">
        <div class="card-label" style="margin-bottom:2px">${t('foodweek.weekLabel', { n: weekNum })}</div>
        <div style="font-size:13px;color:var(--muted)">${rangeLabel}</div>
      </div>
      <button class="btn-sm" onclick="fwChangeWeek(1)" style="padding:8px 14px">→</button>
    </div>
    ${fwWeekOffset !== 0 ? `<div style="text-align:center;margin-top:10px">
      <button class="btn-sm" onclick="fwGoToday()">${t('foodweek.backToThisWeek')}</button>
    </div>` : ''}
  </div>`;

  html += '<div style="display:flex;flex-direction:column;gap:10px">';
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = wpStr(d);
    const tot = fwDayTotals(dateStr);
    const hasData = (foodDays[dateStr] || []).length > 0;
    const isToday = dateStr === todayStr;
    const isOpen = fwOpenDag === dateStr;
    html += fwBouwDagKaart(dateStr, d, i, tot, hasData, isToday, isOpen);
  }
  html += '</div>';

  el.innerHTML = html;
}

function fwChangeWeek(delta) {
  fwWeekOffset += delta;
  fwOpenDag = null;
  renderFoodWeek();
}

function fwGoToday() {
  fwWeekOffset = 0;
  fwOpenDag = null;
  renderFoodWeek();
}

function fwBouwDagKaart(dateStr, d, dayIdx, tot, hasData, isToday, isOpen) {
  const dagNaam = wpDagLang(dayIdx);
  const dateLabel = d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

  const header = `
    <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer" onclick="fwToggleDag('${dateStr}')">
      <div style="width:76px;flex-shrink:0">
        <div style="font-size:12px;font-weight:700;color:${isToday ? 'var(--sage)' : 'var(--charcoal)'}">${dagNaam}</div>
        <div style="font-size:11px;color:var(--muted)">${dateLabel}</div>
      </div>
      ${isToday ? `<span style="font-size:10px;background:var(--sage);color:white;padding:2px 7px;border-radius:8px;flex-shrink:0">${t('weekplan.today')}</span>` : ''}
      <div style="flex:1"></div>
      ${hasData
        ? `<div style="text-align:right">
             <div style="font-family:'DM Serif Display',serif;font-size:16px">${Math.round(tot.kcal)} kcal</div>
             <div style="font-size:10px;color:var(--muted)">${t('food.macroAbbr.protein')}${Math.round(tot.prot)} · ${t('food.macroAbbr.carbs')}${Math.round(tot.carb)} · ${t('food.macroAbbr.fat')}${Math.round(tot.fat)}</div>
           </div>`
        : `<div style="font-size:12px;color:var(--muted)">${t('foodweek.notFilledIn')}</div>`}
      <span style="font-size:11px;color:var(--muted);margin-left:8px;flex-shrink:0">${isOpen ? '▴' : '▾'}</span>
    </div>`;

  const items = foodDays[dateStr] || [];
  const itemsHtml = items.length
    ? items.map(item => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:0.5px solid var(--sand-dark)">
          <div style="flex:1;font-size:12px;color:var(--charcoal)">${logItemDisplayName(item)}</div>
          <div style="font-size:11px;color:var(--muted);white-space:nowrap">${item.type === 'meal' ? '' : item.gram + 'g · '}${item.kcal} kcal</div>
          <div onclick="fwRemoveItem('${dateStr}',${item.logId})" style="cursor:pointer;color:var(--muted);font-size:14px;padding:0 4px" title="${t('common.edit')}">×</div>
        </div>`).join('')
    : `<div style="font-size:12px;color:var(--muted);padding:6px 0">${t('foodweek.noItemsYet')}</div>`;

  const detail = `
    <div style="display:${isOpen ? 'block' : 'none'};padding:0 16px 14px">
      ${itemsHtml}
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn-sm" style="flex:1" onclick="fwAddForDay('${dateStr}')">${t('foodweek.addForDay')}</button>
        ${hasData ? `<button class="btn-sm" style="flex:1" onclick="fwOpenCopyModal('${dateStr}')">${t('foodweek.copy.button')}</button>` : ''}
      </div>
    </div>`;

  return `<div class="card" style="padding:0;overflow:hidden;${isToday ? 'border-color:var(--sage)' : ''}">${header}${detail}</div>`;
}

function fwToggleDag(dateStr) {
  fwOpenDag = fwOpenDag === dateStr ? null : dateStr;
  renderFoodWeek();
}

function fwRemoveItem(dateStr, logId) {
  const items = (foodDays[dateStr] || []).filter(i => i.logId !== logId);
  if (items.length) foodDays[dateStr] = items; else delete foodDays[dateStr];
  syncSet('prime_food_days', foodDays);
  // Als deze datum toevallig ook de actieve log-datum is (bv. "Mijn dag"
  // op vandaag), meteen bijwerken zodat alles synchroon blijft.
  if (dateStr === currentLogDate) {
    dayLog = items;
    updateMacroTotals();
    if (document.getElementById('day-log-list')) renderDayLog();
  }
  renderFoodWeek();
}

// Zet de actieve log-datum op deze dag en springt naar Basisproducten,
// zodat de bestaande product/gerecht-selectie + portiemodal hergebruikt
// wordt om voor déze dag iets toe te voegen i.p.v. voor vandaag.
function fwAddForDay(dateStr) {
  switchLogDate(dateStr);
  switchFoodTab('basis');
}

// ─── Kopieer maaltijden naar een andere dag (of terugkerend naar meerdere) ──
let fwCopySourceDate = null;
let fwCopyMode = 'simple'; // 'simple' | 'advanced'

function fwBuildDayChecks() {
  const wrap = document.getElementById('fwc-days-wrap');
  if (!wrap) return;
  wrap.innerHTML = [0,1,2,3,4,5,6].map(i => `
    <label style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;font-size:11px;color:var(--muted)">
      <span>${wpDagKort(i)}</span>
      <input type="checkbox" class="fwc-day-chk" data-day="${i}" style="width:16px;height:16px;accent-color:var(--sage);cursor:pointer">
    </label>`).join('');
}

function fwOpenCopyModal(dateStr) {
  fwCopySourceDate = dateStr;
  fwCopyMode = 'simple';

  document.getElementById('fwc-mode-simple').checked = true;
  document.getElementById('fwc-mode-advanced').checked = false;
  document.getElementById('fwc-advanced-block').style.display = 'none';
  document.getElementById('fwc-simple-date').value = '';

  document.getElementById('fwc-start-date').value = dateStr;
  document.getElementById('fwc-end-date').value = '';
  document.getElementById('fwc-end-date-mode').checked = true;
  document.getElementById('fwc-end-weeks-mode').checked = false;
  document.getElementById('fwc-end-date').disabled = false;
  document.getElementById('fwc-weeks').value = 4;
  document.getElementById('fwc-weeks').disabled = true;

  fwBuildDayChecks();
  document.getElementById('foodcopy-modal').classList.add('open');
}

function fwCloseCopyModal() {
  document.getElementById('foodcopy-modal').classList.remove('open');
}

function fwCopySetMode(mode) {
  fwCopyMode = mode;
  document.getElementById('fwc-advanced-block').style.display = mode === 'advanced' ? 'block' : 'none';
}

function fwCopySetEndMode(mode) {
  document.getElementById('fwc-end-date').disabled = mode !== 'date';
  document.getElementById('fwc-weeks').disabled = mode !== 'weeks';
}

function fwConfirmCopy() {
  if (!fwCopySourceDate) return;
  const source = foodDays[fwCopySourceDate] || [];
  if (!source.length) { alert(t('foodweek.copy.emptySource')); return; }

  let targets = [];

  if (fwCopyMode === 'simple') {
    const val = document.getElementById('fwc-simple-date').value;
    if (!val) { alert(t('foodweek.copy.chooseDate')); return; }
    targets = [val];
  } else {
    const days = [...document.querySelectorAll('.fwc-day-chk')].filter(c => c.checked).map(c => parseInt(c.dataset.day, 10));
    if (!days.length) { alert(t('foodweek.copy.chooseDays')); return; }

    const startVal = document.getElementById('fwc-start-date').value;
    if (!startVal) { alert(t('foodweek.copy.chooseStartDate')); return; }
    const start = wpDate(startVal);

    const endMode = document.getElementById('fwc-end-weeks-mode').checked ? 'weeks' : 'date';
    let end;
    if (endMode === 'date') {
      const endVal = document.getElementById('fwc-end-date').value;
      if (!endVal) { alert(t('foodweek.copy.chooseEndDate')); return; }
      end = wpDate(endVal);
    } else {
      const weeks = parseInt(document.getElementById('fwc-weeks').value, 10) || 1;
      end = new Date(start);
      end.setDate(start.getDate() + weeks * 7 - 1);
    }

    const cur = new Date(start);
    while (cur <= end) {
      const wd = cur.getDay(); // 0=Zo..6=Za
      const idx = wd === 0 ? 6 : wd - 1; // 0=Ma..6=Zo, zelfde volgorde als fwBuildDayChecks
      if (days.includes(idx)) targets.push(wpStr(cur));
      cur.setDate(cur.getDate() + 1);
    }
    if (!targets.length) { alert(t('foodweek.copy.noMatchingDays')); return; }
  }

  let count = 0;
  targets.forEach(dateStr => {
    if (dateStr === fwCopySourceDate) return; // niet naar zichzelf kopiëren
    const copies = source.map(item => ({ ...item, logId: newLogId() }));
    const existing = foodDays[dateStr] || [];
    foodDays[dateStr] = [...existing, ...copies];
    count++;
    if (dateStr === currentLogDate) dayLog = foodDays[dateStr];
  });

  if (count === 0) { alert(t('foodweek.copy.noMatchingDays')); return; }

  syncSet('prime_food_days', foodDays);
  fwCloseCopyModal();
  updateMacroTotals();
  renderFoodWeek();
  showToast(count === 1 ? t('foodweek.copy.successOne') : t('foodweek.copy.successMany', { n: count }));
}
