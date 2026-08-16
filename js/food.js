// ========== FOOD TAB SWITCHING ==========
function switchFoodTab(tab) {
  ['plan','basis','log','add','addmeal','week'].forEach(t => {
    document.getElementById('foodtab-' + t).style.display = t === tab ? 'block' : 'none';
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
  // "Mijn dag" betekent altijd vandaag — verlaat een eventueel via
  // Weekplanning geopende andere datum weer.
  if (tab === 'log') { switchLogDate(fdTodayStr()); renderDayLog(); }
  if (tab === 'basis') renderProducts();
  if (tab === 'add') renderAddProductTab();
  if (tab === 'addmeal') renderAddMealTab();
  if (tab === 'week') renderFoodWeek();
}

// Combineert de vaste productcatalogus met de eigen producten van deze klant.
function getAllProducts() {
  return [...PRODUCTS, ...customProducts];
}

// ========== VOEDING PER DATUM (t.b.v. Weekplanning) ==========
// dayLog is altijd de array die hoort bij currentLogDate. Standaard is
// dat vandaag ("Mijn dag"); vanuit Weekplanning kan een andere datum
// tijdelijk actief gezet worden om voor die dag voeding toe te voegen.
function fdTodayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function persistDayLog() {
  if (dayLog.length) foodDays[currentLogDate] = dayLog;
  else delete foodDays[currentLogDate];
  syncSet('prime_food_days', foodDays);
}

// Eenmalige opschoning bij het opstarten: verwijdert eventuele al
// opgeslagen foto's uit foodDays van vóór deze wijziging. Dat konden
// grote data-URI's zijn (bij zelf geüploade producten/gerechten), die
// bij elk gelogd item herhaald in localStorage stonden — met
// Weekplanning die dezelfde dag naar meerdere andere dagen kan
// kopiëren, liep de opslag daardoor snel vol (QuotaExceededError).
// Idempotent (no-op zodra alles al opgeschoond is), dus veilig om bij
// elke boot uit te voeren.
function stripPhotosFromFoodDays() {
  let changed = false;
  Object.keys(foodDays).forEach(dateStr => {
    (foodDays[dateStr] || []).forEach(item => {
      // Alleen strippen als de foto ook echt live terug te vinden is
      // via het bewaarde product/gerecht-id — anders zou de foto voor
      // dat item helemaal verloren gaan.
      if (item.photo !== undefined && (item.productId || item.dishId)) {
        delete item.photo;
        changed = true;
      }
    });
  });
  if (changed) syncSet('prime_food_days', foodDays);
}

function switchLogDate(dateStr) {
  currentLogDate = dateStr;
  dayLog = foodDays[dateStr] ? [...foodDays[dateStr]] : [];
  updateLogDateBanner();
  updateMacroTotals();
}

// Toont een kleine banner boven de Voeding-tabs zodra er voor een andere
// dag dan vandaag gelogd wordt (bv. via Weekplanning), met een link terug.
function updateLogDateBanner() {
  const banner = document.getElementById('food-date-banner');
  if (!banner) return;
  const isToday = currentLogDate === fdTodayStr();
  banner.style.display = isToday ? 'none' : 'flex';
  if (!isToday) {
    const [y,m,d] = currentLogDate.split('-').map(Number);
    const dateObj = new Date(y, m-1, d);
    document.getElementById('food-date-banner-text').textContent =
      t('foodweek.editingDate', { date: dateObj.toLocaleDateString(dateLocale(), { day:'numeric', month:'long' }) });
  }
}

function backToTodayLog() {
  switchLogDate(fdTodayStr());
  switchFoodTab('log');
}

// logIdCounter begint elke sessie weer bij 0, maar foodDays blijft nu
// (i.t.t. vroeger) bestaan tussen sessies — een kale ++logIdCounter zou
// dus kunnen botsen met een logId dat gisteren al is uitgedeeld. Neem
// daarom de huidige timestamp als basis, met de sessie-teller als
// tiebreaker voor toevoegingen binnen dezelfde milliseconde.
function newLogId() {
  return Date.now() * 1000 + (logIdCounter++ % 1000);
}

// ========== FOOD RENDER (meal plan tab) ==========
// Let op: dit vulde vroeger automatisch een "aanbevolen maaltijd" uit de
// (inmiddels lege) MEALS-arrays, en reset daarbij steeds alle meal-type
// dayLog-items. Nu de coach eigen gerechten toevoegt i.p.v. de oude
// testmaaltijden bestaat die aanbeveling niet meer — dus geen reset meer,
// anders verdwijnen zelf toegevoegde gerechten bij elke home-render.
function renderFood() {
  document.getElementById('no-checkin-food').style.display = 'none';
  document.getElementById('food-content').style.display = 'block';
  document.getElementById('food-subtitle').textContent = {
    herstel:t('food.subtitle.recovery'),
    normaal:t('food.subtitle.normal'),
    zwaar:t('food.subtitle.heavy')
  }[trainingType];
  renderMealPlan();
  updateMacroTotals();
}

// Zelfde opzet als de productengrid in Basisproducten: één platte lijst,
// klikken opent de portiemodal waarin je gewicht én maaltijdmoment kiest.
function renderMealPlan() {
  if (!customMeals.length) {
    document.getElementById('meal-plan').innerHTML =
      `<div style="font-size:13px;color:var(--muted);padding:8px 0">${t('food.addMeal.noneYet')}</div>`;
    return;
  }
  document.getElementById('meal-plan').innerHTML = `<div class="product-grid">` +
    customMeals.map(m => {
      const tot = mealTotals(m);
      return `
      <div class="product-card" onclick="openMealPortionModal('${m.id}')">
        ${m.photo ? `<div class="product-photo" style="background-image:url('${m.photo}')"></div>` : `<div class="product-icon">🍽️</div>`}
        <div class="product-name">${dispName(m)}</div>
        <div class="product-per">${t('food.addMeal.totalWeightLine', { gram: tot.gram })}</div>
        <div class="product-macros">
          <span class="product-pill">${tot.kcal} kcal</span>
          <span class="product-pill">${t('food.macroAbbr.protein')}${Math.round(tot.prot)}g</span>
        </div>
      </div>`;
    }).join('') + `</div>`;
}

function toggleMeal(id, category) {
  const data = MEALS[trainingType];
  const item = data[category].find(m => m.id === id);
  if (!item) return;

  if (selectedMeals[id]) {
    // Deselect: remove from selectedMeals AND from dayLog
    delete selectedMeals[id];
    dayLog = dayLog.filter(i => i.logId !== 'meal-' + id);
  } else {
    // Select: add to selectedMeals AND to dayLog
    selectedMeals[id] = item;
    dayLog.push({
      logId: 'meal-' + id,
      name: dispName(item),
      icon: item.icon,
      photo: item.photo || null,
      moment: category,
      gram: null,
      kcal: item.kcal,
      prot: item.prot,
      carb: item.carb,
      fat:  item.fat,
      type: 'meal'
    });
  }

  const card = document.getElementById('mcard-' + id);
  const ind = document.getElementById('msel-' + id);
  card.classList.toggle('selected', !!selectedMeals[id]);
  ind.textContent = selectedMeals[id] ? '✓' : '+';
  updateMacroTotals();
  updateLogBadge();
}

// ========== PRODUCT FUNCTIONS ==========
function filterCat(cat, btn) {
  currentCat = cat;
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderProducts();
}

function renderProducts() {
  const q = (document.getElementById('product-search')?.value || '').toLowerCase();
  let list = getAllProducts();
  if (currentCat !== 'alle') list = list.filter(p => p.cat === currentCat);
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || dispName(p).toLowerCase().includes(q));
  document.getElementById('product-grid').innerHTML = `<div class="product-grid">` +
    list.map(p => `
      <div class="product-card" onclick="openPortionModal('${p.id}')">
        ${p.photo ? `<div class="product-photo" style="background-image:url('${p.photo}')"></div>` : `<div class="product-icon">${p.icon || '🍽️'}</div>`}
        <div class="product-name">${dispName(p)}${p.custom ? ' <span style="font-size:9px;color:var(--sage);font-weight:600">(' + t('food.add.own') + ')</span>' : ''}</div>
        <div class="product-per">${t('food.per100')}</div>
        <div class="product-macros">
          <span class="product-pill">${p.kcal} kcal</span>
          <span class="product-pill">${t('food.macroAbbr.protein')}${p.prot}g</span>
        </div>
      </div>`).join('') + `</div>`;
}

// ========== EIGEN PRODUCT TOEVOEGEN ==========
let _apPhotoData = null;

function updateAddProductKcal() {
  const prot = parseFloat(document.getElementById('ap-prot').value) || 0;
  const carb = parseFloat(document.getElementById('ap-carb').value) || 0;
  const fat  = parseFloat(document.getElementById('ap-fat').value) || 0;
  // Standaard voedingswaarde-formule: eiwit/koolhydraten 4 kcal/g, vet 9 kcal/g
  const kcal = Math.round(prot * 4 + carb * 4 + fat * 9);
  document.getElementById('ap-kcal-display').textContent = kcal + ' kcal';
  return kcal;
}

function handleAddProductPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 1.5 * 1024 * 1024) {
    document.getElementById('ap-error').textContent = t('food.add.photoTooBig');
    return;
  }
  document.getElementById('ap-error').textContent = '';
  const reader = new FileReader();
  reader.onload = function(e) {
    _apPhotoData = e.target.result;
    document.getElementById('ap-photo-preview').innerHTML = '<img src="' + _apPhotoData + '" style="width:100%;height:100%;object-fit:cover">';
  };
  reader.readAsDataURL(file);
}

