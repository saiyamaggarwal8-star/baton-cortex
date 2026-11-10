// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const S = require('../js/sample.js');

function loadSample() {
  const sources = S.SAMPLE_SOURCES.map(s => {
    const text = s.kind === 'tasks' ? E.csvToText(s.raw).text : s.raw;
    const m = E.maskSecrets(text);
    return Object.assign({}, s, { text: m.text, findings: m.findings });
  });
  const result = E.runPipeline(sources);
  return { sources, result };
}

const P = Object.fromEntries(S.PERSONAS.map(p => [p.id, p]));
const READERS = S.PERSONAS.filter(p => p.reader);

test('quote matcher: exact match returns offsets inside the passage', () => {
  const r = E.matchQuote('runs on port 8080', 'The campus API runs on port 8080 behind nginx.');
  assert.equal(r.found, true);
  assert.equal(r.method, 'exact');
  assert.equal('The campus API runs on port 8080 behind nginx.'.slice(r.start, r.end), 'runs on port 8080');
});

test('quote matcher: whitespace and curly quotes normalise to exact', () => {
  const r = E.matchQuote('it’s   blocked', "It's blocked until v2.3.");
  assert.equal(r.method, 'exact');
});

test('quote matcher: small typo is a fuzzy match, unrelated text is not found', () => {
  const passage = 'Webhook retries stay switched off until the vendor fixes duplicate events.';
  assert.equal(E.matchQuote('Webhook retries stay swiched off until the vendor fixes duplicate events', passage).method, 'fuzzy');
  assert.equal(E.matchQuote('The cafeteria closes at noon on Sundays', passage).found, false);
});

test('quote matcher: long quotes (>64 chars) are aligned with sliding windows', () => {
  const passage = 'Intro text here. ' + 'The nightly fee reconciliation job runs at two in the morning from the scripts folder every day.' + ' Trailing words.';
  const q = 'The nightly fee reconcilation job runs at two in the morning from the scripts folder every day';
  assert.ok(q.length > 64);
  const r = E.matchQuote(q, passage);
  assert.equal(r.found, true);
  assert.equal(r.method, 'fuzzy');
});

test('token guard: changed digit, port, version, identifier and path are rejected', () => {
  const quote = 'The API runs on port 8080, flag WEBHOOK_RETRY_ENABLED, PR #48, v2.3, scripts/reconcile.py.';
  assert.equal(E.tokenGuard('The API runs on port 8080.', quote).pass, true);
  assert.equal(E.tokenGuard('The API runs on port 8081.', quote).pass, false);
  assert.equal(E.tokenGuard('See PR #49.', quote).pass, false);
  assert.equal(E.tokenGuard('Ships in v2.4.', quote).pass, false);
  assert.equal(E.tokenGuard('Flag WEBHOOK_RETRY_ENABLE is set.', quote).pass, false);
  assert.equal(E.tokenGuard('Run scripts/reconcile2.py nightly.', quote).pass, false);
});

test('token guard: added or dropped negation is rejected', () => {
  assert.equal(E.tokenGuard('Retries are not enabled.', 'Retries are enabled.').pass, false);
  assert.equal(E.tokenGuard('Retries are enabled.', 'Retries are not enabled.').pass, false);
  assert.equal(E.tokenGuard("Retries aren't enabled.", 'Retries are not enabled.').pass, true);
});

test('support check: yes / partly / no', () => {
  assert.equal(E.supportCheck('Aarav owns the billing module.', 'Aarav owns the billing module.').verdict, 'yes');
  assert.equal(E.supportCheck('Aarav owns billing and the payments gateway roadmap.', 'Aarav owns the billing module.').verdict, 'partly');
  assert.equal(E.supportCheck('The cafeteria closes early.', 'Aarav owns the billing module.').verdict, 'no');
});

test('verifyClaim: failed claims are never stored', () => {
  const passage = { text: 'Deploys go out every Friday after 6 PM.' };
  assert.equal(E.verifyClaim({ statement: 'Deploys go out every Friday after 6 PM.', quote: passage.text }, passage).label, 'Sourced');
  assert.equal(E.verifyClaim({ statement: 'Deploys go out every Friday after 7 PM.', quote: passage.text }, passage).stored, false);
  assert.equal(E.verifyClaim({ statement: 'x', quote: 'Something not in the passage at all' }, passage).stored, false);
});

test('masking: secrets and personal data are masked before storage', () => {
  const m = E.maskSecrets('key sk_live_CANARY55190b, password is hunter2, mail a.b@x.example, call +91 98765 43210');
  assert.ok(!/sk_live_CANARY55190b|hunter2|a\.b@x\.example|98765/.test(m.text), m.text);
  assert.equal(m.findings.length, 4);
});

