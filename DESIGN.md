# Baton UI design context

## Product and audience

Baton is a reviewer-led knowledge handover prototype for small project teams. The main job is to help a reviewer turn the synthetic Meridian campus-app sources into a useful first-day handover without blurring evidence, uncertainty, or reader access. The current prototype runs in the browser; it has no production identity, persistence service, or access enforcement.

## North star

**Carry the why with the work.** Make the evidence path visible: source → claim → reader. The interface should feel like a carefully kept project notebook made operational, rather than a generic AI dashboard.

## Visual language

- **Palette:** Oat `#ECE5D8`, Warm Charcoal `#161513`, Raised Charcoal `#201E1B`, Honey `#F5C451`, Tangerine `#FF8A3D`, and quiet rule `#3A3631`. Claim colors remain distinct and semantic: green for Sourced, cyan for Quote-only, lavender for Inferred, yellow for Stated, coral for Possible conflict.
- **Typography:** Newsreader for large editorial statements and quoted evidence; DM Sans for readable controls and body copy; DM Mono for source IDs, labels, timestamps, and workflow metadata.
- **Layout:** A warm-charcoal application shell on an oat page, with an editorial handover hero, a concise five-step workflow, the Meridian sample, and evidence panels only where review requires them. On narrow screens, all workflow controls remain reachable without horizontal page overflow.
- **Signature:** One quiet animated orbit in the successor card suggests knowledge moving between people. The surrounding status and copy remain readable without motion.
- **Motion:** Use short, eased entrances and one slow orbit. Keep data transitions subtle, preserve stable control geometry, and honor `prefers-reduced-motion`.

## Product language and trust

- Use `Sourced`, `Quote-only`, `Inferred`, `Stated by`, `Confirmed by`, `Possible conflict`, `Superseded`, and `Missing` as the evidence vocabulary. Never call a claim “Verified.”
- Keep synthetic Meridian content visibly framed as a demo. Do not imply hosted integrations, production access checks, or publication before the reviewer gate passes.
- Reader views never expose restricted item counts, hidden stubs, or restricted content. An unavailable answer uses the exact copy in `UX-CONTRACT.md`.
- Keep “zero canaries” claims tied to an explicit reader and seed test result. Do not show an unmeasured accuracy percentage.

## Accessibility and resilience

- Native buttons perform actions; anchors navigate. All controls have visible focus, hover, pressed and disabled states.
- Status changes use a persistent live region. Forms retain user input on recoverable errors.
- Scrollbars remain visible, usable, and themed at the document level. Forced-colors mode keeps system affordances.
- Images and motion are non-essential. Reduced-motion users receive the same content and state changes without travel or reveal animation.

## Anti-references

No fabricated “recent activity,” invented project portfolio, fake accuracy dashboard, security theater, hover-only controls, or motion on every element. Keep the Meridian sample coherent and explicitly synthetic.
