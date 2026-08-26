// Datum-string van vandaag, en het bijschrijven van trainingDagLog naar de
// per-datum store trainingDays (zie state.js) -- vervangt de oude
// sessionStorage('prime_training_dag')-opslag, zodat losse oefeningen net
// als bij Voeding per dag bewaard blijven en dus ook (net als foodDays)
// naar andere datums gekopieerd kunnen worden (zie wpConfirmTrainingCopy
// in weekplanning.js).
function _trainingToday() { return new Date().toISOString().split('T')[0]; }
function persistTrainingDag() {
  trainingDays[currentTrainingDate] = trainingDagLog;
  syncSet('prime_training_days', trainingDays);
}

// Zet welke datum trainingDagLog weergeeft/bewerkt -- zelfde patroon als
// switchLogDate() bij Voeding. Gebruikt door wpdAddForDay() (Weekplanning >
// dagkaart > "+ Oefening") zodat je oefeningen kunt toevoegen voor een
// andere dag dan vandaag.
function switchTrainingLogDate(dateStr) {
  currentTrainingDate = dateStr;
  trainingDagLog = trainingDays[dateStr] ? [...trainingDays[dateStr]] : [];
  updateTrainingDateBanner();
}

// Toont een banner boven de Training-tabs zodra er voor een andere dag dan
// vandaag oefeningen toegevoegd worden (zelfde opzet als
// updateLogDateBanner() bij Voeding).
function updateTrainingDateBanner() {
  const banner = document.getElementById('training-date-banner');
  if (!banner) return;
  const isToday = currentTrainingDate === _trainingToday();
  banner.style.display = isToday ? 'none' : 'flex';
  if (!isToday) {
    const [y,m,d] = currentTrainingDate.split('-').map(Number);
    const dateObj = new Date(y, m-1, d);
    document.getElementById('training-date-banner-text').textContent =
      t('training.editingDate', { date: dateObj.toLocaleDateString(dateLocale(), { day:'numeric', month:'long' }) });
  }
}

function backToTodayTraining() {
  switchTrainingLogDate(_trainingToday());
  switchTrainingTab('dag');
}

function getActiveEx(i) {
  const exs = EXERCISES[trainingType];
  const ex = exs[i];
  const altIdx = selectedAlts[i];
  if (altIdx !== undefined && altIdx >= 0 && ex.alts && ex.alts[altIdx]) {
    return ex.alts[altIdx];
  }
  return ex;
}

// Zet alleen welke tabknop/inhoud actief is, zonder verder tab-specifieke
// state te resetten -- los getrokken van switchTrainingTab() zodat
// addNewProgram() (programmas.js) na het aanmaken van een programma naar
// de Programma's-tab kan springen MET het nieuwe programma meteen open,
// i.p.v. dat de normale tabklik-reset (progActiefId = null) dat teniet doet.
function _setActiveTrainingTabDom(tab) {
  activeTrainingTab = tab;
  ['programmas','primeprog','addprogram','weekplanning','oefeningen','addexercise','dag'].forEach(t => {
    const btn = document.getElementById(`ttab-${t}`);
    const content = document.getElementById(`ttab-content-${t}`);
    if (btn) btn.classList.toggle('active', t === tab);
    if (content) content.style.display = t === tab ? 'block' : 'none';
  });
}

function switchTrainingTab(tab) {
  _setActiveTrainingTabDom(tab);
  if (tab === 'programmas') { progMode = 'normal'; progActiefId = null; progActiefDagIdx = null; progSelectedOefIdx = null; renderProgrammas(); }
  if (tab === 'primeprog') {
    progMode = 'prime'; progActiefId = null; progActiefDagIdx = null; progSelectedOefIdx = null;
    renderProgrammas();
    primeProgRefreshFromCloud(); // ververst op de achtergrond vanuit Supabase (gedeeld met alle klanten)
  }
  if (tab === 'addprogram') resetNewProgramForm();
  if (tab === 'oefeningen') renderExtraExercises();
  if (tab === 'addexercise') renderAddExerciseTab();
  // "Vandaag" betekent altijd vandaag — verlaat een eventueel via
  // Weekplanning geopende andere datum weer (zelfde patroon als
  // switchFoodTab('log') bij Voeding).
  if (tab === 'dag') { switchTrainingLogDate(_trainingToday()); renderTrainingDag(); }
  if (tab === 'weekplanning') renderWeekplanning();
}

function renderExtraExercises() {
  trainingDagLog = trainingDays[currentTrainingDate] || [];
  const el = document.getElementById('extra-exercise-list');
  // Eigen oefeningen worden ingevoegd bij hun gekozen spiergroep; wat niet bij een
  // bestaande groep hoort (of expliciet 'Eigen oefeningen') komt in een eigen sectie.
  const matchedGroupNames = new Set(EXTRA_EXERCISES.map(g => g.group));
  const groupsData = EXTRA_EXERCISES.map(g => ({
    group: g.group, group_en: g.group_en, icon: g.icon,
    exercises: [...g.exercises, ...customExercises.filter(ex => ex.group === g.group)]
  }));
  const leftoverCustom = customExercises.filter(ex => !matchedGroupNames.has(ex.group));
  if (leftoverCustom.length) {
    groupsData.push({ group: 'Eigen oefeningen', group_en: 'My exercises', icon: '⭐', exercises: leftoverCustom });
  }
  el.innerHTML = groupsData.map(group => `
    <div style="margin-bottom:22px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <div style="font-size:20px">${group.icon}</div>
        <div style="font-family:'DM Serif Display',serif;font-size:18px;color:var(--charcoal)">${dispField(group,'group')}</div>
        <div style="flex:1;height:1px;background:var(--sand-dark);margin-left:8px"></div>
      </div>
      <div>
        ${group.exercises.map(ex => {
          const hasDetail = exerciseNotes[ex.id] && (exerciseNotes[ex.id].notes || (exerciseNotes[ex.id].sets && exerciseNotes[ex.id].sets.length));
          return `
            <div class="ex-extra-card" onclick="openExerciseAddModal('${ex.id}')">
              ${ex.photo ? `<div class="ex-extra-photo" style="background-image:url('${ex.photo}')"></div>` : `<div class="ex-extra-photo ex-extra-icon">${ex.icon || '🏋️'}</div>`}
              <div class="ex-extra-body">
                <div class="ex-extra-name-row">
                  <div class="ex-extra-name">${dispName(ex)}</div>
                  <span class="ex-schedule-badge" onclick="event.stopPropagation();openExerciseAddModal('${ex.id}')">${t('portion.addToDay')}</span>
                </div>
                <div class="ex-extra-meta">${dispField(ex,'stappen') || (ex.sets + '×' + ex.reps)}</div>
                ${ex.youtube ? `<a href="${ex.youtube}" target="_blank" onclick="event.stopPropagation()" class="ex-extra-video">▶ Video</a>` : ''}
              </div>
              <button class="ex-detail-btn ${hasDetail ? 'has-data' : ''}" onclick="event.stopPropagation();openExerciseDetail('${ex.id}')">
                <span class="ex-detail-icon">📝</span><span class="ex-detail-label">${t('extra.detail.editBtn')}</span>
              </button>
            </div>`;
        }).join('')}
      </div>
    </div>
  `).join('');
}

