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
    return { id: 'wp-' + i, name: dispName(ex) || ('Oefening ' + (i+1)), _wpKey: wpOefKey(ex) };
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

  // Render tags
  let doneTags = '';
  allItems.forEach(function(ex) {
    let isDone = dagDone[ex.id];
    if (!isDone && ex.id.startsWith('wp-')) {
      isDone = _btsWpDoneArr.includes(parseInt(ex.id.replace('wp-', '')));
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
  const logged = dayLog.length;

  // Bereken werkelijke totalen uit daglog
  const tot = dayLog.reduce((a, i) => ({
    kcal: a.kcal + i.kcal,
    prot: a.prot + i.prot,
    carb: a.carb + i.carb,
    fat:  a.fat  + i.fat
  }), { kcal:0, prot:0, carb:0, fat:0 });

  const kcalPct = doel.kcal > 0 ? Math.round(tot.kcal / doel.kcal * 100) : 0;
  const protPct = doel.prot > 0 ? Math.round(tot.prot / doel.prot * 100) : 0;

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
  } else if (kcalPct >= 90 && kcalPct <= 115) {
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
  } else if (kcalPct > 115) {
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
    ${macroHTML}`;

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
    const _wpOef = wpGetOefeningen(_wpEntry.schemaId);
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
    document.getElementById('day-title').textContent = _trainLabel + t('home.readySuffix');
    document.getElementById('day-summary').textContent = t('day.summary.default');
  } catch {
    document.getElementById('day-title').textContent = _trainLabel + t('home.readySuffix');
    document.getElementById('day-summary').textContent = t('checkin.daySummaryFallback');
  }
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
  const totFood = dayLog.reduce((a,i) => ({ kcal:a.kcal+i.kcal, prot:a.prot+i.prot, carb:a.carb+i.carb, fat:a.fat+i.fat }), { kcal:0, prot:0, carb:0, fat:0 });

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

  // Prompt 2: advies voor morgen — gestructureerd
  const promptMorgen = context + t('checkin.promptMorgen');

  btn.textContent = t('checkin.dayDoneBtn');
  btn.style.background = 'var(--sage)';

  // Render lege tomorrow card meteen zodat gebruiker feedback ziet
  const container = btn.parentElement;
  const tomorrowDiv = document.createElement('div');
  tomorrowDiv.id = 'tomorrow-card';
  tomorrowDiv.innerHTML = `
    <div class="success-banner" style="margin-top:16px">
      <h3>${t('checkin.dayDone')}</h3>
      <p id="afsluiting-text" style="color:#3d6649;font-size:14px;line-height:1.7">${t('checkin.loading')}</p>
    </div>
    <div class="card" style="margin-top:16px;padding:0;overflow:hidden">
      <div style="background:var(--charcoal);padding:16px 20px;display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">🌙</span>
        <div>
          <div style="font-family:'DM Serif Display',serif;font-size:17px;color:white">${t('checkin.tomorrowReady')}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:2px" id="tomorrow-date"></div>
        </div>
      </div>
      <div id="tomorrow-content" style="padding:20px">
        <div style="text-align:center;padding:20px;color:var(--muted);font-size:14px">${t('checkin.compilingAdvice')}</div>
      </div>
    </div>`;
  container.appendChild(tomorrowDiv);

  // Zet morgen datum
  const morgen = new Date(); morgen.setDate(morgen.getDate() + 1);
  document.getElementById('tomorrow-date').textContent = morgen.toLocaleDateString(dateLocale(), { weekday:'long', day:'numeric', month:'long' });

  // Call 1: afsluitend bericht (kort)
  try {
    const afsluiting = await callClaude(promptAfsluiting, [], 150);
    document.getElementById('afsluiting-text').textContent = afsluiting;
  } catch(e) {
    console.error('Afsluiting fout:', e);
    document.getElementById('afsluiting-text').textContent = t('checkin.closingFallback');
  }

  // Call 2: advies voor morgen (meer tokens nodig voor gestructureerde output)
  try {
    const morgenAdvies = await callClaude(promptMorgen, [], 600);
    console.log('Morgen advies response:', morgenAdvies);
    renderTomorrowAdvice(morgenAdvies);
  } catch(e) {
    console.error('Morgen advies fout:', e);
    // Fallback: render een basis advies zonder AI
    renderTomorrowFallback();
  }

  updateStats();
}

function renderTomorrowAdvice(text) {
  const lines = text.split('\n').filter(function(l) { return l.trim(); });
  const parsed = {};
  lines.forEach(function(line) {
    const match = line.match(/^(TRAINING|VOEDING|SLAAP|TIP|NUTRITION|SLEEP):\s*(.+)$/);
    if (match) {
      const key = { NUTRITION:'VOEDING', SLEEP:'SLAAP' }[match[1]] || match[1];
      parsed[key] = match[2].trim();
    }
  });

  // Weekplanning voor morgen
  const morgenDate = new Date(); morgenDate.setDate(morgenDate.getDate() + 1);
  const morgenStr = localDateStr(morgenDate);
  const morgenWpEntry = (JSON.parse(localStorage.getItem('prime_planning') || '[]')).find(function(p) { return p.date === morgenStr; }) || null;
  const morgenDisp = morgenWpEntry ? wpGetDisplay(morgenWpEntry.schemaId) : null;
  const morgenOef = morgenWpEntry ? (wpGetOefeningen(morgenWpEntry.schemaId) || []) : [];

  const sections = [
    { key:'TRAINING', icon:'\u{1F3CB}', label:t('checkin.section.trainingNotes') },
    { key:'VOEDING',  icon:'\u{1F957}', label:t('checkin.section.food') },
    { key:'SLAAP',    icon:'\u{1F634}', label:t('checkin.section.sleep') },
    { key:'TIP',      icon:'\u{1F4A1}', label:t('checkin.section.coachTip') },
  ];

  let badgeHtml = '';
  if (morgenDisp) {
    badgeHtml = '<div style="margin-bottom:16px"><div class="training-type-badge badge-normal" style="display:inline-flex">'
      + morgenDisp.icon + ' ' + morgenDisp.naam + '</div>'
      + (morgenOef.length > 0 ? '<div style="font-size:12px;color:var(--muted);margin-top:6px">' + morgenOef.slice(0,3).map(function(o){ return dispName(o); }).join(' \xB7 ') + (morgenOef.length > 3 ? ' +' + (morgenOef.length-3) + t('home.more') : '') + '</div>' : '')
      + '</div>';
  } else {
    badgeHtml = '<div style="margin-bottom:16px"><div class="training-type-badge badge-light" style="display:inline-flex">' + t('checkin.noTrainingTomorrow') + '</div></div>';
  }

  let sectionsHtml = sections.map(function(s) {
    if (!parsed[s.key]) return '';
    return '<div style="display:flex;gap:12px;margin-bottom:14px;align-items:flex-start">'
      + '<div style="width:32px;height:32px;border-radius:8px;background:var(--sand);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">' + s.icon + '</div>'
      + '<div>'
      + '<div style="font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;color:var(--muted);margin-bottom:3px">' + s.label + '</div>'
      + '<div style="font-size:14px;line-height:1.6;color:var(--charcoal)">' + parsed[s.key] + '</div>'
      + '</div></div>';
  }).join('');

  document.getElementById('tomorrow-content').innerHTML = badgeHtml + sectionsHtml
    + '<div style="margin-top:16px;padding:12px 16px;background:var(--sage-light);border-radius:10px;border-left:3px solid var(--sage)">'
    + '<div style="font-size:12px;font-weight:600;color:var(--sage);margin-bottom:4px">' + t('checkin.dontForget') + '</div>'
    + '<div style="font-size:13px;color:#3d6649">' + t('checkin.checkTomorrow') + '</div>'
    + '</div>';
}

function renderTomorrowFallback() {
  const morgenDate = new Date(); morgenDate.setDate(morgenDate.getDate() + 1);
  const morgenStr = localDateStr(morgenDate);
  const morgenWpEntry = (JSON.parse(localStorage.getItem('prime_planning') || '[]')).find(function(p) { return p.date === morgenStr; }) || null;
  const morgenDisp = morgenWpEntry ? wpGetDisplay(morgenWpEntry.schemaId) : null;
  const morgenOef = morgenWpEntry ? (wpGetOefeningen(morgenWpEntry.schemaId) || []) : [];

  const tip = checkout.training < 3 ? t('checkin.tip.smallSteps') : t('checkin.tip.consistency');

  let badgeHtml = '';
  if (morgenDisp) {
    badgeHtml = '<div style="margin-bottom:16px"><div class="training-type-badge badge-normal" style="display:inline-flex">'
      + morgenDisp.icon + ' ' + morgenDisp.naam + '</div>'
      + (morgenOef.length > 0 ? '<div style="font-size:12px;color:var(--muted);margin-top:6px">' + morgenOef.slice(0,3).map(function(o){ return dispName(o); }).join(' \xB7 ') + (morgenOef.length > 3 ? ' +' + (morgenOef.length-3) + t('home.more') : '') + '</div>' : '')
      + '</div>';
  } else {
    badgeHtml = '<div style="margin-bottom:16px"><div class="training-type-badge badge-light" style="display:inline-flex">' + t('checkin.noTrainingTomorrow') + '</div></div>';
  }

  const items = [
    { icon:'\u{1F957}', label:t('checkin.section.food'), text:t('checkin.fallback.foodText') },
    { icon:'\u{1F634}', label:t('checkin.section.sleep'), text:t('checkin.fallback.sleepText') },
    { icon:'\u{1F4A1}', label:t('checkin.section.coachTip'), text: tip },
  ];

  const sectionsHtml = items.map(function(s) {
    return '<div style="display:flex;gap:12px;margin-bottom:14px;align-items:flex-start">'
      + '<div style="width:32px;height:32px;border-radius:8px;background:var(--sand);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">' + s.icon + '</div>'
      + '<div>'
      + '<div style="font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;color:var(--muted);margin-bottom:3px">' + s.label + '</div>'
      + '<div style="font-size:14px;line-height:1.6;color:var(--charcoal)">' + s.text + '</div>'
      + '</div></div>';
  }).join('');

  document.getElementById('tomorrow-content').innerHTML = badgeHtml + sectionsHtml
    + '<div style="margin-top:16px;padding:12px 16px;background:var(--sage-light);border-radius:10px;border-left:3px solid var(--sage)">'
    + '<div style="font-size:13px;color:#3d6649">' + t('checkin.checkTomorrow') + '</div>'
    + '</div>';
}
function badgeHTML(type) {
  const cfg = {
    herstel: ['badge-light', t('checkin.badge.recovery')],
    normaal: ['badge-normal', t('checkin.badge.normal')],
    zwaar: ['badge-heavy', t('checkin.badge.heavy')]
  }[type];
  return `<div class="training-type-badge ${cfg[0]}">${cfg[1]}</div>`;
}
