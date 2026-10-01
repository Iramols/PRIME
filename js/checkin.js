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
  const entry = history.find(h => h.date === dateStr);
  return (entry && entry.checkin && entry.checkin.weight) || null;
}

function setWeightForDate(dateStr, gewicht) {
  if (todayData && todayData.date === dateStr) {
    todayData.checkin = todayData.checkin || {};
    todayData.checkin.weight = gewicht;
    syncSet('prime_today', todayData);
  } else {
    let entry = history.find(h => h.date === dateStr);
    if (!entry) {
      entry = { date: dateStr, checkin: {}, checkout: null };
      history.push(entry);
      history.sort((a, b) => b.date.localeCompare(a.date));
      if (history.length > 60) history = history.slice(0, 60);
    }
    entry.checkin = entry.checkin || {};
    entry.checkin.weight = gewicht;
    syncSet('prime_history', history);
  }
  // Zelfde als bij een normale check-in (doCheckin() hierboven): het
  // profielgewicht bijwerken als dit de meest recente bekende dag is.
  const meestRecenteDag = (todayData && todayData.date) || (history.length && history[0].date);
  if (dateStr === meestRecenteDag) {
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

function buildTrainingSummary() {
  // Weekplanning oefeningen voor vandaag
  const _btsToday = localDateStr();
  // Altijd synchroon houden met trainingDays (zie state.js/training.js)
  trainingDagLog = trainingDays[_btsToday] || [];
  const _btsWpEntry = (JSON.parse(localStorage.getItem('prime_planning') || '[]')).find(p => p.date === _btsToday) || null;
  const _btsWpDoneArr = wpGetDone(_btsToday); // migreert oude numerieke data indien nodig, zie weekplanning.js
  const _btsWpOef = _btsWpEntry ? wpGetOefeningen(_btsWpEntry.schemaId) : [];
  const wpItems = _btsWpOef.map(function(ex, i) {
    return { id: 'wp-' + i, name: dispName(ex) || ('Oefening ' + (i+1)), _wpKey: wpOefKey(ex, i, _btsWpOef) };
  });

  const allItems = wpItems.concat(trainingDagLog);
  const total = allItems.length;

  // Tel afgevinkte: dagDone voor schema-tab en losse, prime_wp_done voor
  // weekplanning (gematcht op de stabiele naam-sleutel, zie wpOefKey()).
  let done = 0;
  allItems.forEach(function(ex) {
    let isDone = dagDone[ex.id];
    if (!isDone && ex.id.startsWith('wp-')) {
      isDone = _btsWpDoneArr.includes(ex._wpKey);
    }
    if (isDone) done++;
  });

  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  const typeLabel = _btsWpEntry ? wpGetDisplay(_btsWpEntry.schemaId).naam : t('checkin.noTraining');

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
    let isDone = dagDone[ex.id];
    if (!isDone && ex.id.startsWith('wp-')) {
      isDone = _btsWpDoneArr.includes(ex._wpKey);
    }
    doneTags += isDone
      ? '<span class="done-tag">✓ ' + ex.name + '</span>'
      : '<span class="skipped-tag">' + ex.name + '</span>';
  });

  document.getElementById('training-summary-content').innerHTML =
    '<div class="training-status-row">'
    + '<span class="training-status-icon">' + statusIcon + '</span>'
    + '<div><div class="training-status-text">' + status + '</div>'
    + '<div class="training-status-sub">' + typeLabel + '</div></div></div>'
    + '<div class="training-done-list">' + doneTags + '</div>';

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
    ${_split.planned.kcal > 0 ? '<div style="font-size:12px;color:var(--muted);margin-top:10px">' + t('checkin.food.plannedNote', { kcal: Math.round(_split.planned.kcal) }) + '</div>' : ''}`;

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
  const btn = document.getElementById('checkin-btn');
  btn.disabled = true; btn.textContent = t('checkin.analyzing');

  trainingType = calcTrainingType();
  const mealData = MEALS[trainingType];

  // Gewicht opslaan in profiel als ingevuld
  if (checkin.weight && checkin.weight > 0) {
    profile.weight = checkin.weight;
    syncSet('prime_profile', profile);
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
    document.getElementById('home-training-preview').innerHTML = _wpOef.slice(0,3).map(o => dispName(o)).join(' &nbsp;·&nbsp; ') + (_wpOef.length > 3 ? ' &nbsp;+' + (_wpOef.length - 3) + t('home.more') : '');
  } else {
    document.getElementById('home-training-badge').innerHTML = '<div class="training-type-badge badge-light">' + t('home.noTrainingSelected') + '</div>';
    document.getElementById('home-training-preview').innerHTML = t('home.noTrainingToday');
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
}

async function doCheckout() {
  const btn = document.getElementById('checkout-btn');
  btn.disabled = true;
  btn.textContent = t('checkin.preparingAdvice');

  // Save to history
  if (todayData) {
    todayData.checkout = checkout;
    history.unshift(todayData);
    if (history.length > 60) history.pop();
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

  // Call 1: afsluitend bericht (kort)
  try {
    const afsluiting = await callClaude(promptAfsluiting, [], 150);
    document.getElementById('afsluiting-text').textContent = afsluiting;
  } catch(e) {
    console.error('Afsluiting fout:', e);
    document.getElementById('afsluiting-text').textContent = t('checkin.closingFallback');
  }

  updateStats();
}

function badgeHTML(type) {
  const cfg = {
    herstel: ['badge-light', t('checkin.badge.recovery')],
    normaal: ['badge-normal', t('checkin.badge.normal')],
    zwaar: ['badge-heavy', t('checkin.badge.heavy')]
  }[type];
  return `<div class="training-type-badge ${cfg[0]}">${cfg[1]}</div>`;
}
