# Baton: Round 3 (final) submission notes

Draft text for the Round 3 form. Put it in your own words before submitting.

- **Final working project link:** https://baton-cortex.vercel.app (demo accounts on the sign-in screen; password `baton-demo-2026`)
- **Final source-code repository:** https://github.com/saiyamaggarwal8-star/baton-cortex
- **Final product PDF:** `Baton_Cortex_Round3_Product.pdf` (from `docs/round3/Baton_Round3_Product.html`)

## Complete list of features

1. **Real accounts.** Supabase Auth sign-in with six public demo accounts (reviewer, data owner, departing lead, three readers) and one-click buttons; account menu with switch and sign out; session refresh; local mode if the database is unreachable.
2. **Source import.** Paste or upload Markdown, text, CSV and JSON. Chat exports, including Slack JSON. Task CSVs with any headers (column mapping). Public GitHub repos (README plus 20 issues and PRs). An access tag on every source.
3. **Masking on import.** Keys, tokens, passwords (including "password was …"), PINs, emails and phone numbers are masked before anything is stored or sent to a model.
4. **Rule-based extraction.** Ten claim types, each carrying its exact source sentence; ownership inferred from commit counts with the numbers shown.
5. **AI extraction.** A server function asks an AI model for decisions with their rationale, tasks with owners and deadlines, dependencies, risks, open questions and contacts. Every proposal must quote its source. The model has no tools and sees one source chunk per call, with links, HTML and instruction-like text removed. **Model on the live site: OpenAI's open-weights GPT-OSS-120B** (`openai/gpt-oss-120b`) through the Vercel AI Gateway. GPT-5-mini and Mistral Small are fallbacks, used only if that model is unavailable. Claude is an optional provider, used only if an Anthropic API key is set; no key is set on the live site.
6. **Code verification, twice.** Exact match, fuzzy sliding-window match, an exact-token guard (numbers, versions, paths, identifiers, negations) and a support check, in code. Postgres re-checks every extracted quote against the stored source on save.
7. **AI evidence check.** A separate model call judges whether each quote supports its claim, and an AI audit finds contradictions and outdated decisions. Doubtful claims are held for a person: never bulk-approved, never decided by fast-forward, and the publish gate stays closed until a reviewer rules.
8. **Plant a wrong claim.** A real quote with a wrong statement shows which checks catch it (the rules' word-overlap check alone accepts it).
9. **Injection containment.** Instruction-like text is quarantined, never becomes a claim and is never sent to the model.
10. **Review gate.** Random sample (10%, minimum 5) before bulk approval of low-risk claims only. Conflicts side by side, stale-fact hazards, leaver disputes, view-as for every reader, a 60-claim review cap, immutable versions with a hash and retraction.
11. **Publish gate enforced by the database.** Reviewer only, no undecided claims, no open disputes, every published row equal to an approved claim; the server records who approved and when.
12. **Team-isolated workspaces.** A new workspace adds only its owner and the owner's own team. A member of workspace A cannot read or write workspace B; the probes test this with two workspaces in two teams.
13. **Guided interview.** Gaps ranked by impact, targeted questions (optionally tailored by AI), sent to the departing lead's own account; answers return as "Stated by Aarav" claims the reviewer still decides on.
14. **Per-reader handover.** Ownership, first-week actions, risks, decisions and a timeline, built only from approved claims that reader may see. Gap rows look the same whether an item is missing or hidden. Request access (only the reviewer sees the real reason). Acknowledgements are stored per account.
15. **Reader page from Postgres.** Each reader's page is read only from the database with their own token.
16. **Try to break in.** Ten live attacks as the signed-in reader: read sources, the ledger, higher-tag rows, the audit log and the leaver's answers; forge headers; tamper with the token; approve a version; use only the public key.
17. **Handover quality report.** A score out of 100 from evidence share, gaps per reader, conflicts, AI flags, stale facts and areas only the leaver owns.
18. **Benchmark.** Recall against answer keys for Meridian and the held-out Lumen project (Slack JSON, Jira CSV, call transcript, email thread), and evidence-check accuracy on 20 labelled pairs, in the app and in CI.
19. **Leak and guard tests in the app.** Quote mutations (44 on the rules-only ledger, 63 with AI claims), canary scan, differential test, gap-row shape, planted injection, and database probes with each account's token.
20. **Audit log** with the real account stamped by the server.
21. **Guidance for judges.** A next-step bar on every screen, and a fast-forward that stops at the publish gate.

**Not built (planned, see the roadmap):** PDF and Google Docs import, Slack and GitHub OAuth connectors that sync, email invitations, and a model-written narrative summary.

## Technical architecture and implementation summary

- **Frontend:** a static single-page app (HTML, CSS, JavaScript, GSAP, Lenis), no build step. `js/engine.js` holds the trust-critical logic as pure functions shared by the browser, the server function and the tests.
- **Database and identity:** Supabase Postgres with row-level security on every table, and Supabase Auth (JWT).
  - RLS helpers read `auth.uid()` and the user's workspace membership.
  - Workspaces have owners and per-workspace roles, and are isolated by team: a new workspace adds only its owner's team.
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
  2. Calls the model through a provider interface. **Active on the live site: GPT-OSS-120B** on the Vercel AI Gateway free credit. Fallbacks, used only if it is unavailable: GPT-5-mini, then Mistral Small. Optional: Claude through the Anthropic API, only when a key is set (not set on the live site).
  3. Runs the code verifier on every proposal.
  4. Makes a separate evidence-check call.
  5. Caches responses in Postgres by model, task and input.
- **Hosting:** Vercel (site and function), Supabase (database and auth).
- **Migrations:** seven, in `supabase/migrations`, plus a seed for the demo accounts.

## Improvements completed after Round 2

**The three named in Round 2:**
1. **Real accounts and hardened permissions.** Supabase Auth with RLS reading the token, owner-created workspaces isolated by team, and server-side quote and publish-gate checks. Reviewer sign-off is enforced by the database. The security tests run in CI on every push against a fresh database.
2. **AI-assisted extraction and a guided interview.** An AI model behind a provider interface with cached responses, code verification of every proposal, a separate AI evidence check and contradiction audit, and a ranked, cross-account exit interview. Live on the deployed site: the Vercel AI Gateway free credit excludes Claude, so the demo runs GPT-OSS-120B, chosen by benchmark (48 of 49 facts vs 43 for GPT-5-mini). Adding an Anthropic key switches to Claude with no code change.
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
- **Live security probes:** 49 of 49 pass with real tokens (`node tests/rls.probe.mjs`). They cover sign-in for all six accounts, two workspaces in two teams (neither side can read or write the other, and no account is added to the other team's workspace), readers blocked from sources and the ledger, forged headers, foreign workspaces, tampered JWTs, the bare public key, quote and number refusals by Postgres, reviewer-only publishing, the publish gate, the server-set approver, row-equals-claim, immutable versions, exact rows per reader, and interview privacy.
- **CI:** GitHub Actions runs the engine tests, the benchmark and the 49 probes on every push. The probes run against a fresh Supabase stack built from the migrations and seed.
- **Benchmark:**
  - Rules: Meridian 21/24 facts, Lumen 15/25 (4/13 implicit). The rules evidence check is 14/20 with 6 false accepts.
  - Rules + AI (GPT-OSS-120B): Meridian 23/24, Lumen 25/25 (13/13 implicit); AI evidence check 20/20 with 0 false accepts.
  - **Zero fabricated claims were stored.** The AI proposed 53 claims; the code verifier refused 1 before storage (its quote dropped a negation, so it did not match the source). That refused proposal was never saved. After the run, the benchmark re-checks every stored AI claim against its source: 0 failures.
- **Live AI:** Meridian +7 claims in 16 s, Lumen +17 in 22 s with the moved launch date flagged. The planted claim "Rohan owns the billing module" passed the quote check, token guard and rules support check, but the AI evidence check said "contradicted", so it was held and rejected.
- **In-app:** quote mutations with 0 false accepts (44 on the rules-only ledger, 63 with AI claims), 0 canaries across 3 readers, a byte-identical differential test, the injection quarantined, and 10/10 break-in attempts blocked.
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

- **Divyansh Somani (team leader):** role B in the Round 1 plan: backend, ingestion and the model layer.
- **Saiyam Aggarwal:** role D in the Round 1 plan: verification, permissions and security. Built the product in Rounds 2 and 3.
- **Kaustabh Chowdhury:** role A in the Round 1 plan: product, UX and frontend.
- **Anushka Verma:** role C in the Round 1 plan: extraction, benchmark and demo data.

## AI tools and third-party code

Claude (Anthropic) assisted with code and documentation; ChatGPT was used for an early website draft in Round 2. Third-party code: GSAP and Lenis (vendored), a plain-JS port of React Bits' CircularCarousel, and `@anthropic-ai/sdk`. No pre-built product was used.
