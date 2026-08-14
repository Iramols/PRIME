// ========== NAVIGATIE ==========
function go(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + screen).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach((b, i) => {
    b.classList.toggle('active', ['home','training','voeding','coach','history','beheer'][i] === screen);
  });
  if (screen === 'history') renderHistory();
  if (screen === 'training') switchTrainingTab('dag');
  if (screen === 'beheer') { switchBeheerTab('training'); }
  if (screen === 'voeding') {
    // Herbouw welke Voeding-tab nu ook actief is (bv. bij taalwissel),
    // i.p.v. altijd terug te springen naar de eerste tab.
    if (document.getElementById('foodtab-plan')?.style.display !== 'none') renderMealPlan();
    if (document.getElementById('foodtab-basis')?.style.display !== 'none') renderProducts();
    if (document.getElementById('foodtab-log')?.style.display !== 'none') renderDayLog();
    if (document.getElementById('foodtab-add')?.style.display !== 'none') renderAddProductTab();
    if (document.getElementById('foodtab-addmeal')?.style.display !== 'none') renderAddMealTab();
  }
}


// ========== HOMESCHERM ==========
// Losgetrokken uit init() zodat een taalwissel (setLang() -> rerenderCurrentScreen())
// dit scherm opnieuw kan opbouwen zonder de hele app-boot te herhalen.
let _checkoutObserverAttached = false;

function renderHome() {
  // Date greeting
  const h = new Date().getHours();
  const greetKey = h < 12 ? 'greeting.morning' : h < 17 ? 'greeting.afternoon' : 'greeting.evening';
  document.getElementById('hero-date').textContent = dayName(new Date().getDay()) + ' · ' + new Date().toLocaleDateString(dateLocale(), { day:'numeric', month:'long', year:'numeric' });
  document.getElementById('hero-greeting').textContent = t(greetKey) + '! 👋';

  // Stats
  updateStreak();

  // Check if already checked in today
  const today = new Date().toISOString().split('T')[0];
  if (todayData && todayData.date === today) {
    trainingType = todayData.trainingType;
    checkin = todayData.checkin;
    document.getElementById('checkin-section').style.display = 'none';
    document.getElementById('day-section').style.display = 'block';
    const _wpEntry = (JSON.parse(localStorage.getItem('prime_planning') || '[]')).find(p => p.date === today) || null;
    if (_wpEntry) {
      const _wpDisp = wpGetDisplay(_wpEntry.schemaId);
      document.getElementById('day-title').textContent = dispName(_wpDisp) + t('home.readySuffix');
      document.getElementById('home-training-badge').innerHTML = '<div class="training-type-badge badge-normal">' + _wpDisp.icon + ' ' + dispName(_wpDisp) + '</div>';
      const _wpOef = wpGetOefeningen(_wpEntry.schemaId);
      document.getElementById('home-training-preview').innerHTML = _wpOef.slice(0,3).map(o => dispName(o)).join(' &nbsp;·&nbsp; ') + (_wpOef.length > 3 ? ' &nbsp;+' + (_wpOef.length - 3) + t('home.more') : '');
    } else {
      document.getElementById('day-title').textContent = t('home.noTrainingSelected');
      document.getElementById('home-training-badge').innerHTML = '<div class="training-type-badge badge-light">' + t('home.noTrainingSelected') + '</div>';
      document.getElementById('home-training-preview').innerHTML = t('home.noTrainingToday');
    }
    renderTraining();
    renderFood();
    buildTrainingSummary();
    buildFoodSummary();
    updateHomeMacros();
    updateTrainingDagBadge();
    applyCustomPhotos(); // Laad eigen foto's van coach
  }

  // Herbereken training summary zodra checkout zichtbaar wordt (eenmalig koppelen)
  const checkoutCard = document.getElementById('checkout-card');
  if (checkoutCard && 'IntersectionObserver' in window && !_checkoutObserverAttached) {
    _checkoutObserverAttached = true;
    const obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting && document.getElementById('day-section').style.display !== 'none') {
          buildTrainingSummary();
          buildFoodSummary();
        }
      });
    }, { threshold: 0.1 });
    obs.observe(checkoutCard);
  }
}

// ========== TRAINING AAN/UIT (profielinstelling) ==========
// Verbergt de Training-tab én alle trainingsgerelateerde onderdelen
// elders (dashboard-kaart, check-out samenvatting, Voortgang-statistieken)
// wanneer de coach dit voor een klant uitzet in het profiel.
function applyTrainingVisibility() {
  const enabled = profile.trainingEnabled !== false;

  const navBtn = document.getElementById('nav-btn-training');
  if (navBtn) navBtn.style.display = enabled ? '' : 'none';

  const homeCard = document.getElementById('home-training-card');
  if (homeCard) homeCard.style.display = enabled ? '' : 'none';

  const checkoutBlock = document.getElementById('training-summary-block');
  if (checkoutBlock) checkoutBlock.style.display = enabled ? '' : 'none';
  const checkoutDivider = document.getElementById('divider-after-training-summary');
  if (checkoutDivider) checkoutDivider.style.display = enabled ? '' : 'none';

  const hTrainingsCard = document.getElementById('h-trainings-card');
  if (hTrainingsCard) hTrainingsCard.style.display = enabled ? '' : 'none';
  const historyStats = document.getElementById('history-main-stats');
  if (historyStats) historyStats.style.gridTemplateColumns = enabled ? 'repeat(4,1fr)' : 'repeat(3,1fr)';
  const trainingTotalCard = document.getElementById('training-total-card');
  if (trainingTotalCard) trainingTotalCard.style.display = enabled ? '' : 'none';

  const progTabBtn = document.getElementById('htab-programma');
  if (progTabBtn) progTabBtn.style.display = enabled ? '' : 'none';
  const progTabContent = document.getElementById('hstab-content-programma');
  if (!enabled && progTabContent && progTabContent.style.display !== 'none' && typeof switchHistoryTab === 'function') {
    switchHistoryTab('stats');
  }

  const trainingScreen = document.getElementById('screen-training');
  if (!enabled && trainingScreen && trainingScreen.classList.contains('active')) {
    go('home');
  }
}

// ========== INIT ==========
function init() {
  // Laad eigen foto's van coach als eerste stap
  applyCustomPhotos();

  applyTrainingVisibility();
  renderHome();

  // Init coach chat
  const chat = document.getElementById('chat-area');
  if (!chat.children.length) {
    addMsg('coach', t('coach.greeting', { name: profile.name ? ' ' + profile.name : '' }));
  }
}

loadPhotosFromFile(init);
