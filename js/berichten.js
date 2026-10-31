// ========== BERICHTEN: gesprekken tussen coach en klant ==========
// Een gesprek (draad) hoort bij een toelichting ('note:JJJJ-MM-DD'), een feedbackbericht ('fb:<id>') of een eigen bericht van
// de coach ('msg:<id>'). Opslag, zodat niemand elkaars gegevens overschrijft:
//  - De coach schrijft in de client_state van de klant, key prime_coach_reacties:
//      { berichten: { id: [{ text, ts }] }, meta: { id: { soort, bron } }, gelezen: { id: ts }, reacties: { ... } }
//    ("reacties" is het oude formaat met één reactie per toelichting of feedbackbericht; het wordt nog gelezen en bij een
//    nieuw bericht omgezet.) "gelezen" is de gelezen-status van de coach per gesprek (cloud, dus op elk apparaat gelijk).
//  - De klant schrijft zijn antwoorden in prime_klant_antwoorden: { id: [{ text, ts }] } en houdt in prime_reacties_gelezen
//    { id: ts } bij tot wanneer hij elk gesprek heeft gelezen.
// Naast het PRIME-logo staat een badge: bij de klant het aantal gesprekken met een ongelezen bericht van de coach, bij de coach het
// aantal nieuwe toelichtingen (laatste 14 dagen), nog niet afgehandelde feedback en ongelezen antwoorden van klanten.

let _coachNieuw = 0;      // aantal nieuwe dingen voor de coach
let _coachDetail = { notes: 0, feedback: 0, antw: 0, verwijder: 0 };
let _msgLaatste = 0;      // tijdstip van de laatste telling (beperkt het aantal verzoeken)
let _msgBulk = null;      // { ts, notes, reacties, antwoorden, feedback, klanten } van de laatste bulk-lezing
let _msgGestart = false;

function msgEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function msgTekstHtml(s) { return msgEsc(s).replace(/\n/g, '<br>'); }
function msgLokaal(key) { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; } }
function msgDatum(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });
}

// ---------- gesprekken lezen (coach-kant en klant-kant gebruiken dezelfde hulpjes) ----------
function msgCoachBerichten(cobj, id) {
  const b = cobj && cobj.berichten && cobj.berichten[id];
  if (b) return b.slice();
  const r = cobj && cobj.reacties && cobj.reacties[id];
  return r ? [{ text: r.text, ts: r.ts }] : [];
}
function msgMetaVan(cobj, id) {
  if (cobj && cobj.meta && cobj.meta[id]) return cobj.meta[id];
  const r = cobj && cobj.reacties && cobj.reacties[id];
  if (r) return { soort: r.soort || 'note', bron: r.bron || '' };
  return { soort: id.indexOf('fb:') === 0 ? 'fb' : (id.indexOf('msg:') === 0 ? 'msg' : 'note'), bron: '' };
}
// verborgen = { id: ts }: berichten tot en met dat tijdstip zijn door deze kant (coach of klant) voor zichzelf verwijderd.
function msgDraad(cobj, antw, id, verborgen) {
  const grens = (verborgen && verborgen[id]) || 0;
  const coach = msgCoachBerichten(cobj, id).map(function(m) { return { van: 'coach', text: m.text, ts: m.ts }; });
  const klant = ((antw && antw[id]) || []).map(function(m) { return { van: 'klant', text: m.text, ts: m.ts }; });
  return coach.concat(klant).filter(function(m) { return m.ts > grens; }).sort(function(a, b) { return a.ts - b.ts; });
}
function msgLaatsteTs(draad, van) {
  let max = 0;
  draad.forEach(function(m) { if ((!van || m.van === van) && m.ts > max) max = m.ts; });
  return max;
}
function msgGespreksIds(cobj) {
  const ids = {};
  Object.keys((cobj && cobj.berichten) || {}).forEach(function(id) { ids[id] = 1; });
  Object.keys((cobj && cobj.reacties) || {}).forEach(function(id) { ids[id] = 1; });
  return Object.keys(ids);
}

