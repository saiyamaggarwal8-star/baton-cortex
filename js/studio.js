/* Baton Handover Studio: the working workflow.
 * Connect -> Reconstruct -> Verify -> Review (human gate) -> Handover.
 * Runs in the browser on synthetic data; all checks are plain code (engine.js).
 */
(function () {
  'use strict';
  const E = window.BatonEngine;
  const S = window.BatonSample;
  const h = E.escapeHtml;
  const STORE = 'baton-studio-v1';
  const TODAY = new Date().toISOString().slice(0, 10);
  const PERSONA = Object.fromEntries(S.PERSONAS.map(p => [p.id, p]));
  const READERS = S.PERSONAS.filter(p => p.reader);
  const ALL = { id: '__all__', allAccess: true };

  const STEPS = [
    { id: 'connect', title: 'Connect', sub: 'Add sources and access tags' },
    { id: 'reconstruct', title: 'Reconstruct', sub: 'Split, mask, extract claims' },
    { id: 'verify', title: 'Verify', sub: 'Quote check, labels, leak tests' },
    { id: 'review', title: 'Review', sub: 'Human gate before sharing' },
    { id: 'handover', title: 'Handover', sub: 'Day-one plan with receipts' }
  ];

  const TYPE_LABEL = {
    decision: 'Decision', owner: 'Owner', open_question: 'Open question', risk: 'Risk', blocker: 'Blocker',
    next_action: 'Next action', recurring_problem: 'Recurring problem', dependency: 'Dependency', contact: 'Contact', process: 'How it runs'
  };
  const KIND_LABEL = { notes: 'Notes', chat: 'Chat export', tasks: 'Task board CSV', github: 'GitHub', commits: 'Commit log' };
  const SECTION_TITLE = {
    ownership: 'Ownership transfer', actions: 'First-week actions',
    risks: 'Risks, blockers and open questions', decisions: 'Decisions and how things run'
  };
  const GAP_TYPE = { owner: 'owner', run_deploy: 'process', credentials: 'process', scheduled_jobs: 'process', work_in_flight: 'next_action', who_to_ask: 'contact' };

  // Original secrets captured by masking. Kept in memory only (never saved),
  // used solely by the output leak scan.
  const vault = {};

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  function freshState() {
    return {
      sources: [], run: null, claims: [], step: 'connect', reviewTab: 'claims',
      selected: null, filter: { label: 'All', state: 'All' }, viewAs: 'meera', viewConfirmed: {},
      versions: [], reader: 'meera', receipts: {}, requests: [], audit: [], sampleIds: [],
      rev: 0, labClaim: null, labText: '', labOut: null, tests: null, editing: null, editNotice: null,
      draft: { title: '', kind: 'notes', access: 'core_team', text: '', date: '', csvHeaders: null, csvMap: null, repo: '' },
      showText: {}, answers: {}, answerAccess: {}
    };
  }
  let state = load() || freshState();

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* storage unavailable: still works this session */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return null;
      const s = Object.assign(freshState(), JSON.parse(raw));
      // Re-derive canaries for sample sources (custom-source secrets are not persisted).
      s.sources.forEach(src => {
        const sample = S.SAMPLE_SOURCES.find(x => x.id === src.id);
        if (sample) vault[src.id] = E.maskSecrets(sample.kind === 'tasks' ? E.csvToText(sample.raw).text : sample.raw).findings.map(f => f.original);
      });
      return s;
    } catch (e) { return null; }
  }

  function audit(actor, action) {
    state.audit.unshift({ at: new Date().toISOString(), actor, action });
    state.audit = state.audit.slice(0, 60);
  }
  function bump() { state.rev++; }

  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------
  const passageById = () => Object.fromEntries((state.run ? state.run.passages : []).map(p => [p.id, p]));
  const sourceById = id => state.sources.find(s => s.id === id);
  const claimById = id => state.claims.find(c => c.id === id);
  const allCanaries = () => Object.values(vault).flat();

  function labelClass(label) {
    if (!label) return '';
    if (label === 'Sourced') return 'lbl-sourced';
    if (label === 'Inferred') return 'lbl-inferred';
    if (label === 'Quote-only') return 'lbl-quoteonly';
    if (label === 'Possible conflict') return 'lbl-conflict';
    if (label === 'Superseded') return 'lbl-superseded';
    if (label === 'Missing') return 'lbl-missing';
    if (/^Confirmed by/.test(label)) return 'lbl-confirmed';
    if (/^Stated by/.test(label)) return 'lbl-stated';
    return '';
  }
  const labelPill = l => '<span class="claim-label ' + labelClass(l) + '">' + h(l) + '</span>';
  const tagPill = t => '<span class="tag tag-' + h(t) + '">' + h(E.ACCESS_TAGS[t] || t) + '</span>';
  const fmtDate = d => {
    if (!d) return '';
    const dt = new Date(d + (d.length === 10 ? 'T00:00:00Z' : ''));
    return isNaN(dt) ? d : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  };
  const shortDate = d => fmtDate(d).replace(/ \d{4}$/, '');

  function reviewerView() { return E.computeView(state.claims, ALL); }

  function conflictPairs() {
    const v = reviewerView();
    const seen = new Set();
    const pairs = [];
    v.items.forEach(c => {
      if (c.displayLabel !== 'Possible conflict') return;
      c.conflictWith.forEach(otherId => {
        const key = [c.id, otherId].sort().join('|');
        if (seen.has(key)) return;
        seen.add(key);
        const other = v.items.find(x => x.id === otherId);
        if (other) pairs.push([c, other]);
      });
    });
    return pairs;
  }

  // A claim with numbers or identifiers makes the lab's mutations meaningful.
  function defaultLabClaim() {
    return claimById(state.labClaim) || state.claims.find(c => c.origin === 'extracted' && E.mutate(c.statement).length >= 2) || state.claims.find(c => c.origin === 'extracted');
  }

  function hazards() { return E.staleHazards(state.claims, READERS); }

  function readerCanaries(reader) {
    const markers = [];
    Object.entries(S.RESTRICTED_MARKERS).forEach(([tag, list]) => { if (!reader.tags.includes(tag)) markers.push.apply(markers, list); });
    return allCanaries().concat(markers);
  }

  function outputScan(claims) {
    return READERS.map(r => {
      const text = E.renderHandoverText(E.composeHandover(claims, r));
      return { reader: r, found: E.canaryScan(text, readerCanaries(r)) };
    });
  }

  function unionGaps() {
    const map = {};
    READERS.forEach(r => {
      E.computeView(state.claims, r).gaps.forEach(g => {
        map[g.key] = map[g.key] || { key: g.key, title: g.title, readers: [] };
        map[g.key].readers.push(r.name);
      });
    });
    return Object.values(map);
  }

  function gate() {
    const live = state.claims.filter(c => c.reviewState !== 'rejected');
    const proposed = state.claims.filter(c => c.reviewState === 'proposed');
    const accepted = state.claims.filter(c => c.reviewState === 'accepted' || c.reviewState === 'edited');
    const conflicts = conflictPairs();
    const hz = hazards();
    const unconfirmed = READERS.filter(r => state.viewConfirmed[r.id] !== state.rev);
    const scan = outputScan(state.claims);
    const leaks = scan.filter(s => s.found.length);
    return [
      { ok: state.claims.length > 0 && proposed.length === 0, text: 'Every claim is accepted, edited or rejected', detail: proposed.length ? proposed.length + ' claim(s) still waiting for a decision' : accepted.length + ' accepted' },
      { ok: conflicts.length === 0, text: 'No open conflicts', detail: conflicts.length ? conflicts.length + ' conflict(s) to resolve in the Conflicts tab' : 'All conflicts resolved' },
      { ok: hz.length === 0, text: 'Every stale-fact hazard is decided', detail: hz.length ? hz.length + ' reader(s) would see a fact whose newer version is hidden from them' : 'None left' },
      { ok: unconfirmed.length === 0, text: 'Reviewer read each reader\'s view', detail: unconfirmed.length ? 'Still to confirm: ' + unconfirmed.map(r => r.name).join(', ') + ' (confirmations reset after any change)' : 'All views confirmed' },
      { ok: leaks.length === 0, text: 'Output scan passed (canaries and restricted text)', detail: leaks.length ? 'Found in: ' + leaks.map(l => l.reader.name).join(', ') : '0 canaries across ' + READERS.length + ' readers' },
      { ok: accepted.length > 0, text: 'At least one approved claim', detail: live.length + ' claim(s) in the ledger' }
    ];
  }

  function latestVersion() {
    for (let i = state.versions.length - 1; i >= 0; i--) if (state.versions[i].state === 'approved') return state.versions[i];
    return null;
  }

  function stepDone(id) {
    if (id === 'connect') return state.sources.length > 0;
    if (id === 'reconstruct') return !!state.run && !state.run.stale;
    if (id === 'verify') return !!state.tests;
    if (id === 'review') return !!latestVersion();
    if (id === 'handover') {
      const v = latestVersion();
      return !!v && READERS.some(r => Object.keys(((state.receipts[v.id] || {})[r.id]) || {}).length);
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function makeSource(o) {
    let text = o.raw || '';
    let csv = null;
    if (o.kind === 'tasks') {
      const c = E.csvToText(text, o.mapping);
      text = c.text; csv = { headers: c.headers, mapping: c.mapping };
    } else if (o.kind === 'chat' && /^\s*[\[{]/.test(text)) {
      const t = E.chatJsonToText(text);
      if (t) text = t;
    }
    const m = E.maskSecrets(text);
    const id = o.id || 'src-' + Math.random().toString(36).slice(2, 8);
    vault[id] = m.findings.map(f => f.original);
    return {
      id, title: o.title || 'Untitled source', kind: o.kind, access: o.access, author: o.author || null,
      date: o.date || E.parseDate(text.slice(0, 400)) || TODAY, text: m.text,
      masked: m.findings.map(f => f.type), csv, addedAt: new Date().toISOString()
    };
  }

  function markStale() { if (state.run) state.run.stale = true; }

  function loadSample() {
    state = freshState();
    Object.keys(vault).forEach(k => delete vault[k]);
    S.SAMPLE_SOURCES.forEach(s => state.sources.push(makeSource(s)));
    audit('Priya (data owner)', 'Loaded the synthetic Meridian sample (' + state.sources.length + ' sources)');
    state.step = 'connect';
    save(); render();
    toast('Meridian sample loaded: 6 sources. Next, run Reconstruct.');
  }

  function runReconstruct() {
    const r = E.runPipeline(state.sources);
    state.run = { passages: r.passages, dropped: r.dropped, quarantined: r.quarantined, candidates: r.claims.length + r.dropped.length, at: new Date().toISOString(), stale: false };
    // Leaver answers survive a re-run; extracted claims are rebuilt.
    const keep = state.claims.filter(c => c.origin === 'leaver');
    state.claims = r.claims.concat(keep);
    // Random 10% sample (min 5) the reviewer must decide one by one.
    const pool = state.claims.filter(c => c.origin === 'extracted').map(c => c.id);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    state.sampleIds = pool.slice(0, E.sampleSize(pool.length));
    state.selected = state.claims[0] ? state.claims[0].id : null;
    state.tests = null; state.viewConfirmed = {}; bump();
    audit('System', 'Reconstructed ' + state.claims.length + ' claims from ' + state.sources.length + ' sources');
    save(); render();
    toast(r.claims.length + ' claims stored, ' + r.dropped.length + ' not stored, ' + r.quarantined.length + ' instruction-like text quarantined.');
  }

  function runTests() {
    const claims = state.claims.map(c => Object.assign({}, c, { reviewState: 'accepted' })); // worst case: everything approved
    const mt = E.mutationTest(state.claims, passageById());
    const scan = outputScan(claims);
    const diff = READERS.map(r => ({ reader: r, d: E.differentialTest(claims, r) }));
    const gapShape = READERS.map(r => E.computeView(claims, r).gaps.every(g => g.text === E.GAP_TEXT && Object.keys(g).join() === 'key,title,text'));
    state.tests = {
      at: new Date().toISOString(),
      mutations: { total: mt.total, falseAccepts: mt.falseAccepts, sample: mt.details.slice(0, 8) },
      canaries: { readers: READERS.length, found: scan.reduce((a, s) => a + s.found.length, 0), secrets: allCanaries().length },
      differential: diff.map(x => ({ name: x.reader.name, ran: x.d.ran, identical: x.d.identical })),
      gapShape: gapShape.every(Boolean)
    };
    audit('System', 'Ran leak and quote-guard tests');
    save(); render();
  }

  function decide(id, decision) {
    const c = claimById(id);
    if (!c) return;
    c.reviewState = decision;
    c.decidedBy = 'Prof. Rao';
    bump();
    audit('Prof. Rao (reviewer)', (decision === 'accepted' ? 'Accepted ' : 'Rejected ') + id);
    // Move to the next undecided claim.
    const next = filteredClaims().find(x => x.reviewState === 'proposed' && x.id !== id);
    if (next) state.selected = next.id;
    save(); render();
  }

  function saveEdit(id, text) {
    const c = claimById(id);
    if (!c) return;
    const statement = E.toStatement(E.maskSecrets(text).text, null);
    if (c.quote) {
      const passage = passageById()[c.passageId];
      const v = E.verifyClaim({ statement, quote: c.quote, author: c.author }, passage);
      if (!v.stored) {
        state.editNotice = { id, text: 'Edit not saved. ' + v.reason.replace(/\.?$/, '.') + ' An edited statement must still be supported by its quote. To add new information, record it as a "Stated by" answer in the gap interview.' };
        render();
        return;
      }
      c.label = v.label; c.checks = v.checks;
    }
    c.statement = statement;
    c.reviewState = 'edited';
    c.version = (c.version || 1) + 1;
    c.editedBy = 'Prof. Rao';
    state.editing = null; state.editNotice = null; bump();
    audit('Prof. Rao (reviewer)', 'Edited ' + id + ' (version ' + c.version + ')');
    save(); render();
    toast('Saved as version ' + c.version + '. The quote still supports it.');
  }

  function bulkApprove() {
    let n = 0;
    state.claims.forEach(c => {
      if (c.reviewState === 'proposed' && E.bulkEligible(c, TODAY) && !conflictIds().has(c.id)) { c.reviewState = 'accepted'; c.decidedBy = 'Prof. Rao (bulk)'; n++; }
    });
    bump();
    audit('Prof. Rao (reviewer)', 'Bulk-approved ' + n + ' low-risk Sourced claims');
    save(); render();
    toast(n + ' low-risk claims approved. The rest need one-by-one review.');
  }

  function conflictIds() {
    const s = new Set();
    conflictPairs().forEach(([a, b]) => { s.add(a.id); s.add(b.id); });
    return s;
  }

  function resolveConflict(aId, bId, mode) {
    const a = claimById(aId), b = claimById(bId);
    if (mode === 'a') { a.resolution = 'kept'; b.reviewState = 'rejected'; if (a.reviewState === 'proposed') a.reviewState = 'accepted'; }
    else if (mode === 'b') { b.resolution = 'kept'; a.reviewState = 'rejected'; if (b.reviewState === 'proposed') b.reviewState = 'accepted'; }
    else { a.resolution = 'kept'; b.resolution = 'kept'; }
    bump();
    audit('Prof. Rao (reviewer)', 'Resolved conflict ' + aId + ' vs ' + bId + ' (' + (mode === 'both' ? 'both kept, marked resolved' : 'kept ' + (mode === 'a' ? aId : bId)) + ')');
    save(); render();
  }

  function resolveHazard(claimId, readerId, mode) {
    const c = claimById(claimId);
    if (mode === 'withhold') { c.withheldFrom = (c.withheldFrom || []).concat(readerId); }
    else { c.reviewState = 'rejected'; }
    bump();
    audit('Prof. Rao (reviewer)', (mode === 'withhold' ? 'Withheld ' + claimId + ' from ' + PERSONA[readerId].name : 'Rejected stale claim ' + claimId));
    save(); render();
  }

  function answerGap(key) {
    const text = (state.answers[key] || '').trim();
    if (!text) { toast('Type an answer first.'); return; }
    const m = E.maskSecrets(text);
    const access = state.answerAccess[key] || 'core_team';
    const n = state.claims.length + 1;
    const gapTitle = (E.CHECKLIST.find(x => x.key === key) || {}).title;
    state.claims.push({
      id: 'CLM-' + (100 + n) + 'A', type: GAP_TYPE[key] || 'process', statement: E.toStatement(m.text, null), quote: null,
      sourceId: null, passageId: null, matchMethod: null, checks: {}, label: 'Stated by Aarav, ' + shortDate(TODAY),
      reason: 'The departing lead\'s own words, given in the gap interview. Never labelled Sourced.', access,
      origin: 'leaver', gapKey: key, question: gapTitle, author: 'Aarav', date: TODAY, slot: null, flags: m.findings.length ? ['secret-masked'] : [],
      reviewState: 'proposed', version: 1
    });
    state.answers[key] = '';
    bump();
    audit('Aarav (leaver)', 'Answered gap "' + gapTitle + '"' + (m.findings.length ? ' (a secret was masked)' : ''));
    save(); render();
    toast(m.findings.length ? 'Answer saved. A secret in it was masked before storing.' : 'Answer saved as "Stated by Aarav". The reviewer decides on it next.');
  }

  function confirmSide(id) {
    const c = claimById(id);
    c.confirmedBy = 'Aarav, ' + shortDate(TODAY);
    bump();
    audit('Aarav (leaver)', 'Confirmed ' + id);
    save(); render();
  }

  async function publish() {
    if (!gate().every(g => g.ok)) return;
    const snapshot = state.claims.filter(c => c.reviewState === 'accepted' || c.reviewState === 'edited').map(c => JSON.parse(JSON.stringify(c)));
    const hash = await E.sha256(JSON.stringify(snapshot));
    const v = { id: 'v' + (state.versions.length + 1), state: 'approved', approvedBy: 'Prof. Rao', at: new Date().toISOString(), hash, claims: snapshot };
    state.versions.push(v);
    audit('Prof. Rao (reviewer)', 'Approved and published ' + v.id + ' (' + snapshot.length + ' claims)');
    goStep('handover');
    toast(v.id + ' approved. Readers can now open their handover.');
  }

  function retract(id) {
    const v = state.versions.find(x => x.id === id);
    if (!v) return;
    v.state = 'retracted';
    v.retractedAt = new Date().toISOString();
    audit('Prof. Rao (reviewer)', 'Retracted ' + id);
    save(); render();
    toast(id + ' retracted. If a credential leaked, it still has to be rotated.');
  }

  function toggleAck(vid, rid, cid, on) {
    state.receipts[vid] = state.receipts[vid] || {};
    state.receipts[vid][rid] = state.receipts[vid][rid] || {};
    if (on) state.receipts[vid][rid][cid] = new Date().toISOString();
    else delete state.receipts[vid][rid][cid];
    if (on) audit(PERSONA[rid].name, 'Acknowledged ' + cid + ' in ' + vid);
    save(); render();
  }

  function requestAccess(rid, key) {
    if (state.requests.some(r => r.readerId === rid && r.gapKey === key && r.status === 'open')) { toast('Request already sent.'); return; }
    state.requests.push({ id: 'REQ-' + (state.requests.length + 1), readerId: rid, gapKey: key, status: 'open', at: new Date().toISOString() });
    audit(PERSONA[rid].name, 'Requested access for "' + (E.CHECKLIST.find(x => x.key === key) || {}).title + '"');
    save(); render();
    toast('Request sent to the reviewer.');
  }

  function replyRequest(id, status) {
    const r = state.requests.find(x => x.id === id);
    r.status = status;
    audit('Prof. Rao (reviewer)', 'Replied to ' + id + ': ' + status);
    save(); render();
  }

  // Real reason behind a gap, shown to the reviewer only.
  function realReason(req) {
    const reader = PERSONA[req.readerId];
    const item = E.CHECKLIST.find(x => x.key === req.gapKey);
    const hidden = state.claims.filter(c => c.reviewState !== 'rejected' && item.test(c) && !E.canSee(reader, c));
    if (hidden.length) return 'Restricted: ' + hidden.length + ' claim(s) exist under ' + hidden.map(c => E.ACCESS_TAGS[c.access]).filter((v, i, a) => a.indexOf(v) === i).join(', ');
    return 'Undocumented: no claim covers this item.';
  }

  async function importGithub(repo) {
    const m = String(repo || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '').match(/^([\w.-]+)\/([\w.-]+)/);
    if (!m) { toast('Use the form owner/repo, for example vercel/next.js'); return; }
    const base = 'https://api.github.com/repos/' + m[1] + '/' + m[2];
    toast('Importing ' + m[1] + '/' + m[2] + ' from the public GitHub API...');
    try {
      const [readme, issues] = await Promise.all([
        fetch(base + '/readme', { headers: { Accept: 'application/vnd.github.raw' } }),
        fetch(base + '/issues?state=all&per_page=20')
      ]);
      if (!issues.ok) throw new Error(issues.status === 404 ? 'Repository not found or private' : issues.status === 403 ? 'GitHub rate limit reached, try again later' : 'GitHub returned ' + issues.status);
      const access = state.draft.access || 'all_members';
      if (readme.ok) {
        const text = (await readme.text()).slice(0, 6000);
        state.sources.push(makeSource({ title: m[1] + '/' + m[2] + ' README', kind: 'notes', access, raw: text }));
      }
      const list = await issues.json();
      const lines = [];
      list.forEach(i => {
        lines.push((i.pull_request ? 'PR #' : 'Issue #') + i.number + ' ' + String(i.title).replace(/\s+/g, ' ') + ' (opened ' + String(i.created_at).slice(0, 10) + ')');
        const login = (i.user && i.user.login) || 'Unknown';
        const body = String(i.body || '').replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 700);
        if (body) lines.push(login.charAt(0).toUpperCase() + login.slice(1).replace(/[^A-Za-z0-9 .'-]/g, '') + ': ' + body);
      });
      state.sources.push(makeSource({ title: m[1] + '/' + m[2] + ' issues and PRs', kind: 'github', access, raw: lines.join('\n') }));
      markStale();
      audit('Priya (data owner)', 'Imported GitHub repo ' + m[1] + '/' + m[2]);
      save(); render();
      toast('Imported ' + list.length + ' issues/PRs' + (readme.ok ? ' and the README' : '') + '.');
    } catch (e) {
      toast('GitHub import failed: ' + e.message);
    }
  }

  function addDraftSource() {
    const d = state.draft;
    if (!d.text.trim()) { toast('Paste some text or choose a file first.'); return; }
    const mapping = d.kind === 'tasks' && d.csvMap ? d.csvMap : undefined;
    const src = makeSource({ title: d.title.trim() || (KIND_LABEL[d.kind] + ' ' + (state.sources.length + 1)), kind: d.kind, access: d.access, raw: d.text, date: d.date || null, mapping });
    state.sources.push(src);
    markStale();
    audit('Priya (data owner)', 'Added source "' + src.title + '" (' + E.ACCESS_TAGS[src.access] + ')');
    state.draft = Object.assign(freshState().draft, { kind: d.kind, access: d.access });
    save(); render();
    toast('Source added' + (src.masked.length ? ', ' + src.masked.length + ' secret(s) masked' : '') + '.');
  }

  // ---------------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------------
  function actorBar(personaId, text) {
    const p = personaId === 'system' ? { name: 'System', role: 'Plain code, no model calls', initials: '{ }' } : PERSONA[personaId];
    return '<div class="actor"><div class="avatar">' + h(p.initials) + '</div><div>Acting as <b>' + h(p.name) + '</b> · ' + h(p.role) + '</div><div class="hint" style="margin-left:auto">' + text + '</div></div>';
  }

  function stepper() {
    return '<nav class="stepper" aria-label="Workflow steps">' + STEPS.map((s, i) =>
      '<button data-action="step" data-step="' + s.id + '" class="' + (state.step === s.id ? 'active ' : '') + (stepDone(s.id) ? 'done' : '') + '"' + (state.step === s.id ? ' aria-current="step"' : '') + '>' +
      '<span class="s-num"><span class="s-dot"></span>STEP ' + (i + 1) + (stepDone(s.id) ? ' · DONE' : '') + '</span><span class="s-title">' + s.title + '</span><span class="s-sub">' + s.sub + '</span></button>'
    ).join('') + '</nav>';
  }

  function nextBtn(step, text, enabled) {
    return '<div class="actions" style="justify-content:flex-end;margin-top:16px"><button class="btn btn-primary" data-action="step" data-step="' + step + '"' + (enabled === false ? ' disabled' : '') + '>' + text + ' →</button></div>';
  }

  function accessSelect(attrs, value) {
    return '<select class="access-select" ' + attrs + '>' + Object.keys(E.ACCESS_TAGS).map(t => '<option value="' + t + '"' + (t === value ? ' selected' : '') + '>' + E.ACCESS_TAGS[t] + '</option>').join('') + '</select>';
  }

  function sourceTextWithHighlight(src, start, end) {
    const text = src.text;
    if (start == null || end == null) return h(text);
    const from = Math.max(0, text.lastIndexOf('\n', Math.max(0, start - 160)));
    const to = text.indexOf('\n', Math.min(text.length, end + 160));
    const sliceEnd = to === -1 ? text.length : to;
    return (from > 0 ? '…' : '') + h(text.slice(from, start)) + '<mark>' + h(text.slice(start, end)) + '</mark>' + h(text.slice(end, sliceEnd)) + (sliceEnd < text.length ? '\n…' : '');
  }

  // ---------------------------------------------------------------------------
  // Step 1: Connect
  // ---------------------------------------------------------------------------
  function renderConnect() {
    const d = state.draft;
    const list = state.sources.length ? state.sources.map(s =>
      '<div class="src"><div class="src-top"><div class="src-title"><span class="kind">' + h(KIND_LABEL[s.kind] || s.kind) + '</span>' + h(s.title) + '</div>' +
      '<div class="row" style="gap:6px;align-items:center"><label class="lbl" for="acc-' + h(s.id) + '">Who may see it</label>' + accessSelect('id="acc-' + h(s.id) + '" data-change="access" data-id="' + h(s.id) + '"', s.access) +
      '<button class="btn btn-ghost btn-sm" data-action="toggleText" data-id="' + h(s.id) + '">' + (state.showText[s.id] ? 'Hide' : 'Show') + ' stored text</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="removeSource" data-id="' + h(s.id) + '" aria-label="Remove ' + h(s.title) + '">Remove</button></div></div>' +
      '<div class="src-meta"><span>' + fmtDate(s.date) + '</span><span>' + s.text.split('\n').filter(Boolean).length + ' lines</span>' +
      (s.masked.length ? '<span class="mask-badge">' + s.masked.length + ' masked on import: ' + h(Array.from(new Set(s.masked)).join(', ')) + '</span>' : '<span>no secrets found</span>') +
      (s.csv ? '<span>CSV columns mapped: ' + h(Object.entries(s.csv.mapping).map(([f, i]) => s.csv.headers[i] + '→' + f).join(', ')) + '</span>' : '') + '</div>' +
      (state.showText[s.id] ? '<pre>' + h(s.text) + '</pre>' : '') + '</div>'
    ).join('') : '<div class="empty"><b>No sources yet</b>Load the synthetic Meridian sample to try the full workflow in two minutes, or add your own notes, chat export, task CSV or a public GitHub repo.<div class="actions" style="justify-content:center"><button class="btn btn-primary" data-action="loadSample">Load Meridian sample</button></div></div>';

    let csvBlock = '';
    if (d.kind === 'tasks') {
      if (d.csvHeaders) {
        csvBlock = '<div class="card" style="padding:12px;margin:6px 0 10px;background:#1a1f1c"><div class="lbl" style="margin-bottom:8px">Column mapping</div><div class="row">' +
          ['title', 'owner', 'status', 'due', 'notes'].map(f => '<div class="field"><label for="map-' + f + '">' + f + '</label><select class="select" id="map-' + f + '" data-change="csvMap" data-field="' + f + '"><option value="">(none)</option>' +
            d.csvHeaders.map((hd, i) => '<option value="' + i + '"' + (d.csvMap && d.csvMap[f] === i ? ' selected' : '') + '>' + h(hd) + '</option>').join('') + '</select></div>').join('') +
          '</div><div class="hint">Unfamiliar headers? Map them here before import.</div></div>';
      } else {
        csvBlock = '<div class="actions" style="margin:0 0 10px"><button class="btn btn-ghost btn-sm" data-action="checkCsv">Check CSV columns</button><span class="hint">Map unfamiliar headers before import</span></div>';
      }
    }

    return actorBar('owner', 'The data owner chooses which sources Baton may use and who may see each one. Secrets and personal data are masked on import.') +
      '<div class="split"><div class="card"><div class="card-head"><div><h3>Sources (' + state.sources.length + ')</h3><p class="sub" style="margin:4px 0 0">Every claim inherits its source\'s access tag.</p></div>' +
      (state.sources.length ? '<button class="btn btn-ghost btn-sm" data-action="loadSample">Reload sample</button>' : '') + '</div><div class="src-list">' + list + '</div></div>' +
      '<div style="display:grid;gap:14px"><div class="card"><h3>Add a source</h3><p class="sub">Paste text or upload a .md, .txt, .csv or .json file. Chat lines like "[2026-10-03 21:14] Karan: message" keep their author and date.</p>' +
      '<div class="row"><div class="field"><label for="d-title">Title</label><input class="input" id="d-title" data-model="title" value="' + h(d.title) + '" placeholder="e.g. Sprint 4 retro notes"></div>' +
      '<div class="field"><label for="d-kind">Type</label><select class="select" id="d-kind" data-change="draftKind">' + Object.keys(KIND_LABEL).map(k => '<option value="' + k + '"' + (k === d.kind ? ' selected' : '') + '>' + KIND_LABEL[k] + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="d-access">Who may see it</label>' + accessSelect('class="select" id="d-access" data-change="draftAccess"', d.access).replace('class="access-select" ', '') + '</div></div>' +
      '<div class="field"><label for="d-text">Content</label><textarea class="textarea" id="d-text" data-model="text" placeholder="Paste meeting notes, a chat export, CSV rows...">' + h(d.text) + '</textarea></div>' +
      csvBlock +
      '<div class="row" style="justify-content:space-between;align-items:center"><div class="file-drop"><label class="lbl" for="d-file">Or upload</label><input type="file" id="d-file" accept=".md,.txt,.csv,.json,text/plain,text/csv,application/json" data-change="file"></div>' +
      '<button class="btn btn-primary" data-action="addSource">Add source</button></div></div>' +
      '<div class="card"><h3>Import a public GitHub repo</h3><p class="sub">Pulls the README and the latest 20 issues and PRs through the GitHub REST API (no sign-in, public repos only).</p>' +
      '<div class="row"><div class="field"><label for="d-repo">owner/repo</label><input class="input" id="d-repo" data-model="repo" value="' + h(d.repo) + '" placeholder="e.g. expressjs/express"></div><button class="btn btn-ghost" data-action="importGithub">Import</button></div>' +
      '<div class="hint">Uses the access tag chosen above.</div></div></div></div>' +
      nextBtn('reconstruct', 'Next: Reconstruct', state.sources.length > 0);
  }

  // ---------------------------------------------------------------------------
  // Step 2: Reconstruct
  // ---------------------------------------------------------------------------
  function renderReconstruct() {
    const r = state.run;
    const head = actorBar('system', 'Sources are split into passages that keep source, position and author. Rules propose typed claims, each with an exact quote. Instruction-like text is quarantined.');
    if (!state.sources.length) return head + '<div class="empty"><b>Add a source first</b><button class="btn btn-primary" data-action="step" data-step="connect">Go to Connect</button></div>';
    let body = '<div class="card"><div class="card-head"><div><h3>Reconstruct the ledger</h3><p class="sub" style="margin:4px 0 0">' + state.sources.length + ' source(s) ready.' + (r && r.stale ? ' <b style="color:#fde047">Sources changed since the last run.</b>' : '') + '</p></div>' +
      '<button class="btn btn-primary" data-action="runReconstruct">' + (r ? 'Run again' : 'Run reconstruct') + '</button></div>';
    if (r) {
      const stored = state.claims.filter(c => c.origin !== 'leaver').length;
      const masked = state.sources.reduce((a, s) => a + s.masked.length, 0);
      body += '<div class="pipeline">' +
        '<div class="pipe"><b>' + state.sources.length + '</b><span>Sources</span></div>' +
        '<div class="pipe"><b>' + r.passages.length + '</b><span>Passages</span></div>' +
        '<div class="pipe"><b>' + r.candidates + '</b><span>Candidate claims</span></div>' +
        '<div class="pipe"><b class="ok">' + stored + '</b><span>Stored (passed checks)</span></div>' +
        '<div class="pipe"><b class="' + (r.dropped.length ? 'bad' : '') + '">' + r.dropped.length + '</b><span>Not stored</span></div></div>' +
        '<div class="grid3" style="margin-bottom:14px"><div class="kpi"><b>' + masked + '</b><span>Secrets / personal data masked</span></div><div class="kpi ' + (r.quarantined.length ? 'warn' : '') + '"><b>' + r.quarantined.length + '</b><span>Instruction-like text quarantined</span></div><div class="kpi"><b>' + state.claims.filter(c => c.origin === 'derived').length + '</b><span>Ownership inferred from commits</span></div></div>';
      body += '<div class="grid2"><div><div class="lbl" style="margin-bottom:8px">Quarantined (never becomes a claim)</div><div class="log">' +
        (r.quarantined.length ? r.quarantined.map(q => '<div class="log-item quarantine">' + h(q.author ? q.author + ': ' : '') + '“' + h(q.text) + '”<span class="why">Looks like an instruction to the system. Shown here for provenance only.</span></div>').join('') : '<div class="log-item">Nothing suspicious found.</div>') +
        '</div></div><div><div class="lbl" style="margin-bottom:8px">Not stored, with reasons</div><div class="log">' +
        (r.dropped.length ? r.dropped.map(d => '<div class="log-item">' + h(d.statement) + '<span class="why">' + h(d.reason) + '</span></div>').join('') : '<div class="log-item">Every candidate passed the quote check, token guard and support check. Try the Quote guard lab in Verify to see failures.</div>') +
        '</div></div></div>';
    }
    body += '</div>';
    return head + body + nextBtn('verify', 'Next: Verify', !!r);
  }

  // ---------------------------------------------------------------------------
  // Step 3: Verify
  // ---------------------------------------------------------------------------
  function renderVerify() {
    const head = actorBar('system', 'Code, not a model, decides labels: exact match first, fuzzy fallback with sliding windows, an exact-token guard for numbers, versions, paths, identifiers and negations, then a separate support check.');
    if (!state.run) return head + '<div class="empty"><b>Run Reconstruct first</b><button class="btn btn-primary" data-action="step" data-step="reconstruct">Go to Reconstruct</button></div>';
    const by = l => state.claims.filter(c => c.label === l).length;
    let html = head + '<div class="grid4">' +
      '<div class="kpi good"><b>' + by('Sourced') + '</b><span>Sourced</span></div><div class="kpi"><b>' + by('Inferred') + '</b><span>Inferred (numbers shown)</span></div>' +
      '<div class="kpi"><b>' + state.claims.filter(c => c.origin === 'leaver').length + '</b><span>Stated by a person</span></div><div class="kpi ' + (state.run.dropped.length ? 'warn' : '') + '"><b>' + state.run.dropped.length + '</b><span>Not stored</span></div></div>';

    // Claims table
    html += '<div class="card" style="margin-bottom:14px"><div class="card-head"><div><h3>Claim ledger</h3><p class="sub" style="margin:4px 0 0">Every stored claim, with the checks that let it in.</p></div></div><div class="table-wrap"><table class="ctable"><thead><tr><th>ID</th><th>Type</th><th>Statement</th><th>Label</th><th>Access</th><th>Quote match</th><th>Token guard</th><th>Support</th></tr></thead><tbody>' +
      state.claims.map(c => {
        const ch = c.checks || {};
        return '<tr><td class="mono">' + h(c.id) + '</td><td>' + h(TYPE_LABEL[c.type] || c.type) + '</td><td>' + h(c.statement) + '</td><td>' + labelPill(c.label) + '</td><td>' + tagPill(c.access) + '</td>' +
          '<td>' + (c.origin === 'derived' ? 'derived from commits' : c.origin === 'leaver' ? 'n/a (person)' : h((ch.match && ch.match.method) || '') + (ch.match && ch.match.method === 'fuzzy' ? ' ' + ch.match.score : '')) + '</td>' +
          '<td>' + (ch.guard ? (ch.guard.pass ? '<span class="ok">pass</span>' : '<span class="bad">fail</span>') : '–') + '</td>' +
          '<td>' + (ch.support ? '<span class="' + (ch.support.verdict === 'yes' ? 'ok' : 'meh') + '">' + h(ch.support.verdict) + ' (' + ch.support.score + ')</span>' : '–') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';

    // Per-reader summary
    html += '<div class="card" style="margin-bottom:14px"><h3>Computed per reader</h3><p class="sub">Conflict, superseded and missing labels are computed over the claims each reader may see (shown here as if every claim were approved).</p><div class="grid3">' +
      READERS.map(r => {
        const v = E.computeView(state.claims, r);
        return '<div class="kpi"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div class="avatar" style="width:26px;height:26px;font-size:9px">' + h(r.initials) + '</div><b style="font-size:13px">' + h(r.name) + '</b></div>' +
          '<div class="hint" style="font-size:11px;line-height:1.7">' + v.items.length + ' visible claims<br>' + v.items.filter(i => i.displayLabel === 'Possible conflict').length + ' in conflict · ' + v.items.filter(i => i.displayLabel === 'Superseded').length + ' superseded<br>Missing: ' + (v.gaps.map(g => h(g.title)).join(', ') || 'none') + '</div></div>';
      }).join('') + '</div></div>';

    // Lab + tests
    const labClaim = defaultLabClaim();
    const out = state.labOut;
    html += '<div class="grid2"><div class="card"><h3>Quote guard lab</h3><p class="sub">Change a number, an identifier or add a "not", then check. The quote stays fixed; only the statement changes.</p>' +
      (labClaim ? '<div class="field"><label for="lab-claim">Claim</label><select class="select" id="lab-claim" data-change="labClaim">' +
        state.claims.filter(c => c.origin === 'extracted').map(c => '<option value="' + h(c.id) + '"' + (c.id === labClaim.id ? ' selected' : '') + '>' + h(c.id + ' · ' + c.statement.slice(0, 70)) + '</option>').join('') + '</select></div>' +
        '<div class="lbl">Quote in the source</div><div class="passage" style="margin:6px 0 10px;max-height:90px">' + h(labClaim.quote) + '</div>' +
        '<div class="field"><label for="lab-text">Statement to check</label><textarea class="textarea" style="min-height:70px" id="lab-text" data-model-lab="1">' + h(state.labText || labClaim.statement) + '</textarea></div>' +
        '<div class="actions" style="margin-top:0"><button class="btn btn-primary btn-sm" data-action="labCheck">Check statement</button>' +
        E.mutate(labClaim.statement).map(m => '<button class="btn btn-ghost btn-sm" data-action="labMutate" data-text="' + h(m.text) + '">Try: ' + h(m.kind) + '</button>').join('') + '</div>' +
        (out ? '<div class="notice ' + (out.stored ? 'good' : 'warn') + '"><b>' + (out.stored ? 'Stored as ' + h(out.label) : 'Not stored') + '.</b> ' + h(out.reason) + '</div>' : '') : '<div class="empty">No extracted claims.</div>') +
      '</div><div class="card"><div class="card-head"><div><h3>Leak and guard tests</h3><p class="sub" style="margin:4px 0 0">Runs in your browser over the current ledger, as if every claim were approved (worst case).</p></div><button class="btn btn-primary btn-sm" data-action="runTests">Run tests</button></div>' +
      (state.tests ? renderTests(state.tests) : '<div class="empty" style="padding:20px">Not run yet.</div>') + '</div></div>';
    return html + nextBtn('review', 'Next: Review', true);
  }

  function renderTests(t) {
    const diffOk = t.differential.every(d => d.identical);
    return '<div class="gate">' +
      '<div class="gate-item ' + (t.mutations.falseAccepts === 0 ? 'pass' : 'fail') + '"><span class="ic">' + (t.mutations.falseAccepts === 0 ? '✓' : '!') + '</span><div>Quote-checker mutations: <b>' + t.mutations.falseAccepts + ' false accepts</b> out of ' + t.mutations.total + '<small>Changed digits, identifiers, added or removed negations, wrong source.</small></div></div>' +
      '<div class="gate-item ' + (t.canaries.found === 0 ? 'pass' : 'fail') + '"><span class="ic">' + (t.canaries.found === 0 ? '✓' : '!') + '</span><div>Canary scan: <b>' + t.canaries.found + ' canaries</b> across ' + t.canaries.readers + ' readers<small>' + t.canaries.secrets + ' masked secrets plus restricted-only phrases searched in every reader\'s rendered handover.</small></div></div>' +
      '<div class="gate-item ' + (diffOk ? 'pass' : 'fail') + '"><span class="ic">' + (diffOk ? '✓' : '!') + '</span><div>Differential test: <b>' + (diffOk ? 'identical' : 'DIFFERENT') + '</b><small>Removing a hidden source leaves each reader\'s output byte-identical: ' + t.differential.map(d => h(d.name) + (d.ran ? (d.identical ? ' ✓' : ' ✗') : ' (nothing hidden)')).join(', ') + '</small></div></div>' +
      '<div class="gate-item ' + (t.gapShape ? 'pass' : 'fail') + '"><span class="ic">' + (t.gapShape ? '✓' : '!') + '</span><div>Gap rows: <b>' + (t.gapShape ? 'identical shape' : 'differ') + '</b><small>Missing and hidden items render the same text with no counts.</small></div></div>' +
      '</div><p class="hint" style="margin-top:10px">We report "zero canaries across the readers tested", never "no secrets leak". Masking is heuristic.</p>';
  }

  // ---------------------------------------------------------------------------
  // Step 4: Review
  // ---------------------------------------------------------------------------
  function filteredClaims() {
    return state.claims.filter(c => {
      const f = state.filter;
      if (f.label !== 'All' && !(c.label === f.label || (f.label === 'Stated by' && /^Stated by/.test(c.label)))) return false;
      if (f.state !== 'All' && c.reviewState !== f.state) return false;
      return true;
    });
  }

  function renderReview() {
    if (!state.run) return actorBar('reviewer', '') + '<div class="empty"><b>Run Reconstruct first</b><button class="btn btn-primary" data-action="step" data-step="reconstruct">Go to Reconstruct</button></div>';
    const proposed = state.claims.filter(c => c.reviewState === 'proposed').length;
    const conflicts = conflictPairs().length;
    const gaps = unionGaps().filter(g => !state.claims.some(c => c.gapKey === g.key && c.reviewState !== 'rejected')).length;
    const g = gate();
    const tabs = [
      ['claims', 'Claims', proposed],
      ['conflicts', 'Conflicts', conflicts],
      ['interview', 'Gap interview', gaps],
      ['publish', 'View as & publish', g.filter(x => !x.ok).length]
    ];
    const sub = '<div class="subtabs" role="tablist">' + tabs.map(t => '<button role="tab" aria-selected="' + (state.reviewTab === t[0]) + '" data-action="reviewTab" data-tab="' + t[0] + '" class="' + (state.reviewTab === t[0] ? 'active' : '') + '">' + t[1] + (t[2] ? '<span class="count' + (t[0] !== 'claims' ? ' hot' : '') + '">' + t[2] + '</span>' : '') + '</button>').join('') + '</div>';
    let body = '';
    if (state.reviewTab === 'claims') body = renderReviewClaims();
    else if (state.reviewTab === 'conflicts') body = renderConflicts();
    else if (state.reviewTab === 'interview') body = renderInterview();
    else body = renderPublish();
    const who = state.reviewTab === 'interview' ? actorBar('leaver', 'The departing lead answers only what the sources could not. Answers are labelled "Stated by", never Sourced.')
      : actorBar('reviewer', 'Nothing reaches a reader until the reviewer approves. Each change is a new version with the author\'s name.');
    return who + sub + body;
  }

  function renderReviewClaims() {
    const list = filteredClaims();
    const sampleLeft = state.sampleIds.filter(id => { const c = claimById(id); return c && c.reviewState === 'proposed'; });
    const eligible = state.claims.filter(c => c.reviewState === 'proposed' && E.bulkEligible(c, TODAY) && !conflictIds().has(c.id));
    const labels = ['All', 'Sourced', 'Inferred', 'Stated by'];
    const states = ['All', 'proposed', 'accepted', 'edited', 'rejected'];
    const sel = claimById(state.selected) || list[0];
    const shown = Object.fromEntries(reviewerView().items.map(i => [i.id, i.displayLabel]));
    let left = '<div class="card"><div class="card-head"><div><h3>Claims</h3><p class="sub" style="margin:4px 0 0">' + list.length + ' shown</p></div></div>' +
      '<div class="notice info" style="margin:0 0 10px">Bulk approval covers only low-risk Sourced claims (no flags, conflicts, credentials or next actions). First decide a random sample of <b>' + state.sampleIds.length + '</b> claims one by one' + (sampleLeft.length ? ': <b>' + sampleLeft.length + ' left</b> (marked SAMPLE).' : '. <b>Sample done.</b>') +
      '<div class="actions" style="margin-top:8px"><button class="btn btn-ghost btn-sm" data-action="bulk"' + (sampleLeft.length || !eligible.length ? ' disabled' : '') + '>Bulk-approve ' + eligible.length + ' low-risk claims</button></div></div>' +
      '<div class="filters" aria-label="Filter by label">' + labels.map(l => '<button class="chip-btn ' + (state.filter.label === l ? 'on' : '') + '" data-action="filterLabel" data-v="' + l + '">' + l + '</button>').join('') + '</div>' +
      '<div class="filters" aria-label="Filter by review state">' + states.map(s => '<button class="chip-btn ' + (state.filter.state === s ? 'on' : '') + '" data-action="filterState" data-v="' + s + '">' + s + '</button>').join('') + '</div>' +
      '<div class="claim-list" data-keep-scroll="claims">' + (list.length ? list.map(c =>
        '<button class="claim-row ' + (sel && sel.id === c.id ? 'sel' : '') + '" data-action="select" data-id="' + h(c.id) + '"><div class="top">' + labelPill(shown[c.id] || c.label) + '<span class="state state-' + c.reviewState + '">' + c.reviewState + '</span>' +
        (state.sampleIds.includes(c.id) && c.reviewState === 'proposed' ? '<span class="flag">SAMPLE</span>' : '') + (conflictIds().has(c.id) ? '<span class="flag" style="background:#541d1a;color:#fca5a5">CONFLICT</span>' : '') +
        '<span class="cid" style="margin-left:auto">' + h(c.id) + ' · ' + h(TYPE_LABEL[c.type] || c.type) + '</span></div><div class="stmt">' + h(c.statement) + '</div></button>').join('') : '<div class="empty">No claims match these filters.</div>') + '</div></div>';
    return '<div class="split">' + left + '<div class="card evidence">' + (sel ? renderEvidence(sel) : '<div class="empty">Select a claim.</div>') + '</div></div>';
  }

  function renderEvidence(c) {
    const src = sourceById(c.sourceId);
    const ch = c.checks || {};
    const shownLabel = (reviewerView().items.find(i => i.id === c.id) || {}).displayLabel || c.label;
    let html = '<div class="card-head"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' + labelPill(shownLabel) + tagPill(c.access) + '<span class="state state-' + c.reviewState + '">' + c.reviewState + '</span></div><span class="cid">' + h(c.id) + ' · v' + (c.version || 1) + '</span></div>';
    if (state.editing === c.id) {
      html += '<div class="field"><label for="edit-text">Edit statement</label><textarea class="textarea" id="edit-text" style="min-height:80px;font-family:DM Sans,sans-serif;font-size:13px">' + h(c.statement) + '</textarea></div>' +
        (state.editNotice && state.editNotice.id === c.id ? '<div class="notice warn">' + h(state.editNotice.text) + '</div>' : '') +
        '<div class="actions"><button class="btn btn-primary btn-sm" data-action="saveEdit" data-id="' + h(c.id) + '">Save new version</button><button class="btn btn-ghost btn-sm" data-action="cancelEdit">Cancel</button></div>';
    } else {
      html += '<p class="stmt-big">' + h(c.statement) + '</p>';
    }
    html += '<dl class="meta-list"><dt>Type</dt><dd>' + h(TYPE_LABEL[c.type] || c.type) + '</dd><dt>Source</dt><dd>' + (src ? h(src.title) + ' · ' + h(KIND_LABEL[src.kind]) : c.origin === 'leaver' ? 'Gap interview answer: "' + h(c.question || '') + '"' : '–') + '</dd>' +
      '<dt>Author · date</dt><dd>' + h(c.author || 'not recorded') + ' · ' + fmtDate(c.date) + '</dd><dt>Why this label</dt><dd>' + h(c.reason || '') + '</dd>' +
      (c.editedBy ? '<dt>Edited by</dt><dd>' + h(c.editedBy) + '</dd>' : '') + '</dl>';
    const rvItem = reviewerView().items.find(i => i.id === c.id);
    if (rvItem && rvItem.supersededBy) {
      const newer = claimById(rvItem.supersededBy);
      html += '<div class="notice info">Superseded by ' + h(newer.id) + ' (' + fmtDate(newer.date) + '): “' + h(newer.statement) + '” Older facts stay visible as history, never silently overwritten.</div>';
    }
    if (c.derived) {
      html += '<div class="notice info">Inferred from the commit log: <b>' + h(c.derived.author) + '</b> made <b>' + c.derived.n + ' of ' + c.derived.total + '</b> commits in <b>' + h(c.derived.area) + '</b> (' + c.derived.pct + '%). This describes activity, not a stated owner, and never ranks people.</div>';
    }
    if (src && c.quote) {
      html += '<div class="lbl" style="margin-top:10px">Source passage, quote highlighted</div><div class="passage" style="margin-top:6px">' + sourceTextWithHighlight(src, c.quoteStart, c.quoteEnd) + '</div>' +
        '<div class="checks"><div class="check"><span class="lbl">Quote match</span><b class="ok">' + h((ch.match && ch.match.method) || '') + (ch.match && ch.match.score < 1 ? ' · ' + ch.match.score : '') + '</b></div>' +
        '<div class="check"><span class="lbl">Token guard</span><b class="' + (ch.guard && ch.guard.pass ? 'ok' : 'bad') + '">' + (ch.guard && ch.guard.pass ? 'pass' : 'fail') + '</b></div>' +
        '<div class="check"><span class="lbl">Support check</span><b class="' + (ch.support && ch.support.verdict === 'yes' ? 'ok' : 'meh') + '">' + (ch.support ? h(ch.support.verdict) + ' · ' + ch.support.score : '–') + '</b></div></div>';
    }
    if (c.flags && c.flags.length) html += '<div class="notice warn">Flags: ' + h(c.flags.join(', ')) + '. Not eligible for bulk approval.</div>';
    if (state.editing !== c.id) {
      html += '<div class="actions"><button class="btn btn-primary btn-sm" data-action="decide" data-d="accepted" data-id="' + h(c.id) + '">Accept</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="edit" data-id="' + h(c.id) + '">Edit</button>' +
        '<button class="btn btn-coral btn-sm" data-action="decide" data-d="rejected" data-id="' + h(c.id) + '">Reject</button></div>';
    }
    return html;
  }

  function claimSide(c, letter, a, b) {
    const src = sourceById(c.sourceId);
    return '<div class="side">' + labelPill('Possible conflict') + (c.confirmedBy ? ' ' + labelPill('Confirmed by ' + c.confirmedBy) : '') + '<p class="claim-stmt" style="margin-top:8px">' + h(c.statement) + '</p>' +
      '<div class="src-line">' + (src ? h(src.title) : 'Interview') + ' · ' + fmtDate(c.date) + (c.author ? ' · ' + h(c.author) : '') + ' · ' + tagPill(c.access) + '</div>' +
      (c.quote ? '<div class="claim-quote">“' + h(c.quote) + '”</div>' : '') +
      '<div class="actions"><button class="btn btn-ghost btn-sm" data-action="resolve" data-a="' + h(a) + '" data-b="' + h(b) + '" data-m="' + letter + '">Keep this, reject the other</button></div></div>';
  }

  function renderConflicts() {
    const pairs = conflictPairs();
    if (!pairs.length) return '<div class="empty"><b>No open conflicts</b>Conflicts appear when two claims give different values for the same subject (for example, who owns deployments). Baton never picks a side on its own.</div>';
    return '<p class="sub">Same subject, different values. Baton shows both and never decides on its own.</p>' + pairs.map(([a, b]) =>
      '<div class="card" style="margin-bottom:12px"><div class="lbl" style="margin-bottom:10px">' + h(a.slot.kind) + ' of “' + h(a.slot.subject) + '”: ' + h(a.slot.value) + ' vs ' + h(b.slot.value) + '</div><div class="conflict">' +
      claimSide(a, 'a', a.id, b.id) + '<div class="vs">vs</div>' + claimSide(b, 'b', a.id, b.id) + '</div>' +
      '<div class="actions"><button class="btn btn-ghost btn-sm" data-action="resolve" data-a="' + h(a.id) + '" data-b="' + h(b.id) + '" data-m="both">Both are true (e.g. shared ownership): keep both</button></div></div>'
    ).join('');
  }

  function renderInterview() {
    const gaps = unionGaps();
    const pairs = conflictPairs();
    let html = '<p class="sub">Only questions the sources could not answer. Typical time: 5 to 15 minutes.</p>';
    if (!gaps.length && !pairs.length) html += '<div class="empty"><b>Nothing to ask</b>Every checklist item is covered for every reader.</div>';
    gaps.forEach(g => {
      const answered = state.claims.filter(c => c.gapKey === g.key && c.reviewState !== 'rejected');
      html += '<div class="iv-card ' + (answered.length ? 'done' : '') + '"><h4>' + h(g.title) + '</h4><p>Missing in the view of: ' + h(g.readers.join(', ')) + '. Your answer is stored as "Stated by Aarav" with the access tag you choose; it is never wider than you set.</p>' +
        answered.map(c => '<div class="notice good" style="margin:0 0 8px">' + labelPill(c.label) + ' ' + h(c.statement) + ' ' + tagPill(c.access) + ' <span class="state state-' + c.reviewState + '">' + c.reviewState + '</span></div>').join('') +
        '<div class="row"><div class="field" style="flex:3 1 260px"><label for="ans-' + g.key + '">Your answer</label><input class="input" id="ans-' + g.key + '" data-answer="' + g.key + '" value="' + h(state.answers[g.key] || '') + '" placeholder="' + h(g.key === 'who_to_ask' ? 'e.g. Ask Nisha at PayLane support about the vendor API.' : g.key === 'credentials' ? 'e.g. Credentials live in the team password manager, folder Meridian.' : 'Type what only you know') + '"></div>' +
        '<div class="field" style="flex:1 1 130px"><label for="ansacc-' + g.key + '">Who may see it</label>' + accessSelect('class="select" id="ansacc-' + g.key + '" data-change="answerAccess" data-key="' + g.key + '"', state.answerAccess[g.key] || 'core_team').replace('class="access-select" ', '') + '</div>' +
        '<button class="btn btn-primary" data-action="answer" data-key="' + g.key + '">Save answer</button></div></div>';
    });
    if (pairs.length) {
      html += '<div class="lbl" style="margin:16px 0 8px">Conflicts: which one is right?</div>';
      pairs.forEach(([a, b]) => {
        html += '<div class="iv-card"><h4>' + h(a.slot.subject) + '</h4><p>The reviewer makes the final call; your confirmation is shown to them.</p><div class="actions">' +
          [a, b].map(c => '<button class="btn btn-ghost btn-sm" data-action="confirm" data-id="' + h(c.id) + '">' + (c.confirmedBy ? '✓ ' : '') + h(c.statement) + '</button>').join('') + '</div></div>';
      });
    }
    return html;
  }

  function renderPublish() {
    const hz = hazards();
    const g = gate();
    const reader = PERSONA[state.viewAs] || READERS[0];
    const ready = g.every(x => x.ok);
    let html = '<div class="split"><div style="display:grid;gap:14px">';
    // Hazards
    html += '<div class="card"><h3>Stale-fact hazards</h3><p class="sub">A reader would see an older fact whose newer version is restricted from them. Publishing is blocked until each is decided.</p>' +
      (hz.length ? hz.map(x => {
        const c = claimById(x.claimId);
        return '<div class="notice warn" style="margin:0 0 8px"><b>' + h(PERSONA[x.readerId].name) + '</b> would see: “' + h(c.statement) + '” but a newer claim on the same subject is hidden from them.' +
          '<div class="actions"><button class="btn btn-ghost btn-sm" data-action="hazard" data-id="' + h(c.id) + '" data-r="' + h(x.readerId) + '" data-m="withhold">Withhold from ' + h(PERSONA[x.readerId].name) + '</button><button class="btn btn-ghost btn-sm" data-action="hazard" data-id="' + h(c.id) + '" data-r="' + h(x.readerId) + '" data-m="reject">Reject the old claim</button></div></div>';
      }).join('') : '<div class="notice good" style="margin:0">No hazards.</div>') + '</div>';
    // Gate
    html += '<div class="card"><h3>Publish gate</h3><p class="sub">Checked by code. The button stays disabled until every item passes.</p><div class="gate">' +
      g.map(x => '<div class="gate-item ' + (x.ok ? 'pass' : 'fail') + '"><span class="ic">' + (x.ok ? '✓' : '✗') + '</span><div>' + h(x.text) + '<small>' + h(x.detail) + '</small></div></div>').join('') + '</div>' +
      '<div class="actions"><button class="btn btn-primary" data-action="publish"' + (ready ? '' : ' disabled aria-disabled="true"') + '>Approve and publish handover</button></div>' +
      (!ready ? '<p class="hint" style="margin-top:8px">Nothing is shared before an approver signs off.</p>' : '') + '</div>';
    // Requests + audit
    html += '<div class="card"><h3>Access requests</h3><p class="sub">Readers see the same gap row whether an item is missing or hidden. Only you see the real reason.</p>' +
      (state.requests.length ? state.requests.map(r => '<div class="version-row"><div><b>' + h(PERSONA[r.readerId].name) + '</b> asked about “' + h((E.CHECKLIST.find(x => x.key === r.gapKey) || {}).title) + '”<div class="hint">' + h(realReason(r)) + '</div></div>' +
        (r.status === 'open' ? '<div class="actions" style="margin:0"><button class="btn btn-ghost btn-sm" data-action="reply" data-id="' + r.id + '" data-s="undocumented">Reply: undocumented</button><button class="btn btn-ghost btn-sm" data-action="reply" data-id="' + r.id + '" data-s="forwarded to data owner">Forward to data owner</button></div>' : '<span class="state">' + h(r.status) + '</span>') + '</div>').join('') : '<div class="hint">No requests yet.</div>') + '</div>';
    html += '<div class="card"><h3>Audit log</h3><p class="sub">Who viewed or changed what.</p><div style="max-height:200px;overflow:auto">' + state.audit.slice(0, 25).map(a => '<div class="version-row"><span>' + h(a.actor) + ': ' + h(a.action) + '</span><span class="mono hint">' + new Date(a.at).toLocaleTimeString() + '</span></div>').join('') + '</div></div>';
    html += '</div>';
    // View as
    const preview = E.composeHandover(state.claims, reader);
    html += '<div class="card"><h3>View as a reader</h3><p class="sub">The same code path readers use, built from claims you have accepted so far. Confirm you read each view.</p>' +
      '<div class="reader-tabs">' + READERS.map(r => '<button class="reader-tab ' + (r.id === reader.id ? 'active' : '') + '" data-action="viewAs" data-r="' + r.id + '"><span class="avatar">' + h(r.initials) + '</span>' + h(r.name) + (state.viewConfirmed[r.id] === state.rev ? ' ✓' : '') + '</button>').join('') + '</div>' +
      '<div class="hint" style="margin-bottom:10px">' + h(reader.role) + ' · can see: ' + reader.tags.map(t => E.ACCESS_TAGS[t]).join(', ') + '</div>' +
      renderHandoverBody(preview, { preview: true, reader }) +
      '<label class="gate-item ' + (state.viewConfirmed[reader.id] === state.rev ? 'pass' : '') + '" style="cursor:pointer;margin-top:12px"><input type="checkbox" data-change="confirmView" data-r="' + reader.id + '"' + (state.viewConfirmed[reader.id] === state.rev ? ' checked' : '') + ' style="accent-color:#86efac;width:16px;height:16px;margin-top:2px"> <div>I have read ' + h(reader.name) + '\'s view<small>Resets automatically if any claim changes afterwards.</small></div></label></div>';
    html += '</div>';
    return html;
  }

  // Shared by the reviewer's "view as" and the reader's handover.
  function renderHandoverBody(ho, opts) {
    const count = Object.values(ho.sections).flat().length;
    let html = '';
    if (opts.preview && count === 0) html += '<div class="notice info" style="margin:0 0 10px">No claims accepted yet, so this reader would see only gap rows.</div>';
    ['ownership', 'actions', 'risks', 'decisions'].forEach(k => {
      const items = ho.sections[k];
      if (!items.length) return;
      html += '<div class="ho-section"><h4>' + SECTION_TITLE[k] + '</h4>' + items.map((i, idx) => {
        const acked = opts.receipts && opts.receipts[i.claimId];
        return '<div class="ho-item ' + (acked ? 'acked' : '') + '">' + (opts.preview ? '' : '<input type="checkbox" aria-label="Acknowledge ' + h(i.claimId) + '" data-change="ack" data-v="' + h(opts.versionId) + '" data-r="' + h(opts.reader.id) + '" data-c="' + h(i.claimId) + '"' + (acked ? ' checked' : '') + '>') +
          '<div class="body">' + (k === 'actions' ? '<b>' + (idx + 1) + '.</b> ' : '') + h(i.statement) + '<div class="meta">' + labelPill(i.label) + '<span class="cid">' + h(i.claimId) + (i.date ? ' · ' + fmtDate(i.date) : '') + '</span>' + (acked ? '<span class="cid ok">acknowledged</span>' : '') + '</div></div></div>';
      }).join('') + '</div>';
    });
    if (ho.gaps.length) {
      html += '<div class="ho-section"><h4>Not in your view</h4>' + ho.gaps.map(g => {
        const req = !opts.preview && state.requests.find(r => r.readerId === opts.reader.id && r.gapKey === g.key);
        return '<div class="gap-row"><div><div class="gt">' + h(g.title) + '</div><div class="gx">' + h(g.text) + '</div>' + (req ? '<div class="hint" style="margin-top:4px">' + (req.status === 'open' ? 'Request sent.' : 'Reviewer replied: ' + h(req.status) + '.') + '</div>' : '') + '</div>' +
          (opts.preview ? '<span class="btn btn-ghost btn-sm is-disabled" aria-hidden="true">Request access</span>' : '<button class="btn btn-ghost btn-sm" data-action="request" data-r="' + h(opts.reader.id) + '" data-k="' + h(g.key) + '"' + (req ? ' disabled' : '') + '>Request access</button>') + '</div>';
      }).join('') + '</div>';
    }
    return html;
  }

  // ---------------------------------------------------------------------------
  // Step 5: Handover
  // ---------------------------------------------------------------------------
  function renderHandover() {
    const reader = PERSONA[state.reader] || READERS[0];
    const v = latestVersion();
    let html = '<div class="reader-tabs">' + READERS.map(r => '<button class="reader-tab ' + (r.id === reader.id ? 'active' : '') + '" data-action="reader" data-r="' + r.id + '"><span class="avatar">' + h(r.initials) + '</span>' + h(r.name) + '<span class="hint">' + h(r.role.split(' · ')[0]) + '</span></button>').join('') + '</div>' +
      actorBar(reader.id, 'Built by code only from approved claims this reader may see. Tick each item to acknowledge it.');
    if (!v) {
      return html + '<div class="empty"><b>No approved handover yet</b>Nothing is shared before the reviewer signs off. Finish the checks in Review → View as & publish.<div class="actions" style="justify-content:center"><button class="btn btn-primary" data-action="goPublish">Go to the publish gate</button></div></div>';
    }
    const ho = E.composeHandover(v.claims, reader);
    const receipts = ((state.receipts[v.id] || {})[reader.id]) || {};
    const total = Object.values(ho.sections).flat().length;
    const acked = Object.values(ho.sections).flat().filter(i => receipts[i.claimId]).length;
    html += '<div class="split split-wide"><div class="card"><div class="card-head"><div><span class="eyebrow">DAY-ONE HANDOVER · MERIDIAN</span><h3 style="margin-top:6px;font-size:18px">' + h(reader.name) + '\'s continuation plan</h3></div>' +
      '<span class="claim-label lbl-sourced">' + h(v.id) + ' · approved</span></div>' +
      '<div class="notice info" style="margin:0 0 14px">Acknowledged <b>' + acked + ' of ' + total + '</b> items. Every line cites its claim; open the claim ID in Review to see the source quote.</div>' +
      renderHandoverBody(ho, { reader, versionId: v.id, receipts }) + '</div>' +
      '<div style="display:grid;gap:14px;align-content:start"><div class="card"><h3>Version history</h3><p class="sub">Approved versions are immutable. A retracted version disappears for readers; a leaked credential must still be rotated.</p>' +
      state.versions.slice().reverse().map(x => '<div class="version-row"><div><b>' + h(x.id) + '</b> · ' + h(x.state) + ' by ' + h(x.approvedBy) + '<div class="hint mono">' + new Date(x.at).toLocaleString() + ' · sha256 ' + h(String(x.hash).slice(0, 12)) + '…</div></div>' +
        (x.state === 'approved' ? '<button class="btn btn-ghost btn-sm" data-action="retract" data-id="' + h(x.id) + '">Retract</button>' : '') + '</div>').join('') + '</div>' +
      '<div class="card"><h3>What ' + h(reader.name) + ' can see</h3><p class="sub" style="margin:0">' + reader.tags.map(t => tagPill(t)).join(' ') + '</p><p class="hint" style="margin-top:10px">Switch readers above: Rohan (all members) and Kavya (treasurer) get different plans from the same approved version, and a hidden item looks exactly like a missing one.</p></div></div></div>';
    return html;
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  function render() {
    const root = document.getElementById('studioRoot');
    if (!root) return;
    const keep = {};
    root.querySelectorAll('[data-keep-scroll]').forEach(el => { keep[el.dataset.keepScroll] = el.scrollTop; });
    let body = '';
    if (state.step === 'connect') body = renderConnect();
    else if (state.step === 'reconstruct') body = renderReconstruct();
    else if (state.step === 'verify') body = renderVerify();
    else if (state.step === 'review') body = renderReview();
    else body = renderHandover();
    root.innerHTML =
      '<div class="studio-head"><div><div class="eyebrow">HANDOVER STUDIO · MERIDIAN CAMPUS BACKEND</div><h1>Aarav → Meera handover</h1><p>Turn scattered project activity into a handover where every statement cites its evidence, every gap is labelled, and each reader sees only what they may see.</p></div>' +
      '<div class="studio-tools"><button class="btn btn-ghost btn-sm" data-action="loadSample">Load sample</button><button class="btn btn-ghost btn-sm" data-action="reset">Reset</button></div></div>' +
      '<div class="demo-note"><span>ⓘ</span><div><b>Working prototype on synthetic data.</b> Everything runs in your browser: extraction rules, the quote checker, permissions and leak tests are real code, but there is no server, sign-in or live integration except the optional public GitHub import. Your changes are saved only in this browser. In production the permission check runs in Postgres row-level security.</div></div>' +
      stepper() + '<div id="stepBody">' + body + '</div>';
    root.querySelectorAll('[data-keep-scroll]').forEach(el => { if (keep[el.dataset.keepScroll] != null) el.scrollTop = keep[el.dataset.keepScroll]; });
  }

  function goStep(step) {
    state.step = step;
    save();
    if (location.hash !== '#/studio/' + step) history.replaceState(null, '', '#/studio/' + step);
    render();
    const top = document.getElementById('studio');
    if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------------------------------------------------------------------------
  // Events (delegated)
  // ---------------------------------------------------------------------------
  function bind() {
    const root = document.getElementById('studioRoot');
    root.addEventListener('click', e => {
      const el = e.target.closest('[data-action]');
      if (!el || el.disabled) return;
      const d = el.dataset;
      switch (d.action) {
        case 'step': goStep(d.step); break;
        case 'loadSample': loadSample(); break;
        case 'reset':
          if (confirm('Reset the studio? This clears sources, decisions and versions saved in this browser.')) {
            state = freshState(); Object.keys(vault).forEach(k => delete vault[k]); save(); render(); toast('Studio reset.');
          }
          break;
        case 'toggleText': state.showText[d.id] = !state.showText[d.id]; save(); render(); break;
        case 'removeSource':
          state.sources = state.sources.filter(s => s.id !== d.id); delete vault[d.id]; markStale();
          audit('Priya (data owner)', 'Removed source ' + d.id); save(); render(); break;
        case 'addSource': addDraftSource(); break;
        case 'checkCsv': {
          const rows = E.parseCsv(state.draft.text || '');
          if (!rows.length) { toast('Paste CSV text first.'); break; }
          state.draft.csvHeaders = rows[0];
          state.draft.csvMap = E.guessCsvMapping(rows[0]);
          render(); break;
        }
        case 'importGithub': importGithub(state.draft.repo); break;
        case 'runReconstruct': runReconstruct(); break;
        case 'runTests': runTests(); break;
        case 'labCheck': {
          const c = defaultLabClaim();
          const text = document.getElementById('lab-text').value;
          state.labText = text;
          state.labOut = E.verifyClaim({ statement: text, quote: c.quote, author: c.author }, passageById()[c.passageId]);
          render(); break;
        }
        case 'labMutate': state.labText = d.text; state.labOut = null; render(); break;
        case 'reviewTab': state.reviewTab = d.tab; save(); render(); break;
        case 'filterLabel': state.filter.label = d.v; render(); break;
        case 'filterState': state.filter.state = d.v; render(); break;
        case 'select':
          state.selected = d.id; state.editing = null; state.editNotice = null; render();
          if (window.innerWidth < 1100) { const ev = document.querySelector('.evidence'); if (ev) ev.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
          break;
        case 'decide': decide(d.id, d.d); break;
        case 'edit': state.editing = d.id; state.editNotice = null; render(); break;
        case 'cancelEdit': state.editing = null; state.editNotice = null; render(); break;
        case 'saveEdit': saveEdit(d.id, document.getElementById('edit-text').value); break;
        case 'bulk': bulkApprove(); break;
        case 'resolve': resolveConflict(d.a, d.b, d.m); break;
        case 'hazard': resolveHazard(d.id, d.r, d.m); break;
        case 'answer': answerGap(d.key); break;
        case 'confirm': confirmSide(d.id); break;
        case 'viewAs': state.viewAs = d.r; audit('Prof. Rao (reviewer)', 'Viewed the handover as ' + PERSONA[d.r].name); save(); render(); break;
        case 'publish': publish(); break;
        case 'retract': if (confirm('Retract ' + d.id + '? Readers will no longer see it.')) retract(d.id); break;
        case 'reader': state.reader = d.r; audit(PERSONA[d.r].name, 'Opened their handover'); save(); render(); break;
        case 'request': requestAccess(d.r, d.k); break;
        case 'reply': replyRequest(d.id, d.s); break;
        case 'goPublish': state.reviewTab = 'publish'; goStep('review'); break;
      }
    });

    root.addEventListener('change', e => {
      const el = e.target;
      const d = el.dataset;
      switch (d.change) {
        case 'access': {
          const s = sourceById(d.id);
          s.access = el.value; markStale();
          audit('Priya (data owner)', 'Set "' + s.title + '" to ' + E.ACCESS_TAGS[el.value]);
          save(); render(); toast('Access changed. Run Reconstruct again so claims inherit it.'); break;
        }
        case 'draftKind': state.draft.kind = el.value; state.draft.csvHeaders = null; state.draft.csvMap = null; render(); break;
        case 'draftAccess': state.draft.access = el.value; break;
        case 'csvMap': state.draft.csvMap = state.draft.csvMap || {}; if (el.value === '') delete state.draft.csvMap[d.field]; else state.draft.csvMap[d.field] = +el.value; break;
        case 'file': {
          const f = el.files && el.files[0];
          if (!f) break;
          if (f.size > 2 * 1024 * 1024) { toast('File too large (max 2 MB).'); break; }
          const reader = new FileReader();
          reader.onload = () => {
            state.draft.text = String(reader.result || '');
            if (!state.draft.title) state.draft.title = f.name;
            if (/\.csv$/i.test(f.name)) state.draft.kind = 'tasks';
            else if (/\.json$/i.test(f.name)) state.draft.kind = 'chat';
            state.draft.csvHeaders = null;
            render();
            toast('Loaded ' + f.name + '. Check the type and access tag, then Add source.');
          };
          reader.readAsText(f);
          break;
        }
        case 'labClaim': state.labClaim = el.value; state.labText = ''; state.labOut = null; render(); break;
        case 'answerAccess': state.answerAccess[d.key] = el.value; break;
        case 'confirmView':
          if (el.checked) { state.viewConfirmed[d.r] = state.rev; audit('Prof. Rao (reviewer)', 'Confirmed reading ' + PERSONA[d.r].name + '\'s view'); }
          else delete state.viewConfirmed[d.r];
          save(); render(); break;
        case 'ack': toggleAck(d.v, d.r, d.c, el.checked); break;
      }
    });

    root.addEventListener('input', e => {
      const el = e.target;
      if (el.dataset.model) state.draft[el.dataset.model] = el.value;
      if (el.dataset.answer) state.answers[el.dataset.answer] = el.value;
      if (el.dataset.modelLab) state.labText = el.value;
    });
  }

  window.BatonStudio = {
    init() { bind(); render(); },
    render,
    goStep,
    startSample() { if (!state.sources.length) loadSample(); },
    hasData: () => state.sources.length > 0
  };
})();
