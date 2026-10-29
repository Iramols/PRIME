// ========== CHECK-IN ==========
function onWeightInput(input) {
  const val = parseFloat(input.value);
  checkin.weight = (val > 0) ? val : null;
  const card = document.getElementById('cq-weight-card');
  card.classList.remove('cq-weight-card-skipped');
  const skipBtn = card.querySelector('.cq-skip-btn');
  skipBtn.textContent = t('checkin.skip');
  skipBtn.classList.remove('skipped');
}

function skipWeight() {
  checkin.weight = null;
  document.getElementById('weight-input').value = '';
  const card = document.getElementById('cq-weight-card');
  card.classList.add('cq-weight-card-skipped');
  const skipBtn = card.querySelector('.cq-skip-btn');
  skipBtn.textContent = t('checkin.weightSkipped');
  skipBtn.classList.add('skipped');
}

// ========== GEWICHT ALSNOG TOEVOEGEN/AANPASSEN ==========
// Los van de ochtend-check-in: via het Dashboard (elke dagstand) of de
// gewicht-grafiek in Voortgang kun je een gewicht ook achteraf, voor
// vandaag of een gemiste dag, toevoegen of aanpassen. Vandaag-nog-niet-
// afgesloten leeft in `todayData` (nog niet in `history`, zie doCheckout()
// hieronder); elke andere dag (afgesloten, of een dag uit het verleden die
// nog nooit een check-in had) leeft/komt in `history`.
function _weightForDate(dateStr) {
  if (todayData && todayData.date === dateStr) return (todayData.checkin && todayData.checkin.weight) || null;
  if (weightLog[dateStr] > 0) return weightLog[dateStr];
  const entry = history.find(h => h.date === dateStr);
  return (entry && entry.checkin && entry.checkin.weight) || null;
}

function setWeightForDate(dateStr, gewicht) {
  // Het gewicht gaat altijd naar het logboek (nooit ingekort). Een dagrecord in history wordt alleen bijgewerkt als dat er al is;
  // voor een dag zonder record maken we er geen aan (dat telde mee als check-in en viel na een jaar weer weg).
  weightLogSet(dateStr, gewicht);
  if (todayData && todayData.date === dateStr) {
    todayData.checkin = todayData.checkin || {};
    todayData.checkin.weight = gewicht;
    syncSet('prime_today', todayData);
  } else {
    const entry = history.find(h => h.date === dateStr);
    if (entry) {
      entry.checkin = entry.checkin || {};
      entry.checkin.weight = gewicht;
      syncSet('prime_history', history);
    }
  }
  // Zelfde als bij een normale check-in (doCheckin() hierboven): het profielgewicht bijwerken als dit de meest recente
  // bekende weegdatum is.
  const nieuwste = Object.keys(weightLog).sort().pop();
  if (dateStr === nieuwste) {
    profile.weight = gewicht;
    syncSet('prime_profile', profile);
  }
}

function openWeightModal(dateStr) {
  const d = dateStr || localDateStr();
  document.getElementById('wm-date').value = d;
  document.getElementById('wm-date').max = localDateStr(); // geen toekomstige datum
  document.getElementById('wm-weight').value = _weightForDate(d) || '';
  document.getElementById('wm-error').textContent = '';
  document.getElementById('weight-modal').classList.add('open');
}
function closeWeightModal() { document.getElementById('weight-modal').classList.remove('open'); }

function saveWeightModal() {
  const dateStr = document.getElementById('wm-date').value;
  const val = parseFloat(document.getElementById('wm-weight').value);
  const errEl = document.getElementById('wm-error');
  if (!dateStr) { errEl.textContent = t('weight.modal.dateRequired'); return; }
  if (!(val > 0)) { errEl.textContent = t('weight.modal.weightRequired'); return; }
  if (dateStr > localDateStr()) { errEl.textContent = t('weight.modal.futureNotAllowed'); return; }
  setWeightForDate(dateStr, val);
  closeWeightModal();
  // Meteen overal zichtbaar i.p.v. pas bij een volgende tabwissel.
  if (typeof updateHomeWeightRows === 'function') updateHomeWeightRows();
  if (typeof renderHistory === 'function') renderHistory();
  try { showToast(t('weight.modal.saved')); } catch (e) {}
}

// Regeltje op het Dashboard ("Gewicht: X kg ✏️ Aanpassen" / "Nog geen
// gewicht ingevuld ✏️ Toevoegen") -- zelfde inhoud op de twee plekken waar
// de dag ook maar kan staan (nog actief, of al afgesloten), zie renderHome()
// in app.js.
function updateHomeWeightRows() {
  const gewicht = _weightForDate(localDateStr());
  const html = gewicht > 0
    ? '<span style="font-size:20px;line-height:1">⚖️</span><span style="font-size:14px;color:var(--charcoal);flex:1">' + t('weight.row.filled', { kg: gewicht }) + '</span><span style="font-size:13px;color:var(--sage);font-weight:600">✏️ ' + t('weight.row.editBtn') + '</span>'
    : '<span style="font-size:20px;line-height:1">⚖️</span><span style="font-size:14px;color:var(--muted);flex:1">' + t('weight.row.empty') + '</span><span style="font-size:13px;color:var(--sage);font-weight:600">✏️ ' + t('weight.row.addBtn') + '</span>';
  const dayEl = document.getElementById('day-weight-row');
  const doneEl = document.getElementById('done-weight-row');
  if (dayEl) dayEl.innerHTML = html;
  if (doneEl) doneEl.innerHTML = html;
}

function pick(key, val, btn) {
  const container = btn.closest('.cq-options') || btn.closest('.emoji-scale');
  const btnSel = btn.classList.contains('cq-btn') ? '.cq-btn' : '.emoji-btn';
  container.querySelectorAll(btnSel).forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  checkin[key] = val;
  const ready = checkin.sleep > 0 && checkin.energy > 0 && checkin.stress > 0;
  document.getElementById('checkin-btn').disabled = !ready;
}

function pickOut(key, val, btn) {
  const container = btn.closest('.cq-options') || btn.closest('.emoji-scale');
  const btnSel = btn.classList.contains('cq-btn') ? '.cq-btn' : '.emoji-btn';
  container.querySelectorAll(btnSel).forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  checkout[key] = val;
  checkCheckoutReady();
}

function checkCheckoutReady() {
  // food: 1=te weinig, 2=iets onder, 3=op doel, 4=teveel — allemaal geldig
  const ready = checkout.energy > 0 && checkout.food > 0 && checkout.training > 0;
  document.getElementById('checkout-btn').disabled = !ready;
}