// Eén bericht in een gesprek. perspectief = 'coach' (coach-omgeving) of 'klant'.
function msgBubbelHtml(m, perspectief) {
  const coachBericht = m.van === 'coach';
  let label, klasse;
  if (perspectief === 'coach') { label = coachBericht ? t('msg.coach.you') : t('msg.fromClient'); klasse = coachBericht ? 'msg-reactie-coach' : ''; }
  else { label = coachBericht ? t('msg.coachReply') : t('msg.you'); klasse = coachBericht ? '' : 'msg-reactie-eigen'; }
  return '<div class="msg-reactie ' + klasse + '"><small>' + label + ' · ' + msgDatum(m.ts) + '</small>' + msgTekstHtml(m.text) + '</div>';
}
function msgDraadHtml(draad, perspectief) {
  return draad.map(function(m) { return msgBubbelHtml(m, perspectief); }).join('');
}

// ---------- klant: eigen gesprekken ----------
function msgReactieLijst() {
  const c = msgLokaal('prime_coach_reacties'), a = msgLokaal('prime_klant_antwoorden'), g = msgLokaal('prime_reacties_gelezen'), v = msgLokaal('prime_reacties_verborgen');
  return msgGespreksIds(c).map(function(id) {
    const draad = msgDraad(c, a, id, v), meta = msgMetaVan(c, id);
    if (!draad.some(function(m) { return m.van === 'coach'; })) return null; // door de klant verwijderd (of nog geen bericht van de coach)
    const laatsteCoach = msgLaatsteTs(draad, 'coach');
    // De aanhaling bij een toelichting is de huidige tekst: heeft de klant de toelichting na de reactie aangepast, dan toont dit de laatste versie.
    let bron = meta.bron;
    if (meta.soort === 'note' && id.indexOf('note:') === 0 && typeof dagNotes !== 'undefined') {
      const huidig = dagNotes[id.slice(5)];
      if (huidig && huidig.text) bron = huidig.text;
    }
    return { id: id, soort: meta.soort, bron: bron, draad: draad, nieuw: !(g[id] >= laatsteCoach), sortTs: msgLaatsteTs(draad) };
  }).filter(Boolean).sort(function(a, b) { return b.sortTs - a.sortTs; });
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
  if (isPrimeCoach()) { go('signalen'); sigOpenMeestRelevant(); return; }
  msgOpen();
}

// ---------- klant: berichtenscherm met antwoorden ----------
function msgModalHtml(lijst) {
  if (!lijst.length) return '<div style="font-size:13px;color:var(--muted)">' + t('msg.client.empty') + '</div>';
  return lijst.map(function(r) {
    const eerste = r.draad.length ? r.draad[0].ts : r.sortTs;
    return '<div class="msg-bericht rx-wrap rx-klant' + (r.nieuw ? ' nieuw' : '') + '" data-id="' + msgEsc(r.id) + '"><div class="msg-dt"><span>' +
      new Date(eerste).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + t('msg.kind.' + r.soort) + '</span>' +
      (r.nieuw ? '<span class="msg-nieuw">' + t('msg.new') + '</span>' : '') + '</div>' +
      (r.bron ? '<div class="msg-eigen">"' + msgTekstHtml(r.bron) + '"</div>' : '') +
      msgDraadHtml(r.draad, 'klant') +
      '<div class="rx-acties"><button type="button" class="gr rx-knop" onclick="msgAntwoordOpen(this)">' + t('msg.reply') + '</button>' +
      '<button type="button" class="gr" onclick="msgKlantVerwijder(this)">' + t('msg.reply.delete') + '</button></div>' +
      '<div class="rx-form" style="display:none"><textarea class="rx-ta" rows="3" maxlength="800" placeholder="' + msgEsc(t('msg.reply.placeholder')) + '"></textarea>' +
      '<div class="rx-rij"><button type="button" class="ver" onclick="msgAntwoordVerstuur(this)">' + t('msg.reply.send') + '</button>' +
      '<button type="button" class="gr" onclick="msgAntwoordSluit(this)">' + t('note.cancel') + '</button></div><div class="rx-fout"></div></div></div>';
  }).join('');
}

