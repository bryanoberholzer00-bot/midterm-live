/* Midterm USA 2026 — risultati in diretta.
   Legge i file JSON pubblici del New York Times (dati AP) e ridisegna la pagina ogni N secondi. */
(() => {
  'use strict';

  // ?data=2024-11-05 carica un'elezione passata dello stesso archivio NYT (per collaudo o per rivederla)
  const PARAMS = new URLSearchParams(location.search);
  const LIVE_DATE = '2026-11-03';
  const DATE = /^\d{4}-\d{2}-\d{2}$/.test(PARAMS.get('data') || '') ? PARAMS.get('data') : LIVE_DATE;
  const ARCHIVE = DATE !== LIVE_DATE;
  const SCEN_KEY = 'midterm2026-scen' + (ARCHIVE ? '-' + DATE : '');
  const BASE = `https://static01.nyt.com/elections-assets/pages/data/${DATE}/`;
  const FILES = { S: 'senate', H: 'house', G: 'governor' };
  const OFFICES = ['S', 'H', 'G'];
  const OFFICE_NAME = { S: 'Senato', H: 'Camera', G: 'Governatori' };
  const OFFICE_ONE = { S: 'Senato', H: 'Camera', G: 'Governatore' };
  const RATING_IT = {
    'solid-dem': 'Dem. sicuro', 'likely-dem': 'Dem. probabile', 'lean-dem': 'Dem. favorito',
    'tossup': 'Incerto',
    'lean-rep': 'Rep. favorito', 'likely-rep': 'Rep. probabile', 'solid-rep': 'Rep. sicuro',
  };
  const RATING_RANK = { 'tossup': 0, 'lean-dem': 1, 'lean-rep': 1, 'likely-dem': 2, 'likely-rep': 2, 'solid-dem': 3, 'solid-rep': 3 };
  const STATUS_IT = { too_early: 'Troppo presto', too_close_to_call: 'Troppo vicino', called: 'Assegnato', runoff: 'Ballottaggio', uncontested: 'Senza avversari' };
  const PARTY_IT = { DEM: 'Dem.', GOP: 'Rep.', IND: 'Ind.', LIB: 'Lib.', GRN: 'Verdi', OTH: 'Altro' };
  const DEMO = !ARCHIVE && PARAMS.has('demo');

  // Mappa a tessere: [colonna, riga]
  const TILES = {
    AK: [0, 0], ME: [10, 0], VT: [9, 1], NH: [10, 1],
    WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], IL: [5, 2], WI: [6, 2], MI: [7, 2], NY: [8, 2], RI: [9, 2], MA: [10, 2],
    OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IN: [5, 3], OH: [6, 3], PA: [7, 3], NJ: [8, 3], CT: [9, 3],
    CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4],
    AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5], DC: [8, 5],
    OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6],
    HI: [0, 7], TX: [3, 7], FL: [8, 7],
  };
  // Stati piccoli del Nord-Est: etichette (e distretti) in una colonna laterale nella mappa geografica
  const SIDE = ['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD', 'DC'];
  const GEO = window.US_STATES || {};
  const STATE_NAMES = Object.fromEntries(Object.entries(GEO).map(([k, v]) => [k, k === 'DC' ? 'Washington D.C.' : v.name]));
  // Confini 2026 dei distretti della Camera (districts.js, caricato in modo asincrono)
  const DIST = () => (ARCHIVE ? null : window.US_DISTRICTS || null);   // i confini 2026 non valgono per le elezioni passate
  const VB0 = { x: 0, y: 0, w: 960, h: 500 };
  const isGeo = () => state.view === 'geo' || state.view === 'shift';
  const stateBBox = {};
  function bboxOf(d) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, m;
    const re = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;
    while ((m = re.exec(d))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    return [x0, y0, x1, y1];
  }
  function getStateBBox(st) { return stateBBox[st] || (stateBBox[st] = GEO[st] ? bboxOf(GEO[st].d) : [0, 0, 960, 500]); }

  const missingEl = {};
  const $ = (id) => document.getElementById(id) || missingEl[id] || (missingEl[id] = document.createElement('div'));
  const fmtInt = new Intl.NumberFormat('it-IT');
  const fmtTime = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
  const fmtTimeS = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fmtDay = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtDayTime = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const isOld = (d) => Math.abs(Date.now() - d) > 18 * 3600e3;
  const pctS = (v) => (!v ? '0' : v < 1 ? '<1' : String(Math.round(v)));
  const fmtWhen = (d) => (isOld(d) ? fmtDayTime.format(d) : fmtTime.format(d));
  const atWhen = (d) => (isOld(d) ? `il ${fmtDayTime.format(d)}` : `alle ${fmtTime.format(d)}`);

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignora */ } },
  };

  const state = {
    office: 'S', view: 'geo', cmode: store.get('midterm2026-cmode', 'res') === 'swing' ? 'swing' : 'res',
    data: { S: null, H: null, G: null },
    control: { S: null, H: null, G: null },
    meta: {}, byId: new Map(),
    national: null,
    closings: [], selected: null, openRace: null, detailKey: '',
    timer: null, countdown: null, nextAt: 0, paused: false, pendingRefresh: false, loadedOnce: false,
    calledSeen: null, newCalls: new Set(), freshList: [], notify: false, sound: false, useProxy: false,
    search: '', pal: {}, trend: [],
    vb: { ...VB0 }, dragMoved: false,
    scen: loadScen(), scOffice: 'S', scAll: false,
    measStates: null, measAt: 0, measF: 'all', measQ: '', unseen: 0, tick: 0, saver: false,
  };
  const BASE_TITLE = document.title;
  function loadScen() { try { return JSON.parse(store.get(SCEN_KEY, '{}')) || {}; } catch (e) { return {}; } }

  /* ---------- rete ---------- */
  // Per ogni file ricordiamo l'ultimo Last-Modified: se non cambia, non rileggiamo né analizziamo il JSON.
  // Il Last-Modified si salva solo con commitJSON(), dopo che i dati sono stati usati davvero:
  // se l'elaborazione fallisce, al giro dopo il file viene riletto.
  const jcache = new Map(), jpending = new Map();
  const FETCH_TIMEOUT = 40000;
  const HAS_PROXY = ['localhost', '127.0.0.1'].includes(location.hostname);
  function commitJSON(key) { const p = jpending.get(key); if (p) { jcache.set(key, p); jpending.delete(key); } }
  async function getJSON(key, direct, proxy) {
    const urls = ARCHIVE || !proxy || !HAS_PROXY ? [direct] : state.useProxy ? [proxy, direct] : [direct, proxy];   // il proxy serve solo la diretta, in locale
    let lastErr = null, directErr = null;
    for (const url of urls) {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT);
      try {
        const r = await fetch(url, { cache: 'no-cache', signal: ctl.signal });
        if (!r.ok) { const he = new Error(`HTTP ${r.status}`); if (url === direct) he.httpStatus = r.status; throw he; }
        const lm = r.headers.get('last-modified');
        const prev = jcache.get(key);
        if (lm && prev && prev.lm === lm) {
          try { if (r.body) r.body.cancel(); } catch (e) { /* ignora */ }
          state.useProxy = url === proxy;
          return DEMO ? prev.json : null;           // invariato
        }
        const j = await r.json();
        if (j && j.error) throw new Error(j.error);
        state.useProxy = url === proxy;
        jpending.set(key, { lm, json: DEMO ? j : null });
        return j;
      } catch (e) {
        lastErr = e && e.name === 'AbortError' ? new Error('tempo scaduto') : e;
        if (url === direct) directErr = lastErr;
      } finally { clearTimeout(timer); }
    }
    throw directErr || lastErr;
  }

  async function refresh() {
    if (state.refreshing) { state.again = true; return; }   // un aggiornamento alla volta: quello chiesto nel frattempo parte dopo
    clearTimeout(state.timer);
    if (document.hidden && state.loadedOnce && !state.notify && !state.sound) {
      state.pendingRefresh = true;
      clearInterval(state.countdown);
      $('nextText').textContent = '· in attesa (scheda nascosta)';
      return;
    }
    state.pendingRefresh = false;
    state.refreshing = true;
    setStatus('busy', 'Aggiornamento…');
    try {
      // Il file della Camera (il più pesante) se non la stai guardando si scarica al massimo ogni 15 secondi
      // (con l'aggiornamento ogni 5 s, un giro su tre) e, con il risparmio dati, un giro su quattro.
      state.tick++;
      const sec = Number($('interval').value) || 30;
      const houseEvery = state.office === 'H' ? 1 : Math.max(state.saver ? 4 : 1, Math.ceil(15 / sec));
      const skipHouse = state.loadedOnce && houseEvery > 1 && state.tick % houseEvery !== 0;
      const res = await Promise.allSettled(OFFICES.map((o) => (o === 'H' && skipHouse ? null
        : getJSON('o:' + o, `${BASE}results-${FILES[o]}.json`, `feed/${FILES[o]}.json`))));
      let changed = !state.loadedOnce;
      const errs = [];
      res.forEach((x, i) => {
        const o = OFFICES[i];
        if (x.status === 'rejected') { errs.push(`${OFFICE_NAME[o]}: ${x.reason && x.reason.message}`); return; }
        const j = x.value;
        if (!j) return;
        const t = j.resultsMeta && j.resultsMeta.resultsUpdatedAt ? new Date(j.resultsMeta.resultsUpdatedAt) : null;
        if (!DEMO && t && state.meta[o] && t < state.meta[o]) { commitJSON('o:' + o); return; }   // risposta più vecchia di quella mostrata
        try {
          ingest(o, j);
          if (j.pollClosingTimes && j.pollClosingTimes.length) {
            state.closings = j.pollClosingTimes.map((p) => ({ st: p.reporting_unit.state_postal, at: new Date(p.poll_closing_time) }))
              .sort((a, b) => a.at - b.at || a.st.localeCompare(b.st));
          }
          if (t) state.meta[o] = t;
          commitJSON('o:' + o);
          changed = true;
        } catch (e) { console.error(e); errs.push(`${OFFICE_NAME[o]}: ${e.message}`); }
      });
      const nytError = res.some((x) => x.status === 'rejected' && x.reason && x.reason.httpStatus);
      state.failStreak = nytError ? (state.failStreak || 0) + 1 : 0;
      if (errs.length === OFFICES.length) throw new Error(errs.join(' · '));
      if (changed) { detectNewCalls(); diffEvents(); recordTrend(); renderAll(); showToasts(); }
      if (OFFICES.some((o) => state.data[o])) state.loadedOnce = true;
      const upd = Math.max(0, ...Object.values(state.meta).map((d) => +d || 0));
      setStatus('ok', `Risultati ${upd && isOld(new Date(upd)) ? 'del ' + fmtDayTime.format(new Date(upd)) : 'delle ' + fmtTime.format(new Date(upd || Date.now()))} · controllo ${fmtTimeS.format(new Date())}${state.useProxy ? ' (via proxy)' : ''}${DEMO ? ' · DEMO: numeri inventati' : ''}${ARCHIVE ? ' · ARCHIVIO' : ''}${state.saver ? ' · risparmio dati' : ''}${errs.length ? ` · non aggiornato: ${errs.map((e) => e.split(':')[0]).join(', ')}` : ''}`, errs.join('\n'));
      refreshCountyPanels(true);
      refreshStatePanel(true);
      if (state.measAt && Date.now() - state.measAt > 110000) loadAllMeasures();
    } catch (e) {
      console.error(e);
      setStatus('err', `Errore: ${e.message}`);
    } finally {
      state.refreshing = false;
    }
    schedule();
    if (state.again) { state.again = false; refresh(); }
  }

  function ingest(office, json) {
    const all = json.races || [];
    const nat = all.find((r) => r.coverage === 'national');
    if (office === 'H' && nat && nat.top_reporting_unit) {
      const t = nat.top_reporting_unit;
      const v = (id) => { const c = (t.candidates || []).find((x) => x.nyt_id === id); return c && c.votes ? c.votes.total || 0 : 0; };
      state.national = { total: t.total_votes || 0, dem: v('democrat'), gop: v('republican'), oth: v('other') };
    }
    state.data[office] = all.filter((r) => r.coverage !== 'national')
      .map((r) => normalize(DEMO ? demoize(r) : r, office))
      .sort((a, b) => a.state.localeCompare(b.state) || (a.seatNum - b.seatNum));
    const pc = json.partyControlData && json.partyControlData.results && json.partyControlData.results[0];
    state.control[office] = pc && pc.offices && pc.offices[office] ? pc.offices[office] : null;
  }

  function candName(m, id) { return m ? [m.first_name, m.last_name, m.suffix].filter(Boolean).join(' ') || id : id; }

  function histOf(u) {
    const hd = (u && u.historical_comparison_race_data) || {}, hm = (u && u.historical_comparison_race_meta) || {};
    const keys = Object.keys(hd).filter((k) => hd[k] && typeof hd[k].margin === 'number');
    const k = keys.find((x) => /-P-2024/.test(x)) || keys[0];
    if (!k) return null;
    const m = hm[k] || {};
    return { margin: hd[k].margin, votes: hd[k].votes || 0, label: m.label || k, dem: m.candsByParty && m.candsByParty.democrat, rep: m.candsByParty && m.candsByParty.republican };
  }
  function histLabel(h) {
    const m = /^(\d{4}) (presidential|senate|governor)/i.exec(h.label || '');
    if (!m) return h.label;
    return ({ presidential: 'Presidenziali', senate: 'Senato', governor: 'Governatore' })[m[2].toLowerCase()] + ' ' + m[1];
  }

  function normalize(r, office) {
    const tru = r.top_reporting_unit || {};
    const meta = r.candidate_metadata || {};
    const won = (r.outcome && r.outcome.won) || [];
    const runoff = (r.outcome && r.outcome.advanced_to_runoff) || [];
    const total = tru.total_votes || 0;
    const cands = (tru.candidates || []).map((c) => {
      const m = meta[c.nyt_id] || {};
      const pid = (m.party && m.party.nyt_id) || 'OTH';
      const v = (c.votes && c.votes.total) || 0;
      return {
        id: c.nyt_id, name: candName(m, c.nyt_id),
        party: pid, partyLabel: PARTY_IT[pid] || ({ Other: 'Altro', Nonpartisan: 'Apartitico', Independent: 'Ind.' })[m.party && m.party.abbreviation] || (m.party && m.party.abbreviation) || pid,
        incumbent: !!m.incumbent, order: m.order || 99, img: m.img_url || null,
        votes: v, pct: total ? v / total * 100 : 0,
        winner: won.includes(c.nyt_id), runoff: runoff.includes(c.nyt_id),
      };
    }).sort((a, b) => b.votes - a.votes || majorFirst(a) - majorFirst(b) || a.order - b.order);
    const winner = cands.find((c) => c.winner) || null;
    const leader = !winner && total > 0 ? cands[0] : null;
    const acceptedAt = (r.outcome && r.outcome.winner_accepted_at && r.outcome.winner_accepted_at[0]) || null;
    const dem = cands.find((c) => c.party === 'DEM'), gop = cands.find((c) => c.party === 'GOP');
    return {
      id: r.nyt_id, office, state: tru.state_postal || r.nyt_id.slice(0, 2),
      stateName: STATE_NAMES[tru.state_postal] || tru.name || tru.state_postal,
      seatNum: Number(r.seat_number) || 0, special: r.race_type_id === 'W',
      rating: r.rating || null, status: r.race_call_status || null, uncontested: !!r.uncontested,
      eevp: tru.eevp || 0, total, expected: tru.total_expected_vote || 0,
      precReporting: tru.precincts_reporting || 0, precTotal: tru.precincts_total || 0,
      cands, winner, leader, runoff: runoff.length > 0,
      gained: flipParty(r.outcome && r.outcome.gained, winner),
      rcv: rcvRounds(r, tru, cands),
      calledAt: acceptedAt ? new Date(acceptedAt) : null,
      updatedAt: tru.provider_updated_at ? new Date(tru.provider_updated_at) : null,
      margin: dem && gop && total ? dem.pct - gop.pct : null, hist: histOf(tru),
      url: r.url || null,
    };
  }
  const majorFirst = (c) => (c.party === 'DEM' || c.party === 'GOP' ? 0 : 1);

  // "Seggio strappato": nei feed reali è true/false (vedi 2024); accettiamo anche il codice del partito
  function flipParty(g, winner) {
    if (!winner || !g) return null;
    if (g === true) return winner.party;
    if (typeof g === 'string') return g;
    if (typeof g === 'object' && g.nyt_id) return g.nyt_id;
    return null;
  }

  // Voto a scelta multipla (Maine, Alaska): risultato dell'ultimo turno di conteggio
  function rcvRounds(r, tru, cands) {
    const rounds = Array.isArray(r.rounds) ? r.rounds : null;
    if (!rounds || rounds.length < 2) return null;
    const byRid = new Map((tru.candidates || []).map((c) => [c.nyt_candidate_race_id, c.nyt_id]));
    const last = [...rounds].sort((a, b) => (a.order || 0) - (b.order || 0)).pop();
    const tot = last.total_votes || (last.candidates || []).reduce((t, c) => t + (c.total || 0), 0);
    const fin = (last.candidates || []).filter((c) => !c.previously_eliminated && (c.total || 0) > 0).map((c) => {
      const cand = cands.find((x) => x.id === byRid.get(c.nyt_candidate_race_id));
      return { name: cand ? cand.name : '?', party: cand ? cand.party : 'OTH', partyLabel: cand ? cand.partyLabel : '', votes: c.total || 0, pct: tot ? (c.total || 0) / tot * 100 : 0 };
    }).sort((a, b) => b.votes - a.votes);
    return fin.length ? { n: rounds.length, fin } : null;
  }

  // Soglia di maggioranza: dal feed (nel 2024 al Senato era 51 per entrambi, nel 2026 ai Rep bastano 50)
  function chamberToWin(o) {
    const pc = state.control[o];
    if (pc && pc.to_win && pc.to_win.DEM && pc.to_win.GOP) return { DEM: pc.to_win.DEM, GOP: pc.to_win.GOP };
    return o === 'S' ? { DEM: 51, GOP: 50 } : { DEM: 218, GOP: 218 };
  }

  // Quanti voti mancano e quale quota servirebbe a chi insegue (stima, solo i primi due)
  function catchUp(r) {
    if (r.winner || !r.total || r.cands.length < 2) return null;
    const expected = r.expected > r.total ? r.expected : (r.eevp > 0 ? Math.round(r.total * 100 / r.eevp) : r.total);
    const remaining = Math.max(0, expected - r.total);
    const [a, b] = r.cands, gap = a.votes - b.votes;
    return { remaining, gap, a, b, need: remaining > 0 ? (gap + remaining) / (2 * remaining) * 100 : null };
  }

  /* ---------- modalità demo (?demo=1): numeri inventati partendo dalle gare vere ---------- */
  function demoize(r) {
    const tru = r.top_reporting_unit; if (!tru || !tru.candidates) return r;
    const rnd = mulberry(hash(r.nyt_id + Math.floor(Date.now() / 120000)));
    const phase = rnd();
    if (phase < 0.25) return r;
    const expected = tru.total_expected_vote || 100000;
    const eevp = Math.min(99, Math.round(phase * 110));
    const total = Math.round(expected * eevp / 100);
    const lean = r.rating || 'tossup';
    let demShare = lean.endsWith('dem') ? 0.56 : lean.endsWith('rep') ? 0.44 : 0.5;
    demShare += (rnd() - 0.5) * 0.08;
    const meta = r.candidate_metadata || {};
    const isYes = (id) => !!(meta[id] && meta[id].party && meta[id].party.nyt_id === 'YES');
    const yesNo = tru.candidates.some((c) => isYes(c.nyt_id));
    const yesShare = 0.5 + (rnd() - 0.5) * 0.36;
    const cands = tru.candidates.map((c) => {
      const p = (meta[c.nyt_id] && meta[c.nyt_id].party && meta[c.nyt_id].party.nyt_id) || 'OTH';
      const share = yesNo ? (isYes(c.nyt_id) ? yesShare : 1 - yesShare)
        : p === 'DEM' ? demShare : p === 'GOP' ? 1 - demShare - 0.02 : 0.02 / Math.max(1, tru.candidates.length - 2);
      return { ...c, votes: { total: Math.round(total * share) } };
    });
    const sorted = [...cands].sort((a, b) => b.votes.total - a.votes.total);
    if (yesNo) {   // nei referendum vince il Sì solo se supera la soglia (per esempio 55% in Colorado)
      const yesWins = yesShare * 100 >= (r.win_threshold || 50);
      sorted.sort((a, b) => (isYes(b.nyt_id) === yesWins) - (isYes(a.nyt_id) === yesWins));
    }
    const called = eevp >= 80 && (yesNo ? Math.abs(yesShare * 100 - (r.win_threshold || 50)) > 3 : Math.abs(demShare - 0.5) > 0.03);
    const winParty = meta[sorted[0].nyt_id] && meta[sorted[0].nyt_id].party && meta[sorted[0].nyt_id].party.nyt_id;
    return {
      ...r,
      race_call_status: called ? 'called' : eevp >= 80 ? 'too_close_to_call' : r.race_call_status,
      outcome: called ? { ...r.outcome, won: [sorted[0].nyt_id], called_by: ['ap'], winner_accepted_at: [new Date(Date.now() - rnd() * 3600e3).toISOString()],
        gained: !yesNo && (winParty === 'DEM' || winParty === 'GOP') && rnd() < 0.15 ? winParty : null } : r.outcome,
      top_reporting_unit: { ...tru, candidates: cands, total_votes: total, eevp, precincts_reporting: Math.round((tru.precincts_total || 100) * eevp / 100) },
    };
  }
  function demoizeUnits(race, r, partyOf) {
    if (!r.total) return race;
    const rnd = mulberry(hash(race.nyt_id + 'u' + Math.floor(Date.now() / 120000)));
    const shift = r.margin !== null && r.hist ? r.margin - r.hist.margin : 0;
    return { ...race, reporting_units: (race.reporting_units || []).map((u) => {
      if (u.level === 'state') return u;
      const h = histOf(u);
      const m = Math.max(-95, Math.min(95, (h ? h.margin : (r.margin || 0)) + shift + (rnd() - 0.5) * 8));
      const ev = Math.max(0, Math.min(99, r.eevp + (rnd() - 0.5) * 60));
      const tot = Math.round((u.total_expected_vote || 0) * ev / 100);
      const dS = (0.98 + m / 100) / 2, n = (u.candidates || []).length;
      return { ...u, eevp: Math.round(ev), total_votes: tot, candidates: (u.candidates || []).map((c) => {
        const p = partyOf(c.nyt_id);
        const s = p === 'DEM' ? dS : p === 'GOP' ? 0.98 - dS : 0.02 / Math.max(1, n - 2);
        return { ...c, votes: { total: Math.round(tot * s) } };
      }) };
    }) };
  }
  function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- nuove assegnazioni ---------- */
  function detectNewCalls() {
    const now = new Set(); const fresh = [];
    state.seenOffices = state.seenOffices || new Set();
    for (const o of OFFICES) {
      const known = state.seenOffices.has(o);
      for (const r of state.data[o] || []) {
        if (r.winner) { now.add(r.id); if (known && state.calledSeen && !state.calledSeen.has(r.id)) fresh.push(r); }
      }
      if (state.data[o]) state.seenOffices.add(o);
    }
    state.newCalls = new Set(fresh.map((r) => r.id));
    state.freshList = fresh;
    if (state.freshList.length && state.notify && 'Notification' in window && Notification.permission === 'granted') {
      const body = fresh.slice(0, 5).map((r) => `${raceLabel(r)}: ${r.winner.name} (${r.winner.partyLabel})`).join('\n');
      try { new Notification(fresh.length === 1 ? 'Nuova assegnazione' : `${fresh.length} nuove assegnazioni`, { body }); } catch (e) { /* ignora */ }
    }
    state.calledSeen = now;
  }

  let actx = null;
  function chime(flip) {
    if (!state.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime;
      (flip ? [660, 990, 1320] : [880, 1320]).forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain(), d = i * 0.13;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + d);
        g.gain.exponentialRampToValueAtTime(0.18, t + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.4);
        o.connect(g).connect(actx.destination); o.start(t + d); o.stop(t + d + 0.45);
      });
    } catch (e) { /* ignora */ }
  }

  /* ---------- andamento dei seggi nella serata ---------- */
  const TREND_KEY = 'midterm2026-trend' + (DEMO ? '-demo' : '') + (ARCHIVE ? '-' + DATE : '');

  /* ---------- cronaca della serata ---------- */
  // Confronta ogni gara con l'aggiornamento precedente: assegnazioni, primi voti, cambi in testa, grandi blocchi di voti.
  // Per la Camera solo le gare competitive, altrimenti la cronaca diventerebbe un elenco di 435 righe.
  const EVENTS_KEY = 'midterm2026-events' + (DEMO ? '-demo' : '');
  const EV_IT = { call: 'Assegnata', flip: 'Cambio in testa', first: 'Primi voti', jump: 'Nuovi voti' };
  function loadEvents() { if (ARCHIVE) return []; try { return JSON.parse(store.get(EVENTS_KEY, '[]')) || []; } catch (e) { return []; } }
  function competitive(r) { return r.office !== 'H' || !r.rating || !String(r.rating).startsWith('solid') || (r.margin !== null && Math.abs(r.margin) < 8); }
  function diffEvents() {
    if (ARCHIVE) return;
    if (!state.events) state.events = loadEvents();
    const prev = state.prevSnap, now = new Map(), evs = [], at = Date.now();
    for (const o of OFFICES) for (const r of state.data[o] || []) {
      const lead = r.winner || r.leader;
      const snap = { lid: lead ? lead.id : null, eevp: r.eevp, total: r.total, won: !!r.winner };
      now.set(r.id, snap);
      const p = prev && prev.get(r.id);
      if (!p) continue;                       // gara nuova o categoria appena caricata: niente eventi finti
      const ev = (type, extra) => evs.push({ t: at, type, id: r.id, ...extra });
      if (!p.won && snap.won) { ev('call', { name: r.winner.name, party: r.winner.party, flip: !!r.gained }); continue; }
      if (snap.won || !competitive(r)) continue;
      if (!p.total && r.total) { ev('first', { m: r.margin }); continue; }
      if (p.lid && snap.lid && p.lid !== snap.lid && r.leader) { ev('flip', { name: r.leader.name, party: r.leader.party, m: r.margin }); continue; }
      if (snap.eevp - p.eevp >= 15) ev('jump', { eevp: snap.eevp, m: r.margin });
    }
    state.prevSnap = now;
    if (!evs.length) return;
    state.events = evs.concat(state.events).slice(0, 200);
    store.set(EVENTS_KEY, JSON.stringify(state.events));
  }
  function renderEvents() {
    const box = $('events');
    if (ARCHIVE) { box.innerHTML = '<li class="muted">In archivio la cronaca non c\'è: si costruisce mentre la pagina è aperta durante lo spoglio.</li>'; return; }
    if (!state.events) state.events = loadEvents();
    const f = state.evF || 'all';
    const list = state.events.filter((e) => {
      const r = state.byId.get(e.id); if (!r) return false;
      return f === 'all' || (f === 'call' ? e.type === 'call' : r.office === f);
    }).slice(0, 60);
    if (!list.length) { box.innerHTML = `<li class="muted">${state.events.length ? 'Nessun evento per questo filtro.' : 'Qui compaiono, man mano che arrivano, i primi voti, i cambi in testa, i grandi blocchi di schede e le assegnazioni. Si costruisce mentre la pagina è aperta.'}</li>`; return; }
    box.innerHTML = list.map((e) => {
      const r = state.byId.get(e.id);
      const who = e.name ? ` <b class="p ${partyClass(e.party)}">${esc(e.name)}</b>` : '';
      let txt;
      if (e.type === 'call') txt = `${who} vince${e.flip ? ' e strappa il seggio' : ''}`;
      else if (e.type === 'flip') txt = `${who} passa in testa${e.m !== null && e.m !== undefined ? ` (${fmtMargin(e.m)})` : ''}`;
      else if (e.type === 'first') txt = ` arrivano i primi voti${e.m !== null && e.m !== undefined ? ` (${fmtMargin(e.m)})` : ''}`;
      else txt = ` scrutinato il ${pctS(e.eevp)}%${e.m !== null && e.m !== undefined ? `, ${fmtMargin(e.m)}` : ''}`;
      return `<li class="ev ${e.type}" data-id="${esc(e.id)}"><span class="t">${fmtWhen(new Date(e.t))}</span><span class="badge ev-${e.type}">${EV_IT[e.type]}</span><span>${esc(raceLabel(r))}:${txt}</span></li>`;
    }).join('');
  }
  function seatsFn(office) {
    const pc = state.control[office], races = state.data[office] || [];
    const bal = pc && pc.party_balance;
    const isP = (r, p) => (p === 'OTH' ? r.winner.party !== 'DEM' && r.winner.party !== 'GOP' : r.winner.party === p);
    const calledN = (p) => races.filter((r) => r.winner && isP(r, p)).length;
    if (!bal) return calledN;
    return (p) => (bal[p] ? (DEMO ? (bal[p].no_election || 0) + calledN(p) : bal[p].seats) : calledN(p));
  }
  function recordTrend() {
    if (!state.trend.length) { try { state.trend = JSON.parse(store.get(TREND_KEY, '[]')); } catch (e) { state.trend = []; } }
    const s = seatsFn('S'), h = seatsFn('H');
    const pt = { t: Date.now(), sd: s('DEM'), sg: s('GOP'), hd: h('DEM'), hg: h('GOP') };
    const last = state.trend[state.trend.length - 1];
    if (!last || last.sd !== pt.sd || last.sg !== pt.sg || last.hd !== pt.hd || last.hg !== pt.hg || pt.t - last.t > 600e3) {
      state.trend.push(pt);
      if (state.trend.length > 800) state.trend.splice(0, state.trend.length - 800);
      store.set(TREND_KEY, JSON.stringify(state.trend));
    }
  }
  function sparkSVG(key, total, maj) {
    const pts = state.trend; if (pts.length < 2) return '';
    const W = 300, H = 48, t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
    const x = (t) => ((t - t0) / Math.max(1, t1 - t0) * (W - 2) + 1).toFixed(1);
    const y = (v) => (H - 2 - v / total * (H - 4)).toFixed(1);
    const line = (k) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t)},${y(p[k])}`).join('');
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <line class="maj" x1="0" x2="${W}" y1="${y(maj)}" y2="${y(maj)}"/>
      <path class="dem" d="${line(key + 'd')}"/><path class="gop" d="${line(key + 'g')}"/></svg>
      <div class="foot"><span>Seggi nel corso della serata, dalle ${fmtTime.format(new Date(t0))}</span><span>tratteggio = maggioranza</span></div>`;
  }

  /* ---------- stato / timer ---------- */
  function setStatus(kind, text, detail) { $('dot').className = 'dot ' + kind; $('statusText').textContent = text; $('statusText').title = detail || ''; }
  function schedule() {
    clearTimeout(state.timer); clearInterval(state.countdown);
    if (state.paused) { $('nextText').textContent = '· in pausa'; return; }
    const sec = Number($('interval').value) || 30;
    const n = state.failStreak || 0;
    const wait = n ? Math.min(120, Math.max(sec, 5 * Math.pow(2, n))) : sec;
    state.nextAt = Date.now() + wait * 1000;
    state.timer = setTimeout(refresh, wait * 1000);
    const tick = () => {
      const left = Math.max(0, Math.round((state.nextAt - Date.now()) / 1000));
      $('nextText').textContent = n ? `· errori dal NYT: nuovo tentativo tra ${left} s` : `· prossimo tra ${left} s`;
    };
    tick(); state.countdown = setInterval(tick, 1000);
  }

  /* ---------- rendering ---------- */
  function palette() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    state.pal = { dem: v('--dem'), gop: v('--gop'), oth: v('--oth'), demL: v('--dem-light'), gopL: v('--gop-light'), othL: v('--oth-light'), none: v('--none'), off: v('--off') };
  }
  function partyClass(p) { return p === 'DEM' ? 'dem' : p === 'GOP' ? 'gop' : 'oth'; }
  function colorFor(r) {
    const p = state.pal;
    if (!r) return p.off;
    if (r.winner) return p[partyClass(r.winner.party)];
    if (r.leader) return r.leader.party === 'DEM' ? p.demL : r.leader.party === 'GOP' ? p.gopL : p.othL;
    return p.none;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function fmtMargin(m) { return m >= 0 ? `Dem. +${m.toFixed(1)}` : `Rep. +${(-m).toFixed(1)}`; }
  function marginClass(m) { return m === null || m === undefined ? '' : m >= 0 ? 'p dem' : 'p gop'; }

  function renderAll() {
    palette();
    state.byId = new Map(OFFICES.flatMap((o) => (state.data[o] || []).map((r) => [r.id, r])));
    renderBalance();
    for (const o of OFFICES) {
      const rs = state.data[o] || [];
      $('cnt-' + o).textContent = `${rs.filter((r) => r.winner).length}/${rs.length}`;
    }
    renderMap(); renderDetail(); renderEvents(); renderClose(); renderScen(); renderKeyRaces(); renderCalls(); renderClosings();
  }

  /* --- bilancio delle camere --- */
  function renderBalance() {
    $('bop-S').innerHTML = chamberHTML('Senato', 'S', 100, chamberToWin('S'), 4, 's');
    $('bop-H').innerHTML = chamberHTML('Camera', 'H', 435, chamberToWin('H'), 9, 'h');
    $('bop-G').innerHTML = govHTML(state.data.G || []);
  }

  function projection(office, seats) {
    const p = { DEM: seats('DEM'), GOP: seats('GOP'), OTH: seats('OTH'), unk: 0 };
    for (const r of state.data[office] || []) {
      if (r.winner) continue;
      if (r.leader) { p[r.leader.party === 'DEM' || r.leader.party === 'GOP' ? r.leader.party : 'OTH']++; continue; }
      if (r.rating && r.rating !== 'tossup') p[r.rating.endsWith('dem') ? 'DEM' : 'GOP']++; else p.unk++;
    }
    return p;
  }
  function projHTML(p) {
    return `<div class="proj" title="Seggi già assegnati + chi è in vantaggio dove si conta + rating NYT dove non ci sono ancora voti. Non è un modello statistico.">
      Proiezione semplice: <span class="p dem">Dem. ${p.DEM}</span> · <span class="p gop">Rep. ${p.GOP}</span>${p.OTH ? ` · Altri ${p.OTH}` : ''}${p.unk ? ` · ${p.unk} incerti` : ''}</div>`;
  }

  function chamberHTML(title, office, total, toWin, rows, trendKey) {
    const races = state.data[office] || [], pc = state.control[office];
    const bal = pc && pc.party_balance ? pc.party_balance : null;
    const seats = seatsFn(office);
    const flips = (p) => (bal && bal[p] && !DEMO ? bal[p].flip_count : races.filter((r) => r.winner && r.gained === p).length);
    const dem = seats('DEM'), gop = seats('GOP'), oth = seats('OTH');
    const leadD = races.filter((r) => r.leader && r.leader.party === 'DEM').length;
    const leadR = races.filter((r) => r.leader && r.leader.party === 'GOP').length;
    const called = races.filter((r) => r.winner).length, remaining = races.length - called;
    const empty = Math.max(0, total - dem - gop - oth - leadD - leadR);
    const cur = pc && pc.current_control ? `Prima del voto: Dem. ${pc.current_control.DEM} · Rep. ${pc.current_control.GOP}${pc.current_control.OTH ? ' · Ind. ' + pc.current_control.OTH : ''}` : '';
    const winD = bal && bal.DEM && !DEMO ? bal.DEM.winner : dem >= toWin.DEM;
    const winR = bal && bal.GOP && !DEMO ? bal.GOP.winner : gop >= toWin.GOP;
    const verdict = winD ? '<span class="verdict">Maggioranza Dem.</span>' : winR ? '<span class="verdict">Maggioranza Rep.</span>'
      : `Per la maggioranza: Dem. −${Math.max(0, toWin.DEM - dem)} · Rep. −${Math.max(0, toWin.GOP - gop)}`;
    const segs = [{ cls: 'dem', n: dem }, { cls: 'lead dem', n: leadD }, { cls: 'oth', n: oth }, { cls: 'empty', n: empty }, { cls: 'lead gop', n: leadR }, { cls: 'gop', n: gop }];
    let extra = '';
    if (office === 'H' && state.national && state.national.total) {
      const n = state.national, pd = n.dem / n.total * 100, pg = n.gop / n.total * 100;
      extra = `<div class="foot"><span>Voto popolare: <span class="p dem">Dem. ${pd.toFixed(1)}%</span> · <span class="p gop">Rep. ${pg.toFixed(1)}%</span></span><span>${fmtInt.format(n.total)} voti</span></div>`;
    }
    return `
      <div class="title"><b>${title}</b><span class="muted small">${called} di ${races.length} gare assegnate · ${remaining} da assegnare</span></div>
      ${hemiSVG(total, segs, rows, toWin.DEM)}
      <div class="nums"><span><span class="dem">${dem}</span> Dem.${leadD ? ` <span class="lead">+${leadD} in vantaggio</span>` : ''}</span>
        <span class="muted small">${toWin.DEM} per la maggioranza</span>
        <span>${leadR ? `<span class="lead">+${leadR} in vantaggio</span> ` : ''}Rep. <span class="gop">${gop}</span></span></div>
      ${projHTML(projection(office, seats))}
      <div class="foot"><span>${verdict}</span><span>Seggi strappati: Dem. ${flips('DEM')} · Rep. ${flips('GOP')}</span></div>
      ${cur ? `<div class="foot"><span>${cur}</span>${oth ? `<span>Indipendenti: ${oth}</span>` : ''}</div>` : ''}
      ${extra}
      ${sparkSVG(trendKey, total, toWin.DEM)}`;
  }

  function hemiSVG(total, segs, rows, maj) {
    const R0 = 42, R1 = 96, CX = 100, CY = 102;
    const radii = Array.from({ length: rows }, (_, i) => R0 + (R1 - R0) * (rows === 1 ? 0 : i / (rows - 1)));
    const sum = radii.reduce((a, b) => a + b, 0);
    const counts = radii.map((r) => Math.floor(total * r / sum));
    let rem = total - counts.reduce((a, b) => a + b, 0);
    for (let i = rows - 1; rem > 0; i = (i - 1 + rows) % rows, rem--) counts[i]++;
    const seats = [];
    counts.forEach((n, i) => {
      const r = radii[i];
      for (let j = 0; j < n; j++) { const a = n === 1 ? Math.PI / 2 : Math.PI - Math.PI * j / (n - 1); seats.push({ a, x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) }); }
    });
    seats.sort((p, q) => q.a - p.a);
    const dot = Math.max(1.7, Math.min(3.6, Math.PI * R1 / Math.max(1, counts[rows - 1]) * 0.4));
    const out = []; let i = 0;
    for (const s of segs) for (let k = 0; k < s.n && i < seats.length; k++, i++) out.push(`<circle class="${s.cls}" cx="${seats[i].x.toFixed(1)}" cy="${seats[i].y.toFixed(1)}" r="${dot.toFixed(1)}"/>`);
    for (; i < seats.length; i++) out.push(`<circle class="empty" cx="${seats[i].x.toFixed(1)}" cy="${seats[i].y.toFixed(1)}" r="${dot.toFixed(1)}"/>`);
    const idx = Math.min(seats.length - 1, Math.max(0, maj - 1));
    const a = seats[idx].a, x1 = CX + (R1 + 3) * Math.cos(a), y1 = CY - (R1 + 3) * Math.sin(a), x2 = CX + (R1 + 9) * Math.cos(a), y2 = CY - (R1 + 9) * Math.sin(a);
    return `<svg class="hemi" viewBox="0 0 200 108" aria-hidden="true">${out.join('')}<line class="maj" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/><text class="majt" x="${(x2 + 2).toFixed(1)}" y="${(y2 + 3).toFixed(1)}">${maj}</text></svg>`;
  }

  function govHTML(races) {
    const n = (p) => races.filter((r) => r.winner && r.winner.party === p).length;
    const lead = (p) => races.filter((r) => r.leader && r.leader.party === p).length;
    const dem = n('DEM'), gop = n('GOP'), oth = races.filter((r) => r.winner && r.winner.party !== 'DEM' && r.winner.party !== 'GOP').length;
    const total = races.length || 36, w = (x) => (x / total * 100).toFixed(2) + '%';
    const flipsD = races.filter((r) => r.winner && r.gained === 'DEM').length, flipsR = races.filter((r) => r.winner && r.gained === 'GOP').length;
    const open = races.filter((r) => !r.winner && r.rating === 'tossup').length;
    const calledN = (p) => (p === 'OTH' ? oth : n(p));
    return `
      <div class="title"><b>Governatori</b><span class="muted small">${dem + gop + oth} di ${total} gare assegnate</span></div>
      <div class="bar" style="margin-top:8px">
        <div class="seg dem" style="width:${w(dem)}"></div><div class="seg lead dem" style="width:${w(lead('DEM'))}"></div>
        <div class="seg oth" style="width:${w(oth)}"></div><div class="spacer"></div>
        <div class="seg lead gop" style="width:${w(lead('GOP'))}"></div><div class="seg gop" style="width:${w(gop)}"></div>
      </div>
      <div class="nums"><span><span class="dem">${dem}</span> Dem.${lead('DEM') ? ` <span class="lead">+${lead('DEM')} in vantaggio</span>` : ''}</span>
        <span class="muted small">${total} poltrone al voto</span>
        <span>${lead('GOP') ? `<span class="lead">+${lead('GOP')} in vantaggio</span> ` : ''}Rep. <span class="gop">${gop}</span></span></div>
      ${projHTML(projection('G', calledN))}
      <div class="foot"><span>Governatori strappati: Dem. ${flipsD} · Rep. ${flipsR}</span><span>Gare incerte aperte: ${open}</span></div>
      ${50 - total > 0 ? `<div class="foot"><span>Le altre ${50 - total} poltrone non sono al voto nel ${DATE.slice(0, 4)}.</span></div>` : ''}`;
  }

  /* --- mappa nazionale --- */
  function renderMap() {
    $('mapTitle').textContent = OFFICE_NAME[state.office];
    const byState = {};
    for (const r of state.data[state.office] || []) (byState[r.state] = byState[r.state] || []).push(r);
    const svg = $('map');
    const geo = isGeo() && Object.keys(GEO).length;
    $('zoomctl').hidden = !geo;
    const shift = state.view === 'shift';
    $('legendRes').hidden = shift; $('legendShift').hidden = !shift; $('shiftSum').hidden = !shift;
    if (geo) {
      applyVB();
      // La mappa geografica (fino a 1 MB di contorni) si costruisce una volta per ufficio e vista;
      // agli aggiornamenti successivi cambiano solo colori, classi e frecce.
      const incremental = state.office !== 'H' || !!DIST();
      const key = state.view + state.office + (DIST() ? '+d' : '');
      if (incremental && state.mapKey === key && svg.firstElementChild) {
        if (shift) updateArrows(byState); else updateGeoMap(byState);
        return;
      }
      state.mapKey = incremental ? key : '';
      svg.innerHTML = geoMapHTML(byState, shift);
      if (shift) updateArrows(byState);
    } else {
      state.mapKey = '';
      svg.setAttribute('viewBox', '0 0 770 560'); svg.classList.remove('zoomed'); svg.innerHTML = tileMapHTML(byState);
    }
  }

  function dselPath() {
    const dist = DIST(); if (!dist || !state.openRace) return '';
    const r = state.byId.get(state.openRace);
    const dd = r && dist[r.state] && dist[r.state][String(r.seatNum)];
    return dd ? `<path class="dsel" d="${dd.d}" clip-path="url(#sc-${r.state})"/>` : '';
  }

  // Frecce dello spostamento rispetto alle presidenziali 2024: verso sinistra = Dem, verso destra = Rep
  function updateArrows(byState) {
    const svg = $('map'), house = state.office === 'H', dist = house ? DIST() : null;
    // sfondo neutro (serve anche dopo un cambio di tema)
    if (house) svg.querySelectorAll('.dist, g.hd > path:first-child').forEach((p) => p.setAttribute('fill', state.pal.none));
    else svg.querySelectorAll('g.st[data-st]').forEach((g) => {
      const p = g.firstElementChild; if (p) p.setAttribute('fill', (byState[g.dataset.st] || []).length ? state.pal.none : state.pal.off);
      g.classList.toggle('selected', state.selected === g.dataset.st);
    });
    svg.querySelectorAll('.sborder').forEach((p) => p.classList.toggle('selected', p.dataset.sb === state.selected));
    const dsg = svg.querySelector('.dselg'); if (dsg) dsg.innerHTML = dselPath();
    const out = [], used = {};
    let wSum = 0, sSum = 0, n = 0;
    const races = state.data[state.office] || [];
    for (const r of races) {
      if (!r.total || r.margin === null || !r.hist || r.eevp < 10 || r.uncontested) continue;
      let c;
      if (house) { const dd = dist && dist[r.state] && dist[r.state][String(r.seatNum)]; if (!dd) continue; c = dd.c; }
      else { const g = GEO[r.state]; if (!g) continue; c = g.c; }
      const k = used[r.state] = (used[r.state] || 0) + 1;      // due gare nello stesso stato (elezioni speciali)
      const y0 = c[1] + (house ? 0 : (k - 1) * 9);
      const s = r.margin - r.hist.margin;
      n++; wSum += r.total; sSum += s * r.total;
      const L = Math.min(70, Math.abs(s) * 2.4) * (house ? 0.55 : 1);
      if (L < 1) continue;
      const a = 28 * Math.PI / 180, cls = s > 0 ? 'dem' : 'gop';
      const x2 = c[0] + (s > 0 ? -1 : 1) * L * Math.cos(a), y2 = y0 - L * Math.sin(a);
      out.push(`<line class="arw ${cls}" x1="${c[0]}" y1="${y0.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" marker-end="url(#ah-${cls})" data-race-tip="${r.id}"/>`);
    }
    const g = svg.querySelector('.arrows'); if (g) g.innerHTML = out.join('');
    const avg = wSum ? sSum / wSum : null;
    const ref = races.find((r) => r.hist);
    const refTxt = ref ? `rispetto a: ${histLabel(ref.hist)}` : 'rispetto al voto di riferimento';
    $('shiftRef').textContent = `lunghezza = punti di margine ${refTxt}`;
    $('shiftSum').innerHTML = n
      ? `Spostamento medio, pesato per i voti: <b class="${avg >= 0 ? 'p dem' : 'p gop'}">${Math.abs(avg).toFixed(1)} punti verso ${avg >= 0 ? 'i Dem' : 'i Rep'}</b> ${refTxt}, in ${n} gare su ${races.length} con almeno il 10% scrutinato.`
      : ref ? `Le frecce compaiono quando una gara ha almeno il 10% dei voti scrutinati: mostrano di quanti punti il margine si è spostato ${refTxt}.` : 'Per queste gare il feed non contiene un voto di riferimento con cui confrontare il margine.';
  }

  function updateGeoMap(byState) {
    const svg = $('map');
    if (state.office === 'H') {
      svg.querySelectorAll('.dist[data-race-tip]').forEach((p) => {
        const r = state.byId.get(p.dataset.raceTip); if (!r) return;
        p.setAttribute('fill', colorFor(r));
        p.classList.toggle('flash', state.newCalls.has(r.id));
      });
      svg.querySelectorAll('g.hd > path:first-child').forEach((p) => p.setAttribute('fill', state.pal.none));
      svg.querySelectorAll('.sborder').forEach((p) => p.classList.toggle('selected', p.dataset.sb === state.selected));
      const g = svg.querySelector('.dselg'); if (g) g.innerHTML = dselPath();
    } else {
      svg.querySelectorAll('g.st[data-st]').forEach((g) => {
        const rs = byState[g.dataset.st] || [];
        const p = g.firstElementChild; if (p) p.setAttribute('fill', colorFor(rs[0] || null));
        g.classList.toggle('selected', state.selected === g.dataset.st);
        g.classList.toggle('flash', rs.some((r) => state.newCalls.has(r.id)));
      });
    }
  }

  /* --- zoom e trascinamento della mappa geografica --- */
  function applyVB() {
    const svg = $('map'), v = state.vb;
    svg.setAttribute('viewBox', `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}`);
    svg.style.setProperty('--z', (v.w / 960).toFixed(4));
    svg.classList.toggle('zoomed', v.w < 959);
    $('zoomReset').hidden = v.w >= 959;
  }
  function clampVB(v) {
    if (v.w >= 959) return { ...VB0 };
    v.x = Math.max(-40, Math.min(1000 - v.w, v.x));
    v.y = Math.max(-40, Math.min(540 - v.h, v.y));
    return v;
  }
  function svgPoint(ev) {
    const r = $('map').getBoundingClientRect(), v = state.vb;
    return { x: v.x + (ev.clientX - r.left) / r.width * v.w, y: v.y + (ev.clientY - r.top) / r.height * v.h };
  }
  function zoomAt(px, py, k) {
    if (!isGeo()) return;
    const v = state.vb, w = Math.max(48, Math.min(960, v.w * k)), h = w * 500 / 960;
    state.vb = clampVB({ x: px - (px - v.x) * (w / v.w), y: py - (py - v.y) * (h / v.h), w, h });
    applyVB();
  }
  function zoomToState(st) {
    if (!isGeo()) return;
    const b = getStateBBox(st), pad = 14;
    const w = Math.min(960, Math.max(80, b[2] - b[0] + 2 * pad, (b[3] - b[1] + 2 * pad) * 960 / 500)), h = w * 500 / 960;
    state.vb = clampVB({ x: (b[0] + b[2]) / 2 - w / 2, y: (b[1] + b[3]) / 2 - h / 2, w, h });
    applyVB();
  }

  function districtGrid(rs, cx, cy, cell, anchorLeft) {
    const n = rs.length, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
    const w = cols * cell, h = rows * cell;
    const ox = anchorLeft ? cx : cx - w / 2, oy = cy - h / 2;
    return { w, h, ox, oy, html: rs.map((r, i) => {
      const x = ox + (i % cols) * cell, y = oy + Math.floor(i / cols) * cell;
      const sel = state.openRace === r.id ? ' sel' : '';
      return `<rect class="d${sel}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" fill="${colorFor(r)}" data-race-tip="${r.id}"/>`;
    }).join('') };
  }

  function geoMapHTML(byState, shift) {
    const house = state.office === 'H';
    const dist = house ? DIST() : null;
    const shapes = [], overlay = [], labels = [], clips = [];
    const sideX = 905, sideY0 = 38, sideStep = house && !dist ? 30 : 22;
    for (const [st, g] of Object.entries(GEO)) {
      const rs = byState[st] || [];
      const sel = state.selected === st ? ' selected' : '';
      const flash = rs.some((r) => state.newCalls.has(r.id)) ? ' flash' : '';
      if (dist && dist[st] && rs.length) {
        // Camera con i confini veri: un poligono per distretto, poi il bordo dello stato sopra
        const ds = rs.map((r) => {
          const dd = dist[st][String(r.seatNum)];
          return dd ? `<path class="dist${state.newCalls.has(r.id) ? ' flash' : ''}" d="${dd.d}" fill="${colorFor(r)}" data-race-tip="${r.id}"/>` : '';
        }).join('');
        clips.push(`<clipPath id="sc-${st}"><path d="${g.d}"/></clipPath>`);
        shapes.push(`<g class="st hd" data-st="${st}"><path d="${g.d}" fill="${state.pal.none}"/><g clip-path="url(#sc-${st})">${ds}</g></g>`);
        overlay.push(`<path class="sborder${sel}" d="${g.d}" data-sb="${st}"/>`);
      } else {
        const fill = house ? (rs.length ? state.pal.none : state.pal.off) : colorFor(rs[0] || null);
        shapes.push(`<g class="st${sel}${flash}" data-st="${st}"><path d="${g.d}" fill="${fill}"/></g>`);
      }
      const side = SIDE.indexOf(st);
      let lx = g.c[0], ly = g.c[1], anchorLeft = false;
      if (side >= 0) {
        lx = sideX; ly = sideY0 + side * sideStep; anchorLeft = true;
        labels.push(`<path class="lead-line side" d="M${g.c[0]},${g.c[1]} L${lx - 4},${ly}"/>`);
      }
      const dim = rs.length ? '' : ' dim';
      const sideCls = anchorLeft ? ' side' : '';
      const inplace = (cls) => (anchorLeft ? `<text class="${cls} inplace${dim}" x="${g.c[0]}" y="${g.c[1] + 4}" data-st="${st}">${st}</text>` : '');
      if (dist) {
        labels.push(`<text class="lbl small${dim}${sideCls}" x="${anchorLeft ? lx + 10 : lx}" y="${ly + 4}" data-st="${st}">${st}</text>${inplace('lbl small')}`);
      } else if (house && rs.length) {
        const cell = rs.length > 30 ? 6 : rs.length > 12 ? 7 : 8;
        const grid = districtGrid(rs, anchorLeft ? lx + 22 : lx, ly, cell, anchorLeft);
        labels.push(`<g data-st="${st}" class="st">${grid.html}<text class="lbl" x="${anchorLeft ? lx + 8 : lx}" y="${anchorLeft ? ly + 4 : (grid.oy - 3).toFixed(1)}">${st}</text></g>`);
      } else {
        labels.push(`<text class="lbl${dim}${sideCls}" x="${anchorLeft ? lx + 10 : lx}" y="${ly + 4}" data-st="${st}">${st}</text>${inplace('lbl')}`);
      }
    }
    if (dist) overlay.push(`<g class="dselg">${dselPath()}</g><path class="hovp"/>`);
    if (shift) {
      const mk = (c) => `<marker id="ah-${c}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--${c})"/></marker>`;
      return `<defs>${mk('dem')}${mk('gop')}${clips.join('')}</defs>` + shapes.join('') + overlay.join('') + labels.join('') + '<g class="arrows"></g>';
    }
    return (clips.length ? `<defs>${clips.join('')}</defs>` : '') + shapes.join('') + overlay.join('') + labels.join('');
  }

  function tileMapHTML(byState) {
    const SZ = 70, parts = [];
    for (const [st, [col, row]] of Object.entries(TILES)) {
      const x = col * SZ, y = row * SZ, rs = byState[st] || [];
      const sel = state.selected === st ? ' selected' : '';
      const flash = rs.some((r) => state.newCalls.has(r.id)) ? ' flash' : '';
      const dim = rs.length === 0 ? ' dim' : '';
      if (state.office === 'H' && rs.length) {
        const n = rs.length, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
        const inset = 4, labelH = 18, aw = SZ - 2 * inset, ah = SZ - 2 * inset - labelH;
        const cell = Math.min(aw / cols, ah / rows);
        const grid = districtGrid(rs, x + SZ / 2, y + inset + labelH + ah / 2, cell, false);
        parts.push(`<g class="tile${sel}${flash}" data-st="${st}"><rect class="bg" x="${x}" y="${y}" width="${SZ}" height="${SZ}" rx="6" fill="${state.pal.off}"/>${grid.html}<text x="${x + 6}" y="${y + 17}">${st}</text></g>`);
      } else {
        let bg;
        if (rs.length <= 1) bg = `<rect class="bg" x="${x}" y="${y}" width="${SZ}" height="${SZ}" rx="6" fill="${colorFor(rs[0] || null)}"/>`;
        else {
          const h = SZ / rs.length;
          bg = `<rect class="bg" x="${x}" y="${y}" width="${SZ}" height="${SZ}" rx="6" fill="${state.pal.off}"/>` +
            rs.map((r, i) => `<rect x="${x + 2}" y="${(y + 2 + i * h).toFixed(1)}" width="${SZ - 4}" height="${(h - 4).toFixed(1)}" rx="4" fill="${colorFor(r)}"/>`).join('');
        }
        const r0 = rs[0];
        const sub = r0 ? (r0.winner ? r0.winner.name.split(' ').pop() : r0.leader ? r0.leader.name.split(' ').pop() : (r0.eevp ? pctS(r0.eevp) + '%' : '')) : '';
        parts.push(`<g class="tile${sel}${flash}${dim}" data-st="${st}">${bg}<text x="${x + SZ / 2}" y="${y + 30}" text-anchor="middle">${st}</text><text x="${x + SZ / 2}" y="${y + 50}" text-anchor="middle" style="font-size:11px;font-weight:500">${esc(sub)}</text></g>`);
      }
    }
    return parts.join('');
  }

  function raceLabel(r) {
    if (r.office === 'H') return `${r.stateName} — Distretto ${r.seatNum}`;
    if (r.office === 'S') return `${r.stateName} — Senato${r.special ? ' (speciale)' : ''}`;
    return `${r.stateName} — Governatore`;
  }

  /* --- tooltip --- */
  function raceTipHTML(r) {
    const badge = r.winner ? '<span class="badge called">Assegnata</span>'
      : r.status && r.status !== 'too_early' ? `<span class="badge">${esc(STATUS_IT[r.status] || r.status)}</span>`
        : r.rating ? `<span class="badge">${esc(RATING_IT[r.rating] || r.rating)}</span>` : '';
    const rows = r.cands.slice(0, 3).map((c) => `<div class="trow"><span><span class="p ${partyClass(c.party)}">${esc(c.partyLabel)}</span> ${esc(c.name)}${c.winner ? ' <span class="chk">✓</span>' : ''}</span><b>${r.total ? c.pct.toFixed(1) + '%' : ''}</b></div>`).join('');
    const parts = [r.total ? `${pctS(r.eevp)}% scrutinato` : 'Nessun voto'];
    if (r.hist) parts.push(`${histLabel(r.hist)}: ${fmtMargin(r.hist.margin)}`);
    if (r.hist && r.margin !== null && r.total && r.eevp >= 10) { const sw = r.margin - r.hist.margin; parts.push(`spostamento ${Math.abs(sw).toFixed(1)} punti verso ${sw >= 0 ? 'i Dem' : 'i Rep'}`); }
    const cu = catchUp(r);
    if (cu && cu.need !== null && r.eevp >= 20) parts.push(cu.need > 100 ? `${esc(cu.b.name)} non può più recuperare` : `a ${esc(cu.b.name)} serve il ${cu.need.toFixed(0)}% dei restanti`);
    return `<div class="th"><b>${esc(raceLabel(r))}</b>${badge}</div>${rows}<div class="tf">${parts.join(' · ')}</div>`;
  }
  function stateTipHTML(st) {
    const rs = (state.data[state.office] || []).filter((r) => r.state === st);
    if (!rs.length) return `<div class="th"><b>${esc(STATE_NAMES[st] || st)}</b></div><div class="tf">Nessuna gara: ${OFFICE_ONE[state.office]} non al voto qui.</div>`;
    if (state.office !== 'H') return rs.map(raceTipHTML).join('<hr>');
    const c = (f) => rs.filter(f).length;
    return `<div class="th"><b>${esc(STATE_NAMES[st])}</b><span class="badge">${rs.length} distrett${rs.length === 1 ? 'o' : 'i'}</span></div>
      <div class="trow"><span class="p dem">Dem.</span><b>${c((r) => r.winner && r.winner.party === 'DEM')} eletti · ${c((r) => r.leader && r.leader.party === 'DEM')} in vantaggio</b></div>
      <div class="trow"><span class="p gop">Rep.</span><b>${c((r) => r.winner && r.winner.party === 'GOP')} eletti · ${c((r) => r.leader && r.leader.party === 'GOP')} in vantaggio</b></div>
      <div class="tf">${c((r) => !r.total)} senza voti · passa sui quadratini per i singoli distretti</div>`;
  }
  function countyTipHTML(raceId, fips) {
    const feed = raceFeeds.get(raceId), r = state.byId.get(raceId);
    const u = feed && feed.units && feed.units.find((x) => x.fips === fips);
    const geo = r && geoCache[r.state];
    const name = (u && u.name) || (geo && geo.counties[fips] && geo.counties[fips].n) || 'Contea';
    if (!u) return `<div class="th"><b>${esc(name)}</b></div><div class="tf">Fuori dalla gara</div>`;
    const rows = u.cands.slice(0, 3).map((c) => `<div class="trow"><span><span class="p ${partyClass(c.party)}">${esc(PARTY_IT[c.party] || c.party)}</span> ${esc(c.name)}</span><b>${u.total ? c.pct.toFixed(1) + '%' : ''}</b></div>`).join('');
    const parts = [u.total ? `${pctS(u.eevp)}% scrutinato · ${fmtInt.format(u.total)} voti` : `Nessun voto · ~${fmtInt.format(u.expected)} attesi`];
    if (u.hist !== null) parts.push(`2024: ${fmtMargin(u.hist)}`);
    if (u.hist !== null && u.margin !== null) { const s = u.margin - u.hist; parts.push(`spostamento ${Math.abs(s).toFixed(1)} punti verso ${s >= 0 ? 'i Dem' : 'i Rep'}`); }
    return `<div class="th"><b>${esc(name)}</b></div>${rows}<div class="tf">${parts.join(' · ')}</div>`;
  }

  const tip = $('tip');
  const canHover = window.matchMedia('(hover: hover)').matches;
  function moveTip(ev) {
    const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + w > innerWidth - 8) x = ev.clientX - w - pad;
    if (y + h > innerHeight - 8) y = ev.clientY - h - pad;
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
  }
  let tipKey = '';
  function onHover(ev) {
    const t = ev.target instanceof Element ? ev.target : null;
    const cty = t && t.closest('.cmap [data-cty]');
    const race = !cty && t && t.closest('[data-race-tip]');
    const st = !cty && !race && t && t.closest('#map [data-st]');
    let key = '', html = '';
    if (cty) { const id = cty.closest('.cmap').dataset.race; key = 'c' + id + cty.dataset.cty; if (key !== tipKey) html = countyTipHTML(id, cty.dataset.cty); }
    else if (race && state.byId.has(race.dataset.raceTip)) { key = 'r' + race.dataset.raceTip; if (key !== tipKey) html = raceTipHTML(state.byId.get(race.dataset.raceTip)); }
    else if (st) { key = 's' + st.dataset.st + state.office; if (key !== tipKey) html = stateTipHTML(st.dataset.st); }
    if (!key) { tip.hidden = true; tipKey = ''; return; }
    if (html) { tip.innerHTML = html; tipKey = key; }
    tip.hidden = false; moveTip(ev);
  }

  let hovEl = null;
  document.addEventListener('pointerover', (ev) => {
    const p = ev.target instanceof Element ? ev.target.closest('#map path.dist, .dmap path.dd') : null;
    if (p === hovEl) return;
    const old = hovEl && hovEl.ownerSVGElement && hovEl.ownerSVGElement.querySelector('.hovp');
    if (old) old.removeAttribute('d');
    hovEl = p;
    const h = p && p.ownerSVGElement && p.ownerSVGElement.querySelector('.hovp');
    if (h) {
      const svgEl = p.ownerSVGElement, g = p.closest('[data-st]');
      const cl = svgEl.classList.contains('dmap') ? svgEl.dataset.clip : g ? 'sc-' + g.dataset.st : '';
      if (cl) h.setAttribute('clip-path', `url(#${cl})`); else h.removeAttribute('clip-path');
      h.setAttribute('d', p.getAttribute('d'));
    }
  });

  /* --- pannello di dettaglio --- */
  function selectState(st, raceId) {
    state.selected = st;
    if (raceId !== undefined) state.openRace = raceId;
    writeHash();
    renderMap(); renderDetail();
    const target = raceId ? document.querySelector(`[data-race-box="${CSS.escape(raceId)}"]`) : null;
    if (target) target.scrollIntoView({ block: 'nearest' });
    else if (window.innerWidth <= 900) $('detail').scrollIntoView({ block: 'start' });
  }

  function showsPanel(r) {
    if (r.office !== 'H') return true;
    return state.openRace === r.id || (state.data.H || []).filter((x) => x.state === r.state).length === 1;
  }

  function renderDetail() {
    const box = $('detail');
    const key = state.office + (state.selected || '');
    const keep = key === state.detailKey ? box.scrollTop : 0;
    state.detailKey = key;
    if (!state.selected) { box.innerHTML = '<p class="muted">Clicca uno stato sulla mappa per vedere le gare, i candidati e i risultati per contea.</p>'; return; }
    const st = state.selected;
    const rs = (state.data[state.office] || []).filter((r) => r.state === st);
    const other = OFFICES.filter((o) => o !== state.office && (state.data[o] || []).some((r) => r.state === st))
      .map((o) => `<button type="button" class="mini" data-go="${o}">${OFFICE_NAME[o]}</button>`).join('');
    const closing = state.closings.find((c) => c.st === st);
    const closedTxt = closing ? (closing.at <= Date.now() ? `Seggi chiusi alle ${fmtTime.format(closing.at)}` : `Seggi aperti fino alle ${fmtTime.format(closing.at)}`) : '';
    const xp = statePanelInner(st);
    box.innerHTML = `<div class="dhead"><h3>${esc(STATE_NAMES[st] || st)} <span class="muted small">· ${OFFICE_NAME[state.office]}</span></h3>
        <span class="dbtns"><button type="button" class="mini" data-share="1" title="Copia il link a questa vista">Condividi</button><button type="button" class="mini" data-close="1" aria-label="Chiudi">✕</button></span></div>
      <p class="muted small" style="margin:0">${closedTxt}</p>
      <div class="links">${other ? '<span class="muted small">Vedi anche:</span> ' + other : ''}</div>
      ${state.office === 'H' && rs.length > 1 && DIST() && DIST()[st] ? districtMapSVG(st, rs) : ''}
      ${rs.length ? rs.map((r) => raceHTML(r, true)).join('') : '<p class="muted">Nessuna gara per questo ufficio.</p>'}
      <div class="xpanel" data-xp="${st}"${xp ? ' data-filled="1"' : ''}><h4 class="xh">Nello stesso stato</h4>${xp || '<p class="muted small">Caricamento di referendum e altre cariche statali…</p>'}</div>`;
    box.scrollTop = keep;
    refreshCountyPanels(false);
    refreshStatePanel(false);
  }

  /* --- referendum e cariche statali: file results-<stato>.json, scaricato solo su richiesta --- */
  const SEARCH_URL = `https://static01.nyt.com/elections-assets/pages/data/feeds/f764fc52-8405-4ef4-b6cc-5b44ed38d840/search/${DATE}.json`;
  const MEASURE_IT = { Proposition: 'Proposta', Amendment: 'Emendamento', 'Constitutional Amendment': 'Emendamento costituzionale', Question: 'Quesito',
    Issue: 'Quesito', Measure: 'Misura', Initiative: 'Iniziativa', Proposal: 'Proposta', Referendum: 'Referendum', 'Advisory Question': 'Quesito consultivo',
    'Public Question': 'Quesito', 'Bond Measure': 'Prestito obbligazionario' };
  const OFFICE_IT = { President: 'Presidente', 'Attorney General': 'Procuratore generale', 'Lieutenant Governor': 'Vicegovernatore', 'Secretary of State': 'Segretario di Stato',
    Treasurer: 'Tesoriere', Comptroller: 'Revisore dei conti', Controller: 'Revisore dei conti', 'Comptroller General': 'Revisore generale', Auditor: 'Revisore',
    'Supreme Court': 'Corte suprema', 'Appeals Court': "Corte d'appello", 'Criminal Appeals Court': "Corte d'appello penale",
    'Insurance Commissioner': 'Commissario alle assicurazioni', 'Superintendent of Public Instruction': "Sovrintendente all'istruzione",
    'Agriculture Commissioner': "Commissario all'agricoltura", 'Railroad Commissioner': 'Commissario per energia e ferrovie', 'Land Commissioner': 'Commissario del demanio',
    'Chief Financial Officer': 'Direttore finanziario', 'Labor Commissioner': 'Commissario al lavoro', 'Public Service Commission': 'Commissione dei servizi pubblici' };
  const stateFeeds = new Map(), stateInflight = new Map();
  function stateSlug(st) { return st === 'DC' ? 'washington-dc' : (STATE_NAMES[st] || st).toLowerCase().replace(/[^a-z]+/g, '-'); }

  function loadStateFeed(st) {
    if (stateInflight.has(st)) return stateInflight.get(st);
    const slug = 'results-' + stateSlug(st);
    const p = (async () => {
      try {
        const j = await getJSON('st:' + st, BASE + slug + '.json', `feed/race/${slug}.json`);
        if (!j) return false;
        stateFeeds.set(st, parseStateFeed(j));
        commitJSON('st:' + st);
        return true;
      } catch (e) {
        if (!stateFeeds.has(st)) { stateFeeds.set(st, { err: e.message, measures: [], offices: [] }); return true; }
        return false;
      } finally { stateInflight.delete(st); }
    })();
    stateInflight.set(st, p);
    return p;
  }

  function parseStateFeed(j) {
    const measures = [], offices = [];
    for (const raw of j.races || []) {
      if (raw.coverage !== 'state' || raw.office_id === 'S' || raw.office_id === 'G' || raw.office_id === 'H') continue;
      const n = normalize(DEMO ? demoize(raw) : raw, 'X');
      const yes = n.cands.find((c) => c.party === 'YES'), no = n.cands.find((c) => c.party === 'NO');
      if (yes || raw.ballot_measure_text) {
        measures.push({ ...n, yes, no, officeName: raw.office, title: (raw.title && raw.title.default) || `${raw.office} ${raw.seat_number || ''}`.trim(),
          desc: (raw.seat || '').replace(/^[^-]*-\s*/, ''), threshold: raw.win_threshold || 50 });
      } else offices.push({ ...n, officeName: raw.office, seatName: raw.seat || '' });
    }
    measures.sort((a, b) => a.officeName.localeCompare(b.officeName) || a.seatNum - b.seatNum || a.title.localeCompare(b.title));
    return { measures, offices };
  }

  const OPT_IT = { yes: 'Sì', no: 'No', for: 'Favorevoli', against: 'Contrari', repeal: 'Abrogare', retain: 'Mantenere', approve: 'Approvare', reject: 'Respingere' };
  function optLabel(c, fallback) { return c ? OPT_IT[String(c.name).toLowerCase()] || c.name : fallback; }

  function measureHTML(m, withState) {
    const y = m.yes ? m.yes.pct : 0, n = m.no ? m.no.pct : 0, thr = Number(m.threshold) || 50;
    const passed = m.winner ? m.winner.party === 'YES' : null;
    const yl = optLabel(m.yes, 'Sì'), nl = optLabel(m.no, 'No');
    const badge = m.winner ? `<span class="badge ${passed ? 'yes' : 'no'}">${passed ? 'Approvato' : 'Respinto'}</span>`
      : m.total ? `<span class="badge">Avanti: ${y >= thr ? yl : nl}</span>` : '';
    return `<div class="measure"${withState ? ` data-mst="${esc(m.state)}"` : ''}>
      <div class="rh"><b>${withState ? esc(m.stateName) + ' · ' : ''}${esc(m.title)}</b>${badge}</div>
      <div class="mdesc"><span class="mtype">${esc(MEASURE_IT[m.officeName] || (OFFICE_IT[m.officeName] ? OFFICE_IT[m.officeName] + ' · conferma' : m.officeName))}</span> ${esc(m.desc)}</div>
      <div class="ynbar"><div class="y" style="width:${y.toFixed(1)}%"></div><div class="n" style="width:${n.toFixed(1)}%"></div><i class="thr" style="left:${thr}%"></i></div>
      <div class="rep"><span><b class="yes">${yl} ${m.total ? y.toFixed(1) + '%' : '—'}</b> · <b class="no">${nl} ${m.total ? n.toFixed(1) + '%' : '—'}</b></span>
        <span>${m.total ? pctS(m.eevp) + '% scrutinato' : 'Nessun voto'}${thr !== 50 ? ` · serve il ${thr}% di ${yl}` : ''}</span></div>
    </div>`;
  }

  function officeRowHTML(o) {
    const top = o.cands.slice(0, 2).map((c) => `<span class="oc${c.winner ? ' win' : ''}"><span class="p ${partyClass(c.party)}">${esc(c.partyLabel)}</span> ${esc(c.name)}${o.total ? ` <b>${c.pct.toFixed(1)}%</b>` : ''}${c.winner ? ' <span class="chk">✓</span>' : ''}</span>`).join('');
    const label = (OFFICE_IT[o.officeName] || o.officeName) + (o.seatName && o.seatName !== o.officeName ? ` · ${o.seatName}` : '');
    return `<div class="orow"><div class="on">${esc(label)}${o.winner ? ' <span class="badge called">Assegnata</span>' : ''}${o.gained && o.winner ? ' <span class="badge flip">Strappata</span>' : ''}</div>
      <div class="ocs">${top}</div><div class="rep"><span>${o.total ? pctS(o.eevp) + '% scrutinato' : 'Nessun voto'}</span></div></div>`;
  }

  function statePanelInner(st) {
    const f = stateFeeds.get(st);
    if (!f) return '';
    if (f.err && !f.measures.length && !f.offices.length) return `<p class="muted small">Referendum e altre cariche non disponibili (${esc(f.err)}).</p>`;
    if (!f.measures.length && !f.offices.length) return '<p class="muted small">Nessun referendum né altra carica statale al voto.</p>';
    return `${f.measures.length ? `<h4 class="ch">Referendum (${f.measures.length})</h4>${f.measures.map((m) => measureHTML(m, false)).join('')}` : ''}
      ${f.offices.length ? `<h4 class="ch">Altre cariche statali</h4>${f.offices.map(officeRowHTML).join('')}` : ''}`;
  }

  async function refreshStatePanel(reload) {
    const el = document.querySelector('[data-xp]'); if (!el) return;
    const st = el.dataset.xp;
    const changed = !stateFeeds.has(st) || reload ? await loadStateFeed(st) : false;
    const cur = document.querySelector(`[data-xp="${st}"]`);
    if (!cur || (cur.dataset.filled && !changed)) return;
    cur.innerHTML = '<h4 class="xh">Nello stesso stato</h4>' + (statePanelInner(st) || '<p class="muted small">Nessun dato.</p>');
    cur.dataset.filled = '1';
  }

  // Referendum di tutto il paese: si caricano solo i file degli stati che ne hanno, su richiesta
  async function pool(items, n, fn) { const q = [...items]; await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()); })); }
  function loadAllMeasures() {
    if (!state.measLoading) state.measLoading = loadAllMeasuresInner().finally(() => { state.measLoading = null; });
    return state.measLoading;
  }
  async function loadAllMeasuresInner() {
    if (!state.measStates && ARCHIVE) state.measStates = Object.keys(GEO);
    if (!state.measStates) {
      $('measInfo').textContent = 'Cerco gli stati con referendum…';
      try {
        const r = await fetch(SEARCH_URL, { cache: 'no-cache' });
        const j = await r.json();
        const sts = new Set((j.data || []).filter((x) => MEASURE_IT[x.office] && x.headline && x.state && x.headline.startsWith(x.state)).map((x) => x.statePostal));
        state.measStates = Object.keys(GEO).filter((st) => sts.has(st));
      } catch (e) { state.measStates = Object.keys(GEO); }
    }
    let done = 0, changed = false;
    const n = state.measStates.length;
    if (!state.measAt) $('measInfo').textContent = `Caricamento: 0 di ${n} stati…`;
    await pool(state.measStates, 6, async (st) => {
      if (await loadStateFeed(st)) changed = true;
      done++;
      if (!state.measAt) $('measInfo').textContent = `Caricamento: ${done} di ${n} stati…`;
    });
    const first = !state.measAt;
    state.measAt = Date.now();
    if (changed || first) renderMeasures();
  }

  function renderMeasTools() {
    $('measTools').innerHTML = `<div class="viewtoggle" role="group" aria-label="Filtro">${[['all', 'Tutti'], ['open', 'Da decidere'], ['yes', 'Approvati'], ['no', 'Respinti']]
      .map(([k, l]) => `<button type="button" class="vbtn${state.measF === k ? ' active' : ''}" data-mf="${k}">${l}</button>`).join('')}</div>
      <input type="search" id="measQ" placeholder="Filtra per stato o tema (in inglese)" aria-label="Filtra i referendum" value="${esc(state.measQ)}">`;
  }

  function renderMeasures() {
    if (!state.measAt) return;
    const all = state.measStates.flatMap((st) => (stateFeeds.get(st) || {}).measures || []);
    const q = state.measQ.trim().toLowerCase(), f = state.measF;
    const list = all.filter((m) => (!q || `${m.stateName} ${m.title} ${m.desc}`.toLowerCase().includes(q))
      && (f === 'all' || (f === 'open' && !m.winner) || (m.winner && m.winner.party === f.toUpperCase())));
    const nY = all.filter((m) => m.winner && m.winner.party === 'YES').length, nN = all.filter((m) => m.winner && m.winner.party === 'NO').length;
    $('measInfo').textContent = `${all.length} referendum in ${state.measStates.length} stati · ${nY} approvati · ${nN} respinti`;
    $('measList').innerHTML = list.length ? list.map((m) => measureHTML(m, true)).join('') : '<p class="muted">Nessun referendum corrisponde al filtro.</p>';
  }

  function toast(text) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = text;
    $('toasts').appendChild(el); setTimeout(() => el.remove(), 4000);
  }

  function districtMapSVG(st, rs) {
    const dist = DIST()[st];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const k of Object.keys(dist)) { const b = dist[k].b; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
    const w = x1 - x0, h = y1 - y0, pad = Math.max(w, h) * 0.03, fs = Math.max(w, h) / 32;
    const paths = [], labels = [];
    for (const r of rs) {
      const dd = dist[String(r.seatNum)]; if (!dd) continue;
      paths.push(`<path class="dd" d="${dd.d}" fill="${colorFor(r)}" data-race-tip="${r.id}" data-dist="${r.id}"/>`);
      if (Math.min(dd.b[2] - dd.b[0], dd.b[3] - dd.b[1]) > fs * 1.5) labels.push(`<text x="${dd.c[0]}" y="${(dd.c[1] + fs * 0.35).toFixed(1)}" style="font-size:${fs.toFixed(2)}px">${r.seatNum}</text>`);
    }
    const selR = rs.find((r) => r.id === state.openRace), sd = selR && dist[String(selR.seatNum)];
    const sp = GEO[st] ? GEO[st].d : '';
    const clipAttr = sp ? ` clip-path="url(#dc-${st})"` : '';
    return `<svg class="dmap" viewBox="${(x0 - pad).toFixed(1)} ${(y0 - pad).toFixed(1)} ${(w + 2 * pad).toFixed(1)} ${(h + 2 * pad).toFixed(1)}" role="img" aria-label="Distretti dello stato"${sp ? ` data-clip="dc-${st}"` : ''}>${sp ? `<defs><clipPath id="dc-${st}"><path d="${sp}"/></clipPath></defs>` : ''}<g${clipAttr}>${paths.join('')}</g>${sd ? `<path class="dsel" d="${sd.d}"${clipAttr}/>` : ''}<path class="hovp"/><g class="dlbl">${labels.join('')}</g></svg>
      <div class="dchips" role="group" aria-label="Distretti">${rs.map((r) => `<button type="button" class="dchip${state.openRace === r.id ? ' sel' : ''}" data-dist="${r.id}" data-race-tip="${r.id}" style="--c:${colorFor(r)}" aria-label="Distretto ${r.seatNum}">${r.seatNum}</button>`).join('')}</div>
      <p class="muted small" style="margin:4px 0 6px">Confini 2026 dei distretti (Census). Clicca un distretto sulla mappa o il suo numero per i dettagli e la mappa per contea.</p>`;
  }

  function raceHTML(r, full) {
    const badges = [];
    if (r.winner) badges.push('<span class="badge called">Assegnata</span>');
    else if (r.runoff) badges.push('<span class="badge runoff">Ballottaggio</span>');
    else if (r.status && r.status !== 'too_early') badges.push(`<span class="badge">${esc(STATUS_IT[r.status] || String(r.status).replace(/_/g, ' '))}</span>`);
    if (r.gained && r.winner) badges.push(`<span class="badge flip">Strappato (${esc(PARTY_IT[r.gained] || r.gained)})</span>`);
    if (r.rating) badges.push(`<span class="badge ${r.rating === 'tossup' ? '' : partyClass(String(r.rating).endsWith('dem') ? 'DEM' : 'GOP')}">${esc(RATING_IT[r.rating] || r.rating)}</span>`);
    if (r.uncontested) badges.push('<span class="badge">Senza avversari</span>');
    const list = full ? r.cands : r.cands.slice(0, 3);
    const cands = list.map((c) => `<li class="cand ${c.winner ? 'win' : ''}${full && c.img ? '' : ' noph'}">
        ${full && c.img ? `<img class="ph ${partyClass(c.party)}" src="${esc(c.img)}" alt="" loading="lazy" onerror="this.parentNode.classList.add('noph');this.remove()">` : ''}
        <span class="nm">${c.winner ? '<span class="chk">✓</span>' : ''}<span class="p ${partyClass(c.party)}">${esc(c.partyLabel)}</span>${esc(c.name)}${c.incumbent ? ' <span class="muted small">(uscente)</span>' : ''}</span>
        <span class="pct">${r.total ? c.pct.toFixed(1) + '%' : '—'}</span>
        <span class="vt">${r.total ? fmtInt.format(c.votes) : ''}</span>
        <span class="track"><span class="fill ${partyClass(c.party)}" style="width:${Math.min(100, c.pct).toFixed(1)}%"></span></span>
      </li>`).join('');
    const rep = r.total
      ? `<span>Scrutinato: <b>${pctS(r.eevp)}%</b> del voto atteso</span><span>${fmtInt.format(r.total)} voti · ${r.precReporting}/${r.precTotal} sezioni</span>`
      : '<span>Nessun voto scrutinato</span>';
    const when = r.calledAt ? `<span>Assegnata ${atWhen(r.calledAt)}</span>` : (full && r.updatedAt && r.total ? `<span>Aggiornata ${atWhen(r.updatedAt)}</span>` : '');
    const title = full ? (r.office === 'H' ? `Distretto ${r.seatNum}` : OFFICE_ONE[r.office] + (r.special ? ' (speciale)' : '')) : raceLabel(r);
    let analysis = '', panel = '', toggle = '';
    if (full) {
      const bits = [];
      const cu = catchUp(r);
      if (cu) {
        if (cu.remaining > 0) {
          bits.push(`Voti ancora da contare: <b>~${fmtInt.format(cu.remaining)}</b> (stima). ` + (cu.need > 100
            ? `<b>${esc(cu.b.name)}</b> non può più recuperare ${fmtInt.format(cu.gap)} voti con i restanti stimati.`
            : `Per superare ${esc(cu.a.name)}, <b>${esc(cu.b.name)}</b> dovrebbe prendere il <b>${cu.need.toFixed(1)}%</b> dei voti restanti.`));
        } else bits.push(`Vantaggio di ${fmtInt.format(cu.gap)} voti a scrutinio praticamente completo.`);
      }
      if (r.hist) {
        const who = r.hist.margin >= 0 ? r.hist.dem : r.hist.rep;
        let s = `${esc(histLabel(r.hist))}: <b>${fmtMargin(r.hist.margin)}</b>${who ? ` (${esc(who)})` : ''}.`;
        if (r.margin !== null && r.eevp >= 10) {
          const swing = r.margin - r.hist.margin;
          s += ` Ora <b>${fmtMargin(r.margin)}</b>: spostamento di <b>${Math.abs(swing).toFixed(1)}</b> punti verso ${swing >= 0 ? 'i Dem' : 'i Rep'}.`;
        }
        bits.push(s);
      }
      if (r.rcv) bits.unshift(`<b>Voto a scelta multipla</b>, dopo ${r.rcv.n} turni di conteggio: ${r.rcv.fin.map((c) => `<span class="p ${partyClass(c.party)}">${esc(c.partyLabel)}</span> ${esc(c.name)} <b>${c.pct.toFixed(1)}%</b>`).join(' · ')}.`);
      if (bits.length) analysis = `<div class="analysis">${bits.join('<br>')}</div>`;
      if (r.url) analysis += `<div class="rep"><a href="${esc(/^https:\/\//.test(r.url) ? r.url : '#')}" target="_blank" rel="noopener">Pagina NYT della gara ↗</a></div>`;
      if (r.office === 'H' && (state.data.H || []).filter((x) => x.state === r.state).length > 1) {
        toggle = `<button type="button" class="mini${state.openRace === r.id ? ' on' : ''}" data-open="${r.id}">${state.openRace === r.id ? 'Chiudi contee' : 'Per contea'}</button>`;
      }
      if (showsPanel(r)) {
        const inner = countyPanelInner(r);
        panel = `<div class="cpanel" data-cp="${r.id}"${inner ? ' data-filled="1"' : ''}>${inner || '<p class="muted small">Caricamento dei risultati per contea…</p>'}</div>`;
      }
    } else if (r.hist && r.margin !== null) {
      analysis = `<div class="rep"><span>Margine ${fmtMargin(r.margin)} · 2024: ${fmtMargin(r.hist.margin)}</span></div>`;
    }
    return `<div class="race"${full ? ` data-race-box="${r.id}"` : ''}><div class="rh"><b>${esc(title)}</b><span>${badges.join(' ')} ${toggle}</span></div>
      <ul class="cands">${cands}</ul><div class="rep">${rep}${when}</div>${analysis}${panel}</div>`;
  }

  /* --- risultati per contea (feed della singola gara + contorni in counties/XX.json) --- */
  const raceFeeds = new Map(), inflight = new Map(), geoCache = {}, geoPending = {};
  function raceSlug(r) { const m = r.url && /\/(results-[a-z0-9-]+)\.html/.exec(r.url); return m ? m[1] : null; }

  function loadGeo(st) {
    if (geoCache[st] !== undefined) return Promise.resolve(geoCache[st]);
    if (!geoPending[st]) {
      geoPending[st] = fetch(`counties/${st}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
        .then((g) => { geoCache[st] = g; return g; });
    }
    return geoPending[st];
  }

  function loadRaceFeed(r) {
    const slug = raceSlug(r);
    if (!slug) { raceFeeds.set(r.id, { err: 'feed della gara non trovato' }); return Promise.resolve(true); }
    if (inflight.has(r.id)) return inflight.get(r.id);
    const p = (async () => {
      try {
        const j = await getJSON('r:' + slug, BASE + slug + '.json', `feed/race/${slug}.json`);
        if (!j) return false;
        raceFeeds.set(r.id, parseRaceFeed(j, r));
        commitJSON('r:' + slug);
        return true;
      } catch (e) {
        if (!raceFeeds.has(r.id)) { raceFeeds.set(r.id, { err: e.message }); return true; }
        return false;
      } finally { inflight.delete(r.id); }
    })();
    inflight.set(r.id, p);
    return p;
  }

  function parseRaceFeed(json, r) {
    const race = (json.races || []).find((x) => x.nyt_id === r.id) || (json.races || [])[0];
    if (!race) return { units: [], ts: [] };
    const meta = race.candidate_metadata || {};
    const partyOf = (id) => (meta[id] && meta[id].party && meta[id].party.nyt_id) || 'OTH';
    const src = DEMO ? demoizeUnits(race, r, partyOf) : race;
    const rus = (src.reporting_units || []).filter((u) => u.level !== 'state');
    const levels = new Set(rus.map((u) => u.level));
    // contea se c'è; altrimenti comuni (Nord-Est) sommati per contea; altrimenti le unità così come sono (Alaska)
    const lvl = levels.has('county') ? 'county' : levels.has('township') ? 'township' : null;
    const chosen = lvl ? rus.filter((u) => u.level === lvl) : rus;
    const agg = new Map();
    for (const u of chosen) {
      const key = lvl && u.fips_county ? u.fips_county : u.nyt_id;
      let a = agg.get(key);
      if (!a) {
        a = { fips: lvl && u.fips_county ? u.fips_county : null, name: lvl === 'township' ? null : u.name, votes: {}, total: 0, expected: 0, hw: 0, hm: 0, eevp: undefined };
        agg.set(key, a);
      }
      a.total += u.total_votes || 0; a.expected += u.total_expected_vote || 0;
      for (const c of u.candidates || []) a.votes[c.nyt_id] = (a.votes[c.nyt_id] || 0) + ((c.votes && c.votes.total) || 0);
      const h = histOf(u);
      if (h) { const w = h.votes || u.total_expected_vote || 1; a.hw += w; a.hm += h.margin * w; }
      if (lvl !== 'township') a.eevp = u.eevp || 0;
    }
    const units = [...agg.values()].map((a) => {
      const cands = Object.entries(a.votes).map(([id, v]) => ({ id, party: partyOf(id), name: candName(meta[id], id), votes: v, pct: a.total ? v / a.total * 100 : 0 }))
        .sort((x, y) => y.votes - x.votes);
      const d = cands.find((c) => c.party === 'DEM'), g = cands.find((c) => c.party === 'GOP');
      const eevp = a.eevp !== undefined ? a.eevp : (a.expected ? Math.min(99, Math.round(a.total / a.expected * 100)) : 0);
      return { fips: a.fips, name: a.name, total: a.total, expected: a.expected, eevp, cands,
        margin: d && g && a.total ? d.pct - g.pct : null, hist: a.hw ? a.hm / a.hw : null };
    });
    let ts = [];
    const raw = json.timeseries && (json.timeseries[race.nyt_id] || json.timeseries[r.id]);
    if (raw && raw.length) {
      ts = raw.map((p) => {
        let d = 0, g = 0;
        for (const c of p.candidates || []) { const v = (c.votes && c.votes.total) || 0; const pt = partyOf(c.nyt_id); if (pt === 'DEM') d += v; else if (pt === 'GOP') g += v; }
        const tot = p.total_votes || 0;
        return { total: tot, margin: tot ? (d - g) / tot * 100 : null };
      }).filter((p) => p.total > 0 && p.margin !== null).sort((a, b) => a.total - b.total);
    }
    if (DEMO && r.total && r.margin !== null) {
      const rnd = mulberry(hash(r.id + 'ts'));
      ts = Array.from({ length: 14 }, (_, i) => { const f = (i + 1) / 14; return { total: Math.round(r.total * f), margin: r.margin + (rnd() - 0.5) * 16 * (1 - f) }; });
    }
    return { units, ts, types: voteTypes(json, race, src, r, partyOf), hasFips: units.some((u) => u.fips), township: lvl === 'township' };
  }

  // Voti divisi per modalità (anticipati, per posta, giorno del voto) dal riepilogo statale della gara
  function voteTypes(json, race, src, r, partyOf) {
    if (DEMO) {
      if (!r.total || r.margin === null) return [];
      return [
        { key: 'advance', total: Math.round(r.total * 0.62), margin: r.margin + 7, eevp: Math.min(99, r.eevp + 12) },
        { key: 'election_day_in_person', total: Math.round(r.total * 0.38), margin: r.margin - 11, eevp: Math.max(1, r.eevp - 25) },
      ];
    }
    const stU = (src.reporting_units || []).find((u) => u.level === 'state') || race.top_reporting_unit;
    if (!stU || !stU.candidates) return [];
    const declared = json.voteTypes && json.voteTypes[r.state];
    const keys = new Set();
    for (const c of stU.candidates) for (const k of Object.keys(c.votes || {})) if (k !== 'total') keys.add(k);
    let use = [...keys].filter((k) => !declared || declared[k] === 'Y');
    if (!declared && use.includes('advance')) use = use.filter((k) => k !== 'absentee_mail' && k !== 'advance_in_person');
    const expected = stU.expected_vote_by_vote_type || {};
    const types = use.map((k) => {
      let d = 0, g = 0, tot = 0;
      for (const c of stU.candidates) {
        const v = (c.votes && c.votes[k]) || 0; tot += v;
        const p = partyOf(c.nyt_id); if (p === 'DEM') d += v; else if (p === 'GOP') g += v;
      }
      const ev = stU.eevp_by_vote_type && typeof stU.eevp_by_vote_type[k] === 'number' && expected[k] > 0 ? stU.eevp_by_vote_type[k] : null;
      return { key: k, total: tot, margin: tot && (d || g) ? (d - g) / tot * 100 : null, eevp: ev };
    }).filter((t) => t.total > 0);
    if (types.length === 1 && types[0].key === 'advance') {
      let d = 0, g = 0, tot = 0;
      for (const c of stU.candidates) {
        const v = Math.max(0, ((c.votes && c.votes.total) || 0) - ((c.votes && c.votes.advance) || 0)); tot += v;
        const p = partyOf(c.nyt_id); if (p === 'DEM') d += v; else if (p === 'GOP') g += v;
      }
      if (tot > 0) types.push({ key: 'rest', total: tot, margin: d || g ? (d - g) / tot * 100 : null, eevp: null });
    }
    return types;
  }

  const VT_IT = { advance: 'Voto anticipato', absentee_mail: 'Per posta', advance_in_person: 'Anticipato di persona', election_day_in_person: 'Giorno del voto', provisional: 'Provvisori', rest: 'Giorno del voto e altri' };
  function typesHTML(feed, r) {
    const ts = (feed.types || []).filter((t) => t.margin !== null);
    if (ts.length < 2) return '';
    const rows = ts.map((t) => `<tr><td>${VT_IT[t.key] || esc(t.key)}</td><td>${fmtInt.format(t.total)}</td><td class="${marginClass(t.margin)}">${fmtMargin(t.margin)}</td><td>${t.eevp !== null ? Math.round(t.eevp) + '%' : '—'}</td></tr>`).join('');
    let hint = '';
    const known = ts.filter((t) => t.eevp !== null);
    if (known.length >= 2 && r.margin !== null && !r.winner) {
      known.sort((a, b) => a.eevp - b.eevp);
      const lag = known[0], lead = known[known.length - 1];
      if (lead.eevp - lag.eevp >= 10) {
        const dir = lag.margin > r.margin ? 'i Dem' : 'i Rep';
        hint = `<p class="analysis">Resta da contare soprattutto il <b>${esc((VT_IT[lag.key] || lag.key).toLowerCase())}</b> (${Math.round(lag.eevp)}% scrutinato), che finora va <b>${fmtMargin(lag.margin)}</b>: il margine complessivo, ora ${fmtMargin(r.margin)}, tende a spostarsi verso ${dir}. È una tendenza, non una previsione.</p>`;
      }
    }
    return `<h4 class="ch">Come si è votato</h4>
      <table class="ctable"><thead><tr><th>Modalità</th><th>Voti</th><th>Margine</th><th>Scrutinato</th></tr></thead><tbody>${rows}</tbody></table>${hint}`;
  }

  async function refreshCountyPanels(reload) {
    const els = [...document.querySelectorAll('[data-cp]')];
    await Promise.all(els.map(async (el) => {
      const r = state.byId.get(el.dataset.cp); if (!r) return;
      const had = raceFeeds.has(r.id);
      let changed = false;
      if (!had || reload) changed = await loadRaceFeed(r);
      await loadGeo(r.state);
      const cur = document.querySelector(`[data-cp="${CSS.escape(r.id)}"]`);
      if (!cur || (cur.dataset.filled && !changed)) return;
      cur.innerHTML = countyPanelInner(r) || '<p class="muted small">Risultati per contea non disponibili.</p>';
      cur.dataset.filled = '1';
    }));
  }

  function unitFill(u, mode) {
    const p = state.pal;
    if (!u.total || !u.cands.length) return [p.none, 1];
    if (mode === 'swing') {
      if (u.margin === null || u.hist === null) return [p.none, 1];
      const s = u.margin - u.hist, a = Math.abs(s);
      return [s >= 0 ? p.dem : p.gop, a < 2 ? 0.25 : a < 6 ? 0.5 : a < 12 ? 0.75 : 1];
    }
    const [lead, second] = u.cands;
    const gap = second ? lead.pct - second.pct : 100;
    return [p[partyClass(lead.party)], gap < 5 ? 0.4 : gap < 15 ? 0.7 : 1];
  }

  function countyMapSVG(r, feed, geo, mode) {
    const by = new Map(feed.units.filter((u) => u.fips).map((u) => [u.fips, u]));
    let bb = geo.bbox, outline = '';
    const dd = r.office === 'H' && DIST() && DIST()[r.state] && DIST()[r.state][String(r.seatNum)];
    if (dd) { bb = dd.b; outline = GEO[r.state] ? `<clipPath id="cs-${r.id.replace(/[^A-Za-z0-9_-]/g, '')}"><path d="${GEO[r.state].d}"/></clipPath><path class="dline" d="${dd.d}" clip-path="url(#cs-${r.id.replace(/[^A-Za-z0-9_-]/g, '')})"/>` : `<path class="dline" d="${dd.d}"/>`; }
    else if (r.office === 'H') {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const f of by.keys()) {
        const c = geo.counties[f]; if (!c || !c.b) continue;
        x0 = Math.min(x0, c.b[0]); y0 = Math.min(y0, c.b[1]); x1 = Math.max(x1, c.b[2]); y1 = Math.max(y1, c.b[3]);
      }
      if (x1 > x0) bb = [x0, y0, x1, y1];
    }
    const w = bb[2] - bb[0], h = bb[3] - bb[1], pad = Math.max(w, h) * 0.04;
    const vb = `${(bb[0] - pad).toFixed(1)} ${(bb[1] - pad).toFixed(1)} ${(w + 2 * pad).toFixed(1)} ${(h + 2 * pad).toFixed(1)}`;
    const colored = Object.entries(geo.counties).map(([f, c]) => {
      const u = by.get(f);
      if (!u) return dd ? '' : `<path class="out" d="${c.d}" fill="${state.pal.off}"/>`;
      const [fill, op] = unitFill(u, mode);
      return `<path d="${c.d}" fill="${fill}" fill-opacity="${op}" data-cty="${f}"/>`;
    }).join('');
    if (!dd) return `<svg class="cmap" viewBox="${vb}" data-race="${r.id}" role="img" aria-label="Risultati per contea">${colored}</svg>`;
    // Distretto della Camera: tutte le contee scure come contesto, poi quelle del distretto colorate
    // solo dentro il suo confine (i voti di una contea attraversata in parte riguardano solo quel pezzo).
    const clip = 'clip-' + r.id.replace(/[^A-Za-z0-9_-]/g, '');
    const context = Object.values(geo.counties).map((c) => `<path class="out" d="${c.d}" fill="${state.pal.off}"/>`).join('');
    return `<svg class="cmap" viewBox="${vb}" data-race="${r.id}" role="img" aria-label="Risultati per contea">
      <defs><clipPath id="${clip}"><path d="${dd.d}"/></clipPath></defs>
      ${context}<g clip-path="url(#${clip})">${colored}</g>${outline}</svg>`;
  }

  function legendHTML(mode) {
    const p = state.pal;
    const sw = (c, o) => `<i style="background:${c};opacity:${o}"></i>`;
    if (mode === 'swing') {
      return `<div class="clegend"><span>Verso i Dem</span>${[0.25, 0.5, 0.75, 1].map((o) => sw(p.dem, o)).join('')}<span class="gap">Verso i Rep</span>${[0.25, 0.5, 0.75, 1].map((o) => sw(p.gop, o)).join('')}<span class="muted">meno di 2 · 2–6 · 6–12 · oltre 12 punti rispetto alle presidenziali 2024</span></div>`;
    }
    return `<div class="clegend"><span>Dem.</span>${[0.4, 0.7, 1].map((o) => sw(p.dem, o)).join('')}<span class="gap">Rep.</span>${[0.4, 0.7, 1].map((o) => sw(p.gop, o)).join('')}<span class="muted">vantaggio sotto 5 · 5–15 · oltre 15 punti</span></div>`;
  }

  function missingTable(feed, geo) {
    const name = (u) => u.name || (geo && geo.counties[u.fips] && geo.counties[u.fips].n) || (u.fips ? 'Contea ' + u.fips : 'Zona');
    const anyVotes = feed.units.some((u) => u.total > 0);
    const rows = feed.units.map((u) => ({ u, rem: Math.max(0, u.expected - u.total) })).filter((x) => x.rem > 0)
      .sort((a, b) => b.rem - a.rem).slice(0, 6);
    if (!rows.length) return '';
    return `<h4 class="ch">${anyVotes ? 'Dove mancano più voti' : 'Dove si attendono più voti'}</h4>
      <table class="ctable"><thead><tr><th>${feed.hasFips ? 'Contea' : 'Zona'}</th><th>Scrutinato</th><th>Margine</th><th>${anyVotes ? 'Mancano' : 'Attesi'}</th></tr></thead><tbody>
      ${rows.map(({ u, rem }) => `<tr><td>${esc(name(u))}</td><td>${u.total ? pctS(u.eevp) + '%' : '—'}</td>
        <td class="${marginClass(u.margin)}">${u.margin !== null ? fmtMargin(u.margin) : u.hist !== null ? `<span class="muted">2024: ${fmtMargin(u.hist)}</span>` : '—'}</td>
        <td>~${fmtInt.format(rem)}</td></tr>`).join('')}
      </tbody></table>`;
  }

  function tsChart(ts) {
    if (!ts || ts.length < 2) return '';
    const W = 320, H = 100, L = 4, R = 4, T = 12, B = 16;
    const maxT = ts[ts.length - 1].total || 1;
    const M = Math.max(4, Math.ceil(Math.max(...ts.map((p) => Math.abs(p.margin))) / 2) * 2);
    const x = (v) => (L + v / maxT * (W - L - R)).toFixed(1), y = (m) => (T + (M - m) / (2 * M) * (H - T - B)).toFixed(1);
    let segs = '';
    for (let i = 1; i < ts.length; i++) {
      const a = ts[i - 1], b = ts[i];
      segs += `<line class="${a.margin + b.margin >= 0 ? 'dem' : 'gop'}" x1="${x(a.total)}" y1="${y(a.margin)}" x2="${x(b.total)}" y2="${y(b.margin)}"/>`;
    }
    const last = ts[ts.length - 1];
    return `<h4 class="ch">Andamento dello spoglio</h4>
      <svg class="ts" viewBox="0 0 ${W} ${H}" role="img" aria-label="Margine al crescere dei voti contati">
        <line class="zero" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>
        <text class="ax" x="${L}" y="${T - 3}">Dem. +${M}</text><text class="ax" x="${L}" y="${H - 3}">Rep. +${M}</text>
        <text class="ax" x="${W - R}" y="${H - 3}" text-anchor="end">${fmtInt.format(maxT)} voti</text>
        ${segs}<circle class="${last.margin >= 0 ? 'dem' : 'gop'}" cx="${x(last.total)}" cy="${y(last.margin)}" r="3"/>
      </svg>`;
  }

  function countyPanelInner(r) {
    const feed = raceFeeds.get(r.id);
    if (!feed) return '';
    if (feed.err && !feed.units) return `<p class="muted small">Risultati per contea non disponibili (${esc(feed.err)}).</p>`;
    const geo = geoCache[r.state];
    if (geo === undefined) return '';
    const mode = state.cmode;
    let map = '', toggle = '', legend = '', note = '';
    if (feed.hasFips && geo) {
      map = countyMapSVG(r, feed, geo, mode);
      legend = legendHTML(mode);
      toggle = `<div class="ctabs"><button type="button" data-cmode="res" class="${mode === 'res' ? 'active' : ''}">Risultato</button><button type="button" data-cmode="swing" class="${mode === 'swing' ? 'active' : ''}">Rispetto al 2024</button></div>`;
    } else if (!feed.hasFips) {
      note = `<p class="muted small">${r.state === 'AK' ? "L'Alaska non riporta i voti per contea ma per distretto della Camera statale." : 'Mappa per contea non disponibile per questa gara.'}</p>`;
    }
    if (feed.township) note += '<p class="muted small">Qui i voti arrivano per comune: la mappa li somma per contea.</p>';
    else if (r.office === 'H' && map) note += `<p class="muted small">Contee del distretto, anche quelle attraversate solo in parte${DIST() ? '; i colori si fermano al confine del distretto, la linea chiara' : ''}.</p>`;
    return `<div class="chead"><b>Per contea</b>${toggle}</div>${map}${legend}${note}${missingTable(feed, geo)}${typesHTML(feed, r)}${tsChart(feed.ts)}`;
  }

  /* --- in bilico / gare chiave / ricerca --- */
  function renderClose() {
    const rs = OFFICES.flatMap((o) => state.data[o] || []).filter((r) => !r.winner && r.total > 0 && r.margin !== null && Math.abs(r.margin) < 10)
      .sort((a, b) => Math.abs(a.margin) - Math.abs(b.margin)).slice(0, 12);
    const box = $('closeRaces');
    if (!rs.length) { box.innerHTML = `<li class="empty muted">${OFFICES.some((o) => (state.data[o] || []).some((r) => r.total > 0)) ? 'Per ora nessuna gara aperta con uno scarto sotto i 10 punti.' : 'Si riempie quando arrivano i primi voti.'}</li>`; return; }
    box.innerHTML = rs.map((r) => {
      const cu = catchUp(r);
      const sub = [`${pctS(r.eevp)}% scrutinato`];
      if (cu && cu.need !== null) sub.push(cu.need > 100 ? `${esc(cu.b.name)} non può più recuperare` : `a ${esc(cu.b.name)} serve il ${cu.need.toFixed(1)}% dei restanti`);
      return `<li data-id="${r.id}"><span class="ofc">${OFFICE_ONE[r.office]}</span><b>${esc(raceLabel(r).replace(/ — (Senato|Governatore)( \(speciale\))?$/, '$2'))}</b>
        <span class="mg ${marginClass(r.margin)}">${fmtMargin(r.margin)}</span><span class="sub">${sub.join(' · ')}</span></li>`;
    }).join('');
  }

  /* --- scenari: l'utente sceglie chi vince le gare ancora aperte --- */
  function scenDefault(r) {
    if (r.leader) return r.leader.party === 'DEM' || r.leader.party === 'GOP' ? r.leader.party : 'OTH';
    if (r.rating && r.rating !== 'tossup') return r.rating.endsWith('dem') ? 'DEM' : 'GOP';
    return 'NONE';
  }
  function saveScen() { store.set(SCEN_KEY, JSON.stringify(state.scen)); }
  function renderScen() {
    const o = state.scOffice, races = state.data[o] || [];
    if (!races.length) return;
    for (const id of Object.keys(state.scen)) { const r = state.byId.get(id); if (r && r.winner) delete state.scen[id]; }
    const seats = seatsFn(o), toWin = chamberToWin(o), total = o === 'S' ? 100 : 435;
    const open = races.filter((r) => !r.winner);
    const pick = (r) => state.scen[r.id] || scenDefault(r);
    const base = { DEM: seats('DEM'), GOP: seats('GOP'), OTH: seats('OTH') };
    const t = { ...base, NONE: 0 };
    for (const r of open) t[pick(r)]++;
    const competitive = (r) => o === 'S' || state.scAll || state.scen[r.id] || !r.rating || r.rating === 'tossup' || r.rating.startsWith('lean') || (r.margin !== null && Math.abs(r.margin) < 6);
    const shown = open.filter(competitive).sort((a, b) => (RATING_RANK[a.rating] ?? 0) - (RATING_RANK[b.rating] ?? 0) || a.state.localeCompare(b.state) || a.seatNum - b.seatNum);
    const hidden = open.length - shown.length;
    const w = (n) => (n / total * 100).toFixed(2) + '%';
    const verdict = t.DEM >= toWin.DEM ? '<b class="verdict dem">Maggioranza Dem.</b>' : t.GOP >= toWin.GOP ? '<b class="verdict gop">Maggioranza Rep.</b>'
      : `Nessuna maggioranza: ${t.NONE} ${t.NONE === 1 ? 'gara' : 'gare'} senza scelta`;
    const needD = Math.max(0, toWin.DEM - base.DEM), needR = Math.max(0, toWin.GOP - base.GOP);
    const btn = (q, p) => `<button type="button" data-pick="${q}" class="${q === p ? 'active ' : ''}${q === 'DEM' ? 'dem' : q === 'GOP' ? 'gop' : 'und'}" aria-label="${q === 'DEM' ? 'Vincono i Dem' : q === 'GOP' ? 'Vincono i Rep' : 'Non deciso'}">${q === 'DEM' ? 'D' : q === 'GOP' ? 'R' : '?'}</button>`;
    const rows = shown.map((r) => {
      const p = pick(r);
      const cur = r.total ? `${r.margin !== null ? fmtMargin(r.margin) : esc(r.cands[0].name)} · ${pctS(r.eevp)}% scrutinato` : (RATING_IT[r.rating] || 'nessun voto');
      return `<li data-id="${r.id}" class="${state.scen[r.id] ? 'mod' : ''}"><span class="nm">${esc(raceLabel(r))}</span><span class="cur">${cur}</span><span class="pick">${btn('DEM', p)}${btn('NONE', p)}${btn('GOP', p)}</span></li>`;
    }).join('');
    $('scen').innerHTML = `
      <div class="scsum">
        <div class="bar"><div class="seg dem" style="width:${w(t.DEM)}"></div><div class="seg oth" style="width:${w(t.OTH)}"></div><div class="spacer"></div><div class="seg gop" style="width:${w(t.GOP)}"></div><div class="marker" style="left:${w(toWin.DEM)}"></div></div>
        <div class="nums"><span><span class="dem">${t.DEM}</span> Dem.</span><span class="small">${verdict}</span><span>Rep. <span class="gop">${t.GOP}</span></span></div>
        <p class="muted small">Seggi già decisi o non al voto: Dem. ${base.DEM}, Rep. ${base.GOP}${base.OTH ? `, altri ${base.OTH}` : ''}. Restano aperte ${open.length} gare: per la maggioranza ai Dem ne servono ${needD}, ai Rep ${needR}.${o === 'S' && toWin.DEM !== toWin.GOP ? ` Con 50 a 50 decide il vicepresidente, ${toWin.GOP < toWin.DEM ? 'repubblicano' : 'democratico'}.` : ''}</p>
        <div class="scbtns"><button type="button" data-scall="DEM">Tutte le aperte ai Dem</button><button type="button" data-scall="GOP">Tutte le aperte ai Rep</button><button type="button" data-scall="reset">Torna alla proiezione</button>
          ${o === 'H' ? `<label class="muted small"><input type="checkbox" id="scAll"${state.scAll ? ' checked' : ''}> mostra tutte le ${open.length} gare aperte</label>` : ''}</div>
      </div>
      <ol class="sclist">${rows || '<li class="muted">Nessuna gara aperta.</li>'}</ol>
      ${hidden ? `<p class="muted small">Altre ${hidden} gare aperte, non competitive, contano secondo la proiezione semplice.</p>` : ''}`;
  }

  function findDistrict(q) {
    const m = /^([a-z][a-z .]*?)[\s-]*(?:distretto|district|cd)?[\s-]*(\d{1,2})$/i.exec(q.trim());
    if (!m) return null;
    const key = m[1].trim().toLowerCase();
    const st = Object.keys(TILES).find((k) => k.toLowerCase() === key || (STATE_NAMES[k] || '').toLowerCase() === key);
    return st ? (state.data.H || []).find((r) => r.state === st && r.seatNum === Number(m[2])) || null : null;
  }

  function renderKeyRaces() {
    const q = state.search.trim().toLowerCase();
    const all = $('allRaces').checked;
    let rs;
    if (q) {
      const dr = findDistrict(q);
      rs = dr ? [dr] : OFFICES.flatMap((o) => state.data[o] || []).filter((r) =>
        r.stateName.toLowerCase().includes(q) || r.state.toLowerCase() === q || r.cands.some((c) => c.name.toLowerCase().includes(q)));
      $('keyTitle').textContent = `Risultati per "${state.search.trim()}"`;
    } else {
      rs = (state.data[state.office] || []).filter((r) => all || r.rating === 'tossup' || (r.rating && r.rating.startsWith('lean')));
      $('keyTitle').textContent = all ? `Tutte le gare · ${OFFICE_NAME[state.office]}` : `Gare chiave · ${OFFICE_NAME[state.office]}`;
    }
    rs.sort((a, b) => {
      if (!!a.winner !== !!b.winner) return a.winner ? 1 : -1;
      const ra = RATING_RANK[a.rating] ?? 9, rb = RATING_RANK[b.rating] ?? 9;
      if (ra !== rb) return ra - rb;
      return a.state.localeCompare(b.state) || a.office.localeCompare(b.office) || a.seatNum - b.seatNum;
    });
    $('keyRaces').innerHTML = rs.length
      ? rs.slice(0, 200).map((r) => `<div class="card${state.newCalls.has(r.id) ? ' flash' : ''}" data-id="${r.id}">${raceHTML(r, false)}</div>`).join('')
      : '<p class="muted">Nessuna gara trovata.</p>';
  }

  function openRace(id) {
    const r = state.byId.get(id); if (!r) return;
    if (state.office !== r.office) switchOffice(r.office);
    selectState(r.state, r.office === 'H' ? r.id : null);
    $('detail').scrollIntoView({ block: 'nearest' });
  }

  function renderCalls() {
    const all = [];
    for (const o of OFFICES) for (const r of state.data[o] || []) if (r.winner) all.push(r);
    all.sort((a, b) => (b.calledAt ? b.calledAt.getTime() : 0) - (a.calledAt ? a.calledAt.getTime() : 0));
    const ol = $('calls');
    if (!all.length) { ol.innerHTML = '<li class="muted">Nessuna gara ancora assegnata.</li>'; return; }
    ol.innerHTML = all.slice(0, 60).map((r) => `<li class="${state.newCalls.has(r.id) ? 'new' : ''}" data-id="${r.id}">
        <span class="t">${r.calledAt ? fmtWhen(r.calledAt) : '—'}</span>
        <span>${esc(raceLabel(r))}: <b class="p ${partyClass(r.winner.party)}">${esc(r.winner.name)}</b> (${esc(r.winner.partyLabel)})${r.gained ? ' <span class="badge flip">strappato</span>' : ''}${r.total ? ` <span class="muted small">${r.winner.pct.toFixed(1)}% · ${pctS(r.eevp)}% scrutinato</span>` : ''}</span>
      </li>`).join('') + (all.length > 60 ? `<li class="muted">… e altre ${all.length - 60}</li>` : '');
  }

  function leftText(ms) {
    if (ms < 3600e3) return `tra ${Math.max(1, Math.ceil(ms / 60e3))} min`;
    const h = Math.floor(ms / 3600e3), m = Math.round((ms % 3600e3) / 60e3);
    return `tra ${h} h${m ? ` ${m} min` : ''}`;
  }
  // Guida alla serata: per ogni orario di chiusura, gli stati e le gare in bilico da guardare
  function renderClosings() {
    const now = Date.now(), groups = new Map();
    for (const c of state.closings) { const k = c.at.getTime(); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c.st); }
    const watch = (sts) => {
      const set = new Set(sts);
      const rs = OFFICES.flatMap((o) => (state.data[o] || []).filter((r) => set.has(r.state) && (r.rating === 'tossup' || (r.rating && r.rating.startsWith('lean')))));
      rs.sort((a, b) => (RATING_RANK[a.rating] ?? 9) - (RATING_RANK[b.rating] ?? 9) || 'SGH'.indexOf(a.office) - 'SGH'.indexOf(b.office));
      if (!rs.length) return '';
      const label = (r) => r.office === 'H' ? `${r.state}-${r.seatNum}` : `${r.office === 'S' ? 'Senato' : 'Gov.'} ${r.state}`;
      const items = rs.slice(0, 8).map((r) => {
        const st = r.winner ? ` <span class="p ${partyClass(r.winner.party)}">✓</span>` : r.leader ? ` <span class="p ${partyClass(r.leader.party)}">●</span>` : '';
        return `<button type="button" class="wr${r.rating === 'tossup' ? ' toss' : ''}" data-id="${r.id}" title="${esc(raceLabel(r))} · ${RATING_IT[r.rating]}">${label(r)}${st}</button>`;
      }).join('');
      return `<div class="watch">${items}${rs.length > 8 ? `<span class="muted small">+${rs.length - 8}</span>` : ''}</div>`;
    };
    const entries = [...groups.entries()];
    $('closings').innerHTML = entries.map(([t, sts]) => {
      const d = new Date(t), closed = t <= now;
      return `<li class="${closed ? 'closed' : ''}"><span class="t">${fmtTime.format(d)}</span>
        <span><span class="sts">${sts.map((st) => `<button type="button" class="stb" data-st="${st}" title="${esc(STATE_NAMES[st] || st)}">${st}</button>`).join(' ')}</span>${watch(sts)}</span>
        <span class="cd">${fmtDay.format(d)} · ${closed ? 'chiusi' : leftText(t - now)}</span></li>`;
    }).join('');
    // prossima chiusura nell'intestazione, e avviso quando un gruppo di stati chiude con la pagina aperta
    if (ARCHIVE) {
      $('nextClose').textContent = `Archivio: risultati delle elezioni del ${new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(DATE + 'T12:00:00Z'))}`;
      return;
    }
    const next = entries.find(([t]) => t > now);
    $('nextClose').textContent = next ? `Prossima chiusura dei seggi alle ${fmtTime.format(new Date(next[0]))} (${next[1].join(', ')}), ${leftText(next[0] - now)}`
      : entries.length ? 'Tutti i seggi sono chiusi' : '';
    const closedNow = new Set(entries.filter(([t]) => t <= now).map(([t]) => t));
    if (state.closedSeen) for (const [t, sts] of entries) if (closedNow.has(t) && !state.closedSeen.has(t)) toast(`Seggi chiusi alle ${fmtTime.format(new Date(t))}: ${sts.join(', ')}`);
    if (entries.length) state.closedSeen = closedNow;
  }

  function showToasts() {
    const fresh = state.freshList || [];
    if (!fresh.length) return;
    chime(fresh.some((r) => r.gained));
    // annuncio per i lettori di schermo e contatore nel titolo della scheda se è in background
    $('live').textContent = fresh.slice(0, 5).map((r) => `${raceLabel(r)}: vince ${r.winner.name}, ${r.winner.partyLabel}`).join('. ');
    if (document.hidden) { state.unseen = (state.unseen || 0) + fresh.length; document.title = `(${state.unseen}) ${BASE_TITLE}`; }
    const box = $('toasts');
    for (const r of fresh.slice(0, 5)) {
      const el = document.createElement('div');
      el.className = 'toast' + (r.gained ? ' flip' : '');
      el.innerHTML = `<b class="p ${partyClass(r.winner.party)}">${esc(r.winner.name)}</b> (${esc(r.winner.partyLabel)}) vince${r.gained ? ' e strappa il seggio' : ''}<span class="muted">${esc(raceLabel(r))}${r.total ? ` · ${r.winner.pct.toFixed(1)}%` : ''}</span>`;
      el.addEventListener('click', () => { openRace(r.id); el.remove(); });
      box.appendChild(el);
      setTimeout(() => el.remove(), 12000);
    }
    if (fresh.length > 5) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = `… e altre ${fresh.length - 5} assegnazioni`; box.appendChild(el); setTimeout(() => el.remove(), 12000); }
  }

  /* ---------- navigazione ---------- */
  function switchOffice(o) {
    if (state.office === o) return;
    state.office = o; state.openRace = null; writeHash();
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.office === o));
    renderMap(); renderDetail(); renderKeyRaces();
    if (o === 'H' && state.saver && state.loadedOnce) refresh();
  }
  function setView(v) {
    state.view = v; writeHash();
    document.querySelectorAll('.vbtn[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    renderMap();
  }
  function writeHash() {
    const p = new URLSearchParams();
    if (state.office !== 'S') p.set('ufficio', state.office);
    if (state.selected) p.set('stato', state.selected);
    if (state.openRace) p.set('gara', state.openRace);
    if (state.view !== 'geo') p.set('vista', state.view);
    const h = p.toString();
    history.replaceState(null, '', location.pathname + location.search + (h ? '#' + h : ''));
  }
  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    const o = p.get('ufficio'); state.office = o && FILES[o] ? o : 'S';
    const s = p.get('stato'); state.selected = s && TILES[s] ? s : null;
    state.openRace = p.get('gara') || null;
    const v = p.get('vista'); state.view = v === 'tile' || v === 'shift' ? v : 'geo';
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.office === state.office));
    document.querySelectorAll('.vbtn[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
  }

  /* ---------- tema ---------- */
  const THEMES = ['auto', 'dark', 'light'];
  function applyTheme(t) {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    $('themeBtn').textContent = 'Tema: ' + (t === 'auto' ? 'auto' : t === 'dark' ? 'scuro' : 'chiaro');
    store.set('midterm2026-theme', t);
    if (state.data.S) renderAll();
  }

  /* ---------- eventi ---------- */
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => switchOffice(t.dataset.office)));
  document.querySelectorAll('.vbtn[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  $('map').addEventListener('click', (ev) => {
    if (state.dragMoved) { state.dragMoved = false; return; }
    const g = ev.target.closest('[data-st]'); if (!g) return;
    const d = ev.target.closest('[data-race-tip]');
    const st = g.dataset.st;
    const many = (state.data.H || []).filter((r) => r.state === st).length > 1;
    if (state.office === 'H' && DIST() && isGeo() && state.vb.w >= 959 && many) {
      zoomToState(st);
      selectState(st, state.selected === st ? state.openRace : null);
      return;
    }
    selectState(st, d && state.office === 'H' ? d.dataset.raceTip : (state.selected === st ? state.openRace : null));
  });
  $('map').addEventListener('dblclick', (ev) => { const g = ev.target.closest('[data-st]'); if (g) zoomToState(g.dataset.st); });
  // Rotella del mouse sulla mappa: ingrandisce e riduce attorno al puntatore.
  // A mappa intera, la rotella verso il basso lascia scorrere la pagina invece di bloccarla.
  $('map').addEventListener('wheel', (ev) => {
    if (!isGeo() || !ev.deltaY) return;
    if (ev.deltaY > 0 && state.vb.w >= 959 && !ev.ctrlKey) return;
    ev.preventDefault();
    const step = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaMode === 2 ? ev.deltaY * 400 : ev.deltaY;   // righe/pagine -> pixel
    const k = Math.min(1.6, Math.max(1 / 1.6, Math.exp(step * 0.0022)));
    const p = svgPoint(ev); zoomAt(p.x, p.y, k);
  }, { passive: false });
  let drag = null;
  $('map').addEventListener('pointerdown', (ev) => {
    if (!isGeo() || state.vb.w >= 959 || ev.button !== 0) return;
    drag = { x: ev.clientX, y: ev.clientY, vb: { ...state.vb } }; state.dragMoved = false;
  });
  window.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (!state.dragMoved && Math.hypot(dx, dy) < 5) return;
    state.dragMoved = true; tip.hidden = true;
    const r = $('map').getBoundingClientRect();
    state.vb = clampVB({ ...drag.vb, x: drag.vb.x - dx / r.width * drag.vb.w, y: drag.vb.y - dy / r.height * drag.vb.h });
    applyVB();
  });
  window.addEventListener('pointerup', () => { drag = null; });
  $('zoomctl').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-z]'); if (!b) return;
    const v = state.vb, cx = v.x + v.w / 2, cy = v.y + v.h / 2;
    if (b.dataset.z === 'in') zoomAt(cx, cy, 0.6);
    else if (b.dataset.z === 'out') zoomAt(cx, cy, 1 / 0.6);
    else if (b.dataset.z === 'state' && state.selected) zoomToState(state.selected);
    else { state.vb = { ...VB0 }; applyVB(); }
  });
  $('scen').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.pick) {
      const li = b.closest('li[data-id]'), r = li && state.byId.get(li.dataset.id); if (!r) return;
      if (b.dataset.pick === scenDefault(r)) delete state.scen[r.id]; else state.scen[r.id] = b.dataset.pick;
    } else if (b.dataset.scall) {
      for (const r of state.data[state.scOffice] || []) {
        if (r.winner) continue;
        if (b.dataset.scall === 'reset') delete state.scen[r.id]; else state.scen[r.id] = b.dataset.scall;
      }
    } else return;
    saveScen(); renderScen();
  });
  $('scen').addEventListener('change', (ev) => { if (ev.target.id === 'scAll') { state.scAll = ev.target.checked; renderScen(); } });
  document.querySelectorAll('.sbtn').forEach((b) => b.addEventListener('click', () => {
    state.scOffice = b.dataset.sc;
    document.querySelectorAll('.sbtn').forEach((x) => x.classList.toggle('active', x === b));
    renderScen();
  }));
  window.addEventListener('districts', () => { if (state.data.S) { renderMap(); renderDetail(); } });
  $('detail').addEventListener('click', (ev) => {
    const dd = ev.target.closest('[data-dist]');
    if (dd) {
      state.openRace = state.openRace === dd.dataset.dist ? null : dd.dataset.dist; writeHash(); renderMap(); renderDetail();
      const box = state.openRace && document.querySelector(`[data-race-box="${CSS.escape(state.openRace)}"]`);
      if (box) $('detail').scrollTop = box.offsetTop - 8;
      return;
    }
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.share) {
      const url = location.href, title = `${STATE_NAMES[state.selected] || ''} · ${BASE_TITLE}`;
      if (navigator.share) navigator.share({ title, url }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Link copiato negli appunti'), () => toast(url));
      else toast(url);
    } else if (t.dataset.go) switchOffice(t.dataset.go);
    else if (t.dataset.close) { state.selected = null; state.openRace = null; writeHash(); renderMap(); renderDetail(); }
    else if (t.dataset.open) { state.openRace = state.openRace === t.dataset.open ? null : t.dataset.open; writeHash(); renderMap(); renderDetail(); }
    else if (t.dataset.cmode) {
      state.cmode = t.dataset.cmode; store.set('midterm2026-cmode', state.cmode);
      document.querySelectorAll('[data-cp]').forEach((el) => { const r = state.byId.get(el.dataset.cp); if (r) el.innerHTML = countyPanelInner(r); });
    }
  });
  $('keyRaces').addEventListener('click', (ev) => { const c = ev.target.closest('.card'); if (c) openRace(c.dataset.id); });
  $('closeRaces').addEventListener('click', (ev) => { const li = ev.target.closest('li[data-id]'); if (li) openRace(li.dataset.id); });
  $('closings').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.id) openRace(b.dataset.id);
    else if (b.dataset.st) { selectState(b.dataset.st); $('detail').scrollIntoView({ block: 'nearest' }); }
  });
  $('calls').addEventListener('click', (ev) => { const li = ev.target.closest('li[data-id]'); if (li) openRace(li.dataset.id); });
  $('events').addEventListener('click', (ev) => { const li = ev.target.closest('li[data-id]'); if (li) openRace(li.dataset.id); });
  $('evFilter').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-ef]'); if (!b) return;
    state.evF = b.dataset.ef;
    $('evFilter').querySelectorAll('[data-ef]').forEach((x) => x.classList.toggle('active', x === b));
    renderEvents();
  });
  if (canHover) {
    document.addEventListener('mousemove', onHover);
    document.addEventListener('mouseleave', () => { tip.hidden = true; tipKey = ''; });
    window.addEventListener('scroll', () => { tip.hidden = true; tipKey = ''; }, { passive: true });
  }
  $('allRaces').addEventListener('change', renderKeyRaces);
  $('search').addEventListener('input', () => { state.search = $('search').value; renderKeyRaces(); });
  $('search').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { $('search').value = ''; state.search = ''; renderKeyRaces(); $('search').blur(); return; }
    if (e.key !== 'Enter') return;
    const q = state.search.trim().toLowerCase();
    const dr = findDistrict(q);
    if (dr) { openRace(dr.id); if (DIST() && isGeo()) zoomToState(dr.state); return; }
    const st = Object.keys(TILES).find((k) => k.toLowerCase() === q || (STATE_NAMES[k] || '').toLowerCase() === q);
    if (st) selectState(st);
  });
  // sul telefono si parte da 60 s e, se la connessione è lenta o chiede di risparmiare, con il risparmio dati attivo
  const conn = navigator.connection || {};
  const smallScreen = window.matchMedia('(max-width: 900px)').matches;
  $('interval').value = store.get('midterm2026-interval', smallScreen ? '60' : '5');
  if (!$('interval').value) $('interval').value = '30';
  state.saver = store.get('midterm2026-saver', conn.saveData || /(^|-)2g|3g/.test(conn.effectiveType || '') ? '1' : '0') === '1';
  const showSaver = () => { $('saverBtn').classList.toggle('on', state.saver); $('saverBtn').textContent = state.saver ? 'Risparmio dati attivo' : 'Risparmio dati'; };
  showSaver();
  $('saverBtn').addEventListener('click', () => { state.saver = !state.saver; store.set('midterm2026-saver', state.saver ? '1' : '0'); showSaver(); });
  $('interval').addEventListener('change', () => { store.set('midterm2026-interval', $('interval').value); schedule(); });
  function togglePause() {
    state.paused = !state.paused;
    $('pauseBtn').textContent = state.paused ? 'Riprendi' : 'Pausa';
    $('pauseBtn').classList.toggle('on', state.paused);
    if (state.paused) schedule(); else refresh();
  }
  $('pauseBtn').addEventListener('click', togglePause);
  $('notifBtn').addEventListener('click', async () => {
    if (!('Notification' in window)) { alert('Questo browser non supporta le notifiche.'); return; }
    if (state.notify) { state.notify = false; $('notifBtn').textContent = 'Notifiche'; $('notifBtn').classList.remove('on'); return; }
    const p = await Notification.requestPermission();
    if (p === 'granted') { state.notify = true; $('notifBtn').textContent = 'Notifiche attive'; $('notifBtn').classList.add('on'); }
    else alert('Permesso per le notifiche negato.');
  });
  $('soundBtn').addEventListener('click', () => {
    state.sound = !state.sound;
    $('soundBtn').textContent = state.sound ? 'Suono attivo' : 'Suono';
    $('soundBtn').classList.toggle('on', state.sound);
    if (state.sound) chime(false);
  });
  $('themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'auto';
    applyTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]);
  });
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (k === '1' || k === '2' || k === '3') switchOffice(OFFICES[Number(k) - 1]);
    else if (k === 'm') setView(state.view === 'geo' ? 'shift' : state.view === 'shift' ? 'tile' : 'geo');
    else if (k === '/') { e.preventDefault(); $('search').focus(); }
    else if (k === 'r') { if (!e.repeat) refresh(); }
    else if (k === '+' || k === '=') { const v = state.vb; zoomAt(v.x + v.w / 2, v.y + v.h / 2, 0.6); }
    else if (k === '-') { const v = state.vb; zoomAt(v.x + v.w / 2, v.y + v.h / 2, 1 / 0.6); }
    else if (k === '0') { state.vb = { ...VB0 }; if (isGeo()) applyVB(); }
    else if (k === 'z' && state.selected) zoomToState(state.selected);
    else if (k === 'p') togglePause();
    else if (k === 'escape' && state.selected) { state.selected = null; state.openRace = null; writeHash(); renderMap(); renderDetail(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (state.unseen) { state.unseen = 0; document.title = BASE_TITLE; }
    if (state.pendingRefresh) refresh();
  });
  $('measTools').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'measLoad') { b.disabled = true; loadAllMeasures().then(() => renderMeasTools()); return; }
    if (b.dataset.mf) {
      state.measF = b.dataset.mf;
      $('measTools').querySelectorAll('[data-mf]').forEach((x) => x.classList.toggle('active', x === b));
      renderMeasures();
    }
  });
  $('measTools').addEventListener('input', (ev) => { if (ev.target.id === 'measQ') { state.measQ = ev.target.value; renderMeasures(); } });
  $('measList').addEventListener('click', (ev) => {
    const m = ev.target.closest('[data-mst]'); if (!m) return;
    selectState(m.dataset.mst);
    const xp = document.querySelector('[data-xp]');
    $('detail').scrollIntoView({ block: 'nearest' });
    if (xp) $('detail').scrollTop = xp.offsetTop - 8;
  });
  window.addEventListener('hashchange', () => { readHash(); if (state.data.S) { renderMap(); renderDetail(); renderKeyRaces(); } });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.data.S) renderAll(); });
  setInterval(renderClosings, 30000);

  // altezza reale dell'intestazione fissa, per posizionare il pannello di dettaglio sotto di essa
  const setHdr = () => document.documentElement.style.setProperty('--hdr', document.querySelector('.top').offsetHeight + 'px');
  window.addEventListener('resize', setHdr); setHdr();

  // installabile come app: service worker (cache dei contorni) e pulsante "Installa" dove il browser lo consente
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('installBtn').hidden = false; });
  $('installBtn').addEventListener('click', async () => {
    if (!installEvt) return;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch (e) { /* ignora */ }
    installEvt = null; $('installBtn').hidden = true;
  });
  window.addEventListener('appinstalled', () => { $('installBtn').hidden = true; });

  const savedTheme = store.get('midterm2026-theme', 'auto');
  applyTheme(THEMES.includes(savedTheme) ? savedTheme : 'auto');
  readHash();
  refresh();
})();
