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
    var basisTab = document.getElementById('foodtab-basis');
    if (basisTab && basisTab.style.display !== 'none') renderProducts();
  }
}


// ========== INIT ==========
function init() {
  // Laad eigen foto's van coach als eerste stap
  applyCustomPhotos();

  // Date greeting
  const h = new Date().getHours();
  const greet = h < 12 ? 'Goedemorgen' : h < 17 ? 'Goedemiddag' : 'Goedenavond';
  const days = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag'];
  document.getElementById('hero-date').textContent = days[new Date().getDay()] + ' · ' + new Date().toLocaleDateString('nl-NL', { day:'numeric', month:'long', year:'numeric' });
  document.getElementById('hero-greeting').textContent = greet + '! 👋';

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
      document.getElementById('day-title').textContent = _wpDisp.naam + ' staat klaar ✓';
      document.getElementById('home-training-badge').innerHTML = '<div class="training-type-badge badge-normal">' + _wpDisp.icon + ' ' + _wpDisp.naam + '</div>';
      const _wpOef = wpGetOefeningen(_wpEntry.schemaId);
      document.getElementById('home-training-preview').innerHTML = _wpOef.slice(0,3).map(o => o.naam || o.name).join(' &nbsp;·&nbsp; ') + (_wpOef.length > 3 ? ' &nbsp;+' + (_wpOef.length - 3) + ' meer' : '');
    } else {
      document.getElementById('day-title').textContent = 'Geen training geselecteerd';
      document.getElementById('home-training-badge').innerHTML = '<div class="training-type-badge badge-light">Geen training geselecteerd</div>';
      document.getElementById('home-training-preview').innerHTML = 'Geen training ingepland voor vandaag.';
    }
    renderTraining();
    renderFood();
    buildTrainingSummary();
    buildFoodSummary();
    updateHomeMacros();
    updateTrainingDagBadge();
    applyCustomPhotos(); // Laad eigen foto's van coach
  }

  // Herbereken training summary zodra checkout zichtbaar wordt
  const checkoutCard = document.getElementById('checkout-card');
  if (checkoutCard && 'IntersectionObserver' in window) {
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

  // Init coach chat
  const chat = document.getElementById('chat-area');
  if (!chat.children.length) {
    addMsg('coach', `Hey${profile.name ? ' ' + profile.name : ''}! Ik ben coach Ira. Direct, nuchter en altijd eerlijk — maar ook warm. Stel me alles wat je wil weten over training, voeding, slaap of leefstijl. Waar kan ik je mee helpen?`);
  }
}

loadPhotosFromFile(init);
