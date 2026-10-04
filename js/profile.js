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
  _kvRatio = (typeof profile.carbPct === 'number') ? profile.carbPct / 100 : 0.6;
  _kvLeeg = false;
  _kvVeldenVullen();
  document.getElementById('p-training-enabled').checked = profile.trainingEnabled !== false;
  updateMacroPreview();
  document.getElementById('profile-modal').classList.add('open');
}
// Profielvelden -> tijdelijk profielobject voor berekenDagDoel() (data.js).
// Lege velden vallen daar terug op de standaardwaarden (2 g/kg en 60/40).
// Koolhydraten en vet zijn in het scherm percentages van het TOTALE dagdoel
// (eiwit + koolhydraten + vet = 100%). Opgeslagen blijft profile.carbPct, het
// aandeel koolhydraten van wat na het eiwit overblijft (standaard 60), zodat
// bestaande instellingen en getDagDoel() ongewijzigd blijven. _kvRatio is dat
// aandeel als 0-1 getal; _kvLeeg = beide velden bewust leeg (= standaard).
let _kvRatio = 0.6, _kvLeeg = false;

// Eiwit als % van het dagdoel, uit de huidige invoer (gram per kg x gewicht).
function _eiwitPct() {
  const d = berekenDagDoel(_profielMacroInvoer());
  return d.kcal > 0 ? Math.round(d.prot * 4 / d.kcal * 100) : 0;
}

// Zet de twee velden volgens _kvRatio en het huidige eiwitpercentage.
function _kvVeldenVullen() {
  const rest = Math.max(0, 100 - _eiwitPct());
  const k = Math.round(rest * _kvRatio);
  document.getElementById('p-carb-pct').value = k;
  document.getElementById('p-fat-pct').value = rest - k;
}

// Eiwit (g/kg), gewicht of caloriebehoefte veranderd: het eiwitaandeel schuift
// mee, dus koolhydraten/vet behouden hun onderlinge verhouding.
function eiwitInvoerGewijzigd() {
  if (!_kvLeeg) _kvVeldenVullen();
  updateMacroPreview();
}

// null = leeg (standaard 60/40 van de rest), 'ongeldig' = geen getal tussen 0
// en het beschikbare aandeel, anders het aandeel koolhydraten van de rest in %.
function _carbPctUitVelden() {
  const kRaw = document.getElementById('p-carb-pct').value, vRaw = document.getElementById('p-fat-pct').value;
  const rest = Math.max(0, 100 - _eiwitPct());
  const geldig = x => x !== '' && !isNaN(+x) && +x >= 0 && +x <= rest;
  if (kRaw === '' && vRaw === '') return null;
  if ((kRaw !== '' && !geldig(kRaw)) || (vRaw !== '' && !geldig(vRaw))) return 'ongeldig';
  return Math.round(_kvRatio * 10000) / 100;
}

// Typ je in het ene veld, dan vult het andere zichzelf aan tot het deel dat
// na het eiwit overblijft. Bij loslaten (definitief) worden decimalen afgerond.
function syncKoolhVet(bron, definitief) {
  const kEl = document.getElementById('p-carb-pct'), vEl = document.getElementById('p-fat-pct');
  const bronEl = bron === 'k' ? kEl : vEl, anderEl = bron === 'k' ? vEl : kEl;
  const rest = Math.max(0, 100 - _eiwitPct());
  if (kEl.value === '' && vEl.value === '') { _kvLeeg = true; updateMacroPreview(); return; }
  // Bij loslaten: een waarde boven het beschikbare deel wordt teruggezet.
  if (definitief && bronEl.value !== '' && !isNaN(+bronEl.value) && +bronEl.value > rest) bronEl.value = rest;
  const raw = bronEl.value;
  if (raw !== '' && !isNaN(+raw) && +raw >= 0 && +raw <= rest) {
    _kvLeeg = false;
    const x = Math.round(+raw);
    if (definitief) bronEl.value = x;
    anderEl.value = rest - x;
    const k = bron === 'k' ? x : rest - x;
    _kvRatio = rest > 0 ? k / rest : 0.6;
  }
  updateMacroPreview();
}

function _profielMacroInvoer() {
  const num = id => { const v = document.getElementById(id).value; return v === '' ? null : +v; };
  return {
    calorieBehoefte: num('p-calorie-need'),
    weight: num('p-weight'),
    proteinPerKg: num('p-protein-per-kg'),
    carbPct: _kvLeeg ? null : Math.round(_kvRatio * 10000) / 100
  };
}

// Live voorbeeld van het dagdoel onder de eiwit- en verdelingsvelden.
function updateMacroPreview() {
  const p = _profielMacroInvoer();
  const d = berekenDagDoel(p);
  const pct = d.carbPct;
  const gew = p.weight > 0 ? p.weight : 70;
  const eiwitPct = d.kcal > 0 ? Math.round(d.prot * 4 / d.kcal * 100) : 0;
  document.getElementById('p-protein-hint').textContent = t('profile.protein.hint', { kg: gew, g: Math.round(gew * d.perKg), pct: eiwitPct });
  document.getElementById('p-macro-split-label').textContent = t('profile.macroSplit.label', { rest: Math.max(0, 100 - eiwitPct) });
  const eK = d.prot * 4, kK = d.carb * 4, vK = d.fat * 9, tot = Math.max(1, eK + kK + vK);
  document.getElementById('pm-kcal').textContent = d.kcal;
  document.getElementById('pm-e').textContent = d.prot + ' g';
  document.getElementById('pm-k').textContent = d.carb + ' g';
  document.getElementById('pm-v').textContent = d.fat + ' g';
  // Afgeronde percentages die samen precies 100% zijn (vet = de rest).
  const pE = Math.round(eK / tot * 100), pK = Math.round(kK / tot * 100), pV = Math.max(0, 100 - pE - pK);
  document.getElementById('pm-ep').textContent = pE + '%';
  document.getElementById('pm-kp').textContent = pK + '%';
  document.getElementById('pm-vp').textContent = pV + '%';
  document.getElementById('pm-som').textContent = pE + '% + ' + pK + '% + ' + pV + '% = 100%';
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