function msgOpen() {
  const lijst = msgReactieLijst();
  const body = document.getElementById('msg-modal-body');
  if (!body) return;
  body.innerHTML = msgModalHtml(lijst);
  document.getElementById('msg-modal').classList.add('open');
  // Geopend = gelezen (de "Nieuw"-labels blijven in dit venster nog even staan).
  const g = Object.assign({}, msgLokaal('prime_reacties_gelezen'));
  let gewijzigd = false;
  lijst.forEach(function(r) {
    const ts = msgLaatsteTs(r.draad, 'coach');
    if (!(g[r.id] >= ts)) { g[r.id] = ts; gewijzigd = true; }
  });
  if (gewijzigd) syncSet('prime_reacties_gelezen', g);
  msgBadgeVernieuw();
}
function msgSluit() { document.getElementById('msg-modal').classList.remove('open'); }

// De klant verwijdert een gesprek alleen voor zichzelf: berichten tot nu toe worden voor hem verborgen, de coach houdt ze.
function msgKlantVerwijder(knop) {
  const w = knop.closest('.rx-wrap');
  if (!w || !confirm(t('msg.client.confirmDelete'))) return;
  const id = w.dataset.id;
  const v = Object.assign({}, msgLokaal('prime_reacties_verborgen'));
  v[id] = Date.now();
  syncSet('prime_reacties_verborgen', v);
  document.getElementById('msg-modal-body').innerHTML = msgModalHtml(msgReactieLijst());
  msgBadgeVernieuw();
  try { showToast(t('msg.client.deleted')); } catch (e) { /* geen melding */ }
}
function msgAntwoordOpen(knop) {
  const w = knop.closest('.rx-wrap');
  w.querySelector('.rx-form').style.display = 'block';
  w.querySelector('.rx-acties').style.display = 'none';
  const ta = w.querySelector('.rx-ta'); ta.focus();
}
function msgAntwoordSluit(knop) {
  const w = knop.closest('.rx-wrap');
  w.querySelector('.rx-form').style.display = 'none';
  w.querySelector('.rx-acties').style.display = '';
}
function msgAntwoordVerstuur(knop) {
  const w = knop.closest('.rx-wrap');
  const id = w.dataset.id;
  const tekst = w.querySelector('.rx-ta').value.trim();
  const fout = w.querySelector('.rx-fout');
  if (!tekst) { fout.textContent = t('msg.reply.empty'); return; }
  fout.textContent = '';
  const oud = msgLokaal('prime_klant_antwoorden');
  const nieuw = Object.assign({}, oud);
  nieuw[id] = (oud[id] || []).concat([{ text: tekst, ts: Date.now() }]);
  syncSet('prime_klant_antwoorden', nieuw);
  try { showToast(t('msg.reply.sent')); } catch (e) { /* geen melding */ }
  const body = document.getElementById('msg-modal-body');
  const lijst = msgReactieLijst();
  lijst.forEach(function(r) { r.nieuw = false; });
  body.innerHTML = msgModalHtml(lijst);
}

// ---------- coach: gegevens ophalen en tellen ----------
function msgThreadNieuw(clientId, id, noteTs, cobj, antw) {
  const gelezen = ((cobj && cobj.gelezen) || {})[id];
  const act = Math.max(noteTs || 0, msgLaatsteTs(((antw && antw[id]) || []).map(function(m) { return { van: 'klant', ts: m.ts }; }), 'klant'));
  let lokaal;
  if (id.indexOf('note:') === 0) { try { lokaal = (typeof _noteGelezen === 'function' ? _noteGelezen() : {})[clientId + '|' + id.slice(5)]; } catch (e) { lokaal = undefined; } }
  return !(gelezen >= act) && !(lokaal >= act); // lokaal = oude, per apparaat bewaarde gelezen-status (vóór de cloud-versie)
}
function msgNoteNieuw(clientId, datum, ts, cobj, antw) { return msgThreadNieuw(clientId, 'note:' + datum, ts, cobj, antw); }

