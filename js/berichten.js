// ========== BERICHTEN: de coach reageert op toelichtingen en feedback ==========
// De coach schrijft een reactie in de gegevens van die klant (client_state, key prime_coach_reacties):
//   { reacties: { 'note:JJJJ-MM-DD' | 'fb:<feedback-id>': { text, ts, soort: 'note' | 'fb', bron } }, gelezen: { id: ts } }
// Alleen de coach schrijft in deze key (de klant leest hem alleen), dus een klant die tegelijk iets bewaart kan een reactie
// nooit overschrijven. "gelezen" is de gelezen-status van de coach voor toelichtingen (in de cloud, dus op elk apparaat gelijk).
// De klant houdt zelf bij welke reacties hij gelezen heeft in prime_reacties_gelezen { id: ts }.
// Naast het PRIME-logo staat een badge: bij de klant het aantal ongelezen reacties van de coach, bij de coach het aantal
// nieuwe toelichtingen (laatste 14 dagen) en nog niet afgehandelde feedback.

let _coachNieuw = 0;      // aantal nieuwe dingen voor de coach (toelichtingen + feedback)
let _coachDetail = { notes: 0, feedback: 0 };
let _msgLaatste = 0;      // tijdstip van de laatste telling (beperkt het aantal verzoeken)
let _msgBulk = null;      // { ts, notes, reacties, feedback, klanten } van de laatste bulk-lezing
let _msgGestart = false;

function msgEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function msgTekstHtml(s) { return msgEsc(s).replace(/\n/g, '<br>'); }

// ---------- klant: eigen reacties lezen ----------
function msgLokaalReacties() { try { return (JSON.parse(localStorage.getItem('prime_coach_reacties') || '{}').reacties) || {}; } catch (e) { return {}; } }
function msgLokaalGelezen() { try { return JSON.parse(localStorage.getItem('prime_reacties_gelezen') || '{}'); } catch (e) { return {}; } }

function msgReactieLijst() {
  const r = msgLokaalReacties(), g = msgLokaalGelezen();
  return Object.keys(r).map(function(id) {
    return { id: id, text: r[id].text || '', ts: r[id].ts || 0, soort: r[id].soort || 'note', bron: r[id].bron || '', nieuw: !(g[id] >= (r[id].ts || 0)) };
  }).sort(function(a, b) { return b.ts - a.ts; });
}

// ---------- badge naast het logo ----------
function msgBadgeVernieuw() {
  const el = document.getElementById('msg-badge');
  if (!el) return;
  const n = document.getElementById('msg-badge-n');
  let totaal, nieuw;
  if (isPrimeCoach()) {
    nieuw = _coachNieuw; totaal = nieuw;
    el.classList.add('coach');
  } else {
    const lijst = msgReactieLijst();
    totaal = lijst.length; nieuw = lijst.filter(function(r) { return r.nieuw; }).length;
    el.classList.remove('coach');
  }
  el.style.display = totaal > 0 ? 'inline-flex' : 'none';
  if (n) { n.textContent = nieuw > 0 ? String(nieuw) : ''; n.style.display = nieuw > 0 ? '' : 'none'; }
}

function msgBadgeKlik() {
  if (isPrimeCoach()) { go('signalen'); return; }
  msgOpen();
}

