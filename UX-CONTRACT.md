# Baton UI behavior contract

This contract covers the synthetic Meridian prototype only. UI role switching is a demonstration of intended views, not production authorization.

## Canonical owners

| Capability | Owner | Decision |
|---|---|---|
| Navigation | Hash routes in `js/app.js` | Workspace, Studio step, and Meridian spec are anchor routes; current route exposes `aria-current`. |
| Workflow stepper | `BatonStudio.goStep` | Connect → Reconstruct → Verify → Review → Handover; steps are buttons and route state is shareable. |
| Inputs and selects | Native HTML controls | Keep browser keyboard and popup behavior; labels remain visible and connected. |
| Notices | `#toast` live region | Use for brief action feedback; field-specific recovery stays next to the field. |
| Confirmation dialog | Native `<dialog>` in `index.html` | Used for studio reset and handover retraction; Escape cancels and focus returns to the invoking control. |
| Reader view | `BatonEngine.computeView` via `js/studio.js` | All reader-facing content is derived from the selected persona. Hidden and missing items produce the same gap wording. |
| Review/publish gate | `BatonStudio` state and `gate()` | A handover remains unavailable until all review conditions pass. Disabled publish actions explain outstanding requirements. |
| Scrollbars | Global application styles in `css/polish.css` | Visible and themed; forced-colors restores system colors. |

## Required language and state

- Unavailable answer: **“No answer found in your view. It may be undocumented or restricted”**. Offer `Request access`; do not reveal why it is unavailable.
- Reader switching is labeled as a prototype view. Do not describe it as enforced authorization.
- Import previews use synthetic Meridian data only and identify the prototype as browser-only with no connected production services.
- A claim is reviewed individually or covered by the documented low-risk sample/bulk rule. Publish remains blocked until every gate item is satisfied.
- Keep the same action verb from control to feedback, e.g. `Mark reviewed` → `Marked reviewed`.

## Interaction baseline

Use semantic buttons and links, visible focus, touch-sized targets for primary actions, stable geometry during state changes, and `aria-live` for asynchronous/short feedback. Respect reduced motion. Never use `alert`, `confirm`, or `prompt` for product flows.