// Dashboard-trainingskaart: preview-regel en (zonder programmadag) de badge.
// Gedeeld door renderHome() (app.js) en de check-in (hieronder), die eerder
// elk hun eigen kopie van deze regels hadden. Sessies staan vooraan.
function homeTrainingPreviewHtml(dateStr, wpOef) {
  // Zoals bij Voeding: alleen wat nog te doen is. Afgevinkte oefeningen en sessies verdwijnen uit deze regel;
  // zijn ze allemaal afgevinkt, dan staat er "Alles gedaan".
  const gedaanKeys = wpGetDone(dateStr);
  const sessiesAlle = sessiesVoorDag(dateStr);
  const sessies = sessiesAlle.filter(function(s) { return !isSessieGedaan(dateStr, s.id); })
    .map(function(s) { return sessieIcon(s.sessieType) + ' ' + escapeHtml(s.name) + (s.time ? ' ' + s.time : ''); });
  let totaalOef = 0;
  const oefs = [];
  const entry = (JSON.parse(localStorage.getItem('prime_planning') || '[]')).find(function(p) { return p.date === dateStr; }) || null;
  if (entry && (wpOef || []).length) {
    // Zelfde sleutel als bij het afvinken (wpOefKey tegen de ONGEFILTERDE lijst met de originele index)
    const volledig = wpGetOefeningen(entry.schemaId) || [];
    const verwijderd = wpGetRemoved(dateStr);
    volledig.forEach(function(o, i) {
      if (verwijderd.includes(i)) return;
      totaalOef++;
      if (!gedaanKeys.includes(wpOefKey(o, i, volledig))) oefs.push(escapeHtml(dispName(o)));
    });
  }
  if (!sessiesAlle.length && !totaalOef) return t('home.noTrainingToday');
  const alles = sessies.concat(oefs);
  if (!alles.length) return '<span style="color:var(--sage);font-weight:600">✓ ' + t('home.trainingAllDone') + '</span>';
  return alles.slice(0, 3).join(' &nbsp;·&nbsp; ') + (alles.length > 3 ? ' &nbsp;+' + (alles.length - 3) + t('home.more') : '');
}
// Ververst alleen de preview-regel van de Dashboard-trainingskaart (na het afvinken in Training of de check-out).
function updateHomeTrainingPreview() {
  const el = document.getElementById('home-training-preview');
  if (!el) return;
  const vandaag = localDateStr();
  const entry = (JSON.parse(localStorage.getItem('prime_planning') || '[]')).find(function(p) { return p.date === vandaag; }) || null;
  el.innerHTML = homeTrainingPreviewHtml(vandaag, entry ? wpGetZichtbareOefeningen(vandaag, entry.schemaId) : []);
}
function homeNoPlanBadgeHtml(dateStr) {
  const sessies = sessiesVoorDag(dateStr);
  if (!sessies.length) return '<div class="training-type-badge badge-light">' + t('home.noTrainingSelected') + '</div>';
  const iconen = sessies.map(function(s) { return sessieIcon(s.sessieType); }).join('');
  return '<div class="training-type-badge badge-normal">' + iconen + ' ' + sessies.length + ' ' + t(sessies.length === 1 ? 'sessie.singular' : 'sessie.plural') + '</div>';
}

function buildTrainingSummary() {
  // Weekplanning oefeningen voor vandaag
  const _btsToday = localDateStr();
  // Altijd synchroon houden met trainingDays (zie state.js/training.js)
  trainingDagLog = trainingDays[_btsToday] || [];
  const _btsWpEntry = (JSON.parse(localStorage.getItem('prime_planning') || '[]')).find(p => p.date === _btsToday) || null;
  const _btsWpDoneArr = wpGetDone(_btsToday); // migreert oude numerieke data indien nodig, zie weekplanning.js
  const _btsWpOef = _btsWpEntry ? wpGetOefeningen(_btsWpEntry.schemaId) : [];
  // Voor vandaag verwijderde weekplanning-oefeningen (zie wpRemoveOefForDay())
  // tellen hier niet meer mee -- zelfde aanpak als _dagWpZichtbaar in
  // renderTrainingDag() (training.js). Rank-sleutel (wpOefKey) blijft
  // berekend tegen het ONGEFILTERDE _btsWpOef met de ORIGINELE index, zodat
  // hij exact overeenkomt met de sleutel die elders (bij het afvinken) voor
  // diezelfde oefening is opgeslagen.
  const _btsWpVerwijderd = wpGetRemoved(_btsToday);
  const wpItems = _btsWpOef
    .map(function(ex, i) { return { ex: ex, i: i }; })
    .filter(function(x) { return !_btsWpVerwijderd.includes(x.i); })
    .map(function(x) {
      return { id: 'wp-' + x.i, name: dispName(x.ex) || ('Oefening ' + (x.i+1)), _wpKey: wpOefKey(x.ex, x.i, _btsWpOef) };
    });

  const allItems = wpItems.concat(trainingDagLog);
  const total = allItems.length;

  // Tel afgevinkte: dagDone voor schema-tab en losse, prime_wp_done voor
  // weekplanning (gematcht op de stabiele naam-sleutel, zie wpOefKey()).
  // Eén helper voor de teller én de tags hieronder (twee eigen kopieën liepen
  // hier eerder uit elkaar). Sessies lezen altijd uit prime_wp_done.
  function _btsItemDone(ex) {
    if (isSessie(ex)) return isSessieGedaan(_btsToday, ex.id);
    let d = dagDone[ex.id];
    if (!d && ex.id.startsWith('wp-')) d = _btsWpDoneArr.includes(ex._wpKey);
    return !!d;
  }
  let done = 0;
  allItems.forEach(function(ex) { if (_btsItemDone(ex)) done++; });

  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  const _btsSessies = trainingDagLog.filter(isSessie);
  const typeLabel = _btsWpEntry
    ? wpGetDisplay(_btsWpEntry.schemaId).naam
    : (_btsSessies.length ? _btsSessies.map(function(s) { return sessieIcon(s.sessieType) + ' ' + escapeHtml(s.name); }).join(' · ') : t('checkin.noTraining'));

  let status, statusIcon, coachQuestion, confirmOptions;

  if (total === 0 || done === 0) {
    status = total === 0 ? t('checkin.noExercisesPlanned') : t('checkin.noExercisesChecked');
    statusIcon = '⭕';
    checkout.training = 1;
    coachQuestion = t('checkin.coachQ.noneChecked');
    confirmOptions = [
      {label:t('checkin.confirm.trainedYes'), val:3},
      {label:t('checkin.confirm.partiallyDone'), val:2},
      {label:t('checkin.confirm.notTrained'), val:1},
    ];
  } else if (done >= total) {
    status = t('checkin.allExercisesDone', { n: total });
    statusIcon = '✅';
    checkout.training = 3;
    coachQuestion = t('checkin.coachQ.allDone', { n: total });
    confirmOptions = [
      {label:t('checkin.confirm.fullyDone'), val:3},
      {label:t('checkin.confirm.actuallyPartial'), val:2},
    ];
  } else {
    status = t('checkin.exercisesDoneStatus', { done, total, pct });
    statusIcon = '⚡';
    checkout.training = 2;
    coachQuestion = t('checkin.coachQ.partialDone', { done, total, pct });
    confirmOptions = [
      {label:t('checkin.confirm.correctAsIs'), val:2},
      {label:t('checkin.confirm.didEverything'), val:3},
      {label:t('checkin.confirm.evenLess'), val:1},
    ];
  }

  // Render tags -- zelfde detectie als de teller hierboven (ex._wpKey, de
  // stabiele naam-sleutel). Gebruikte voorheen per ongeluk nog de oude,
  // numerieke index (parseInt(ex.id...)), die tegen de huidige
  // string-sleutels in _btsWpDoneArr vrijwel nooit meer matchte -- daardoor
  // leken weekplanning-oefeningen altijd "niet gedaan", ook al waren ze
  // wel afgevinkt (en telden ze wel goed mee in "X van Y gedaan").
  let doneTags = '';
  allItems.forEach(function(ex) {
    const label = isSessie(ex) ? (sessieIcon(ex.sessieType) + ' ' + escapeHtml(ex.name)) : ex.name;
    doneTags += _btsItemDone(ex)
      ? '<span class="done-tag">✓ ' + label + '</span>'
      : '<span class="skipped-tag">' + label + '</span>';
  });

  document.getElementById('training-summary-content').innerHTML =
    '<div class="training-status-row">'
    + '<span class="training-status-icon">' + statusIcon + '</span>'
    + '<div><div class="training-status-text">' + status + '</div>'
    + '<div class="training-status-sub">' + typeLabel + '</div></div></div>'
    + '<div class="training-done-list">' + doneTags + '</div>'
    + '<div id="co-tr-onbevestigd">' + coTrainingLijstHtml(allItems, _btsItemDone) + '</div>';

  document.getElementById('training-confirm-question').textContent = coachQuestion;
  document.getElementById('training-confirm-question').style.display = 'block';

  const btnContainer = document.getElementById('training-confirm-btns');
  btnContainer.style.display = 'flex';
  btnContainer.innerHTML = confirmOptions.map(function(opt) {
    return '<button class="confirm-btn ' + (checkout.training === opt.val ? 'selected' : '') + '"'
      + ' onclick="confirmTraining(' + opt.val + ', this)">' + opt.label + '</button>';
  }).join('');

  checkCheckoutReady();
}


