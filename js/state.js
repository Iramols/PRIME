// ========== TRAINING STATE ==========
let activeSchemaId = sessionStorage.getItem('prime_active_schema') || null;
let selectedSchemaItems = JSON.parse(sessionStorage.getItem('prime_schema_items') || '{}');
// { 'full-body-3x-0': true, 'full-body-3x-1': false, ... }
let trainingDagLog = JSON.parse(sessionStorage.getItem('prime_training_dag') || '[]');
let selectedSchemaEx = {}; // Reset bij nieuwe check-in
let activeTrainingTab = 'dag';


// ========== HOOFD STATE ==========
let profile = JSON.parse(localStorage.getItem('prime_profile') || '{"name":"","age":35,"weight":70,"height":170,"gender":"v","goal":"Meer spiermassa opbouwen","activity":1.375,"trainingEnabled":true}');
let history = JSON.parse(localStorage.getItem('prime_history') || '[]');
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

