// ========== DATA-EXPORT (coach) ==========
// Twee downloads onder Signalen > Data exporteren:
//  - Excel (.xlsx): tabbladen Deelnemers, Check-ins, Voeding, Training en
//    Feedback, bedoeld voor analyse/evaluatie van de pilot.
//  - Back-up (.json): de ruwe gegevens van alle deelnemers, als vangnet (het
//    gratis Supabase-abonnement maakt zelf geen back-ups). Herstellen vanuit
//    dit bestand is niet ingebouwd; het is een kopie om terug te vallen op.
// Beide bevatten persoonsgegevens: veilig bewaren.

const EXPORT_XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

// Alle client_state-rijen van alle klanten in één vraag (de coach mag alles
// lezen, zie RLS in supabase/schema.sql). Geeft {client_id: {key: value}}.
async function exportFetchAllState() {
  const { data, error } = await withTimeout(
    getSupabase().from('client_state').select('client_id, key, value'),
    3000, { data: null, error: { message: 'Failed to fetch (timeout)' } }
  );
  if (error) throw error;
  const per = {};
  (data || []).forEach(r => { (per[r.client_id] = per[r.client_id] || {})[r.key] = r.value; });
  return per;
}

function exportLoadXlsx() {
  return new Promise(function(resolve, reject) {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const s = document.createElement('script');
    s.src = EXPORT_XLSX_URL;
    s.onload = function() { resolve(window.XLSX); };
    s.onerror = function() { reject(new Error('Excel-bibliotheek kon niet geladen worden')); };
    document.head.appendChild(s);
  });
}

function exportDatumStr() { return localDateStr(); }

// Bouwt de tabbladen uit de ruwe gegevens (puur, dus los te testen).
// clients: [{id, display_name}], namen: {id: profielnaam}, per: {id: {key: value}},
// feedback: [{...}], primeProgs: [programma's uit de gedeelde PRIME-tabel].
function exportBuildSheets(clients, namen, per, feedback, primeProgs) {
  const naamVan = id => namen[id] || (clients.find(c => c.id === id) || {}).display_name || id;
  const sheets = {
    Deelnemers: { cols: ['Deelnemer', 'Inlognaam', 'Leeftijd', 'Gewicht (kg)', 'Lengte (cm)', 'Geslacht', 'Doel', 'Caloriebehoefte', 'Akkoord voorwaarden', 'Aantal check-ins', 'Laatste check-in'], rows: [] },
    'Check-ins': { cols: ['Deelnemer', 'Datum', 'Slaap (1-4)', 'Energie ochtend (1-4)', 'Stress (1-4, hoger = minder)', 'Gewicht (kg)', 'Energie avond (1-4)', 'Voeding (1-4)', 'Training (1-3)'], rows: [] },
    Voeding: { cols: ['Deelnemer', 'Datum', 'Moment', 'Naam', 'Soort', 'Gram', 'kcal', 'Eiwit (g)', 'Koolhydraten (g)', 'Vet (g)', 'Gegeten'], rows: [] },
    Training: { cols: ['Deelnemer', 'Datum', 'Programma', 'Dag', 'Oefening', 'Afgevinkt'], rows: [] },
    Feedback: { cols: ['Deelnemer', 'Datum', 'Soort', 'Bericht', 'Afgehandeld'], rows: [] }
  };
  const soortLabel = { bug: 'Feedback', idea: 'Idee of tip', other: 'Anders', delete_request: 'Verwijderverzoek' };

  clients.forEach(function(c) {
    const st = per[c.id] || {};
    const naam = naamVan(c.id);
    const prof = st.prime_profile || {};
    const hist = st.prime_history || [];
    const consent = st.prime_consent;
    const laatste = hist.reduce((m, h) => (h.date > m ? h.date : m), '');
    sheets.Deelnemers.rows.push([naam, c.display_name || '', prof.age || '', prof.weight || '', prof.height || '', prof.gender === 'm' ? 'man' : (prof.gender === 'v' ? 'vrouw' : ''), prof.goal || '', prof.calorieBehoefte || '', consent && consent.date ? consent.date : 'nog niet', hist.length, laatste]);

    hist.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(function(h) {
      const ci = h.checkin || {}, co = h.checkout || {};
      sheets['Check-ins'].rows.push([naam, h.date, ci.sleep || '', ci.energy || '', ci.stress || '', ci.weight || '', co.energy || '', co.food || '', co.training || '']);
    });

    Object.keys(st.prime_food_days || {}).sort().forEach(function(datum) {
      (st.prime_food_days[datum] || []).forEach(function(i) {
        sheets.Voeding.rows.push([naam, datum, i.moment || '', i.name || '', i.type === 'meal' ? 'gerecht' : 'product', i.gram == null ? '' : i.gram, i.kcal || 0, i.prot || 0, i.carb || 0, i.fat || 0, i.eaten === false ? 'nee' : 'ja']);
      });
    });

    const alleProg = [].concat(typeof BUILTIN_PROGRAMMAS !== 'undefined' ? BUILTIN_PROGRAMMAS : [], st.prime_programmas || [], primeProgs || []);
    const gedaan = st.prime_wp_done || {};
    const verwijderd = st.prime_wp_removed || {};
    (st.prime_planning || []).slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(function(pl) {
      const delen = String(pl.schemaId || '').split(':');
      const prog = alleProg.find(p => p.id === delen[1]) || null;
      const dag = prog && prog.dagen ? prog.dagen[parseInt(delen[2], 10)] : null;
      const oefs = dag ? (dag.oefeningen || []) : [];
      const weg = verwijderd[pl.date] || [];
      const done = gedaan[pl.date] || [];
      oefs.forEach(function(o, i) {
        if (weg.includes(i)) return;
        sheets.Training.rows.push([naam, pl.date, prog ? (prog.naam || '') : String(pl.schemaId || ''), dag ? (dag.naam || '') : '', o.naam || o.name || '', done.includes(wpOefKey(o, i, oefs)) ? 'ja' : 'nee']);
      });
    });
    Object.keys(st.prime_training_days || {}).sort().forEach(function(datum) {
      const done = gedaan[datum] || [];
      (st.prime_training_days[datum] || []).forEach(function(ex) {
        sheets.Training.rows.push([naam, datum, '(losse oefening)', '', ex.name || ex.naam || '', done.includes('a:' + ex.id) ? 'ja' : 'nee']);
      });
    });
  });

  (feedback || []).forEach(function(f) {
    sheets.Feedback.rows.push([naamVan(f.client_id), f.created_at ? f.created_at.slice(0, 16).replace('T', ' ') : '', soortLabel[f.kind] || f.kind, f.message || '', f.handled ? 'ja' : 'nee']);
  });
  return sheets;
}