// ========== OEFENING-DETAIL (sets, herhalingen, rust, notities) ==========
let _edExerciseId = null;
let _edSets = [];
let _edMode = 'edit'; // 'edit' (al toegevoegd, "📝 Bewerken") | 'add' (Losse oefeningen, zie openExerciseAddModal())

function findExtraExercise(exId) {
  for (const group of EXTRA_EXERCISES) {
    const found = group.exercises.find(e => e.id === exId);
    if (found) return found;
  }
  return customExercises.find(e => e.id === exId) || null;
}

// ========== EIGEN OEFENING TOEVOEGEN (met foto) ==========
let _aePhotoData = null;
let _aeEditingId = null;

function handleAddExercisePhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 1.5 * 1024 * 1024) {
    document.getElementById('ae-error').textContent = t('food.add.photoTooBig');
    return;
  }
  document.getElementById('ae-error').textContent = '';
  const reader = new FileReader();
  reader.onload = function(e) {
    _aePhotoData = e.target.result;
    document.getElementById('ae-photo-preview').innerHTML = '<img src="' + _aePhotoData + '" style="width:100%;height:100%;object-fit:cover">';
  };
  reader.readAsDataURL(file);
}

function addCustomExercise() {
  const nameInput = document.getElementById('ae-name');
  const name = nameInput.value.trim();
  const errorEl = document.getElementById('ae-error');
  if (!name) {
    errorEl.textContent = t('training.addExercise.nameRequired');
    nameInput.style.borderColor = '#c0392b';
    return;
  }
  nameInput.style.borderColor = '';
  errorEl.textContent = '';

  const fields = {
    name: name,
    group: document.getElementById('ae-group').value,
    sets: parseInt(document.getElementById('ae-sets').value, 10) || 1,
    reps: document.getElementById('ae-reps').value.trim(),
    rest: document.getElementById('ae-rest').value.trim(),
    youtube: document.getElementById('ae-youtube').value.trim(),
    photo: _aePhotoData || null
  };

  if (_aeEditingId) {
    const ex = customExercises.find(e => e.id === _aeEditingId);
    if (ex) Object.assign(ex, fields);
    // Meteen zichtbaar bijwerken als hij al in Vandaag staat.
    const inDag = trainingDagLog.find(e => e.id === _aeEditingId);
    if (inDag) Object.assign(inDag, fields);
    persistTrainingDag();
  } else {
    customExercises.push({
      id: 'custom-ex-' + Date.now() + Math.floor(Math.random() * 1000),
      icon: '🏋️',
      custom: true,
      ...fields
    });
  }
  syncSet('prime_custom_exercises', customExercises);

  resetExerciseForm();
  renderAddExerciseTab();
}

function editCustomExercise(id) {
  const ex = customExercises.find(e => e.id === id);
  if (!ex) return;
  _aeEditingId = id;

  document.getElementById('ae-name').value = ex.name;
  document.getElementById('ae-group').value = ex.group;
  document.getElementById('ae-sets').value = ex.sets || 1;
  document.getElementById('ae-reps').value = ex.reps || '';
  document.getElementById('ae-rest').value = ex.rest || '';
  document.getElementById('ae-youtube').value = ex.youtube || '';
  _aePhotoData = ex.photo || null;
  document.getElementById('ae-photo-preview').innerHTML = ex.photo
    ? '<img src="' + ex.photo + '" style="width:100%;height:100%;object-fit:cover">'
    : '🏋️';

  document.getElementById('ae-form-title').textContent = t('training.addExercise.editTitle');
  document.getElementById('ae-submit-btn').textContent = t('training.addExercise.update');
  document.getElementById('ae-cancel-btn').style.display = 'inline-block';
  document.getElementById('ae-error').textContent = '';

  document.getElementById('ae-name').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Reset het formulier naar "nieuwe oefening"-stand — zowel na een geslaagde
// toevoeging/wijziging als bij het annuleren van een bewerking.
function resetExerciseForm() {
  _aeEditingId = null;
  _aePhotoData = null;
  const nameInput = document.getElementById('ae-name');
  nameInput.value = '';
  nameInput.style.borderColor = '';
  document.getElementById('ae-group').value = 'Eigen oefeningen';
  document.getElementById('ae-sets').value = 3;
  document.getElementById('ae-reps').value = '';
  document.getElementById('ae-rest').value = '';
  document.getElementById('ae-youtube').value = '';
  document.getElementById('ae-photo-preview').innerHTML = '🏋️';
  document.getElementById('ae-form-title').textContent = t('training.addExercise.formTitle');
  document.getElementById('ae-submit-btn').textContent = t('training.addExercise.submit');
  document.getElementById('ae-cancel-btn').style.display = 'none';
  document.getElementById('ae-error').textContent = '';
}

function removeCustomExercise(id) {
  if (!confirm(t('food.add.confirmDelete'))) return;
  if (_aeEditingId === id) resetExerciseForm();
  customExercises = customExercises.filter(e => e.id !== id);
  syncSet('prime_custom_exercises', customExercises);
  // Ook verwijderen uit Vandaag als hij daar (nog) in staat.
  trainingDagLog = trainingDagLog.filter(e => e.id !== id);
  persistTrainingDag();
  renderAddExerciseTab();
}

function renderAddExerciseTab() {
  const el = document.getElementById('own-exercises-list');
  if (!el) return;
  if (!customExercises.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--muted)">' + t('training.addExercise.noOwnExercises') + '</div>';
    return;
  }
  el.innerHTML = customExercises.map(ex => `
    <div class="card" style="margin-bottom:10px;padding:0;overflow:hidden;display:flex;align-items:stretch">
      ${ex.photo
        ? `<div style="width:64px;min-height:60px;background-image:url('${ex.photo}');background-size:cover;background-position:center;flex-shrink:0"></div>`
        : `<div style="width:64px;min-height:60px;display:flex;align-items:center;justify-content:center;font-size:22px;background:var(--sand);flex-shrink:0">${ex.icon || '🏋️'}</div>`}
      <div style="flex:1;padding:10px 14px;display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px;margin-bottom:2px">${dispName(ex)}</div>
          <div style="font-size:11px;color:var(--muted)">${ex.group} · ${ex.sets}${t('programmas.setsAbbr')} × ${ex.reps || '—'}${ex.rest ? ' · ' + t('training.restLabel') + ' ' + ex.rest : ''}</div>
        </div>
        <button onclick="editCustomExercise('${ex.id}')" style="font-size:12px;padding:6px 10px;border-radius:8px;border:1px solid var(--sand-dark);background:var(--sand);color:var(--charcoal);cursor:pointer;flex-shrink:0">${t('common.edit')}</button>
        <button onclick="removeCustomExercise('${ex.id}')" style="font-size:16px;padding:4px 8px;border:none;background:none;color:var(--muted);cursor:pointer;flex-shrink:0">×</button>
      </div>
    </div>`).join('');
}

