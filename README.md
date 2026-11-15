# Baton: verifiable knowledge handover

**Team Cortex · CodersInPune Hackathon, Final Round (Round 3)**

**Live:** https://baton-cortex.vercel.app · **Repo:** https://github.com/saiyamaggarwal8-star/baton-cortex

When someone leaves a project, what they knew is scattered across notes, chats, task boards and pull requests. Baton rebuilds it as a **ledger of small claims**. Every claim carries an exact quote from its source, a label and an access tag. Code (not a model) checks every quote, a reviewer approves before anything is shared, and each reader receives only the rows Postgres row-level security allows. Anything Baton cannot prove is shown as a labelled gap.

> **Core rule:** the system may write only what it can cite. Everything else is a labelled gap.

---

## Try it in two minutes (no setup)

Open https://baton-cortex.vercel.app → **Sign in**. Every demo account is a real Supabase Auth user; the password for all of them is **`baton-demo-2026`** (also printed on the sign-in screen, with one-click buttons).

| Account | Email | Role | What to try |
|---|---|---|---|
| **Prof. Rao** | rao@baton.example | Reviewer | **Start here.** Load the sample, run the five steps, publish. |
| Priya | priya@baton.example | Data owner | Add and tag sources. Cannot approve (the database refuses). |
| **Meera** | meera@baton.example | Incoming lead · core team | Open her handover and press **Try to break in**. |
| Rohan | rohan@baton.example | Member · all members | Sees only all-members items; the rest are gaps. |
| Kavya | kavya@baton.example | Treasurer | Sees treasurer-only items Meera and Rohan cannot. |
| Aarav | aarav@baton.example | Departing lead | Answers the guided exit interview from his own account. |

The demo accounts are public on purpose and protect synthetic data only. A seventh account, `iyer@lumen.example`, is a reviewer in a separate team; it is not on the sign-in screen and is used by the security probes to show that two teams' workspaces cannot see each other.

**Path:** sign in as Prof. Rao → **Load Meridian sample** → **Reconstruct** → **Verify** (try *Plant a wrong claim*, *Run tests*, *Run database probes*, *Run benchmark*) → **Review** (or *Fast-forward the demo review*; it stops at the publish gate) → **Approve and publish**. Then switch to **Meera** from the account menu: her page is served only from Postgres; press **Try to break in**. Try **Load Lumen** for the held-out project in Slack/Jira/transcript/email formats.

---

## What is built