async function msgCoachBulk(vers) {
  if (!vers && _msgBulk && Date.now() - _msgBulk.ts < 15000) return _msgBulk;
  const sb = getSupabase();
  const [st, fb, klanten] = await Promise.all([
    withTimeout(sb.from('client_state').select('client_id, key, value').in('key', ['prime_notes', 'prime_coach_reacties', 'prime_klant_antwoorden']), 6000, { data: null, error: { message: 'timeout' } }),
    fetchFeedbackList(),
    fetchClientList()
  ]);
  const notes = {}, reacties = {}, antwoorden = {};
  ((st && st.data) || []).forEach(function(r) {
    if (r.key === 'prime_notes') notes[r.client_id] = r.value || {};
    else if (r.key === 'prime_coach_reacties') reacties[r.client_id] = r.value || {};
    else if (r.key === 'prime_klant_antwoorden') antwoorden[r.client_id] = r.value || {};
  });
  _msgBulk = { ts: Date.now(), notes: notes, reacties: reacties, antwoorden: antwoorden, feedback: (fb && fb.data) || [], klanten: (klanten || []).map(function(c) { return c.id; }), fout: !!(st && st.error) };
  return _msgBulk;
}

function msgTelling(b) {
  const grens = localDateStr(new Date(Date.now() - 14 * 86400000));
  let notes = 0, feedback = 0, antw = 0, verwijder = 0;
  const geteld = {};
  b.klanten.forEach(function(cid) {
    const n = b.notes[cid] || {}, c = b.reacties[cid] || {}, a = b.antwoorden[cid] || {};
    Object.keys(n).forEach(function(d) {
      if (d >= grens && n[d] && n[d].text && msgThreadNieuw(cid, 'note:' + d, n[d].ts || 0, c, {})) { notes++; geteld[cid + '|note:' + d] = 1; } // alleen de toelichting zelf; een nieuw antwoord telt hieronder
    });
    Object.keys(a).forEach(function(id) { // nieuwe antwoorden van klanten op een gesprek dat nog niet is geteld
      if (!geteld[cid + '|' + id] && msgThreadNieuw(cid, id, 0, c, a)) { antw++; geteld[cid + '|' + id] = 1; }
    });
  });
  b.feedback.forEach(function(f) {
    if (f.handled || b.klanten.indexOf(f.client_id) < 0) return;
    if (f.kind === 'delete_request') { verwijder++; return; }
    if (!geteld[f.client_id + '|fb:' + f.id]) feedback++;
  });
  return { notes: notes, feedback: feedback, antw: antw, verwijder: verwijder };
}

// Getalletjes in de tabs van Signalen (Toelichting, Feedback, Verwijderverzoeken)
function sigTabBadges() {
  const d = _coachDetail || {};
  const zet = function(k, n) { const el = document.getElementById('sig-n-' + k); if (!el) return; el.textContent = n > 0 ? n : ''; el.style.display = n > 0 ? '' : 'none'; };
  zet('toelichting', (d.notes || 0) + (d.antw || 0));
  zet('feedback', d.feedback || 0);
  zet('verwijder', d.verwijder || 0);
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
    _coachNieuw = _coachDetail.notes + _coachDetail.feedback + _coachDetail.antw;
    msgBadgeVernieuw();
    msgRenderBalk();
    return _coachDetail;
  } catch (e) {
    console.error('coachTellingVernieuw:', e);
    return null;
  }
}

// Balk bovenaan Signalen: wat er nieuw is, met "Alles als gelezen" en "Bericht sturen".
function msgRenderBalk() {
  sigTabBadges();
  const el = document.getElementById('msg-bar');
  if (!el) return;
  if (!isPrimeCoach()) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="msg-balk"><span>' + (_coachNieuw > 0 ? t('msg.bar', { n: _coachNieuw, notes: _coachDetail.notes, fb: _coachDetail.feedback, antw: _coachDetail.antw }) : t('msg.bar.none')) + '</span>' +
    '<span style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn-sm coach-only-btn" onclick="msgNieuwOpen()">' + t('msg.compose.btn') + '</button>' +
    (_coachNieuw > 0 ? '<button type="button" class="btn-sm coach-only-btn" onclick="msgAllesGelezen()">' + t('msg.allRead') + '</button>' : '') + '</span></div>';
}