// Zet een rust-label uit de vaste data ('90 sec', '3 min', '—') om naar een
// kaal getal in seconden voor het invoerveld. Onbekende/lege labels blijven leeg.
function restLabelToSeconds(label) {
  if (!label) return '';
  const secMatch = label.match(/^(\d+)\s*sec$/i);
  if (secMatch) return secMatch[1];
  const minMatch = label.match(/^(\d+)\s*min$/i);
  if (minMatch) return String(Number(minMatch[1]) * 60);
  return '';
}

// Als gezet, wordt dit i.p.v. het standaard exerciseNotes-pad gebruikt om op
// te slaan -- zodat hetzelfde detailscherm ook los van een concreet
// oefening-id gebruikt kan worden, zie openExerciseDetailGeneric() hieronder.
// (Weekprogramma's heeft zijn eigen, inline sets/notities-paneel in
// programmas.js en gebruikt dit mechanisme niet meer, maar het blijft
// beschikbaar voor vergelijkbare toekomstige schermen.)
let _edSaveCallback = null;

// Generieke opener voor het sets/notities-scherm, losstaand van een concreet
// oefening-id.
function openExerciseDetailGeneric(opts) {
  _edExerciseId = null;
  _edSaveCallback = opts.onSave;
  _edMode = 'edit';
  _edSets = (opts.sets && opts.sets.length) ? opts.sets.map(s => ({ ...s })) : [{ reps: '', rest: '' }];
  document.getElementById('ed-name').textContent = opts.name;
  document.getElementById('ed-photo-wrap').innerHTML = opts.photo
    ? `<img src="${opts.photo}" alt="${opts.name}">`
    : `<div style="font-size:48px;text-align:center;padding:40px 0">${opts.icon || '🏋️'}</div>`;
  document.getElementById('ed-notes').value = opts.notes || '';
  edRenderSets();
  document.getElementById('ed-save-btn').textContent = t('extra.detail.save');
  document.getElementById('ed-date-row').style.display = 'none';
  document.getElementById('exercise-detail-modal').classList.add('open');
}

function openExerciseDetail(exId) {
  const ex = findExtraExercise(exId);
  if (!ex) return;
  _edExerciseId = exId;
  _edSaveCallback = null;
  _edMode = 'edit';
  const saved = exerciseNotes[exId];
  if (saved && saved.sets && saved.sets.length) {
    _edSets = saved.sets.map(s => ({ ...s }));
  } else {
    const n = Number(ex.sets) || 1;
    const defaultReps = dispField(ex, 'reps') || '';
    const defaultRest = restLabelToSeconds(ex.rest);
    _edSets = Array.from({ length: n }, () => ({ reps: defaultReps, rest: defaultRest }));
  }
  document.getElementById('ed-name').textContent = dispName(ex);
  document.getElementById('ed-photo-wrap').innerHTML = ex.photo
    ? `<img src="${ex.photo}" alt="${dispName(ex)}">`
    : `<div style="font-size:48px;text-align:center;padding:40px 0">${ex.icon}</div>`;
  document.getElementById('ed-notes').value = (saved && saved.notes) || '';
  edRenderSets();
  document.getElementById('ed-save-btn').textContent = t('extra.detail.save');
  document.getElementById('ed-date-row').style.display = 'none';
  document.getElementById('exercise-detail-modal').classList.add('open');
}

function closeExerciseDetail() {
  document.getElementById('exercise-detail-modal').classList.remove('open');
  _edExerciseId = null;
  _edSaveCallback = null;
  _edMode = 'edit';
}

function edRenderSets() {
  const el = document.getElementById('ed-sets');
  el.innerHTML = _edSets.map((s, i) => `
    <div class="ed-set-row">
      <div class="ed-set-grid" style="flex:1">
        <div class="ed-set-num">${i + 1}</div>
        <input class="ed-set-input" type="text" value="${(s.reps || '').replace(/"/g,'&quot;')}" oninput="_edSets[${i}].reps=this.value">
        <input class="ed-set-input" type="text" value="${(s.rest || '').replace(/"/g,'&quot;')}" oninput="_edSets[${i}].rest=this.value">
      </div>
      ${_edSets.length > 1 ? `<button class="ed-rm-btn" onclick="edRemoveSet(${i})" title="${t('extra.detail.removeSet')}">×</button>` : `<span style="width:20px;flex-shrink:0"></span>`}
    </div>`).join('');
}