// ---------- klant: berichtenscherm ----------
function msgOpen() {
  const lijst = msgReactieLijst();
  const body = document.getElementById('msg-modal-body');
  if (!body) return;
  body.innerHTML = lijst.length ? lijst.map(function(r) {
    const d = new Date(r.ts);
    return '<div class="msg-bericht' + (r.nieuw ? ' nieuw' : '') + '"><div class="msg-dt"><span>' +
      d.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + t('msg.kind.' + r.soort) + '</span>' +
      (r.nieuw ? '<span class="msg-nieuw">' + t('msg.new') + '</span>' : '') + '</div>' +
      (r.bron ? '<div class="msg-eigen">"' + msgTekstHtml(r.bron) + '"</div>' : '') +
      '<div class="msg-reactie"><small>' + t('msg.coachReply') + '</small>' + msgTekstHtml(r.text) + '</div></div>';
  }).join('') : '<div style="font-size:13px;color:var(--muted)">' + t('msg.client.empty') + '</div>';
  document.getElementById('msg-modal').classList.add('open');
  // Geopend = gelezen (de "Nieuw"-labels blijven in dit venster nog even staan).
  const g = Object.assign({}, msgLokaalGelezen());
  let gewijzigd = false;
  lijst.forEach(function(r) { if (!(g[r.id] >= r.ts)) { g[r.id] = r.ts; gewijzigd = true; } });
  if (gewijzigd) syncSet('prime_reacties_gelezen', g);
  msgBadgeVernieuw();
}
function msgSluit() { document.getElementById('msg-modal').classList.remove('open'); }

// ---------- coach: gegevens ophalen en tellen ----------
function msgNoteNieuw(clientId, datum, ts, reactiesObj) {
  const gelezen = ((reactiesObj && reactiesObj.gelezen) || {})['note:' + datum];
  let lokaal; try { lokaal = (typeof _noteGelezen === 'function' ? _noteGelezen() : {})[clientId + '|' + datum]; } catch (e) { lokaal = undefined; }
  return !(gelezen >= ts) && !(lokaal >= ts); // lokaal = oude, per apparaat bewaarde gelezen-status (vóór de cloud-versie)
}

async function msgCoachBulk(vers) {
  if (!vers && _msgBulk && Date.now() - _msgBulk.ts < 15000) return _msgBulk;
  const sb = getSupabase();
  const [st, fb, klanten] = await Promise.all([
    withTimeout(sb.from('client_state').select('client_id, key, value').in('key', ['prime_notes', 'prime_coach_reacties']), 6000, { data: null, error: { message: 'timeout' } }),
    fetchFeedbackList(),
    fetchClientList()
  ]);
  const notes = {}, reacties = {};
  ((st && st.data) || []).forEach(function(r) {
    if (r.key === 'prime_notes') notes[r.client_id] = r.value || {};
    else if (r.key === 'prime_coach_reacties') reacties[r.client_id] = r.value || {};
  });
  _msgBulk = { ts: Date.now(), notes: notes, reacties: reacties, feedback: (fb && fb.data) || [], klanten: (klanten || []).map(function(c) { return c.id; }), fout: !!(st && st.error) };
  return _msgBulk;
}

function msgTelling(b) {
  const grens = localDateStr(new Date(Date.now() - 14 * 86400000));
  let notes = 0;
  b.klanten.forEach(function(cid) {
    const n = b.notes[cid] || {};
    Object.keys(n).forEach(function(d) {
      if (d >= grens && n[d] && n[d].text && msgNoteNieuw(cid, d, n[d].ts || 0, b.reacties[cid])) notes++;
    });
  });
  const feedback = b.feedback.filter(function(f) { return f.kind !== 'delete_request' && !f.handled && b.klanten.indexOf(f.client_id) >= 0; }).length;
  return { notes: notes, feedback: feedback };
}

async function coachTellingVernieuw(force) {
  if (!isPrimeCoach()) return null;
  const nu = Date.now();
  if (!force && nu - _msgLaatste < 60000) return null;
  if (navigator.onLine === false) return null;
  _msgLaatste = nu;
  try {
    const b = await msgCoachBulk(!!force);
    if (b.fout) return null; // geen betrouwbare telling: badge laten staan zoals hij was
    _coachDetail = msgTelling(b);
    _coachNieuw = _coachDetail.notes + _coachDetail.feedback;
    msgBadgeVernieuw();
    msgRenderBalk();
    return _coachDetail;
  } catch (e) {
    console.error('coachTellingVernieuw:', e);
    return null;
  }
}

