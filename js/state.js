// ========== TRAINING STATE ==========
// Losse, ad-hoc oefeningen die rechtstreeks via "Vandaag" zijn toegevoegd,
// per datum bewaard (net als foodDays bij Voeding) zodat ze -- net als
// voeding -- naar andere dagen gekopieerd kunnen worden. trainingDagLog
// blijft de gemakslijst voor "vandaag"; persistTrainingDag() in
// training.js schrijft 'm terug naar trainingDays[today].
let trainingDays = JSON.parse(localStorage.getItem('prime_training_days') || '{}');
// Welke datum trainingDagLog op dit moment weergeeft/bewerkt -- normaal
// gesproken vandaag, maar tijdelijk een andere datum als je vanuit
// Weekplanning's "+ Oefening" voor een andere dag oefeningen toevoegt
// (zelfde patroon als currentLogDate bij Voeding). switchTrainingTab('dag')
// zet 'm altijd weer terug naar vandaag.
let currentTrainingDate = localDateStr();
let trainingDagLog = trainingDays[currentTrainingDate] || [];
let selectedSchemaEx = {}; // Reset bij nieuwe check-in
let activeTrainingTab = 'dag';


// ========== HOOFD STATE ==========
let profile = JSON.parse(localStorage.getItem('prime_profile') || '{"name":"","age":35,"weight":70,"height":170,"gender":"v","goal":"Meer spiermassa opbouwen","activity":1.375,"trainingEnabled":true}');
// Per datum hoort er maar één dag-record te zijn. Bij gebruik op meerdere
// apparaten (of een gewicht invullen vóór de check-in) kon dezelfde datum toch
// twee keer in history terechtkomen, wat o.a. dubbele punten in de gewichts-
// grafiek gaf. Een afgesloten record (checkout ingevuld) gaat voor een open
// record; verder blijft het eerste staan, aangevuld met een gewicht dat alleen
// in het andere record zat. De volgorde van de lijst blijft behouden.
function dedupeHistoryByDate(lijst) {
  const perDatum = new Map();
  (lijst || []).forEach(function(h) {
    if (!h || !h.date) return;
    const bestaand = perDatum.get(h.date);
    if (!bestaand) { perDatum.set(h.date, h); return; }
    const winnaar = (!bestaand.checkout && h.checkout) ? h : bestaand;
    const andere = winnaar === bestaand ? h : bestaand;
    if (!(winnaar.checkin && winnaar.checkin.weight > 0) && andere.checkin && andere.checkin.weight > 0) {
      winnaar.checkin = Object.assign({}, winnaar.checkin, { weight: andere.checkin.weight });
    }
    perDatum.set(h.date, winnaar);
  });
  const gezien = new Set();
  return (lijst || []).map(function(h) { return h && h.date ? perDatum.get(h.date) : h; })
    .filter(function(h) {
      if (!h || !h.date) return true;
      if (gezien.has(h.date)) return false;
      gezien.add(h.date);
      return true;
    });
}
let history = dedupeHistoryByDate(JSON.parse(localStorage.getItem('prime_history') || '[]'));
let todayData = JSON.parse(localStorage.getItem('prime_today') || 'null');
let checkin = { sleep:0, energy:0, stress:0, weight:null };
let checkout = { energy:0, training:0, food:0 };
let exerciseDone = JSON.parse(localStorage.getItem('prime_exdone') || '[]');
let dagDone = {}; // { 'schema-tab-0': true, 'schema-1': true, 'extra-ex-bp': true }
let selectedAlts = {}; // { slotIndex: altIndex } — -1 = standaard, 0+ = alt index
let selectedMeals = {};
let trainingType = 'normaal';
let chatHistory = [];

// ========== VOEDING STATE ==========
let currentCat = 'alle';
let currentPortionProduct = null;
let currentMoment = 'ontbijt';
let dayLog = []; // logitems van de actief geselecteerde datum (zie currentLogDate)
let logIdCounter = 0;
let customProducts = JSON.parse(localStorage.getItem('prime_custom_products') || '[]');
let customMeals = JSON.parse(localStorage.getItem('prime_custom_meals') || '[]');
// Sets/herhalingen/rust/notities per losse oefening: { '<ex-id>': { sets:[{reps,rest}], notes:'' } }.
let exerciseNotes = JSON.parse(localStorage.getItem('prime_exercise_notes') || '{}');
// Eigen oefeningen die de coach zelf toevoegt (met foto), zichtbaar tussen Losse oefeningen.
let customExercises = JSON.parse(localStorage.getItem('prime_custom_exercises') || '[]');

// Voeding per datum (t.b.v. Weekplanning): { 'YYYY-MM-DD': [logitem, ...] }.
// dayLog is altijd de array voor currentLogDate — zie switchLogDate() in food.js.
let foodDays = JSON.parse(localStorage.getItem('prime_food_days') || '{}');
let currentLogDate = null; // wordt in app.js init() op vandaag gezet

