// ========== TAALKEUZE (i18n) ==========
// Kernlogica voor de NL/EN-toggle. Zie js/translations.js voor het
// woordenboek en de conventie voor toekomstige features.

let currentLang = localStorage.getItem('prime_lang') || 'nl';

// t('sleutel', {var: 'waarde'}) — vertaling opzoeken, valt terug op nl
// als de sleutel in de huidige taal ontbreekt, en op de sleutel zelf
// als hij nergens bestaat (zodat een ontbrekende vertaling zichtbaar
// blijft i.p.v. de app te breken).
function t(key, vars) {
  let str = (I18N[currentLang] && I18N[currentLang][key]) || (I18N.nl && I18N.nl[key]) || key;
  if (vars) {
    Object.keys(vars).forEach(function(k) {
      str = str.replace('{' + k + '}', vars[k]);
    });
  }
  return str;
}

// dispName(entity) — geeft de juiste-taal weergavenaam van een
// data.js-entiteit (oefening/maaltijd/product/schema). Gebruik dit
// ALLEEN op weergaveplekken, nooit in .find()/===/sleutel-constructie —
// .name/.naam blijft daar de stabiele identiteit (zie translations.js
// bovenaan voor de volledige conventie).
function dispName(entity) {
  if (!entity) return '';
  if (currentLang === 'en') {
    if (entity.name_en) return entity.name_en;
    if (entity.naam_en) return entity.naam_en;
  }
  return entity.name || entity.naam || '';
}

function dayName(i) {
  return (DAY_NAMES[currentLang] || DAY_NAMES.nl)[i];
}

// dispField(entity, field) — generieke versie van dispName() voor andere
// vertaalbare data-velden (bv. beschrijving, doel, level, stappen, group).
// Zelfde regel: alleen op weergaveplekken gebruiken.
function dispField(entity, field) {
  if (!entity) return '';
  if (currentLang === 'en' && entity[field + '_en']) return entity[field + '_en'];
  return entity[field] || '';
}

// findCanonicalExercise(name) — zoekt in EXTRA_EXERCISES naar een oefening
// waarvan de Nederlandse OF Engelse naam overeenkomt met `name`. Nodig omdat
// oefeningen zonder eigen `id` (in schema's/programma's) alleen op naam te
// matchen zijn voor fallback-foto's/stappen, en die naam kan afhankelijk van
// wanneer hij is opgeslagen in beide talen voorkomen.
function findCanonicalExercise(name) {
  if (!name || typeof EXTRA_EXERCISES === 'undefined') return null;
  for (const g of EXTRA_EXERCISES) {
    const f = g.exercises.find(e => e.name === name || e.naam === name || e.name_en === name || e.naam_en === name);
    if (f) return f;
  }
  return null;
}

function dateLocale() {
  return currentLang === 'en' ? 'en-US' : 'nl-NL';
}

// Leesbaar label voor een YYYY-MM-DD-string, gebruikt in de portie-
// modals bij Voeding en het oefening-detailscherm bij Training (zie
// updatePmDateLabel()/updateMpmDateLabel() in food.js,
// updateEdDateLabel() in training.js) -- "Vandaag" voor de huidige dag,
// anders "<weekdag> <dag maand>". Hier in i18n.js i.p.v. food.js/
// training.js omdat allebei dit nodig hebben en training.js vóór
// food.js laadt.
function formatPickerDateLabel(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  if (dateStr === todayStr) return t('weekplan.today');
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString(dateLocale(), { weekday: 'long' });
  const rest = dt.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
  return weekday.charAt(0).toUpperCase() + weekday.slice(1) + ' ' + rest;
}

// Loopt alle statische [data-i18n]/[data-i18n-html]/[data-i18n-placeholder]
// elementen af en past de huidige taal toe. Zelfde "loop alles af, pas
// toe"-patroon als applyCustomPhotos() in beheer.js.
function applyI18n() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });

  updateLangButtons();
}

function updateLangButtons() {
  document.querySelectorAll('.lang-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === currentLang);
  });
}

// Herkent het actieve scherm en herbouwt de inhoud ervan in de nieuwe
// taal. Voor het homescherm (dat niet via go()'s per-scherm dispatch
// loopt, alleen bij boot via renderHome()) wordt renderHome() direct
// aangeroepen; voor de rest wordt go() nogmaals aangeroepen, wat de
// bestaande per-scherm render-functies opnieuw uitvoert (reset daarbij
// eventuele actieve subtab terug naar de standaard-tab, een bewuste,
// eenvoudige keuze — taal wisselen is geen frequente actie).
function rerenderCurrentScreen() {
  const activeEl = document.querySelector('.screen.active');
  if (!activeEl) return;
  const screen = activeEl.id.replace('screen-', '');
  if (screen === 'home' && typeof renderHome === 'function') renderHome();
  else if (typeof go === 'function') go(screen);
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('prime_lang', lang);
  applyI18n();
  rerenderCurrentScreen();
}

document.addEventListener('DOMContentLoaded', applyI18n);
