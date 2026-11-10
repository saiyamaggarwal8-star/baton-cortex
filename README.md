# Baton: verifiable knowledge handover

**Team Cortex · CodersInPune Hackathon, Round 2**

When someone leaves a project, Baton rebuilds what they knew from the project's sources as a ledger of small claims. Each claim carries an exact source quote, a label and an access tag. Code, not a model, checks every quote. The incoming person gets a handover written only from approved claims they are allowed to see. Anything Baton cannot prove is shown as a labelled gap.

> **Core rule:** the system may write only what it can cite. Everything else is shown as a labelled gap.

## Try it

Open the site and click **Try it with the Meridian sample**. The workflow has five steps:

1. **Connect.** Six synthetic sources load: meeting notes, a chat export, a task-board CSV, GitHub comments, a commit log and a treasurer-only note. Change who may see each one, add your own (paste, or upload `.md` / `.txt` / `.csv` / `.json`), or import a public GitHub repo.
2. **Reconstruct.** Run it. Sources are split into passages, secrets are masked, claims are proposed, and instruction-like text is quarantined.
3. **Verify.** See every claim's quote match, token guard and support check. In the **Quote guard lab**, change a number or add a "not" and watch it get rejected. **Run tests** runs the mutation, canary and differential tests.
4. **Review.** You act as Prof. Rao, the reviewer:
   - decide the random sample, then bulk-approve only low-risk claims;
   - resolve the deploy-owner conflict;
   - answer the gap interview as Aarav;
   - decide the stale-fact hazards;
   - view the handover as Meera, Rohan and Kavya and confirm each view;
   - publish.
5. **Handover.** Switch between readers. Each gets a different plan from the same approved version. Tick items to acknowledge them, or request access on a gap row.

Everything runs in the browser on synthetic data. There is no sign-in, and progress is saved in your browser only (**Reset** clears it).

## Run locally

It's a static site with no build step.

```bash
python -m http.server 3100
```

Then open http://localhost:3100.

## Tests

```bash
node --test tests/engine.test.js
```

There are 20 tests on the engine:

- **Quote matcher:** exact, fuzzy, and sliding windows for quotes over 64 characters.
- **Exact-token guard:** digits, ports, versions, identifiers, paths and negations.
- **Support check and storage:** the support check works, and failed claims are never stored.
- **Secret masking.**
- **Injection quarantine.**
- **Per-reader logic:** conflict and superseded labels are computed per reader, and stale-fact hazards are listed.
- **Gap rows:** identical whether an item is missing or hidden.
- **Canary leak test:** 0 canaries across readers.
- **Differential test:** byte-identical output.
- **Approval:** nothing is shared before approval.
- **Mutation test:** 0 false accepts.
- **Uncited sentences** are detected.
- **CSV column mapping.**

## Deploy

Any static host works: Vercel, Netlify, GitHub Pages or Cloudflare Pages. Use the folder root as the output directory, with no build command.

## Project structure

```
index.html          Landing page, Handover Studio, product spec page
css/base.css        Shell, landing, dock and spec styles
css/studio.css      Studio styles
js/engine.js        Trust-critical logic (pure functions, also runs in Node)
js/sample.js        Synthetic "Meridian" project and demo personas
js/studio.js        Studio UI: Connect → Reconstruct → Verify → Review → Handover
js/dock.js          3D project dock and PRD dossier on the landing page
js/app.js           Hash router (#/, #/studio/<step>, #/spec/<project>)
tests/              node:test suite for the engine
```

## What is real and what is simulated

| Real (working code) | Simulated / not yet built |
|---|---|
| Rule-based claim extraction with exact quotes | A hosted LLM for extraction (planned behind a provider interface) |
| Quote verifier: exact match, fuzzy fallback, sliding windows, exact-token guard | The support check is lexical, not a second model call |
| Secret and personal-data masking on import and in interview answers | Presidio |
| Per-reader views, conflicts, superseded labels, gaps and stale-fact hazards | Postgres row-level security (the permission check is one app-level function, `canSee`) |
| Review gate: sample, bulk rules, edit re-verification, view-as, publish gate | Server-side persistence (uses browser storage) |
| Immutable versions with a SHA-256 hash, retraction, receipts, access requests, audit log | Real sign-in (seeded demo personas only) |
| Public GitHub import through the REST API | Slack, Teams or Drive connectors |

We report "zero canaries across the readers and sample tested", never "no secrets leak". Masking is heuristic.