async function exportVerzamel() {
  const clients = await fetchClientList();
  const namen = await fetchProfileNames();
  const per = await exportFetchAllState();
  const fb = await fetchFeedbackList();
  let primeProgs = [];
  try { primeProgs = (await fetchPrimeProgramsFromCloud()) || []; } catch (e) {}
  return { clients, namen, per, feedback: fb.error ? [] : fb.data, primeProgs };
}

function exportDownloadBlob(blob, naam) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = naam;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportBusy(btnId, fn) {
  const btn = document.getElementById(btnId);
  const status = document.getElementById('export-status');
  const oud = btn.textContent;
  btn.disabled = true; btn.textContent = t('export.busy');
  if (status) status.textContent = '';

  // Data-export leest gegevens van ALLE klanten -- net als Signalen kan dat
  // nooit uit de eigen offline-cache (fase 1 gaat alleen over je eigen
  // gegevens). Eerst een verse verbindingstest (probeOfflineNow(), niet de
  // gememoriseerde probeOffline() van het opstarten) i.p.v. de onderliggende
  // aanroepen te laten mislukken -- dat kon zonder duidelijke melding lang
  // (of zelfs helemaal niet zichtbaar) blijven hangen.
  if (await probeOfflineNow()) {
    if (status) status.textContent = t('export.offline');
    btn.disabled = false; btn.textContent = oud;
    return;
  }

  try { await fn(); }
  catch (e) {
    console.error('export mislukt:', e);
    if (status) status.textContent = t('export.failed', { msg: (e && e.message) || String(e) });
  }
  btn.disabled = false; btn.textContent = oud;
}

function exportExcel() {
  return exportBusy('export-excel-btn', async function() {
    const XLSX = await exportLoadXlsx();
    const d = await exportVerzamel();
    const sheets = exportBuildSheets(d.clients, d.namen, d.per, d.feedback, d.primeProgs);
    const wb = XLSX.utils.book_new();
    Object.keys(sheets).forEach(function(naam) {
      const ws = XLSX.utils.aoa_to_sheet([sheets[naam].cols].concat(sheets[naam].rows));
      ws['!cols'] = sheets[naam].cols.map(c => ({ wch: Math.max(12, c.length + 2) }));
      XLSX.utils.book_append_sheet(wb, ws, naam);
    });
    XLSX.writeFile(wb, 'prime-export-' + exportDatumStr() + '.xlsx');
  });
}

function exportBackup() {
  return exportBusy('export-backup-btn', async function() {
    const d = await exportVerzamel();
    let primeMealsCloud = [];
    try { primeMealsCloud = (await fetchPrimeMealsFromCloud()) || []; } catch (e) {}
    const dump = {
      geexporteerd_op: new Date().toISOString(),
      app_build: window.PRIME_BUILD || null,
      deelnemers: d.clients.map(c => ({ id: c.id, inlognaam: c.display_name, profielnaam: d.namen[c.id] || null, gegevens: d.per[c.id] || {} })),
      prime_programmas: d.primeProgs,
      prime_gerechten: primeMealsCloud,
      feedback: d.feedback
    };
    exportDownloadBlob(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }), 'prime-backup-' + exportDatumStr() + '.json');
  });
}