function edAddSet() {
  const last = _edSets[_edSets.length - 1];
  _edSets.push({ reps: last ? last.reps : '', rest: last ? last.rest : '' });
  edRenderSets();
}

function edRemoveSet(i) {
  _edSets.splice(i, 1);
  edRenderSets();
}

function saveExerciseDetail() {
  const notes = document.getElementById('ed-notes').value.trim();
  const sets = _edSets.map(s => ({ ...s }));
  const callback = _edSaveCallback;
  if (callback) {
    callback(sets, notes);
    closeExerciseDetail();
    try { showToast(t('extra.detail.saved')); } catch(e) { console.error(e); }
    return;
  }
  if (!_edExerciseId) return;
  exerciseNotes[_edExerciseId] = { sets, notes };
  syncSet('prime_exercise_notes', exerciseNotes);
  closeExerciseDetail();
  try { renderExtraExercises(); } catch(e) { console.error(e); }
  try { showToast(t('extra.detail.saved')); } catch(e) { console.error(e); }
}

// Zoekt een oefening op id -- eerst in de vaste EXTRA_EXERCISES-groepen (die
// hun group-naam niet los op het oefening-object hebben staan), anders bij
// de eigen oefeningen (die group al als eigen veld hebben).
function findAnyExtraExercise(exId) {
  for (const group of EXTRA_EXERCISES) {
    const found = group.exercises.find(e => e.id === exId);
    if (found) return { ...found, group: group.group };
  }
  const custom = customExercises.find(e => e.id === exId);
  return custom ? { ...custom } : null;
}

// ========== OEFENING TOEVOEGEN (Losse oefeningen) ==========
// Klik op een oefening opent hetzelfde detailscherm als "📝 Bewerken"
// (sets/rust aanpassen, een set toevoegen, notities), maar dan in
// "toevoegen"-stand: de knop heet "Toevoegen" en opent (net als bij een
// product in Basisproducten) eerst de kalender om de dag te kiezen,
// standaard de dag die nu open staat (meestal vandaag). Zie edSubmit()/
// addExerciseFromDetailModal() hieronder en _edMode bij openExerciseDetail().
function openExerciseAddModal(exId) {
  const ex = findAnyExtraExercise(exId);
  if (!ex) return;
  _edExerciseId = exId;
  _edSaveCallback = null;
  _edMode = 'add';

  const saved = exerciseNotes[exId];
  if (saved && saved.sets && saved.sets.length) {
    _edSets = saved.sets.map(s => ({ ...s }));
  } else {
    const n = Number(ex.sets) || 1;
    const defaultReps = dispField(ex, 'reps') || '';
    const defaultRest = restLabelToSeconds(ex.rest);
    _edSets = Array.from({ length: n }, () => ({ reps: defaultReps, rest: defaultRest }));
  }
  document.getElementById('ed-name').textContent = dispName(ex);
  document.getElementById('ed-photo-wrap').innerHTML = ex.photo
    ? `<img src="${ex.photo}" alt="${dispName(ex)}">`
    : `<div style="font-size:48px;text-align:center;padding:40px 0">${ex.icon || '🏋️'}</div>`;
  document.getElementById('ed-notes').value = (saved && saved.notes) || '';
  edRenderSets();

  document.getElementById('ed-save-btn').textContent = t('portion.addToDay');
  document.getElementById('ed-date').value = currentTrainingDate;
  document.getElementById('ed-date-row').style.display = 'flex';
  updateEdDateLabel();
  document.getElementById('exercise-detail-modal').classList.add('open');
}

// De ene knop onderaan het detailscherm doet iets anders afhankelijk van
// de stand waarin het geopend is: "bewerken" slaat meteen op
// (saveExerciseDetail(), bestond al); "toevoegen" voegt ook meteen toe
// (addExerciseFromDetailModal()), met de dag die op dat moment bij
// "📅 ..." staat -- de kalender (openEdDatePicker(), via de "Andere
// dag"-knop) is puur om die dag desgewenst te WIJZIGEN, geen aparte
// bevestigingsstap. Eerdere versies koppelden toevoegen aan het
// change-event van de kalender zelf, maar <input type="date"> laat dat
// event alleen afgaan bij een ECHTE wijziging: sloot je de kalender
// simpelweg omdat de getoonde standaarddag (meestal vandaag) al klopte
// -- wat de meeste mensen doen -- dan gebeurde er dus niets.
function edSubmit() {
  if (_edMode === 'add') { addExerciseFromDetailModal(); return; }
  saveExerciseDetail();
}

// Toont het (onzichtbare) #ed-date-veld leesbaar naast de "Opslaan"-
// knop (alleen zichtbaar in "toevoegen"-stand, zie #ed-date-row in
// openExerciseAddModal()). Zelfde als updatePmDateLabel() in food.js
// (kan hier niet hergebruikt worden: training.js laadt vóór food.js),
// gebruikt formatPickerDateLabel() uit i18n.js (laadt wél eerder).
function updateEdDateLabel() {
  const el = document.getElementById('ed-date-label');
  if (el) el.textContent = formatPickerDateLabel(document.getElementById('ed-date').value);
}

// Zelfde als openPmDatePicker() bij Voeding, maar voor dit detailscherm.
function openEdDatePicker() {
  const input = document.getElementById('ed-date');
  if (currentTrainingDate) input.value = currentTrainingDate;
  if (input.showPicker) {
    try { input.showPicker(); return; } catch (e) { /* val door naar de fallback hieronder */ }
  }
  input.focus();
  input.click();
}