function buildFoodSummary() {
  const doel = getDagDoel();
  // Alleen wat is afgevinkt (gegeten) telt als echte inname; het geplande maar
  // niet afgevinkte deel wordt onderaan apart genoemd.
  const _split = splitTotals(dayLog);
  const logged = dayLog.filter(isEatenItem).length;
  const tot = _split.eaten;

  const kcalPct = doel.kcal > 0 ? Math.round(tot.kcal / doel.kcal * 100) : 0;
  const protPct = doel.prot > 0 ? Math.round(tot.prot / doel.prot * 100) : 0;
  // Zelfde grens als de "Doel: X–Y kcal"-weergave bij Voeding en de
  // calorietrend-grafiek (macroDoelRange() in data.js: automatisch ±10%, of
  // de handmatige onder-/bovengrens uit Profiel) -- kcalPct hierboven blijft
  // alleen voor de weergegeven tekst ("X% van je doel"), de daadwerkelijke
  // op-doel/teveel/teweinig-beslissing gebruikt de absolute grenzen.
  const kcalRange = macroDoelRange(doel.kcal, 'kcal');

  // Bepaal status op basis van calorieën
  let statusIcon, statusText, coachQuestion, confirmOptions;

  if (logged === 0) {
    // Niets gelogd
    statusIcon = '⭕';
    statusText = t('checkin.food.nothingLogged');
    checkout.food = 2;
    coachQuestion = t('checkin.food.coachQ.nothingLogged');
    confirmOptions = [
      { label: t('checkin.confirm.ateWellYes'), val: 3 },
      { label: t('checkin.confirm.mostlyFollowed'), val: 2 },
      { label: t('checkin.confirm.notWellToday'), val: 1 },
    ];
  } else if (tot.kcal >= kcalRange.min && tot.kcal <= kcalRange.max) {
    // Op doel
    statusIcon = '✅';
    statusText = t('checkin.food.onTarget', { kcal: Math.round(tot.kcal), doel: doel.kcal, pct: kcalPct });
    checkout.food = 3;
    coachQuestion = t('checkin.food.coachQ.onTarget', { kcal: Math.round(tot.kcal), doel: doel.kcal });
    confirmOptions = [
      { label: t('checkin.confirm.exactlyRight'), val: 3 },
      { label: t('checkin.confirm.ateMore'), val: 4 },
      { label: t('checkin.confirm.ateLess'), val: 2 },
    ];
  } else if (tot.kcal > kcalRange.max) {
    // Teveel gegeten
    const over = Math.round(tot.kcal - doel.kcal);
    statusIcon = '⬆️';
    statusText = t('checkin.food.over', { kcal: Math.round(tot.kcal), over, pct: kcalPct });
    checkout.food = 4;
    coachQuestion = t('checkin.food.coachQ.over', { over, doel: doel.kcal });
    confirmOptions = [
      { label: t('checkin.confirm.ateTooMuch'), val: 4 },
      { label: t('checkin.confirm.ateLessThanLogged'), val: 3 },
      { label: t('checkin.confirm.ateEvenMore'), val: 4 },
    ];
  } else {
    // Te weinig gegeten
    const tekort = Math.round(doel.kcal - tot.kcal);
    statusIcon = '⬇️';
    statusText = t('checkin.food.under', { kcal: Math.round(tot.kcal), tekort, pct: kcalPct });
    checkout.food = 2;
    coachQuestion = t('checkin.food.coachQ.under', { tekort, doel: doel.kcal });
    confirmOptions = [
      { label: t('checkin.confirm.tooLittleIndeed'), val: 1 },
      { label: t('checkin.confirm.ateMoreNotLogged'), val: 3 },
      { label: t('checkin.confirm.consciousChoice'), val: 2 },
    ];
  }

  // Macro voortgangsbalken
  const barColor = pct => pct > 115 ? '#E24B4A' : pct >= 85 ? '#4a7c59' : '#EF9F27';
  const barWidth = pct => Math.min(100, pct) + '%';

  const macroHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px">
      ${[
        { lbl:t('checkin.macro.kcal'), val:Math.round(tot.kcal), doel:doel.kcal, unit:'', pct:kcalPct },
        { lbl:t('checkin.macro.protein'), val:Math.round(tot.prot), doel:doel.prot, unit:'g', pct:protPct },
        { lbl:t('checkin.macro.carbs'), val:Math.round(tot.carb), doel:doel.carb, unit:'g', pct:Math.round(tot.carb/doel.carb*100) },
        { lbl:t('checkin.macro.fat'), val:Math.round(tot.fat), doel:doel.fat, unit:'g', pct:Math.round(tot.fat/doel.fat*100) },
      ].map(m => `
        <div style="text-align:center;background:var(--white);border-radius:8px;padding:10px 6px">
          <div style="font-family:'DM Serif Display',serif;font-size:17px">${m.val}${m.unit}</div>
          <div style="font-size:9px;color:var(--muted);margin:3px 0">${m.lbl} · ${t('checkin.macro.goalSuffix', { doel:m.doel, unit:m.unit })}</div>
          <div style="height:4px;background:var(--sand-dark);border-radius:100px;overflow:hidden">
            <div style="height:100%;width:${barWidth(m.pct)};background:${barColor(m.pct)};border-radius:100px;transition:width 0.4s"></div>
          </div>
        </div>`).join('')}
    </div>`;

  document.getElementById('food-summary-content').innerHTML = `
    <div class="training-status-row">
      <span class="training-status-icon">${statusIcon}</span>
      <div>
        <div class="training-status-text">${statusText}</div>
        <div class="training-status-sub">${t('checkin.itemsLoggedSummary', { n: logged, item: t('checkin.item') + (logged !== 1 ? 's' : ''), kcal: doel.kcal })}</div>
      </div>
    </div>
    ${macroHTML}
    <div id="co-onbevestigd">${foodOnbevestigdHtml()}</div>`;

  // Coach bevestigingsvraag
  const qEl = document.getElementById('food-confirm-question');
  qEl.textContent = coachQuestion;
  qEl.style.display = 'block';

  const btnContainer = document.getElementById('food-confirm-btns');
  btnContainer.style.display = 'flex';
  btnContainer.innerHTML = confirmOptions.map(opt =>
    `<button class="confirm-btn ${checkout.food === opt.val ? 'selected' : ''}"
      onclick="confirmFood(${opt.val}, this)">${opt.label}</button>`
  ).join('');

  checkCheckoutReady();
}

function confirmFood(val, btn) {
  checkout.food = val;
  document.querySelectorAll('#food-confirm-btns .confirm-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  checkCheckoutReady();
}

function confirmTraining(val, btn) {
  checkout.training = val;
  document.querySelectorAll('.confirm-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  checkCheckoutReady();
}

function calcTrainingType() {
  const stressPositief = checkin.stress - 1;
  const avg = (checkin.sleep - 1 + (checkin.energy - 1) + stressPositief) / 3;
  if (avg < 1.0) return 'herstel';
  if (avg < 2.0) return 'normaal';
  return 'zwaar';
}

async function doCheckin() {
  try { noteFlush(); } catch (e) { console.error(e); }
  const btn = document.getElementById('checkin-btn');
  btn.disabled = true; btn.textContent = t('checkin.analyzing');

  trainingType = calcTrainingType();
  const mealData = MEALS[trainingType];

  // Gewicht opslaan in profiel als ingevuld
  if (checkin.weight && checkin.weight > 0) {
    profile.weight = checkin.weight;
    syncSet('prime_profile', profile);
    weightLogSet(localDateStr(), checkin.weight);
  }

  // Save today
  const today = localDateStr();
  todayData = { date: today, checkin, trainingType, checkout: null };
  syncSet('prime_today', todayData);
  exerciseDone = [];
  syncSet('prime_exdone', exerciseDone);
  // Niet zomaar leegmaken: trainingDays is per datum (zie state.js), dus dit
  // haalt gewoon op wat er voor de (mogelijk nieuwe) datum al staat -- leeg
  // als er niets is, maar blijft intact als er bv. al training naartoe
  // gekopieerd was via Weekplanning.
  trainingDagLog = trainingDays[today] || [];
  selectedSchemaEx = {};

  // Update stats
  updateStreak();

  // Show day section
  document.getElementById('checkin-section').style.display = 'none';
  document.getElementById('day-section').style.display = 'block';

  // Build training + food summary voor checkout
  buildTrainingSummary();
  buildFoodSummary();

  // Set training preview from weekplanning
  const _wpEntry = (JSON.parse(localStorage.getItem('prime_planning') || '[]')).find(p => p.date === today) || null;
  if (_wpEntry) {
    const _wpDisp = wpGetDisplay(_wpEntry.schemaId);
    document.getElementById('home-training-badge').innerHTML = '<div class="training-type-badge badge-normal">' + _wpDisp.icon + ' ' + _wpDisp.naam + '</div>';
    // wpGetZichtbareOefeningen() i.p.v. wpGetOefeningen(): houdt rekening
    // met oefeningen die voor vandaag specifiek verwijderd zijn (zie
    // renderHome() in app.js, zelfde fix).
    const _wpOef = wpGetZichtbareOefeningen(today, _wpEntry.schemaId);
    document.getElementById('home-training-preview').innerHTML = homeTrainingPreviewHtml(today, _wpOef);
  } else {
    document.getElementById('home-training-badge').innerHTML = homeNoPlanBadgeHtml(today);
    document.getElementById('home-training-preview').innerHTML = homeTrainingPreviewHtml(today, []);
  }

  // Render training & food screens
  renderTraining();
  renderFood();
  updateHomeMacros();
  const sl = ['', t('checkin.sleep.bad'), t('checkin.sleep.ok'), t('checkin.sleep.good'), t('checkin.sleep.great')][checkin.sleep];
  const en = ['', t('checkin.energy.low'), t('checkin.energy.mid'), t('checkin.energy.high'), t('checkin.energy.veryhigh')][checkin.energy];
  const st = ['', t('checkin.stressShort.high'), t('checkin.stressShort.mid'), t('checkin.stressShort.low'), t('checkin.stressShort.none')][checkin.stress];
  const _trainLabel = _wpEntry ? wpGetDisplay(_wpEntry.schemaId).naam : t('checkin.noTraining');
  const prompt = t('checkin.aiPrompt', { sl, en, st, training: _trainLabel });

  try {
    const r = await callClaude(prompt, []);
    document.getElementById('coach-msg-text').textContent = r;
    document.getElementById('coach-message-home').style.display = 'block';
  } catch {
    // AI-samenvatting is optioneel -- #coach-message-home blijft dan
    // verborgen, maar de titel/tekst hieronder komen sowieso uit de echte
    // planningsdata, niet uit de AI-respons.
  }
  document.getElementById('day-title').textContent = t('home.pilotThanks');
  document.getElementById('day-summary').innerHTML = t('day.summary.default');
  document.getElementById('hero-sub').innerHTML = t('day.summary.default');
  try { applyDagStatusTone(); applyDagStatusTraining(); } catch (e) { console.error(e); }
}

async function doCheckout() {
  try { noteFlush(); } catch (e) { console.error(e); }
  const btn = document.getElementById('checkout-btn');
  btn.disabled = true;
  btn.textContent = t('checkin.preparingAdvice');

  // Save to history
  if (todayData) {
    todayData.checkout = checkout;
    // Een record voor deze datum kan er al staan (gewicht eerder ingevuld, of
    // de dag is op een ander apparaat al afgesloten): vervang dat i.p.v. er
    // een tweede record bij te zetten, en neem een daarin ingevuld gewicht over.
    const _bestaandRecord = history.find(h => h.date === todayData.date);
    if (_bestaandRecord) {
      if (!(todayData.checkin && todayData.checkin.weight > 0) && _bestaandRecord.checkin && _bestaandRecord.checkin.weight > 0) {
        todayData.checkin = Object.assign({}, todayData.checkin, { weight: _bestaandRecord.checkin.weight });
      }
      history = history.filter(h => h.date !== todayData.date);
    }
    history.unshift(todayData);
    if (history.length > HISTORY_MAX_DAGEN) history.pop();
    syncSet('prime_history', history);
    syncRemove('prime_today');
    // Ook de in-memory referentie leegmaken -- syncRemove() haalt 'm alleen
    // uit de opslag. Zonder dit bleef todayData.date === vandaag nog gewoon
    // waar staan, waardoor een latere renderHome() (bv. bij taalwissel) de
    // check-out-kaart weer vers/onbeantwoord opbouwde en de dag dus
    // meermaals afgesloten kon worden. Zie ook de history[0].date-check in
    // renderHome() (app.js), die dit ook afvangt na een paginaherlaad.
    todayData = null;
  }

  // Weekplanning context voor vandaag
  const _coToday = localDateStr();
  const _coWpEntry = (JSON.parse(localStorage.getItem('prime_planning') || '[]')).find(p => p.date === _coToday) || null;
  const _coWpOef = _coWpEntry ? (wpGetOefeningen(_coWpEntry.schemaId) || []) : [];
  const _coWpDoneArr = wpGetDone(_coToday); // migreert oude numerieke data indien nodig, zie weekplanning.js
  const _coWpNaam = _coWpEntry ? wpGetDisplay(_coWpEntry.schemaId).naam : t('checkin.noTraining');
  const total = _coWpOef.length;
  const done = _coWpDoneArr.length;

  const doel = { kcal:2000, prot:150, carb:200, fat:65 };
  const totFood = splitTotals(dayLog).eaten;

  const energyLabel = ['', t('checkin.energy.low'), t('checkin.energy.mid'), t('checkin.energy.high'), t('checkin.energy.veryhigh')][checkout.energy];
  const trainingLabel = checkout.training === 3 ? t('checkin.trainingLabel.full', { done, total }) :
                        checkout.training === 2 ? t('checkin.trainingLabel.partial', { done, total }) : t('checkin.trainingLabel.notDone');
  const foodLabel = checkout.food === 3 ? t('checkin.foodLabel.onTarget', { kcal: Math.round(totFood.kcal) }) :
                    checkout.food === 4 ? t('checkin.foodLabel.over', { kcal: Math.round(totFood.kcal) }) :
                    checkout.food === 2 ? t('checkin.foodLabel.under', { kcal: Math.round(totFood.kcal) }) :
                    t('checkin.foodLabel.notFollowed', { kcal: Math.round(totFood.kcal) });

  // Weekplanning morgen
  const _coMorgen = new Date(); _coMorgen.setDate(_coMorgen.getDate() + 1);
  const _coMorgenStr = localDateStr(_coMorgen);
  const _coMorgenWpEntry = (JSON.parse(localStorage.getItem('prime_planning') || '[]')).find(p => p.date === _coMorgenStr) || null;
  const _coMorgenNaam = _coMorgenWpEntry ? wpGetDisplay(_coMorgenWpEntry.schemaId).naam : null;

  const tomorrowLine = _coMorgenNaam ? t('checkin.tomorrowPlanned', { naam: _coMorgenNaam }) : t('checkin.tomorrowNotPlanned');
  const context = t('checkin.contextTemplate', {
    trainingNaam: _coWpNaam, trainingLabel, foodLabel, prot: Math.round(totFood.prot), energyLabel, tomorrowLine
  });

  // Prompt 1: afsluitend bericht
  const promptAfsluiting = context + t('checkin.promptAfsluiting');

  btn.textContent = t('checkin.dayDoneBtn');
  btn.style.background = 'var(--sage)';

  // Render meteen het "dag afgerond"-blok zodat de gebruiker feedback ziet
  const container = btn.parentElement;
  const tomorrowDiv = document.createElement('div');
  tomorrowDiv.id = 'tomorrow-card';
  tomorrowDiv.innerHTML = `
    <div class="success-banner" style="margin-top:16px">
      <h3>${t('checkin.dayDone')}</h3>
      <p id="afsluiting-text" style="color:#3d6649;font-size:14px;line-height:1.7">${t('checkin.loading')}</p>
    </div>`;
  container.appendChild(tomorrowDiv);

  // Bij een rust-, ziekte- of vrije dag: een vaste, zachte afsluiting i.p.v. het standaardbericht.
  const _dsCo = getDagStatus(_coToday);
  if (_dsCo !== 'normaal') {
    document.getElementById('afsluiting-text').textContent = t('dagstatus.closing.' + _dsCo);
    updateStreak();
    try { renderDagStatusKaart(); renderCheckoutDagStatus(); } catch (e) { console.error(e); }
    return;
  }

  // Call 1: afsluitend bericht (kort)
  try {
    const afsluiting = await callClaude(promptAfsluiting, [], 150);
    document.getElementById('afsluiting-text').textContent = afsluiting;
  } catch(e) {
    console.error('Afsluiting fout:', e);
    document.getElementById('afsluiting-text').textContent = t('checkin.closingFallback');
  }

  updateStreak();
  try { renderDagStatusKaart(); renderCheckoutDagStatus(); } catch (e) { console.error(e); }
}

function badgeHTML(type) {
  const cfg = {
    herstel: ['badge-light', t('checkin.badge.recovery')],
    normaal: ['badge-normal', t('checkin.badge.normal')],
    zwaar: ['badge-heavy', t('checkin.badge.heavy')]
  }[type];
  return `<div class="training-type-badge ${cfg[0]}">${cfg[1]}</div>`;
}


// ========== DAGSTATUS (Normaal / Rustdag / Ziek / Vrij) ==========
// Per datum bewaard in dagStatus (state.js, key prime_dagstatus): { 'JJJJ-MM-DD': 'rust' | 'ziek' | 'vrij' };
// ontbreekt een datum, dan is het een normale dag. Je kunt de status de hele dag aanpassen (Dashboard en
// bij de check-out); na de check-out ligt hij vast en kan alleen de coach hem nog wijzigen.
// Gevolgen: training telt niet als gemist (rust, ziek, vrij); voeding wordt bij ziek en vrij niet
// beoordeeld en telt niet mee in gemiddelden (bij rust wel); de reeks blijft behouden; berichten
// worden zachter.
const DAGSTATUS_LIJST = ['normaal', 'rust', 'ziek', 'vrij'];
const DAGSTATUS_ICOON = { normaal: '☀️', rust: '🛌', ziek: '🌡️', vrij: '🏖️' };

function dagStatusVan(statusObj, dateStr) {
  const s = statusObj && statusObj[dateStr];
  return (s === 'rust' || s === 'ziek' || s === 'vrij') ? s : 'normaal';
}
function getDagStatus(dateStr) { return dagStatusVan(dagStatus, dateStr); }
function dagStatusAfwijkend(dateStr) { return getDagStatus(dateStr) !== 'normaal'; }
// Telt deze dag mee voor het beoordelen van voeding (doelen, percentages)? Rust: ja. Ziek en vrij: nee.
function dagStatusVoedingTelt(dateStr) { const s = getDagStatus(dateStr); return s === 'normaal' || s === 'rust'; }
// Telt een geplande training op deze dag mee (als gedaan of gemist)? Alleen op een normale dag.
function dagStatusTrainingTelt(dateStr) { return getDagStatus(dateStr) === 'normaal'; }
// Na de check-out ligt de dagstatus vast.
function dagStatusVast(dateStr) { return history.some(function(h) { return h.date === dateStr; }); }
function dagStatusKanWijzigen(dateStr) { return isPrimeCoach() || !dagStatusVast(dateStr); }

// True als alle dagen tussen twee datums (zonder die twee zelf) een afwijkende dagstatus hebben, of als
// de datums op elkaar aansluiten: zo'n gat onderbreekt de reeks niet. statusObj = dagstatus van die klant.
function dagStatusGatOverbrugd(vanStr, totStr, statusObj) {
  const a = new Date(vanStr + 'T12:00:00'), b = new Date(totStr + 'T12:00:00');
  const n = Math.round((b - a) / 86400000);
  if (n < 1) return false;
  for (let i = 1; i < n; i++) {
    const d = new Date(a.getTime()); d.setDate(d.getDate() + i);
    if (dagStatusVan(statusObj, localDateStr(d)) === 'normaal') return false;
  }
  return true;
}

function setDagStatus(dateStr, status) {
  if (DAGSTATUS_LIJST.indexOf(status) < 0) return false;
  if (!dagStatusKanWijzigen(dateStr)) return false;
  const nieuw = Object.assign({}, dagStatus);
  if (status === 'normaal') delete nieuw[dateStr]; else nieuw[dateStr] = status;
  dagStatus = nieuw;
  syncSet('prime_dagstatus', dagStatus);
  return true;
}

function dagStatusBadgeHtml(s) {
  if (s === 'normaal') return '';
  return '<span class="ds-badge ds-b-' + s + '">' + DAGSTATUS_ICOON[s] + ' ' + t('dagstatus.' + s) + '</span>';
}

function dagStatusKnoppenHtml(huidig, vast, handler) {
  return '<div class="ds-chips">' + DAGSTATUS_LIJST.map(function(s) {
    const sel = huidig === s;
    return '<button type="button" class="ds-chip' + (sel ? ' sel ds-' + s : '') + '"' +
      (vast ? ' disabled' : ' onclick="' + handler + '(\'' + s + '\')"') +
      ' aria-pressed="' + sel + '"><span class="ds-emoji">' + DAGSTATUS_ICOON[s] + '</span><span>' + t('dagstatus.' + s) + '</span></button>';
  }).join('') + '</div>';
}

function dagStatusGevolgenHtml(s) {
  if (s === 'normaal') return '<div class="ds-gevolg"><div class="ds-row">' + t('dagstatus.gevolg.normaal') + '</div></div>';
  return '<div class="ds-gevolg">' + ['voeding', 'training', 'reeks'].filter(function(k) { return !(k === 'voeding' && profile.foodEnabled === false); }).map(function(k) {
    return '<div class="ds-row"><b>' + t('dagstatus.k.' + k) + '</b><span>' + t('dagstatus.' + s + '.' + k) + '</span></div>';
  }).join('') + '</div>';
}

// Kaart op het Dashboard (de hele dag zichtbaar, ook vóór de check-in).
function renderDagStatusKaart() {
  // De kaart staat op drie plekken (voor de check-in, onder het lichtgroene vlak na de check-in en na het afsluiten); alleen de zichtbare telt.
  const slots = document.querySelectorAll('.dagstatus-slot');
  if (!slots.length) return;
  const dag = localDateStr();
  const s = getDagStatus(dag);
  const vast = dagStatusVast(dag);
  const html = '<div class="card ds-kaart">' +
    '<div class="ds-kop"><span class="ds-titel">' + t('dagstatus.title') + '</span>' + (vast ? '<span aria-hidden="true">🔒</span>' : '') + '</div>' +
    dagStatusKnoppenHtml(s, vast, 'kiesDagStatus') +
    dagStatusGevolgenHtml(s) +
    '<div class="ds-hint">' + t(vast ? 'dagstatus.hint.vast' : 'dagstatus.hint.open') + '</div>' +
    '</div>';
  slots.forEach(function(el) { el.innerHTML = html; });
}

// Zelfde keuze nog eens bij de avond check-out, met de gevolgen erbij.
function renderCheckoutDagStatus() {
  const el = document.getElementById('co-dagstatus');
  if (!el) return;
  const dag = localDateStr();
  const s = getDagStatus(dag);
  const vast = dagStatusVast(dag);
  el.innerHTML = '<div class="ds-kop"><span class="ds-titel">' + t('dagstatus.checkout.title') + '</span>' + (vast ? '<span aria-hidden="true">🔒</span>' : '') + '</div>' +
    dagStatusKnoppenHtml(s, vast, 'kiesDagStatus') +
    dagStatusGevolgenHtml(s) +
    '<div class="ds-hint">' + t(vast ? 'dagstatus.hint.vast' : 'dagstatus.checkout.hint') + '</div>';
}

// Zachtere toon onder de begroeting bij een rust-, ziekte- of vrije dag.
function applyDagStatusTone() {
  const s = getDagStatus(localDateStr());
  if (s === 'normaal' || dagStatusVast(localDateStr())) return;
  const el = document.getElementById('hero-sub');
  if (el) el.innerHTML = t('dagstatus.sub.' + s);
}

// Bij Ziek slaan we de trainingsvraag in de check-out over (die past dan niet); de training telt toch niet mee.
// Voor alle andere statussen komt het blok terug zoals het hoort (applyTrainingVisibility houdt rekening met
// de profielinstelling "training uit").
function applyDagStatusTraining() {
  const blok = document.getElementById('training-summary-block');
  const lijn = document.getElementById('divider-after-training-summary');
  if (!blok) return;
  if (getDagStatus(localDateStr()) === 'ziek') {
    blok.style.display = 'none';
    if (lijn) lijn.style.display = 'none';
    if (!(checkout.training > 0)) checkout.training = 1; // geen antwoord nodig, zodat de dag afgerond kan worden
  } else if (typeof applyTrainingVisibility === 'function') {
    applyTrainingVisibility();
  }
  try { checkCheckoutReady(); } catch (e) { /* check-out nog niet zichtbaar */ }
}

function kiesDagStatus(s) {
  if (!setDagStatus(localDateStr(), s)) return;
  try { renderHome(); } catch (e) {
    console.error('kiesDagStatus:', e);
    renderDagStatusKaart(); renderCheckoutDagStatus();
  }
}

// Coach: dagstatus van een willekeurige dag wijzigen (ook na de check-out), bv. in Weekplanning.
function coachZetDagStatus(dateStr, s) {
  if (!isPrimeCoach()) return;
  if (!setDagStatus(dateStr, s)) return;
  try { renderFoodWeek(); } catch (e) { console.error(e); }
  try { renderWeekplanning(); } catch (e) { console.error(e); }
  try { if (dateStr === localDateStr()) renderHome(); else updateStreak(); } catch (e) { console.error(e); }
}

function dagStatusCoachRijHtml(dateStr) {
  const s = getDagStatus(dateStr);
  return '<div class="ds-coachrij"><span>' + t('dagstatus.coach.label') + '</span>' +
    '<select class="coach-only-btn" onchange="coachZetDagStatus(\'' + dateStr + '\', this.value)">' +
    DAGSTATUS_LIJST.map(function(x) { return '<option value="' + x + '"' + (x === s ? ' selected' : '') + '>' + DAGSTATUS_ICOON[x] + ' ' + t('dagstatus.' + x) + '</option>'; }).join('') +
    '</select></div>';
}

// ----- Check-out: voeding die gepland maar niet afgevinkt is -----
// Toont de items die bij het openen nog niet waren afgevinkt als lijstje met een groen vinkje per item, zoals bij
// Voeding: tik op het vinkje (of de regel) om het aan of uit te zetten. Een item blijft in het lijstje staan ook
// nadat je het hebt afgevinkt, zodat je je altijd kunt corrigeren. Na het afronden van de dag ligt het vast.
let _coItemIds = []; // logIds die ooit niet-afgevinkt in dit lijstje zijn gekomen

function foodOnbevestigdHtml() {
  if (profile.foodEnabled === false) return ''; // Voeding staat uit voor deze klant
  if (!_coControle) return ''; // overdag niets tonen: pas bij het afronden van de dag
  const dag = localDateStr();
  dayLog.forEach(function(i) { if (!isEatenItem(i) && _coItemIds.indexOf(i.logId) < 0) _coItemIds.push(i.logId); });
  const lijst = dayLog.filter(function(i) { return _coItemIds.indexOf(i.logId) >= 0; });
  if (!lijst.length) return '';
  const open = lijst.filter(function(i) { return !isEatenItem(i); });
  if (!magAfvinken(dag)) {
    // Dag afgesloten: niets meer te kiezen, alleen nog een korte melding over wat gepland bleef.
    if (!open.length) return '';
    const kcal = Math.round(open.reduce(function(a, i) { return a + (i.kcal || 0); }, 0));
    return '<div style="font-size:12px;color:var(--muted);margin-top:10px">' + t('checkin.food.plannedNote', { kcal: kcal }) + '</div>';
  }
  const rijen = lijst.map(function(i) {
    const gegeten = isEatenItem(i);
    return '<div class="co-vink-rij" onclick="coToggleItem(' + i.logId + ')">' +
      '<span class="co-vink-naam">' + escapeHtml(dispName(i) || i.name || '') + '</span>' +
      '<span class="co-vink-kcal">' + Math.round(i.kcal || 0) + ' kcal</span>' +
      '<div class="exercise-check co-vink-vink' + (gegeten ? ' done' : ' co-vink-open') + '">' + (gegeten ? '✓' : '✗') + '</div></div>';
  }).join('');
  return '<div class="co-ob ' + (open.length ? 'co-ob-open' : 'co-ob-klaar') + '"><div class="co-ob-titel">' +
    (open.length ? t('checkin.food.list.titleOpen', { n: open.length }) : t('checkin.food.list.titleDone')) + '</div>' + rijen +
    '<div class="co-ob-vraag">' + t('checkin.food.list.hint') + '</div></div>';
}

// Zet een item aan/uit als gegeten en ververst daarna de check-out-samenvatting (inname en status).
function coToggleItem(logId) {
  const dag = localDateStr();
  if (!magAfvinken(dag)) return;
  toggleFoodEaten(dag, logId);
  buildFoodSummary();
}

// ----- Check-out: training die gepland maar niet afgevinkt is -----
// Zelfde idee als bij Voeding (foodOnbevestigdHtml): de oefeningen en sessies van vandaag die bij het openen nog
// niet waren afgevinkt, als lijstje met een groen vinkje rechts dat je aan of uit kunt zetten. Een item blijft in
// het lijstje staan nadat je het hebt afgevinkt, zodat je je altijd kunt corrigeren. Na het afronden ligt het vast.
let _coControle = false; // true na de eerste tik op "Dag afronden" als er nog iets niet is afgevinkt
let _coTrLaatste = null; // { alle, isDone } van de laatste samenvatting, voor de controlestap
let _coTrIds = [];   // ex.id waarden die ooit niet-afgevinkt in dit lijstje zijn gekomen
let _coTrItems = []; // huidige lijst, zodat de onclick met een volgnummer kan werken

function coTrainingLijstHtml(allItems, isDone) {
  _coTrLaatste = { alle: allItems, isDone: isDone };
  if (!_coControle) return ''; // overdag niets tonen: pas bij het afronden van de dag
  const dag = localDateStr();
  allItems.forEach(function(ex) { if (!isDone(ex) && _coTrIds.indexOf(ex.id) < 0) _coTrIds.push(ex.id); });
  const lijst = allItems.filter(function(ex) { return _coTrIds.indexOf(ex.id) >= 0; });
  _coTrItems = lijst;
  if (!lijst.length || !magAfvinken(dag)) return '';
  const open = lijst.filter(function(ex) { return !isDone(ex); });
  const rijen = lijst.map(function(ex, idx) {
    const naam = isSessie(ex) ? (sessieIcon(ex.sessieType) + ' ' + escapeHtml(ex.name)) : escapeHtml(dispName(ex) || ex.name || '');
    return '<div class="co-vink-rij" onclick="coToggleTraining(' + idx + ')">' +
      '<span class="co-vink-naam">' + naam + '</span>' +
      '<div class="exercise-check co-vink-vink' + (isDone(ex) ? ' done' : ' co-vink-open') + '">' + (isDone(ex) ? '✓' : '✗') + '</div></div>';
  }).join('');
  return '<div class="co-ob ' + (open.length ? 'co-ob-open' : 'co-ob-klaar') + '"><div class="co-ob-titel">' +
    (open.length ? t('checkin.food.list.titleOpen', { n: open.length }) : t('checkin.food.list.titleDone')) + '</div>' + rijen +
    '<div class="co-ob-vraag">' + t('checkin.training.list.hint') + '</div></div>';
}

// Zet een oefening of sessie aan/uit als gedaan (op dezelfde manier als in Training zelf) en ververst de samenvatting.
function coToggleTraining(idx) {
  const ex = _coTrItems[idx];
  const dag = localDateStr();
  if (!ex || !magAfvinken(dag)) return;
  if (isSessie(ex)) toggleSessieDone(dag, ex.id);
  else if (String(ex.id).indexOf('wp-') === 0) toggleWpMijnDag(dag, ex._wpKey, parseInt(String(ex.id).slice(3), 10));
  else toggleDagDone(ex.id);
  buildTrainingSummary();
}

// Knop "Dag afronden": is alles afgevinkt, dan meteen afsluiten. Staat er nog iets niet afgevinkt (voeding of
// training), dan eerst een controlestap: de rode lijstjes verschijnen, je corrigeert wat nodig is en tikt daarna
// op "Dag definitief afsluiten". Overdag zie je die lijstjes dus niet.
function afrondenKlik() {
  try { noteFlush(); } catch (e) { console.error(e); }
  if (_coControle) { doCheckout(); return; }
  const voedingOpen = profile.foodEnabled !== false && dayLog.some(function(i) { return !isEatenItem(i); });
  const ziek = getDagStatus(localDateStr()) === 'ziek'; // bij Ziek is er geen trainingsvraag
  const trainingOpen = !ziek && !!_coTrLaatste && _coTrLaatste.alle.some(function(ex) { return !_coTrLaatste.isDone(ex); });
  if (!voedingOpen && !trainingOpen) { doCheckout(); return; }
  _coControle = true;
  const vEl = document.getElementById('co-onbevestigd');
  if (vEl) vEl.innerHTML = foodOnbevestigdHtml();
  const tEl = document.getElementById('co-tr-onbevestigd');
  if (tEl && _coTrLaatste) tEl.innerHTML = coTrainingLijstHtml(_coTrLaatste.alle, _coTrLaatste.isDone);
  const btn = document.getElementById('checkout-btn');
  if (btn) btn.textContent = t('checkout.finalize');
  const eerste = document.querySelector('#training-summary-content .co-ob, #co-onbevestigd .co-ob');
  if (eerste && eerste.scrollIntoView) eerste.scrollIntoView({ behavior: 'smooth', block: 'center' });
}


// ========== TOELICHTING AAN DE COACH (optie in Config) ==========
// Staat per klant aan of uit (profile.noteEnabled) met een maximaal aantal regels (profile.noteLines, 1 t/m 10).
// De tekst staat per datum in dagNotes (state.js, key prime_notes): { 'JJJJ-MM-DD': { text, ts } }, één toelichting
// per dag die je de hele dag kunt aanpassen. Twee plekken: een veld in de check-in (onder de stressvraag) en daarna,
// in de plaats daarvan, een knop die een venster opent (bij de check-out en na het afsluiten van de dag). De coach
// leest de toelichtingen bij Signalen (history.js).
const NOTE_CHIPS = ['note.chip.work', 'note.chip.time', 'note.chip.home', 'note.chip.worry', 'note.chip.pain'];

function noteAan() { return profile.noteEnabled === true; }
function noteRegels() { const n = parseInt(profile.noteLines, 10); return n >= 1 && n <= 10 ? n : 4; }
function noteVan(dateStr) { const n = dagNotes[dateStr]; return n && n.text ? n.text : ''; }

function noteBewaar(dateStr, text) {
  text = String(text || '').replace(/\s+$/, '');
  if (text === noteVan(dateStr)) return false;
  const nieuw = Object.assign({}, dagNotes);
  if (text) nieuw[dateStr] = { text: text, ts: Date.now() }; else delete nieuw[dateStr];
  const datums = Object.keys(nieuw).sort(); // alleen de laatste 60 dagen bewaren
  datums.slice(0, Math.max(0, datums.length - 60)).forEach(function(d) { delete nieuw[d]; });
  dagNotes = nieuw;
  syncSet('prime_notes', dagNotes);
  return true;
}

// Aantal zichtbare regels in het tekstveld (inclusief regels die door lange tekst breken).
function noteMeet(el) {
  if (!el.value) return 0;
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight) || 20;
  const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const oud = el.style.height;
  el.style.height = '0px';
  const sh = el.scrollHeight;
  el.style.height = oud;
  return Math.max(1, Math.round((sh - pad) / lh));
}

function noteTeller(el) {
  const ctx = el.id.replace('note-ta-', '');
  const tel = document.getElementById('note-cnt-' + ctx);
  if (!tel) return;
  const max = noteRegels();
  const n = noteMeet(el);
  tel.textContent = t('note.count', { n: n, max: max });
  tel.classList.toggle('vol', n >= max);
}

// Houdt de tekst binnen het maximum aantal regels: een tik die over de rand gaat wordt teruggedraaid, een grote
// geplakte tekst wordt aan het eind ingekort.
function noteInput(el) {
  const max = noteRegels();
  let n = noteMeet(el);
  if (n > max) {
    const vorige = typeof el._vorige === 'string' ? el._vorige : '';
    if (Math.abs(el.value.length - vorige.length) <= 1) {
      el.value = vorige;
    } else {
      let guard = 0;
      while (n > max && el.value.length && guard++ < 3000) { el.value = el.value.slice(0, -1); n = noteMeet(el); }
    }
  }
  el._vorige = el.value;
  noteTeller(el);
}

function noteChip(ctx, i) {
  const el = document.getElementById('note-ta-' + ctx);
  if (!el) return;
  const tekst = t(NOTE_CHIPS[i]);
  const huidig = el.value.replace(/[\s,]+$/, '');
  el.value = huidig ? huidig + ', ' + tekst.charAt(0).toLowerCase() + tekst.slice(1) : tekst;
  noteInput(el);
  el.focus();
}

function noteEditorHtml(ctx) {
  const max = noteRegels();
  const chips = NOTE_CHIPS.map(function(k, i) {
    return '<button type="button" class="note-chip" onclick="noteChip(\'' + ctx + '\', ' + i + ')">' + t(k) + '</button>';
  }).join('');
  return '<div class="note-chips">' + chips + '</div>' +
    '<textarea id="note-ta-' + ctx + '" class="note-ta" rows="' + max + '" maxlength="' + (max * 120) + '" placeholder="' + _fbEsc(t('note.placeholder')) + '" ' +
    'oninput="noteInput(this)" onchange="noteAutoSave(this)">' + _fbEsc(noteVan(localDateStr())) + '</textarea>' +
    '<div class="note-teller"><span id="note-cnt-' + ctx + '"></span><span>' + t('note.private') + '</span></div>';
}

function noteEditorKlaar(ctx) {
  const el = document.getElementById('note-ta-' + ctx);
  if (!el) return;
  el._vorige = el.value;
  noteTeller(el);
}

// Het veld in de check-in bewaren bij het verlaten van het veld (en bij het starten van de dag).
function noteAutoSave(el) {
  if (!noteAan()) return;
  if (noteBewaar(localDateStr(), el.value)) noteKnopVernieuw();
}
function noteFlush() {
  if (!noteAan()) return;
  // Alleen een zichtbaar veld: het verborgen veld van de check-in kan na het starten van de dag een oudere tekst hebben.
  document.querySelectorAll('#ci-note .note-ta').forEach(function(x) { if (x.offsetParent !== null) noteAutoSave(x); });
}

function noteKnopHtml() {
  const tekst = noteVan(localDateStr());
  if (!tekst) return '<button type="button" class="note-knop" onclick="openNoteModal()">💬 <span>' + t('note.btn') + '</span></button>';
  const kort = tekst.length > 70 ? tekst.slice(0, 70).replace(/\s+\S*$/, '') + '…' : tekst;
  return '<button type="button" class="note-knop note-heeft" onclick="openNoteModal()"><span class="note-knop-kop">✓ ' + t('note.btnDone') + '</span>' +
    '<span class="note-knop-tekst">' + _fbEsc(kort.replace(/\s*\n\s*/g, ' ')) + '</span><span class="note-knop-edit">' + t('note.btnEdit') + '</span></button>';
}
function noteKnopVernieuw() {
  const html = noteAan() ? noteKnopHtml() : '';
  document.querySelectorAll('.note-knop-slot').forEach(function(el) { el.innerHTML = html; });
}

function openNoteModal() {
  if (!noteAan()) return;
  const body = document.getElementById('note-modal-body');
  if (!body) return;
  body.innerHTML = noteEditorHtml('m');
  document.getElementById('note-modal').classList.add('open');
  noteEditorKlaar('m');
  const el = document.getElementById('note-ta-m');
  if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
}
function closeNoteModal() { document.getElementById('note-modal').classList.remove('open'); }
function saveNoteModal() {
  const el = document.getElementById('note-ta-m');
  if (el && noteAan()) {
    noteBewaar(localDateStr(), el.value);
    noteKnopVernieuw();
    try { showToast(t('note.saved')); } catch (e) {}
  }
  closeNoteModal();
}

// Veld in de check-in, onder de stressvraag.
function renderCheckinNote(opnieuw) {
  const el = document.getElementById('ci-note');
  if (!el) return;
  if (!noteAan()) { el.innerHTML = ''; return; }
  if (el.querySelector('textarea') && !opnieuw) return;
  el.innerHTML = '<div class="cq-card note-kaart"><div class="cq-header"><span class="cq-icon">💬</span><span class="cq-label">' + t('note.checkin.title') + '</span></div>' +
    '<div class="note-sub">' + t('note.checkin.sub') + '</div>' + noteEditorHtml('ci') + '</div>';
  noteEditorKlaar('ci');
}

// Alles wat bij de toelichting hoort opbouwen of bijwerken: het veld in de check-in en de knop bij de check-out en na het
// afsluiten. opnieuw = true: ook het bestaande veld opnieuw opbouwen (bv. als de coach het aantal regels wijzigt).
function renderNoteUI(opnieuw) {
  const aan = noteAan();
  const co = document.getElementById('co-note');
  if (co) {
    if (!aan) co.innerHTML = '';
    else if (!co.querySelector('.note-knop-slot')) co.innerHTML = '<div class="note-knop-slot"></div><div class="divider" style="margin:18px 0"></div>';
  }
  noteKnopVernieuw();
  renderCheckinNote(opnieuw);
}


// ========== GEWICHTSLOGBOEK (altijd bewaard) + IMPORT ==========
// Elk gewicht staat ook in weightLog (state.js, key prime_weights): { 'JJJJ-MM-DD': kg }. Dat lijstje wordt nooit ingekort,
// in tegenstelling tot de dagrecords in history (max. HISTORY_MAX_DAGEN). Grafiek en gewichtsscherm lezen er dus uit.
function weightLogSet(dateStr, kg) {
  if (!(kg > 0) || !dateStr) return;
  const nieuw = Object.assign({}, weightLog);
  nieuw[dateStr] = kg;
  weightLog = nieuw;
  syncSet('prime_weights', weightLog);
}

// Kopieert gewichten die nog alleen in history of vandaag staan naar het logboek (eenmalig per ontbrekende datum).
function weightLogMigreer() {
  const nieuw = Object.assign({}, weightLog);
  let n = 0;
  history.forEach(function(h) {
    if (h && h.date && h.checkin && h.checkin.weight > 0 && !(nieuw[h.date] > 0)) { nieuw[h.date] = h.checkin.weight; n++; }
  });
  if (todayData && todayData.date && todayData.checkin && todayData.checkin.weight > 0 && !(nieuw[todayData.date] > 0)) { nieuw[todayData.date] = todayData.checkin.weight; n++; }
  if (n) { weightLog = nieuw; syncSet('prime_weights', weightLog); }
}

// Datum van "weeknummer + dag": ISO (week begint op maandag, dag 1 = maandag) of "zondag" (zoals Excel: week 1 bevat 1 januari,
// dag 1 = zondag).
function wgDatumVanWeek(jaar, week, dag, startZondag) {
  let start;
  if (startZondag) {
    const j1 = new Date(jaar, 0, 1);
    start = new Date(jaar, 0, 1 - j1.getDay());
  } else {
    const j4 = new Date(jaar, 0, 4);
    start = new Date(jaar, 0, 4 - ((j4.getDay() + 6) % 7));
  }
  start.setDate(start.getDate() + (week - 1) * 7 + (dag - 1));
  return localDateStr(start);
}

// Eén regel ("wk43.7 79,2", "2026-10-25 79.2", "25-10-2026 79,2") naar { datum, kg } of { fout }.
function wgParseRegel(regel, jaar, startZondag) {
  const delen = regel.trim().split(/[\s;]+/).filter(Boolean);
  if (delen.length < 2) return { fout: true };
  const kg = parseFloat(String(delen[delen.length - 1]).replace(',', '.'));
  if (!(kg >= 20 && kg <= 400)) return { fout: true };
  const d = delen[0];
  let datum = null, m;
  if ((m = d.match(/^wk(\d{1,2})[.,](\d)$/i))) {
    const week = parseInt(m[1], 10), dag = parseInt(m[2], 10);
    if (week < 1 || week > 53 || dag < 1 || dag > 7) return { fout: true };
    datum = wgDatumVanWeek(jaar, week, dag, startZondag);
  } else if ((m = d.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    datum = m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  } else if ((m = d.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/))) {
    const j = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
    datum = j + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  } else return { fout: true };
  if (isNaN(new Date(datum + 'T12:00:00').getTime()) || datum > localDateStr()) return { fout: true };
  return { datum: datum, kg: kg, regel: d };
}

function wgToonDatum(datum) {
  return new Date(datum + 'T12:00:00').toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function openWeightImport() {
  if (!isPrimeCoach()) return;
  const jaarEl = document.getElementById('wgimp-jaar');
  const nu = new Date().getFullYear();
  jaarEl.innerHTML = [nu, nu - 1].map(function(j) { return '<option value="' + j + '">' + j + '</option>'; }).join('');
  document.getElementById('wgimp-text').value = '';
  document.getElementById('wgimp-start').value = 'ma';
  document.getElementById('wgimp-preview').innerHTML = '';
  document.getElementById('wgimp-modal').classList.add('open');
  wgImportPreview();
}
function closeWeightImport() { document.getElementById('wgimp-modal').classList.remove('open'); }

function wgImportLees() {
  const tekst = document.getElementById('wgimp-text').value;
  const jaar = parseInt(document.getElementById('wgimp-jaar').value, 10);
  const zondag = document.getElementById('wgimp-start').value === 'zo';
  const ok = [], fout = [];
  tekst.split(/\r?\n/).forEach(function(r) {
    if (!r.trim()) return;
    const p = wgParseRegel(r, jaar, zondag);
    if (p.fout) fout.push(r); else ok.push(p);
  });
  return { ok: ok, fout: fout };
}

function wgImportPreview() {
  const el = document.getElementById('wgimp-preview');
  if (!el) return;
  const r = wgImportLees();
  if (!r.ok.length && !r.fout.length) { el.innerHTML = ''; return; }
  const bestaan = r.ok.filter(function(p) { return weightLog[p.datum] > 0 && weightLog[p.datum] !== p.kg; }).length;
  const gesorteerd = r.ok.slice().sort(function(a, b) { return a.datum.localeCompare(b.datum); });
  let html = '';
  if (r.ok.length) {
    html += '<div><b>' + t('weight.import.preview', { n: r.ok.length }) + '</b></div>' +
      '<div>' + t('weight.import.first', { regel: wmEscSafe(gesorteerd[0].regel), datum: wgToonDatum(gesorteerd[0].datum) }) + '</div>' +
      '<div>' + t('weight.import.last', { regel: wmEscSafe(gesorteerd[gesorteerd.length - 1].regel), datum: wgToonDatum(gesorteerd[gesorteerd.length - 1].datum) }) + '</div>';
    if (bestaan) html += '<div>' + t('weight.import.exists', { n: bestaan }) + '</div>';
  }
  if (r.fout.length) html += '<div style="color:#c0392b">' + t('weight.import.bad', { n: r.fout.length }) + '</div>';
  el.innerHTML = html;
}
function wmEscSafe(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function wgImportUitvoeren() {
  if (!isPrimeCoach()) return;
  const r = wgImportLees();
  const err = document.getElementById('wgimp-error');
  if (!document.getElementById('wgimp-text').value.trim()) { err.textContent = t('weight.import.empty'); return; }
  if (!r.ok.length) { err.textContent = t('weight.import.none'); return; }
  err.textContent = '';
  const nieuw = Object.assign({}, weightLog);
  r.ok.forEach(function(p) { nieuw[p.datum] = p.kg; });
  weightLog = nieuw;
  syncSet('prime_weights', weightLog);
  closeWeightImport();
  if (typeof renderHistory === 'function') { try { renderHistory(); } catch (e) { console.error(e); } }
  try { showToast(t('weight.import.done', { n: r.ok.length })); } catch (e) { console.error(e); }
}
