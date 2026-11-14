// Live security probes against a Baton Supabase project, using real Supabase Auth tokens.
// Run:  node tests/rls.probe.mjs            (uses js/config.js values)
//       BATON_SUPABASE_URL=... BATON_SUPABASE_KEY=... node tests/rls.probe.mjs
// Every check prints PASS/FAIL; the process exits 1 if any check fails.
// The demo accounts and password are public (they are shown on the sign-in screen).
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const cfgText = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8');
const pick = k => (cfgText.match(new RegExp(k + "\\s*:\\s*'([^']+)'")) || [])[1];
const URL_ = (process.env.BATON_SUPABASE_URL || pick('supabaseUrl')).replace(/\/+$/, '');
const KEY = process.env.BATON_SUPABASE_KEY || pick('supabaseKey');
const PASSWORD = process.env.BATON_DEMO_PASSWORD || 'baton-demo-2026';
const EMAIL = { owner: 'priya@baton.example', reviewer: 'rao@baton.example', leaver: 'aarav@baton.example', meera: 'meera@baton.example', rohan: 'rohan@baton.example', kavya: 'kavya@baton.example' };

let failures = 0;
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  - ' + detail : ''));
}

async function signIn(persona) {
  const res = await fetch(URL_ + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL[persona], password: PASSWORD })
  });
  const j = await res.json();
  if (!res.ok) throw new Error('sign-in failed for ' + persona + ': ' + JSON.stringify(j));
  return j.access_token;
}

