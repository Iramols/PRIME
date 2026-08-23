function getActiveEx(i) {
  const exs = EXERCISES[trainingType];
  const ex = exs[i];
  const altIdx = selectedAlts[i];
  if (altIdx !== undefined && altIdx >= 0 && ex.alts && ex.alts[altIdx]) {
    return ex.alts[altIdx];
  }
  return ex;
}

function switchTrainingTab(tab) {
  activeTrainingTab = tab;
  ['schemas','programmas','weekplanning','oefeningen','addexercise','dag'].forEach(t => {
    const btn = document.getElementById(`ttab-${t}`);
    const content = document.getElementById(`ttab-content-${t}`);
    if (btn) btn.classList.toggle('active', t === tab);
    if (content) content.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'schemas') renderSchemas();
  if (tab === 'programmas') renderProgrammas();
  if (tab === 'oefeningen') renderExtraExercises();
  if (tab === 'addexercise') renderAddExerciseTab();
  if (tab === 'dag') renderTrainingDag();
  if (tab === 'weekplanning') renderWeekplanning();
}

function renderSchemas() {
  const el = document.getElementById('schemas-list');
  el.innerHTML = TRAINING_SCHEMAS.map(schema => {
    const isActive = activeSchemaId === schema.id;
    return `
    <div class="card" style="margin-bottom:16px;border:2px solid ${isActive ? schema.kleur : 'var(--sand-dark)'};
         background:${isActive ? schema.kleur + '12' : 'var(--white)'};cursor:pointer;transition:all 0.2s"
         onclick="selectSchema('${schema.id}')">
      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:14px">
        ${schema.foto ? `<div style="width:80px;height:80px;border-radius:10px;background-image:url('${schema.foto}');background-size:cover;background-position:center;flex-shrink:0"></div>` : `<div style="font-size:36px;flex-shrink:0">${schema.icon}</div>`}
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <div style="font-family:'DM Serif Display',serif;font-size:18px">${dispName(schema)}</div>
            ${isActive ? `<span style="background:${schema.kleur};color:white;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px">${t('training.selected')}</span>` : ''}
          </div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:6px">${dispField(schema,'beschrijving')}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span style="font-size:11px;padding:3px 8px;border-radius:8px;background:var(--sand);color:var(--charcoal)">📊 ${dispField(schema,'level')}</span>
            <span style="font-size:11px;padding:3px 8px;border-radius:8px;background:var(--sand);color:var(--charcoal)">🎯 ${dispField(schema,'doel')}</span>
            <span style="font-size:11px;padding:3px 8px;border-radius:8px;background:var(--sand);color:var(--charcoal)">⏱ ${schema.duur}</span>
          </div>
        </div>
      </div>
      <div style="border-top:1px solid var(--sand-dark);padding-top:12px">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:var(--muted);margin-bottom:8px">
          ${t('training.exerciseCount', { n: schema.oefeningen.length })}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">
          ${schema.oefeningen.map((ex, ei) => {
            const itemKey = schema.id + '-' + ei;
            const isOn = isActive ? (selectedSchemaItems[itemKey] !== false) : true;
            return `
            <div onclick="${isActive ? `toggleSchemaItem('${schema.id}', ${ei})` : ''}"
                 style="border:1.5px solid ${isOn && isActive ? 'var(--sage)' : 'var(--sand-dark)'};border-radius:8px;overflow:hidden;
                        background:${isOn && isActive ? 'var(--sage-light)' : 'var(--white)'};
                        opacity:${!isActive || isOn ? '1' : '0.45'};
                        cursor:${isActive ? 'pointer' : 'default'};transition:all 0.15s;position:relative">
              ${isActive ? `<div style="position:absolute;top:4px;right:4px;width:16px;height:16px;border-radius:50%;
                background:${isOn ? 'var(--sage)' : 'var(--white)'};border:1.5px solid ${isOn ? 'var(--sage)' : 'var(--muted)'};
                display:flex;align-items:center;justify-content:center;font-size:9px;color:white;font-weight:700;z-index:1">
                ${isOn ? '✓' : ''}</div>` : ''}
              ${ex.photo ? `<div style="height:60px;background-image:url('${ex.photo}');background-size:cover;background-position:center"></div>`
                         : `<div style="height:60px;display:flex;align-items:center;justify-content:center;font-size:24px;background:var(--sand)">${ex.icon}</div>`}
              <div style="padding:6px 8px">
                <div style="font-size:11px;font-weight:600;line-height:1.3">${dispName(ex)}</div>
                <div style="font-size:10px;color:var(--muted)">${ex.sets}×${ex.reps}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
        ${isActive ? `
          <button onclick="event.stopPropagation();deselectSchema()"
            style="margin-top:12px;width:100%;padding:10px;border-radius:10px;border:1px solid var(--sand-dark);
            background:var(--white);color:var(--muted);cursor:pointer;font-size:13px;font-family:'DM Sans',sans-serif">
            ${t('training.removeSchemaFromDay')}
          </button>` : `
          <button onclick="event.stopPropagation();selectSchema('${schema.id}')"
            style="margin-top:12px;width:100%;padding:10px;border-radius:10px;border:none;
            background:${schema.kleur};color:white;cursor:pointer;font-size:13px;font-weight:600;font-family:'DM Sans',sans-serif">
            ${t('training.addSchemaToDay')}
          </button>`}
      </div>
    </div>`;
  }).join('');
}

function selectSchema(id) {
  if (activeSchemaId === id) return; // al geselecteerd
  activeSchemaId = id;
  sessionStorage.setItem('prime_active_schema', id);
  // Zet alle oefeningen standaard AAN
  const schema = TRAINING_SCHEMAS.find(s => s.id === id);
  if (schema) {
    schema.oefeningen.forEach(function(ex, i) {
      selectedSchemaItems[id + '-' + i] = true;
    });
    sessionStorage.setItem('prime_schema_items', JSON.stringify(selectedSchemaItems));
  }
  renderSchemas();
  updateTrainingDagBadge();
}

function deselectSchema() {
  if (activeSchemaId) {
    // Verwijder selecties voor dit schema
    const schema = TRAINING_SCHEMAS.find(s => s.id === activeSchemaId);
    if (schema) schema.oefeningen.forEach(function(ex, i) {
      delete selectedSchemaItems[activeSchemaId + '-' + i];
    });
    sessionStorage.setItem('prime_schema_items', JSON.stringify(selectedSchemaItems));
  }
  activeSchemaId = null;
  sessionStorage.removeItem('prime_active_schema');
  renderSchemas();
  updateTrainingDagBadge();
}

function toggleSchemaItem(schemaId, idx) {
  const key = schemaId + '-' + idx;
  selectedSchemaItems[key] = !selectedSchemaItems[key];
  sessionStorage.setItem('prime_schema_items', JSON.stringify(selectedSchemaItems));
  renderSchemas();
  updateTrainingDagBadge();
}

function renderExtraExercises() {
  // Sync met sessionStorage
  try { const s = sessionStorage.getItem('prime_training_dag'); if (s) trainingDagLog = JSON.parse(s); } catch(e) {}
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
          const inDag = trainingDagLog.find(e => e.id === ex.id);
          const hasDetail = exerciseNotes[ex.id] && (exerciseNotes[ex.id].notes || (exerciseNotes[ex.id].sets && exerciseNotes[ex.id].sets.length));
          return `
            <div class="ex-extra-card ${inDag ? 'selected' : ''}" onclick="toggleExtraDag('${ex.id}')" ondblclick="openExerciseDetail('${ex.id}')">
              <div class="ex-extra-sel" id="extra-sel-${ex.id}">${inDag ? '✓' : ''}</div>
              ${ex.photo ? `<div class="ex-extra-photo" style="background-image:url('${ex.photo}')"></div>` : `<div class="ex-extra-photo ex-extra-icon">${ex.icon || '🏋️'}</div>`}
              <div class="ex-extra-body">
                <div class="ex-extra-name">${dispName(ex)}</div>
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

function findExtraExercise(exId) {
  for (const group of EXTRA_EXERCISES) {
    const found = group.exercises.find(e => e.id === exId);
    if (found) return found;
  }
  return customExercises.find(e => e.id === exId) || null;
}

// ========== EIGEN OEFENING TOEVOEGEN (met foto) ==========
let _aePhotoData = null;

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

  const exercise = {
    id: 'custom-ex-' + Date.now() + Math.floor(Math.random() * 1000),
    name: name,
    icon: '🏋️',
    group: document.getElementById('ae-group').value,
    sets: parseInt(document.getElementById('ae-sets').value, 10) || 1,
    reps: document.getElementById('ae-reps').value.trim(),
    rest: document.getElementById('ae-rest').value.trim(),
    youtube: document.getElementById('ae-youtube').value.trim(),
    photo: _aePhotoData || null,
    custom: true
  };
  customExercises.push(exercise);
  syncSet('prime_custom_exercises', customExercises);

  // Formulier resetten
  nameInput.value = '';
  document.getElementById('ae-group').value = 'Eigen oefeningen';
  document.getElementById('ae-sets').value = 3;
  document.getElementById('ae-reps').value = '';
  document.getElementById('ae-rest').value = '';
  document.getElementById('ae-youtube').value = '';
  document.getElementById('ae-photo-preview').innerHTML = '🏋️';
  _aePhotoData = null;

  renderAddExerciseTab();
}

function removeCustomExercise(id) {
  if (!confirm(t('food.add.confirmDelete'))) return;
  customExercises = customExercises.filter(e => e.id !== id);
  syncSet('prime_custom_exercises', customExercises);
  // Ook verwijderen uit Vandaag als hij daar (nog) in staat.
  trainingDagLog = trainingDagLog.filter(e => e.id !== id);
  sessionStorage.setItem('prime_training_dag', JSON.stringify(trainingDagLog));
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

function openExerciseDetail(exId) {
  const ex = findExtraExercise(exId);
  if (!ex) return;
  _edExerciseId = exId;
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
  document.getElementById('exercise-detail-modal').classList.add('open');
}

function closeExerciseDetail() {
  document.getElementById('exercise-detail-modal').classList.remove('open');
  _edExerciseId = null;
}

function edRenderSets() {
  const el = document.getElementById('ed-sets');
  el.innerHTML = _edSets.map((s, i) => `
    <div class="ed-set-row">
      <div class="ed-set-grid" style="flex:1">
        <div class="ed-set-num">${i + 1}</div>
        <input class="ed-set-input" type="text" value="${s.reps.replace(/"/g,'&quot;')}" oninput="_edSets[${i}].reps=this.value">
        <input class="ed-set-input" type="text" value="${s.rest.replace(/"/g,'&quot;')}" oninput="_edSets[${i}].rest=this.value">
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
  if (!_edExerciseId) return;
  const notes = document.getElementById('ed-notes').value.trim();
  exerciseNotes[_edExerciseId] = { sets: _edSets.map(s => ({ ...s })), notes };
  syncSet('prime_exercise_notes', exerciseNotes);
  closeExerciseDetail();
  try { renderExtraExercises(); } catch(e) { console.error(e); }
  try { showToast(t('extra.detail.saved')); } catch(e) { console.error(e); }
}

function toggleExtraDag(exId) {
  const existing = trainingDagLog.findIndex(e => e.id === exId);
  if (existing !== -1) {
    trainingDagLog.splice(existing, 1);
  } else {
    // Find exercise data — eerst in de vaste EXTRA_EXERCISES-groepen (die hun
    // group-naam niet los op het oefening-object hebben staan), anders bij de
    // eigen oefeningen (die group al als eigen veld hebben).
    let found = null;
    for (const group of EXTRA_EXERCISES) {
      found = group.exercises.find(e => e.id === exId);
      if (found) { found = { ...found, group: group.group }; break; }
    }
    if (!found) {
      const custom = customExercises.find(e => e.id === exId);
      if (custom) found = { ...custom };
    }
    if (found) trainingDagLog.push(found);
  }
  sessionStorage.setItem('prime_training_dag', JSON.stringify(trainingDagLog));
  renderExtraExercises();
  updateTrainingDagBadge();
}

function updateTrainingDagBadge() {
  const tab = document.getElementById('ttab-dag');
  if (!tab) return;
  const activeSchema = activeSchemaId ? TRAINING_SCHEMAS.find(s => s.id === activeSchemaId) : null;
  const schemaTabCount = activeSchema ? activeSchema.oefeningen.length : 0;
  const today = new Date().toISOString().split('T')[0];
  const wpEntry = (JSON.parse(localStorage.getItem('prime_planning') || '[]')).find(p => p.date === today) || null;
  const wpCount = wpEntry ? (wpGetOefeningen(wpEntry.schemaId) || []).length : 0;
  const count = schemaTabCount + wpCount + trainingDagLog.length;
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

  // Altijd synchroon houden met sessionStorage
  try {
    const stored = sessionStorage.getItem('prime_training_dag');
    if (stored) trainingDagLog = JSON.parse(stored);
    const ssi = sessionStorage.getItem('prime_schema_items');
    if (ssi) selectedSchemaItems = JSON.parse(ssi);
  } catch(e) {}
  activeSchemaId = sessionStorage.getItem('prime_active_schema') || null;

  // Weekplanning oefeningen voor vandaag
  const _dagToday = new Date().toISOString().split('T')[0];
  const _dagWpEntry = (JSON.parse(localStorage.getItem('prime_planning') || '[]')).find(p => p.date === _dagToday) || null;
  const _dagWpDoneArr = (JSON.parse(localStorage.getItem('prime_wp_done') || '{}'))[_dagToday] || [];
  const _dagWpOef = _dagWpEntry ? (wpGetOefeningen(_dagWpEntry.schemaId) || []) : [];
  const _dagWpDisp = _dagWpEntry ? wpGetDisplay(_dagWpEntry.schemaId) : null;

  // Bouw items op — filter op selectedSchemaItems
  const activeSchema = activeSchemaId ? TRAINING_SCHEMAS.find(s => s.id === activeSchemaId) : null;
  const schemaTabItems = activeSchema ? activeSchema.oefeningen.map(function(ex, i) {
    return Object.assign({}, ex, { id: 'schema-tab-' + i, groep: activeSchema.name, _idx: i });
  }).filter(function(ex) {
    return selectedSchemaItems[activeSchemaId + '-' + ex._idx] !== false;
  }) : [];

  const totalItems = schemaTabItems.length + _dagWpOef.length + trainingDagLog.length;

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

  // Init dagDone voor schema-tab en losse oefeningen
  schemaTabItems.forEach(function(ex) { if (dagDone[ex.id] === undefined) dagDone[ex.id] = false; });
  trainingDagLog.forEach(function(ex) { if (dagDone[ex.id] === undefined) dagDone[ex.id] = false; });
  // Init dagDone voor weekplanning items (gespiegeld vanuit prime_wp_done)
  _dagWpOef.forEach(function(_, i) {
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
      + '<div style="flex:1;padding:12px 14px;display:flex;align-items:center;gap:10px">'
      + '<div style="flex:1">'
      + '<div style="font-weight:600;font-size:14px;margin-bottom:2px">' + dispName(ex) + '</div>'
      + '<div style="font-size:12px;color:var(--muted)">' + (function(){
          var st = ex.stappen ? dispField(ex,'stappen') : null;
          if (!st) { var f = findCanonicalExercise(ex.name || ex.naam); if (f && f.stappen) st = dispField(f,'stappen'); }
          return st ? st : (ex.sets ? ex.sets + ' ' + t('programmas.setsAbbr') + ' \xD7 ' + (ex.reps||'') + (ex.rest||ex.rust ? ' \xB7 ' + t('training.restLabel') + ' ' + (ex.rest||ex.rust) : '') : (ex.reps||''));
        })() + '</div>'
      + (ex.youtube ? '<a href="' + ex.youtube + '" target="_blank" onclick="event.stopPropagation()" style="font-size:11px;font-weight:600;color:#ff0000;text-decoration:none">▶ Video</a>' : '')
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">'
      + (openDetailId
          ? '<div class="ex-check-wrap"><div id="dag-check-' + ex.id + '" class="exercise-check ' + (isDone ? 'done' : '') + '" onclick="' + checkClick + '" title="' + t('weekplan.markDone') + '">✓</div><span class="ex-check-label">' + t('extra.detail.markDone') + '</span></div>'
          : '<div id="dag-check-' + ex.id + '" class="exercise-check ' + (isDone ? 'done' : '') + '" onclick="' + checkClick + '" title="' + t('weekplan.markDone') + '">✓</div>')
      + onRemove
      + '</div>'
      + '</div></div>';
  }

  let html = '';

  // Weekplanning oefeningen
  if (_dagWpOef.length > 0) {
    const wpLabel = _dagWpDisp ? (_dagWpDisp.icon + ' ' + _dagWpDisp.naam) : t('training.weekplanFallback');
    html += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:10px">' + wpLabel + '</div>';
    _dagWpOef.forEach(function(oef, i) {
      const norm = { id: 'wp-dag-' + i, name: dispName(oef) || t('training.exerciseFallback', { n: i+1 }), icon: oef.icon || '💪', sets: oef.sets || '', reps: oef.reps || '', rest: oef.rust || oef.rest || '', youtube: oef.youtube || '', photo: oef.photo || '' };
      html += exCard(norm, '', _dagWpDoneArr.includes(i), "toggleWpMijnDag('" + _dagToday + "'," + i + ")");
    });
    html += '</div>';
  }

  // Schema's tab
  if (schemaTabItems.length > 0) {
    html += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:10px">📋 ' + dispName(activeSchema) + '</div>';
    schemaTabItems.forEach(function(ex) {
      html += exCard(ex, '<button onclick="deselectSchema();renderTrainingDag();" style="font-size:16px;padding:4px 8px;border:none;background:none;color:var(--muted);cursor:pointer">✕</button>');
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
          + '<button onclick="event.stopPropagation();removeExtraDag(\'' + ex.id + '\')" style="font-size:16px;padding:4px 8px;border:none;background:none;color:var(--muted);cursor:pointer">✕</button>',
          undefined, undefined, ex.id
        );
      });
      html += '</div>';
    });
  }

  listEl.innerHTML = html;
  updateDagProgress();

  const totalSets = schemaTabItems.reduce(function(a,e){ return a + Number(e.sets||0); }, 0)
    + _dagWpOef.reduce(function(a,e){ return a + Number(e.sets||0); }, 0)
    + trainingDagLog.reduce(function(a,e){ return a + Number(e.sets||0); }, 0);
  totalEl.innerHTML = '<div class="card" style="background:var(--sage-light);border-color:var(--sage-mid);margin-top:4px">'
    + '<div style="font-size:13px;font-weight:600;color:var(--sage);margin-bottom:4px">' + t('training.totalOverview') + '</div>'
    + '<div style="font-size:13px;color:var(--charcoal)">' + t('training.totalSummary', { items: totalItems, sets: totalSets }) + '</div>'
    + '</div>';
}


function removeExtraDag(exId) {
  trainingDagLog = trainingDagLog.filter(e => e.id !== exId);
  sessionStorage.setItem('prime_training_dag', JSON.stringify(trainingDagLog));
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
