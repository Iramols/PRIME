// ========== COACH BEHEER ==========
// Opgeslagen foto-overrides in localStorage
function getCustomPhotos() {
  try { return JSON.parse(localStorage.getItem('prime_custom_photos') || '{}'); } catch(e) { return {}; }
}
function saveCustomPhotos(photos) {
  localStorage.setItem('prime_custom_photos', JSON.stringify(photos));
}

// Laad foto's uit custom-photos.json (voor online gebruik) en merge met localStorage
function loadPhotosFromFile(callback) {
  var done = function() { applyCustomPhotos(); if (callback) callback(); };
  try {
    fetch('./custom-photos.json')
      .then(function(r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function(filePhotos) {
        if (filePhotos && typeof filePhotos === 'object' && Object.keys(filePhotos).length > 0) {
          var local = getCustomPhotos();
          // Bestand is de basis, lokale uploads overschrijven (nieuwer)
          var merged = Object.assign({}, filePhotos, local);
          saveCustomPhotos(merged);
        }
        done();
      })
      .catch(done);
  } catch(e) { done(); }
}

// Exporteer alle custom foto's als custom-photos.json (sla op in projectmap en push)
function exportCustomPhotosFile() {
  var photos = getCustomPhotos();
  if (Object.keys(photos).length === 0) {
    alert('Geen eigen foto\'s gevonden. Upload eerst foto\'s via het beheer paneel.');
    return;
  }
  var json = JSON.stringify(photos, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'custom-photos.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function switchBeheerTab(tab) {
  ['training','schemas','maaltijden','producten'].forEach(t => {
    document.getElementById('btab-' + t).classList.toggle('active', t === tab);
    document.getElementById('btab-content-' + t).style.display = t === tab ? 'block' : 'none';
  });
  renderBeheerTab(tab);
}

function renderBeheerTab(tab) {
  try {
  const photos = getCustomPhotos();
  let items = [];

  if (tab === 'training') {
    var typeLabel = {herstel:'Hersteldag', normaal:'Normale training', zwaar:'Zware training'};
    ['herstel','normaal','zwaar'].forEach(function(type) {
      (EXERCISES[type] || []).forEach(function(ex) {
        if (!items.find(function(i) { return i.key === 'ex-' + ex.name; }))
          items.push({ key: 'ex-' + ex.name, label: ex.name, group: typeLabel[type], currentPhoto: photos['ex-' + ex.name] || ex.photo || '' });
        (ex.alts || []).forEach(function(alt) {
          if (!items.find(function(i) { return i.key === 'ex-' + alt.name; }))
            items.push({ key: 'ex-' + alt.name, label: alt.name, group: typeLabel[type] + ' — alternatieven', currentPhoto: photos['ex-' + alt.name] || alt.photo || '' });
        });
      });
    });
    EXTRA_EXERCISES.forEach(function(group) {
      group.exercises.forEach(function(ex) {
        if (!items.find(function(i) { return i.key === 'ex-' + ex.name; })) {
          items.push({ key: 'ex-' + ex.name, label: ex.name, group: group.group, currentPhoto: photos['ex-' + ex.name] || ex.photo || '' });
        }
      });
    });
    items = items.filter(function(item, idx, self) { return self.findIndex(function(i) { return i.key === item.key; }) === idx; });
  } else if (tab === 'schemas') {
    TRAINING_SCHEMAS.forEach(function(schema) {
      items.push({ key: 'schema-' + schema.id, label: schema.name, group: "Schema's", currentPhoto: photos['schema-' + schema.id] || schema.foto || '' });
    });
  } else if (tab === 'maaltijden') {
    var momentLabel = {ontbijt:'Ontbijt', lunch:'Lunch', avond:'Avond', snack:'Snack'};
    ['herstel','normaal','zwaar'].forEach(function(type) {
      var data = MEALS[type] || {};
      ['ontbijt','lunch','avond','snack'].forEach(function(moment) {
        (data[moment] || []).forEach(function(meal) {
          if (!items.find(function(i) { return i.key === 'meal-' + meal.name; })) {
            items.push({ key: 'meal-' + meal.name, label: meal.name, group: momentLabel[moment] || moment, currentPhoto: photos['meal-' + meal.name] || meal.photo || '' });
          }
        });
      });
    });
  } else if (tab === 'producten') {
    // PRODUCTS is een flat array met cat property
    var catLabel = {fruit:'Fruit', groente:'Groente', vlees:'Vlees', vis:'Vis', zuivel:'Zuivel', granen:'Granen', noten:'Noten', overig:'Overig'};
    PRODUCTS.forEach(function(p) {
      var cat = catLabel[p.cat] || p.cat || 'Overig';
      items.push({ key: 'prod-' + p.name, label: p.name, group: cat, currentPhoto: photos['prod-' + p.name] || p.photo || '' });
    });
  }

  // Groepeer
  var groups = {};
  items.forEach(function(item) {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  });

  var el = document.getElementById('btab-content-' + tab);
  var html = '';

  Object.keys(groups).forEach(function(group) {
    html += '<div style="margin-bottom:24px">';
    html += '<div style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:12px">' + group + '</div>';
    html += '<div style="display:flex;flex-direction:column;gap:10px">';

    groups[group].forEach(function(item) {
      var isCustom = item.currentPhoto && item.currentPhoto.startsWith('data:');
      var safeKey = item.key.replace(/'/g, "\\'");
      var safeTab = tab.replace(/'/g, "\\'");

      html += '<div class="card" style="padding:12px 16px;display:flex;align-items:center;gap:14px">';

      // Foto preview
      html += '<div style="width:64px;height:48px;border-radius:8px;flex-shrink:0;overflow:hidden;background:var(--sand)">';
      if (item.currentPhoto) {
        html += '<img src="' + item.currentPhoto + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'">';
      } else {
        html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:10px">geen foto</div>';
      }
      html += '</div>';

      // Label
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-weight:600;font-size:13px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + item.label + '</div>';
      html += isCustom
        ? '<div style="font-size:10px;color:var(--sage)">✓ Eigen foto actief</div>'
        : '<div style="font-size:10px;color:var(--muted)">Standaard foto</div>';
      html += '</div>';

      // Knoppen
      html += '<div style="display:flex;gap:8px;flex-shrink:0">';
      html += '<label style="cursor:pointer">';
      html += '<input type="file" accept="image/*" style="display:none" onchange="handlePhotoUpload(event,\'' + safeKey + '\',\'' + safeTab + '\')">';
      html += '<span style="font-size:12px;padding:6px 12px;border-radius:8px;border:1px solid var(--sage);color:var(--sage);font-weight:600;white-space:nowrap">📷 Upload</span>';
      html += '</label>';
      if (isCustom) {
        html += '<button onclick="resetPhoto(\'' + safeKey + '\',\'' + safeTab + '\')" style="font-size:12px;padding:6px 10px;border-radius:8px;border:1px solid var(--sand-dark);background:none;color:var(--muted);cursor:pointer">↩ Reset</button>';
      }
      html += '</div>';

      html += '</div>'; // card
    });

    html += '</div></div>'; // group
  });

  el.innerHTML = html;
  } catch(err) {
    document.getElementById('btab-content-' + tab).innerHTML =
      '<div class="card" style="color:red;padding:16px">Fout bij laden: ' + err.message + '</div>';
    console.error('renderBeheerTab error:', err);
  }
}


function handlePhotoUpload(event, key, tab) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 1.5 * 1024 * 1024) {
    alert('Foto is te groot. Gebruik een foto van maximaal 1.5MB.');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const photos = getCustomPhotos();
    photos[key] = e.target.result;
    saveCustomPhotos(photos);
    applyCustomPhotos();
    renderBeheerTab(tab);
  };
  reader.readAsDataURL(file);
}

function resetPhoto(key, tab) {
  const photos = getCustomPhotos();
  delete photos[key];
  saveCustomPhotos(photos);
  applyCustomPhotos();
  renderBeheerTab(tab);
}

function applyCustomPhotos() {
  const photos = getCustomPhotos();
  // Pas toe op EXERCISES
  ['herstel','normaal','zwaar'].forEach(type => {
    (EXERCISES[type] || []).forEach(ex => {
      if (photos['ex-' + ex.name]) ex.photo = photos['ex-' + ex.name];
      (ex.alts || []).forEach(alt => {
        if (photos['ex-' + alt.name]) alt.photo = photos['ex-' + alt.name];
      });
    });
  });
  // Pas toe op EXTRA_EXERCISES
  EXTRA_EXERCISES.forEach(group => {
    group.exercises.forEach(ex => {
      if (photos['ex-' + ex.name]) ex.photo = photos['ex-' + ex.name];
    });
  });
  // Pas toe op TRAINING_SCHEMAS
  TRAINING_SCHEMAS.forEach(schema => {
    if (photos['schema-' + schema.id]) schema.foto = photos['schema-' + schema.id];
    schema.oefeningen.forEach(ex => {
      if (photos['ex-' + ex.name]) ex.photo = photos['ex-' + ex.name];
    });
  });
  // Pas toe op MEALS
  ['herstel','normaal','zwaar'].forEach(type => {
    const data = MEALS[type] || {};
    ['ontbijt','lunch','avond','snack'].forEach(moment => {
      (data[moment] || []).forEach(meal => {
        if (photos['meal-' + meal.name]) meal.photo = photos['meal-' + meal.name];
      });
    });
  });
  // Pas toe op PRODUCTS (flat array)
  (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []).forEach(function(p) {
    if (photos['prod-' + p.name]) p.photo = photos['prod-' + p.name];
  });
}