function addCustomProduct() {
  const nameInput = document.getElementById('ap-name');
  const name = nameInput.value.trim();
  const errorEl = document.getElementById('ap-error');
  if (!name) {
    errorEl.textContent = t('food.add.nameRequired');
    return;
  }
  errorEl.textContent = '';

  const kcal = updateAddProductKcal();
  const product = {
    id: 'custom-' + Date.now() + Math.floor(Math.random() * 1000),
    name: name,
    icon: '🍽️',
    cat: document.getElementById('ap-cat').value,
    kcal: kcal,
    prot: parseFloat(document.getElementById('ap-prot').value) || 0,
    carb: parseFloat(document.getElementById('ap-carb').value) || 0,
    fat: parseFloat(document.getElementById('ap-fat').value) || 0,
    photo: _apPhotoData || null,
    custom: true
  };
  customProducts.push(product);
  syncSet('prime_custom_products', customProducts);

  // Formulier resetten
  nameInput.value = '';
  document.getElementById('ap-cat').value = 'overig';
  document.getElementById('ap-prot').value = 0;
  document.getElementById('ap-carb').value = 0;
  document.getElementById('ap-fat').value = 0;
  document.getElementById('ap-kcal-display').textContent = '0 kcal';
  document.getElementById('ap-photo-preview').innerHTML = '🍽️';
  _apPhotoData = null;

  renderAddProductTab();
}

function removeCustomProduct(id) {
  if (!confirm(t('food.add.confirmDelete'))) return;
  customProducts = customProducts.filter(p => p.id !== id);
  syncSet('prime_custom_products', customProducts);
  renderAddProductTab();
}

function renderAddProductTab() {
  const el = document.getElementById('own-products-list');
  if (!el) return;
  if (!customProducts.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--muted)">' + t('food.add.noOwnProducts') + '</div>';
    return;
  }
  el.innerHTML = customProducts.map(p => `
    <div class="card" style="margin-bottom:10px;padding:0;overflow:hidden;display:flex;align-items:stretch">
      ${p.photo
        ? `<div style="width:64px;min-height:60px;background-image:url('${p.photo}');background-size:cover;background-position:center;flex-shrink:0"></div>`
        : `<div style="width:64px;min-height:60px;display:flex;align-items:center;justify-content:center;font-size:22px;background:var(--sand);flex-shrink:0">${p.icon || '🍽️'}</div>`}
      <div style="flex:1;padding:10px 14px;display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px;margin-bottom:2px">${dispName(p)}</div>
          <div style="font-size:11px;color:var(--muted)">${t('cat.' + p.cat)} · ${p.kcal} kcal · ${t('food.macroAbbr.protein')}${p.prot}g ${t('food.macroAbbr.carbs')}${p.carb}g ${t('food.macroAbbr.fat')}${p.fat}g</div>
        </div>
        <button onclick="removeCustomProduct('${p.id}')" style="font-size:16px;padding:4px 8px;border:none;background:none;color:var(--muted);cursor:pointer;flex-shrink:0">×</button>
      </div>
    </div>`).join('');
}

