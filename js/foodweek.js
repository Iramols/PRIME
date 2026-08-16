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

// Vangnet: renderFoodWeek() zelf mag nooit een leeg/wit scherm opleveren.
// Eerdere versie liet bij een crash gewoon niets achter (de laatste regel
// zet pas aan het eind el.innerHTML = html, dus alles vóór een crash ging
// verloren). Nu vult een mislukte render altijd een zichtbare foutkaart
// i.p.v. stilzwijgend leeg te blijven — en per dag-kaart is er nog een
// eigen vangnet, zodat één kapotte dag niet de hele week blank trekt.
function renderFoodWeek() {
  const el = document.getElementById('foodweek-content');
  if (!el) return;
  try {
    el.innerHTML = buildFoodWeekHtml();
  } catch (e) {
    console.error('renderFoodWeek crash:', e);
    el.innerHTML = `<div class="card" style="text-align:center;padding:30px 20px">
      <div style="font-size:32px;margin-bottom:10px">⚠️</div>
      <div style="font-weight:600;margin-bottom:6px">${t('foodweek.renderError')}</div>
      <div style="font-size:12px;color:var(--muted)">${(e && e.message) || String(e)}</div>
    </div>`;
  }
}

function buildFoodWeekHtml() {
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
    try {
      const tot = fwDayTotals(dateStr);
      const hasData = (foodDays[dateStr] || []).length > 0;
      const isToday = dateStr === todayStr;
      const isOpen = fwOpenDag === dateStr;
      html += fwBouwDagKaart(dateStr, d, i, tot, hasData, isToday, isOpen);
    } catch (e) {
      console.error('fwBouwDagKaart crash voor ' + dateStr + ':', e);
      html += `<div class="card" style="padding:16px;font-size:12px;color:var(--muted)">⚠️ ${dateStr}: ${(e && e.message) || String(e)}</div>`;
    }
  }
  html += '</div>';

  return html;
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

  // Zelfde kaartweergave als "Vandaag" (foto/icoon + naam + gewicht/kcal +
  // macro's, gegroepeerd per moment) — zie renderLogItemCard/
  // renderLogItemsHtml in food.js.
  const items = foodDays[dateStr] || [];
  const itemsHtml = items.length
    ? renderLogItemsHtml(dateStr, items)
    : `<div style="font-size:12px;color:var(--muted);padding:6px 0">${t('foodweek.noItemsYet')}</div>`;

  const detail = `
    <div style="display:${isOpen ? 'block' : 'none'};padding:0 16px 14px">
      ${itemsHtml}
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn-sm" style="flex:1" onclick="fwAddForDay('${dateStr}')">${t('foodweek.addForDay')}</button>
        ${hasData ? `<button class="btn-sm" style="flex:1" onclick="fwOpenCopyModal('${dateStr}')">${t('foodweek.copy.button')}</button>` : ''}
      </div>
      ${hasData ? `<button class="btn-sm" style="margin-top:8px;width:100%;color:var(--accent);border-color:#e8c4a8;background:var(--accent-light)" onclick="clearFoodDay('${dateStr}')">${t('food.clearDay.button')}</button>` : ''}
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

  // Vanaf hier is het item al veilig verwijderd en opgeslagen; de rest is
  // best-effort nazorg om het scherm bij te werken (zelfde patroon als
  // fwConfirmCopyInner: een haperende ververs-stap mag de al gelukte
  // verwijdering niet in de weg zitten).
  if (dateStr === currentLogDate) {
    dayLog = [...items];
    try { updateMacroTotals(); } catch (e) { console.error('updateMacroTotals na verwijderen:', e); }
    try { if (document.getElementById('day-log-list')) renderDayLog(); } catch (e) { console.error('renderDayLog na verwijderen:', e); }
    try { updateLogBadge(); } catch (e) { console.error('updateLogBadge na verwijderen:', e); }
  }
  try { renderFoodWeek(); } catch (e) { console.error('renderFoodWeek na verwijderen:', e); }
}

// Zet de actieve log-datum op deze dag en springt naar Basisproducten,
// zodat de bestaande product/gerecht-selectie + portiemodal hergebruikt
// wordt om voor déze dag iets toe te voegen i.p.v. voor vandaag.
function fwAddForDay(dateStr) {
  switchLogDate(dateStr);
  switchFoodTab('basis');
}

// ─── Kopieer maaltijden naar een andere dag (of terugkerend naar meerdere) ──
// Welke modus (simpel/geavanceerd) actief is, wordt bewust NIET in een eigen
// variabele bijgehouden: fwConfirmCopy() leest de radio's .checked-status
// altijd rechtstreeks uit de DOM, zodat een gemist onchange-event op een
// mobiele browser niet tot verouderde/foute keuzes kan leiden.
let fwCopySourceDate = null;

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
  document.getElementById('fwc-advanced-block').style.display = mode === 'advanced' ? 'block' : 'none';
}

function fwCopySetEndMode(mode) {
  document.getElementById('fwc-end-date').disabled = mode !== 'date';
  document.getElementById('fwc-weeks').disabled = mode !== 'weeks';
}

// Vangnet: als hier ooit toch iets onverwachts misgaat, krijgt de coach
// altijd een zichtbare melding i.p.v. dat het kopiëren stil faalt.
function fwConfirmCopy() {
  try {
    fwConfirmCopyInner();
  } catch (e) {
    console.error('fwConfirmCopy error:', e);
    alert(t('foodweek.copy.unexpectedError', { msg: (e && e.message) || String(e) }));
  }
}

function fwConfirmCopyInner() {
  if (!fwCopySourceDate) return;
  const source = foodDays[fwCopySourceDate] || [];
  if (!source.length) { alert(t('foodweek.copy.emptySource')); return; }

  let targets = [];

  // Lees de modus rechtstreeks van de radio in de DOM i.p.v. van een
  // apart bijgehouden variabele: die zou alleen bijgewerkt worden via
  // het onchange-event van de radio, wat op sommige mobiele browsers
  // niet altijd betrouwbaar afvuurt. Zo blijft dit werken ongeacht of
  // dat event raakte.
  const isAdvanced = document.getElementById('fwc-mode-advanced').checked;

  if (!isAdvanced) {
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
    // Eigen kopie i.p.v. dezelfde array-referentie als foodDays[dateStr]
    // (zelfde patroon als switchLogDate()): voorkomt dat een latere
    // dayLog-mutatie ook meteen foodDays stiekem meeverandert.
    if (dateStr === currentLogDate) dayLog = [...foodDays[dateStr]];
  });

  if (count === 0) { alert(t('foodweek.copy.noMatchingDays')); return; }

  // Vanaf hier is de data al veilig gekopieerd en opgeslagen. Sluit de
  // modal daarom EERST en onvoorwaardelijk, en behandel alles hierna
  // (totalen bijwerken, het scherm verversen, de melding tonen) als
  // losse, best-effort nazorg: als daar ooit iets in vastloopt, blijft
  // de coach niet met een niet-sluitend venster zitten — de kopie zelf
  // staat dan al goed, ook al ververst het scherm dan niet vanzelf.
  syncSet('prime_food_days', foodDays);
  fwCloseCopyModal();

  const toastMsg = count === 1 ? t('foodweek.copy.successOne') : t('foodweek.copy.successMany', { n: count });
  try { updateMacroTotals(); } catch (e) { console.error('updateMacroTotals na kopieren:', e); }
  try { renderFoodWeek(); } catch (e) { console.error('renderFoodWeek na kopieren:', e); }
  try { showToast(toastMsg); } catch (e) { console.error('showToast na kopieren:', e); }
}