// ---------- coach: schrijven in de gegevens van een klant ----------
async function msgSchrijfCoach(clientId, wijzig) {
  const data = await fetchClientStateFor(clientId, ['prime_coach_reacties']);
  const oud = data.prime_coach_reacties || {};
  const nieuw = {
    berichten: Object.assign({}, oud.berichten), meta: Object.assign({}, oud.meta), gelezen: Object.assign({}, oud.gelezen), reacties: Object.assign({}, oud.reacties), verborgen: Object.assign({}, oud.verborgen)
  };
  wijzig(nieuw);
  const res = await getSupabase().from('client_state').upsert({ client_id: clientId, key: 'prime_coach_reacties', value: nieuw, updated_at: new Date().toISOString() });
  if (res.error) throw res.error;
  if (_msgBulk) _msgBulk.reacties[clientId] = nieuw;
  if (clientId === activeClientId) { try { localStorage.setItem('prime_coach_reacties', JSON.stringify(nieuw)); } catch (e) { console.error(e); } }
  return nieuw;
}

// Voegt een bericht van de coach toe aan een gesprek (en zet het oude formaat om).
function msgVoegBerichtToe(n, id, soort, bron, tekst, ts) {
  if (!n.berichten[id]) {
    n.berichten[id] = n.reacties[id] ? [{ text: n.reacties[id].text, ts: n.reacties[id].ts }] : [];
    if (n.reacties[id] && !(n.meta[id])) n.meta[id] = { soort: n.reacties[id].soort || soort, bron: n.reacties[id].bron || bron };
    delete n.reacties[id];
  } else { n.berichten[id] = n.berichten[id].slice(); }
  n.berichten[id].push({ text: tekst, ts: ts });
  if (!n.meta[id]) n.meta[id] = { soort: soort, bron: bron };
  n.gelezen[id] = ts;
}

// Gelezen-status van een gesprek wijzigen (cloud). true = gelezen.
async function msgGelezenZet(clientId, id, ts, gelezen) {
  await msgSchrijfCoach(clientId, function(n) { if (gelezen) n.gelezen[id] = Math.max(Date.now(), ts || 0); else delete n.gelezen[id]; });
  if (!gelezen && id.indexOf('note:') === 0) { // ook de oude, lokale markering weghalen, anders blijft hij "gelezen"
    try { const l = _noteGelezen(); delete l[clientId + '|' + id.slice(5)]; localStorage.setItem('prime_notes_gelezen', JSON.stringify(l)); } catch (e) { /* geen lokale markering */ }
  }
  coachTellingVernieuw(true);
}

