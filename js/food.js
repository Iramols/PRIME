// ========== FOOD TAB SWITCHING ==========
function switchFoodTab(tab) {
  ['plan','basis','log'].forEach(t => {
    document.getElementById('foodtab-' + t).style.display = t === tab ? 'block' : 'none';
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
  if (tab === 'basis') renderProducts();
  if (tab === 'log') renderDayLog();
}

// ========== FOOD RENDER (meal plan tab) ==========
function renderFood() {
  document.getElementById('no-checkin-food').style.display = 'none';
  document.getElementById('food-content').style.display = 'block';
  selectedMeals = {};
  dayLog = dayLog.filter(i => i.type !== 'meal'); // reset meal entries, keep product logs
  const data = MEALS[trainingType];
  document.getElementById('food-subtitle').textContent = {
    herstel:'Hersteldag — licht & eiwitrijk',
    normaal:'Normale dag — gebalanceerd',
    zwaar:'Zware trainingsdag — energie geladen'
  }[trainingType];

  for (const key of ['ontbijt','lunch','avond','snack']) {
    const rec = data[key].find(m => m.rec);
    if (rec) {
      selectedMeals[rec.id] = rec;
      dayLog.push({
        logId: 'meal-' + rec.id,
        name: rec.name,
        icon: rec.icon,
        photo: rec.photo || null,
        moment: key,
        gram: null,
        kcal: rec.kcal,
        prot: rec.prot,
        carb: rec.carb,
        fat:  rec.fat,
        type: 'meal'
      });
    }
  }
  renderMealPlan();
  updateMacroTotals();
}

function renderMealPlan() {
  const data = MEALS[trainingType];
  const mealNames = { ontbijt:'Ontbijt', lunch:'Lunch', avond:'Avondeten', snack:'Snack' };
  const mealIcons = { ontbijt:'🌅', lunch:'🥗', avond:'🍽️', snack:'🍎' };
  let html = '';
  for (const key of ['ontbijt','lunch','avond','snack']) {
    const items = data[key];
    html += `<div class="meal-block">
      <div class="meal-label">${mealIcons[key]} ${mealNames[key]}</div>
      <div class="meal-cards">
        ${items.map(m => `
          <div class="meal-card ${m.rec?'recommended':''} ${selectedMeals[m.id]?'selected':''}"
               id="mcard-${m.id}" onclick="toggleMeal('${m.id}','${key}')">
            <div class="meal-sel-indicator" id="msel-${m.id}">${selectedMeals[m.id]?'✓':'+'}</div>
            ${m.photo ? `<div class="meal-photo" style="background-image:url('${m.photo}')"></div>` : `<div class="meal-emoji">${m.icon}</div>`}
            <div class="meal-name">${m.name}</div>
            <div class="meal-macros">
              <span class="macro-pill">E: ${m.prot}g</span>
              <span class="macro-pill">K: ${m.carb}g</span>
              <span class="macro-pill">V: ${m.fat}g</span>
            </div>
            <div class="meal-kcal">${m.kcal} kcal</div>
          </div>`).join('')}
      </div>
    </div>`;
  }
  document.getElementById('meal-plan').innerHTML = html;
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
      name: item.name,
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
  let list = PRODUCTS;
  if (currentCat !== 'alle') list = list.filter(p => p.cat === currentCat);
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q));
  document.getElementById('product-grid').innerHTML = `<div class="product-grid">` +
    list.map(p => `
      <div class="product-card" onclick="openPortionModal('${p.id}')">
        ${p.photo ? `<div class="product-photo" style="background-image:url('${p.photo}')"></div>` : `<div class="product-icon">${p.icon}</div>`}
        <div class="product-name">${p.name}</div>
        <div class="product-per">per 100g</div>
        <div class="product-macros">
          <span class="product-pill">${p.kcal} kcal</span>
          <span class="product-pill">E${p.prot}g</span>
        </div>
      </div>`).join('') + `</div>`;
}

// ========== PORTION MODAL ==========
function openPortionModal(productId) {
  currentPortionProduct = PRODUCTS.find(p => p.id === productId);
  if (!currentPortionProduct) return;
  const p = currentPortionProduct;
  document.getElementById('pm-name').textContent = p.icon + ' ' + p.name;
  document.getElementById('pm-per100').textContent = `per 100g: ${p.kcal} kcal · ${p.prot}g eiwit · ${p.carb}g koolh · ${p.fat}g vet`;
  document.getElementById('pm-gram').value = 100;
  // reset moment
  currentMoment = 'ontbijt';
  document.querySelectorAll('.moment-btn').forEach((b,i) => b.classList.toggle('active', i===0));
  updatePortionPreview();
  document.getElementById('portion-modal').classList.add('open');
}

function closePortionModal() {
  document.getElementById('portion-modal').classList.remove('open');
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
  dayLog.push({
    logId: ++logIdCounter,
    name: p.name,
    icon: p.icon,
    photo: p.photo || null,
    moment: currentMoment,
    gram,
    kcal: Math.round(p.kcal * f),
    prot: Math.round(p.prot * f * 10) / 10,
    carb: Math.round(p.carb * f * 10) / 10,
    fat:  Math.round(p.fat  * f * 10) / 10,
    type: 'product'
  });
  closePortionModal();
  updateMacroTotals();
  updateLogBadge();
}

function removeFromLog(logId) {
  dayLog = dayLog.filter(i => i.logId !== logId);
  renderDayLog();
  updateMacroTotals();
  updateLogBadge();
}

