/* Baton database layer: Supabase Auth + Postgres through the REST API, guarded by row-level security.
 *
 * - Every request carries the signed-in user's own access token (a JWT that Supabase verifies).
 *   Postgres reads the user from that token (auth.uid()); no persona header is sent or trusted.
 * - The x-baton-workspace header only selects a workspace; RLS returns it only to its members.
 * - The six Meridian demo accounts are public (shown on the sign-in screen). The Studio's
 *   "view as reader" preview signs in to a reader's demo account in the background so the reviewer
 *   can see exactly what Postgres returns for that reader. In production only the reader's own
 *   login could do this.
 * - Everything is best effort: if the database is not configured or unreachable, the Studio keeps
 *   working locally, and the status pill says so.
 */
(function () {
  'use strict';
  const cfg = window.BATON_CONFIG || {};
  const URL = (cfg.supabaseUrl || '').replace(/\/+$/, '');
  const KEY = cfg.supabaseKey || '';
  const DEMO = cfg.demoAccounts || [];
  const DEMO_PW = cfg.demoPassword || '';
  const WS_KEY = 'baton-workspace-v1';
  const AUTH_KEY = 'baton-auth-v1';
  const LOCAL_KEY = 'baton-local-mode-v1';
  const listeners = new Set();

  let localMode = false;
  try { localMode = localStorage.getItem(LOCAL_KEY) === '1'; } catch (e) { /* storage blocked */ }

  const db = {
    configured: !!(URL && KEY) && !localMode,
    available: !!(URL && KEY),
    status: URL && KEY && !localMode ? 'connecting' : 'off', // off | signedout | connecting | online | error
    lastError: null,
    lastSync: null,
    authVersion: 0,
    syncedCounts: { sources: 0, claims: 0 }
  };

  function emit() { listeners.forEach(fn => { try { fn(db); } catch (e) { /* listener errors are not fatal */ } }); }
  function setStatus(s, err) { db.status = s; db.lastError = err ? String(err.message || err) : null; emit(); }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const x = Array.from(b, v => v.toString(16).padStart(2, '0')).join('');
    return x.slice(0, 8) + '-' + x.slice(8, 12) + '-' + x.slice(12, 16) + '-' + x.slice(16, 20) + '-' + x.slice(20);
  }

  // ---------------------------------------------------------------------------
  // Supabase Auth
  // ---------------------------------------------------------------------------
  let session = null;
  try { session = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { session = null; }
  function persist() { try { if (session) localStorage.setItem(AUTH_KEY, JSON.stringify(session)); else localStorage.removeItem(AUTH_KEY); } catch (e) { /* fine */ } }

  async function authCall(path, body, token) {
    const headers = { apikey: KEY, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    let res;
    try { res = await fetch(URL + '/auth/v1/' + path, { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined }); }
    catch (e) { throw new Error('Could not reach the sign-in service. Check your connection and try again.'); }
    const t = await res.text();
    let j = {}; try { j = t ? JSON.parse(t) : {}; } catch (e) { j = {}; }
    if (!res.ok) {
      const msg = j.error_description || j.msg || j.message || ('HTTP ' + res.status);
      throw new Error(/invalid login credentials/i.test(msg) ? 'Wrong email or password.' : msg);
    }
    return j;
  }
  const toSession = j => ({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, user: { id: j.user && j.user.id, email: j.user && j.user.email } });

  const otherTokens = new Map(); // persona -> { token, exp }  (demo "view as" only)

  async function signIn(email, password) {
    if (!db.available) throw new Error('No database is configured for this copy of Baton.');
    email = String(email || '').trim().toLowerCase();
    if (!email || !password) throw new Error('Enter an email and a password.');
    const s = toSession(await authCall('token?grant_type=password', { email, password }));
    const prof = await rawGet('profiles?select=persona_id,display_name', s.access_token);
    if (!prof.length) throw new Error('This account has no role in Baton yet. A data owner has to invite it to a workspace.');
    s.persona = prof[0].persona_id; s.name = prof[0].display_name;
    session = s; persist();
    otherTokens.clear(); readerCache.clear(); wsChecked = false;
    if (localMode) setLocalMode(false);
    db.authVersion++;
    setStatus('connecting');
    ping();
    return s;
  }

  function signInDemo(persona) {
    const a = DEMO.find(x => x.persona === persona);
    if (!a) return Promise.reject(new Error('Unknown demo account'));
    return signIn(a.email, DEMO_PW);
  }

  function dropSession() {
    session = null; persist(); otherTokens.clear(); readerCache.clear(); wsChecked = false;
    db.authVersion++;
    setStatus(db.configured ? 'signedout' : 'off');
  }

  async function signOut() {
    const t = session && session.access_token;
    dropSession();
    if (t) authCall('logout', null, t).catch(() => { /* token may already be gone */ });
  }

  let refreshing = null;
  async function freshToken() {
    if (!session) return null;
    if (session.expires_at - Date.now() > 60000) return session.access_token;
    if (!refreshing) {
      refreshing = authCall('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
        .then(j => { const s = toSession(j); session.access_token = s.access_token; session.refresh_token = s.refresh_token; session.expires_at = s.expires_at; persist(); return session.access_token; })
        .catch(() => { dropSession(); throw new Error('Your session expired. Please sign in again.'); })
        .finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function tokenFor(persona) {
    if (!persona || (session && session.persona === persona)) return freshToken();
    const acct = DEMO.find(a => a.persona === persona);
    if (!acct) throw new Error('No demo account for ' + persona);
    const c = otherTokens.get(persona);
    if (c && c.exp - Date.now() > 60000) return c.token;
    const j = await authCall('token?grant_type=password', { email: acct.email, password: DEMO_PW });
    otherTokens.set(persona, { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 });
    return j.access_token;
  }

  function setLocalMode(on) {
    localMode = !!on;
    try { if (on) localStorage.setItem(LOCAL_KEY, '1'); else localStorage.removeItem(LOCAL_KEY); } catch (e) { /* fine */ }
    db.configured = db.available && !localMode;
    db.status = db.configured ? (session ? 'connecting' : 'signedout') : 'off';
    db.authVersion++;
    emit();
  }

  // ---------------------------------------------------------------------------
  // REST
  // ---------------------------------------------------------------------------
  let ws = null;
  try { ws = localStorage.getItem(WS_KEY); } catch (e) { /* storage blocked: session-only workspace */ }
  if (!ws) ws = uuid();
  let wsCreated = false;
  let wsChecked = false;

  async function rawGet(path, token) {
    const res = await fetch(URL + '/rest/v1/' + path, { headers: { apikey: KEY, Authorization: 'Bearer ' + token } });
    if (!res.ok) throw new Error('GET ' + path.split('?')[0] + ' failed (' + res.status + ')');
    return res.json();
  }

  // Low level: returns { ok, status, data } and never throws on HTTP errors (used by probes).
  async function call(method, path, opts) {
    opts = opts || {};
    const headers = Object.assign({ apikey: KEY, 'Content-Type': 'application/json' }, opts.headers || {});
    if (!opts.noWorkspace) headers['x-baton-workspace'] = opts.workspace || ws;
    if (!opts.anon) {
      const token = opts.token || await tokenFor(opts.as);
      if (!token) throw new Error('Not signed in.');
      headers.Authorization = 'Bearer ' + token;
    }
    if (opts.prefer) headers.Prefer = opts.prefer;
    const res = await fetch(URL + '/rest/v1/' + path, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    return { ok: res.ok, status: res.status, data };
  }

  async function rest(method, path, opts) {
    const r = await call(method, path, opts);
    if (!r.ok) {
      const msg = r.data && (r.data.message || r.data.msg) ? (r.data.message || r.data.msg) : JSON.stringify(r.data || '').slice(0, 160);
      const err = new Error(msg || (method + ' ' + path.split('?')[0] + ' failed (' + r.status + ')'));
      err.status = r.status;
      throw err;
    }
    return r.data;
  }

  const isStaff = () => !!(session && (session.persona === 'owner' || session.persona === 'reviewer'));

  async function ensureWorkspace() {
    if (!session) throw new Error('Sign in to save to the database.');
    if (wsCreated && wsChecked) return;
    if (isStaff()) await rest('POST', 'workspaces', { body: { id: ws }, prefer: 'resolution=ignore-duplicates,return=minimal' });
    // A workspace id saved by an older version (or another account) may not include this user:
    // start a fresh one instead of failing every write.
    const m = await rest('GET', 'workspace_members?select=persona_id&workspace_id=eq.' + ws);
    if (!m.length) {
      if (!isStaff()) throw new Error('Nothing has been shared with you in this browser yet.');
      ws = uuid(); lastIds = { sources: new Set(), claims: new Set() };
      await rest('POST', 'workspaces', { body: { id: ws }, prefer: 'return=minimal' });
    }
    wsCreated = true; wsChecked = true;
    try { localStorage.setItem(WS_KEY, ws); } catch (e) { /* fine */ }
  }

  // ---------------------------------------------------------------------------
  // Mapping between Studio objects and table rows
  // ---------------------------------------------------------------------------
  const isoDate = d => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null);
  const sourceRow = s => ({ workspace_id: ws, ext_id: s.id, title: String(s.title || 'Untitled').slice(0, 300), kind: s.kind, access: s.access, author: s.author || null, source_date: isoDate(s.date), body: s.text, masked: s.masked || [], updated_at: new Date().toISOString() });
  const claimRow = c => ({
    workspace_id: ws, ext_id: c.id, type: c.type, statement: c.statement, label: c.label, access: c.access,
    origin: c.origin, review_state: c.reviewState, decided_by: c.decidedBy || null, source_ext_id: c.sourceId || null,
    quote: c.quote || null, claim_date: isoDate(c.date), dispute: c.dispute || null, withheld_from: c.withheldFrom || [],
    version: c.version || 1, updated_at: new Date().toISOString()
  });

  // ---------------------------------------------------------------------------
  // Ledger sync (debounced, staff only)
  // ---------------------------------------------------------------------------
  let syncTimer = null;
  let pending = null;
  let syncing = false;
  let lastIds = { sources: new Set(), claims: new Set() };

  async function syncNow() {
    if (!db.configured || syncing || !pending) return;
    if (!session) { setStatus('signedout'); return; }
    if (!isStaff()) { pending = null; return; }
    syncing = true;
    const snap = pending; pending = null;
    try {
      await ensureWorkspace();
      const srcRows = snap.sources.map(sourceRow);
      const clmRows = snap.claims.map(claimRow);
      if (srcRows.length) await rest('POST', 'sources?on_conflict=workspace_id,ext_id', { body: srcRows, prefer: 'resolution=merge-duplicates,return=minimal' });
      if (clmRows.length) await rest('POST', 'claims?on_conflict=workspace_id,ext_id', { body: clmRows, prefer: 'resolution=merge-duplicates,return=minimal' });
      const goneS = [...lastIds.sources].filter(id => !snap.sources.some(s => s.id === id));
      const goneC = [...lastIds.claims].filter(id => !snap.claims.some(c => c.id === id));
      const list = ids => '(' + ids.map(i => '"' + String(i).replace(/"/g, '') + '"').join(',') + ')';
      if (goneC.length) await rest('DELETE', 'claims?workspace_id=eq.' + ws + '&ext_id=in.' + encodeURIComponent(list(goneC)));
      if (goneS.length) await rest('DELETE', 'sources?workspace_id=eq.' + ws + '&ext_id=in.' + encodeURIComponent(list(goneS)));
      lastIds = { sources: new Set(snap.sources.map(s => s.id)), claims: new Set(snap.claims.map(c => c.id)) };
      db.syncedCounts = { sources: srcRows.length, claims: clmRows.length };
      db.lastSync = new Date().toISOString();
      setStatus('online');
    } catch (e) {
      setStatus('error', e);
    } finally {
      syncing = false;
      if (pending) schedule();
    }
  }

  function schedule(state) {
    if (!db.configured) return;
    if (state) pending = { sources: state.sources.slice(), claims: state.claims.slice() };
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, 700);
  }

  async function flush() {
    clearTimeout(syncTimer);
    if (pending) await syncNow();
    while (syncing) await new Promise(r => setTimeout(r, 50));
  }

  // A fresh sample gets a fresh workspace, so earlier runs never mix in.
  function newWorkspace() {
    ws = uuid(); wsCreated = false; wsChecked = false; lastIds = { sources: new Set(), claims: new Set() }; readerCache.clear();
    try { localStorage.setItem(WS_KEY, ws); } catch (e) { /* fine */ }
    emit();
  }

  function audit(actor, action) {
    if (!db.configured || !session) return;
    ensureWorkspace()
      .then(() => rest('POST', 'audit_log', { body: { workspace_id: ws, actor: String(actor).slice(0, 120), action: String(action).slice(0, 600) }, prefer: 'return=minimal' }))
      .catch(() => { /* audit is best effort */ });
  }

  // ---------------------------------------------------------------------------
  // Publishing and reading the handover
  // ---------------------------------------------------------------------------
  const readerCache = new Map(); // key ver|reader -> { rows, at } | { error }

  async function publish(v) {
    db.lastPublishError = null;
    if (!db.configured || !session) return false;
    try {
      await flush();
      if (db.status === 'error') throw new Error(db.lastError || 'The ledger could not be saved.');
      await ensureWorkspace();
      await rest('POST', 'versions', { body: { workspace_id: ws, ver: v.id, state: 'approved', approved_by: v.approvedBy, approved_at: v.at, content_hash: v.hash }, prefer: 'return=minimal' });
      const items = v.claims.map(c => ({
        workspace_id: ws, ver: v.id, claim_ext_id: c.id, type: c.type, statement: c.statement, label: c.confirmedBy ? 'Confirmed by ' + c.confirmedBy : c.label,
        access: c.access, claim_date: isoDate(c.date), slot: c.slot || null, author: c.author || null, gap_key: c.gapKey || null, withheld_from: c.withheldFrom || []
      }));
      if (items.length) await rest('POST', 'handover_items', { body: items, prefer: 'return=minimal' });
      readerCache.clear();
      setStatus('online');
      return true;
    } catch (e) { db.lastPublishError = String(e.message || e); setStatus('error', e); return false; }
  }

  async function retract(ver) {
    if (!db.configured || !session) return;
    try {
      await rest('PATCH', 'versions?workspace_id=eq.' + ws + '&ver=eq.' + encodeURIComponent(ver), { body: { state: 'retracted' }, prefer: 'return=minimal' });
      readerCache.clear(); emit();
    } catch (e) { setStatus('error', e); }
  }

  // Reader view straight from Postgres, queried with that reader's own token.
  async function loadReader(ver, reader) {
    const key = ver + '|' + reader;
    if (!db.configured) return null;
    try {
      const rows = await rest('GET', 'reader_handover?select=*&ver=eq.' + encodeURIComponent(ver) + '&order=claim_ext_id', { as: reader });
      readerCache.set(key, { rows, at: Date.now() });
      setStatus('online');
    } catch (e) {
      readerCache.set(key, { error: String(e.message || e) });
    }
    emit();
    return readerCache.get(key);
  }
  function readerRows(ver, reader) { return readerCache.get(ver + '|' + reader) || null; }

  function receipt(ver, reader, claimId, on) {
    if (!db.configured || !session) return;
    const p = () => on
      ? rest('POST', 'receipts', { as: reader, body: { workspace_id: ws, ver, reader, claim_ext_id: claimId }, prefer: 'resolution=ignore-duplicates,return=minimal' })
      : rest('DELETE', 'receipts?workspace_id=eq.' + ws + '&ver=eq.' + encodeURIComponent(ver) + '&reader=eq.' + reader + '&claim_ext_id=eq.' + encodeURIComponent(claimId), { as: reader });
    p().catch(e => setStatus('error', e));
  }

  function request(req) {
    if (!db.configured || !session) return;
    rest('POST', 'access_requests', { as: req.readerId, body: { workspace_id: ws, req_id: req.id, reader: req.readerId, gap_key: req.gapKey, status: req.status }, prefer: 'return=minimal' })
      .catch(e => setStatus('error', e));
  }
  function reply(id, status) {
    if (!db.configured || !session) return;
    rest('PATCH', 'access_requests?workspace_id=eq.' + ws + '&req_id=eq.' + encodeURIComponent(id), { body: { status }, prefer: 'return=minimal' })
      .catch(e => setStatus('error', e));
  }

  // ---------------------------------------------------------------------------
  // The signed-in reader's own page (no Studio state is used: Postgres only)
  // ---------------------------------------------------------------------------
  async function myHandover() {
    if (!session) throw new Error('Not signed in.');
    const mem = await rest('GET', 'workspace_members?select=persona_id&workspace_id=eq.' + ws);
    if (!mem.length) return { versions: [], rows: [], receipts: [], requests: [] };
    const versions = await rest('GET', 'versions?select=ver,state,approved_by,approved_at&order=approved_at.desc');
    const live = versions.find(v => v.state === 'approved');
    if (!live) return { versions, rows: [], receipts: [], requests: [] };
    const [rows, receipts, requests] = await Promise.all([
      rest('GET', 'reader_handover?select=*&ver=eq.' + encodeURIComponent(live.ver) + '&order=claim_ext_id'),
      rest('GET', 'receipts?select=claim_ext_id&ver=eq.' + encodeURIComponent(live.ver) + '&reader=eq.' + session.persona),
      rest('GET', 'access_requests?select=req_id,gap_key,status&reader=eq.' + session.persona)
    ]);
    return { versions, ver: live.ver, rows, receipts: receipts.map(x => x.claim_ext_id), requests };
  }
  async function myAck(ver, claimId, on) {
    if (on) return rest('POST', 'receipts', { body: { workspace_id: ws, ver, reader: session.persona, claim_ext_id: claimId }, prefer: 'resolution=ignore-duplicates,return=minimal' });
    return rest('DELETE', 'receipts?workspace_id=eq.' + ws + '&ver=eq.' + encodeURIComponent(ver) + '&reader=eq.' + session.persona + '&claim_ext_id=eq.' + encodeURIComponent(claimId));
  }
  async function myRequest(gapKey) {
    return rest('POST', 'access_requests', { body: { workspace_id: ws, req_id: 'REQ-' + session.persona + '-' + gapKey, reader: session.persona, gap_key: gapKey, status: 'open' }, prefer: 'resolution=ignore-duplicates,return=minimal' });
  }

  // ---------------------------------------------------------------------------
  // Guided interview: reviewer sends questions, the departing lead answers from their own account
  // ---------------------------------------------------------------------------
  async function sendInterview(questions) {
    if (!db.configured || !session) throw new Error('Sign in to send the interview.');
    await flush();
    await ensureWorkspace();
    const rows = questions.map(q => ({ workspace_id: ws, gap_key: q.key, rank: q.rank, question: String(q.question).slice(0, 400), why: String(q.why || '').slice(0, 300), readers: q.readers || [], sent_at: new Date().toISOString() }));
    if (rows.length) await rest('POST', 'interview_questions?on_conflict=workspace_id,gap_key', { body: rows, prefer: 'resolution=merge-duplicates,return=minimal' });
    return rows.length;
  }
  async function interviewAnswers() {
    await ensureWorkspace();
    return rest('GET', 'interview_answers?select=gap_key,answer,access,answered_by,answered_at&workspace_id=eq.' + ws);
  }
  async function myInterview() {
    const mem = await rest('GET', 'workspace_members?select=persona_id&workspace_id=eq.' + ws);
    if (!mem.length) return { questions: [], answers: [] };
    const [questions, answers] = await Promise.all([
      rest('GET', 'interview_questions?select=*&order=rank'),
      rest('GET', 'interview_answers?select=gap_key,answer,access,answered_at')
    ]);
    return { questions, answers };
  }
  async function saveAnswer(gapKey, answer, access) {
    return rest('POST', 'interview_answers?on_conflict=workspace_id,gap_key', { body: { workspace_id: ws, gap_key: gapKey, answer, access }, prefer: 'resolution=merge-duplicates,return=minimal' });
  }

  // "Try to break in": run real attacks as the signed-in user and report what Postgres returned.
  async function breakIn(personaTags) {
    const out = [];
    const add = (attack, how, r, expectEmpty) => {
      const n = Array.isArray(r.data) ? r.data.length : 0;
      const blocked = expectEmpty ? (r.ok ? n === 0 : true) : !r.ok;
      out.push({ attack, how, blocked, result: r.ok ? (Array.isArray(r.data) ? n + ' rows returned' : 'accepted (HTTP ' + r.status + ')') : 'refused (HTTP ' + r.status + (r.data && r.data.message ? ': ' + String(r.data.message).slice(0, 90) : '') + ')' });
    };
    add('Read the data owner\'s raw sources', 'GET /sources', await call('GET', 'sources?select=ext_id,title,body'), true);
    add('Read the full claim ledger', 'GET /claims', await call('GET', 'claims?select=ext_id,statement'), true);
    const hidden = ['core_team', 'treasurer_only'].filter(t => !personaTags.includes(t));
    for (const t of hidden) add('Read handover rows tagged "' + t.replace('_', ' ') + '"', 'GET /reader_handover?access=eq.' + t, await call('GET', 'reader_handover?select=claim_ext_id,statement&access=eq.' + t), true);
    add('Forge the old persona header to look like the reviewer', 'x-baton-persona: reviewer', await call('GET', 'claims?select=ext_id', { headers: { 'x-baton-persona': 'reviewer' } }), true);
    add('Read the audit log', 'GET /audit_log', await call('GET', 'audit_log?select=actor,action'), true);
    if (session && session.persona !== 'leaver') add('Read the departing lead\'s private interview answers', 'GET /interview_answers', await call('GET', 'interview_answers?select=gap_key,answer'), true);
    add('Approve a version as if you were the reviewer', 'POST /versions', await call('POST', 'versions', { body: { workspace_id: ws, ver: 'v-forged', state: 'approved', approved_by: 'Prof. Rao', content_hash: 'forged' }, prefer: 'return=minimal' }), false);
    add('Point at a workspace you are not a member of', 'x-baton-workspace: <random id>', await call('GET', 'reader_handover?select=claim_ext_id', { workspace: uuid() }), true);
    const t = await freshToken();
    add('Tamper with your own sign-in token', 'Authorization: Bearer <edited JWT>', await call('GET', 'reader_handover?select=claim_ext_id', { token: t.slice(0, -8) + 'AAAAAAAA' }), false);
    add('Skip sign-in and use only the public key', 'no Authorization header', await call('GET', 'reader_handover?select=claim_ext_id', { anon: true }), false);
    return out;
  }

  // ---------------------------------------------------------------------------
  // Database probes for the reviewer: real tokens for every account
  // ---------------------------------------------------------------------------
  async function probes(ctx) {
    // ctx: { readers:[{id,name,tags}], localClaims, version: {id, expected: {readerId: [claimIds]}}, restricted: {tag:[markers]} }
    const out = [];
    const add = (name, pass, detail) => out.push({ name, pass, detail });
    await flush();
    await ensureWorkspace();
    const n = r => (Array.isArray(r.data) ? r.data.length : 0);
    const ledger = 'claims?select=ext_id&workspace_id=eq.' + ws;
    const srcs = 'sources?select=ext_id&workspace_id=eq.' + ws;
    const staff = await call('GET', ledger);
    add('Signed-in staff account reads the full ledger', n(staff) === ctx.localClaims, n(staff) + ' of ' + ctx.localClaims + ' claims returned');
    for (const r of ctx.readers) {
      const c = await call('GET', ledger, { as: r.id }); const s = await call('GET', srcs, { as: r.id });
      add(r.name + ' (own token) cannot read the raw ledger or sources', n(c) === 0 && n(s) === 0, n(c) + ' claim rows, ' + n(s) + ' source rows returned');
    }
    const forged = await call('GET', ledger, { as: ctx.readers[0].id, headers: { 'x-baton-persona': 'reviewer' } });
    add(ctx.readers[0].name + ' with a forged reviewer header still gets nothing', n(forged) === 0, n(forged) + ' rows');
    const anon = await call('GET', ledger, { anon: true });
    add('No sign-in: the public key alone is refused', !anon.ok || n(anon) === 0, anon.ok ? n(anon) + ' rows' : 'HTTP ' + anon.status);
    const cross = await call('GET', 'claims?select=ext_id', { workspace: uuid() });
    add('A workspace you are not a member of returns nothing', n(cross) === 0, n(cross) + ' rows');
    const forge = await call('POST', 'versions', { as: ctx.readers[0].id, body: { workspace_id: ws, ver: 'v-probe', state: 'approved', approved_by: 'x', content_hash: 'x' }, prefer: 'return=minimal' });
    add(ctx.readers[0].name + ' cannot approve a version', !forge.ok, 'HTTP ' + forge.status);
    if (ctx.version) {
      for (const r of ctx.readers) {
        const res = await call('GET', 'reader_handover?select=claim_ext_id,access,statement&ver=eq.' + encodeURIComponent(ctx.version.id), { as: r.id });
        const rows = res.data || [];
        const ids = rows.map(x => x.claim_ext_id).sort();
        const expected = (ctx.version.expected[r.id] || []).slice().sort();
        const badTag = rows.filter(x => !r.tags.includes(x.access)).length;
        const markers = [];
        Object.keys(ctx.restricted).forEach(tag => { if (!r.tags.includes(tag)) markers.push.apply(markers, ctx.restricted[tag]); });
        const leaked = rows.filter(x => markers.some(m => x.statement.toLowerCase().includes(m.toLowerCase()))).length;
        add(r.name + ': database returns exactly their view', ids.join() === expected.join() && badTag === 0 && leaked === 0,
          rows.length + ' rows (local check expects ' + expected.length + '), ' + badTag + ' outside their tags, ' + leaked + ' restricted phrases');
      }
    } else {
      add('Reader handover probes', true, 'Publish a version to probe what each reader receives from Postgres');
    }
    return out;
  }

  async function ping() {
    if (!db.configured) { setStatus('off'); return; }
    if (!session) { setStatus('signedout'); return; }
    try { await freshToken(); await rest('GET', 'personas?select=id&limit=1', { noWorkspace: true }); setStatus('online'); }
    catch (e) { if (session) setStatus('error', e); }
  }

  window.BatonDB = Object.assign(db, {
    workspace: () => ws, schedule, flush, newWorkspace, audit, publish, retract, loadReader, readerRows,
    receipt, request, reply, probes, ping, onChange: fn => listeners.add(fn),
    session: () => session, isStaff, signIn, signInDemo, signOut, setLocalMode, demoAccounts: DEMO, demoPassword: DEMO_PW,
    myHandover, myAck, myRequest, breakIn, sendInterview, interviewAnswers, myInterview, saveAnswer
  });
  ping();
})();