// Voegt de oefening toe (of werkt 'm bij, als hij al op die dag stond) met
// de in dit scherm ingestelde sets/rust en notities, voor de in de
// kalender gekozen dag.
function addExerciseFromDetailModal() {
  if (_edMode !== 'add' || !_edExerciseId) return;
  const exId = _edExerciseId;
  const ex = findAnyExtraExercise(exId);
  if (!ex) { closeExerciseDetail(); return; }

  const notes = document.getElementById('ed-notes').value.trim();
  const sets = _edSets.map(s => ({ ...s }));
  // Zelfde opslagplek als de bestaande "📝 Bewerken"-flow: per
  // catalogusoefening, niet per logregel (dus gedeeld tussen dagen).
  exerciseNotes[exId] = { sets, notes };
  syncSet('prime_exercise_notes', exerciseNotes);

  const laatsteSet = sets[sets.length - 1] || {};
  const entry = {
    ...ex,
    sets: String(sets.length),
    reps: laatsteSet.reps || ex.reps || '',
    rest: laatsteSet.rest || ex.rest || '',
    setsDetail: sets,
    notities: notes
  };

  const targetDate = document.getElementById('ed-date').value || currentTrainingDate;
  const lijst = trainingDays[targetDate] || [];
  const bestaandIdx = lijst.findIndex(e => e.id === exId);
  if (bestaandIdx !== -1) lijst[bestaandIdx] = entry; else lijst.push(entry);
  trainingDays[targetDate] = [...lijst];
  syncSet('prime_training_days', trainingDays);
  if (targetDate === currentTrainingDate) trainingDagLog = trainingDays[targetDate];

  closeExerciseDetail();
  renderExtraExercises();
  updateTrainingDagBadge();
  if (document.getElementById('training-dag-list')) renderTrainingDag();
  try { if (document.getElementById('weekplanning-content')) renderWeekplanning(); } catch (e) { console.error(e); }
  try { showToast(t('extra.detail.saved')); } catch (e) { console.error(e); }
}

function updateTrainingDagBadge() {
  const tab = document.getElementById('ttab-dag');
  if (!tab) return;
  const today = new Date().toISOString().split('T')[0];
  const wpEntry = (JSON.parse(localStorage.getItem('prime_planning') || '[]')).find(p => p.date === today) || null;
  const wpVerwijderd = wpGetRemoved(today);
  const wpCount = wpEntry ? (wpGetOefeningen(wpEntry.schemaId) || []).filter(function(_, i) { return !wpVerwijderd.includes(i); }).length : 0;
  const count = wpCount + trainingDagLog.length;
  tab.textContent = count > 0 ? t('training.dayTabWithCount', { n: count }) : t('training.tab.day');
}

function toggleDagDone(id) {
  dagDone[id] = !dagDone[id];
  const check = document.getElementById('dag-check-' + id);
  if (check) check.classList.toggle('done', dagDone[id]);
  updateDagProgress();
}

function toggleWpMijnDag(dateStr, idx) {
  // Update prime_wp_done (syncs met weekplanning overzicht)
  wpToggleOefDone(dateStr, idx);
  // Spiegel in dagDone zodat voortgangsbalk klopt
  const done = (JSON.parse(localStorage.getItem('prime_wp_done') || '{}'))[dateStr] || [];
  dagDone['wp-dag-' + idx] = done.includes(idx);
  const check = document.getElementById('dag-check-wp-dag-' + idx);
  if (check) check.classList.toggle('done', dagDone['wp-dag-' + idx]);
  updateDagProgress();
}

function updateDagProgress() {
  const total = Object.keys(dagDone).length;
  const done = Object.values(dagDone).filter(Boolean).length;
  const el = document.getElementById('dag-progress-txt');
  const bar = document.getElementById('dag-progress-bar');
  if (el) el.textContent = t('training.progressText', { done, total });
  if (bar) bar.style.width = total > 0 ? `${Math.round(done/total*100)}%` : '0%';
}