function updateLogBadge() {
  const badge = document.getElementById('log-count-badge');
  const count = dayLog.length;
  badge.style.display = count > 0 ? 'inline' : 'none';
  badge.textContent = count;
}

function renderDayLog() {
  const momentLabels = { ontbijt:'Ontbijt', lunch:'Lunch', avond:'Avond', snack:'Snack' };
  const momentOrder = { ontbijt:0, lunch:1, avond:2, snack:3 };
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

  const sorted = [...dayLog].sort((a,b) => momentOrder[a.moment] - momentOrder[b.moment]);

  // Groepeer per moment
  const grouped = {};
  sorted.forEach(item => {
    if (!grouped[item.moment]) grouped[item.moment] = [];
    grouped[item.moment].push(item);
  });

  list.innerHTML = Object.entries(grouped)
    .sort((a,b) => momentOrder[a[0]] - momentOrder[b[0]])
    .map(([moment, items]) => `
      <div style="margin-bottom:18px">
        <div style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:10px">${momentLabels[moment]}</div>
        ${items.map(item => `
          <div class="card" style="margin-bottom:10px;padding:0;overflow:hidden;display:flex;align-items:stretch">
            ${item.photo
              ? `<div style="width:80px;min-height:75px;background-image:url('${item.photo}');background-size:cover;background-position:center;flex-shrink:0;border-radius:var(--radius-sm) 0 0 var(--radius-sm)"></div>`
              : `<div style="width:80px;min-height:75px;display:flex;align-items:center;justify-content:center;font-size:26px;background:var(--sand);flex-shrink:0">${item.icon}</div>`}
            <div style="flex:1;padding:10px 14px;display:flex;align-items:center;gap:10px">
              <div style="flex:1">
                <div style="font-weight:600;font-size:13px;margin-bottom:2px">${item.name}</div>
                <div style="font-size:11px;color:var(--muted)">
                  ${item.type === 'meal' ? '★ maaltijd' : item.gram + 'g'} · ${item.kcal} kcal
                </div>
                <div style="font-size:11px;color:var(--muted)">E:${Math.round(item.prot)}g K:${Math.round(item.carb)}g V:${Math.round(item.fat)}g</div>
              </div>
              <button onclick="${item.type==='meal' ? `toggleMeal('${item.logId.replace('meal-','')}','${item.moment}')` : `removeFromLog(${item.logId})`}"
                style="font-size:16px;padding:4px 8px;border:none;background:none;color:var(--muted);cursor:pointer;flex-shrink:0">×</button>
            </div>
          </div>`).join('')}
      </div>`).join('');

  const tot = dayLog.reduce((a,i) => ({ kcal:a.kcal+i.kcal, prot:a.prot+i.prot, carb:a.carb+i.carb, fat:a.fat+i.fat }), {kcal:0,prot:0,carb:0,fat:0});
  document.getElementById('log-summary').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;text-align:center">
      <div style="background:var(--sand);border-radius:10px;padding:12px">
        <div style="font-family:'DM Serif Display',serif;font-size:20px">${Math.round(tot.kcal)}</div>
        <div style="font-size:11px;color:var(--muted)">kcal</div>
      </div>
      <div style="background:var(--sand);border-radius:10px;padding:12px">
        <div style="font-family:'DM Serif Display',serif;font-size:20px;color:var(--accent)">${Math.round(tot.prot*10)/10}g</div>
        <div style="font-size:11px;color:var(--muted)">eiwit</div>
      </div>
      <div style="background:var(--sand);border-radius:10px;padding:12px">
        <div style="font-family:'DM Serif Display',serif;font-size:20px;color:#5a7cc8">${Math.round(tot.carb*10)/10}g</div>
        <div style="font-size:11px;color:var(--muted)">koolh</div>
      </div>
      <div style="background:var(--sand);border-radius:10px;padding:12px">
        <div style="font-family:'DM Serif Display',serif;font-size:20px;color:#c8a85a">${Math.round(tot.fat*10)/10}g</div>
        <div style="font-size:11px;color:var(--muted)">vet</div>
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
    { label:'Calorieën', val:Math.round(tot.kcal), doel:doel.kcal, unit:'kcal', color:'#4CAF50' },
    { label:'Koolhydraten', val:Math.round(tot.carb), doel:doel.carb, unit:'g.', color:'#E91E8C' },
    { label:'Eiwitten', val:Math.round(tot.prot), doel:doel.prot, unit:'g.', color:'#2196F3' },
    { label:'Vetten', val:Math.round(tot.fat), doel:doel.fat, unit:'g.', color:'#FF5722' },
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
          <div style="font-size:10px;color:var(--muted)">Doel: ${rmin}–${rmax} ${m.unit}</div>
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
    document.getElementById(m.doelId).textContent = `Doel: ${r.min} – ${r.max} ${m.unit}`;
  });

  // Count label onder tabs
  const totalItems = dayLog.length;
  const el = document.getElementById('meal-count');
  if (el) el.textContent = totalItems > 0
    ? `${totalItems} item${totalItems>1?'s':''} gelogd · totaal ${tot.kcal} kcal`
    : 'Klik op een maaltijd om hem toe te voegen';

  // Herbereken voedingssamenvatting in checkout live
  if (document.getElementById('day-section') && document.getElementById('day-section').style.display !== 'none') {
    buildFoodSummary();
  }

  // Update dashboard preview
  updateHomeMacros();
}

