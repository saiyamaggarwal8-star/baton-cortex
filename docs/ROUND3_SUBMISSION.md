# Baton: Round 3 (final) submission notes

Draft text for the Round 3 form. Put it in your own words before submitting, and fill the marked
placeholders: the AI numbers after the live run, and the teammates' contributions.

- **Final working project link:** https://baton-cortex.vercel.app (demo accounts on the sign-in screen; password `baton-demo-2026`)
- **Final source-code repository:** https://github.com/saiyamaggarwal8-star/baton-cortex
- **Final product PDF:** `Baton_Cortex_Round3_Product.pdf` (from `docs/round3/Baton_Round3_Product.html`)

## Complete list of features

1. **Real accounts.** Supabase Auth sign-in with six public demo accounts (reviewer, data owner, departing lead, three readers) and one-click buttons; account menu with switch and sign out; session refresh; local mode if the database is unreachable.
2. **Source import.** Paste or upload Markdown, text, CSV and JSON. Chat exports, including Slack JSON. Task CSVs with any headers (column mapping). Public GitHub repos (README plus 20 issues and PRs). An access tag on every source.
3. **Masking on import.** Keys, tokens, passwords (including "password was …"), PINs, emails and phone numbers are masked before anything is stored or sent to a model.
4. **Rule-based extraction.** Ten claim types, each carrying its exact source sentence; ownership inferred from commit counts with the numbers shown.
5. **AI extraction.** A server function asks Claude for decisions with their rationale, tasks with owners and deadlines, dependencies, risks, open questions and contacts. Every proposal must quote its source. The model has no tools and sees one source chunk per call, with links, HTML and instruction-like text removed.
6. **Code verification, twice.** Exact match, fuzzy sliding-window match, an exact-token guard (numbers, versions, paths, identifiers, negations) and a support check, in code. Postgres re-checks every extracted quote against the stored source on save.
7. **AI evidence check.** A separate model call judges whether each quote supports its claim, and an AI audit finds contradictions and outdated decisions. Doubtful claims are held for a person: never bulk-approved, never decided by fast-forward, and the publish gate stays closed until a reviewer rules.
8. **Plant a wrong claim.** A real quote with a wrong statement shows which checks catch it (the rules' word-overlap check alone accepts it).
9. **Injection containment.** Instruction-like text is quarantined, never becomes a claim and is never sent to the model.
10. **Review gate.** Random sample (10%, minimum 5) before bulk approval of low-risk claims only. Conflicts side by side, stale-fact hazards, leaver disputes, view-as for every reader, a 60-claim review cap, immutable versions with a hash and retraction.
11. **Publish gate enforced by the database.** Reviewer only, no undecided claims, no open disputes, every published row equal to an approved claim; the server records who approved and when.
12. **Guided interview.** Gaps ranked by impact, targeted questions (optionally tailored by AI), sent to the departing lead's own account; answers return as "Stated by Aarav" claims the reviewer still decides on.
13. **Per-reader handover.** Ownership, first-week actions, risks, decisions and a timeline, built only from approved claims that reader may see. Gap rows look the same whether an item is missing or hidden. Request access (only the reviewer sees the real reason). Acknowledgements are stored per account.
14. **Reader page from Postgres.** Each reader's page is read only from the database with their own token.
15. **Try to break in.** Ten live attacks as the signed-in reader: read sources, the ledger, higher-tag rows, the audit log and the leaver's answers; forge headers; tamper with the token; approve a version; use only the public key.
16. **Handover quality report.** A score out of 100 from evidence share, gaps per reader, conflicts, AI flags, stale facts and areas only the leaver owns.
17. **Benchmark.** Recall against answer keys for Meridian and the held-out Lumen project (Slack JSON, Jira CSV, call transcript, email thread), and evidence-check accuracy on 20 labelled pairs, in the app and in CI.
18. **Leak and guard tests in the app.** 44 quote mutations, canary scan, differential test, gap-row shape, planted injection, and database probes with each account's token.
19. **Audit log** with the real account stamped by the server.
20. **Guidance for judges.** A next-step bar on every screen, and a fast-forward that stops at the publish gate.

## Technical architecture and implementation summary

- **Frontend:** a static single-page app (HTML, CSS, JavaScript, GSAP, Lenis), no build step. `js/engine.js` holds the trust-critical logic as pure functions shared by the browser, the server function and the tests.
- **Database and identity:** Supabase Postgres with row-level security on every table, and Supabase Auth (JWT).
  - RLS helpers read `auth.uid()` and the user's workspace membership.
  - Workspaces have owners and per-workspace roles.
  - The anonymous key reads nothing.
  - Readers read published rows through a `security_invoker` view filtered by their access tags.
- **Server-side trust checks (Postgres triggers):**
  - quote-in-source with numbers guarded;
  - the publish gate;
  - published rows must equal approved claims;
  - immutable versions;
  - server-stamped audit and interview rows.
- **AI (`api/ai.js`, a Vercel Function):**
  1. Verifies the caller's Supabase token and staff role.
  2. Calls Claude through a provider interface (Vercel AI Gateway or the Anthropic API) with JSON-schema output.
  3. Runs the code verifier on every proposal.
  4. Makes a separate evidence-check call.
  5. Caches responses in Postgres by model, task and input.
- **Hosting:** Vercel (site and function), Supabase (database and auth).
- **Migrations:** six, in `supabase/migrations`, plus a seed for the demo accounts.

## Improvements completed after Round 2

**The three named in Round 2:**
1. **Real accounts and hardened permissions.** Supabase Auth with RLS reading the token, user-owned workspaces, and server-side quote and publish-gate checks. Reviewer sign-off is enforced by the database. The security tests run in CI on every push against a fresh database.
2. **AI-assisted extraction and a guided interview.** Claude behind a provider interface with cached responses, code verification of every proposal, a separate AI evidence check and contradiction audit, and a ranked, cross-account exit interview. {{AI_STATUS}}
3. **Quality report and held-out benchmark.** A scored quality report, plus answer keys for Meridian and the held-out Lumen project in four new export formats, with recall, refused AI proposals and evidence-check accuracy.

**Also:**
- Reader and leaver pages.
- The Try to break in panel.
- Source validation and a double-publish guard.
- A routing fix for fast account switches.
- Stronger masking.
- Slack and Jira importers.
- The security advisor is clean.
- A clone-and-run README.

## Testing details

- **Engine tests:** 20 of 20 pass (`node --test tests/engine.test.js`).
- **Live security probes:** 36 of 36 pass with real tokens (`node tests/rls.probe.mjs`). They cover sign-in for all six accounts, readers blocked from sources and the ledger, forged headers, foreign workspaces, tampered JWTs, the bare public key, quote and number refusals by Postgres, reviewer-only publishing, the publish gate, the server-set approver, row-equals-claim, immutable versions, exact rows per reader, and interview privacy.
- **CI:** GitHub Actions runs the engine tests, the benchmark and the 36 probes on every push. The probes run against a fresh Supabase stack built from the migrations and seed.
- **Benchmark:**
  - Rules: Meridian 21/24 facts, Lumen 15/25 (4/13 implicit). The rules evidence check is 14/20 with 6 false accepts.
  - Rules + AI: Meridian {{AI_MERIDIAN}}, Lumen {{AI_LUMEN}}; AI evidence check {{AI_SUPPORT}}.
  - Stored fabrications: 0 by construction.
- **In-app:** 44 quote mutations with 0 false accepts, 0 canaries across 3 readers, a byte-identical differential test, the injection quarantined, and 10/10 break-in attempts blocked.
- **End-to-end journeys** were tested locally and live:
  - Reviewer: load → reconstruct → verify → review → publish (26 claims, v1 with 25; Meera 23 rows, Rohan 16, Kavya 17, matching the in-app check).
  - Reader: sign in → handover → acknowledge → reload → break in.
  - Leaver: receive questions → answer → reviewer imports.
- **Reliability checks:**
  - empty, oversized, duplicate and unreadable sources;
  - double publish;
  - reload during AI and benchmark runs;
  - account switching;
  - database and AI outages (fallback with a visible reason).

## Product roadmap and future development plan

- **Next 4 weeks:** invite real teammates by email with owner-chosen roles; Slack and GitHub OAuth connectors that sync; PDF and Google Docs import; a teammate-written held-out benchmark.
- **Next 3 months:** continuous handovers (the ledger updates weekly, so leaving is a non-event); an owner approval flow that grants one tag for one item; per-claim history and version diffs; an evaluation dashboard.
- **Later:** server-side extraction jobs; organisation-wide policies (retention, sensitive tags); SSO for universities and companies; an on-premise model option.

## Team-member contributions

- **Saiyam Aggarwal:** security and permissions lead. Built the Round 2 and Round 3 product: verifier, RLS and server checks, Supabase Auth, the AI pipeline, the benchmark, tests and CI, deployment, documentation.
- **Divyansh Somani:** {{CONTRIBUTION}}
- **Kaustabh Chowdhury:** {{CONTRIBUTION}}
- **Anushka Verma:** {{CONTRIBUTION}}

## AI tools and third-party code

Claude (Anthropic) assisted with code and documentation; ChatGPT was used for an early website draft in Round 2. Third-party code: GSAP and Lenis (vendored), a plain-JS port of React Bits' CircularCarousel, and `@anthropic-ai/sdk`. No pre-built product was used.
