/* Baton database layer: Supabase Postgres through its REST API, guarded by row-level security.
 *
 * - Only the publishable key is used. Every request carries the browser's workspace id and the
 *   current demo persona as headers; Postgres RLS policies (supabase/migrations) decide what comes back.
 * - Staff personas (reviewer, data owner) write the ledger; readers can only read their own
 *   approved handover rows through the security_invoker view `reader_handover`.
 * - Everything is best effort: if the database is not configured or unreachable, the Studio keeps
 *   working locally exactly as before, and the status pill says so.
 */
(function () {
  'use strict';
  const cfg = window.BATON_CONFIG || {};
  const URL = (cfg.supabaseUrl || '').replace(/\/+$/, '');
  const KEY = cfg.supabaseKey || '';
  const WS_KEY = 'baton-workspace-v1';
  const listeners = new Set();

  const db = {
    configured: !!(URL && KEY),
    status: URL && KEY ? 'connecting' : 'off', // off | connecting | online | error
    lastError: null,
    lastSync: null,
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

  let ws = null;
  try { ws = localStorage.getItem(WS_KEY); } catch (e) { /* storage blocked: session-only workspace */ }
  if (!ws) ws = uuid();
  let wsCreated = false;

  async function rest(method, path, opts) {
    opts = opts || {};
    const headers = { apikey: KEY, 'Content-Type': 'application/json', 'x-baton-workspace': opts.workspace || ws };
    if (!/^sb_/.test(KEY)) headers.Authorization = 'Bearer ' + KEY; // legacy anon JWT
    if (opts.persona) headers['x-baton-persona'] = opts.persona;
    if (opts.prefer) headers.Prefer = opts.prefer;
    const res = await fetch(URL + '/rest/v1/' + path, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(method + ' ' + path.split('?')[0] + ' failed (' + res.status + '): ' + text.slice(0, 160));
    }
    if (res.status === 204) return null;
    const t = await res.text();
    return t ? JSON.parse(t) : null;
  }

  async function ensureWorkspace() {
    if (wsCreated) return;
    await rest('POST', 'workspaces', { body: { id: ws }, prefer: 'resolution=ignore-duplicates,return=minimal' });
    wsCreated = true;
    try { localStorage.setItem(WS_KEY, ws); } catch (e) { /* fine */ }
  }

  // ---------------------------------------------------------------------------
  // Mapping between Studio objects and table rows
  // ---------------------------------------------------------------------------
  const isoDate = d => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null);
  const sourceRow = s => ({ workspace_id: ws, ext_id: s.id, title: s.title, kind: s.kind, access: s.access, author: s.author || null, source_date: isoDate(s.date), body: s.text, masked: s.masked || [], updated_at: new Date().toISOString() });
  const claimRow = c => ({
    workspace_id: ws, ext_id: c.id, type: c.type, statement: c.statement, label: c.label, access: c.access,
    origin: c.origin, review_state: c.reviewState, decided_by: c.decidedBy || null, source_ext_id: c.sourceId || null,
    quote: c.quote || null, claim_date: isoDate(c.date), dispute: c.dispute || null, withheld_from: c.withheldFrom || [],
    version: c.version || 1, updated_at: new Date().toISOString()
  });

  // ---------------------------------------------------------------------------
  // Ledger sync (debounced, staff persona)
  // ---------------------------------------------------------------------------
  let syncTimer = null;
  let pending = null;
  let syncing = false;
  let lastIds = { sources: new Set(), claims: new Set() };

  async function syncNow() {
    if (!db.configured || syncing || !pending) return;
    syncing = true;
    const snap = pending; pending = null;
    try {
      await ensureWorkspace();
      const srcRows = snap.sources.map(sourceRow);
      const clmRows = snap.claims.map(claimRow);
      if (srcRows.length) await rest('POST', 'sources?on_conflict=workspace_id,ext_id', { persona: 'owner', body: srcRows, prefer: 'resolution=merge-duplicates,return=minimal' });
      if (clmRows.length) await rest('POST', 'claims?on_conflict=workspace_id,ext_id', { persona: 'reviewer', body: clmRows, prefer: 'resolution=merge-duplicates,return=minimal' });
      // Remove rows that no longer exist in the Studio (removed sources, rebuilt claims).
      const goneS = [...lastIds.sources].filter(id => !snap.sources.some(s => s.id === id));
      const goneC = [...lastIds.claims].filter(id => !snap.claims.some(c => c.id === id));
      const list = ids => '(' + ids.map(i => '"' + String(i).replace(/"/g, '') + '"').join(',') + ')';
      if (goneC.length) await rest('DELETE', 'claims?workspace_id=eq.' + ws + '&ext_id=in.' + encodeURIComponent(list(goneC)), { persona: 'reviewer' });
      if (goneS.length) await rest('DELETE', 'sources?workspace_id=eq.' + ws + '&ext_id=in.' + encodeURIComponent(list(goneS)), { persona: 'owner' });
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
    ws = uuid(); wsCreated = false; lastIds = { sources: new Set(), claims: new Set() }; readerCache.clear();
    try { localStorage.setItem(WS_KEY, ws); } catch (e) { /* fine */ }
    emit();
  }

  function audit(actor, action) {
    if (!db.configured) return;
    ensureWorkspace()
      .then(() => rest('POST', 'audit_log', { persona: 'reviewer', body: { workspace_id: ws, actor: String(actor).slice(0, 120), action: String(action).slice(0, 600) }, prefer: 'return=minimal' }))
      .catch(() => { /* audit is best effort */ });
  }

  // ---------------------------------------------------------------------------
  // Publishing and reading the handover
  // ---------------------------------------------------------------------------
  const readerCache = new Map(); // key ver|reader -> { rows, at } | { error }

  async function publish(v) {
    if (!db.configured) return false;
    try {
      await flush();
      await ensureWorkspace();
      await rest('POST', 'versions', { persona: 'reviewer', body: { workspace_id: ws, ver: v.id, state: 'approved', approved_by: v.approvedBy, approved_at: v.at, content_hash: v.hash }, prefer: 'return=minimal' });
      const items = v.claims.map(c => ({
        workspace_id: ws, ver: v.id, claim_ext_id: c.id, type: c.type, statement: c.statement, label: c.confirmedBy ? 'Confirmed by ' + c.confirmedBy : c.label,
        access: c.access, claim_date: isoDate(c.date), slot: c.slot || null, author: c.author || null, gap_key: c.gapKey || null, withheld_from: c.withheldFrom || []
      }));
      if (items.length) await rest('POST', 'handover_items', { persona: 'reviewer', body: items, prefer: 'return=minimal' });
      readerCache.clear();
      setStatus('online');
      return true;
    } catch (e) { setStatus('error', e); return false; }
  }

  async function retract(ver) {
    if (!db.configured) return;
    try {
      await rest('PATCH', 'versions?workspace_id=eq.' + ws + '&ver=eq.' + encodeURIComponent(ver), { persona: 'reviewer', body: { state: 'retracted' }, prefer: 'return=minimal' });
      readerCache.clear(); emit();
    } catch (e) { setStatus('error', e); }
  }

  // Reader view straight from Postgres: RLS returns only this persona's permitted, non-withheld rows.
  async function loadReader(ver, reader) {
    const key = ver + '|' + reader;
    if (!db.configured) return null;
    try {
      const rows = await rest('GET', 'reader_handover?select=*&ver=eq.' + encodeURIComponent(ver) + '&order=claim_ext_id', { persona: reader });
      readerCache.set(key, { rows, at: Date.now() });
      setStatus('online');
    } catch (e) {
      readerCache.set(key, { error: String(e.message || e) });
      setStatus('error', e);
    }
    emit();
    return readerCache.get(key);
  }
  function readerRows(ver, reader) { return readerCache.get(ver + '|' + reader) || null; }

  function receipt(ver, reader, claimId, on) {
    if (!db.configured) return;
    const p = on
      ? rest('POST', 'receipts', { persona: reader, body: { workspace_id: ws, ver, reader, claim_ext_id: claimId }, prefer: 'resolution=ignore-duplicates,return=minimal' })
      : rest('DELETE', 'receipts?workspace_id=eq.' + ws + '&ver=eq.' + encodeURIComponent(ver) + '&reader=eq.' + reader + '&claim_ext_id=eq.' + encodeURIComponent(claimId), { persona: reader });
    ensureWorkspace().then(() => p).catch(e => setStatus('error', e));
  }

  function request(req) {
    if (!db.configured) return;
    ensureWorkspace()
      .then(() => rest('POST', 'access_requests', { persona: req.readerId, body: { workspace_id: ws, req_id: req.id, reader: req.readerId, gap_key: req.gapKey, status: req.status }, prefer: 'return=minimal' }))
      .catch(e => setStatus('error', e));
  }
  function reply(id, status) {
    if (!db.configured) return;
    rest('PATCH', 'access_requests?workspace_id=eq.' + ws + '&req_id=eq.' + encodeURIComponent(id), { persona: 'reviewer', body: { status }, prefer: 'return=minimal' })
      .catch(e => setStatus('error', e));
  }

  // ---------------------------------------------------------------------------
  // Database probes: ask Postgres directly, as each persona, what it returns.
  // ---------------------------------------------------------------------------
  async function count(path, persona, workspace) {
    const rows = await rest('GET', path, { persona, workspace });
    return Array.isArray(rows) ? rows.length : 0;
  }

  async function probes(ctx) {
    // ctx: { readers:[{id,name,tags}], localClaims, version: {id, expected: {readerId: [claimIds]}}, restricted: {tag:[markers]} }
    const out = [];
    const add = (name, pass, detail) => out.push({ name, pass, detail });
    await flush();
    const ledger = 'claims?select=ext_id&workspace_id=eq.' + ws;
    const srcs = 'sources?select=ext_id&workspace_id=eq.' + ws;
    const staffClaims = await count(ledger, 'reviewer');
    add('Reviewer reads the full ledger', staffClaims === ctx.localClaims, staffClaims + ' of ' + ctx.localClaims + ' claims returned');
    for (const r of ctx.readers) {
      const c = await count(ledger, r.id); const s = await count(srcs, r.id);
      add(r.name + ' cannot read the raw ledger or sources', c === 0 && s === 0, c + ' claim rows, ' + s + ' source rows returned');
    }
    const anonC = await count(ledger, null);
    add('No persona header: nothing returned', anonC === 0, anonC + ' rows');
    const otherWs = uuid();
    const crossC = await count('claims?select=ext_id', 'reviewer', otherWs);
    add('Another workspace id: nothing returned', crossC === 0, crossC + ' rows');
    if (ctx.version) {
      for (const r of ctx.readers) {
        const rows = await rest('GET', 'reader_handover?select=claim_ext_id,access,statement&ver=eq.' + encodeURIComponent(ctx.version.id), { persona: r.id });
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
    if (!db.configured) return;
    try { await rest('GET', 'personas?select=id&limit=1'); setStatus('online'); }
    catch (e) { setStatus('error', e); }
  }

  window.BatonDB = Object.assign(db, {
    workspace: () => ws, schedule, flush, newWorkspace, audit, publish, retract, loadReader, readerRows,
    receipt, request, reply, probes, ping, onChange: fn => listeners.add(fn)
  });
  ping();
})();
