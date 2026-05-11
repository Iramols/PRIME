// ========== CHECK-IN ==========
function pick(key, val, btn) {
  btn.closest('.emoji-scale').querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  checkin[key] = val;
  const ready = checkin.sleep > 0 && checkin.energy > 0 && checkin.stress > 0;
  document.getElementById('checkin-btn').disabled = !ready;
}

function pickOut(key, val, btn) {
  btn.closest('.emoji-scale').querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
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
  // Altijd sessionStorage laden
  try {
    const s = sessionStorage.getItem('prime_training_dag');
    if (s) trainingDagLog = JSON.parse(s);
    const a = sessionStorage.getItem('prime_active_schema');
    if (a) activeSchemaId = a;
  } catch(e) {}

  // Bouw volledige lijst van alle oefeningen in Mijn dag
  try {
    const ssi = sessionStorage.getItem('prime_schema_items');
    if (ssi) selectedSchemaItems = JSON.parse(ssi);
  } catch(e) {}

  const activeSchema = activeSchemaId ? TRAINING_SCHEMAS.find(s => s.id === activeSchemaId) : null;
  const schemaTabItems = activeSchema
    ? activeSchema.oefeningen.map(function(ex, i) { return Object.assign({}, ex, {id:'schema-tab-'+i, _idx:i}); })
        .filter(function(ex) { return selectedSchemaItems[activeSchemaId + '-' + ex._idx] !== false; })
    : [];

  const exs = (trainingType && EXERCISES[trainingType]) ? EXERCISES[trainingType] : [];
  if (exs.length > 0 && Object.keys(selectedSchemaEx).length === 0) initSchemaEx();
  const schemaItems = exs.map(function(ex, i) {
    if (selectedSchemaEx[trainingType+'-'+i] === false) return null;
    return Object.assign({}, getActiveEx(i), {id:'schema-'+i});
  }).filter(Boolean);

  const allItems = schemaTabItems.concat(schemaItems).concat(trainingDagLog);
  const total = allItems.length;

  // Tel afgevinkte: dagDone voor schema-tab en losse, exerciseDone voor aanbevolen
  let done = 0;
  allItems.forEach(function(ex) {
    const slotIdx = ex.id.startsWith('schema-') && !ex.id.startsWith('schema-tab') ? parseInt(ex.id.replace('schema-','')) : -1;
    const isDone = dagDone[ex.id] || (slotIdx >= 0 && exerciseDone.includes(slotIdx));
    if (isDone) done++;
  });

  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  const typeLabel = trainingType === 'herstel' ? 'Hersteldag' : trainingType === 'normaal' ? 'Normale training' : 'Zware training';

  let status, statusIcon, coachQuestion, confirmOptions;

  if (total === 0 || done === 0) {
    status = total === 0 ? 'Geen oefeningen gepland' : 'Nog geen oefeningen afgevinkt';
    statusIcon = '⭕';
    checkout.training = 1;
    coachQuestion = 'Ik zie dat je nog geen oefeningen hebt afgevinkt vandaag. Heb je toch getraind?';
    confirmOptions = [
      {label:'Ja, ik heb getraind ✅', val:3},
      {label:'Gedeeltelijk gedaan ⚡', val:2},
      {label:'Niet getraind vandaag ❌', val:1},
    ];
  } else if (done >= total) {
    status = 'Alle ' + total + ' oefeningen voltooid 🎉';
    statusIcon = '✅';
    checkout.training = 3;
    coachQuestion = 'Je hebt alle ' + total + ' oefeningen afgevinkt. Goed gedaan! Klopt dat?';
    confirmOptions = [
      {label:'Ja, volledig gedaan ✅', val:3},
      {label:'Eigenlijk maar deels 😅', val:2},
    ];
  } else {
    status = done + ' van ' + total + ' oefeningen gedaan (' + pct + '%)';
    statusIcon = '⚡';
    checkout.training = 2;
    coachQuestion = 'Je hebt ' + done + ' van ' + total + ' oefeningen afgevinkt (' + pct + '%). Klopt dat?';
    confirmOptions = [
      {label:'Ja, klopt zo ✅', val:2},
      {label:'Ik heb alles gedaan 💪', val:3},
      {label:'Nog minder gedaan ❌', val:1},
    ];
  }

  // Render tags
  let doneTags = '';
  allItems.forEach(function(ex) {
    const slotIdx = ex.id.startsWith('schema-') && !ex.id.startsWith('schema-tab') ? parseInt(ex.id.replace('schema-','')) : -1;
    const isDone = dagDone[ex.id] || (slotIdx >= 0 && exerciseDone.includes(slotIdx));
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
  const doel = MEALS[trainingType]?.doel || { kcal:2000, prot:150, carb:200, fat:65 };
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
    statusText = 'Nog niets gelogd vandaag';
    checkout.food = 2;
    coachQuestion = `Ik zie dat je vandaag niets hebt gelogd in de app. Heb je toch iets gegeten maar vergeten bij te houden?`;
    confirmOptions = [
      { label: 'Ja, ik heb goed gegeten ✅', val: 3 },
      { label: 'Grotendeels gevolgd ⚡', val: 2 },
      { label: 'Niet goed gegeten vandaag ❌', val: 1 },
    ];
  } else if (kcalPct >= 90 && kcalPct <= 115) {
    // Op doel
    statusIcon = '✅';
    statusText = `Op doel — ${Math.round(tot.kcal)} van ${doel.kcal} kcal (${kcalPct}%)`;
    checkout.food = 3;
    coachQuestion = `Ik zie dat je ${Math.round(tot.kcal)} kcal hebt gegeten — precies op je doel van ${doel.kcal} kcal. Goed gedaan! Klopt dat?`;
    confirmOptions = [
      { label: 'Ja, klopt precies ✅', val: 3 },
      { label: 'Ik heb eigenlijk meer gegeten ⬆️', val: 4 },
      { label: 'Ik heb eigenlijk minder gegeten ⬇️', val: 2 },
    ];
  } else if (kcalPct > 115) {
    // Teveel gegeten
    const over = Math.round(tot.kcal - doel.kcal);
    statusIcon = '⬆️';
    statusText = `${Math.round(tot.kcal)} kcal — ${over} kcal boven doel (${kcalPct}%)`;
    checkout.food = 4;
    coachQuestion = `Ik zie dat je ${over} kcal boven je doel van ${doel.kcal} zit. Dat is meer dan gepland. Klopt dat, of heb je minder gegeten dan gelogd?`;
    confirmOptions = [
      { label: 'Ja, ik heb teveel gegeten ⬆️', val: 4 },
      { label: 'Ik heb minder gegeten dan gelogd ✅', val: 3 },
      { label: 'Ik heb nog meer gegeten 😬', val: 4 },
    ];
  } else {
    // Te weinig gegeten
    const tekort = Math.round(doel.kcal - tot.kcal);
    statusIcon = '⬇️';
    statusText = `${Math.round(tot.kcal)} kcal — ${tekort} kcal onder doel (${kcalPct}%)`;
    checkout.food = 2;
    coachQuestion = `Ik zie dat je ${tekort} kcal onder je doel van ${doel.kcal} zit. Heb je bewust minder gegeten, of heb je niet alles gelogd?`;
    confirmOptions = [
      { label: 'Ik heb inderdaad te weinig gegeten ⬇️', val: 1 },
      { label: 'Ik heb meer gegeten maar niet gelogd ✅', val: 3 },
      { label: 'Bewuste keuze — voelde goed 👍', val: 2 },
    ];
  }

  // Macro voortgangsbalken
  const barColor = pct => pct > 115 ? '#E24B4A' : pct >= 85 ? '#4a7c59' : '#EF9F27';
  const barWidth = pct => Math.min(100, pct) + '%';

  const macroHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px">
      ${[
        { lbl:'Kcal', val:Math.round(tot.kcal), doel:doel.kcal, unit:'', pct:kcalPct },
        { lbl:'Eiwit', val:Math.round(tot.prot), doel:doel.prot, unit:'g', pct:protPct },
        { lbl:'Koolh', val:Math.round(tot.carb), doel:doel.carb, unit:'g', pct:Math.round(tot.carb/doel.carb*100) },
        { lbl:'Vet', val:Math.round(tot.fat), doel:doel.fat, unit:'g', pct:Math.round(tot.fat/doel.fat*100) },
      ].map(m => `
        <div style="text-align:center;background:var(--white);border-radius:8px;padding:10px 6px">
          <div style="font-family:'DM Serif Display',serif;font-size:17px">${m.val}${m.unit}</div>
          <div style="font-size:9px;color:var(--muted);margin:3px 0">${m.lbl} · doel ${m.doel}${m.unit}</div>
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
        <div class="training-status-sub">${logged} item${logged !== 1 ? 's' : ''} gelogd · doel ${doel.kcal} kcal</div>
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
  btn.disabled = true; btn.textContent = 'Analyseren...';

  trainingType = calcTrainingType();
  const typeLabel = { herstel:'Hersteldag', normaal:'Normale training', zwaar:'Zware training' }[trainingType];
  const mealData = MEALS[trainingType];

  // Save today
  const today = new Date().toISOString().split('T')[0];
  todayData = { date: today, checkin, trainingType, checkout: null };
  localStorage.setItem('prime_today', JSON.stringify(todayData));
  exerciseDone = [];
  localStorage.setItem('prime_exdone', JSON.stringify(exerciseDone));
  trainingDagLog = [];
  activeSchemaId = null;
  selectedSchemaEx = {};
  sessionStorage.removeItem('prime_training_dag');
  sessionStorage.removeItem('prime_active_schema');

  // Update stats
  updateStreak();

  // Show day section
  document.getElementById('checkin-section').style.display = 'none';
  document.getElementById('day-section').style.display = 'block';

  // Build training + food summary voor checkout
  buildTrainingSummary();
  buildFoodSummary();

  // Set training preview
  const exercises = EXERCISES[trainingType];
  document.getElementById('home-training-badge').innerHTML = badgeHTML(trainingType);
  document.getElementById('home-training-preview').innerHTML = exercises.slice(0,3).map(e => `${e.icon} ${e.name}`).join(' &nbsp;·&nbsp; ') + (exercises.length > 3 ? ` &nbsp;+${exercises.length-3} meer` : '');

  // Render training & food screens
  renderTraining();
  renderFood();
  updateHomeMacros();
  const sl = ['','Slecht','Matig','Goed','Uitstekend'][checkin.sleep];
  const en = ['','Laag','Gemiddeld','Hoog','Zeer hoog'][checkin.energy];
  const st = ['','Veel','Redelijk','Weinig','Geen'][checkin.stress];
  const prompt = `Cliënt check-in: Slaap=${sl}, Energie=${en}, Stress=${st}. Trainingstype vandaag: ${typeLabel}. Geef een persoonlijk, motiverend bericht van max 60 woorden in jouw directe stijl. Geen opsomming.`;

  try {
    const r = await callClaude(prompt, []);
    document.getElementById('coach-msg-text').textContent = r;
    document.getElementById('coach-message-home').style.display = 'block';
    document.getElementById('day-title').textContent = typeLabel + ' staat klaar ✓';
    document.getElementById('day-summary').textContent = 'Coach Ira heeft je dag afgestemd op jouw check-in.';
  } catch {
    document.getElementById('day-title').textContent = typeLabel + ' staat klaar ✓';
    document.getElementById('day-summary').textContent = 'Je training en voeding zijn afgestemd op hoe je je vandaag voelt.';
  }
}

async function doCheckout() {
  const btn = document.getElementById('checkout-btn');
  btn.disabled = true;
  btn.textContent = 'Advies voor morgen voorbereiden...';

  // Save to history
  if (todayData) {
    todayData.checkout = checkout;
    history.unshift(todayData);
    if (history.length > 60) history.pop();
    localStorage.setItem('prime_history', JSON.stringify(history));
    localStorage.removeItem('prime_today');
  }

  const total = EXERCISES[trainingType].length;
  const done = exerciseDone.length;
  const doel = MEALS[trainingType]?.doel || { kcal:2000, prot:150, carb:200, fat:65 };
  const totFood = dayLog.reduce((a,i) => ({ kcal:a.kcal+i.kcal, prot:a.prot+i.prot, carb:a.carb+i.carb, fat:a.fat+i.fat }), { kcal:0, prot:0, carb:0, fat:0 });

  const energyLabel = ['','Laag','Gemiddeld','Hoog','Zeer hoog'][checkout.energy];
  const trainingLabel = checkout.training === 3 ? `Volledig (${done}/${total} oefeningen)` :
                        checkout.training === 2 ? `Gedeeltelijk (${done}/${total} oefeningen)` : 'Niet gedaan';
  const foodLabel = checkout.food === 3 ? `Op doel (${Math.round(totFood.kcal)} kcal)` :
                    checkout.food === 4 ? `Teveel gegeten (${Math.round(totFood.kcal)} kcal, doel ${doel.kcal})` :
                    checkout.food === 2 ? `Iets onder doel (${Math.round(totFood.kcal)} kcal)` :
                    `Te weinig / niet gevolgd (${Math.round(totFood.kcal)} kcal)`;

  const context = `
Cliënt checkout data vandaag:
- Trainingstype: ${trainingType} (${trainingLabel})
- Voeding: ${foodLabel} — eiwit ${Math.round(totFood.prot)}g van doel ${doel.prot}g
- Energie: ${energyLabel}
- Calorie doel was: ${doel.kcal} kcal`;

  // Prompt 1: afsluitend bericht
  const promptAfsluiting = `${context}

Geef een warm, direct afsluitend bericht van max 50 woorden in de stijl van coach Ira. Benoem concreet wat goed ging. Geen opsomming.`;

  // Prompt 2: advies voor morgen — gestructureerd
  const promptMorgen = `${context}

Geef een concreet advies voor morgen. Gebruik EXACT dit format, elke regel apart:

TRAININGSTYPE: [herstel of normaal of zwaar] - [reden in max 6 woorden]
TRAINING: [2-3 concrete oefeningen of activiteiten voor morgen]
VOEDING: [voedingsrichting voor morgen in max 15 woorden]
SLAAP: [één concrete slaapdoelstelling]
TIP: [één motiverende tip in max 12 woorden]

Gebruik geen extra tekst buiten dit format.`;

  btn.textContent = '🌙 Dag afgerond!';
  btn.style.background = 'var(--sage)';

  // Render lege tomorrow card meteen zodat gebruiker feedback ziet
  const container = btn.parentElement;
  const tomorrowDiv = document.createElement('div');
  tomorrowDiv.id = 'tomorrow-card';
  tomorrowDiv.innerHTML = `
    <div class="success-banner" style="margin-top:16px">
      <h3>Dag afgerond ✓</h3>
      <p id="afsluiting-text" style="color:#3d6649;font-size:14px;line-height:1.7">Even laden...</p>
    </div>
    <div class="card" style="margin-top:16px;padding:0;overflow:hidden">
      <div style="background:var(--charcoal);padding:16px 20px;display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">🌙</span>
        <div>
          <div style="font-family:'DM Serif Display',serif;font-size:17px;color:white">Morgen staat klaar</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:2px" id="tomorrow-date"></div>
        </div>
      </div>
      <div id="tomorrow-content" style="padding:20px">
        <div style="text-align:center;padding:20px;color:var(--muted);font-size:14px">Advies wordt samengesteld...</div>
      </div>
    </div>`;
  container.appendChild(tomorrowDiv);

  // Zet morgen datum
  const morgen = new Date(); morgen.setDate(morgen.getDate() + 1);
  document.getElementById('tomorrow-date').textContent = morgen.toLocaleDateString('nl-NL', { weekday:'long', day:'numeric', month:'long' });

  // Call 1: afsluitend bericht (kort)
  try {
    const afsluiting = await callClaude(promptAfsluiting, [], 150);
    document.getElementById('afsluiting-text').textContent = afsluiting;
  } catch(e) {
    console.error('Afsluiting fout:', e);
    document.getElementById('afsluiting-text').textContent = 'Goed gedaan vandaag. Rust goed uit en bereid je voor op morgen.';
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
  const lines = text.split('\n').filter(l => l.trim());
  const parsed = {};
  lines.forEach(line => {
    const match = line.match(/^(TRAININGSTYPE|TRAINING|VOEDING|SLAAP|TIP):\s*(.+)$/);
    if (match) parsed[match[1]] = match[2].trim();
  });

  const typeMap = {
    'herstel': { label:'Hersteldag', cls:'badge-light', icon:'🌊' },
    'normaal': { label:'Normale training', cls:'badge-normal', icon:'💪' },
    'zwaar': { label:'Zware training', cls:'badge-heavy', icon:'🔥' },
  };

  // Bepaal trainingstype voor morgen uit tekst
  let morgenType = 'normaal';
  if (parsed.TRAININGSTYPE) {
    const t = parsed.TRAININGSTYPE.toLowerCase();
    if (t.startsWith('herstel')) morgenType = 'herstel';
    else if (t.startsWith('zwaar')) morgenType = 'zwaar';
  }
  const typeInfo = typeMap[morgenType];

  const sections = [
    { key:'TRAINING', icon:'🏋️', label:'Training' },
    { key:'VOEDING', icon:'🥗', label:'Voeding' },
    { key:'SLAAP', icon:'😴', label:'Slaap' },
    { key:'TIP', icon:'💡', label:'Tip van de coach' },
  ];

  document.getElementById('tomorrow-content').innerHTML = `
    <div style="margin-bottom:16px">
      <div class="training-type-badge ${typeInfo.cls}" style="display:inline-flex">
        ${typeInfo.icon} ${parsed.TRAININGSTYPE || typeInfo.label}
      </div>
    </div>
    ${sections.map(s => parsed[s.key] ? `
      <div style="display:flex;gap:12px;margin-bottom:14px;align-items:flex-start">
        <div style="width:32px;height:32px;border-radius:8px;background:var(--sand);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${s.icon}</div>
        <div>
          <div style="font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;color:var(--muted);margin-bottom:3px">${s.label}</div>
          <div style="font-size:14px;line-height:1.6;color:var(--charcoal)">${parsed[s.key]}</div>
        </div>
      </div>` : '').join('')}
    <div style="margin-top:16px;padding:12px 16px;background:var(--sage-light);border-radius:10px;border-left:3px solid var(--sage)">
      <div style="font-size:12px;font-weight:600;color:var(--sage);margin-bottom:4px">Vergeet niet</div>
      <div style="font-size:13px;color:#3d6649">Check morgenochtend je check-in — de app stelt je dag opnieuw in op basis van hoe je je voelt.</div>
    </div>`;
}

function renderTomorrowFallback() {
  // Bepaal morgen trainingstype op basis van vandaag
  const morgenType = checkout.training === 3 && checkout.energy >= 3 ? 'normaal' :
                     checkout.training <= 1 || checkout.energy <= 1 ? 'herstel' : 'normaal';
  const typeMap = {
    'herstel': { label:'Hersteldag', cls:'badge-light', icon:'🌊' },
    'normaal': { label:'Normale training', cls:'badge-normal', icon:'💪' },
    'zwaar':   { label:'Zware training', cls:'badge-heavy', icon:'🔥' },
  };
  const typeInfo = typeMap[morgenType];
  const morgenOef = EXERCISES[morgenType].slice(0,3).map(e => e.name).join(', ');
  const morgenKcal = MEALS[morgenType].doel.kcal;
  const morgenProt = MEALS[morgenType].doel.prot;

  document.getElementById('tomorrow-content').innerHTML = `
    <div style="margin-bottom:16px">
      <div class="training-type-badge ${typeInfo.cls}" style="display:inline-flex">
        ${typeInfo.icon} ${typeInfo.label}
      </div>
    </div>
    ${[
      { icon:'🏋️', label:'Training', text: morgenOef },
      { icon:'🥗', label:'Voeding', text: `Doel: ${morgenKcal} kcal · ${morgenProt}g eiwit` },
      { icon:'😴', label:'Slaap', text: 'Op tijd naar bed — doel 7-8 uur slaap' },
      { icon:'💡', label:'Tip van de coach', text: checkout.training < 3 ? 'Kleine stappen tellen ook. Morgen weer een kans.' : 'Consistentie boven intensiteit — blijf gaan.' },
    ].map(s => `
      <div style="display:flex;gap:12px;margin-bottom:14px;align-items:flex-start">
        <div style="width:32px;height:32px;border-radius:8px;background:var(--sand);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${s.icon}</div>
        <div>
          <div style="font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;color:var(--muted);margin-bottom:3px">${s.label}</div>
          <div style="font-size:14px;line-height:1.6;color:var(--charcoal)">${s.text}</div>
        </div>
      </div>`).join('')}
    <div style="margin-top:16px;padding:12px 16px;background:var(--sage-light);border-radius:10px;border-left:3px solid var(--sage)">
      <div style="font-size:13px;color:#3d6649">Check morgenochtend je check-in — de app stelt je dag opnieuw in op basis van hoe je je voelt.</div>
    </div>`;
}
function badgeHTML(type) {
  const cfg = {
    herstel: ['badge-light', '🌊 Hersteldag'],
    normaal: ['badge-normal', '💪 Normale training'],
    zwaar: ['badge-heavy', '🔥 Zware training']
  }[type];
  return `<div class="training-type-badge ${cfg[0]}">${cfg[1]}</div>`;
}