// ========== EIGEN GERECHTEN (opgebouwd uit ingrediënten) ==========
// Totalen worden altijd live berekend uit de ingrediëntenlijst — nooit
// los opgeslagen, dus nooit verouderd na een bewerking.
function mealTotals(dish) {
  const tot = (dish.ingredients || []).reduce((a, i) => ({
    gram: a.gram + (Number(i.gram) || 0),
    prot: a.prot + (Number(i.prot) || 0),
    carb: a.carb + (Number(i.carb) || 0),
    fat:  a.fat  + (Number(i.fat)  || 0)
  }), { gram:0, prot:0, carb:0, fat:0 });
  tot.kcal = Math.round(tot.prot * 4 + tot.carb * 4 + tot.fat * 9);
  return tot;
}

let _amPhotoData = null;
let _amRowCounter = 0;
let _amEditingId = null;

function addIngredientRow() {
  const tbody = document.getElementById('am-ingredients-body');
  if (!tbody) return;
  const rowId = 'amrow-' + (_amRowCounter++);
  const tr = document.createElement('tr');
  tr.id = rowId;
  tr.innerHTML =
    '<td style="padding:4px 6px 4px 0"><input type="text" class="am-ing-name" placeholder="' + t('food.addMeal.ingredientNamePlaceholder') + '" style="width:100%;padding:6px 8px;border:1px solid var(--sand-dark);border-radius:6px;font-size:12px;font-family:\'DM Sans\',sans-serif;background:var(--sand);box-sizing:border-box"></td>' +
    '<td style="padding:4px 3px"><input type="number" class="am-ing-gram" min="0" step="1" value="0" oninput="updateMealFormTotals()" style="width:56px;padding:6px 4px;border:1px solid var(--sand-dark);border-radius:6px;font-size:12px;text-align:center;font-family:\'DM Sans\',sans-serif;background:var(--sand)"></td>' +
    '<td style="padding:4px 3px"><input type="number" class="am-ing-prot" min="0" step="0.1" value="0" oninput="updateMealFormTotals()" style="width:56px;padding:6px 4px;border:1px solid var(--sand-dark);border-radius:6px;font-size:12px;text-align:center;font-family:\'DM Sans\',sans-serif;background:var(--sand)"></td>' +
    '<td style="padding:4px 3px"><input type="number" class="am-ing-carb" min="0" step="0.1" value="0" oninput="updateMealFormTotals()" style="width:56px;padding:6px 4px;border:1px solid var(--sand-dark);border-radius:6px;font-size:12px;text-align:center;font-family:\'DM Sans\',sans-serif;background:var(--sand)"></td>' +
    '<td style="padding:4px 3px"><input type="number" class="am-ing-fat" min="0" step="0.1" value="0" oninput="updateMealFormTotals()" style="width:56px;padding:6px 4px;border:1px solid var(--sand-dark);border-radius:6px;font-size:12px;text-align:center;font-family:\'DM Sans\',sans-serif;background:var(--sand)"></td>' +
    '<td style="padding:4px 3px;text-align:center;font-size:12px;color:var(--muted)" class="am-ing-kcal">0</td>' +
    '<td style="padding:4px 0 4px 4px;text-align:center"><button onclick="removeIngredientRow(\'' + rowId + '\')" style="padding:5px 8px;border-radius:6px;border:none;background:none;color:var(--muted);cursor:pointer;font-size:14px">&#x2715;</button></td>';
  tbody.appendChild(tr);
  updateMealFormTotals();
}

function removeIngredientRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
  updateMealFormTotals();
}

function updateMealFormTotals() {
  const rows = document.querySelectorAll('#am-ingredients-body tr');
  let totGram = 0, totProt = 0, totCarb = 0, totFat = 0;
  rows.forEach(row => {
    const gram = parseFloat(row.querySelector('.am-ing-gram')?.value) || 0;
    const prot = parseFloat(row.querySelector('.am-ing-prot')?.value) || 0;
    const carb = parseFloat(row.querySelector('.am-ing-carb')?.value) || 0;
    const fat  = parseFloat(row.querySelector('.am-ing-fat')?.value)  || 0;
    const kcalCell = row.querySelector('.am-ing-kcal');
    if (kcalCell) kcalCell.textContent = Math.round(prot * 4 + carb * 4 + fat * 9);
    totGram += gram; totProt += prot; totCarb += carb; totFat += fat;
  });
  const totKcal = Math.round(totProt * 4 + totCarb * 4 + totFat * 9);
  const weightEl = document.getElementById('am-total-weight');
  const macrosEl = document.getElementById('am-total-macros');
  if (weightEl) weightEl.textContent = totGram + 'g';
  if (macrosEl) macrosEl.textContent = t('mealPortion.totals', { kcal: totKcal, prot: Math.round(totProt*10)/10, carb: Math.round(totCarb*10)/10, fat: Math.round(totFat*10)/10 });
}

function handleAddMealPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 1.5 * 1024 * 1024) {
    document.getElementById('am-error').textContent = t('food.add.photoTooBig');
    return;
  }
  document.getElementById('am-error').textContent = '';
  const reader = new FileReader();
  reader.onload = function(e) {
    _amPhotoData = e.target.result;
    document.getElementById('am-photo-preview').innerHTML = '<img src="' + _amPhotoData + '" style="width:100%;height:100%;object-fit:cover">';
  };
  reader.readAsDataURL(file);
}