async function rest(method, path, { token, ws, body, prefer, headers } = {}) {
  const h = { apikey: KEY, 'Content-Type': 'application/json', ...(headers || {}) };
  if (token) h.Authorization = 'Bearer ' + token;
  if (ws) h['x-baton-workspace'] = ws;
  if (prefer) h.Prefer = prefer;
  const res = await fetch(URL_ + '/rest/v1/' + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}
const rows = r => (Array.isArray(r.data) ? r.data.length : 0);

const T = {};
for (const p of Object.keys(EMAIL)) T[p] = await signIn(p);
check('All six demo accounts sign in through Supabase Auth', Object.values(T).every(Boolean));

// --- reviewer builds a tiny workspace ---------------------------------------------------------
const ws = randomUUID();
let r = await rest('POST', 'workspaces', { token: T.reviewer, body: { id: ws }, prefer: 'return=minimal' });
check('Reviewer can create a workspace (becomes owner)', r.ok, 'HTTP ' + r.status);
r = await rest('POST', 'workspaces', { token: T.meera, body: { id: randomUUID() }, prefer: 'return=minimal' });
check('A reader account cannot create a workspace', !r.ok, 'HTTP ' + r.status);

const body = 'Decision (2026-10-02): Aarav owns deploys until handover. Treasurer note: vendor PIN rotates on the 5th. The API listens on port 8080.';
r = await rest('POST', 'sources', { token: T.owner, ws, body: [
  { workspace_id: ws, ext_id: 'S1', title: 'Notes', kind: 'notes', access: 'core_team', body },
  { workspace_id: ws, ext_id: 'S2', title: 'Treasury', kind: 'notes', access: 'treasurer_only', body }
], prefer: 'return=minimal' });
check('Data owner can store sources', r.ok, 'HTTP ' + r.status);

const claim = (id, extra) => ({ workspace_id: ws, ext_id: id, type: 'decision', statement: 'Aarav owns deploys until handover.', label: 'Sourced', access: 'core_team', origin: 'extracted', review_state: 'proposed', source_ext_id: 'S1', quote: 'Aarav owns deploys until handover.', ...extra });
r = await rest('POST', 'claims', { token: T.reviewer, ws, body: [
  claim('C1'),
  claim('C2', { type: 'how_it_runs', statement: 'The API listens on port 8080.', quote: 'The API listens on port 8080.' }),
  claim('C3', { access: 'treasurer_only', source_ext_id: 'S2', type: 'how_it_runs', statement: 'The vendor PIN rotates on the 5th.', quote: 'vendor PIN rotates on the 5th' })
], prefer: 'return=minimal' });
check('Reviewer can store claims whose quotes are in their sources', r.ok, 'HTTP ' + r.status + (r.ok ? '' : ' ' + JSON.stringify(r.data)));

// --- server-side quote checks ------------------------------------------------------------------
r = await rest('POST', 'claims', { token: T.reviewer, ws, body: claim('BAD1', { statement: 'Meera owns deploys.', quote: 'Meera owns deploys from today.' }), prefer: 'return=minimal' });
check('Database refuses a claim whose quote is not in the source', !r.ok && /quote was not found/.test(JSON.stringify(r.data)), 'HTTP ' + r.status);
r = await rest('POST', 'claims', { token: T.reviewer, ws, body: claim('BAD2', { statement: 'The API listens on port 9090.', quote: 'The API listens on port 8080.' }), prefer: 'return=minimal' });
check('Database refuses a claim whose statement changes a number', !r.ok && /number/.test(JSON.stringify(r.data)), 'HTTP ' + r.status);
r = await rest('POST', 'claims', { token: T.reviewer, ws, body: claim('BAD3', { quote: 'The API listens on port 8081.', statement: 'The API listens on port 8081.' }), prefer: 'return=minimal' });
check('Database refuses a near-miss quote with a different number', !r.ok, 'HTTP ' + r.status);

// --- readers and forged headers ----------------------------------------------------------------
for (const p of ['meera', 'rohan', 'kavya', 'leaver']) {
  const c = await rest('GET', 'claims?select=ext_id', { token: T[p], ws });
  const s = await rest('GET', 'sources?select=ext_id', { token: T[p], ws });
  check(p + ' cannot read the raw ledger or sources', rows(c) === 0 && rows(s) === 0, rows(c) + ' claims, ' + rows(s) + ' sources');
}
r = await rest('GET', 'claims?select=ext_id', { token: T.meera, ws, headers: { 'x-baton-persona': 'reviewer' } });
check('Meera with a forged "x-baton-persona: reviewer" header still gets nothing', rows(r) === 0, rows(r) + ' rows');
r = await rest('GET', 'claims?select=ext_id', { token: T.reviewer, ws: randomUUID() });
check('Reviewer selecting a workspace they are not a member of gets nothing', rows(r) === 0, rows(r) + ' rows');
r = await rest('GET', 'claims?select=ext_id', { ws });
check('No sign-in: the anonymous key is refused', !r.ok || rows(r) === 0, 'HTTP ' + r.status);
r = await rest('GET', 'claims?select=ext_id', { ws, headers: { Authorization: 'Bearer ' + T.reviewer.slice(0, -6) + 'AAAAAA' } });
check('A tampered JWT is rejected', !r.ok, 'HTTP ' + r.status);

// --- publish gate in the database --------------------------------------------------------------
r = await rest('POST', 'versions', { token: T.reviewer, ws, body: { workspace_id: ws, ver: 'v1', state: 'approved', approved_by: 'x', content_hash: 'h' }, prefer: 'return=minimal' });
check('Publishing is refused while claims are undecided', !r.ok && /undecided/.test(JSON.stringify(r.data)), 'HTTP ' + r.status);
await rest('PATCH', 'claims?ext_id=in.(C1,C2,C3)&workspace_id=eq.' + ws, { token: T.reviewer, ws, body: { review_state: 'accepted', decided_by: 'Prof. Rao' }, prefer: 'return=minimal' });
r = await rest('POST', 'versions', { token: T.owner, ws, body: { workspace_id: ws, ver: 'v1', state: 'approved', approved_by: 'x', content_hash: 'h' }, prefer: 'return=minimal' });
check('The data owner cannot approve a version (reviewer only)', !r.ok, 'HTTP ' + r.status);
r = await rest('POST', 'versions', { token: T.meera, ws, body: { workspace_id: ws, ver: 'v1', state: 'approved', approved_by: 'x', content_hash: 'h' }, prefer: 'return=minimal' });
check('A reader cannot approve a version', !r.ok, 'HTTP ' + r.status);
r = await rest('POST', 'versions', { token: T.reviewer, ws, body: { workspace_id: ws, ver: 'v1', state: 'approved', approved_by: 'Someone else', content_hash: 'h' }, prefer: 'return=representation' });
check('Reviewer can publish once every claim is decided', r.ok, 'HTTP ' + r.status);
check('The server records the approver, ignoring the browser', r.ok && r.data[0].approved_by === 'Prof. Rao (Reviewer)', r.ok ? r.data[0].approved_by : '');
const item = (id, statement, access) => ({ workspace_id: ws, ver: 'v1', claim_ext_id: id, type: 'decision', statement, label: 'Sourced', access });
r = await rest('POST', 'handover_items', { token: T.reviewer, ws, body: item('C1', 'Meera owns deploys until handover.', 'core_team'), prefer: 'return=minimal' });
check('A published row that differs from the approved claim is refused', !r.ok, 'HTTP ' + r.status);
r = await rest('POST', 'handover_items', { token: T.reviewer, ws, body: [
  item('C1', 'Aarav owns deploys until handover.', 'core_team'),
  item('C2', 'The API listens on port 8080.', 'core_team'),
  item('C3', 'The vendor PIN rotates on the 5th.', 'treasurer_only')
], prefer: 'return=minimal' });
check('Approved claims publish as handover rows', r.ok, 'HTTP ' + r.status);
r = await rest('PATCH', 'versions?ver=eq.v1&workspace_id=eq.' + ws, { token: T.reviewer, ws, body: { content_hash: 'tampered' }, prefer: 'return=minimal' });
check('An approved version cannot be edited', !r.ok, 'HTTP ' + r.status);

// --- what each reader receives -----------------------------------------------------------------
const got = {};
for (const p of ['meera', 'rohan', 'kavya']) {
  const x = await rest('GET', 'reader_handover?select=claim_ext_id,access&order=claim_ext_id', { token: T[p], ws });
  got[p] = (x.data || []).map(y => y.claim_ext_id).join(',');
}
check('Meera (core team) gets C1, C2 and not the treasurer-only row', got.meera === 'C1,C2', got.meera || '(none)');
check('Rohan (all members only) gets no core-team or treasurer rows', got.rohan === '', got.rohan || '(none)');
check('Kavya (treasurer) gets only the treasurer row', got.kavya === 'C3', got.kavya || '(none)');
r = await rest('GET', 'reader_handover?select=claim_ext_id&access=eq.treasurer_only', { token: T.meera, ws, headers: { 'x-baton-persona': 'kavya' } });
check('Meera asking for treasurer rows with a forged Kavya header gets nothing', rows(r) === 0, rows(r) + ' rows');
r = await rest('GET', 'audit_log?select=id', { token: T.meera, ws });
check('Readers cannot read the audit log', rows(r) === 0, rows(r) + ' rows');

// --- guided interview: reviewer asks, leaver answers, readers see nothing ----------------------
r = await rest('POST', 'interview_questions', { token: T.reviewer, ws, body: { workspace_id: ws, gap_key: 'credentials', rank: 1, question: 'Where are the credentials kept?' }, prefer: 'return=minimal' });
check('Reviewer can send an interview question', r.ok, 'HTTP ' + r.status);
r = await rest('GET', 'interview_questions?select=gap_key', { token: T.meera, ws });
check('A reader cannot read the interview questions', rows(r) === 0, rows(r) + ' rows');
r = await rest('POST', 'interview_answers', { token: T.meera, ws, body: { workspace_id: ws, gap_key: 'credentials', answer: 'forged', access: 'all_members' }, prefer: 'return=minimal' });
check('A reader cannot answer in the leaver\'s name', !r.ok, 'HTTP ' + r.status);
r = await rest('GET', 'interview_questions?select=gap_key', { token: T.leaver, ws });
check('The departing lead sees the question', rows(r) === 1, rows(r) + ' rows');
r = await rest('POST', 'interview_answers', { token: T.leaver, ws, body: { workspace_id: ws, gap_key: 'credentials', answer: 'In the team vault; ask Prof. Rao.', access: 'core_team', answered_by: 'reviewer' }, prefer: 'return=minimal' });
check('The departing lead can answer', r.ok, 'HTTP ' + r.status);
r = await rest('GET', 'interview_answers?select=answered_by', { token: T.reviewer, ws });
check('The server records who answered (ignores the browser)', rows(r) === 1 && r.data[0].answered_by === 'leaver', rows(r) ? r.data[0].answered_by : '(none)');
r = await rest('GET', 'interview_answers?select=answer', { token: T.kavya, ws });
check('Another reader cannot read the leaver\'s answers', rows(r) === 0, rows(r) + ' rows');

console.log('\n' + (results.length - failures) + ' of ' + results.length + ' checks passed');
process.exit(failures ? 1 : 0);