// ---------- coach: gesprek onder een toelichting, feedbackbericht of eigen bericht ----------
function msgReactieBlokHtml(clientId, id, soort, bron, cobj, antw) {
  const draad = msgDraad(cobj, antw, id, cobj && cobj.verborgen);
  return '<div class="rx-wrap" onclick="event.stopPropagation()" data-cid="' + msgEsc(clientId) + '" data-id="' + msgEsc(id) + '" data-soort="' + soort + '" data-bron="' + msgEsc(String(bron || '').slice(0, 300)) + '">' +
    '<div class="rx-bestaand">' + msgDraadHtml(draad, 'coach') + '</div>' +
    '<div class="rx-acties"><button type="button" class="gr or rx-knop" onclick="msgReageerOpen(this)">' + t('msg.coach.reply') + '</button></div>' +
    '<div class="rx-form" style="display:none"><textarea class="rx-ta" rows="3" maxlength="800" placeholder="' + msgEsc(t('msg.coach.placeholder')) + '"></textarea>' +
    '<div class="rx-rij"><button type="button" class="ver" onclick="msgVerstuur(this)">' + t('msg.coach.send') + '</button>' +
    '<button type="button" class="gr" onclick="msgReageerSluit(this)">' + t('note.cancel') + '</button></div><div class="rx-fout"></div></div></div>';
}
function msgReageerOpen(knop) {
  const w = knop.closest('.rx-wrap');
  w.querySelector('.rx-form').style.display = 'block';
  w.querySelector('.rx-acties').style.display = 'none';
  const ta = w.querySelector('.rx-ta'); ta.focus();
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
    await msgSchrijfCoach(cid, function(n) { msgVoegBerichtToe(n, id, soort, bron, tekst, ts); });
    if (soort === 'fb') await setFeedbackHandled(id.slice(3), true); // reageren = afgehandeld
    w.querySelector('.rx-bestaand').insertAdjacentHTML('beforeend', msgBubbelHtml({ van: 'coach', text: tekst, ts: ts }, 'coach'));
    w.querySelector('.rx-ta').value = '';
    msgReageerSluit(knop);
    const rij = w.closest('.note-coachrij');
    if (rij) { rij.classList.remove('nieuw'); const g = rij.querySelector('.note-gelezen'); if (g && !g.classList.contains('note-del')) g.textContent = t('note.coach.read'); }
    const dr = w.closest('.msg-draadkaart');
    if (dr) dr.classList.remove('nieuw');
    try { showToast(t('msg.coach.sent')); } catch (e) { /* geen melding */ }
    coachTellingVernieuw(true);
  } catch (e) {
    console.error('msgVerstuur:', e);
    fout.textContent = t('msg.coach.failed');
  } finally {
    knop.disabled = false;
  }
}

// Gesprek zonder toelichting of feedback (een eigen bericht van de coach): kaartje met het hele gesprek.
function msgDraadKaartHtml(clientId, id, cobj, antw) {
  const meta = msgMetaVan(cobj, id);
  const draad = msgDraad(cobj, antw, id, cobj && cobj.verborgen);
  const nieuw = msgThreadNieuw(clientId, id, 0, cobj, antw);
  return '<div class="note-coachrij msg-draadkaart' + (nieuw ? ' nieuw' : '') + '" onclick="event.stopPropagation()">' +
    '<div class="note-coachtekst">✉️ ' + t('msg.kind.' + meta.soort) + '</div>' +
    (meta.bron ? '<div class="msg-eigen" style="margin-top:6px">"' + msgTekstHtml(meta.bron) + '"</div>' : '') +
    '<div class="note-coachmeta"><span>' + (draad.length ? msgDatum(draad[0].ts) : '') + '</span><span class="note-acties">' +
    '<button type="button" class="note-gelezen" onclick="msgDraadGelezen(event, \'' + msgEsc(clientId) + '\', \'' + msgEsc(id) + '\', this)">' + t(nieuw ? 'note.coach.markRead' : 'note.coach.read') + '</button>' +
    '<button type="button" class="note-gelezen note-del" onclick="msgDraadVerwijder(event, \'' + msgEsc(clientId) + '\', \'' + msgEsc(id) + '\', this)">' + t('note.coach.delete') + '</button></span></div>' +
    msgReactieBlokHtml(clientId, id, meta.soort, meta.bron, cobj, antw) + '</div>';
}
async function msgDraadGelezen(ev, clientId, id, knop) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  const kaart = knop.closest('.msg-draadkaart');
  const wordtGelezen = kaart.classList.contains('nieuw');
  kaart.classList.toggle('nieuw', !wordtGelezen);
  knop.textContent = t(wordtGelezen ? 'note.coach.read' : 'note.coach.markRead');
  try { await msgGelezenZet(clientId, id, 0, wordtGelezen); }
  catch (e) {
    console.error('msgDraadGelezen:', e);
    kaart.classList.toggle('nieuw', wordtGelezen); knop.textContent = t(wordtGelezen ? 'note.coach.markRead' : 'note.coach.read');
    try { showToast(t('msg.coach.failed'), true); } catch (e2) { /* geen melding */ }
  }
}
// De coach verwijdert een gesprek alleen voor zichzelf (de klant houdt het): berichten tot nu toe worden voor de coach verborgen.
async function msgDraadVerwijder(ev, clientId, id, knop) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  if (!isPrimeCoach() || !confirm(t('msg.thread.confirmDelete'))) return;
  try {
    await msgSchrijfCoach(clientId, function(n) { const nu = Date.now(); n.verborgen[id] = nu; n.gelezen[id] = nu; });
    const kaart = knop.closest('.msg-draadkaart');
    if (kaart) kaart.remove();
    try { showToast(t('msg.thread.deleted')); } catch (e) { /* geen melding */ }
    coachTellingVernieuw(true);
  } catch (e) {
    console.error('msgDraadVerwijder:', e);
    try { showToast(t('msg.coach.failed'), true); } catch (e2) { /* geen melding */ }
  }
}