function showMealFormError(msg) {
  const errorEl = document.getElementById('am-error');
  errorEl.textContent = msg;
  errorEl.style.cssText = msg
    ? 'color:#c0392b;font-size:13px;font-weight:600;margin:10px 0 0;padding:10px 12px;background:#fdecea;border:1px solid #f5c2be;border-radius:8px'
    : 'color:#c0392b;font-size:12px;margin:10px 0 0';
  if (msg) errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function addCustomMeal() {
  const nameInput = document.getElementById('am-name');
  const name = nameInput.value.trim();
  if (!name) {
    showMealFormError(t('food.addMeal.nameRequired'));
    nameInput.style.borderColor = '#c0392b';
    return;
  }
  nameInput.style.borderColor = '';

  const rows = document.querySelectorAll('#am-ingredients-body tr');
  const ingredients = [];
  let hasEmptyName = false;
  rows.forEach(row => {
    const nameField = row.querySelector('.am-ing-name');
    const ingName = nameField?.value.trim();
    if (!ingName) {
      if (nameField) nameField.style.borderColor = '#c0392b';
      hasEmptyName = true;
      return;
    }
    if (nameField) nameField.style.borderColor = '';
    ingredients.push({
      name: ingName,
      gram: parseFloat(row.querySelector('.am-ing-gram')?.value) || 0,
      prot: parseFloat(row.querySelector('.am-ing-prot')?.value) || 0,
      carb: parseFloat(row.querySelector('.am-ing-carb')?.value) || 0,
      fat:  parseFloat(row.querySelector('.am-ing-fat')?.value)  || 0
    });
  });
  if (!ingredients.length) {
    showMealFormError(t('food.addMeal.ingredientRequired'));
    return;
  }
  showMealFormError('');

  if (_amEditingId) {
    const dish = customMeals.find(m => m.id === _amEditingId);
    if (dish) {
      dish.name = name;
      dish.photo = _amPhotoData || null;
      dish.ingredients = ingredients;
    }
  } else {
    customMeals.push({
      id: 'custom-meal-' + Date.now() + Math.floor(Math.random() * 1000),
      name: name,
      photo: _amPhotoData || null,
      ingredients: ingredients,
      custom: true
    });
  }
  syncSet('prime_custom_meals', customMeals);

  resetMealForm();
  renderOwnMealsList();
  renderMealPlan();
}

function editCustomMeal(id) {
  const dish = customMeals.find(m => m.id === id);
  if (!dish) return;
  _amEditingId = id;

  document.getElementById('am-name').value = dish.name;
  _amPhotoData = dish.photo || null;
  document.getElementById('am-photo-preview').innerHTML = dish.photo
    ? '<img src="' + dish.photo + '" style="width:100%;height:100%;object-fit:cover">'
    : '🍽️';

  const tbody = document.getElementById('am-ingredients-body');
  tbody.innerHTML = '';
  (dish.ingredients || []).forEach(ing => {
    addIngredientRow();
    const row = tbody.lastElementChild;
    row.querySelector('.am-ing-name').value = ing.name || '';
    row.querySelector('.am-ing-gram').value = ing.gram || 0;
    row.querySelector('.am-ing-prot').value = ing.prot || 0;
    row.querySelector('.am-ing-carb').value = ing.carb || 0;
    row.querySelector('.am-ing-fat').value  = ing.fat  || 0;
  });
  if (!dish.ingredients || !dish.ingredients.length) addIngredientRow();
  updateMealFormTotals();

  document.getElementById('am-form-title').textContent = t('food.addMeal.editTitle');
  document.getElementById('am-submit-btn').textContent = t('food.addMeal.update');
  document.getElementById('am-cancel-btn').style.display = 'inline-block';
  showMealFormError('');

  document.getElementById('am-name').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Reset het formulier naar "nieuw gerecht"-stand — zowel na een geslaagde
// toevoeging/wijziging als bij het annuleren van een bewerking.
function resetMealForm() {
  _amEditingId = null;
  _amPhotoData = null;
  const nameInput = document.getElementById('am-name');
  nameInput.value = '';
  nameInput.style.borderColor = '';
  document.getElementById('am-photo-preview').innerHTML = '🍽️';
  document.getElementById('am-ingredients-body').innerHTML = '';
  addIngredientRow();
  document.getElementById('am-form-title').textContent = t('food.addMeal.formTitle');
  document.getElementById('am-submit-btn').textContent = t('food.addMeal.submit');
  document.getElementById('am-cancel-btn').style.display = 'none';
  showMealFormError('');
}

function removeCustomMeal(id) {
  if (!confirm(t('food.addMeal.confirmDelete'))) return;
  if (_amEditingId === id) resetMealForm();
  customMeals = customMeals.filter(m => m.id !== id);
  syncSet('prime_custom_meals', customMeals);
  // Verwijder eventueel al gelogde porties van dit gerecht, op elke datum
  // (niet alleen vandaag — sinds Weekplanning kan dat ook een andere dag zijn).
  Object.keys(foodDays).forEach(dateStr => {
    const filtered = foodDays[dateStr].filter(i => i.dishId !== id);
    if (filtered.length) foodDays[dateStr] = filtered; else delete foodDays[dateStr];
  });
  syncSet('prime_food_days', foodDays);
  dayLog = dayLog.filter(i => i.dishId !== id);
  renderOwnMealsList();
  renderMealPlan();
  updateMacroTotals();
  updateLogBadge();
}

function renderOwnMealsList() {
  const el = document.getElementById('own-meals-list');
  if (!el) return;
  if (!customMeals.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--muted)">' + t('food.addMeal.noOwnMeals') + '</div>';
    return;
  }
  el.innerHTML = customMeals.map(dish => {
    const tot = mealTotals(dish);
    return `
    <div class="card" style="margin-bottom:10px;padding:0;overflow:hidden;display:flex;align-items:stretch">
      ${dish.photo
        ? `<div style="width:64px;min-height:60px;background-image:url('${dish.photo}');background-size:cover;background-position:center;flex-shrink:0"></div>`
        : `<div style="width:64px;min-height:60px;display:flex;align-items:center;justify-content:center;font-size:22px;background:var(--sand);flex-shrink:0">🍽️</div>`}
      <div style="flex:1;padding:10px 14px;display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px;margin-bottom:2px">${dispName(dish)}</div>
          <div style="font-size:11px;color:var(--muted)">${t('food.addMeal.totalWeightLine', { gram: tot.gram })} · ${tot.kcal} kcal</div>
        </div>
        <button onclick="editCustomMeal('${dish.id}')" style="font-size:12px;padding:6px 10px;border-radius:8px;border:1px solid var(--sand-dark);background:var(--sand);color:var(--charcoal);cursor:pointer;flex-shrink:0">${t('common.edit')}</button>
        <button onclick="removeCustomMeal('${dish.id}')" style="font-size:16px;padding:4px 8px;border:none;background:none;color:var(--muted);cursor:pointer;flex-shrink:0">×</button>
      </div>
    </div>`;
  }).join('');
}

function renderAddMealTab() {
  const tbody = document.getElementById('am-ingredients-body');
  if (tbody && tbody.children.length === 0 && !_amEditingId) addIngredientRow();
  renderOwnMealsList();
}

// ─── Portie (in gram) + maaltijdmoment kiezen bij loggen ──────────────────
// Zelfde opzet als de portiemodal voor producten: moment kiezen via
// knoppen, hoeveelheid in gram i.p.v. percentage.
let _mpDish = null;
let _mpMoment = 'ontbijt';

function openMealPortionModal(dishId) {
  _mpDish = customMeals.find(m => m.id === dishId);
  if (!_mpDish) return;
  _editingLogId = null;
  document.getElementById('mpm-submit-btn').textContent = t('portion.addToDay');
  const tot = mealTotals(_mpDish);
  document.getElementById('mpm-name').textContent = dispName(_mpDish);
  document.getElementById('mpm-reference').textContent = t('mealPortion.totalReference', {
    gram: tot.gram, kcal: tot.kcal,
    prot: Math.round(tot.prot*10)/10, carb: Math.round(tot.carb*10)/10, fat: Math.round(tot.fat*10)/10
  });

  _mpMoment = 'ontbijt';
  document.querySelectorAll('#meal-portion-modal .moment-btn').forEach(function(b, i) {
    b.classList.toggle('active', i === 0);
  });

  document.getElementById('mpm-gram').value = tot.gram || 100;
  updateMealPortionPreview();
  document.getElementById('meal-portion-modal').classList.add('open');
}

function selectMealMoment(moment, btn) {
  _mpMoment = moment;
  document.querySelectorAll('#meal-portion-modal .moment-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function updateMealPortionPreview() {
  if (!_mpDish) return;
  const tot = mealTotals(_mpDish);
  const gram = parseFloat(document.getElementById('mpm-gram').value) || 0;
  const f = tot.gram > 0 ? gram / tot.gram : 0;
  document.getElementById('mpv-kcal').textContent = Math.round(tot.kcal * f);
  document.getElementById('mpv-prot').textContent = Math.round(tot.prot * f * 10) / 10 + 'g';
  document.getElementById('mpv-carb').textContent = Math.round(tot.carb * f * 10) / 10 + 'g';
  document.getElementById('mpv-fat').textContent  = Math.round(tot.fat  * f * 10) / 10 + 'g';
}

function closeMealPortionModal() {
  document.getElementById('meal-portion-modal').classList.remove('open');
  _editingLogId = null;
  document.getElementById('mpm-submit-btn').textContent = t('portion.addToDay');
}

function addMealToLog() {
  if (!_mpDish) return;
  const tot = mealTotals(_mpDish);
  const gram = parseFloat(document.getElementById('mpm-gram').value) || 0;
  if (gram <= 0) return;
  const f = tot.gram > 0 ? gram / tot.gram : 0;

  const values = {
    dishId: _mpDish.id,
    name: dispName(_mpDish),
    icon: '🍽️',
    // Bewust GEEN photo hier bewaren: die kan een grote data-URI zijn bij
    // een zelf geüploade foto, en wordt bij elk gelogd item herhaald in
    // localStorage — met Weekplanning die eenzelfde dag naar meerdere
    // andere dagen kan kopiëren, liep de opslag daardoor snel vol
    // (QuotaExceededError). De foto wordt nu live opgezocht via dishId,
    // zie logItemPhoto().
    moment: _mpMoment,
    gram: Math.round(gram),
    kcal: Math.round(tot.kcal * f),
    prot: Math.round(tot.prot * f * 10) / 10,
    carb: Math.round(tot.carb * f * 10) / 10,
    fat:  Math.round(tot.fat  * f * 10) / 10,
    type: 'meal'
  };

  if (_editingLogId !== null) {
    // Bewerken: bestaand item bijwerken i.p.v. een nieuwe toe te voegen.
    const idx = dayLog.findIndex(i => i.logId === _editingLogId);
    if (idx !== -1) dayLog[idx] = { ...dayLog[idx], ...values };
    _editingLogId = null;
  } else {
    dayLog.push({ logId: newLogId(), ...values });
  }

  closeMealPortionModal();
  persistDayLog();
  updateMacroTotals();
  updateLogBadge();
  renderDayLog();
  if (document.getElementById('foodweek-content')) renderFoodWeek();
}

// ========== PORTION MODAL ==========
// _editingLogId: logId van het item dat bewerkt wordt (via editLogItem()),
// of null als het gaat om een nieuw item toevoegen. Wordt hier bij het
// openen bewust gereset — editLogItem() zet 'm pas ná deze aanroep weer,
// zodat een blijven-hangen edit-status van een eerdere, niet-afgemaakte
// bewerking nooit een gewone "nieuw item toevoegen"-actie kan besmetten.
let _editingLogId = null;

function openPortionModal(productId) {
  currentPortionProduct = getAllProducts().find(p => p.id === productId);
  if (!currentPortionProduct) return;
  _editingLogId = null;
  document.getElementById('pm-submit-btn').textContent = t('portion.addToDay');
  const p = currentPortionProduct;
  document.getElementById('pm-name').textContent = p.icon + ' ' + dispName(p);
  document.getElementById('pm-per100').textContent = `per 100g: ${p.kcal} kcal · ${p.prot}g ${t('portion.protein')} · ${p.carb}g ${t('portion.carbs')} · ${p.fat}g ${t('portion.fat')}`;

  const portieDiv = document.getElementById('pm-portie-btns');
  if (p.portie) {
    _portieAantal = 1;
    const portieLabel = dispField(p.portie, 'label');
    portieDiv.innerHTML =
      '<div style="font-size:12px;font-weight:600;color:var(--charcoal);margin-bottom:6px;margin-top:4px">' + t('portion.choiceLabel') + '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:10px">' +
        '<button id="portie-btn-1" onclick="selectPortie(' + p.portie.gram + ')" ' +
          'style="flex:1;padding:8px;border-radius:8px;border:1.5px solid var(--sage);background:var(--sage);color:white;font-size:12px;font-weight:600;cursor:pointer;font-family:\'DM Sans\',sans-serif">' +
          portieLabel + '</button>' +
        '<button id="portie-btn-100" onclick="selectPortie(100)" ' +
          'style="flex:1;padding:8px;border-radius:8px;border:1.5px solid var(--sand-dark);background:var(--white);color:var(--charcoal);font-size:12px;font-weight:600;cursor:pointer;font-family:\'DM Sans\',sans-serif">' +
          '100g</button>' +
      '</div>' +
      '<div id="portie-stepper" style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
        '<span style="font-size:12px;color:var(--muted);flex:1">' + t('portion.amountOf', { label: portieLabel.toLowerCase() }) + '</span>' +
        '<button onclick="portieAantal(-1)" style="width:32px;height:32px;border-radius:50%;border:1.5px solid var(--sand-dark);background:var(--white);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:\'DM Sans\',sans-serif">−</button>' +
        '<span id="portie-aantal" style="font-size:18px;font-weight:700;min-width:24px;text-align:center">1</span>' +
        '<button onclick="portieAantal(1)" style="width:32px;height:32px;border-radius:50%;border:1.5px solid var(--sage);background:var(--sage);color:white;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:\'DM Sans\',sans-serif">+</button>' +
      '</div>';
    document.getElementById('pm-gram').value = p.portie.gram;
  } else {
    portieDiv.innerHTML = '';
    document.getElementById('pm-gram').value = 100;
  }

  currentMoment = 'ontbijt';
  document.querySelectorAll('.moment-btn').forEach((b,i) => b.classList.toggle('active', i===0));
  updatePortionPreview();
  document.getElementById('portion-modal').classList.add('open');
}

let _portieAantal = 1;

function selectPortie(gram) {
  const p = currentPortionProduct;
  if (!p || !p.portie) return;
  const isPortie = gram === p.portie.gram;
  if (isPortie) {
    _portieAantal = 1;
    document.getElementById('pm-gram').value = p.portie.gram;
    const aantalEl = document.getElementById('portie-aantal');
    if (aantalEl) aantalEl.textContent = '1';
  } else {
    document.getElementById('pm-gram').value = gram;
  }
  const stepper = document.getElementById('portie-stepper');
  if (stepper) stepper.style.display = isPortie ? 'flex' : 'none';
  const btn1   = document.getElementById('portie-btn-1');
  const btn100 = document.getElementById('portie-btn-100');
  if (btn1) {
    btn1.style.background  = isPortie ? 'var(--sage)' : 'var(--white)';
    btn1.style.color       = isPortie ? 'white' : 'var(--charcoal)';
    btn1.style.borderColor = 'var(--sage)';
  }
  if (btn100) {
    btn100.style.background  = !isPortie ? 'var(--sage)' : 'var(--white)';
    btn100.style.color       = !isPortie ? 'white' : 'var(--charcoal)';
    btn100.style.borderColor = !isPortie ? 'var(--sage)' : 'var(--sand-dark)';
  }
  updatePortionPreview();
}

function portieAantal(delta) {
  const p = currentPortionProduct;
  if (!p || !p.portie) return;
  _portieAantal = Math.max(1, _portieAantal + delta);
  document.getElementById('portie-aantal').textContent = _portieAantal;
  document.getElementById('pm-gram').value = _portieAantal * p.portie.gram;
  updatePortionPreview();
}

function closePortionModal() {
  document.getElementById('portion-modal').classList.remove('open');
  _editingLogId = null;
  document.getElementById('pm-submit-btn').textContent = t('portion.addToDay');
}

// Zet de actieve maaltijdmoment-knop in één van de twee portiemodals
// programmatisch (i.p.v. via een klik), voor editLogItem(). Zelfde
// volgorde als de knoppen in de HTML (eerst de 3 maaltijden, dan de 3
// tussendoortjes). Een oud logitem met het legacy moment 'snack' matcht
// hier bewust niets (geen enkele knop heet meer zo) — blijft gewoon
// bij geen enkele knop actief, verder onschadelijk.
function setActiveMomentBtn(modalSelector, moment) {
  const order = ['ontbijt','lunch','avond','tussendoorOchtend','tussendoorMiddag','tussendoorAvond'];
  const idx = order.indexOf(moment);
  document.querySelectorAll(modalSelector + ' .moment-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
}

function selectMoment(moment, btn) {
  currentMoment = moment;
  document.querySelectorAll('.moment-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function updatePortionPreview() {
  const p = currentPortionProduct;
  if (!p) return;
  const gram = parseFloat(document.getElementById('pm-gram').value) || 0;
  const f = gram / 100;
  document.getElementById('pv-kcal').textContent = Math.round(p.kcal * f);
  document.getElementById('pv-prot').textContent = Math.round(p.prot * f * 10) / 10 + 'g';
  document.getElementById('pv-carb').textContent = Math.round(p.carb * f * 10) / 10 + 'g';
  document.getElementById('pv-fat').textContent  = Math.round(p.fat  * f * 10) / 10 + 'g';
}

function addProductToLog() {
  const p = currentPortionProduct;
  const gram = parseFloat(document.getElementById('pm-gram').value) || 0;
  if (!p || gram <= 0) return;
  const f = gram / 100;
  const values = {
    productId: p.id,
    name: dispName(p),
    icon: p.icon,
    // Zie de toelichting bij addMealToLog(): geen photo hier bewaren,
    // wordt live opgezocht via productId, zie logItemPhoto().
    moment: currentMoment,
    gram,
    kcal: Math.round(p.kcal * f),
    prot: Math.round(p.prot * f * 10) / 10,
    carb: Math.round(p.carb * f * 10) / 10,
    fat:  Math.round(p.fat  * f * 10) / 10,
    type: 'product'
  };

  if (_editingLogId !== null) {
    // Bewerken: bestaand item bijwerken i.p.v. een nieuwe toe te voegen.
    const idx = dayLog.findIndex(i => i.logId === _editingLogId);
    if (idx !== -1) dayLog[idx] = { ...dayLog[idx], ...values };
    _editingLogId = null;
  } else {
    dayLog.push({ logId: newLogId(), ...values });
  }

  closePortionModal();
  persistDayLog();
  updateMacroTotals();
  updateLogBadge();
  renderDayLog();
  if (document.getElementById('foodweek-content')) renderFoodWeek();
}

// Opent de bijpassende portiemodal, voorgevuld met de huidige waarden
// van een al gelogd item, zodat je het gewicht/moment kunt aanpassen
// i.p.v. het te moeten verwijderen en opnieuw toe te voegen. Werkt
// zowel vanuit "Vandaag" als vanuit een dag-kaart in Weekplanning —
// zorgt er zelf voor dat dayLog eerst de juiste datum weergeeft.
function editLogItem(dateStr, logId) {
  if (dateStr !== currentLogDate) switchLogDate(dateStr);
  const item = dayLog.find(i => i.logId === logId);
  if (!item) return;

  if (item.productId) {
    openPortionModal(item.productId);
    if (!currentPortionProduct) { alert(t('food.edit.noLongerAvailable')); return; }
    _editingLogId = logId;
    document.getElementById('pm-gram').value = item.gram;
    currentMoment = item.moment;
    setActiveMomentBtn('#portion-modal', item.moment);
    updatePortionPreview();
    document.getElementById('pm-submit-btn').textContent = t('portion.updateInDay');
  } else if (item.dishId) {
    openMealPortionModal(item.dishId);
    if (!_mpDish) { alert(t('food.edit.noLongerAvailable')); return; }
    _editingLogId = logId;
    document.getElementById('mpm-gram').value = item.gram;
    _mpMoment = item.moment;
    setActiveMomentBtn('#meal-portion-modal', item.moment);
    updateMealPortionPreview();
    document.getElementById('mpm-submit-btn').textContent = t('portion.updateInDay');
  } else {
    alert(t('food.edit.noLongerAvailable'));
  }
}

// Verwijdert in één keer alle gelogde voeding van een dag — werkt zowel
// voor "Vandaag" als voor een willekeurige dag vanuit Weekplanning.
function clearFoodDay(dateStr) {
  const items = dateStr === currentLogDate ? dayLog : (foodDays[dateStr] || []);
  if (!items.length) return;
  if (!confirm(t('food.clearDay.confirm'))) return;

  delete foodDays[dateStr];
  syncSet('prime_food_days', foodDays);

  if (dateStr === currentLogDate) {
    dayLog = [];
    updateMacroTotals();
    renderDayLog();
  }
  updateLogBadge();
  if (document.getElementById('foodweek-content')) renderFoodWeek();
}

function updateLogBadge() {
  const badge = document.getElementById('log-count-badge');
  const count = dayLog.length;
  badge.style.display = count > 0 ? 'inline' : 'none';
  badge.textContent = count;
}

// "Mijn dag" is een sessie-lang werkoverzicht (niet permanente historie
// zoals Voortgang), dus toont de naam altijd in de huidige taal — leidt
// hem elke render opnieuw af via het opgeslagen product/gerecht-id i.p.v.
// de bevroren naam van het moment van loggen te gebruiken.
function logItemDisplayName(item) {
  if (item.productId) {
    const p = getAllProducts().find(x => x.id === item.productId);
    if (p) return dispName(p);
  }
  if (item.dishId) {
    const d = customMeals.find(x => x.id === item.dishId);
    if (d) return dispName(d);
  }
  return item.name; // fallback: bv. verwijderd product/gerecht, of ouder logitem zonder id
}

// Zelfde live-opzoek-patroon als logItemDisplayName(), maar dan voor de
// foto: die wordt bewust NIET in het logitem zelf bewaard (zie de
// toelichting bij addProductToLog()/addMealToLog()), dus wordt hij hier
// elke render opnieuw opgezocht via het bewaarde product/gerecht-id.
function logItemPhoto(item) {
  if (item.productId) {
    const p = getAllProducts().find(x => x.id === item.productId);
    if (p) return p.photo || null;
  }
  if (item.dishId) {
    const d = customMeals.find(x => x.id === item.dishId);
    if (d) return d.photo || null;
  }
  return item.photo || null; // fallback: ouder logitem van vóór deze wijziging
}

// Kaartje voor één gelogd item (foto/icoon + naam + gewicht/kcal +
// macro's), klikbaar om te bewerken. Gedeeld tussen "Vandaag"
// (renderDayLog hieronder) en een dag-kaart in Weekplanning
// (fwBouwDagKaart in foodweek.js), zodat ze er identiek uitzien.
function renderLogItemCard(dateStr, item) {
  const photo = logItemPhoto(item);
  return `
    <div class="card" style="margin-bottom:10px;padding:0;overflow:hidden;display:flex;align-items:stretch;cursor:pointer" onclick="editLogItem('${dateStr}', ${item.logId})">
      ${photo
        ? `<div style="width:80px;min-height:75px;background-image:url('${photo}');background-size:cover;background-position:center;flex-shrink:0;border-radius:var(--radius-sm) 0 0 var(--radius-sm)"></div>`
        : `<div style="width:80px;min-height:75px;display:flex;align-items:center;justify-content:center;font-size:26px;background:var(--sand);flex-shrink:0">${item.icon}</div>`}
      <div style="flex:1;padding:10px 14px;display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px;margin-bottom:2px">${logItemDisplayName(item)}</div>
          <div style="font-size:11px;color:var(--muted)">
            ${item.type === 'meal' ? t('food.log.mealTag') : item.gram + 'g'} · ${item.kcal} kcal
          </div>
          <div style="font-size:11px;color:var(--muted)">${t('food.macroAbbr.protein')}:${Math.round(item.prot)}g ${t('food.macroAbbr.carbs')}:${Math.round(item.carb)}g ${t('food.macroAbbr.fat')}:${Math.round(item.fat)}g</div>
        </div>
        <button onclick="event.stopPropagation(); fwRemoveItem('${dateStr}', ${item.logId})"
          style="font-size:16px;padding:4px 8px;border:none;background:none;color:var(--muted);cursor:pointer;flex-shrink:0">×</button>
      </div>
    </div>`;
}

// Groepeert een lijst logitems per moment (ontbijt/lunch/avond, dan de
// 3 tussendoortjes) en bouwt daar de kaartenlijst voor — ook gedeeld
// met Weekplanning. 'snack' blijft als legacy-fallback staan (oude
// logitems van vóór de opsplitsing in ochtend/middag/avond), gesorteerd
// helemaal achteraan onder een generieke "Tussendoortje"-kop.
function renderLogItemsHtml(dateStr, items) {
  const momentLabels = {
    ontbijt: t('moment.ontbijt'), lunch: t('moment.lunch'), avond: t('moment.avond'),
    tussendoorOchtend: t('moment.tussendoorOchtend'), tussendoorMiddag: t('moment.tussendoorMiddag'), tussendoorAvond: t('moment.tussendoorAvond'),
    snack: t('moment.snack')
  };
  const momentOrder = { ontbijt:0, lunch:1, avond:2, tussendoorOchtend:3, tussendoorMiddag:4, tussendoorAvond:5, snack:6 };

  const sorted = [...items].sort((a,b) => momentOrder[a.moment] - momentOrder[b.moment]);
  const grouped = {};
  sorted.forEach(item => {
    if (!grouped[item.moment]) grouped[item.moment] = [];
    grouped[item.moment].push(item);
  });

  return Object.entries(grouped)
    .sort((a,b) => momentOrder[a[0]] - momentOrder[b[0]])
    .map(([moment, momentItems]) => `
      <div style="margin-bottom:18px">
        <div style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:10px">${momentLabels[moment]}</div>
        ${momentItems.map(item => renderLogItemCard(dateStr, item)).join('')}
      </div>`).join('');
}

function renderDayLog() {
  const empty = document.getElementById('day-log-empty');
  const list = document.getElementById('day-log-list');
  const totals = document.getElementById('day-log-totals');

  if (dayLog.length === 0) {
    empty.style.display = 'block';
    list.innerHTML = '';
    totals.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  totals.style.display = 'block';
  list.innerHTML = renderLogItemsHtml(currentLogDate, dayLog);

  const tot = dayLog.reduce((a,i) => ({ kcal:a.kcal+i.kcal, prot:a.prot+i.prot, carb:a.carb+i.carb, fat:a.fat+i.fat }), {kcal:0,prot:0,carb:0,fat:0});
  document.getElementById('log-summary').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;text-align:center">
      <div style="background:var(--sand);border-radius:10px;padding:12px">
        <div style="font-family:'DM Serif Display',serif;font-size:20px">${Math.round(tot.kcal)}</div>
        <div style="font-size:11px;color:var(--muted)">${t('portion.kcal')}</div>
      </div>
      <div style="background:var(--sand);border-radius:10px;padding:12px">
        <div style="font-family:'DM Serif Display',serif;font-size:20px;color:var(--accent)">${Math.round(tot.prot*10)/10}g</div>
        <div style="font-size:11px;color:var(--muted)">${t('portion.protein')}</div>
      </div>
      <div style="background:var(--sand);border-radius:10px;padding:12px">
        <div style="font-family:'DM Serif Display',serif;font-size:20px;color:#5a7cc8">${Math.round(tot.carb*10)/10}g</div>
        <div style="font-size:11px;color:var(--muted)">${t('portion.carbs')}</div>
      </div>
      <div style="background:var(--sand);border-radius:10px;padding:12px">
        <div style="font-family:'DM Serif Display',serif;font-size:20px;color:#c8a85a">${Math.round(tot.fat*10)/10}g</div>
        <div style="font-size:11px;color:var(--muted)">${t('portion.fat')}</div>
      </div>
    </div>`;
}

// ========== MACRO TOTALS (combined: meals + log) ==========
function updateHomeMacros() {
  const el = document.getElementById('home-nutrient-rows');
  if (!el) return;
  const doel = MEALS[trainingType]?.doel || { kcal:2000, prot:150, carb:200, fat:65 };
  const tot = dayLog.reduce((a,i) => ({
    kcal: a.kcal+i.kcal, prot: a.prot+i.prot, carb: a.carb+i.carb, fat: a.fat+i.fat
  }), { kcal:0, prot:0, carb:0, fat:0 });

  const macros = [
    { label:t('food.nutrient.calories'), val:Math.round(tot.kcal), doel:doel.kcal, unit:'kcal', color:'#4CAF50' },
    { label:t('food.nutrient.carbs'), val:Math.round(tot.carb), doel:doel.carb, unit:'g.', color:'#E91E8C' },
    { label:t('food.nutrient.protein'), val:Math.round(tot.prot), doel:doel.prot, unit:'g.', color:'#2196F3' },
    { label:t('food.nutrient.fat'), val:Math.round(tot.fat), doel:doel.fat, unit:'g.', color:'#FF5722' },
  ];

  el.innerHTML = macros.map(m => {
    const pct = Math.min(100, Math.round(m.val / m.doel * 100));
    const ratio = m.val / m.doel;
    const fillColor = ratio > 1.1 ? '#E24B4A' : ratio >= 0.85 ? m.color : '#EF9F27';
    const rmin = Math.round(m.doel * 0.9);
    const rmax = Math.round(m.doel * 1.1);
    return `
      <div style="display:grid;grid-template-columns:100px 80px 1fr;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--sand-dark)">
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--charcoal)">${m.label}</div>
          <div style="font-size:10px;color:var(--muted)">${t('food.goalRange', { min: rmin, max: rmax, unit: m.unit })}</div>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--charcoal)">${m.val} ${m.unit}</div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:12px;background:var(--sand-dark);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${fillColor};border-radius:4px;transition:width 0.4s"></div>
          </div>
          <div style="font-size:11px;font-weight:600;color:var(--muted);min-width:28px;text-align:right">${pct}%</div>
        </div>
      </div>`;
  }).join('');
  // Remove last border
  el.lastElementChild && (el.lastElementChild.style.borderBottom = 'none');
}

function updateMacroTotals() {
  const doel = MEALS[trainingType]?.doel || { kcal:2000, prot:150, carb:200, fat:65 };

  // Doel-range: ±10% marge
  const range = (val) => ({ min: Math.round(val * 0.9), max: Math.round(val * 1.1) });

  // dayLog is de enige bron van waarheid
  const tot = dayLog.reduce((a,i) => ({
    kcal: a.kcal + i.kcal,
    prot: a.prot + i.prot,
    carb: a.carb + i.carb,
    fat:  a.fat  + i.fat
  }), { kcal:0, prot:0, carb:0, fat:0 });

  tot.kcal = Math.round(tot.kcal);
  tot.prot = Math.round(tot.prot);
  tot.carb = Math.round(tot.carb);
  tot.fat  = Math.round(tot.fat);

  const macros = [
    { valId:'f-kcal', barId:'bar-kcal', pctId:'pct-kcal', doelId:'doel-kcal',
      val: tot.kcal, doel: doel.kcal, unit:'kcal', color:'#4CAF50' },
    { valId:'f-carb', barId:'bar-carb', pctId:'pct-carb', doelId:'doel-carb',
      val: tot.carb, doel: doel.carb, unit:'g.', color:'#E91E8C' },
    { valId:'f-prot', barId:'bar-prot', pctId:'pct-prot', doelId:'doel-prot',
      val: tot.prot, doel: doel.prot, unit:'g.', color:'#2196F3' },
    { valId:'f-fat',  barId:'bar-fat',  pctId:'pct-fat',  doelId:'doel-fat',
      val: tot.fat,  doel: doel.fat,  unit:'g.', color:'#FF5722' },
  ];

  macros.forEach(m => {
    const r = range(m.doel);
    const pct = Math.min(100, Math.round(m.val / m.doel * 100));
    const ratio = m.val / m.doel;

    // Kleur: groen op doel, rood te veel, oranje te weinig
    const fillColor = ratio > 1.1 ? '#E24B4A' : ratio >= 0.85 ? m.color : '#EF9F27';

    document.getElementById(m.valId).textContent = `${m.val} ${m.unit}`;
    document.getElementById(m.barId).style.width = pct + '%';
    document.getElementById(m.barId).style.background = fillColor;
    document.getElementById(m.pctId).textContent = pct + '%';
    document.getElementById(m.doelId).textContent = t('food.goalRange', { min: r.min, max: r.max, unit: m.unit });
  });

  // Count label onder tabs
  const totalItems = dayLog.length;
  const el = document.getElementById('meal-count');
  if (el) el.textContent = totalItems > 0
    ? t('food.itemsLoggedTotal', { n: totalItems, item: t('checkin.item') + (totalItems>1?'s':''), kcal: tot.kcal })
    : t('food.plan.hintShort');

  // Herbereken voedingssamenvatting in checkout live
  if (document.getElementById('day-section') && document.getElementById('day-section').style.display !== 'none') {
    buildFoodSummary();
  }

  // Update dashboard preview
  updateHomeMacros();
}