// Balk bovenaan Signalen: wat er nieuw is, met "Alles als gelezen".
function msgRenderBalk() {
  const el = document.getElementById('msg-bar');
  if (!el) return;
  if (!isPrimeCoach()) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="msg-balk"><span>' + (_coachNieuw > 0 ? t('msg.bar', { n: _coachNieuw, notes: _coachDetail.notes, fb: _coachDetail.feedback }) : t('msg.bar.none')) + '</span>' +
    (_coachNieuw > 0 ? '<button type="button" class="btn-sm coach-only-btn" onclick="msgAllesGelezen()">' + t('msg.allRead') + '</button>' : '') + '</div>';
}

// ---------- coach: schrijven in de gegevens van een klant ----------
async function msgSchrijfCoach(clientId, wijzig) {
  const data = await fetchClientStateFor(clientId, ['prime_coach_reacties']);
  const oud = data.prime_coach_reacties || {};
  const nieuw = { reacties: Object.assign({}, oud.reacties), gelezen: Object.assign({}, oud.gelezen) };
  wijzig(nieuw);
  const res = await getSupabase().from('client_state').upsert({ client_id: clientId, key: 'prime_coach_reacties', value: nieuw, updated_at: new Date().toISOString() });
  if (res.error) throw res.error;
  if (_msgBulk) _msgBulk.reacties[clientId] = nieuw;
  if (clientId === activeClientId) { try { localStorage.setItem('prime_coach_reacties', JSON.stringify(nieuw)); } catch (e) { console.error(e); } }
  return nieuw;
}

// Gelezen-status van een toelichting wijzigen (cloud). true = gelezen.
async function msgGelezenZet(clientId, id, ts, gelezen) {
  await msgSchrijfCoach(clientId, function(n) { if (gelezen) n.gelezen[id] = Math.max(Date.now(), ts || 0); else delete n.gelezen[id]; });
  if (!gelezen && id.indexOf('note:') === 0) { // ook de oude, lokale markering weghalen, anders blijft hij "gelezen"
    try { const l = _noteGelezen(); delete l[clientId + '|' + id.slice(5)]; localStorage.setItem('prime_notes_gelezen', JSON.stringify(l)); } catch (e) { /* geen lokale markering */ }
  }
  coachTellingVernieuw(true);
}

