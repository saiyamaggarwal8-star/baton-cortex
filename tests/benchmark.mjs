// Baton benchmark runner (Round 3, improvement 3).
//   node tests/benchmark.mjs          rules only (offline, deterministic)
//   node tests/benchmark.mjs --ai     rules + AI through the live /api/ai (signs in with the public demo reviewer)
// Writes docs/benchmark-results.json and prints a summary.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const E = require('../js/engine.js');
const S = require('../js/sample.js');
const B = require('../js/benchmark.js');

const useAI = process.argv.includes('--ai');
const API = process.env.BATON_AI_URL || 'https://baton-cortex.vercel.app/api/ai';

function makeSource(o) {
  let text = o.raw || '';
  if (o.kind === 'tasks') text = E.csvToText(text).text;
  else if (o.kind === 'chat' && /^\s*[\[{]/.test(text)) text = E.chatJsonToText(text) || text;
  const m = E.maskSecrets(text);
  return { id: o.id, title: o.title, kind: o.kind, access: o.access, author: o.author || null, date: o.date, text: m.text, masked: m.findings.map(f => f.type) };
}

async function token() {
  const cfg = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8');
  const url = cfg.match(/supabaseUrl:\s*'([^']+)'/)[1], key = cfg.match(/supabaseKey:\s*'([^']+)'/)[1];
  const r = await fetch(url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'rao@baton.example', password: 'baton-demo-2026' }) });
  const j = await r.json();
  if (!r.ok) throw new Error('demo sign-in failed');
  return j.access_token;
}

async function ai(tok, task, body) {
  const r = await fetch(API, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ task }, process.env.BATON_AI_MODEL ? { model: process.env.BATON_AI_MODEL } : {}, body)) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}

const projects = { meridian: S.SAMPLE_SOURCES, lumen: B.LUMEN_SOURCES };
const out = { at: new Date().toISOString(), projects: {}, support: {} };
let tok = null;
if (useAI) { try { tok = await token(); } catch (e) { console.log('AI skipped: ' + e.message); } }

for (const [name, raw] of Object.entries(projects)) {
  const sources = raw.map(makeSource);
  const run = E.runPipeline(sources);
  const rules = B.score(run.claims, name);
  const entry = { sources: sources.length, passages: run.passages.length, quarantined: run.quarantined.length, masked: sources.reduce((a, s) => a + s.masked.length, 0),
    rules: { claims: run.claims.length, found: rules.all, explicit: rules.explicit, implicit: rules.implicit, missed: rules.rows.filter(r => !r.hit).map(r => r.fact.id + ' ' + r.fact.what) } };
  if (tok) {
    try {
      const ex = await ai(tok, 'extract', { sources: sources.map(s => ({ id: s.id, kind: s.kind, title: s.title, access: s.access })), passages: run.passages.map(p => ({ id: p.id, sourceId: p.sourceId, text: p.text, author: p.author, date: p.date })) });
      const merged = run.claims.concat(ex.claims.map(c => Object.assign({ reviewState: 'proposed' }, c)));
      const both = B.score(merged, name);
      const aiOnly = B.score(ex.claims, name);
      const proposals = ex.claims.length + ex.dropped.length;
      // Independent re-check: every claim the server returned for storage must still verify
      // against its own passage. Anything failing here would be a stored fabrication.
      const byId = Object.fromEntries(run.passages.map(p => [p.id, p]));
      const storedFabrications = ex.claims.filter(c => {
        const p = byId[c.passageId];
        return !p || !E.verifyClaim({ type: c.type, statement: c.statement, quote: c.quote, author: p.author }, p, { supportUnavailable: true }).stored;
      }).length;
      entry.ai = { model: ex.model, stored: ex.claims.length, proposals, refused: ex.dropped.length,
        badQuotesRefusedBeforeStorage: ex.dropped.filter(d => d.fabricated).length, refusedByEvidenceCheck: ex.dropped.filter(d => /AI evidence check/.test(d.reason)).length,
        aiOnly: aiOnly.all, rulesPlusAI: { found: both.all, explicit: both.explicit, implicit: both.implicit },
        missed: both.rows.filter(r => !r.hit).map(r => r.fact.id + ' ' + r.fact.what), storedFabrications };
    } catch (e) { entry.ai = { error: e.message }; }
  }
  out.projects[name] = entry;
}

const rulesSupport = B.supportAccuracy(p => E.supportCheck(p.statement, p.quote, p.author).verdict === 'yes');
out.support.rules = { correct: rulesSupport.correct, total: rulesSupport.total, falseAccepts: rulesSupport.falseAccepts, falseRejects: rulesSupport.falseRejects,
  wrong: rulesSupport.rows.filter(r => !r.correct).map(r => r.pair.id + ' ' + r.pair.statement) };
if (tok) {
  try {
    const r = await ai(tok, 'support', { items: B.SUPPORT_PAIRS.map(p => ({ id: p.id, statement: p.statement, quote: p.quote, author: p.author })) });
    const v = Object.fromEntries(r.results.map(x => [x.id, x.verdict]));
    const acc = B.supportAccuracy(p => v[p.id] === 'supported');
    out.support.ai = { correct: acc.correct, total: acc.total, falseAccepts: acc.falseAccepts, falseRejects: acc.falseRejects, wrong: acc.rows.filter(x => !x.correct).map(x => x.pair.id + ' ' + x.pair.statement + ' -> ' + (v[x.pair.id] || 'none')) };
  } catch (e) { out.support.ai = { error: e.message }; }
}

if (process.env.BATON_AI_MODEL) out.pinnedModel = process.env.BATON_AI_MODEL;
writeFileSync(new URL(process.env.BATON_BENCH_OUT ? '../docs/' + process.env.BATON_BENCH_OUT : '../docs/benchmark-results.json', import.meta.url), JSON.stringify(out, null, 2));
for (const [name, e] of Object.entries(out.projects)) {
  console.log(`${name}: rules ${e.rules.found.found}/${e.rules.found.total} facts (explicit ${e.rules.explicit.found}/${e.rules.explicit.total}, implicit ${e.rules.implicit.found}/${e.rules.implicit.total})` +
    (e.ai && !e.ai.error ? ` | rules+AI ${e.ai.rulesPlusAI.found.found}/${e.ai.rulesPlusAI.found.total}, AI proposals refused before storage ${e.ai.refused}/${e.ai.proposals} (${e.ai.badQuotesRefusedBeforeStorage} bad quotes), fabricated claims stored ${e.ai.storedFabrications}` : e.ai ? ' | AI error: ' + e.ai.error : ''));
}
console.log(`evidence check, rules: ${out.support.rules.correct}/${out.support.rules.total} correct, ${out.support.rules.falseAccepts} false accepts` +
  (out.support.ai && !out.support.ai.error ? ` | AI: ${out.support.ai.correct}/${out.support.ai.total}, ${out.support.ai.falseAccepts} false accepts` : ''));