test('sample pipeline: every stored claim passed the checks and nothing secret is stored', () => {
  const { sources, result } = loadSample();
  assert.ok(result.claims.length >= 20);
  const secrets = sources.flatMap(s => s.findings.map(f => f.original));
  assert.ok(secrets.length >= 3);
  result.claims.forEach(c => {
    assert.ok(['Sourced', 'Inferred', 'Quote-only'].includes(c.label));
    if (c.quote) {
      const src = sources.find(s => s.id === c.sourceId);
      assert.equal(src.text.slice(c.quoteStart, c.quoteEnd).length > 0, true);
    }
    assert.deepEqual(E.canaryScan(c.statement + ' ' + (c.quote || ''), secrets), []);
  });
});

test('injection text is quarantined, never extracted as a claim', () => {
  const { result } = loadSample();
  assert.equal(result.quarantined.length, 1);
  assert.ok(!result.claims.some(c => /ignore previous instructions/i.test(c.quote || '')));
});

test('per-reader labels: conflict and superseded are computed over the reader view only', () => {
  const { result } = loadSample();
  const reviewer = E.computeView(result.claims, P.reviewer);
  const meera = E.computeView(result.claims, P.meera);
  const rohan = E.computeView(result.claims, P.rohan);
  // Deploy owner conflict: task board (all members) vs chat (core team).
  assert.ok(meera.items.some(c => c.displayLabel === 'Possible conflict' && /deploy/i.test(c.statement)));
  assert.ok(!rohan.items.some(c => c.displayLabel === 'Possible conflict'));
  // Vendor payments: superseded for the reviewer (sees the treasurer note) but current for Meera.
  const vp = reviewer.items.find(c => /Aarav handles vendor payments/.test(c.statement));
  assert.equal(vp.displayLabel, 'Superseded');
  assert.notEqual(meera.items.find(c => c.id === vp.id).displayLabel, 'Superseded');
});

test('stale-fact hazards are listed per reader', () => {
  const { result } = loadSample();
  const hz = E.staleHazards(result.claims, READERS);
  assert.ok(hz.some(h => h.readerId === 'meera'));
  assert.ok(hz.some(h => h.readerId === 'rohan'));
});

test('gap rows are identical whether an item is missing or hidden', () => {
  const { result } = loadSample();
  const rohan = E.computeView(result.claims, P.rohan); // scheduled job exists but is core-team only
  const meera = E.computeView(result.claims, P.meera);
  const hidden = rohan.gaps.find(g => g.key === 'scheduled_jobs');
  const missing = meera.gaps.find(g => g.key === 'who_to_ask'); // nobody documented a contact
  assert.ok(hidden && missing);
  assert.equal(hidden.text, E.GAP_TEXT);
  assert.deepEqual(Object.keys(hidden).sort(), Object.keys(missing).sort());
  assert.equal(hidden.text, missing.text);
});

function approveAll(claims) {
  return claims.map(c => Object.assign({}, c, { reviewState: 'accepted' }));
}

test('canary leak test: zero canaries and zero restricted markers across readers', () => {
  const { sources, result } = loadSample();
  const claims = approveAll(result.claims);
  const secrets = sources.flatMap(s => s.findings.map(f => f.original));
  READERS.forEach(r => {
    const text = E.renderHandoverText(E.composeHandover(claims, r));
    assert.deepEqual(E.canaryScan(text, secrets), [], r.id);
    Object.entries(S.RESTRICTED_MARKERS).forEach(([tag, markers]) => {
      if (!r.tags.includes(tag)) assert.deepEqual(E.canaryScan(text, markers), [], r.id + ' ' + tag);
    });
  });
});

test('differential test: removing a hidden source leaves the reader output byte-identical', () => {
  const { result } = loadSample();
  const claims = approveAll(result.claims);
  READERS.forEach(r => {
    const d = E.differentialTest(claims, r);
    assert.equal(d.ran, true);
    assert.equal(d.identical, true, r.id);
  });
});

test('nothing reaches a reader before approval', () => {
  const { result } = loadSample();
  const h = E.composeHandover(result.claims, P.meera); // all still "proposed"
  assert.equal(Object.values(h.sections).flat().length, 0);
});

test('mutation test: zero false accepts on digit, negation, identifier and wrong-source mutations', () => {
  const { result } = loadSample();
  const byId = Object.fromEntries(result.passages.map(p => [p.id, p]));
  const mt = E.mutationTest(result.claims, byId);
  assert.ok(mt.total >= 30, 'ran ' + mt.total);
  assert.equal(mt.falseAccepts, 0, JSON.stringify(mt.details.filter(d => d.accepted)));
});

test('uncited sentences are detected', () => {
  assert.deepEqual(E.uncitedSentences('Aarav owns billing [CLM-102]. Karan deploys.'), ['Karan deploys.']);
});

test('CSV import maps unfamiliar headers', () => {
  const t = E.csvToText('Card,Who,Lane\nFix login,Karan,Doing');
  assert.equal(t.text, 'Task: Fix login | Owner: Karan | Status: Doing');
});