// ---------- coach: reageren (blok onder een toelichting of feedbackbericht) ----------
function msgReactieHtml(r) {
  const d = new Date(r.ts);
  return '<div class="msg-reactie msg-reactie-coach"><small>' + t('msg.coach.yours', { datum: d.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' }) }) + '</small>' + msgTekstHtml(r.text) + '</div>';
}

function msgReactieBlokHtml(clientId, id, soort, bron, reactie) {
  return '<div class="rx-wrap" onclick="event.stopPropagation()" data-cid="' + msgEsc(clientId) + '" data-id="' + msgEsc(id) + '" data-soort="' + soort + '" data-bron="' + msgEsc(String(bron || '').slice(0, 300)) + '">' +
    '<div class="rx-bestaand">' + (reactie ? msgReactieHtml(reactie) : '') + '</div>' +
    '<div class="rx-acties"><button type="button" class="gr or rx-knop" onclick="msgReageerOpen(this)">' + t(reactie ? 'msg.coach.edit' : 'msg.coach.reply') + '</button></div>' +
    '<div class="rx-form" style="display:none"><textarea class="rx-ta" rows="3" maxlength="800" placeholder="' + msgEsc(t('msg.coach.placeholder')) + '">' + msgEsc(reactie ? reactie.text : '') + '</textarea>' +
    '<div class="rx-rij"><button type="button" class="ver" onclick="msgVerstuur(this)">' + t('msg.coach.send') + '</button>' +
    '<button type="button" class="gr" onclick="msgReageerSluit(this)">' + t('note.cancel') + '</button></div><div class="rx-fout"></div></div></div>';
}
function msgReageerOpen(knop) {
  const w = knop.closest('.rx-wrap');
  w.querySelector('.rx-form').style.display = 'block';
  w.querySelector('.rx-acties').style.display = 'none';
  const ta = w.querySelector('.rx-ta'); ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) { /* geen selectie */ }
}
function msgReageerSluit(knop) {
  const w = knop.closest('.rx-wrap');
  w.querySelector('.rx-form').style.display = 'none';
  w.querySelector('.rx-acties').style.display = '';
}

async function msgVerstuur(knop) {
  const w = knop.closest('.rx-wrap');
  const cid = w.dataset.cid, id = w.dataset.id, soort = w.dataset.soort, bron = w.dataset.bron;
  const tekst = w.querySelector('.rx-ta').value.trim();
  const fout = w.querySelector('.rx-fout');
  if (!tekst) { fout.textContent = t('msg.coach.empty'); return; }
  fout.textContent = '';
  knop.disabled = true;
  try {
    const ts = Date.now();
    await msgSchrijfCoach(cid, function(n) {
      n.reacties[id] = { text: tekst, ts: ts, soort: soort, bron: bron };
      n.gelezen[id] = ts;
    });
    if (soort === 'fb') await setFeedbackHandled(id.slice(3), true); // reageren = afgehandeld
    w.querySelector('.rx-bestaand').innerHTML = msgReactieHtml({ text: tekst, ts: ts });
    w.querySelector('.rx-knop').textContent = t('msg.coach.edit');
    msgReageerSluit(knop);
    const rij = w.closest('.note-coachrij');
    if (rij) { rij.classList.remove('nieuw'); const g = rij.querySelector('.note-gelezen'); if (g && !g.classList.contains('note-del')) g.textContent = t('note.coach.read'); }
    const fbItem = w.closest('.fb-item');
    if (fbItem) fbItem.style.opacity = '0.5';
    try { showToast(t('msg.coach.sent')); } catch (e) { /* geen melding */ }
    coachTellingVernieuw(true);
  } catch (e) {
    console.error('msgVerstuur:', e);
    fout.textContent = t('msg.coach.failed');
  } finally {
    knop.disabled = false;
  }
}

async function msgAllesGelezen() {
  if (!isPrimeCoach() || !confirm(t('msg.allRead.confirm'))) return;
  try {
    const b = await msgCoachBulk(true);
    const grens = localDateStr(new Date(Date.now() - 14 * 86400000));
    for (const cid of b.klanten) {
      const n = b.notes[cid] || {};
      const ids = Object.keys(n).filter(function(d) { return d >= grens && n[d] && n[d].text && msgNoteNieuw(cid, d, n[d].ts || 0, b.reacties[cid]); });
      if (ids.length) await msgSchrijfCoach(cid, function(x) { ids.forEach(function(d) { x.gelezen['note:' + d] = Math.max(Date.now(), n[d].ts || 0); }); });
    }
    for (const f of b.feedback) {
      if (f.kind !== 'delete_request' && !f.handled && b.klanten.indexOf(f.client_id) >= 0) await setFeedbackHandled(f.id, true);
    }
    try { showToast(t('msg.allRead.done')); } catch (e) { /* geen melding */ }
  } catch (e) {
    console.error('msgAllesGelezen:', e);
    try { showToast(t('msg.coach.failed'), true); } catch (e2) { /* geen melding */ }
  }
  await coachTellingVernieuw(true);
  if (document.getElementById('screen-signalen') && document.getElementById('screen-signalen').classList.contains('active')) renderSignalenTab();
}

// ---------- opstarten ----------
function msgStart() {
  msgBadgeVernieuw();
  if (!isPrimeCoach() || _msgGestart) return;
  _msgGestart = true;
  coachTellingVernieuw(true);
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'visible') coachTellingVernieuw(false); });
  window.addEventListener('focus', function() { coachTellingVernieuw(false); });
  setInterval(function() { coachTellingVernieuw(false); }, 5 * 60 * 1000);
}
