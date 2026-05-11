// ========== PROFILE ==========
function openProfile() {
  document.getElementById('p-name').value = profile.name || '';
  document.getElementById('p-age').value = profile.age || '';
  document.getElementById('p-weight').value = profile.weight || '';
  document.getElementById('p-height').value = profile.height || '';
  document.getElementById('p-gender').value = profile.gender || 'v';
  document.getElementById('p-goal').value = profile.goal || '';
  document.getElementById('p-activity').value = profile.activity || 1.375;
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
    activity: +document.getElementById('p-activity').value
  };
  localStorage.setItem('prime_profile', JSON.stringify(profile));
  closeProfile();
}