// Toelichting van een klant verwijderen: alleen voor de coach verbergen, de klant houdt zijn toelichting.
async function noteVerberg(ev, clientId, datum, knop) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  if (!isPrimeCoach() || !confirm(t('msg.coach.confirmHide'))) return;
  if (knop) knop.disabled = true;
  try {
    await msgSchrijfCoach(clientId, function(n) { const nu = Date.now(); n.verborgen['note:' + datum] = nu; n.gelezen['note:' + datum] = nu; });
    const rij = knop && knop.closest('.note-coachrij');
    const kaart = rij && rij.closest('.card');
    if (rij) rij.remove();
    // Een klant zonder signalen en zonder toelichtingen hoort niet meer in de lijst bij Signalen.
    if (kaart && !kaart.querySelector('.note-coachrij') && !kaart.querySelector('[data-signaal]')) kaart.remove();
    try { showToast(t('note.coach.deleted')); } catch (e) { /* geen melding */ }
    coachTellingVernieuw(true);
    const hs = document.getElementById('screen-history');
    if (hs && hs.classList.contains('active')) renderVoortgangBerichten();
  } catch (e) {
    console.error('noteVerberg:', e);
    if (knop) knop.disabled = false;
    try { showToast(t('msg.coach.failed'), true); } catch (e2) { /* geen melding */ }
  }
}