Everything in this table is implemented and running on the live site. Work that is not built is listed separately under [Planned, not built](#planned-not-built).

| Area | What works |
|---|---|
| Import | Paste or upload `.md` / `.txt` / `.csv` / `.json`; chat exports including Slack JSON; task CSVs with header mapping (Jira, Trello-style); public GitHub repos (README + 20 issues/PRs). Each source has an access tag. Secrets and personal data are masked on import. |
| Extraction | Deterministic rules **plus AI extraction** (decisions with rationale, tasks with owners and deadlines, dependencies, risks, open questions, contacts) through a server function. Every AI proposal must quote its source. |
| Verification (code) | Exact match, fuzzy sliding-window fallback, exact-token guard (numbers, versions, paths, identifiers, negations), support check. **Postgres re-checks every extracted quote again on save.** |
| AI evidence check | A separate model call judges whether each quote supports its claim and finds contradictions and outdated decisions. Doubtful claims are held for a human (no bulk approval, fast-forward never decides them, publish gate stays closed). |
| Review gate | Random sample (10%, min 5) before bulk approval of low-risk claims only, conflicts side by side, stale-fact hazards, leaver disputes, view-as for every reader, 60-claim cap, immutable versions with retraction. **The database enforces the gate: reviewer only, no undecided claims, no open disputes, every published row must equal an approved claim.** |
| Guided interview | Ranked, targeted questions for each gap (weight × readers missing it), optional AI tailoring; sent to the departing lead's account; answers come back as "Stated by Aarav" claims. |
| Accounts & permissions | Supabase Auth (JWT). Postgres reads the user from the token (`auth.uid()`); workspaces have owners and members with per-workspace roles; the anonymous key alone reads nothing. **Workspaces are isolated by team:** a new workspace adds only its owner and the owner's own demo team, and the probes check that a member of workspace A cannot read or write workspace B. |
| Handover | Per-reader plan (ownership, first-week actions, risks, decisions, timeline), gap rows identical whether missing or hidden, request access, acknowledgements stored per reader. |
| Quality & benchmark | Handover quality report (evidence share, gaps per reader, conflicts, AI flags, hazards, single-owner risk). Benchmark against answer keys for Meridian and the held-out Lumen project, plus a labelled evidence-check set. |
| Tests | 20 engine tests, benchmark, 49 live security probes with real tokens (including two-workspace isolation); all run in GitHub Actions on every push against a **fresh** Supabase database. |

---

## Architecture

```
Browser (static SPA, no build)                      Vercel Function            Supabase
┌─────────────────────────────────────┐   JWT    ┌──────────────────┐  JWT   ┌──────────────────────────┐
│ js/engine.js  masking, passages,    │────────▶│ api/ai.js         │──────▶│ Postgres + RLS            │
│               rules, quote verifier │          │ 1 verify token    │       │  profiles, workspaces,    │
│ js/studio.js  5-step Studio         │          │ 2 call model      │       │  workspace_members,       │
│ js/account.js sign-in, reader page, │          │   (no tools, one  │       │  sources, claims,         │
│               break-in, interview   │          │   chunk per call) │       │  versions, handover_items,│
│ js/db.js      REST client, session  │──JWT───▶ │ 3 code verifier   │       │  receipts, requests,      │
│ js/ai.js      calls /api/ai         │          │ 4 evidence check  │       │  audit_log, ai_cache,     │
└─────────────────────────────────────┘          │ 5 cache in PG     │       │  interview_*              │
                                                  └──────────────────┘       │ triggers: quote check,    │
                                                     GPT-OSS-120B via         │  publish gate, immutable  │
                                                     Vercel AI Gateway        │  versions, audit stamps,  │
                                                     (active model)           │  team-scoped workspaces   │
                                                                              └──────────────────────────┘
```

- **Identity:** Supabase Auth issues a JWT; PostgREST verifies it; RLS helpers (`baton_ws()`, `baton_persona()`) read `auth.uid()` and the user's membership. The `x-baton-workspace` header only *selects* a workspace; it is honoured only for members.
- **Trust checks on the server:** `baton_check_claim` (quote must be in the stored source, numbers guarded), `baton_check_version` (reviewer only, no undecided claims or open disputes, server sets approver and time), `baton_check_item` (published row = approved claim, same words and tag), immutable versions, server-stamped audit and interview rows.
- **AI:** the browser never talks to a model. `api/ai.js` verifies the caller's token and role, strips URLs/HTML, never sends instruction-like passages, sends one source chunk per call (one access tag), runs the same `engine.js` verifier on every proposal, then a separate evidence-check call. Responses are cached in Postgres by model + task + input.

---

## Run it yourself

### 1. Frontend only (no database, everything local)

```bash
git clone https://github.com/saiyamaggarwal8-star/baton-cortex.git
cd baton-cortex
python -m http.server 3200      # or: npx serve -l 3200
```

Open http://localhost:3200. With the default `js/config.js` it uses the hosted demo database; to run fully offline, set `supabaseUrl: ''` in `js/config.js` (the Studio then runs in local mode).

### 2. Your own Supabase project

1. Create a project at supabase.com.
2. In the SQL editor, run `supabase/migrations/001…007` in order, then `supabase/seed/demo_accounts.sql`.
3. Put your project URL and **publishable** key in `js/config.js` (never the secret/service key).

Or run the whole stack locally with the Supabase CLI (Docker required): `supabase start` applies every migration and the seed, then point `js/config.js` at `http://127.0.0.1:54321`.

### 3. AI extraction

Deploy to Vercel (framework preset **Other**, no build command). `api/ai.js` picks its provider automatically.

| | Model | When it is used |
|---|---|---|
| **Active (live demo)** | OpenAI GPT-OSS-120B, open weights (`openai/gpt-oss-120b`) via the Vercel AI Gateway | Always, on the live site. Check it at `GET /api/ai`. |
| Fallback 1 | `openai/gpt-5-mini` via the Gateway | Only if the active model is unavailable on the account |
| Fallback 2 | `mistral/mistral-small` via the Gateway | Only if both above are unavailable |
| Optional provider | Claude (`claude-opus-5-5`) via the Anthropic API | Only if `ANTHROPIC_API_KEY` is set. **Not set on the live site.** |

The Gateway works with the deployment's built-in OIDC token. Its free credit (card verification, no charge) does not include Claude, so we benchmarked the free models and chose GPT-OSS-120B (48 of 49 answer-key facts, against 43 for GPT-5-mini). The staff-only `probeModels` task reports which models an account may call.

Optional: `BATON_MODEL`, `BATON_EFFORT`. When the AI is unavailable the Studio keeps the rule-based results and says why. On `localhost`, AI calls go to the deployed `/api/ai` (CORS allowed; your sign-in token is still required).

---

## Tests

```bash
node --test tests/engine.test.js     # 20 engine tests: verifier, permissions, leak tests, importers
node tests/benchmark.mjs             # recall vs answer keys + evidence-check accuracy (add --ai for the live model)
node tests/rls.probe.mjs             # 49 live security probes with real Supabase tokens
```

`.github/workflows/ci.yml` runs all three on every push; the probes run against a fresh local Supabase stack built from the migrations and seed.

**Latest benchmark** (`docs/benchmark-results.json`):

| | Rules only | Rules + AI (GPT-OSS-120B) |
|---|---|---|
| Meridian facts found | 21 / 24 | 23 / 24 |
| Lumen (held out) facts found | 15 / 25 | 25 / 25 |
| Evidence check, 20 labelled pairs | 14 / 20 (6 false accepts) | 20 / 20 (0 false accepts) |
| AI proposals refused before storage | – | 1 of 53 (its quote dropped a negation) |
| **Fabricated claims stored** | **0** | **0** |

The one refused proposal was caught by the code verifier and never stored. After each run the benchmark re-checks every stored AI claim against its source, so "0 stored" is measured, not assumed.

In the app: **Verify → Run tests** (44 quote mutations, canary scan, differential test, gap shape, planted injection), **Run database probes**, **Run benchmark**, **Plant a wrong claim**; **Meera → Try to break in**.

---

## Repository layout

```
index.html              single page: landing, Studio, account views, product spec
js/engine.js            pure functions shared by browser, server and tests
js/studio.js            the five-step Studio
js/account.js           sign-in, account menu, reader page, break-in, leaver interview
js/db.js  js/ai.js      Supabase client and AI client
js/sample.js            Meridian sample;  js/benchmark.js  Lumen held-out set, answer keys, labelled pairs
api/ai.js               Vercel Function: AI extraction, evidence check, conflicts, interview
supabase/migrations     001 schema + RLS … 007 workspace isolation;  supabase/seed  demo accounts
tests/                  engine tests, benchmark, live security probes
docs/                   submission notes, project PDF source, benchmark results
```

## Planned, not built

- Email invitations with owner-chosen roles (the demo uses seeded accounts).
- Slack and GitHub OAuth connectors that sync (today: exported files and public repos).
- PDF and Google Docs import.
- A model-written narrative summary (the handover is rendered by code from approved claims).
- Continuous weekly handovers, per-claim history and version diffs, an evaluation dashboard, SSO, an on-premise model option.

## Limitations (stated honestly)

- Demo data is synthetic; demo accounts are public.
- Masking is heuristic; we report "zero canaries across the readers tested", never "no secrets leak".
- The benchmark sets are small and written by the same person who built the importers (Lumen was written after the rules and never used to tune them). Numbers show direction, not significance.

## Credits and disclosures

Built by Team Cortex (Bennett University) during the event window. AI tools: Claude (Anthropic) assisted with code and documentation. Third-party code: GSAP and Lenis (vendored), a plain-JS port of React Bits' CircularCarousel, `@anthropic-ai/sdk`. No pre-built product was used.
