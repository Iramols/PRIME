// ========== TRAINING STATE ==========
let activeSchemaId = sessionStorage.getItem('prime_active_schema') || null;
let selectedSchemaItems = JSON.parse(sessionStorage.getItem('prime_schema_items') || '{}');
// { 'full-body-3x-0': true, 'full-body-3x-1': false, ... }
let trainingDagLog = JSON.parse(sessionStorage.getItem('prime_training_dag') || '[]');
let selectedSchemaEx = {}; // Reset bij nieuwe check-in
let activeTrainingTab = 'schema';


// ========== HOOFD STATE ==========
let profile = JSON.parse(localStorage.getItem('prime_profile') || '{"name":"","age":35,"weight":70,"height":170,"gender":"v","goal":"Meer spiermassa opbouwen","activity":1.375}');
let history = JSON.parse(localStorage.getItem('prime_history') || '[]');
let todayData = JSON.parse(localStorage.getItem('prime_today') || 'null');
let checkin = { sleep:0, energy:0, stress:0 };
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
let dayLog = []; // { id, name, icon, moment, gram, kcal, prot, carb, fat }
let logIdCounter = 0;