// ---------- coach: een eigen bericht aan een klant ----------
async function msgNieuwOpen(clientId) {
  if (!isPrimeCoach()) return;
  let klanten = [], namen = {};
  try { klanten = await fetchClientList(); } catch (e) { console.error(e); }
  try { namen = await fetchProfileNames(); } catch (e) { /* namen zijn optioneel */ }
  const opts = '<option value="">' + t('msg.compose.choose') + '</option>' + klanten.map(function(c) {
    return '<option value="' + msgEsc(c.id) + '"' + (c.id === clientId ? ' selected' : '') + '>' + msgEsc(namen[c.id] || c.display_name || c.id) + '</option>';
  }).join('');
  document.getElementById('msgc-klant').innerHTML = opts;
  document.getElementById('msgc-tekst').value = '';
  document.getElementById('msgc-fout').textContent = '';
  document.getElementById('msgc-modal').classList.add('open');
  document.getElementById('msgc-tekst').focus();
}
function msgNieuwSluit() { document.getElementById('msgc-modal').classList.remove('open'); }
async function msgNieuwVerstuur() {
  const cid = document.getElementById('msgc-klant').value;
  const tekst = document.getElementById('msgc-tekst').value.trim();
  const fout = document.getElementById('msgc-fout');
  if (!cid) { fout.textContent = t('msg.compose.chooseClient'); return; }
  if (!tekst) { fout.textContent = t('msg.coach.empty'); return; }
  fout.textContent = '';
  const knop = document.getElementById('msgc-send');
  knop.disabled = true;
  try {
    const ts = Date.now();
    const id = 'msg:' + ts.toString(36) + Math.floor(Math.random() * 1296).toString(36);
    await msgSchrijfCoach(cid, function(n) { msgVoegBerichtToe(n, id, 'msg', '', tekst, ts); });
    msgNieuwSluit();
    try { showToast(t('msg.compose.sent')); } catch (e) { /* geen melding */ }
    coachTellingVernieuw(true);
    const actief = function(s) { const el = document.getElementById('screen-' + s); return el && el.classList.contains('active'); };
    if (actief('signalen')) renderSignalenTab();
    if (actief('history')) renderVoortgangBerichten();
  } catch (e) {
    console.error('msgNieuwVerstuur:', e);
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
      const n = b.notes[cid] || {}, c = b.reacties[cid] || {}, a = b.antwoorden[cid] || {};
      const ids = [];
      Object.keys(n).forEach(function(d) { if (d >= grens && n[d] && n[d].text && msgThreadNieuw(cid, 'note:' + d, n[d].ts || 0, c, a)) ids.push('note:' + d); });
      Object.keys(a).forEach(function(id) { if (ids.indexOf(id) < 0 && msgThreadNieuw(cid, id, 0, c, a)) ids.push(id); });
      if (ids.length) await msgSchrijfCoach(cid, function(x) { ids.forEach(function(id) { x.gelezen[id] = Date.now() + 1; }); });
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
  const sig = document.getElementById('screen-signalen');
  if (sig && sig.classList.contains('active')) renderSignalenTab();
}

// ---------- coach: toelichtingen en berichten bij Voortgang van de klant die je bekijkt ----------
async function renderVoortgangBerichten() {
  const wrap = document.getElementById('h-berichten-wrap');
  if (!wrap) return;
  if (!isPrimeCoach() || !activeClientId) { wrap.innerHTML = ''; return; }
  const cid = activeClientId;
  let data = {};
  try { data = await fetchClientStateFor(cid, ['prime_notes', 'prime_coach_reacties', 'prime_klant_antwoorden']); } catch (e) { console.error(e); }
  const notes = data.prime_notes || dagNotes || {};
  const c = data.prime_coach_reacties || msgLokaal('prime_coach_reacties');
  const a = data.prime_klant_antwoorden || msgLokaal('prime_klant_antwoorden');
  const grens = localDateStr(new Date(Date.now() - 60 * 86400000));
  const datums = Object.keys(notes).filter(function(d) { return d >= grens && notes[d] && notes[d].text && !(((c.verborgen || {})['note:' + d]) >= (notes[d].ts || 0)); }).sort().reverse().slice(0, 30);
  const rijen = datums.map(function(d) {
    const ts = notes[d].ts || 0;
    return _noteRijHtml(cid, { date: d, text: notes[d].text, ts: ts, nieuw: msgThreadNieuw(cid, 'note:' + d, ts, c, a) }, c, a);
  });
  const eigenIds = msgGespreksIds(c).concat(Object.keys(a)).filter(function(id, i, arr) { return arr.indexOf(id) === i && id.indexOf('note:') !== 0; });
  const draden = eigenIds.filter(function(id) { return msgDraad(c, a, id, c.verborgen).length; }).sort(function(x, y) {
    return msgLaatsteTs(msgDraad(c, a, y, c.verborgen)) - msgLaatsteTs(msgDraad(c, a, x, c.verborgen));
  }).map(function(id) { return msgDraadKaartHtml(cid, id, c, a); });
  const naam = (typeof profile !== 'undefined' && profile.name) ? profile.name.trim().split(' ')[0] : '';
  wrap.innerHTML = '<div class="card" style="margin-bottom:18px"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:10px">' +
    '<div><div class="card-label" style="margin-bottom:2px;color:var(--coach-only)">' + t('msg.vb.title') + '</div>' +
    '<div style="font-size:12px;color:var(--muted)">' + t('msg.vb.sub') + '</div></div>' +
    '<button type="button" class="btn-sm coach-only-btn" onclick="msgNieuwOpen(\'' + msgEsc(cid) + '\')">' + (naam ? t('msg.compose.btnNaam', { naam: msgEsc(naam) }) : t('msg.compose.btn')) + '</button></div>' +
    (rijen.length || draden.length ? rijen.join('') + draden.join('') : '<div style="font-size:13px;color:var(--muted)">' + t('msg.vb.empty') + '</div>') + '</div>';
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
