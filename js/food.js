// ========== FOOD TAB SWITCHING ==========
function switchFoodTab(tab) {
  if (tab !== 'add') _apTerug = null;
  ['plan','basis','primemeals','log','add','addmeal','week'].forEach(t => {
    document.getElementById('foodtab-' + t).style.display = t === tab ? 'block' : 'none';
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
  // "Mijn dag" betekent altijd vandaag — verlaat een eventueel via
  // Weekplanning geopende andere datum weer.
  if (tab === 'log') { switchLogDate(fdTodayStr()); renderDayLog(); }
  if (tab === 'basis') { renderProducts(); primeProductsRefreshFromCloud(); }
  if (tab === 'primemeals') { renderPrimeMealPlan(); primeMealsRefreshFromCloud(); }
  if (tab === 'add') { renderAddProductTab(); primeProductsRefreshFromCloud(); }
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
  return localDateStr();
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

// Onthoudt vanuit welk tabblad ("log" = Vandaag, "week" = Weekplanning)
// de coach op "+ Product"/"+ Gerecht" heeft geklikt, zodat
// addProductToLog()/addMealToLog() daar na het toevoegen weer naartoe
// kunnen springen i.p.v. op Basisproducten/Gerechten te blijven hangen.
// null = niet via zo'n knop hierheen gekomen (bv. rechtstreeks via de
// tabbladbalk) -- dan blijft het bestaande gedrag (gewoon op dit
// tabblad blijven) ongewijzigd.
let _portionReturnTab = null;

// Voor de "+ Product"/"+ Gerecht"-knoppen op "Vandaag" zelf (zie
// fwAddForDay in foodweek.js voor de Weekplanning-variant).
function foodAddForDay(tab) {
  _portionReturnTab = 'log';
  switchFoodTab(tab);
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
  document.getElementById('food-content').style.display = 'block';
  // Vaste titel ({naam} — Maaltijdplanner), zelfde reden als bij Training.
  document.getElementById('food-screen-title').textContent = t('food.plannerTitle', { name: profile.name || t('history.defaultUserName') });
  document.getElementById('food-subtitle').textContent = t('food.subtitle');
  renderMealPlan();
  updateMacroTotals();
}

// Coach-only "Wis voeding compleet" -- zelfde opzet als wpVerwijder()
// (Training): maakt alle gelogde voeding leeg (prime_food_days, alle
// datums) en werkt meteen de op dat moment zichtbare Voeding-subtab bij,
// i.p.v. pas na het wisselen van tab.
function foodVerwijderAlles() {
  if (!confirm(t('food.confirmClearAll'))) return;
  foodDays = {};
  syncSet('prime_food_days', foodDays);
  dayLog = [];
  updateMacroTotals();
  if (document.getElementById('foodtab-log')?.style.display !== 'none') renderDayLog();
  if (document.getElementById('foodtab-week')?.style.display !== 'none') renderFoodWeek();
  try { updateHomeMacros(); } catch (e) { console.error('herrenderen na foodVerwijderAlles:', e); }
}

// Zelfde opzet als de productengrid in Basisproducten: één platte lijst,
// klikken opent de portiemodal waarin je gewicht én maaltijdmoment kiest.
function renderMealPlan() {
  if (!customMeals.length) {
    document.getElementById('meal-plan').innerHTML =
      `<div style="font-size:13px;color:var(--muted);padding:8px 0">${t('food.addMeal.noneYet')}</div>`;
    return;
  }
  const q = (document.getElementById('mealplan-search')?.value || '').toLowerCase();
  const list = q ? customMeals.filter(m => m.name.toLowerCase().includes(q) || dispName(m).toLowerCase().includes(q)) : customMeals;
  if (!list.length) {
    document.getElementById('meal-plan').innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">${t('common.noSearchResults')}</div>`;
    return;
  }
  document.getElementById('meal-plan').innerHTML = `<div class="product-grid">` +
    list.map(m => {
      const tot = mealTotals(m);
      return `
      <div class="product-card" onclick="openMealPortionModal('${m.id}')">
        ${m.photo ? `<div class="product-photo"><img src="${m.photo}" style="width:100%;height:100%;object-fit:cover;display:block"></div>` : `<div class="product-icon">🍽️</div>`}
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
  document.querySelectorAll('#cat-tabs .cat-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderProducts();
}

function renderProducts() {
  const q = (document.getElementById('product-search')?.value || '').toLowerCase();
  // Chip "Eigen" alleen tonen als er eigen producten zijn; verdwijnt het gekozen
  // filter, dan terug naar "Alle".
  const heeftEigen = customProducts.length > 0;
  const _ce = document.getElementById('cat-chip-eigen');
  if (_ce) _ce.style.display = heeftEigen ? '' : 'none';
  if (currentCat === 'eigen' && !heeftEigen) {
    currentCat = 'alle';
    document.querySelectorAll('#cat-tabs .cat-tab').forEach((b, i) => b.classList.toggle('active', i === 0));
  }
  let list = getAllProducts();
  if (currentCat === 'eigen') list = list.filter(p => p.custom);
  else if (currentCat !== 'alle') list = list.filter(p => p.cat === currentCat);
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || dispName(p).toLowerCase().includes(q));
  document.getElementById('product-grid').innerHTML = `<div class="product-grid">` +
    list.map(p => `
      <div class="product-card" onclick="openPortionModal('${p.id}')">
        ${productLabelHtml(p)}
        ${p.photo ? `<div class="product-photo"><img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;display:block"></div>` : `<div class="product-icon">${p.icon || '🍽️'}</div>`}
        <div class="product-name">${dispName(p)}</div>
        <div class="product-per">${t('food.per100')}</div>
        <div class="product-macros">
          <span class="product-pill">${p.kcal} kcal</span>
          <span class="product-pill">${t('food.macroAbbr.protein')}${p.prot}g</span>
        </div>
      </div>`).join('') + `</div>`;
}

// ========== EIGEN PRODUCT TOEVOEGEN ==========
let _apPhotoData = null;
let _apEditingId = null; // id van het product dat bewerkt wordt, null = nieuw product
let _apPrimeId = null; // id van het basisproduct dat de coach voor iedereen aanpast, anders null
let _apTerug = null; // {tab, datum, productId}: waar de coach vandaan kwam (Mijn dag/Weekplanning) toen hij een product ging aanpassen
let _apCopyOf = null; // id van het basisproduct waarvan de coach een kopie maakt, anders null
let ownCat = 'alle'; // gekozen categorie in de tab "Eigen basisproducten"
let _apCopyOwn = false; // true = kopie van een eigen product (de coach kiest zelf: voor iedereen of eigen)

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
  if (file.size > MAX_PHOTO_BYTES) {
    document.getElementById('ap-error').textContent = t('food.add.photoTooBig', { kb: Math.round(file.size / 1024), max: MAX_PHOTO_BYTES / 1024 });
    return;
  }
  document.getElementById('ap-error').textContent = '';
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = e.target.result;
    _apPhotoData = preview;
    document.getElementById('ap-photo-preview').innerHTML = '<img src="' + preview + '" style="width:100%;height:100%;object-fit:cover">';
    // Op de achtergrond naar Storage uploaden en de base64 vervangen door de
    // URL; lukt dat niet (of is er inmiddels een andere foto gekozen), dan
    // blijft de base64 gewoon staan.
    uploadPhotoToStorage(file).then(function(url) { if (url && _apPhotoData === preview) _apPhotoData = url; });
  };
  reader.readAsDataURL(file);
}

function addCustomProduct() {
  if (_apPrimeId) { savePrimeProductEdit(); return; }
  if (_apCopyOf || _apGedeeld()) { savePrimeProductNew(); return; }
  const nameInput = document.getElementById('ap-name');
  const name = nameInput.value.trim();
  const errorEl = document.getElementById('ap-error');
  if (!name) {
    errorEl.textContent = t('food.add.nameRequired');
    return;
  }
  if (_apCopyOwn && productNaamBestaat(name, _apEditingId)) { errorEl.textContent = t('food.prime.nameExists'); return; }
  errorEl.textContent = '';

  const kcal = updateAddProductKcal();
  const velden = {
    name: name,
    cat: document.getElementById('ap-cat').value,
    kcal: kcal,
    prot: parseFloat(document.getElementById('ap-prot').value) || 0,
    carb: parseFloat(document.getElementById('ap-carb').value) || 0,
    fat: parseFloat(document.getElementById('ap-fat').value) || 0,
    photo: _apPhotoData || null
  };
  if (_apBarcode) velden.barcode = _apBarcode;

  let deelId = null;
  if (_apEditingId) {
    // Bewerken: bestaand product bijwerken, id/custom-vlag blijven staan.
    const product = customProducts.find(p => p.id === _apEditingId);
    if (product) Object.assign(product, velden);
    const deelVinkje = document.getElementById('ap-share-edit');
    if (isPrimeCoach() && deelVinkje && deelVinkje.checked) deelId = _apEditingId;
  } else {
    customProducts.push({
      id: 'custom-' + Date.now() + Math.floor(Math.random() * 1000),
      icon: '🍽️',
      custom: true,
      ...velden
    });
  }
  syncSet('prime_custom_products', customProducts);

  resetAddProductForm();
  renderAddProductTab();
  renderProducts();
  // Coach koos "ook voor iedereen": het (zojuist bijgewerkte) product verhuist naar Basisproducten.
  if (deelId) deelEigenProduct(deelId, true).then(() => apTerugNaarDag());
  else apTerugNaarDag();
}

// Zelfde patroon als resetMealForm(): leegt het formulier en zet het terug
// in "nieuw product toevoegen"-stand -- gebruikt na een succesvolle
// toevoeging/wijziging én door de "Annuleren"-knop tijdens het bewerken.
function resetAddProductForm() {
  document.getElementById('ap-name').value = '';
  document.getElementById('ap-cat').value = 'overig';
  document.getElementById('ap-prot').value = 0;
  document.getElementById('ap-carb').value = 0;
  document.getElementById('ap-fat').value = 0;
  document.getElementById('ap-kcal-display').textContent = '0 kcal';
  document.getElementById('ap-photo-preview').innerHTML = '🍽️';
  document.getElementById('ap-error').textContent = '';
  _apPhotoData = null;
  _apEditingId = null;
  _apPrimeId = null;
  _apCopyOf = null;
  _apCopyOwn = false;
  _apBarcode = null;
  showApForm(false);
  const _pa = document.getElementById('ap-prime-actions');
  if (_pa) _pa.style.display = 'none';
  const _sh = document.getElementById('ap-share');
  if (_sh) _sh.checked = true;
  const _se = document.getElementById('ap-share-edit');
  if (_se) _se.checked = false;
  const _hint = document.getElementById('ap-hint');
  if (_hint) _hint.style.display = 'none';
  document.getElementById('ap-submit-btn').classList.remove('coach-only-btn');
  updateApShareRow();

  document.getElementById('ap-form-title').textContent = t('food.add.formTitle');
  document.getElementById('ap-submit-btn').textContent = t('food.add.submit');
  document.getElementById('ap-cancel-btn').style.display = 'none';
}

// Vult het "+ Basisproduct toevoegen"-formulier met de gegevens van een
// bestaand eigen product -- zelfde opzet als editCustomMeal() bij Gerechten.
function editCustomProduct(id) {
  const product = customProducts.find(p => p.id === id);
  if (!product) return;
  _apEditingId = id;
  showApForm(true);
  updateApShareRow();

  document.getElementById('ap-name').value = product.name;
  document.getElementById('ap-cat').value = product.cat || 'overig';
  document.getElementById('ap-prot').value = product.prot || 0;
  document.getElementById('ap-carb').value = product.carb || 0;
  document.getElementById('ap-fat').value = product.fat || 0;
  updateAddProductKcal();
  _apPhotoData = product.photo || null;
  document.getElementById('ap-photo-preview').innerHTML = product.photo
    ? '<img src="' + product.photo + '" style="width:100%;height:100%;object-fit:cover">'
    : '🍽️';
  document.getElementById('ap-error').textContent = '';

  document.getElementById('ap-form-title').textContent = t('food.add.editTitle');
  document.getElementById('ap-submit-btn').textContent = t('food.add.update');
  document.getElementById('ap-cancel-btn').style.display = 'inline-block';

  switchFoodTab('add');
  document.getElementById('ap-name').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function removeCustomProduct(id) {
  if (!confirm(t('food.add.confirmDelete'))) return;
  customProducts = customProducts.filter(p => p.id !== id);
  syncSet('prime_custom_products', customProducts);
  renderAddProductTab();
}

function renderAddProductTab() {
  updateApShareRow();
  const el = document.getElementById('own-products-list');
  if (!el) return;
  let lijst = customProducts;
  if (ownCat !== 'alle') lijst = lijst.filter(p => p.cat === ownCat);
  const q = (document.getElementById('own-product-search')?.value || '').toLowerCase();
  if (q) lijst = lijst.filter(p => p.name.toLowerCase().includes(q) || dispName(p).toLowerCase().includes(q));
  const tegel = `
    <div class="product-card" onclick="openAddProductForm()" style="border-style:dashed;border-color:var(--sage);background:var(--sage-light);display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:130px">
      <div style="font-size:34px;line-height:1;color:var(--sage);margin-bottom:8px">➕</div>
      <div class="product-name" style="color:var(--sage)">${t('food.add.tile')}</div>
    </div>`;
  const scanTegel = isPrimeCoach() ? `
    <div class="product-card coach-only-btn" onclick="openBarcodeScanner()" style="border-style:dashed;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:130px">
      <div style="font-size:34px;line-height:1;margin-bottom:8px">📷</div>
      <div class="product-name">${t('food.scan.tile')}</div>
    </div>` : '';
  el.innerHTML = `<div class="product-grid">` + tegel + scanTegel + lijst.map(p => `
    <div class="product-card" onclick="openOwnProductModal('${p.id}')">
      <span class="prod-label prod-label-own">${t('food.label.own')}</span>
      ${p.photo ? `<div class="product-photo"><img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;display:block"></div>` : `<div class="product-icon">${p.icon || '🍽️'}</div>`}
      <div class="product-name">${dispName(p)}</div>
      <div class="product-per">${t('food.per100')}</div>
      <div class="product-macros">
        <span class="product-pill">${p.kcal} kcal</span>
        <span class="product-pill">${t('food.macroAbbr.protein')}${p.prot}g</span>
      </div>
    </div>`).join('') + `</div>` +
    (!customProducts.length ? '<div style="font-size:13px;color:var(--muted);margin-top:12px">' + t('food.add.noOwnProducts') + '</div>' : '');
}

// Eigen-producten-tab: categoriefilter (zelfde chips als bij Basisproducten) en
// het formulier, dat pas opent zodra je op de tegel "Product toevoegen" tikt.
function filterOwnCat(cat, btn) {
  ownCat = cat;
  document.querySelectorAll('#own-cat-tabs .cat-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderAddProductTab();
}

function showApForm(toon) {
  const kaart = document.getElementById('ap-form-card');
  if (kaart) kaart.style.display = toon ? 'block' : 'none';
}

function openAddProductForm() {
  resetAddProductForm();
  showApForm(true);
  const naamEl = document.getElementById('ap-name');
  naamEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  naamEl.focus();
}

// Klik op een eigen product: scherm met alle functies (inplannen, bewerken,
// verwijderen en voor de coach ook voor iedereen beschikbaar maken / kopiëren).
function openOwnProductModal(id) {
  const p = customProducts.find(x => x.id === id);
  if (!p) return;
  document.getElementById('opm-name').textContent = (p.icon || '') + ' ' + dispName(p);
  document.getElementById('opm-per100').textContent = `per 100g: ${p.kcal} kcal · ${p.prot}g ${t('portion.protein')} · ${p.carb}g ${t('portion.carbs')} · ${p.fat}g ${t('portion.fat')}`;
  const knop = 'font-size:14px;padding:12px;border-radius:10px;cursor:pointer;font-weight:600;font-family:inherit;width:100%;text-align:left';
  const nu = isPrimeCoach();
  document.getElementById('opm-actions').innerHTML =
    `<button class="btn-primary" style="margin-bottom:0" onclick="closeOwnProductModal();openPortionModal('${p.id}')">${t('portion.addToDay')}</button>` +
    `<button style="${knop};border:1px solid var(--sand-dark);background:var(--sand);color:var(--charcoal)" onclick="closeOwnProductModal();editCustomProduct('${p.id}')">✏️ ${t('common.edit')}</button>` +
    (nu ? `<button class="coach-only-btn" style="${knop};border:1px solid var(--coach-only)" onclick="closeOwnProductModal();deelEigenProduct('${p.id}')">${t('food.prime.shareOwn')}</button>` : '') +
    (nu ? `<button class="coach-only-btn" style="${knop};border:1px solid var(--coach-only)" onclick="closeOwnProductModal();kopieerEigenProduct('${p.id}')">${t('food.prime.copyOwn')}</button>` : '') +
    `<button style="${knop};border:1px solid #e8c4a8;background:var(--accent-light);color:var(--accent)" onclick="closeOwnProductModal();removeCustomProduct('${p.id}')">🗑️ ${t('common.delete')}</button>`;
  document.getElementById('own-product-modal').classList.add('open');
}

function closeOwnProductModal() {
  document.getElementById('own-product-modal').classList.remove('open');
}

// ========== PRIME-GERECHTEN (gedeeld, alleen coach kan bewerken) ==========
// Zelfde idee als de PRIME-programma's in Training: cache-first uit
// localStorage, daarna ververst vanuit de gedeelde Supabase-tabel
// (prime_meals, zie supabase/prime_meals.sql) zodra de tab geopend wordt.
let primeMeals = [];
try { primeMeals = JSON.parse(localStorage.getItem('prime_prime_meals') || '[]'); } catch(e) {}

// Zoekt een gerecht op id, zowel onder de eigen (per-klant) gerechten als
// onder de gedeelde PRIME-gerechten -- gebruikt overal waar een gelogd of
// aan te klikken gerecht wordt opgezocht, zodat een PRIME-gerecht net zo
// bruikbaar is als een eigen gerecht.
function findAnyMeal(id) {
  return customMeals.find(m => m.id === id) || primeMeals.find(m => m.id === id);
}

async function primeMealsRefreshFromCloud() {
  const list = await fetchPrimeMealsFromCloud();
  if (list) {
    primeMeals = list;
    warmPhotoCache(list.map(m => m.photo));
    if (document.getElementById('foodtab-primemeals')?.style.display !== 'none') renderPrimeMealPlan();
  }
}

// Lijst voor de "PRIME gerechten"-tab. Voor iedereen klikbaar om te loggen
// (zelfde portiemodal als Maaltijdplan). De coach ziet Bewerken/Verwijderen;
// iedereen anders ziet in plaats daarvan "Bekijken" -- opent hetzelfde
// formulier als Bewerken, maar dan alleen-lezen, zodat klanten kunnen zien
// wat er precies in een PRIME-gerecht zit (net als bij PRIME-programma's).
function renderPrimeMealPlan() {
  const el = document.getElementById('prime-meal-plan');
  if (!el) return;
  const canEdit = isPrimeCoach();
  if (!primeMeals.length) {
    el.innerHTML = `<div style="font-size:13px;color:var(--muted);padding:8px 0">${t('food.primeMeals.empty')}</div>`;
    return;
  }
  const q = (document.getElementById('primemeal-search')?.value || '').toLowerCase();
  const list = q ? primeMeals.filter(m => m.name.toLowerCase().includes(q) || dispName(m).toLowerCase().includes(q)) : primeMeals;
  if (!list.length) {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">${t('common.noSearchResults')}</div>`;
    return;
  }
  el.innerHTML = `<div class="product-grid">` +
    list.map(m => {
      const tot = mealTotals(m);
      return `
      <div class="product-card" onclick="openMealPortionModal('${m.id}')">
        ${m.photo ? `<div class="product-photo"><img src="${m.photo}" style="width:100%;height:100%;object-fit:cover;display:block"></div>` : `<div class="product-icon">🍽️</div>`}
        <div class="product-name">${dispName(m)}</div>
        <div class="product-per">${t('food.addMeal.totalWeightLine', { gram: tot.gram })}</div>
        <div class="product-macros">
          <span class="product-pill">${tot.kcal} kcal</span>
          <span class="product-pill">${t('food.macroAbbr.protein')}${Math.round(tot.prot)}g</span>
        </div>
        <div style="display:flex;gap:6px;margin-top:8px" onclick="event.stopPropagation()">
          ${canEdit ? `
          <button class="btn-sm coach-only-btn" style="flex:1;font-size:11px;padding:5px 6px" onclick="editPrimeMeal('${m.id}')">${t('common.edit')}</button>
          <button class="btn-sm coach-only-btn" style="flex:1;font-size:11px;padding:5px 6px;color:var(--accent);border-color:#e8c4a8;background:var(--accent-light)" onclick="removePrimeMeal('${m.id}')">🗑️ ${t('common.delete')}</button>
          ` : `
          <button class="btn-sm" style="flex:1;font-size:11px;padding:5px 6px" onclick="editPrimeMeal('${m.id}')">${t('programmas.view')}</button>
          `}
        </div>
      </div>`;
    }).join('') + `</div>`;
}

// Verwijdert een PRIME-gerecht -- coach-only (de knop ernaartoe is al
// afgeschermd, dit is defense-in-depth; de echte grens is de Supabase
// RLS-policy op prime_meals).
async function removePrimeMeal(id) {
  if (!isPrimeCoach()) return;
  if (!confirm(t('food.addMeal.confirmDelete'))) return;
  if (_amEditingId === id && _amEditingIsPrime) resetMealForm();
  primeMeals = primeMeals.filter(m => m.id !== id);
  try { localStorage.setItem('prime_prime_meals', JSON.stringify(primeMeals)); } catch(e) { console.error(e); }
  const fout = await deletePrimeMealFromCloud(id);
  if (fout) {
    // Lokaal is het gerecht al weg (hierboven), maar zonder deze melding
    // zou je niet weten dat het bij andere deelnemers -- die het uit de
    // cloud lezen -- nog gewoon zichtbaar is.
    console.error('removePrimeMeal:', fout);
    try { showToast(t('food.primeMeals.deleteFailed'), true); } catch (e) { console.error(e); }
  }
  // Verwijder eventueel al gelogde porties van dit gerecht, op elke datum.
  Object.keys(foodDays).forEach(dateStr => {
    const filtered = foodDays[dateStr].filter(i => i.dishId !== id);
    if (filtered.length) foodDays[dateStr] = filtered; else delete foodDays[dateStr];
  });
  syncSet('prime_food_days', foodDays);
  dayLog = dayLog.filter(i => i.dishId !== id);
  renderPrimeMealPlan();
  updateMacroTotals();
  updateLogBadge();
  renderDayLog();
}

// ─── Opslaan als PRIME-gerecht ─────────────────────────────────────────────
// Kloont de HUIDIGE formulierwaarden (dus ook nog niet opgeslagen
// wijzigingen) van een eigen gerecht naar een nieuw, gedeeld PRIME-gerecht.
// De naam krijgt altijd de vaste prefix 'PRIME-' -- net als bij Training.
function openPrimeMealSaveModal() {
  if (!isPrimeCoach() || !_amEditingId || _amEditingIsPrime) return;
  const name = document.getElementById('am-name').value.trim();
  if (!name) { showMealFormError(t('food.addMeal.nameRequired')); return; }
  const rows = document.querySelectorAll('#am-ingredients-body tr');
  let hasIngredient = false;
  rows.forEach(row => { if (row.querySelector('.am-ing-name')?.value.trim()) hasIngredient = true; });
  if (!hasIngredient) { showMealFormError(t('food.addMeal.ingredientRequired')); return; }
  showMealFormError('');

  document.getElementById('prime-save-meal-suffix').value = '';
  document.getElementById('prime-save-meal-error').textContent = '';
  document.getElementById('prime-save-meal-modal').classList.add('open');
  document.getElementById('prime-save-meal-suffix').focus();
}

function closePrimeMealSaveModal() {
  document.getElementById('prime-save-meal-modal').classList.remove('open');
}

async function confirmPrimeMealSave() {
  if (!isPrimeCoach() || !_amEditingId || _amEditingIsPrime) return;
  const suffix = document.getElementById('prime-save-meal-suffix').value.trim();
  if (!suffix) {
    document.getElementById('prime-save-meal-error').textContent = t('food.primeMeals.nameRequired');
    return;
  }

  const name = document.getElementById('am-name').value.trim();
  const ingredients = [];
  document.querySelectorAll('#am-ingredients-body tr').forEach(row => {
    const ingName = row.querySelector('.am-ing-name')?.value.trim();
    if (!ingName) return;
    ingredients.push({
      name: ingName,
      gram: parseFloat(row.querySelector('.am-ing-gram')?.value) || 0,
      prot: parseFloat(row.querySelector('.am-ing-prot')?.value) || 0,
      carb: parseFloat(row.querySelector('.am-ing-carb')?.value) || 0,
      fat:  parseFloat(row.querySelector('.am-ing-fat')?.value)  || 0
    });
  });

  const nieuw = {
    id: 'prime-meal-' + Date.now() + Math.floor(Math.random() * 1000),
    name: 'PRIME-' + suffix,
    photo: _amPhotoData || null,
    ingredients: ingredients
  };
  primeMeals.push(nieuw);
  try { localStorage.setItem('prime_prime_meals', JSON.stringify(primeMeals)); } catch(e) { console.error(e); }
  // Wachten tot de upsert echt is aangekomen VOORDAT switchFoodTab()
  // hieronder primeMealsRefreshFromCloud() triggert -- anders kan die
  // ververs-aanroep de server nog vóór deze upsert bereiken, dan het
  // (nog oude) lijstje zonder dit gerecht terugkrijgen, en daarmee het
  // net-toegevoegde gerecht weer van het scherm laten verdwijnen totdat
  // je de tab een keer opnieuw opent. Zelfde race als eerder dit seizoen
  // bij prime_planning (zie wpApplyPlanningChanges in weekplanning.js).
  const fout = await savePrimeMealToCloud(nieuw);

  closePrimeMealSaveModal();
  // Alleen "opgeslagen" tonen als dat ook echt zo is -- anders (bv. geen
  // internet) dacht je dat het gerecht al voor alle deelnemers klaarstond,
  // terwijl het alleen op dit toestel stond.
  try { showToast(fout ? t('food.primeMeals.saveFailed') : t('food.primeMeals.saved'), !!fout); } catch(e) { console.error(e); }

  renderPrimeMealPlan();
  resetMealForm();
  switchFoodTab('primemeals');
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
let _amEditingIsPrime = false; // true zolang het formulier een PRIME-gerecht bewerkt i.p.v. een eigen gerecht
let _amFormReadOnly = false;   // true zolang een niet-coach een PRIME-gerecht alleen bekijkt (geen wijzigingen mogelijk)
let _amReturnTab = null;       // welke foodtab "Terug"/"Annuleren" moet openen (null = op + Gerecht toevoegen blijven, zoals bij een eigen gerecht)

// prefill (optioneel): { name, gram, prot, carb, fat, per100:{prot,carb,fat} }.
// Als per100 is meegegeven, staat de rij "gekoppeld" aan een basisproduct: het
// gram-veld herberekent dan automatisch eiwit/koolh/vet bij elke wijziging.
function addIngredientRow(prefill) {
  const tbody = document.getElementById('am-ingredients-body');
  if (!tbody) return;
  const rowId = 'amrow-' + (_amRowCounter++);
  const tr = document.createElement('tr');
  tr.id = rowId;
  const p = prefill || {};
  const dis = _amFormReadOnly ? ' disabled' : '';
  const gramInputAttrs = (p.per100 ? ' oninput="updateLinkedIngredientRow(\'' + rowId + '\');updateMealFormTotals()"' : ' oninput="updateMealFormTotals()"') + dis;
  if (p.per100) tr.dataset.per100 = JSON.stringify(p.per100);
  tr.innerHTML =
    '<td style="padding:4px 6px 4px 0"><input type="text" class="am-ing-name" placeholder="' + t('food.addMeal.ingredientNamePlaceholder') + '" value="' + (p.name ? String(p.name).replace(/"/g,'&quot;') : '') + '"' + dis + ' style="width:100%;padding:6px 8px;border:1px solid var(--sand-dark);border-radius:6px;font-size:12px;font-family:\'DM Sans\',sans-serif;background:var(--sand);box-sizing:border-box"></td>' +
    '<td style="padding:4px 3px"><input type="number" class="am-ing-gram" min="0" step="1" value="' + (p.gram ?? 0) + '"' + gramInputAttrs + ' style="width:56px;padding:6px 4px;border:1px solid var(--sand-dark);border-radius:6px;font-size:12px;text-align:center;font-family:\'DM Sans\',sans-serif;background:var(--sand)"></td>' +
    '<td style="padding:4px 3px"><input type="number" class="am-ing-prot" min="0" step="0.1" value="' + (p.prot ?? 0) + '" oninput="updateMealFormTotals()"' + dis + ' style="width:56px;padding:6px 4px;border:1px solid var(--sand-dark);border-radius:6px;font-size:12px;text-align:center;font-family:\'DM Sans\',sans-serif;background:var(--sand)"></td>' +
    '<td style="padding:4px 3px"><input type="number" class="am-ing-carb" min="0" step="0.1" value="' + (p.carb ?? 0) + '" oninput="updateMealFormTotals()"' + dis + ' style="width:56px;padding:6px 4px;border:1px solid var(--sand-dark);border-radius:6px;font-size:12px;text-align:center;font-family:\'DM Sans\',sans-serif;background:var(--sand)"></td>' +
    '<td style="padding:4px 3px"><input type="number" class="am-ing-fat" min="0" step="0.1" value="' + (p.fat ?? 0) + '" oninput="updateMealFormTotals()"' + dis + ' style="width:56px;padding:6px 4px;border:1px solid var(--sand-dark);border-radius:6px;font-size:12px;text-align:center;font-family:\'DM Sans\',sans-serif;background:var(--sand)"></td>' +
    '<td style="padding:4px 3px;text-align:center;font-size:12px;color:var(--muted)" class="am-ing-kcal">0</td>' +
    '<td style="padding:4px 0 4px 4px;text-align:center"><button onclick="removeIngredientRow(\'' + rowId + '\')" title="' + t('common.delete') + '" style="padding:5px 8px;border-radius:6px;border:none;background:none;color:var(--accent);cursor:pointer;font-size:14px' + (_amFormReadOnly ? ';display:none' : '') + '">🗑️</button></td>';
  if (p.per100) tr.style.borderLeft = '3px solid var(--sage)';
  tbody.appendChild(tr);
  updateMealFormTotals();
}

// Herberekent eiwit/koolh/vet van een aan een basisproduct gekoppelde rij,
// op basis van het huidige gram-veld en de opgeslagen waarden per 100g.
function updateLinkedIngredientRow(rowId) {
  const row = document.getElementById(rowId);
  if (!row || !row.dataset.per100) return;
  const per100 = JSON.parse(row.dataset.per100);
  const gram = parseFloat(row.querySelector('.am-ing-gram')?.value) || 0;
  const factor = gram / 100;
  const round1 = n => Math.round(n * 10) / 10;
  row.querySelector('.am-ing-prot').value = round1(per100.prot * factor);
  row.querySelector('.am-ing-carb').value = round1(per100.carb * factor);
  row.querySelector('.am-ing-fat').value  = round1(per100.fat  * factor);
}

// ========== BASISPRODUCT KIEZEN ALS INGREDIËNT (bij Gerecht toevoegen) ==========
function openIngredientProductPicker() {
  if (_amFormReadOnly) return; // defense-in-depth: knop is toch al verborgen
  const search = document.getElementById('ipm-search');
  if (search) search.value = '';
  renderIngredientProductList();
  document.getElementById('ingredient-product-modal').classList.add('open');
}

function closeIngredientProductPicker() {
  document.getElementById('ingredient-product-modal').classList.remove('open');
}

function renderIngredientProductList() {
  const q = (document.getElementById('ipm-search')?.value || '').trim().toLowerCase();
  const list = getAllProducts()
    .filter(p => !q || dispName(p).toLowerCase().includes(q))
    .sort((a, b) => dispName(a).localeCompare(dispName(b), 'nl'));
  const el = document.getElementById('ipm-list');
  if (!list.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">' + t('food.search.noResults') + '</div>';
    return;
  }
  el.innerHTML = list.map(p => `
    <div onclick="pickIngredientProduct('${p.id}')" style="display:flex;align-items:center;gap:10px;padding:9px 6px;border-bottom:1px solid var(--sand-dark);cursor:pointer">
      ${p.photo ? `<div style="width:38px;height:38px;border-radius:8px;flex-shrink:0;overflow:hidden"><img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;display:block"></div>` : `<div style="width:38px;height:38px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--sand)">${p.icon || '🍽️'}</div>`}
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--charcoal)">${dispName(p)}</div>
        <div style="font-size:11px;color:var(--muted)">${t('food.addMeal.per100Macros',{kcal:p.kcal,prot:p.prot,carb:p.carb,fat:p.fat})}</div>
      </div>
    </div>`).join('');
}

function pickIngredientProduct(productId) {
  const product = getAllProducts().find(p => p.id === productId);
  if (!product) return;
  addIngredientRow({
    name: dispName(product),
    gram: 100,
    prot: product.prot,
    carb: product.carb,
    fat: product.fat,
    per100: { prot: product.prot, carb: product.carb, fat: product.fat }
  });
  closeIngredientProductPicker();
}

function removeIngredientRow(rowId) {
  if (_amFormReadOnly) return; // defense-in-depth: knop is toch al verborgen
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
  if (_amFormReadOnly) return; // defense-in-depth: upload-knop is toch al verborgen
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > MAX_PHOTO_BYTES) {
    document.getElementById('am-error').textContent = t('food.add.photoTooBig', { kb: Math.round(file.size / 1024), max: MAX_PHOTO_BYTES / 1024 });
    return;
  }
  document.getElementById('am-error').textContent = '';
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = e.target.result;
    _amPhotoData = preview;
    document.getElementById('am-photo-preview').innerHTML = '<img src="' + preview + '" style="width:100%;height:100%;object-fit:cover">';
    uploadPhotoToStorage(file).then(function(url) { if (url && _amPhotoData === preview) _amPhotoData = url; });
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
  // Defense-in-depth: de knop/route hiernaartoe is al coach-only afgeschermd,
  // maar de daadwerkelijke grens ligt in de Supabase RLS-policy op prime_meals.
  if (_amEditingIsPrime && !isPrimeCoach()) return;

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

  const wasEditingPrime = _amEditingIsPrime;
  if (wasEditingPrime) {
    const dish = primeMeals.find(m => m.id === _amEditingId);
    if (dish) {
      dish.name = name;
      dish.photo = _amPhotoData || null;
      dish.ingredients = ingredients;
      try { localStorage.setItem('prime_prime_meals', JSON.stringify(primeMeals)); } catch(e) { console.error(e); }
      savePrimeMealToCloud(dish);
    }
  } else if (_amEditingId) {
    const dish = customMeals.find(m => m.id === _amEditingId);
    if (dish) {
      dish.name = name;
      dish.photo = _amPhotoData || null;
      dish.ingredients = ingredients;
    }
    syncSet('prime_custom_meals', customMeals);
  } else {
    const nieuw = {
      id: 'custom-meal-' + Date.now() + Math.floor(Math.random() * 1000),
      name: name,
      photo: _amPhotoData || null,
      ingredients: ingredients,
      custom: true
    };
    customMeals.push(nieuw);
    syncSet('prime_custom_meals', customMeals);
    // In de editor van het zojuist aangemaakte gerecht blijven staan
    // (i.p.v. resetMealForm() terug naar een leeg formulier) -- zelfde
    // patroon als een nieuw trainingsprogramma (progOpslaanNieuw in
    // programmas.js): zo staat de "Ook als PRIME-gerecht opslaan"-knop
    // (_amEditingId moet gezet zijn, zie updateMealFormPrimeButtonVisibility)
    // meteen klaar, zonder dat de coach het gerecht weer moet opzoeken.
    _populateMealForm(nieuw, false);
    renderOwnMealsList();
    renderMealPlan();
    return;
  }

  // resetMealForm() navigeert zelf terug naar de PRIME-tab (en ververst
  // die daarbij) als dit een PRIME-gerecht was -- zie _amReturnTab.
  resetMealForm();
  renderOwnMealsList();
  renderMealPlan();
}

// Gedeeld tussen editCustomMeal (eigen gerecht, altijd bewerkbaar) en
// editPrimeMeal (PRIME-gerecht -- bewerkbaar voor de coach, alleen-lezen
// voor iedereen anders, zodat klanten wél kunnen zien wat er in een
// PRIME-gerecht zit, net als bij PRIME-programma's) -- vult het
// "+ Gerecht toevoegen"-formulier met de gegevens van het gerecht.
function _populateMealForm(dish, isPrime) {
  _amEditingId = dish.id;
  _amEditingIsPrime = !!isPrime;
  _amFormReadOnly = _amEditingIsPrime && !isPrimeCoach();

  // Kun je deze knoppen hier ZIEN en ze zijn ook actief bewerkbaar, terwijl
  // het om een PRIME-gerecht gaat -- dan kan dat alleen de coach zijn
  // (_amFormReadOnly verbergt alles al voor iedereen anders). Oranje
  // coach-only-styling dus alleen in dat geval, niet bij een eigen gerecht.
  const coachOnly = _amEditingIsPrime && !_amFormReadOnly;
  document.getElementById('am-submit-btn').classList.toggle('coach-only-btn', coachOnly);
  document.querySelectorAll('#am-ingredient-actions button').forEach(btn => btn.classList.toggle('coach-only-btn', coachOnly));
  const uploadSpan = document.querySelector('#am-photo-upload-label span');
  if (uploadSpan) uploadSpan.classList.toggle('coach-only-btn', coachOnly);

  const nameInput = document.getElementById('am-name');
  nameInput.value = dish.name;
  nameInput.disabled = _amFormReadOnly;
  _amPhotoData = dish.photo || null;
  document.getElementById('am-photo-preview').innerHTML = dish.photo
    ? '<img src="' + dish.photo + '" style="width:100%;height:100%;object-fit:cover">'
    : '🍽️';
  document.getElementById('am-photo-upload-label').style.display = _amFormReadOnly ? 'none' : '';

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

  document.getElementById('am-ingredient-actions').style.display = _amFormReadOnly ? 'none' : '';
  document.getElementById('am-own-meals-section').style.display = isPrime ? 'none' : ''; // niet relevant terwijl een PRIME-gerecht open staat
  document.getElementById('am-form-title').textContent = isPrime
    ? (_amFormReadOnly ? t('food.primeMeals.viewTitle') : t('food.primeMeals.editTitle'))
    : t('food.addMeal.editTitle');
  document.getElementById('am-submit-btn').style.display = _amFormReadOnly ? 'none' : '';
  document.getElementById('am-submit-btn').textContent = t('food.addMeal.update');
  document.getElementById('am-cancel-btn').textContent = t(_amFormReadOnly ? 'common.back' : 'food.addMeal.cancel');
  document.getElementById('am-cancel-btn').style.display = 'inline-block';
  showMealFormError('');
  updateMealFormPrimeButtonVisibility();
}

function editCustomMeal(id) {
  const dish = customMeals.find(m => m.id === id);
  if (!dish) return;
  _amReturnTab = null; // "Annuleren" blijft gewoon op + Gerecht toevoegen, zoals bij een eigen gerecht
  _populateMealForm(dish, false);
  document.getElementById('am-name').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Opent een PRIME-gerecht in het formulier -- voor de coach bewerkbaar,
// voor iedereen anders alleen-lezen (_populateMealForm bepaalt dat zelf
// via isPrimeCoach()), zodat klanten kunnen zien wat er in het gerecht
// zit zonder iets te kunnen wijzigen. Bereikbaar via "Bewerken" (coach)
// of "Bekijken" (klant) op de kaart in renderPrimeMealPlan(). Kwam je
// hiervandaan (PRIME gerechten-tab), dan brengt "Terug"/"Annuleren"
// (resetMealForm) je ook weer terug naar die tab i.p.v. op
// "+ Gerecht toevoegen" te blijven staan.
function editPrimeMeal(id) {
  const dish = primeMeals.find(m => m.id === id);
  if (!dish) return;
  _amReturnTab = 'primemeals';
  _populateMealForm(dish, true);
  switchFoodTab('addmeal');
  document.getElementById('am-name').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Reset het formulier naar "nieuw gerecht"-stand — zowel na een geslaagde
// toevoeging/wijziging als bij het annuleren van een bewerking of het
// sluiten van een alleen-lezen weergave. Navigeert daarbij terug naar
// _amReturnTab als die gezet is (bv. de PRIME gerechten-tab).
function resetMealForm() {
  _amEditingId = null;
  _amEditingIsPrime = false;
  _amFormReadOnly = false;
  _amPhotoData = null;
  const nameInput = document.getElementById('am-name');
  nameInput.value = '';
  nameInput.style.borderColor = '';
  nameInput.disabled = false;
  document.getElementById('am-photo-preview').innerHTML = '🍽️';
  document.getElementById('am-photo-upload-label').style.display = '';
  document.getElementById('am-ingredient-actions').style.display = '';
  // Coach-only-styling (zie _populateMealForm) hoort alleen bij het
  // bewerken van een PRIME-gerecht -- terug naar een gewoon "nieuw
  // gerecht"-formulier is nooit coach-exclusief.
  document.getElementById('am-submit-btn').classList.remove('coach-only-btn');
  document.querySelectorAll('#am-ingredient-actions button').forEach(btn => btn.classList.remove('coach-only-btn'));
  const _amUploadSpan = document.querySelector('#am-photo-upload-label span');
  if (_amUploadSpan) _amUploadSpan.classList.remove('coach-only-btn');
  document.getElementById('am-own-meals-section').style.display = '';
  document.getElementById('am-ingredients-body').innerHTML = '';
  addIngredientRow();
  document.getElementById('am-form-title').textContent = t('food.addMeal.formTitle');
  document.getElementById('am-submit-btn').style.display = '';
  document.getElementById('am-submit-btn').textContent = t('food.addMeal.submit');
  document.getElementById('am-cancel-btn').textContent = t('food.addMeal.cancel');
  document.getElementById('am-cancel-btn').style.display = 'none';
  showMealFormError('');
  updateMealFormPrimeButtonVisibility();

  if (_amReturnTab) {
    const target = _amReturnTab;
    _amReturnTab = null;
    switchFoodTab(target);
  }
}

// Toont "⭐ Opslaan als PRIME-gerecht" alleen aan de coach, en alleen
// terwijl een bestaand EIGEN gerecht bewerkt wordt (niet bij een nieuw,
// nog niet opgeslagen gerecht en niet terwijl al een PRIME-gerecht
// bewerkt wordt) -- zelfde voorwaarde als bij Programma's.
function updateMealFormPrimeButtonVisibility() {
  const side = document.getElementById('am-prime-side');
  if (!side) return;
  side.style.display = (_amEditingId && !_amEditingIsPrime && isPrimeCoach()) ? 'block' : 'none';
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
        ? `<div style="width:64px;min-height:60px;flex-shrink:0;overflow:hidden"><img src="${dish.photo}" style="width:100%;height:100%;object-fit:cover;display:block"></div>`
        : `<div style="width:64px;min-height:60px;display:flex;align-items:center;justify-content:center;font-size:22px;background:var(--sand);flex-shrink:0">🍽️</div>`}
      <div style="flex:1;padding:10px 14px;display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px;margin-bottom:2px">${dispName(dish)}</div>
          <div style="font-size:11px;color:var(--muted)">${t('food.addMeal.totalWeightLine', { gram: tot.gram })} · ${tot.kcal} kcal</div>
        </div>
        <button onclick="editCustomMeal('${dish.id}')" style="font-size:12px;padding:6px 10px;border-radius:8px;border:1px solid var(--sand-dark);background:var(--sand);color:var(--charcoal);cursor:pointer;flex-shrink:0">${t('common.edit')}</button>
        <button onclick="removeCustomMeal('${dish.id}')" style="font-size:12px;padding:6px 10px;border-radius:8px;border:1px solid #e8c4a8;background:var(--accent-light);color:var(--accent);cursor:pointer;flex-shrink:0">🗑️ ${t('common.delete')}</button>
      </div>
    </div>`;
  }).join('');
}

function renderAddMealTab() {
  const tbody = document.getElementById('am-ingredients-body');
  if (tbody && tbody.children.length === 0 && !_amEditingId) addIngredientRow();
  renderOwnMealsList();
  updateMealFormPrimeButtonVisibility();
}

// ─── Portie (in gram) + maaltijdmoment kiezen bij loggen ──────────────────
// Zelfde opzet als de portiemodal voor producten: moment kiezen via
// knoppen, hoeveelheid in gram i.p.v. percentage.
let _mpDish = null;
let _mpMoment = 'ontbijt';

function openMealPortionModal(dishId) {
  _mpDish = findAnyMeal(dishId);
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
  // Standaard de dag die nu open staat (meestal vandaag), zichtbaar als
  // leesbaar label (updateMpmDateLabel()) naast "Andere dag" -- die
  // knop opent de kalender (openMpmDatePicker()) om een andere dag te
  // kiezen. "Inplannen" voegt altijd toe met de dag die op dat moment
  // getoond wordt, of je de kalender nu gebruikt hebt of niet
  // (addMealToLog()).
  document.getElementById('mpm-date').value = currentLogDate;
  updateMpmDateLabel();
  updateMealPortionPreview();
  document.getElementById('meal-portion-modal').classList.add('open');
}

// Zelfde als updatePmDateLabel(), maar voor de gerecht-portiemodal.
function updateMpmDateLabel() {
  const el = document.getElementById('mpm-date-label');
  if (el) el.textContent = formatPickerDateLabel(document.getElementById('mpm-date').value);
}

// Zelfde als openPmDatePicker(), maar voor de gerecht-portiemodal.
function openMpmDatePicker() {
  const input = document.getElementById('mpm-date');
  if (currentLogDate) input.value = currentLogDate;
  if (input.showPicker) {
    try { input.showPicker(); return; } catch (e) { /* val door naar de fallback hieronder */ }
  }
  input.focus();
  input.click();
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
  // Annuleren (dit is de ×, niet de submit) mag _portionReturnTab niet
  // laten "hangen": zonder deze reset zou een latere, hélemaal
  // ongerelateerde add/edit-actie je alsnog naar dit oude tabblad
  // terugsturen.
  _portionReturnTab = null;
}

function addMealToLog() {
  if (!_mpDish) return;
  const tot = mealTotals(_mpDish);
  const gram = parseFloat(document.getElementById('mpm-gram').value) || 0;
  if (gram <= 0) return;
  // Welke dag: standaard de dag die nu open staat (meestal vandaag), maar
  // vrij te kiezen in het "Dag"-veld -- zo kun je meteen hier al voor een
  // andere dag loggen i.p.v. eerst via Weekplanning te moeten wisselen.
  const targetDate = document.getElementById('mpm-date').value || currentLogDate;
  if (isDagAfgesloten(targetDate)) { alert(t('weekplan.dayLocked')); return; }
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
    type: 'meal',
    eaten: false
  };

  if (_editingLogId !== null) {
    // editLogItem() heeft currentLogDate al op de oorspronkelijke datum
    // van dit item gezet. Haal het daar weg en zet het terug op de
    // (eventueel gewijzigde) gekozen dag -- zo verplaatst een andere
    // keuze in "Dag" het item meteen mee naar die andere dag.
    const bestaand = dayLog.find(i => i.logId === _editingLogId);
    const logId = bestaand ? bestaand.logId : newLogId();
    dayLog = dayLog.filter(i => i.logId !== _editingLogId);
    foodDays[currentLogDate] = dayLog;
    const nieuwItem = { logId, ...values, eaten: bestaand ? bestaand.eaten : false };
    if (targetDate === currentLogDate) {
      dayLog.push(nieuwItem);
      foodDays[currentLogDate] = dayLog;
    } else {
      foodDays[targetDate] = [...(foodDays[targetDate] || []), nieuwItem];
    }
    _editingLogId = null;
  } else if (targetDate === currentLogDate) {
    dayLog.push({ logId: newLogId(), ...values });
    foodDays[currentLogDate] = dayLog;
  } else {
    foodDays[targetDate] = [...(foodDays[targetDate] || []), { logId: newLogId(), ...values }];
  }

  // Vóór closeMealPortionModal() vastleggen: die zet _portionReturnTab
  // zelf ook op null (nodig voor de ×/annuleren-knop, zie daar), dus na
  // de aanroep zou deze check hieronder altijd false zijn.
  const _returnTab = _portionReturnTab;

  syncSet('prime_food_days', foodDays);
  closeMealPortionModal();
  updateMacroTotals();
  updateLogBadge();
  renderDayLog();
  if (document.getElementById('foodweek-content')) renderFoodWeek();

  // Kwam je hier via "+ Gerecht" op Vandaag/Weekplanning (zie
  // foodAddForDay/fwAddForDay)? Dan weer terugspringen naar dat
  // tabblad i.p.v. op Gerechten te blijven hangen.
  if (_returnTab) switchFoodTab(_returnTab);
}

// ========== PORTION MODAL ==========
// _editingLogId: logId van het item dat bewerkt wordt (via editLogItem()),
// of null als het gaat om een nieuw item toevoegen. Wordt hier bij het
// openen bewust gereset — editLogItem() zet 'm pas ná deze aanroep weer,
// zodat een blijven-hangen edit-status van een eerdere, niet-afgemaakte
// bewerking nooit een gewone "nieuw item toevoegen"-actie kan besmetten.
let _editingLogId = null;

function openPortionModal(productId, tijdelijk) {
  currentPortionProduct = tijdelijk || getAllProducts().find(p => p.id === productId);
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
  // Standaard de dag die nu open staat (meestal vandaag), zichtbaar als
  // leesbaar label (updatePmDateLabel()) naast "Andere dag" -- die knop
  // opent de kalender (openPmDatePicker()) om een andere dag te kiezen.
  // "Inplannen" voegt altijd toe met de dag die op dat moment getoond
  // wordt, of je de kalender nu gebruikt hebt of niet (addProductToLog()).
  document.getElementById('pm-date').value = currentLogDate;
  updatePmDateLabel();
  updatePortionPreview();
  const _rescanBtn = document.getElementById('pm-rescan-btn');
  if (_rescanBtn) _rescanBtn.style.display = (_pmViaScan && isPrimeCoach()) ? 'inline-block' : 'none';
  _pmViaScan = false;
  const _editBtn = document.getElementById('pm-edit-btn');
  if (_editBtn) _editBtn.style.display = (isPrimeCoach() && !p._tijdelijk) ? 'inline-block' : 'none';
  document.getElementById('portion-modal').classList.add('open');
}

// Toont het (onzichtbare) #pm-date-veld leesbaar naast de "Inplannen"-
// knop (zie formatPickerDateLabel() in i18n.js). Gekoppeld aan zowel
// het openen van de modal (met de standaarddag) als het onchange-event
// van #pm-date (na een keuze in de kalender).
function updatePmDateLabel() {
  const el = document.getElementById('pm-date-label');
  if (el) el.textContent = formatPickerDateLabel(document.getElementById('pm-date').value);
}

// Vraagt de browser expliciet om de datumkiezer te tonen (i.p.v. te
// vertrouwen op een klik die toevallig het onzichtbare date-input raakt --
// dat bleek in de praktijk niet altijd betrouwbaar). showPicker() moet
// vanuit een echte gebruikersactie aangeroepen worden, dus alleen via deze
// knop-klik, niet automatisch bij het openen van de modal zelf.
//
// "Inplannen" voegt zelf toe (addProductToLog(), rechtstreeks aan de
// knop gekoppeld) met wat er op dat moment in #pm-date staat -- deze
// kalender is puur om die dag desgewenst te WIJZIGEN. Eerdere versies
// probeerden toevoegen te koppelen aan het change-event van de
// kalender zelf, maar <input type="date"> laat dat event alleen afgaan
// bij een ECHTE wijziging: sloot je de kalender simpelweg omdat de
// getoonde standaarddag (meestal vandaag) al klopte -- wat de meeste
// mensen doen -- dan gebeurde er dus niets. Door "Inplannen" los van
// de kalender te maken werkt toevoegen nu altijd, ongeacht of je de
// kalender open klikt.
function openPmDatePicker() {
  const input = document.getElementById('pm-date');
  if (currentLogDate) input.value = currentLogDate;
  if (input.showPicker) {
    try { input.showPicker(); return; } catch (e) { /* val door naar de fallback hieronder */ }
  }
  input.focus();
  input.click();
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
  // Annuleren (dit is de ×, niet de submit) mag _portionReturnTab niet
  // laten "hangen": zonder deze reset zou een latere, hélemaal
  // ongerelateerde add/edit-actie je alsnog naar dit oude tabblad
  // terugsturen.
  _portionReturnTab = null;
}

// Zet de actieve maaltijdmoment-knop in één van de twee portiemodals
// programmatisch (i.p.v. via een klik), voor editLogItem(). Zelfde
// volgorde als de knoppen in de HTML: elk tussendoortje direct na de
// bijbehorende maaltijd (ontbijt, ochtendtussendoortje, lunch, ...).
// Een oud logitem met het legacy moment 'snack' matcht hier bewust
// niets (geen enkele knop heet meer zo) — blijft gewoon bij geen
// enkele knop actief, verder onschadelijk.
function setActiveMomentBtn(modalSelector, moment) {
  const order = ['ontbijt','tussendoorOchtend','lunch','tussendoorMiddag','avond','tussendoorAvond'];
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
  // Welke dag: standaard de dag die nu open staat (meestal vandaag), maar
  // vrij te kiezen in het "Dag"-veld -- zo kun je meteen hier al voor een
  // andere dag loggen i.p.v. eerst via Weekplanning te moeten wisselen.
  const targetDate = document.getElementById('pm-date').value || currentLogDate;
  if (isDagAfgesloten(targetDate)) { alert(t('weekplan.dayLocked')); return; }
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
    type: 'product',
    eaten: false
  };

  if (_editingLogId !== null) {
    // editLogItem() heeft currentLogDate al op de oorspronkelijke datum
    // van dit item gezet. Haal het daar weg en zet het terug op de
    // (eventueel gewijzigde) gekozen dag -- zo verplaatst een andere
    // keuze in "Dag" het item meteen mee naar die andere dag.
    const bestaand = dayLog.find(i => i.logId === _editingLogId);
    const logId = bestaand ? bestaand.logId : newLogId();
    dayLog = dayLog.filter(i => i.logId !== _editingLogId);
    foodDays[currentLogDate] = dayLog;
    const nieuwItem = { logId, ...values, eaten: bestaand ? bestaand.eaten : false };
    if (targetDate === currentLogDate) {
      dayLog.push(nieuwItem);
      foodDays[currentLogDate] = dayLog;
    } else {
      foodDays[targetDate] = [...(foodDays[targetDate] || []), nieuwItem];
    }
    _editingLogId = null;
  } else if (targetDate === currentLogDate) {
    dayLog.push({ logId: newLogId(), ...values });
    foodDays[currentLogDate] = dayLog;
  } else {
    foodDays[targetDate] = [...(foodDays[targetDate] || []), { logId: newLogId(), ...values }];
  }

  // Vóór closePortionModal() vastleggen: die zet _portionReturnTab zelf
  // ook op null (nodig voor de ×/annuleren-knop, zie daar), dus na de
  // aanroep zou deze check hieronder altijd false zijn.
  const _returnTab = _portionReturnTab;

  syncSet('prime_food_days', foodDays);
  closePortionModal();
  updateMacroTotals();
  updateLogBadge();
  renderDayLog();
  if (document.getElementById('foodweek-content')) renderFoodWeek();

  // Kwam je hier via "+ Product" op Vandaag/Weekplanning (zie
  // foodAddForDay/fwAddForDay)? Dan weer terugspringen naar dat
  // tabblad i.p.v. op Basisproducten te blijven hangen.
  if (_returnTab) switchFoodTab(_returnTab);
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
    if (!currentPortionProduct && item.gram > 0) {
      // Niet bewaard (bv. gescand zonder "Bewaren als eigen product") of verwijderd: de
      // waardes per 100 g herleiden uit het gelogde item zelf.
      const per100 = 100 / item.gram;
      openPortionModal(item.productId, {
        id: item.productId, name: item.name, icon: item.icon || '🍽️', cat: 'overig', _tijdelijk: true,
        kcal: Math.round(item.kcal * per100), prot: Math.round(item.prot * per100 * 10) / 10,
        carb: Math.round(item.carb * per100 * 10) / 10, fat: Math.round(item.fat * per100 * 10) / 10
      });
    }
    if (!currentPortionProduct) { alert(t('food.edit.noLongerAvailable')); return; }
    _editingLogId = logId;
    const _editBtn2 = document.getElementById('pm-edit-btn');
    if (_editBtn2) _editBtn2.style.display = 'none';
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
  if (isDagAfgesloten(dateStr)) return; // voorbije/afgesloten dag ligt vast
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
    const d = findAnyMeal(item.dishId);
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
    const d = findAnyMeal(item.dishId);
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
  const isEaten = isEatenItem(item);
  // Een dag die al is afgesloten (check-out gedaan) of al voorbij is ligt
  // vast -- gram/verwijderen kan dan niet meer aangepast worden. De
  // vinkjes/knoppen blijven wel zichtbaar (ze tonen nog steeds wat er die
  // dag is gebeurd), alleen niet meer klikbaar.
  const afgesloten = isDagAfgesloten(dateStr);
  // "Gegeten" aanvinken mag ALLEEN voor vandaag -- een item op een
  // toekomstige (nog te plannen) dag kan per definitie nog niet gegeten
  // zijn, ook al mag je zo'n dag verder nog gewoon bewerken. Zie
  // magAfvinken() (data.js).
  const kanAfvinken = magAfvinken(dateStr);
  const cardClick = afgesloten ? '' : ` onclick="editLogItem('${dateStr}', ${item.logId})"`;
  const eatenClick = kanAfvinken ? `onclick="event.stopPropagation();toggleFoodEaten('${dateStr}', ${item.logId})" ` : '';
  const delClick = afgesloten ? '' : `onclick="event.stopPropagation(); fwRemoveItem('${dateStr}', ${item.logId})" `;
  return `
    <div class="card" id="food-item-${item.logId}" style="margin-bottom:10px;padding:0;overflow:hidden;display:flex;align-items:stretch;cursor:${afgesloten ? 'default' : 'pointer'};opacity:${isEaten ? '1' : '0.75'}"${cardClick}>
      ${photo
        ? `<div style="width:80px;min-height:75px;flex-shrink:0;border-radius:var(--radius-sm) 0 0 var(--radius-sm);overflow:hidden"><img src="${photo}" style="width:100%;height:100%;object-fit:cover;display:block"></div>`
        : `<div style="width:80px;min-height:75px;display:flex;align-items:center;justify-content:center;font-size:26px;background:var(--sand);flex-shrink:0">${item.icon}</div>`}
      <div style="flex:1;min-width:0;padding:10px 14px;display:flex;align-items:center;flex-wrap:wrap;row-gap:6px;gap:10px">
        <div style="flex:1;min-width:120px">
          <div style="font-weight:600;font-size:13px;margin-bottom:2px">${logItemDisplayName(item)} <span id="food-tag-${item.logId}" style="font-size:10px;font-weight:500;padding:2px 7px;border-radius:10px;vertical-align:middle;${isEaten ? 'background:var(--sage-light);color:var(--sage)' : 'background:var(--sand);color:var(--muted)'}">${isEaten ? t('food.eatenTag') : t('food.plannedTag')}</span></div>
          <div style="font-size:11px;color:var(--muted)">
            ${item.type === 'meal' ? t('food.log.mealTag') + ' · ' : ''}${item.gram}g · ${item.kcal} kcal
          </div>
          <div style="font-size:11px;color:var(--muted)">${t('food.macroFull.protein')}: ${Math.round(item.prot)}g · ${t('food.macroFull.carbs')}: ${Math.round(item.carb)}g · ${t('food.macroFull.fat')}: ${Math.round(item.fat)}g</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;row-gap:4px;flex-shrink:0;opacity:${afgesloten ? '0.5' : '1'}">
          <div class="ex-check-wrap" ${eatenClick}style="cursor:${kanAfvinken ? 'pointer' : 'default'}">
            <div id="food-chk-${item.logId}" class="exercise-check${isEaten ? ' done' : ''}" title="${t('food.log.markEaten')}">✓</div>
            <span class="ex-check-label">${t('food.log.markEaten')}</span>
          </div>
          <div class="ex-check-wrap" ${delClick}style="cursor:${afgesloten ? 'default' : 'pointer'}">
            <span style="font-size:16px;color:var(--accent);line-height:1">🗑️</span>
            <span class="ex-check-label">${t('common.delete')}</span>
          </div>
        </div>
      </div>
    </div>`;
}

// Markeert een gelogd item als (niet) gegeten -- zuiver visueel (zelfde
// idee als "gedaan" afvinken bij Training), telt niet mee in de
// kcal/macro-totalen. Werkt zowel voor "Mijn dag" als voor een
// willekeurige datum vanuit Weekplanning.
function toggleFoodEaten(dateStr, logId) {
  if (!magAfvinken(dateStr)) return; // alleen vandaag, en alleen als die nog niet is afgesloten
  const items = dateStr === currentLogDate ? dayLog : (foodDays[dateStr] || []);
  const item = items.find(i => i.logId === logId);
  if (!item) return;
  item.eaten = !isEatenItem(item);

  // Het bolletje omzetten gebeurt EERST, vóór het opslaan -- zo is het
  // vinkje altijd meteen zichtbaar, ook als de opslag hieronder om wat
  // voor reden dan ook misgaat (zelfde "best-effort nazorg"-patroon als
  // fwRemoveItem in foodweek.js).
  //
  // renderLogItemCard() is bewust gedeeld tussen "Vandaag" en een
  // dag-kaart in Weekplanning (fwBouwDagKaart) -- voor vandaag staat
  // hetzelfde item dus vaak in BEIDE tabbladen tegelijk in de DOM,
  // allebei met hetzelfde food-chk-<logId>/food-item-<logId> element-id.
  // document.getElementById() geeft dan alleen het EERSTE exemplaar
  // terug (in document-volgorde toevallig de -- op dat moment onzichtbare --
  // Weekplanning-kaart, vóór "Vandaag" in de HTML), waardoor een klik in
  // "Vandaag" zelf leek niets te doen: het bolletje van de andere,
  // onzichtbare kopie werd omgezet, niet die je ziet. Update daarom altijd
  // ALLE exemplaren met dit id, in welk tabblad ze ook staan.
  document.querySelectorAll('[id="food-chk-' + logId + '"]').forEach(chk => chk.classList.toggle('done', item.eaten));
  document.querySelectorAll('[id="food-item-' + logId + '"]').forEach(card => card.style.opacity = item.eaten ? '1' : '0.75');

  try {
    foodDays[dateStr] = items;
    syncSet('prime_food_days', foodDays);
  } catch (e) { console.error('toggleFoodEaten opslaan mislukt:', e); }

  // Afvinken verandert nu wat als inname telt: totalen/balken bijwerken.
  if (dateStr === currentLogDate) {
    try { updateMacroTotals(); } catch (e) { console.error(e); }
    try { updateHomeMacros(); } catch (e) { console.error(e); }
    try { if (document.getElementById('foodtab-log')?.style.display !== 'none') renderDayLog(); } catch (e) { console.error(e); }
  }
  try { if (document.getElementById('foodweek-content')) renderFoodWeek(); } catch (e) { console.error(e); }
}

// Groepeert een lijst logitems per moment en bouwt daar de kaartenlijst
// voor — ook gedeeld met Weekplanning. Elk tussendoortje staat direct
// na de bijbehorende maaltijd (ontbijt, ochtendtussendoortje, lunch,
// middagtussendoortje, avond, avondtussendoortje). 'snack' blijft als
// legacy-fallback staan (oude logitems van vóór de opsplitsing in
// ochtend/middag/avond), gesorteerd helemaal achteraan onder een
// generieke "Tussendoortje"-kop.
function renderLogItemsHtml(dateStr, items) {
  const momentLabels = {
    ontbijt: t('moment.ontbijt'), tussendoorOchtend: t('moment.tussendoorOchtend'),
    lunch: t('moment.lunch'), tussendoorMiddag: t('moment.tussendoorMiddag'),
    avond: t('moment.avond'), tussendoorAvond: t('moment.tussendoorAvond'),
    snack: t('moment.snack')
  };
  const momentOrder = { ontbijt:0, tussendoorOchtend:1, lunch:2, tussendoorMiddag:3, avond:4, tussendoorAvond:5, snack:6 };

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
  document.querySelectorAll('.food-scan-btn').forEach(b => { b.style.display = isPrimeCoach() ? '' : 'none'; });
  const empty = document.getElementById('day-log-empty');
  const list = document.getElementById('day-log-list');
  const totals = document.getElementById('day-log-totals');

  // Zelfde vergrendel-indicatie als een dagkaart in Weekplanning
  // (fwBouwDagKaart) -- hoorde hier voorheen niet bij, waardoor "Vandaag"
  // in Voeding geen melding toonde terwijl Weekplanning dat wel deed.
  const dagLigtVast = isDagAfgesloten(currentLogDate);
  const lockBanner = document.getElementById('day-log-locked-banner');
  if (lockBanner) lockBanner.style.display = dagLigtVast ? 'block' : 'none';
  const emptyAddRow = document.getElementById('day-log-empty-addrow');
  if (emptyAddRow) emptyAddRow.style.display = dagLigtVast ? 'none' : 'flex';
  const totalsAddRow = document.getElementById('day-log-totals-addrow');
  if (totalsAddRow) totalsAddRow.style.display = dagLigtVast ? 'none' : 'flex';
  const clearBtn = document.getElementById('day-log-clear-btn');
  if (clearBtn) clearBtn.style.display = dagLigtVast ? 'none' : '';

  if (dayLog.length === 0) {
    empty.style.display = 'block';
    list.innerHTML = '';
    totals.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  totals.style.display = 'block';
  list.innerHTML = renderLogItemsHtml(currentLogDate, dayLog);

  const _dlSplit = splitTotals(dayLog);
  const tot = _dlSplit.eaten;
  const _dlPlanNote = _dlSplit.planned.kcal > 0
    ? '<div style="font-size:12px;color:var(--muted);text-align:center;margin-top:8px">' + plannedText(_dlSplit.planned.kcal, 'kcal') + '</div>' : '';
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
    </div>` + _dlPlanNote;
}

// ========== GEGETEN vs. GEPLAND ==========
// Alleen wat is AFGEVINKT (gegeten) telt mee als echte inname. Nieuwe items
// starten bewust op "gepland" (eaten:false) -- ook wat je vandaag zelf
// toevoegt -- zodat je bewust aanvinkt wat je echt hebt gegeten. Oudere items
// van vóór deze regel hebben geen eaten-veld (undefined) en tellen als
// gegeten, zodat bestaande dagen niet ineens leeg lijken.
function isEatenItem(i) { return i.eaten !== false; }
function sumItems(items) {
  return items.reduce((a, i) => ({ kcal: a.kcal + (i.kcal || 0), prot: a.prot + (i.prot || 0), carb: a.carb + (i.carb || 0), fat: a.fat + (i.fat || 0) }), { kcal: 0, prot: 0, carb: 0, fat: 0 });
}
function splitTotals(items) {
  return { eaten: sumItems(items.filter(isEatenItem)), planned: sumItems(items.filter(i => !isEatenItem(i))) };
}
// Lichte tint van een balkkleur voor het geplande (nog niet gegeten) deel.
function plannedTint(color) { return 'color-mix(in srgb, ' + color + ' 30%, white)'; }
function plannedText(n, unit) { return n > 0 ? t('food.plannedSuffix', { n: Math.round(n) + (unit ? ' ' + unit : '') }) : ''; }

// Totaal geplande kcal + E/K/V voor vandaag (al gegeten + nog te gaan samen),
// rechtsboven de statistiek-blokjes op het dashboard. (De Voeding-balkjes
// tonen dit zelfde totaal per macro individueel boven hun eigen balk, zie
// updateMacroTotals().) Leest bewust rechtstreeks uit foodDays i.p.v. dayLog:
// dayLog volgt de dag die net open staat in Voeding (kan door Weekplanning
// een andere dag zijn), terwijl dit altijd om vandaag moet gaan, ongeacht
// waar de gebruiker in Voeding aan het kijken is.
function updateHomePlannedSummary() {
  const el = document.getElementById('home-planned-summary');
  if (!el) return;
  const _split = splitTotals(foodDays[fdTodayStr()] || []);
  const tot = {
    kcal: _split.eaten.kcal + _split.planned.kcal, prot: _split.eaten.prot + _split.planned.prot,
    carb: _split.eaten.carb + _split.planned.carb, fat: _split.eaten.fat + _split.planned.fat
  };
  const show = tot.kcal > 0 || tot.prot > 0 || tot.carb > 0 || tot.fat > 0;
  el.style.display = show ? '' : 'none';
  el.textContent = show ? t('home.plannedToday', {
    kcal: Math.round(tot.kcal), prot: Math.round(tot.prot),
    carb: Math.round(tot.carb), fat: Math.round(tot.fat)
  }) : '';
}

// ========== MACRO TOTALS (combined: meals + log) ==========
function updateHomeMacros() {
  const el = document.getElementById('home-nutrient-rows');
  if (!el) return;
  const doel = getDagDoel();
  const _split = splitTotals(dayLog);
  const tot = _split.eaten, planned = _split.planned;

  const macros = [
    { key:'kcal', label:t('food.nutrient.calories'), val:Math.round(tot.kcal), plan:planned.kcal, doel:doel.kcal, unit:'kcal', color:'#4CAF50' },
    { key:'prot', label:t('food.nutrient.protein'), val:Math.round(tot.prot), plan:planned.prot, doel:doel.prot, unit:'g.', color:'#2196F3' },
    { key:'carb', label:t('food.nutrient.carbs'), val:Math.round(tot.carb), plan:planned.carb, doel:doel.carb, unit:'g.', color:'#E91E8C' },
    { key:'fat',  label:t('food.nutrient.fat'), val:Math.round(tot.fat), plan:planned.fat, doel:doel.fat, unit:'g.', color:'#FF5722' },
  ];

  el.innerHTML = macros.map(m => {
    // pct = exacte percentage (ook boven 100%, voor de weergegeven tekst);
    // de balk zelf blijft wel op 100% breedte gekapt (anders loopt hij
    // buiten de kaart) via een aparte pctBar-variabele.
    const pct = Math.round(m.val / m.doel * 100);
    const pctBar = Math.min(100, pct);
    // Doel-range: kcal ±10%, eiwit/koolhydraten/vet ±20% (macroDoelRange in
    // data.js). Elke balk toont z'n eigen vaste kleur, ongeacht voortgang —
    // alleen duidelijk buiten de doelrange krijgt de rode waarschuwingskleur.
    const { min: rmin, max: rmax } = macroDoelRange(m.doel, m.key);
    const fillColor = m.val > rmax ? '#E24B4A' : m.color;
    return `
      <div style="display:grid;grid-template-columns:100px 80px 1fr;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--sand-dark)">
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--charcoal)">${m.label}</div>
          <div style="font-size:10px;color:var(--muted)">${t('food.goalRange', { min: rmin, max: rmax, unit: m.unit })}</div>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--charcoal)">${m.val} ${m.unit}${m.plan > 0 ? '<span style="display:block;font-size:10px;font-weight:400;color:var(--muted)">' + plannedText(m.plan) + '</span>' : ''}</div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:12px;background:${m.plan > 0 ? 'linear-gradient(to right,' + plannedTint(m.color) + ' ' + Math.min(100, Math.round((m.val + m.plan) / m.doel * 100)) + '%,var(--sand-dark) ' + Math.min(100, Math.round((m.val + m.plan) / m.doel * 100)) + '%)' : 'var(--sand-dark)'};border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${pctBar}%;background:${fillColor};border-radius:4px;transition:width 0.4s"></div>
          </div>
          <div style="font-size:11px;font-weight:600;color:var(--muted);min-width:28px;text-align:right">${pct}%</div>
        </div>
      </div>`;
  }).join('');
  // Remove last border
  el.lastElementChild && (el.lastElementChild.style.borderBottom = 'none');
}

function updateMacroTotals() {
  const doel = getDagDoel();

  // dayLog is de enige bron van waarheid; alleen gegeten items tellen als
  // inname, het gepland-maar-niet-afgevinkte deel wordt apart getoond.
  const _split = splitTotals(dayLog);
  const tot = { ..._split.eaten };
  const planned = _split.planned;

  tot.kcal = Math.round(tot.kcal);
  tot.prot = Math.round(tot.prot);
  tot.carb = Math.round(tot.carb);
  tot.fat  = Math.round(tot.fat);

  const macros = [
    { key:'kcal', valId:'f-kcal', barId:'bar-kcal', pctId:'pct-kcal', doelId:'doel-kcal',
      val: tot.kcal, plan: planned.kcal, doel: doel.kcal, unit:'kcal', color:'#4CAF50' },
    { key:'prot', valId:'f-prot', barId:'bar-prot', pctId:'pct-prot', doelId:'doel-prot',
      val: tot.prot, plan: planned.prot, doel: doel.prot, unit:'g.', color:'#2196F3' },
    { key:'carb', valId:'f-carb', barId:'bar-carb', pctId:'pct-carb', doelId:'doel-carb',
      val: tot.carb, plan: planned.carb, doel: doel.carb, unit:'g.', color:'#E91E8C' },
    { key:'fat',  valId:'f-fat',  barId:'bar-fat',  pctId:'pct-fat',  doelId:'doel-fat',
      val: tot.fat,  plan: planned.fat,  doel: doel.fat,  unit:'g.', color:'#FF5722' },
  ];

  macros.forEach(m => {
    // Doel-range: kcal ±10%, eiwit/koolhydraten/vet ±20% (macroDoelRange in
    // data.js).
    const r = macroDoelRange(m.doel, m.key);
    // pct = exacte percentage (ook boven 100%, voor de weergegeven tekst);
    // de balk zelf blijft wel op 100% breedte gekapt (anders loopt hij
    // buiten de kaart) via een aparte pctBar-variabele.
    const pct = Math.round(m.val / m.doel * 100);
    const pctBar = Math.min(100, pct);

    // Elke balk toont z'n eigen vaste kleur, ongeacht voortgang — alleen
    // duidelijk buiten de doelrange krijgt de rode waarschuwingskleur.
    // Voorheen werd alles onder 85% uniform oranje, waardoor de balken
    // niet meer van elkaar te onderscheiden waren.
    const fillColor = m.val > r.max ? '#E24B4A' : m.color;

    // Boven elke balk staat het TOTAAL voor vandaag (al gegeten + nog gepland
    // samen) als hoofdgetal, met -- als er van beide iets is -- eronder hoeveel
    // daarvan al is afgevinkt. Zo weet je in één oogopslag wat je totaal voor
    // vandaag hebt staan, ongeacht wat je al hebt afgevinkt.
    const _totRounded = Math.round(m.val + m.plan);
    const _eatenRounded = Math.round(m.val);
    const _planRounded = Math.round(m.plan);
    // Vaste knip na "waarvan X kcal", met "al gegeten" altijd op een eigen
    // regel -- i.p.v. los laten afbreken (white-space:normal alleen), want in
    // de smalle kolom brak dat op onvoorspelbare/lelijke plekken, of liep op
    // de telefoon door tot buiten beeld.
    const _eatenLine = t('food.eatenOfTotal.line1', { n: _eatenRounded + ' ' + m.unit }) + '<br>' + t('food.eatenOfTotal.line2');
    document.getElementById(m.valId).innerHTML = `${_totRounded} ${m.unit}` + (_eatenRounded > 0 && _planRounded > 0 ? '<span style="display:block;font-size:10px;font-weight:400;color:var(--muted)">' + _eatenLine + '</span>' : '');
    const _allBar = Math.min(100, Math.round((m.val + m.plan) / m.doel * 100));
    const _track = document.getElementById(m.barId).parentElement;
    if (_track) _track.style.background = m.plan > 0 ? 'linear-gradient(to right,' + plannedTint(m.color) + ' ' + _allBar + '%,var(--sand-dark) ' + _allBar + '%)' : '';
    document.getElementById(m.barId).style.width = pctBar + '%';
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
  updateHomePlannedSummary();
}


// ========== PRIME-PRODUCTEN (gedeeld, alleen coach kan bewerken) ==========
// De vaste basisproducten staan in data.js (PRODUCTS). De coach kan er voor
// iedereen wijzigingen op aanbrengen: een product aanpassen ('edit'), verwijderen
// ('hide') of een nieuw product toevoegen ('new'). Die wijzigingen staan in de
// gedeelde Supabase-tabel prime_products (zie supabase/prime_products.sql) en
// worden hier, cache-first uit localStorage, over PRODUCTS heen gelegd -- dus
// ook offline beschikbaar. Zelfde opzet als de PRIME-gerechten hierboven.
let primeProducts = [];
try { primeProducts = JSON.parse(localStorage.getItem('prime_prime_products') || '[]'); } catch (e) {}
let _productsOrig = null; // ongewijzigde kopie van PRODUCTS uit data.js
const PRIME_PRODUCT_VELDEN = ['name', 'name_en', 'cat', 'kcal', 'prot', 'carb', 'fat', 'photo', 'icon', 'portie'];

// Bouwt PRODUCTS opnieuw op uit de originele lijst plus de gedeelde wijzigingen.
// De array zelf blijft dezelfde (op zijn plek aangepast), zodat alles wat naar
// PRODUCTS verwijst blijft werken.
function applyPrimeProducts() {
  if (!_productsOrig) _productsOrig = PRODUCTS.map(p => Object.assign({}, p));
  const perId = {};
  primeProducts.forEach(r => { if (r && r.id) perId[r.id] = r; });
  const nieuw = [];
  _productsOrig.forEach(orig => {
    const r = perId[orig.id];
    if (r && r.op === 'hide') return;
    const p = Object.assign({}, orig);
    if (r && r.op === 'edit') {
      PRIME_PRODUCT_VELDEN.forEach(f => { if (r[f] !== undefined) p[f] = r[f]; });
      p.primeEdited = true;
    }
    nieuw.push(p);
  });
  primeProducts.forEach(r => {
    if (r && r.op === 'new') {
      const p = Object.assign({ icon: '🍽️' }, r);
      delete p.op;
      p.primeShared = true;
      nieuw.push(p);
    }
  });
  PRODUCTS.length = 0;
  nieuw.forEach(p => PRODUCTS.push(p));
  if (typeof applyCustomPhotos === 'function') { try { applyCustomPhotos(); } catch (e) { console.error(e); } }
}

function _bewaarPrimeProductenLokaal() {
  try { localStorage.setItem('prime_prime_products', JSON.stringify(primeProducts)); } catch (e) { console.error(e); }
}

async function fetchPrimeProductsFromCloud() {
  const sb = getSupabase();
  const { data, error } = await withTimeout(
    sb.from('prime_products').select('id, value'),
    3000, { data: null, error: { message: 'Failed to fetch (timeout)' } }
  );
  if (error) { console.error('fetchPrimeProductsFromCloud:', error); return null; }
  return (data || []).map(row => row.value);
}

// Geeft de fout terug (of null bij succes), zie savePrimeMealToCloud().
async function savePrimeProductToCloud(row) {
  const sb = getSupabase();
  const { error } = await withTimeout(
    sb.from('prime_products').upsert({ id: row.id, value: row, updated_at: new Date().toISOString() }),
    3000, { error: { message: 'Failed to fetch (timeout)' } }
  );
  if (error) console.error('savePrimeProductToCloud:', error);
  return error || null;
}

async function deletePrimeProductFromCloud(id) {
  const sb = getSupabase();
  const { error } = await withTimeout(
    sb.from('prime_products').delete().eq('id', id),
    3000, { error: { message: 'Failed to fetch (timeout)' } }
  );
  if (error) console.error('deletePrimeProductFromCloud:', error);
  return error || null;
}

async function primeProductsRefreshFromCloud() {
  const lijst = await fetchPrimeProductsFromCloud();
  if (lijst === null) return;
  if (JSON.stringify(lijst) === JSON.stringify(primeProducts)) return;
  primeProducts = lijst;
  _bewaarPrimeProductenLokaal();
  applyPrimeProducts();
  const basis = document.getElementById('tab-basis');
  if (basis && basis.classList.contains('active')) renderProducts();
}

// Opstarten: eerst de bewaarde wijzigingen toepassen (werkt ook offline), daarna
// op de achtergrond verversen vanuit de cloud.
applyPrimeProducts();
setTimeout(function() { primeProductsRefreshFromCloud().catch(function(e) { console.error(e); }); }, 1500);

// Coach: opent het formulier bij "+ Eigen basisproducten" met de gegevens van
// een basisproduct, om dat voor iedereen aan te passen.
function editPrimeProduct(id) {
  if (!isPrimeCoach()) return;
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  closePortionModal();
  resetAddProductForm();
  _apPrimeId = id;
  showApForm(true);
  updateApShareRow();

  document.getElementById('ap-name').value = p.name;
  document.getElementById('ap-cat').value = p.cat || 'overig';
  document.getElementById('ap-prot').value = p.prot || 0;
  document.getElementById('ap-carb').value = p.carb || 0;
  document.getElementById('ap-fat').value = p.fat || 0;
  updateAddProductKcal();
  _apPhotoData = p.photo || null;
  document.getElementById('ap-photo-preview').innerHTML = p.photo
    ? '<img src="' + p.photo + '" style="width:100%;height:100%;object-fit:cover">'
    : '🍽️';
  document.getElementById('ap-error').textContent = '';

  document.getElementById('ap-form-title').textContent = t('food.prime.editTitle');
  document.getElementById('ap-submit-btn').textContent = t('food.prime.save');
  document.getElementById('ap-submit-btn').classList.add('coach-only-btn'); // coach-only: oranje
  document.getElementById('ap-cancel-btn').style.display = 'inline-block';
  const rij = primeProducts.find(r => r && r.id === id);
  const isNieuw = !!(rij && rij.op === 'new');
  document.getElementById('ap-prime-actions').style.display = 'flex';
  // "Terug naar origineel" kan alleen bij een aangepast, oorspronkelijk product.
  document.getElementById('ap-prime-reset').style.display = (rij && rij.op === 'edit') ? 'inline-block' : 'none';

  switchFoodTab('add');
  document.getElementById('ap-name').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Opslaan van een aangepast basisproduct, voor iedereen.
async function savePrimeProductEdit() {
  if (!isPrimeCoach() || !_apPrimeId) return;
  const errorEl = document.getElementById('ap-error');
  const name = document.getElementById('ap-name').value.trim();
  if (!name) { errorEl.textContent = t('food.add.nameRequired'); return; }
  if (productNaamBestaat(name, _apPrimeId)) { errorEl.textContent = t('food.prime.nameExists'); return; }
  errorEl.textContent = '';

  const velden = {
    name: name,
    cat: document.getElementById('ap-cat').value,
    kcal: updateAddProductKcal(),
    prot: parseFloat(document.getElementById('ap-prot').value) || 0,
    carb: parseFloat(document.getElementById('ap-carb').value) || 0,
    fat: parseFloat(document.getElementById('ap-fat').value) || 0,
    photo: _apPhotoData || null
  };

  const id = _apPrimeId;
  const bestaand = primeProducts.find(r => r && r.id === id);
  let rij;
  if (bestaand && bestaand.op === 'new') {
    rij = Object.assign({}, bestaand, velden);
    if (bestaand.name !== name) rij.name_en = '';
  } else {
    // Alleen wat afwijkt van het originele product wordt bewaard, zodat latere
    // verbeteringen aan de vaste lijst voor onaangepaste velden blijven doorwerken.
    const orig = (_productsOrig || []).find(o => o.id === id) || {};
    rij = { id: id, op: 'edit' };
    Object.keys(velden).forEach(f => { if (velden[f] !== orig[f] && !(velden[f] === null && orig[f] === undefined)) rij[f] = velden[f]; });
    // Het formulier rekent kcal altijd uit E/K/V; de vaste lijst heeft soms de
    // kcal uit de bron. Alleen als de macro's zelf zijn gewijzigd telt de nieuwe kcal.
    const macrosGewijzigd = ['prot', 'carb', 'fat'].some(f => velden[f] !== orig[f]);
    if (!macrosGewijzigd) delete rij.kcal;
    if (rij.name !== undefined) rij.name_en = '';
  }

  if (!bestaand && rij.op === 'edit' && Object.keys(rij).length === 2) {
    // Niets veranderd: er valt niets op te slaan.
    const _t0 = _apTerug;
    resetAddProductForm();
    switchFoodTab('basis');
    _apTerug = _t0;
    apTerugNaarDag();
    return;
  }

  primeProducts = primeProducts.filter(r => !(r && r.id === id)).concat([rij]);
  _bewaarPrimeProductenLokaal();
  applyPrimeProducts();
  const fout = await savePrimeProductToCloud(rij);
  const _t1 = _apTerug;
  resetAddProductForm();
  switchFoodTab('basis');
  _apTerug = _t1;
  try { showToast(fout ? t('food.prime.saveFailed') : t('food.prime.saved'), !!fout); } catch (e) { console.error(e); }
  apTerugNaarDag();
}

// Coach: aangepast basisproduct terugzetten naar de oorspronkelijke waarden.
async function resetPrimeProduct() {
  if (!isPrimeCoach() || !_apPrimeId) return;
  if (!confirm(t('food.prime.confirmReset'))) return;
  const id = _apPrimeId;
  primeProducts = primeProducts.filter(r => !(r && r.id === id));
  _bewaarPrimeProductenLokaal();
  applyPrimeProducts();
  const fout = await deletePrimeProductFromCloud(id);
  const _t2 = _apTerug;
  resetAddProductForm();
  switchFoodTab('basis');
  _apTerug = _t2;
  try { showToast(fout ? t('food.prime.saveFailed') : t('food.prime.resetDone'), !!fout); } catch (e) { console.error(e); }
  apTerugNaarDag();
}

// Coach: basisproduct voor iedereen verwijderen (vaste producten worden
// verborgen, een door de coach toegevoegd product wordt echt weggehaald).
async function deletePrimeProduct() {
  if (!isPrimeCoach() || !_apPrimeId) return;
  if (!confirm(t('food.prime.confirmDelete'))) return;
  const id = _apPrimeId;
  const bestaand = primeProducts.find(r => r && r.id === id);
  let fout;
  if (bestaand && bestaand.op === 'new') {
    primeProducts = primeProducts.filter(r => !(r && r.id === id));
    fout = await deletePrimeProductFromCloud(id);
  } else {
    const rij = { id: id, op: 'hide' };
    primeProducts = primeProducts.filter(r => !(r && r.id === id)).concat([rij]);
    fout = await savePrimeProductToCloud(rij);
  }
  _bewaarPrimeProductenLokaal();
  applyPrimeProducts();
  const _t3 = _apTerug;
  resetAddProductForm();
  switchFoodTab('basis');
  _apTerug = _t3;
  try { showToast(fout ? t('food.prime.saveFailed') : t('food.prime.deleted'), !!fout); } catch (e) { console.error(e); }
  apTerugNaarDag();
}


// ----- Nieuw product voor iedereen (coach): kopie van een basisproduct, of een
// nieuw product via "+ Eigen basisproducten" met het vinkje "voor iedereen" -----

// Bestaat er al een product (vast, door de coach toegevoegd of eigen) met deze
// naam? Zo voorkomen we dubbele namen in de lijst. exceptId = het product dat
// zelf wordt aangepast.
function productNaamBestaat(naam, exceptId) {
  const norm = String(naam || '').trim().toLowerCase();
  if (!norm) return false;
  return getAllProducts().some(p => p.id !== exceptId &&
    [p.name, p.name_en].some(n => n && String(n).trim().toLowerCase() === norm));
}

// Staat het formulier in "nieuw product voor iedereen"-stand (coach, nieuw
// product, vinkje aan)?
function _apGedeeld() {
  if (!isPrimeCoach() || _apEditingId || _apPrimeId) return false;
  const sh = document.getElementById('ap-share');
  return !!(sh && sh.checked);
}

// Toont het vinkje "Voor iedereen" alleen voor de coach bij een NIEUW product,
// en kleurt de opslaan-knop oranje (coach-only) zodra het voor iedereen is.
function updateApShareRow() {
  const row = document.getElementById('ap-share-row');
  const btn = document.getElementById('ap-submit-btn');
  if (!row || !btn) return;
  const nieuwStand = isPrimeCoach() && !_apEditingId && !_apPrimeId && !_apCopyOf;
  row.style.display = nieuwStand ? 'block' : 'none';
  const rijE = document.getElementById('ap-share-edit-row');
  const eigenBewerken = isPrimeCoach() && !!_apEditingId && !_apPrimeId;
  if (rijE) rijE.style.display = eigenBewerken ? 'block' : 'none';
  if (eigenBewerken) {
    const deel = !!(document.getElementById('ap-share-edit') || {}).checked;
    btn.classList.toggle('coach-only-btn', deel);
    btn.textContent = deel ? t('food.prime.saveShare') : t('food.add.update');
    return;
  }
  if (_apPrimeId) return; // oranje + tekst worden door editPrimeProduct() gezet
  const gedeeld = _apCopyOf ? true : _apGedeeld();
  btn.classList.toggle('coach-only-btn', gedeeld);
  if (_apCopyOf) btn.textContent = t('food.prime.saveNew');
  else if (!_apEditingId) btn.textContent = t('food.add.submit');
}

// Coach: maakt van het geopende basisproduct een kopie. De velden blijven
// gevuld; opslaan kan pas met een andere naam (zie productNaamBestaat()).
function copyPrimeProduct() {
  if (!isPrimeCoach() || !_apPrimeId) return;
  _apCopyOf = _apPrimeId;
  _apPrimeId = null;
  document.getElementById('ap-form-title').textContent = t('food.prime.copyTitle');
  document.getElementById('ap-prime-actions').style.display = 'none';
  document.getElementById('ap-error').textContent = '';
  apNaamInput();
  updateApShareRow();
  const naamEl = document.getElementById('ap-name');
  naamEl.focus();
  naamEl.select();
  naamEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Opslaan van een nieuw product voor iedereen (kopie of nieuw met vinkje).
async function savePrimeProductNew() {
  if (!isPrimeCoach()) return;
  const errorEl = document.getElementById('ap-error');
  const name = document.getElementById('ap-name').value.trim();
  if (!name) { errorEl.textContent = t('food.add.nameRequired'); return; }
  if (productNaamBestaat(name, null)) { errorEl.textContent = t('food.prime.nameExists'); return; }
  errorEl.textContent = '';

  const bron = _apCopyOf ? PRODUCTS.find(p => p.id === _apCopyOf) : null;
  const rij = {
    id: 'prime-' + Date.now() + Math.floor(Math.random() * 1000),
    op: 'new',
    icon: (bron && bron.icon) || '🍽️',
    name: name,
    cat: document.getElementById('ap-cat').value,
    kcal: updateAddProductKcal(),
    prot: parseFloat(document.getElementById('ap-prot').value) || 0,
    carb: parseFloat(document.getElementById('ap-carb').value) || 0,
    fat: parseFloat(document.getElementById('ap-fat').value) || 0,
    photo: _apPhotoData || null
  };
  if (_apBarcode) rij.barcode = _apBarcode;
  primeProducts = primeProducts.concat([rij]);
  _bewaarPrimeProductenLokaal();
  applyPrimeProducts();
  const fout = await savePrimeProductToCloud(rij);
  resetAddProductForm();
  switchFoodTab('basis');
  try { showToast(fout ? t('food.prime.saveFailed') : t('food.prime.savedNew'), !!fout); } catch (e) { console.error(e); }
}

// Live naamcontrole terwijl de coach typt: de melding verschijnt alleen zolang de
// naam nog bij een bestaand product hoort en verdwijnt zodra hij uniek is.
function apNaamInput() {
  const hint = document.getElementById('ap-hint');
  if (!hint) return;
  const actief = !!(_apCopyOf || _apCopyOwn || _apPrimeId || _apGedeeld());
  const naam = document.getElementById('ap-name').value;
  const bestaat = actief && productNaamBestaat(naam, _apPrimeId);
  hint.textContent = bestaat ? t('food.prime.nameExists') : '';
  hint.style.display = bestaat ? 'block' : 'none';
  const errorEl = document.getElementById('ap-error');
  if (!bestaat && errorEl && errorEl.textContent === t('food.prime.nameExists')) errorEl.textContent = '';
}


// ----- Bestaande eigen producten van de coach: voor iedereen beschikbaar maken of kopiëren -----

// Een foto die nog als data-URL in het product staat (upload naar Storage was
// toen niet gelukt) alsnog uploaden, zodat de gedeelde rij klein blijft. Lukt het
// niet, dan blijft de data-URL gewoon staan.
async function _fotoNaarStorage(foto) {
  if (!foto || String(foto).indexOf('data:') !== 0) return foto || null;
  try {
    const blob = await (await fetch(foto)).blob();
    const ext = (blob.type.split('/')[1] || 'jpg').replace(/[^a-z0-9]/g, '') || 'jpg';
    const url = await uploadPhotoToStorage(new File([blob], 'foto.' + ext, { type: blob.type }));
    return url || foto;
  } catch (e) {
    console.error('_fotoNaarStorage:', e);
    return foto;
  }
}

// Verplaatst een eigen product naar de gedeelde basisproducten. Het id blijft
// hetzelfde, zodat al gelogde items het product (en de foto) blijven terugvinden.
// Pas als het opslaan in de cloud lukt verdwijnt het uit "Mijn eigen producten";
// anders blijft alles zoals het was.
async function deelEigenProduct(id, zonderBevestiging) {
  if (!isPrimeCoach()) return;
  const p = customProducts.find(x => x.id === id);
  if (!p) return;
  if (productNaamBestaat(p.name, id)) { alert(t('food.prime.shareNameExists')); return; }
  if (!zonderBevestiging && !confirm(t('food.prime.shareConfirm'))) return;
  const foto = await _fotoNaarStorage(p.photo);
  const rij = {
    id: p.id, op: 'new', icon: p.icon || '🍽️', name: p.name, cat: p.cat,
    kcal: p.kcal, prot: p.prot, carb: p.carb, fat: p.fat, photo: foto || null
  };
  const fout = await savePrimeProductToCloud(rij);
  if (fout) {
    try { showToast(t('food.prime.saveFailed'), true); } catch (e) { console.error(e); }
    return;
  }
  primeProducts = primeProducts.filter(r => !(r && r.id === rij.id)).concat([rij]);
  _bewaarPrimeProductenLokaal();
  customProducts = customProducts.filter(x => x.id !== id);
  syncSet('prime_custom_products', customProducts);
  applyPrimeProducts();
  renderAddProductTab();
  renderProducts();
  try { showToast(t('food.prime.sharedOwnDone')); } catch (e) { console.error(e); }
}

// Vult het formulier met een kopie van een eigen product. De coach geeft het een
// andere naam en kiest met het vinkje of het voor iedereen of eigen wordt.
function kopieerEigenProduct(id) {
  if (!isPrimeCoach()) return;
  const p = customProducts.find(x => x.id === id);
  if (!p) return;
  resetAddProductForm();
  _apCopyOwn = true;
  showApForm(true);

  document.getElementById('ap-name').value = p.name;
  document.getElementById('ap-cat').value = p.cat || 'overig';
  document.getElementById('ap-prot').value = p.prot || 0;
  document.getElementById('ap-carb').value = p.carb || 0;
  document.getElementById('ap-fat').value = p.fat || 0;
  updateAddProductKcal();
  _apPhotoData = p.photo || null;
  document.getElementById('ap-photo-preview').innerHTML = p.photo
    ? '<img src="' + p.photo + '" style="width:100%;height:100%;object-fit:cover">'
    : '🍽️';
  document.getElementById('ap-form-title').textContent = t('food.prime.copyOwnTitle');
  document.getElementById('ap-cancel-btn').style.display = 'inline-block';
  updateApShareRow();
  apNaamInput();
  const naamEl = document.getElementById('ap-name');
  naamEl.focus();
  naamEl.select();
  naamEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}


// Label op de foto van een product: groen "Eigen" bij een eigen product. Producten
// van de coach (voor iedereen) en vaste basisproducten krijgen geen label: voor
// klanten zijn dat gewoon basisproducten.
function productLabelHtml(p) {
  if (p.custom) return '<span class="prod-label prod-label-own">' + t('food.label.own') + '</span>';
  return '';
}


// ========== BARCODE SCANNEN (alleen coach) ==========
// De camera leest de barcode (EAN) en het nummer wordt opgezocht in Open Food
// Facts (gratis, door gebruikers ingevuld, dus NIET geverifieerd). De gevonden
// waardes worden eerst getoond; pas na "Gebruiken" vult het formulier zich en
// controleert de coach het alsnog voordat hij opslaat. De foto voegt de coach
// zelf toe. Eigen foto, dus er wordt bewust geen plaatje uit de database gebruikt.
let _bcStream = null;
let _bcTimer = null;
let _bcReader = null;
let _bcBezig = false;
let _bcProduct = null;
// Camera-instellingen van de coach, per toestel onthouden. 'auto' = de standaard van de
// gebruikte leesmethode (ingebouwde lezer, software-lezer op telefoon of computer-lus).
const BC_INST_STANDAARD = { res: 'auto', sps: 'auto', cam: '', focus: 'auto', hard: 'auto', variants: 'alle' };
let _bcInst = Object.assign({}, BC_INST_STANDAARD);
let _bcMethode = 'zxing'; // leesmethode van de laatste start: 'native', 'zxing' (telefoon) of 'desktop'
try { Object.assign(_bcInst, JSON.parse(localStorage.getItem('prime_scan_inst') || '{}')); } catch (e) { /* standaard */ }
function _bcBewaarInst() { try { localStorage.setItem('prime_scan_inst', JSON.stringify(_bcInst)); } catch (e) { console.error(e); } }
let _bcModus = 'product'; // 'product' = nieuw basisproduct maken, 'dag' = gescand eten aan een dag toevoegen
let _bcVorigeDatum = null;
let _apBarcode = null; // barcode van het product dat nu in het formulier staat (na scannen)



// doorNaarPortie = true als we meteen het portiescherm openen (dan blijft de dag
// en het terugkeer-tabblad staan); anders (annuleren) zetten we alles terug.
function closeBarcodeScanner(doorNaarPortie) {
  stopBarcodeCamera();
  document.getElementById('barcode-modal').classList.remove('open');
  if (_bcModus === 'dag' && !doorNaarPortie) {
    _portionReturnTab = null;
    if (_bcVorigeDatum && _bcVorigeDatum !== currentLogDate) switchLogDate(_bcVorigeDatum);
  }
  if (!doorNaarPortie) _bcVorigeDatum = null;
}

function _bcStatus(tekst) {
  const el = document.getElementById('bc-status');
  if (el) el.textContent = tekst || '';
}

function _laadZxing() {
  return new Promise((resolve, reject) => {
    if (window.ZXing) return resolve();
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js';
    s.onload = () => (window.ZXing ? resolve() : reject(new Error('zxing')));
    s.onerror = () => reject(new Error('zxing laden mislukt'));
    document.head.appendChild(s);
  });
}

async function startBarcodeCamera() {
  stopBarcodeCamera();
  const camKnop = document.getElementById('bc-cam-btn');
  if (camKnop) camKnop.style.display = 'none';
  const infoEl = document.getElementById('bc-info');
  if (infoEl) infoEl.textContent = '';
  _bcStatus(t('food.scan.starting'));
  const video = document.getElementById('bc-video');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    _bcStatus(t('food.scan.noCamera'));
    return;
  }
  try {
    const desktop = !!(window.matchMedia && matchMedia('(pointer: fine)').matches && !matchMedia('(pointer: coarse)').matches);
    let native = false;
    if (!desktop && 'BarcodeDetector' in window) {
      try {
        const formaten = await BarcodeDetector.getSupportedFormats();
        native = formaten.indexOf('ean_13') !== -1;
      } catch (e) { native = false; }
    }
    let methode, ms;
    if (desktop) {
      methode = 'desktop';
      ms = _bcIntervalMs(120);
      await _bcDesktopLus(video, ms);
    } else if (native) {
      methode = 'native';
      ms = _bcIntervalMs(200);
      _bcStream = await _bcOpenStream({ w: 1280, h: 720 }, { ideal: 'environment' });
      video.srcObject = _bcStream;
      await video.play();
      if (_bcFocusActief(true)) _bcFocus(video);
      const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      _bcTimer = setInterval(async () => {
        if (_bcBezig) return;
        try {
          const gevonden = await detector.detect(video);
          if (gevonden.length) bcGevonden(gevonden[0].rawValue);
        } catch (e) { /* volgende ronde */ }
      }, ms);
    } else {
      methode = 'zxing';
      ms = _bcInst.sps === 'auto' ? 500 : _bcIntervalMs(500);
      await _laadZxing();
      const hints = new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E]);
      if (_bcHardActief(false)) hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      _bcReader = new ZXing.BrowserMultiFormatReader(hints);
      if (_bcInst.sps !== 'auto') _bcReader.timeBetweenDecodingAttempts = ms;
      _bcReader.decodeFromConstraints({ video: _bcVideoEis(null, 'environment'), audio: false }, video, (resultaat) => {
        if (resultaat && !_bcBezig) bcGevonden(resultaat.getText());
      });
      if (_bcFocusActief(false)) setTimeout(() => _bcFocus(video), 1200);
    }
    _bcMethode = methode;
    _bcStatus(t('food.scan.hint'));
    _bcToonInfo(video, methode, ms);
    _bcVulCamLijst().then(bcInstVul);
  } catch (e) {
    console.error('startBarcodeCamera:', e);
    // Een opgeslagen camera die niet meer bestaat mag het scannen niet blijven blokkeren.
    if (_bcInst.cam) { _bcInst.cam = ''; _bcBewaarInst(); }
    _bcStatus(t('food.scan.permission'));
  }
}

function stopBarcodeCamera() {
  if (_bcTimer) { clearInterval(_bcTimer); _bcTimer = null; }
  if (_bcReader) { try { _bcReader.reset(); } catch (e) {} _bcReader = null; }
  if (_bcStream) { _bcStream.getTracks().forEach(tr => tr.stop()); _bcStream = null; }
  const video = document.getElementById('bc-video');
  if (video) { try { video.pause(); } catch (e) {} video.srcObject = null; }
}

function bcGevonden(code) {
  if (_bcBezig) return;
  const cijfers = String(code || '').replace(/\D/g, '');
  if (cijfers.length < 8) return;
  _bcBezig = true;
  stopBarcodeCamera();
  bcZoek(cijfers);
}

function bcManueel() {
  const cijfers = String(document.getElementById('bc-manual').value || '').replace(/\D/g, '');
  if (cijfers.length < 8) { _bcStatus(t('food.scan.tooShort')); return; }
  _bcBezig = true;
  stopBarcodeCamera();
  bcZoek(cijfers);
}

// Vertaalt de categorieën van Open Food Facts grof naar onze categorieën; de coach
// kan het in het formulier altijd nog aanpassen.
function _bcCategorie(tags) {
  const s = (tags || []).join(' ').toLowerCase();
  if (/dairies|milks|cheeses|yogurts|yoghurts|creams|butters/.test(s)) return 'zuivel';
  if (/fishes|seafood|fish-/.test(s)) return 'vis';
  if (/meats|sausages|poultr|hams|charcuterie/.test(s)) return 'vlees';
  if (/nuts|seeds|peanut/.test(s)) return 'noten';
  if (/cereals|breads|pastas|rice|flours|oat|biscuits|crackers/.test(s)) return 'granen';
  if (/vegetables/.test(s)) return 'groente';
  if (/fruits/.test(s)) return 'fruit';
  return 'overig';
}



function bcOpnieuw() {
  _bcBezig = false;
  _bcProduct = null;
  _bcBestaand = null;
  document.getElementById('bc-result').style.display = 'none';
  document.getElementById('bc-view').style.display = 'block';
  document.getElementById('bc-manual').value = '';
  startBarcodeCamera();
}

// Na bevestiging: formulier voor een nieuw product openen met de gevonden waardes.



// ----- Eten scannen voor een dag (Mijn dag en Weekplanning), alleen coach -----

// Barcodes vergelijken zonder voorloopnullen (UPC-A en EAN-13 verschillen daarin).
function _bcNorm(code) { return String(code || '').replace(/\D/g, '').replace(/^0+/, ''); }

// "Mijn dag": voegt toe aan de dag die nu open staat (meestal vandaag).


// Weekplanning: voegt toe aan de gekozen dag.


// Na "Verder": het gescande product bewaren als eigen product (met de barcode, zodat
// het de volgende keer meteen gevonden wordt) en het portiescherm openen. De coach
// kiest daar hoeveelheid en moment; afvinken als gegeten doet hij zelf in de lijst.



// Dag-modus: de coach kan naam en waardes van het gescande product eerst aanpassen.




// ✏️ Aanpassen in het portiescherm (coach): een eigen product opent het gewone
// bewerkformulier, een basisproduct het formulier om het voor iedereen aan te passen.
function editProductFromPortion(id) {
  if (!isPrimeCoach() || !id) return;
  if (_portionReturnTab) _apTerug = { tab: _portionReturnTab, datum: currentLogDate, productId: id };
  if (customProducts.some(p => p.id === id)) { closePortionModal(); editCustomProduct(id); }
  else editPrimeProduct(id);
}


// Portiescherm geopend vanuit de scanner: toont de knop "📷 Opnieuw scannen".
let _pmViaScan = false;
function openPortionViaScan(id, tijdelijk) {
  _pmViaScan = true;
  openPortionModal(id, tijdelijk);
}

// Vanuit het portiescherm terug naar de scanner (dag en terugkeer-tabblad blijven staan).
function portieOpnieuwScannen() {
  if (!isPrimeCoach()) return;
  const terug = _portionReturnTab;
  closePortionModal();
  _portionReturnTab = terug;
  openBarcodeScanner('dag');
}

// Al bewaard product (resultaatscherm in dag-modus): verder naar de hoeveelheid, of bewerken.


function bcBewerkBestaand() {
  const id = _bcBestaand && _bcBestaand.id;
  closeBarcodeScanner(true);
  if (id) editProductFromPortion(id);
  else closeBarcodeScanner();
}


// Na opslaan, annuleren of verwijderen van een product dat de coach vanuit Mijn dag of
// Weekplanning ging aanpassen: terug naar die dag, en het portiescherm van het product
// weer openen (als het nog bestaat), zodat hij verder kan met toevoegen.
function apTerugNaarDag() {
  const z = _apTerug;
  _apTerug = null;
  if (!z) return false;
  switchLogDate(z.datum);
  switchFoodTab(z.tab);
  _portionReturnTab = z.tab;
  if (getAllProducts().some(p => p.id === z.productId)) openPortionModal(z.productId);
  return true;
}

function annuleerAddProduct() {
  const heeftTerug = !!_apTerug;
  resetAddProductForm();
  if (heeftTerug) apTerugNaarDag();
}

// Probeert de camera continu scherp te laten stellen (waar de browser dat ondersteunt);
// helpt vooral bij laptopcamera's, waar een barcode anders wazig blijft.
function _bcFocus(video) {
  try {
    const track = video && video.srcObject && video.srcObject.getVideoTracks()[0];
    if (track && track.applyConstraints) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
  } catch (e) { /* niet ondersteund */ }
}


// Computer (webcam): in plaats van de standaardlezer proberen we elk ~120 ms een ander
// beeld: het hele beeld en middenuitsneden (uitvergroot), met twee manieren van zwart-
// wit maken en een contrastversie. Webcambeelden zijn vaak zacht, ruizig of vlak, en
// één vaste aanpak mist dan de code terwijl je het beeld "heel duidelijk" ziet.
async function _bcDesktopLus(video, ms) {
  await _laadZxing();
  const hints = new Map();
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E]);
  if (_bcHardActief(true)) hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
  const lezer = new ZXing.MultiFormatReader();
  lezer.setHints(hints);

  _bcStream = await _bcOpenStream({ w: 1920, h: 1080 }, null);
  video.srcObject = _bcStream;
  await video.play();
  if (_bcFocusActief(true)) _bcFocus(video);

  const canvas = document.createElement('canvas');
  const c2 = canvas.getContext('2d', { willReadFrequently: true });
  const alleVarianten = [
    { crop: 1, bin: 'hybrid' },
    { crop: 0.6, bin: 'hybrid' },
    { crop: 1, bin: 'global' },
    { crop: 0.6, bin: 'global', contrast: true },
    { crop: 0.4, bin: 'hybrid' },
    { crop: 1, bin: 'hybrid', contrast: true }
  ];
  const varianten = _bcInst.variants === 'enkel' ? [alleVarianten[0]] : alleVarianten;
  let tik = 0;
  _bcTimer = setInterval(() => {
    if (_bcBezig || !video.videoWidth) return;
    const v = varianten[tik % varianten.length];
    tik++;
    const vw = video.videoWidth, vh = video.videoHeight;
    const sw = Math.round(vw * v.crop), sh = Math.round(vh * v.crop);
    const sx = Math.round((vw - sw) / 2), sy = Math.round((vh - sh) / 2);
    const schaal = Math.min(2, 1280 / sw);
    canvas.width = Math.round(sw * schaal);
    canvas.height = Math.round(sh * schaal);
    try { c2.filter = v.contrast ? 'grayscale(1) contrast(1.8)' : 'none'; } catch (e) { /* oudere browser */ }
    c2.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    try {
      const bron = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
      const bin = v.bin === 'global' ? new ZXing.GlobalHistogramBinarizer(bron) : new ZXing.HybridBinarizer(bron);
      const resultaat = lezer.decode(new ZXing.BinaryBitmap(bin));
      if (resultaat) bcGevonden(resultaat.getText());
    } catch (e) { /* niets gevonden in dit beeld: volgende ronde */ }
  }, ms);
}


// Telefoon met meerdere achtercamera's (bv. groothoek, ultragroothoek, tele): wisselt naar de
// volgende lens. Sommige telefoons kiezen standaard een lens die niet goed scherpstelt op
// dichtbij, waardoor een barcode wazig blijft.
async function bcAndereCamera() {
  try {
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    if (cams.length < 2) return;
    const huidig = _bcStream && _bcStream.getVideoTracks()[0] ? (_bcStream.getVideoTracks()[0].getSettings().deviceId || '') : '';
    const idx = cams.findIndex(c => c.deviceId === huidig);
    _bcInst.cam = cams[(idx + 1) % cams.length].deviceId;
    _bcBewaarInst();
  } catch (e) { console.error('bcAndereCamera:', e); return; }
  _bcBezig = false;
  startBarcodeCamera();
}


// ----- Camera-instellingen (coach) -----

function _bcResEis(standaard) {
  const m = { '480': [640, 480], '720': [1280, 720], '1080': [1920, 1080] };
  const k = (_bcInst.res !== 'auto' && m[_bcInst.res]) ? m[_bcInst.res] : (standaard ? [standaard.w, standaard.h] : null);
  return k ? { width: { ideal: k[0] }, height: { ideal: k[1] } } : {};
}
function _bcIntervalMs(standaardMs) {
  const n = parseInt(_bcInst.sps, 10);
  return n > 0 ? Math.round(1000 / n) : standaardMs;
}
function _bcFocusActief(standaard) { return _bcInst.focus === 'on' ? true : (_bcInst.focus === 'off' ? false : standaard); }
function _bcHardActief(standaard) { return _bcInst.hard === 'on' ? true : (_bcInst.hard === 'off' ? false : standaard); }

// Camera-eisen: gekozen resolutie, en de gekozen camera of anders de standaard (achtercamera).
function _bcVideoEis(standaardRes, facing) {
  const eis = _bcResEis(standaardRes);
  if (_bcInst.cam) eis.deviceId = { exact: _bcInst.cam };
  else if (facing) eis.facingMode = facing;
  return eis;
}

// Opent de camera; bestaat de opgeslagen camera niet meer, dan terug naar de standaardcamera.
async function _bcOpenStream(standaardRes, facing) {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: _bcVideoEis(standaardRes, facing), audio: false });
  } catch (e) {
    if (!_bcInst.cam) throw e;
    _bcInst.cam = '';
    _bcBewaarInst();
    return await navigator.mediaDevices.getUserMedia({ video: _bcVideoEis(standaardRes, facing), audio: false });
  }
}

// Toont wat de camera werkelijk levert, zodat je ziet of een instelling echt wordt uitgevoerd.
function _bcToonInfo(video, methode, ms) {
  setTimeout(() => {
    const el = document.getElementById('bc-info');
    if (!el || !video.videoWidth) return;
    el.textContent = t('food.scan.infoLine', {
      method: t('food.scan.m_' + methode), w: video.videoWidth, h: video.videoHeight, sps: Math.round(10000 / ms) / 10
    });
  }, 1500);
}

async function _bcVulCamLijst() {
  try {
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    const knop = document.getElementById('bc-cam-btn');
    if (knop) knop.style.display = cams.length > 1 ? 'inline-block' : 'none';
    const sel = document.getElementById('bci-cam');
    if (sel) {
      sel.innerHTML = '<option value="">' + escapeHtml(t('food.scan.auto') + ' (' + _bcCamAutoTekst() + ')') + '</option>' +
        cams.map((c, i) => '<option value="' + escapeHtml(c.deviceId) + '">' + escapeHtml(c.label || ('Camera ' + (i + 1))) + '</option>').join('');
      sel.value = _bcInst.cam || '';
    }
  } catch (e) { /* geen lijst beschikbaar */ }
}

// Wat "Automatisch" per leesmethode betekent; null = niet gebruikt bij deze lezer.
function _bcAutoWaarden() {
  const aan = t('food.scan.on'), uit = t('food.scan.off'), cont = t('food.scan.focusOn');
  if (_bcMethode === 'native') return { res: '1280×720', sps: '5', focus: cont, hard: null, variants: null };
  if (_bcMethode === 'desktop') return { res: '1920×1080', sps: '8', focus: cont, hard: aan, variants: t('food.scan.varAll') };
  return { res: t('food.scan.camDefault'), sps: '2', focus: uit, hard: uit, variants: null };
}

function _bcCamAutoTekst() { return _bcMethode === 'desktop' ? t('food.scan.camStd') : t('food.scan.camBack'); }

function bcInstVul() {
  const zet = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  zet('bci-res', _bcInst.res);
  zet('bci-sps', _bcInst.sps);
  zet('bci-cam', _bcInst.cam);
  zet('bci-focus', _bcInst.focus);
  zet('bci-hard', _bcInst.hard);
  zet('bci-var', _bcInst.variants);
  // Bij elke "Automatisch" laten zien wat dat voor deze leesmethode is; een instelling
  // die de gebruikte lezer niet kent, staat uit (grijs) met de melding "niet gebruikt".
  const aw = _bcAutoWaarden();
  const autoTekst = (id, w) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const optie = sel.querySelector('option[value="auto"]');
    if (optie) optie.textContent = w === null ? t('food.scan.na') : t('food.scan.auto') + ' (' + w + ')';
    sel.disabled = (w === null);
  };
  autoTekst('bci-res', aw.res);
  autoTekst('bci-sps', aw.sps);
  autoTekst('bci-focus', aw.focus);
  autoTekst('bci-hard', aw.hard);
  const camOptie = document.querySelector('#bci-cam option[value=""]');
  if (camOptie) camOptie.textContent = t('food.scan.auto') + ' (' + _bcCamAutoTekst() + ')';
  const varSel = document.getElementById('bci-var');
  if (varSel) varSel.disabled = (_bcMethode !== 'desktop');
  const rij = document.getElementById('bci-var-row');
  if (rij) rij.style.display = (_bcMethode === 'desktop') ? 'flex' : 'none';
  const lez = document.getElementById('bci-lezer');
  if (lez) lez.textContent = t('food.scan.activeReader', { method: t('food.scan.m_' + _bcMethode) });
}

function bcInstToggle() {
  const p = document.getElementById('bc-inst');
  if (!p) return;
  const open = p.style.display === 'none';
  p.style.display = open ? 'block' : 'none';
  if (open) { bcInstVul(); _bcVulCamLijst().then(bcInstVul); }
}

// Elke wijziging wordt meteen opgeslagen en de camera start opnieuw met de nieuwe instellingen.
function bcInstWijzig() {
  const lees = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  _bcInst.res = lees('bci-res') || 'auto';
  _bcInst.sps = lees('bci-sps') || 'auto';
  _bcInst.cam = lees('bci-cam');
  _bcInst.focus = lees('bci-focus') || 'auto';
  _bcInst.hard = lees('bci-hard') || 'auto';
  _bcInst.variants = lees('bci-var') || 'alle';
  _bcBewaarInst();
  _bcBezig = false;
  startBarcodeCamera();
}

function bcInstReset() {
  _bcInst = Object.assign({}, BC_INST_STANDAARD);
  _bcBewaarInst();
  bcInstVul();
  _bcBezig = false;
  startBarcodeCamera();
}


// ========== GEDEELDE SCANKAART (Mijn dag, Weekplanning en Producten) ==========
// Na een scan (of als de barcode al in PRIME staat) altijd dezelfde kaart: naam en waardes
// per 100 g, hoeveelheid (standaard 100 g), moment en dag, en de keuzes
// Opslaan in mijn producten / Toevoegen aan vandaag / Toevoegen aan weekplanning /
// Opnieuw scannen / Annuleren. Welke knop vooraan staat hangt af van waar je scant.
// Toegevoegd wordt altijd als gepland (niet afgevinkt); afvinken doet de coach zelf.
let _bcBron = 'producten'; // 'vandaag' | 'week' | 'producten'
let _bcBestaand = null;    // product dat al in PRIME staat (gevonden op barcode), anders null

function openBarcodeScanner(bron) {
  if (!isPrimeCoach()) return;
  _bcBron = (bron === 'vandaag' || bron === 'week') ? bron : 'producten';
  _bcModus = 'dag';
  _bcBezig = false;
  _bcProduct = null;
  _bcBestaand = null;
  document.getElementById('bc-result').style.display = 'none';
  document.getElementById('bc-view').style.display = 'block';
  document.getElementById('bc-manual').value = '';
  document.getElementById('barcode-modal').classList.add('open');
  startBarcodeCamera();
}

// "Mijn dag": de dag die nu open staat (meestal vandaag).
function scanEtenVandaag() {
  if (!isPrimeCoach()) return;
  _bcVorigeDatum = null;
  _portionReturnTab = 'log';
  openBarcodeScanner('vandaag');
}

// Weekplanning: de gekozen dag staat als voorinstelling op de kaart.
function scanEtenVoorDag(dateStr) {
  if (!isPrimeCoach()) return;
  _bcVorigeDatum = currentLogDate;
  _portionReturnTab = 'week';
  switchLogDate(dateStr);
  openBarcodeScanner('week');
}

async function bcZoek(code) {
  const view = document.getElementById('bc-view');
  _bcStatus(t('food.scan.lookup'));
  const bestaand = getAllProducts().find(p => p.barcode && _bcNorm(p.barcode) === _bcNorm(code));
  if (bestaand) {
    view.style.display = 'none';
    _bcBestaand = bestaand;
    _bcProduct = { code: code, naam: dispName(bestaand), cat: bestaand.cat, kcal: bestaand.kcal, prot: bestaand.prot, carb: bestaand.carb, fat: bestaand.fat };
    bcToonKaart();
    return;
  }

  let product = null;
  let netFout = false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch('https://world.openfoodfacts.org/api/v2/product/' + code + '.json?fields=product_name,product_name_nl,brands,nutriments,categories_tags', { signal: ctrl.signal });
    clearTimeout(timer);
    const j = await r.json();
    if (j && j.status === 1 && j.product) product = j.product;
  } catch (e) {
    console.error('bcZoek:', e);
    netFout = true;
  }

  view.style.display = 'none';
  _bcBestaand = null;
  if (!product) {
    // Niet herkend: opnieuw scannen, handmatig invoeren of annuleren.
    _bcProduct = { code: code, leeg: true };
    const res = document.getElementById('bc-result');
    res.style.display = 'block';
    res.innerHTML =
      '<div style="font-size:13px;color:var(--charcoal);margin-bottom:14px">' + escapeHtml(netFout ? t('food.scan.netError') : t('food.scan.notFound', { code: code })) + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<button class="btn-primary coach-only-btn" style="margin-bottom:0" onclick="bcOpnieuw()">' + t('food.scan.again') + '</button>' +
        '<button class="btn-sm" onclick="bcActieHandmatig()">' + t('food.scan.manualEntry') + '</button>' +
        '<button class="btn-sm" onclick="closeBarcodeScanner()">' + t('food.addMeal.cancel') + '</button>' +
      '</div>';
    return;
  }

  const n = product.nutriments || {};
  const getal = (v) => (v === undefined || v === null || v === '' || isNaN(Number(v))) ? null : Math.round(Number(v) * 10) / 10;
  let kcal = getal(n['energy-kcal_100g']);
  if (kcal === null && getal(n['energy_100g']) !== null) kcal = Math.round(getal(n['energy_100g']) / 4.184);
  const prot = getal(n['proteins_100g']);
  const carb = getal(n['carbohydrates_100g']);
  const fat = getal(n['fat_100g']);
  let naam = (product.product_name_nl || product.product_name || '').trim();
  const merk = ((product.brands || '').split(',')[0] || '').trim();
  if (merk && naam.toLowerCase().indexOf(merk.toLowerCase()) === -1) naam = (merk + ' ' + naam).trim();
  const ontbreekt = [];
  if (prot === null) ontbreekt.push(t('portion.protein'));
  if (carb === null) ontbreekt.push(t('portion.carbs'));
  if (fat === null) ontbreekt.push(t('portion.fat'));
  _bcProduct = { code: code, naam: naam, cat: _bcCategorie(product.categories_tags), kcal: kcal, prot: prot, carb: carb, fat: fat, ontbreekt: ontbreekt };
  bcToonKaart();
}

function bcToonKaart() {
  const p = _bcProduct;
  const bestaand = _bcBestaand;
  const res = document.getElementById('bc-result');
  res.style.display = 'block';

  const veld = (id, label, waarde, stap, oninput) => '<div style="text-align:center"><div style="font-size:10px;color:var(--muted);margin-bottom:2px">' + label + '</div><input type="number" id="' + id + '" min="0" step="' + stap + '" value="' + (waarde === null || waarde === undefined ? '' : waarde) + '" oninput="' + oninput + '" style="width:100%;box-sizing:border-box;padding:8px 4px;border:1.5px solid var(--sand-dark);border-radius:8px;font-size:14px;text-align:center;font-family:inherit"></div>';
  const vast = (label, waarde) => '<div style="background:var(--sand);border-radius:8px;padding:8px 4px;text-align:center"><div style="font-size:10px;color:var(--muted)">' + label + '</div><div style="font-size:14px;font-weight:600">' + waarde + '</div></div>';
  const wb = (x, eenheid) => (x === undefined || x === null ? '—' : x + eenheid);

  let waardenHtml;
  if (bestaand) {
    waardenHtml = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:6px">' +
      vast(t('portion.kcal'), wb(p.kcal, '')) + vast(t('portion.protein'), wb(p.prot, ' g')) + vast(t('portion.carbs'), wb(p.carb, ' g')) + vast(t('portion.fat'), wb(p.fat, ' g')) + '</div>';
  } else {
    waardenHtml = '<div style="margin-bottom:8px"><div style="font-size:10px;color:var(--muted);margin-bottom:2px">' + t('food.scan.name') + '</div><input type="text" id="bc-e-naam" value="' + escapeHtml(p.naam || '') + '" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--sand-dark);border-radius:8px;font-size:15px;font-family:inherit"></div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:6px">' +
      veld('bc-e-kcal', t('portion.kcal'), p.kcal, 1, 'bcKaartRekenen()') +
      veld('bc-e-prot', t('portion.protein'), p.prot, 0.1, 'bcMacroInput()') +
      veld('bc-e-carb', t('portion.carbs'), p.carb, 0.1, 'bcMacroInput()') +
      veld('bc-e-fat', t('portion.fat'), p.fat, 0.1, 'bcMacroInput()') + '</div>';
  }

  const momenten = ['ontbijt', 'tussendoorOchtend', 'lunch', 'tussendoorMiddag', 'avond', 'tussendoorAvond'];
  const standaardDatum = _bcBron === 'week' ? currentLogDate : fdTodayStr();
  const stijlInvoer = 'padding:9px 10px;border:1.5px solid var(--sand-dark);border-radius:8px;font-size:14px;font-family:inherit;background:var(--white);box-sizing:border-box';

  // Welke actie vooraan staat, hangt af van waar je scant.
  const knop = (fn, tekst, primair) => primair
    ? '<button class="btn-primary coach-only-btn" style="margin-bottom:0" onclick="' + fn + '">' + tekst + '</button>'
    : '<button class="btn-sm coach-only-btn" onclick="' + fn + '">' + tekst + '</button>';
  const voorkeur = (_bcBron === 'producten' && !bestaand) ? 'opslaan' : (_bcBron === 'week' ? 'week' : (_bcBron === 'producten' ? 'vandaag' : 'vandaag'));
  const acties = [];
  if (!bestaand) acties.push(['opslaan', knop('bcActieOpslaan()', t('food.scan.saveMine'), voorkeur === 'opslaan')]);
  acties.push(['vandaag', knop("bcActieToevoegen('vandaag')", t('food.scan.addToday'), voorkeur === 'vandaag')]);
  acties.push(['week', knop("bcActieToevoegen('week')", t('food.scan.addWeek'), voorkeur === 'week')]);
  acties.sort((a, b) => (a[0] === voorkeur ? -1 : 0) - (b[0] === voorkeur ? -1 : 0));

  res.innerHTML =
    '<div style="font-size:11px;color:var(--muted);margin-bottom:4px">' + escapeHtml(bestaand ? t('food.scan.existsShort') : t('food.scan.found')) + ' · ' + escapeHtml(p.code) + '</div>' +
    (bestaand ? '<div style="font-family:\'DM Serif Display\',serif;font-size:19px;margin-bottom:10px">' + escapeHtml(dispName(bestaand)) + '</div>' : '') +
    waardenHtml +
    '<div style="font-size:11px;color:var(--muted);margin-bottom:10px">' + t('food.scan.per100') + '</div>' +
    ((!bestaand && p.ontbreekt && p.ontbreekt.length) ? '<div style="font-size:12px;color:var(--accent);font-weight:600;margin-bottom:6px">' + t('food.scan.missing', { list: p.ontbreekt.join(', ') }) + '</div>' : '') +
    (!bestaand ? '<div style="font-size:12px;color:var(--coach-only);background:var(--coach-only-light);border-radius:8px;padding:8px 10px;margin-bottom:12px">' + t('food.scan.unverified') + '</div>' : '') +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">' +
      '<label style="font-size:11px;color:var(--muted)">' + t('food.scan.gram') + '<input type="number" id="bc-gram" min="1" step="1" value="100" oninput="bcKaartRekenen()" style="width:100%;' + stijlInvoer + '"></label>' +
      '<label style="font-size:11px;color:var(--muted)">' + t('food.scan.moment') + '<select id="bc-moment" style="width:100%;' + stijlInvoer + '">' + momenten.map(m => '<option value="' + m + '">' + t('moment.' + m) + '</option>').join('') + '</select></label>' +
    '</div>' +
    '<label style="display:block;font-size:11px;color:var(--muted);margin-bottom:8px">' + t('food.scan.day') + '<input type="date" id="bc-datum" value="' + standaardDatum + '" style="width:100%;' + stijlInvoer + '"></label>' +
    '<div id="bc-prev" style="font-size:12px;font-weight:600;color:var(--charcoal);margin-bottom:12px"></div>' +
    (!bestaand ? '<div style="font-size:12px;font-weight:600;color:var(--charcoal);margin-bottom:6px">' + t('food.scan.saveTitle') + '</div><div id="bc-bewaar-groep" style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;padding:4px 0">' +
      [['eigen', t('food.scan.saveOwn')], ['iedereen', t('food.scan.saveAll')], ['nee', t('food.scan.saveNo')]].map(x => '<label style="display:flex;gap:8px;align-items:center;font-size:13px;color:var(--charcoal);cursor:pointer"><input type="radio" name="bc-bewaar" value="' + x[0] + '"><span>' + x[1] + '</span></label>').join('') + '</div>' : '') +
    '<div id="bc-kaart-fout" style="color:#c0392b;font-size:12px;margin-bottom:8px"></div>' +
    '<div style="display:flex;flex-direction:column;gap:8px">' +
      acties.map(a => a[1]).join('') +
      '<button class="btn-sm" onclick="bcOpnieuw()">' + t('food.scan.again') + '</button>' +
      (bestaand ? '<button class="btn-sm coach-only-btn" onclick="bcBewerkBestaand()">✏️ ' + t('common.edit') + '</button>' : '') +
      '<button class="btn-sm" onclick="closeBarcodeScanner()">' + t('food.addMeal.cancel') + '</button>' +
    '</div>';
  bcKaartRekenen();
}

// Eiwit, koolhydraten of vet gewijzigd: kcal opnieuw uitrekenen (4/4/9), daarna de totalen.
function bcMacroInput() {
  const g = id => parseFloat(document.getElementById(id).value) || 0;
  document.getElementById('bc-e-kcal').value = Math.round(g('bc-e-prot') * 4 + g('bc-e-carb') * 4 + g('bc-e-fat') * 9);
  bcKaartRekenen();
}

// Toont wat de gekozen hoeveelheid oplevert.
function bcKaartRekenen() {
  const el = document.getElementById('bc-prev');
  if (!el) return;
  const gram = parseFloat(document.getElementById('bc-gram').value) || 0;
  let w;
  if (_bcBestaand) w = { kcal: _bcBestaand.kcal, prot: _bcBestaand.prot, carb: _bcBestaand.carb, fat: _bcBestaand.fat };
  else {
    const g = id => parseFloat(document.getElementById(id).value) || 0;
    w = { kcal: g('bc-e-kcal'), prot: g('bc-e-prot'), carb: g('bc-e-carb'), fat: g('bc-e-fat') };
  }
  const f = gram / 100;
  el.textContent = '= ' + Math.round((w.kcal || 0) * f) + ' kcal · ' + t('portion.protein') + ' ' + (Math.round((w.prot || 0) * f * 10) / 10) +
    ' g · ' + t('portion.carbs') + ' ' + (Math.round((w.carb || 0) * f * 10) / 10) + ' g · ' + t('portion.fat') + ' ' + (Math.round((w.fat || 0) * f * 10) / 10) + ' g';
}

// Leest de kaart; geeft null (met een melding op de kaart) als er iets ontbreekt.
function _bcKaartLees(metGram) {
  const fout = document.getElementById('bc-kaart-fout');
  if (fout) fout.textContent = '';
  let p = _bcProduct;
  if (!_bcBestaand) {
    const g = id => { const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? 0 : Math.round(v * 10) / 10; };
    p = Object.assign({}, _bcProduct, {
      naam: document.getElementById('bc-e-naam').value.trim(),
      kcal: Math.round(g('bc-e-kcal')), prot: g('bc-e-prot'), carb: g('bc-e-carb'), fat: g('bc-e-fat')
    });
    if (!p.naam) { if (fout) fout.textContent = t('food.add.nameRequired'); return null; }
  }
  let gram = 0, moment = '', datum = '';
  if (metGram) {
    gram = parseFloat(document.getElementById('bc-gram').value);
    if (!(gram > 0)) { if (fout) fout.textContent = t('food.scan.gramInvalid'); return null; }
    moment = document.getElementById('bc-moment').value;
    datum = document.getElementById('bc-datum').value;
  }
  const keuzeEl = document.querySelector('input[name="bc-bewaar"]:checked');
  return { p: p, gram: gram, moment: moment, datum: datum, keuze: keuzeEl ? keuzeEl.value : null };
}

// Maakt van het gescande product een product volgens de keuze: eigen, voor iedereen of niet
// bewaren (dan alleen een tijdelijk product voor het loggen). Geeft het product terug, of null.
async function bcMaakProduct(p, keuze) {
  const basis = (p.naam || '').trim() || ('Product ' + p.code);
  let naam = basis;
  let teller = 2;
  while (productNaamBestaat(naam, null)) { naam = basis + ' (' + teller + ')'; teller++; }
  const prot = p.prot === null || p.prot === undefined ? 0 : p.prot;
  const carb = p.carb === null || p.carb === undefined ? 0 : p.carb;
  const fat = p.fat === null || p.fat === undefined ? 0 : p.fat;
  const kcal = (p.kcal !== null && p.kcal !== undefined) ? p.kcal : Math.round(prot * 4 + carb * 4 + fat * 9);
  const cat = p.cat || 'overig';

  if (keuze === 'nee') {
    return { id: 'scan-' + Date.now(), icon: '🍽️', name: naam, cat: cat, kcal: kcal, prot: prot, carb: carb, fat: fat, _tijdelijk: true };
  }
  if (keuze === 'iedereen') {
    const rij = {
      id: 'prime-' + Date.now() + Math.floor(Math.random() * 1000), op: 'new',
      icon: '🍽️', name: naam, cat: cat, kcal: kcal, prot: prot, carb: carb, fat: fat, photo: null, barcode: p.code
    };
    const fout = await savePrimeProductToCloud(rij);
    if (fout) {
      try { showToast(t('food.prime.saveFailed'), true); } catch (e) { console.error(e); }
      return null;
    }
    primeProducts = primeProducts.concat([rij]);
    _bewaarPrimeProductenLokaal();
    applyPrimeProducts();
    return PRODUCTS.find(x => x.id === rij.id) || rij;
  }
  const nieuw = {
    id: 'custom-' + Date.now() + Math.floor(Math.random() * 1000),
    icon: '🍽️', custom: true, barcode: p.code,
    name: naam, cat: cat, kcal: kcal, prot: prot, carb: carb, fat: fat, photo: null
  };
  customProducts.push(nieuw);
  syncSet('prime_custom_products', customProducts);
  try { renderAddProductTab(); } catch (e) { console.error(e); }
  return nieuw;
}

// Zet een product als gepland (niet afgevinkt) in de lijst van een dag.
function bcLogItem(product, gram, moment, dateStr) {
  const f = gram / 100;
  const item = {
    logId: newLogId(),
    productId: product.id,
    name: dispName(product),
    icon: product.icon,
    moment: moment,
    gram: gram,
    kcal: Math.round(product.kcal * f),
    prot: Math.round(product.prot * f * 10) / 10,
    carb: Math.round(product.carb * f * 10) / 10,
    fat: Math.round(product.fat * f * 10) / 10,
    type: 'product',
    eaten: false
  };
  if (dateStr === currentLogDate) {
    dayLog.push(item);
    foodDays[currentLogDate] = dayLog;
  } else {
    foodDays[dateStr] = [...(foodDays[dateStr] || []), item];
  }
  syncSet('prime_food_days', foodDays);
  updateMacroTotals();
  updateLogBadge();
  renderDayLog();
  if (document.getElementById('foodweek-content')) renderFoodWeek();
}

// Scanner sluiten na een geslaagde actie en terug naar het scherm waar je was.
function bcKlaar() {
  const bron = _bcBron;
  stopBarcodeCamera();
  document.getElementById('barcode-modal').classList.remove('open');
  _portionReturnTab = null;
  _bcVorigeDatum = null;
  if (bron === 'week') switchFoodTab('week');
  else if (bron === 'vandaag') switchFoodTab('log');
  else { try { renderAddProductTab(); renderProducts(); } catch (e) { console.error(e); } }
}

async function bcActieToevoegen(doel) {
  const k = _bcKaartLees(true);
  if (!k) return;
  const fout = document.getElementById('bc-kaart-fout');
  const datum = doel === 'vandaag' ? fdTodayStr() : k.datum;
  if (!datum) { if (fout) fout.textContent = t('food.scan.dayRequired'); return; }
  if (isDagAfgesloten(datum)) { alert(t('weekplan.dayLocked')); return; }
  if (!_bcBestaand && !k.keuze) {
    // Een nieuw product wordt nooit vanzelf opgeslagen: de coach kiest eerst wat ermee gebeurt.
    if (fout) fout.textContent = t('food.scan.chooseSave');
    const groep = document.getElementById('bc-bewaar-groep');
    if (groep) groep.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const product = _bcBestaand || await bcMaakProduct(k.p, k.keuze);
  if (!product) return;
  bcLogItem(product, k.gram, k.moment, datum);
  bcKlaar();
  try { showToast(t('food.scan.addedTo', { date: formatPickerDateLabel(datum) })); } catch (e) { console.error(e); }
}

// Opslaan in mijn producten: opent het formulier (met categorie en foto), ingevuld met de
// gescande gegevens. De keuze eigen/voor iedereen bepaalt het vinkje in dat formulier.
function bcActieOpslaan() {
  const k = _bcKaartLees(false);
  if (!k) return;
  closeBarcodeScanner();
  switchFoodTab('add');
  openAddProductForm();
  _apBarcode = k.p.code || null;
  document.getElementById('ap-name').value = k.p.naam || '';
  document.getElementById('ap-cat').value = k.p.cat || 'overig';
  document.getElementById('ap-prot').value = k.p.prot === null ? 0 : k.p.prot;
  document.getElementById('ap-carb').value = k.p.carb === null ? 0 : k.p.carb;
  document.getElementById('ap-fat').value = k.p.fat === null ? 0 : k.p.fat;
  const deel = document.getElementById('ap-share');
  if (deel) deel.checked = (k.keuze === 'iedereen');
  updateAddProductKcal();
  updateApShareRow();
  apNaamInput();
  try { showToast(t('food.scan.filled')); } catch (e) { console.error(e); }
}

// Niet herkend: handmatig invoeren in een leeg formulier, met de barcode al bewaard.
function bcActieHandmatig() {
  const code = _bcProduct && _bcProduct.code;
  closeBarcodeScanner();
  switchFoodTab('add');
  openAddProductForm();
  _apBarcode = code || null;
}
