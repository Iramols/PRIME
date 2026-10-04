// ========== PROFILE ==========
// ========== FEEDBACK + PRIVACY ==========
let _fbKind = 'bug';
function pickFeedbackKind(k) {
  _fbKind = k;
  document.querySelectorAll('#fb-kinds .fb-kind').forEach(b => b.classList.toggle('active', b.dataset.kind === k));
}
function openFeedback() {
  pickFeedbackKind('bug');
  document.getElementById('fb-message').value = '';
  document.getElementById('fb-error').textContent = '';
  document.getElementById('fb-send').disabled = false;
  document.getElementById('feedback-modal').classList.add('open');
}
function closeFeedback() { document.getElementById('feedback-modal').classList.remove('open'); }
async function submitFeedback() {
  const msg = document.getElementById('fb-message').value.trim();
  const err = document.getElementById('fb-error');
  if (!msg) { err.textContent = t('feedback.empty'); return; }
  err.textContent = '';
  const btn = document.getElementById('fb-send');
  btn.disabled = true;
  const res = await sendFeedback(_fbKind, msg);
  if (res.error) {
    console.error('sendFeedback:', res.error);
    err.textContent = t('feedback.failed');
    btn.disabled = false;
    return;
  }
  closeFeedback();
  try { showToast(t('feedback.sent')); } catch (e) {}
}
async function requestDataDeletion() {
  if (!confirm(t('profile.privacy.deleteConfirm'))) return;
  const res = await sendFeedback('delete_request', t('profile.privacy.deleteMsg'));
  if (res.error) { console.error('requestDataDeletion:', res.error); alert(t('feedback.failed')); return; }
  try { showToast(t('profile.privacy.deleteSent')); } catch (e) {}
}

function openProfile() {
  document.getElementById('p-name').value = profile.name || '';
  document.getElementById('p-age').value = profile.age || '';
  document.getElementById('p-weight').value = profile.weight || '';
  document.getElementById('p-height').value = profile.height || '';
  document.getElementById('p-gender').value = profile.gender || 'v';
  document.getElementById('p-goal').value = profile.goal || '';
  document.getElementById('p-activity').value = profile.activity || 1.375;
  document.getElementById('p-calorie-need').value = profile.calorieBehoefte || '';
  document.getElementById('p-calorie-min').value = profile.calorieMin || '';
  document.getElementById('p-calorie-max').value = profile.calorieMax || '';
  document.getElementById('p-protein-per-kg').value = profile.proteinPerKg || '';
  const cpStart = (typeof profile.carbPct === 'number') ? profile.carbPct : 60;
  document.getElementById('p-carb-pct').value = cpStart;
  document.getElementById('p-fat-pct').value = 100 - cpStart;
  document.getElementById('p-training-enabled').checked = profile.trainingEnabled !== false;
  updateMacroPreview();
  document.getElementById('profile-modal').classList.add('open');
}
// Profielvelden -> tijdelijk profielobject voor berekenDagDoel() (data.js).
// Lege velden vallen daar terug op de standaardwaarden (2 g/kg en 60/40).
// Koolhydraten % uit de twee gekoppelde velden: null = leeg (standaard 60/40),
// 'ongeldig' = geen getal tussen 0 en 100. Staat alleen vet ingevuld, dan is
// koolhydraten de rest.
function _carbPctUitVelden() {
  const kRaw = document.getElementById('p-carb-pct').value, vRaw = document.getElementById('p-fat-pct').value;
  const geldig = x => x !== '' && !isNaN(+x) && +x >= 0 && +x <= 100;
  if (kRaw !== '') return geldig(kRaw) ? Math.round(+kRaw) : 'ongeldig';
  if (vRaw !== '') return geldig(vRaw) ? 100 - Math.round(+vRaw) : 'ongeldig';
  return null;
}
// Typ je in het ene veld, dan vult het andere zichzelf aan tot 100. Bij
// loslaten (definitief) worden decimalen afgerond op hele getallen.
function syncKoolhVet(bron, definitief) {
  const kEl = document.getElementById('p-carb-pct'), vEl = document.getElementById('p-fat-pct');
  const bronEl = bron === 'k' ? kEl : vEl, anderEl = bron === 'k' ? vEl : kEl;
  const raw = bronEl.value;
  if (raw !== '' && !isNaN(+raw) && +raw >= 0 && +raw <= 100) {
    if (definitief) bronEl.value = Math.round(+raw);
    anderEl.value = 100 - Math.round(+raw);
  }
  updateMacroPreview();
}

function _profielMacroInvoer() {
  const num = id => { const v = document.getElementById(id).value; return v === '' ? null : +v; };
  return {
    calorieBehoefte: num('p-calorie-need'),
    weight: num('p-weight'),
    proteinPerKg: num('p-protein-per-kg'),
    carbPct: (function() { const c = _carbPctUitVelden(); return c === 'ongeldig' ? null : c; })()
  };
}

