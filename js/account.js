/* Sign-in screen, account menu and the reader's own handover page.
 *
 * #/login[/next]  Supabase Auth sign-in. Public demo accounts with one-click buttons, plus a normal
 *                 email + password form.
 * #/me            The signed-in reader's handover, read ONLY from Postgres with their own token
 *                 (no Studio state is used), plus "Try to break in": real attacks run as this user.
 */
(function () {
  'use strict';
  const E = window.BatonEngine;
  const S = window.BatonSample;
  const D = window.BatonDB;
  const PERSONA = Object.fromEntries(S.PERSONAS.map(p => [p.id, p]));
  const h = s => E.escapeHtml(s);
  const root = () => document.getElementById('accountRoot');
  let me = { loading: false, data: null, error: null, attacks: null, attacking: false };
  let busy = null;   // persona id or 'form' while signing in
  let formError = '';

  const toast = msg => (window.BatonStudio && window.BatonStudio.toast ? window.BatonStudio.toast(msg) : alert(msg));
  const session = () => (D && D.session ? D.session() : null);
  const homeFor = s => (s && D.isStaff() ? '#/studio/connect' : '#/me');

  // ---------------------------------------------------------------------------
  // Header account chip
  // ---------------------------------------------------------------------------
  function renderChip() {
    const slot = document.getElementById('accountChip');
    if (!slot) return;
    if (!D || !D.available) { slot.innerHTML = '<div class="workspace"><span class="workspace-dot"></span>LOCAL MODE</div>'; return; }
    const s = session();
    if (!D.configured) { slot.innerHTML = '<a class="acct-chip" href="#/login">Local mode · <b>Sign in</b></a>'; return; }
    if (!s) { slot.innerHTML = '<a class="acct-chip acct-signin" href="#/login">Sign in</a>'; return; }
    const p = PERSONA[s.persona] || { initials: '?', role: '' };
    slot.innerHTML = '<details class="acct-menu"><summary class="acct-chip"><span class="avatar sm">' + h(p.initials) + '</span><span><b>' + h(s.name) + '</b><span class="acct-role">' + h(p.role.split(' · ')[0]) + '</span></span></summary>' +
      '<div class="acct-pop" role="menu"><div class="hint mono">' + h(s.user.email) + '</div>' +
      '<a role="menuitem" href="' + homeFor(s) + '">' + (D.isStaff() ? 'Open the Studio' : 'My handover') + '</a>' +
      '<a role="menuitem" href="#/login">Switch account</a>' +
      '<button role="menuitem" type="button" data-acct="signout">Sign out</button></div></details>';
  }

  // ---------------------------------------------------------------------------
  // Sign-in screen
  // ---------------------------------------------------------------------------
  function renderLogin(next) {
    const s = session();
    const accts = D.demoAccounts || [];
    const card = a => '<div class="demo-acct' + (a.start ? ' is-start' : '') + '">' +
      '<div class="demo-top"><span class="avatar">' + h(a.initials) + '</span><div><b>' + h(a.name) + '</b><div class="hint">' + h(a.role) + '</div></div>' + (a.start ? '<span class="flag">START HERE</span>' : '') + '</div>' +
      '<p>' + h(a.does) + '</p>' +
      '<div class="demo-cred mono"><span>' + h(a.email) + '</span><span>' + h(D.demoPassword) + '</span></div>' +
      '<button class="btn ' + (a.start ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-acct="demo" data-p="' + h(a.persona) + '"' + (busy ? ' disabled' : '') + '>' + (busy === a.persona ? 'Signing in…' : 'Sign in as ' + h(a.name)) + '</button></div>';
    root().innerHTML =
      '<div class="acct-wrap">' +
      '<div class="acct-head"><span class="eyebrow">SUPABASE AUTH · ROW-LEVEL SECURITY</span><h1>Sign in to Baton</h1>' +
      '<p>Each account below is a real Supabase Auth user. Postgres reads who you are from your sign-in token and returns only what that role may see. The demo accounts are public and protect synthetic data only.</p>' +
      (s ? '<div class="notice info">Signed in as <b>' + h(s.name) + '</b> (' + h(s.user.email) + '). Pick another account to switch, or <a href="' + homeFor(s) + '">continue</a>.</div>' : '') + '</div>' +
      '<div class="demo-path"><b>Two-minute path:</b> 1. Sign in as <b>Prof. Rao</b>, load the sample, run the five steps and publish. 2. Switch to <b>Meera</b>: open her handover and press <b>Try to break in</b>. 3. Switch to <b>Rohan</b> or <b>Kavya</b> to see a different plan from the same version.</div>' +
      '<div class="demo-grid">' + accts.map(card).join('') + '</div>' +
      '<div class="acct-form card"><h3>Sign in with email</h3><p class="sub">Password for every demo account: <span class="mono">' + h(D.demoPassword) + '</span></p>' +
      '<form data-acct="form" novalidate><label>Email<input name="email" type="email" autocomplete="username" required placeholder="meera@baton.example"></label>' +
      '<label>Password<input name="password" type="password" autocomplete="current-password" required></label>' +
      (formError ? '<div class="notice warn" role="alert">' + h(formError) + '</div>' : '') +
      '<button class="btn btn-primary" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy === 'form' ? 'Signing in…' : 'Sign in') + '</button></form>' +
      '<p class="hint" style="margin-top:12px">Database unreachable? <button class="linkish" type="button" data-acct="local">Continue in local mode</button>: everything runs in this browser and nothing is saved to the database.</p></div>' +
      '</div>';
    root().dataset.next = next || '';
  }

  async function doSignIn(fn, who) {
    if (busy) return;
    busy = who; formError = '';
    rerender();
    try {
      const s = await fn();
      busy = null;
      toast('Signed in as ' + s.name + '.');
      const next = root().dataset.next;
      location.hash = next === 'studio' && D.isStaff() ? '#/studio/connect' : homeFor(s);
    } catch (e) {
      busy = null;
      formError = String(e.message || e);
      if (who !== 'form') toast(formError);
      rerender();
    }
  }

  // ---------------------------------------------------------------------------
  // The reader's own page: Postgres only
  // ---------------------------------------------------------------------------
  async function loadMe() {
    me.loading = true; me.error = null; rerender();
    try { me.data = await D.myHandover(); }
    catch (e) { me.error = String(e.message || e); }
    me.loading = false; rerender();
  }

  function renderMe() {
    const s = session();
    if (!s) { location.hash = '#/login/me'; return; }
    const p = PERSONA[s.persona];
    let body;
    if (me.loading && !me.data) body = '<div class="empty">Asking Postgres for your handover…</div>';
    else if (me.error) body = '<div class="notice warn">Could not load your handover: ' + h(me.error) + ' <button class="btn btn-ghost btn-sm" data-acct="reload">Try again</button></div>';
    else if (!me.data || !me.data.ver) body = '<div class="empty"><b>Nothing has been published to you yet</b>Nothing is shared before the reviewer approves. Sign in as Prof. Rao in this browser, run the Studio and publish; then come back as ' + h(s.name) + '.<div class="actions" style="justify-content:center"><a class="btn btn-primary" href="#/login">Switch account</a><button class="btn btn-ghost" data-acct="reload">Refresh</button></div></div>';
    else {
      const rows = me.data.rows.map(r => ({ id: r.claim_ext_id, type: r.type, statement: r.statement, label: r.label, access: r.access, date: r.claim_date, slot: r.slot, author: r.author, gapKey: r.gap_key, withheldFrom: r.withheld_from || [], reviewState: 'accepted', origin: 'extracted' }));
      const ho = E.composeHandover(rows, p);
      const receipts = Object.fromEntries(me.data.receipts.map(c => [c, true]));
      const requests = me.data.requests.map(r => ({ readerId: s.persona, gapKey: r.gap_key, status: r.status }));
      const total = Object.values(ho.sections).flat().length;
      const acked = Object.values(ho.sections).flat().filter(i => receipts[i.claimId]).length;
      body = '<div class="db-note is-ok"><b>Served by Postgres row-level security</b> with your own sign-in token: ' + rows.length + ' rows for ' + h(s.name) + '. Items you may not see never left the server; they appear below as gaps, exactly like missing items.</div>' +
        '<div class="notice info" style="margin:0 0 14px">Acknowledged <b>' + acked + ' of ' + total + '</b> items. Tick each one once you have read it.</div>' +
        window.BatonStudio.handoverBody(ho, { reader: p, versionId: me.data.ver, receipts, requests });
    }
    const ver = me.data && me.data.ver ? me.data.versions.find(v => v.ver === me.data.ver) : null;
    root().innerHTML =
      '<div class="acct-wrap">' +
      '<div class="acct-head"><span class="eyebrow">MY HANDOVER · MERIDIAN</span><h1>' + h(s.name) + '\'s continuation plan</h1>' +
      '<p>' + h(p.role) + '. You can read: ' + p.tags.map(t => '<span class="tag-pill">' + h(E.ACCESS_TAGS[t] || t) + '</span>').join(' ') + '</p>' +
      (ver ? '<div class="hint">Version ' + h(ver.ver) + ' · approved by ' + h(ver.approved_by) + ' · ' + new Date(ver.approved_at).toLocaleString() + '</div>' : '') + '</div>' +
      '<div class="split split-wide"><div class="card me-card" id="meCard">' + body + '</div>' +
      '<div style="display:grid;gap:14px;align-content:start">' + renderAttacks(p) + '</div></div></div>';
  }

  function renderAttacks(p) {
    const a = me.attacks;
    let list = '';
    if (a) list = '<div class="gate">' + a.map(x => '<div class="gate-item ' + (x.blocked ? 'pass' : 'fail') + '"><span class="ic">' + (x.blocked ? '✓' : '!') + '</span><div>' + h(x.attack) + '<small class="mono">' + h(x.how) + '</small><small>' + (x.blocked ? 'Blocked: ' : 'NOT BLOCKED: ') + h(x.result) + '</small></div></div>').join('') + '</div>' +
      '<p class="hint" style="margin-top:10px">' + a.filter(x => x.blocked).length + ' of ' + a.length + ' attempts blocked by Postgres. These are live requests with your real token, not a simulation.</p>';
    return '<div class="card"><div class="card-head"><div><h3>Try to break in</h3><p class="sub" style="margin:4px 0 0">Attack the database as ' + h(p.name) + ': read the data owner\'s sources, the full ledger and rows above your access, forge headers and tokens, and approve a version yourself.</p></div>' +
      '<button class="btn btn-primary btn-sm" data-acct="attack"' + (me.attacking ? ' disabled' : '') + '>' + (me.attacking ? 'Attacking…' : a ? 'Run again' : 'Try to break in') + '</button></div>' + list + '</div>';
  }

  async function runAttacks() {
    if (me.attacking) return;
    me.attacking = true; rerender();
    try { me.attacks = await D.breakIn(PERSONA[session().persona].tags); }
    catch (e) { toast('Could not run the attempts: ' + (e.message || e)); }
    me.attacking = false; rerender();
  }

  // ---------------------------------------------------------------------------
  // View plumbing
  // ---------------------------------------------------------------------------
  let view = null, arg = null;
  function rerender() {
    renderChip();
    if (view === 'login') renderLogin(arg);
    else if (view === 'me') renderMe();
  }

  window.BatonAccount = {
    show(v, a) {
      view = v; arg = a;
      if (v === 'me' && session() && !me.loading) loadMe();
      rerender();
    },
    renderChip
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-acct]');
    if (!el || el.disabled) return;
    const k = el.dataset.acct;
    if (k === 'demo') doSignIn(() => D.signInDemo(el.dataset.p), el.dataset.p);
    else if (k === 'signout') { D.signOut(); me = { loading: false, data: null, error: null, attacks: null, attacking: false }; el.closest('details') && el.closest('details').removeAttribute('open'); toast('Signed out.'); location.hash = '#/login'; }
    else if (k === 'local') { D.setLocalMode(true); toast('Local mode: everything runs in this browser; nothing is saved to the database.'); location.hash = '#/studio/connect'; }
    else if (k === 'reload') loadMe();
    else if (k === 'attack') runAttacks();
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-acct="form"]');
    if (!f) return;
    e.preventDefault();
    const fd = new FormData(f);
    doSignIn(() => D.signIn(fd.get('email'), fd.get('password')), 'form');
  });
  // Reader page: acknowledgements and access requests go to Postgres under the reader's own token.
  document.addEventListener('change', async e => {
    const el = e.target.closest('#accountRoot [data-change="ack"]');
    if (!el) return;
    el.disabled = true;
    try { await D.myAck(el.dataset.v, el.dataset.c, el.checked); await loadMe(); }
    catch (err) { el.checked = !el.checked; el.disabled = false; toast('Could not save: ' + (err.message || err)); }
  });
  document.addEventListener('click', async e => {
    const el = e.target.closest('#accountRoot [data-action="request"]');
    if (!el || el.disabled) return;
    el.disabled = true;
    try { await D.myRequest(el.dataset.k); toast('Request sent to the reviewer.'); await loadMe(); }
    catch (err) { el.disabled = false; toast('Could not send: ' + (err.message || err)); }
  });
  if (D) D.onChange(renderChip);
  renderChip();
})();
