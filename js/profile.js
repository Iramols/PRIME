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
  document.getElementById('p-training-enabled').checked = profile.trainingEnabled !== false;
  document.getElementById('profile-modal').classList.add('open');
}
function closeProfile() { document.getElementById('profile-modal').classList.remove('open'); }
function saveProfile() {
  profile = {
    name: document.getElementById('p-name').value,
    age: +document.getElementById('p-age').value,
    weight: +document.getElementById('p-weight').value,
    height: +document.getElementById('p-height').value,
    gender: document.getElementById('p-gender').value,
    goal: document.getElementById('p-goal').value,
    activity: +document.getElementById('p-activity').value,
    calorieBehoefte: document.getElementById('p-calorie-need').value ? +document.getElementById('p-calorie-need').value : null,
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