function renderTrainingDag() {
  const emptyEl = document.getElementById('training-dag-empty');
  const listEl = document.getElementById('training-dag-list');
  const totalEl = document.getElementById('training-dag-total');
  const progWrap = document.getElementById('dag-progress-wrap');

  // Altijd synchroon houden met trainingDays (bv. na kopiëren vanuit Weekplanning)
  trainingDagLog = trainingDays[currentTrainingDate] || [];

  // Weekplanning oefeningen voor vandaag
  const _dagToday = new Date().toISOString().split('T')[0];
  const _dagWpEntry = (JSON.parse(localStorage.getItem('prime_planning') || '[]')).find(p => p.date === _dagToday) || null;
  const _dagWpDoneArr = (JSON.parse(localStorage.getItem('prime_wp_done') || '{}'))[_dagToday] || [];
  const _dagWpOef = _dagWpEntry ? (wpGetOefeningen(_dagWpEntry.schemaId) || []) : [];
  const _dagWpDisp = _dagWpEntry ? wpGetDisplay(_dagWpEntry.schemaId) : null;
  // Voor vandaag verwijderde weekplanning-oefeningen (blijven in het
  // programma zelf staan, tellen hier niet meer mee).
  const _dagWpVerwijderd = wpGetRemoved(_dagToday);
  const _dagWpZichtbaar = _dagWpOef.map(function(oef, i) { return { oef: oef, i: i }; }).filter(function(x) { return !_dagWpVerwijderd.includes(x.i); });

  const totalItems = _dagWpZichtbaar.length + trainingDagLog.length;

  if (totalItems === 0) {
    emptyEl.style.display = 'block';
    listEl.innerHTML = '';
    totalEl.style.display = 'none';
    if (progWrap) progWrap.style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  totalEl.style.display = 'block';
  if (progWrap) progWrap.style.display = 'block';

  // Init dagDone voor losse oefeningen
  trainingDagLog.forEach(function(ex) { if (dagDone[ex.id] === undefined) dagDone[ex.id] = false; });
  // Init dagDone voor weekplanning items (gespiegeld vanuit prime_wp_done) --
  // alleen de zichtbare (niet-verwijderde) indices tellen mee in de voortgang.
  _dagWpOef.forEach(function(_, i) {
    if (_dagWpVerwijderd.includes(i)) { delete dagDone['wp-dag-' + i]; return; }
    dagDone['wp-dag-' + i] = _dagWpDoneArr.includes(i);
  });

  function exCard(ex, onRemove, isDoneOverride, checkClickOverride, openDetailId) {
    const isDone = isDoneOverride !== undefined ? isDoneOverride : dagDone[ex.id];
    const checkClick = (openDetailId ? 'event.stopPropagation();' : '') + (checkClickOverride || "toggleDagDone('" + ex.id + "')");
    const cardClick = openDetailId ? " onclick=\"openExerciseDetail('" + openDetailId + "')\"" : '';
    let _photo = ex.photo;
    if (!_photo) {
      const _f = findCanonicalExercise(ex.name || ex.naam);
      if (_f && _f.photo) _photo = _f.photo;
    }
    const photoDiv = _photo
      ? '<div style="width:80px;min-height:75px;flex-shrink:0;border-radius:8px 0 0 8px;background-image:url(\'' + _photo + '\');background-size:cover;background-position:center"></div>'
      : '<div style="width:80px;min-height:75px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:26px;background:#f0ece4">' + (ex.icon||'💪') + '</div>';
    return '<div class="card"' + cardClick + ' style="margin-bottom:10px;padding:0;overflow:hidden;display:flex;align-items:stretch;' + (openDetailId ? 'cursor:pointer' : '') + '">'
      + photoDiv
      + '<div style="flex:1;min-width:0;padding:12px 14px;display:flex;align-items:center;flex-wrap:wrap;row-gap:6px;gap:10px">'
      + '<div style="flex:1;min-width:120px">'
      + '<div style="font-weight:600;font-size:14px;margin-bottom:2px">' + dispName(ex) + '</div>'
      + '<div style="font-size:12px;color:var(--muted)">' + (function(){
          var st = ex.stappen ? dispField(ex,'stappen') : null;
          if (!st) { var f = findCanonicalExercise(ex.name || ex.naam); if (f && f.stappen) st = dispField(f,'stappen'); }
          return st ? st : (ex.sets ? ex.sets + ' ' + t('programmas.setsAbbr') + ' \xD7 ' + (ex.reps||'') + (ex.rest||ex.rust ? ' \xB7 ' + t('training.restLabel') + ' ' + (ex.rest||ex.rust) : '') : (ex.reps||''));
        })() + '</div>'
      + (ex.youtube ? '<a href="' + ex.youtube + '" target="_blank" onclick="event.stopPropagation()" style="font-size:11px;font-weight:600;color:#ff0000;text-decoration:none">▶ Video</a>' : '')
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;row-gap:4px;flex-shrink:0">'
      + '<div class="ex-check-wrap" onclick="' + checkClick + '" style="cursor:pointer"><div id="dag-check-' + ex.id + '" class="exercise-check ' + (isDone ? 'done' : '') + '" title="' + t('weekplan.markDone') + '">✓</div><span class="ex-check-label">' + t('extra.detail.markDone') + '</span></div>'
      + onRemove
      + '</div>'
      + '</div></div>';
  }

  let html = '';

  // Weekplanning oefeningen (verwijderde/"voor vandaag verborgen" indices overslaan)
  if (_dagWpZichtbaar.length > 0) {
    const wpLabel = _dagWpDisp ? (_dagWpDisp.icon + ' ' + _dagWpDisp.naam) : t('training.weekplanFallback');
    html += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:10px">' + wpLabel + '</div>';
    _dagWpZichtbaar.forEach(function(entry) {
      const oef = entry.oef, i = entry.i;
      const norm = { id: 'wp-dag-' + i, name: dispName(oef) || t('training.exerciseFallback', { n: i+1 }), icon: oef.icon || '💪', sets: oef.sets || '', reps: oef.reps || '', rest: oef.rust || oef.rest || '', youtube: oef.youtube || '', photo: oef.photo || '' };
      html += exCard(norm,
        '<div class="ex-check-wrap" onclick="event.stopPropagation();wpRemoveOefForDay(\'' + _dagToday + '\',' + i + ');renderTrainingDag();updateTrainingDagBadge();try{renderWeekplanning();}catch(e){}" style="cursor:pointer"><span style="font-size:16px;color:var(--muted);line-height:1">✕</span><span class="ex-check-label">' + t('common.delete') + '</span></div>',
        _dagWpDoneArr.includes(i), "toggleWpMijnDag('" + _dagToday + "'," + i + ")");
    });
    html += '</div>';
  }


  // Losse oefeningen
  if (trainingDagLog.length > 0) {
    const groups = {};
    trainingDagLog.forEach(function(ex) {
      if (!groups[ex.group]) groups[ex.group] = [];
      groups[ex.group].push(ex);
    });
    Object.keys(groups).forEach(function(group) {
      const groupMeta = EXTRA_EXERCISES.find(g => g.group === group);
      const groupLabel = groupMeta ? dispField(groupMeta, 'group') : group;
      html += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:10px">💪 ' + groupLabel + '</div>';
      groups[group].forEach(function(ex) {
        const hasDetail = exerciseNotes[ex.id] && (exerciseNotes[ex.id].notes || (exerciseNotes[ex.id].sets && exerciseNotes[ex.id].sets.length));
        html += exCard(ex,
          '<button class="ex-detail-btn ' + (hasDetail ? 'has-data' : '') + '" onclick="event.stopPropagation();openExerciseDetail(\'' + ex.id + '\')">'
          + '<span class="ex-detail-icon">✏️</span><span class="ex-detail-label">' + t('extra.detail.editBtn') + '</span></button>'
          + '<div class="ex-check-wrap" onclick="event.stopPropagation();removeExtraDag(\'' + ex.id + '\')" style="cursor:pointer"><span style="font-size:16px;color:var(--muted);line-height:1">✕</span><span class="ex-check-label">' + t('common.delete') + '</span></div>',
          undefined, undefined, ex.id
        );
      });
      html += '</div>';
    });
  }

  listEl.innerHTML = html;
  updateDagProgress();

  const totalSets = _dagWpZichtbaar.reduce(function(a,x){ return a + Number(x.oef.sets||0); }, 0)
    + trainingDagLog.reduce(function(a,e){ return a + Number(e.sets||0); }, 0);
  totalEl.innerHTML = '<div class="card" style="background:var(--sage-light);border-color:var(--sage-mid);margin-top:4px">'
    + '<div style="font-size:13px;font-weight:600;color:var(--sage);margin-bottom:4px">' + t('training.totalOverview') + '</div>'
    + '<div style="font-size:13px;color:var(--charcoal)">' + t('training.totalSummary', { items: totalItems, sets: totalSets }) + '</div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;margin-top:8px">'
    + '<button class="btn-sm" style="flex:1" onclick="switchTrainingTab(\'oefeningen\')">' + t('training.dag.addExerciseForDay') + '</button>'
    + '<button class="btn-sm" style="flex:1" onclick="switchTrainingTab(\'weekplanning\')">' + t('training.dag.addProgramForDay') + '</button>'
    + '</div>'
    + '<button class="btn-sm" style="width:100%;margin-top:8px" onclick="wpOpenTrainingCopyModal(\'' + _dagToday + '\')">' + t('weekplan.trainingCopy.button') + '</button>'
    + '<button class="btn-sm" style="margin-top:8px;width:100%;color:var(--accent);border-color:#e8c4a8;background:var(--accent-light)" onclick="clearTrainingDag()">' + t('food.clearDay.button') + '</button>';
}

// Wist de training van vandaag volledig: de losse, ad-hoc oefeningen
// (trainingDagLog, sessie-lang) én een eventueel voor vandaag geplande
// programmadag (geplanning/prime_planning), plus hun afgevinkte status --
// zelfde "alles verwijderen"-idee als clearFoodDay() bij Voeding.
// dateStr is optioneel -- standaard vandaag (voor de knop op de Vandaag-tab
// zelf), maar Weekplanning's dagkaarten geven hun eigen datum door zodat
// je ook een andere dag in één keer leeg kunt maken zonder eerst naar die
// dag te hoeven "wisselen".
function clearTrainingDag(dateStr) {
  const target = dateStr || _trainingToday();
  const isVandaag = target === _trainingToday();
  const heeftIets = (trainingDays[target] || []).length > 0 || geplanning.some(p => p.date === target);
  if (!heeftIets) return;
  if (!confirm(t('training.clearDay.confirm'))) return;

  delete trainingDays[target];
  syncSet('prime_training_days', trainingDays);
  if (isVandaag) trainingDagLog = [];

  const voorheen = geplanning.length;
  geplanning = geplanning.filter(p => p.date !== target);
  if (geplanning.length !== voorheen) wpSlaPlanningOp();

  let alleWpDone;
  try { alleWpDone = JSON.parse(localStorage.getItem('prime_wp_done') || '{}'); } catch(e) { alleWpDone = {}; }
  if (alleWpDone[target]) { delete alleWpDone[target]; syncSet('prime_wp_done', alleWpDone); }
  if (isVandaag) Object.keys(dagDone).forEach(k => delete dagDone[k]);

  renderTrainingDag();
  updateTrainingDagBadge();
  try { renderWeekplanning(); } catch (e) { console.error('renderWeekplanning na clearTrainingDag:', e); }
}


function removeExtraDag(exId) {
  trainingDagLog = trainingDagLog.filter(e => e.id !== exId);
  persistTrainingDag();
  renderTrainingDag();
  updateTrainingDagBadge();
}

function initSchemaEx() {
  const exs = EXERCISES[trainingType];
  exs.forEach((ex, i) => {
    const key = `${trainingType}-${i}`;
    if (selectedSchemaEx[key] === undefined) {
      // Aanbevolen oefeningen standaard AAN, rest UIT — net als voeding
      selectedSchemaEx[key] = true; // alle schema oefeningen standaard aan
    }
  });
}

function toggleSchemaEx(i) {
  const key = `${trainingType}-${i}`;
  selectedSchemaEx[key] = !selectedSchemaEx[key];
  const isOn = selectedSchemaEx[key];
  const btn = document.getElementById(`schema-toggle-${i}`);
  const slot = document.getElementById(`exslot-${i}`);
  if (btn) btn.textContent = isOn ? '✓' : '+';
  if (slot) slot.className = `ex-slot ${isOn ? 'ex-slot-on' : 'ex-slot-off'}`;
  updateTrainingDagBadge();
}

function renderTraining() {
  const noMsg = document.getElementById('no-checkin-msg');
  const content = document.getElementById('training-content');
  if (!noMsg || !content) return;
  noMsg.style.display = 'none';
  content.style.display = 'block';
  document.getElementById('training-screen-title').textContent = {
    herstel:t('training.screenTitle.recovery'), normaal:t('training.screenTitle.normal'), zwaar:t('training.screenTitle.heavy')
  }[trainingType];
  document.getElementById('training-screen-badge').innerHTML = badgeHTML(trainingType);

  initSchemaEx();

  const exs = EXERCISES[trainingType];
  const list = document.getElementById('exercise-list');

  list.innerHTML = exs.map((ex, i) => {
    const active = getActiveEx(i);
    const altIdx = selectedAlts[i];
    const isAltSelected = altIdx !== undefined && altIdx >= 0;
    const allOptions = [ex, ...(ex.alts || [])];
    const key = `${trainingType}-${i}`;
    const isOn = selectedSchemaEx[key] !== false;

    return `
    <div class="ex-slot ${isOn ? 'ex-slot-on' : 'ex-slot-off'}" id="exslot-${i}">
      <div class="ex-slot-header" onclick="toggleSchemaEx(${i})" style="cursor:pointer">
        <div class="ex-sel-indicator" id="schema-toggle-${i}">${isOn ? '✓' : '+'}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px">${dispName(active)}
            ${isAltSelected ? `<span class="alt-badge">${t('training.altBadge')}</span>` : ''}
          </div>
          <div style="font-size:12px;color:var(--muted)">${t('training.setsRestLine', { sets: active.sets, reps: active.reps, rest: active.rest })}</div>
        </div>
        <div class="exercise-check ${exerciseDone.includes(i) ? 'done' : ''}" id="excheck-${i}"
             onclick="event.stopPropagation();markDone(${i})" title="${t('weekplan.markDone')}">✓</div>
      </div>

      <div class="ex-options-scroll">
        ${allOptions.map((opt, oi) => {
          const isDefault = oi === 0;
          const isSelected = isDefault ? !isAltSelected : altIdx === oi - 1;
          return `
          <div class="ex-option-card ${isSelected ? 'selected' : ''} ${isDefault && !isAltSelected ? 'is-default' : ''}"
               id="exopt-${i}-${oi}" onclick="selectAlt(${i}, ${oi === 0 ? -1 : oi - 1})">
            <div class="ex-option-sel" id="exoptsel-${i}-${oi}">✓</div>
            ${isDefault ? `<div class="ex-default-tag">${t('training.defaultTag')}</div>` : ''}
            ${opt.photo ? `<div class="ex-option-photo" style="background-image:url('${opt.photo}')"></div>` : `<div class="ex-option-emoji">${opt.icon}</div>`}
            <div class="ex-option-name">${dispName(opt)}</div>
            <div class="ex-option-meta">${opt.sets}×${opt.reps} · ${opt.rest}</div>
            <a href="${opt.youtube}" target="_blank" class="ex-option-yt" onclick="event.stopPropagation()">▶ Video</a>
          </div>`;
        }).join('')}
      </div>

      <div class="ex-detail-bar" id="exdetail-${i}">
        <div class="ex-tip">💡 ${dispField(active,'tip')}</div>
        <div class="sets-grid" style="margin-top:12px">
          <div class="set-item"><div class="set-value">${active.sets}</div><div class="set-label">${t('programmas.col.sets')}</div></div>
          <div class="set-item"><div class="set-value">${active.reps}</div><div class="set-label">${t('programmas.col.reps')}</div></div>
          <div class="set-item"><div class="set-value">${active.rest}</div><div class="set-label">${t('programmas.col.rest')}</div></div>
        </div>
      </div>
    </div>`;
  }).join('');

  updateTrainingProgress();
}

function selectAlt(slotIdx, altIdx) {
  const key = `${trainingType}-${slotIdx}`;
  const currentAlt = selectedAlts[slotIdx];
  const isCurrentlyOn = selectedSchemaEx[key] !== false;

  // Als je klikt op de al-actieve optie → oefening UIT
  const clickingActive = isCurrentlyOn && (
    (altIdx === -1 && currentAlt === undefined) ||
    (altIdx >= 0 && currentAlt === altIdx)
  );

  if (clickingActive) {
    // Zet oefening uit
    selectedSchemaEx[key] = false;
    const btn = document.getElementById(`schema-toggle-${slotIdx}`);
    const slot = document.getElementById(`exslot-${slotIdx}`);
    if (btn) btn.textContent = '+';
    if (slot) slot.className = 'ex-slot ex-slot-off';
    updateTrainingDagBadge();
    return;
  }

  // Zet oefening AAN en kies het alternatief
  selectedSchemaEx[key] = true;
  const btn = document.getElementById(`schema-toggle-${slotIdx}`);
  const slot = document.getElementById(`exslot-${slotIdx}`);
  if (btn) btn.textContent = '✓';
  if (slot) slot.className = 'ex-slot ex-slot-on';

  if (altIdx === -1) delete selectedAlts[slotIdx];
  else selectedAlts[slotIdx] = altIdx;

  const ex = EXERCISES[trainingType][slotIdx];
  const active = getActiveEx(slotIdx);
  const isAltSelected = selectedAlts[slotIdx] !== undefined && selectedAlts[slotIdx] >= 0;
  const allOptions = [ex, ...(ex.alts || [])];

  // Update kaartjes
  allOptions.forEach((opt, oi) => {
    const card = document.getElementById(`exopt-${slotIdx}-${oi}`);
    if (!card) return;
    const isDefault = oi === 0;
    const isSelected = isDefault ? !isAltSelected : selectedAlts[slotIdx] === oi - 1;
    card.classList.toggle('selected', isSelected && !isDefault);
    card.classList.toggle('is-default', isDefault && !isAltSelected);
  });

  // Update header
  const nameEl = slot.querySelector('.ex-slot-header div div');
  if (nameEl) {
    nameEl.innerHTML = dispName(active) + (isAltSelected ? ` <span class="alt-badge">${t('training.altBadge')}</span>` : '');
    const metaEl = slot.querySelector('.ex-slot-header div div + div');
    if (metaEl) metaEl.textContent = t('training.setsRestLine', { sets: active.sets, reps: active.reps, rest: active.rest });
  }

  // Update detail bar
  const detail = document.getElementById(`exdetail-${slotIdx}`);
  if (detail) {
    const tipEl = detail.querySelector('.ex-tip');
    if (tipEl) tipEl.textContent = '💡 ' + dispField(active,'tip');
    const setVals = detail.querySelectorAll('.set-value');
    if (setVals[0]) setVals[0].textContent = active.sets;
    if (setVals[1]) setVals[1].textContent = active.reps;
    if (setVals[2]) setVals[2].textContent = active.rest;
  }

  updateTrainingDagBadge();
}

function toggleEx(i) {
  const d = document.getElementById('exdetail-' + i);
  d.classList.toggle('open');
}

function markDone(i) {
  const idx = exerciseDone.indexOf(i);
  if (idx === -1) exerciseDone.push(i);
  else exerciseDone.splice(idx, 1);
  syncSet('prime_exdone', exerciseDone);
  const c = document.getElementById('excheck-' + i);
  c.classList.toggle('done', exerciseDone.includes(i));
  updateTrainingProgress();
  // Herbereken training samenvatting in checkout live
  if (document.getElementById('day-section').style.display !== 'none') {
    buildTrainingSummary();
  }
}

function updateTrainingProgress() {
  const total = EXERCISES[trainingType].length;
  const done = exerciseDone.length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  document.getElementById('training-prog-bar').style.width = pct + '%';
  document.getElementById('training-prog-txt').textContent = t('training.progressText', { done, total });
}