// Live voorbeeld van het dagdoel onder de eiwit- en verdelingsvelden.
function updateMacroPreview() {
  const p = _profielMacroInvoer();
  const d = berekenDagDoel(p);
  const pct = d.carbPct;
  const gew = p.weight > 0 ? p.weight : 70;
  document.getElementById('p-protein-hint').textContent = t('profile.protein.hint', { kg: gew, g: Math.round(gew * d.perKg) });
  const eK = d.prot * 4, kK = d.carb * 4, vK = d.fat * 9, tot = Math.max(1, eK + kK + vK);
  document.getElementById('pm-kcal').textContent = d.kcal;
  document.getElementById('pm-e').textContent = d.prot + ' g';
  document.getElementById('pm-k').textContent = d.carb + ' g';
  document.getElementById('pm-v').textContent = d.fat + ' g';
  document.getElementById('pm-ep').textContent = Math.round(eK / tot * 100) + '%';
  document.getElementById('pm-kp').textContent = Math.round(kK / tot * 100) + '%';
  document.getElementById('pm-vp').textContent = Math.round(vK / tot * 100) + '%';
  // Cirkeldiagram: elk deel is een stuk van de omtrek (dasharray/dashoffset).
  const omtrek = 2 * Math.PI * 46;
  const seg = (id, start, frac) => { const el = document.getElementById(id); el.setAttribute('stroke-dasharray', Math.max(0, frac * omtrek) + ' ' + omtrek); el.setAttribute('stroke-dashoffset', -start * omtrek); };
  const fE = eK / tot, fK = kK / tot, fV = vK / tot;
  seg('pm-seg-e', 0, fE); seg('pm-seg-k', fE, fK); seg('pm-seg-v', fE + fK, fV);
  document.getElementById('pm-donut').setAttribute('aria-label', t('profile.macro.goalTitle') + ': ' + d.kcal + ' kcal');
  document.getElementById('pm-err').style.display = d.proteinTeHoog ? 'block' : 'none';
  document.getElementById('pm-warn').style.display = (!d.proteinTeHoog && d.proteinHoog) ? 'block' : 'none';
}

function closeProfile() { document.getElementById('profile-modal').classList.remove('open'); }
function saveProfile() {
  const calorieMin = document.getElementById('p-calorie-min').value ? +document.getElementById('p-calorie-min').value : null;
  const calorieMax = document.getElementById('p-calorie-max').value ? +document.getElementById('p-calorie-max').value : null;
  if (calorieMin && calorieMax && calorieMin > calorieMax) {
    try { showToast(t('profile.calorieRange.invalid'), true); } catch (e) {}
    return;
  }
  // Eiwit per kg: leeg = standaard (2). Daarbuiten 0,8-4 g/kg, en het eiwit mag
  // niet meer calorieën zijn dan het dagdoel zelf (dan past de verdeling niet).
  const eiwitRaw = document.getElementById('p-protein-per-kg').value;
  const proteinPerKg = eiwitRaw === '' ? null : +eiwitRaw;
  if (proteinPerKg !== null && !(proteinPerKg >= 0.8 && proteinPerKg <= 4)) {
    try { showToast(t('profile.protein.range'), true); } catch (e) {}
    return;
  }
  const carbPct = _carbPctUitVelden();
  if (carbPct === 'ongeldig') {
    try { showToast(t('profile.carbSplit.range'), true); } catch (e) {}
    return;
  }
  const macroCheck = berekenDagDoel({
    calorieBehoefte: document.getElementById('p-calorie-need').value ? +document.getElementById('p-calorie-need').value : null,
    weight: +document.getElementById('p-weight').value, proteinPerKg: proteinPerKg, carbPct: carbPct });
  if (macroCheck.proteinTeHoog) {
    try { showToast(t('profile.macro.invalid'), true); } catch (e) {}
    return;
  }
  profile = {
    name: document.getElementById('p-name').value,
    age: +document.getElementById('p-age').value,
    weight: +document.getElementById('p-weight').value,
    height: +document.getElementById('p-height').value,
    gender: document.getElementById('p-gender').value,
    goal: document.getElementById('p-goal').value,
    activity: +document.getElementById('p-activity').value,
    calorieBehoefte: document.getElementById('p-calorie-need').value ? +document.getElementById('p-calorie-need').value : null,
    calorieMin: calorieMin,
    calorieMax: calorieMax,
    proteinPerKg: proteinPerKg,
    carbPct: carbPct,
    trainingEnabled: document.getElementById('p-training-enabled').checked
  };
  syncSet('prime_profile', profile);
  applyTrainingVisibility();
  // Caloriebehoefte kan het kcal-doel wijzigen (zie getDagDoel() in data.js)
  // -- de al zichtbare cijfers op Dashboard/Voeding herrekenen zodra je
  // opslaat, i.p.v. pas bij de volgende tabwissel.
  if (typeof updateHomeMacros === 'function') updateHomeMacros();
  if (typeof updateMacroTotals === 'function') updateMacroTotals();
  closeProfile();
}

