/* 3D cascading project dock and PRD dossier (landing page). */
// =========================================================================
// 8 CASCADING DOCK PROJECTS (MATCHING PRD SPECIFICATIONS & USER ATTACHMENT)
// =========================================================================
const DOCK_PROJECTS = [
  {
    id: 'cosmic',
    index: 0,
    brand: 'COSMIC',
    headline: 'COSMIC // AI Core',
    subtitle: 'Model Router & Prompt Guardrails Handover',
    leaver: 'Devika Nair',
    incoming: 'Rohan V.',
    sourcedRate: '94%',
    claimsCount: 14,
    conflictsCount: 0,
    canariesCount: 0,
    cssClass: 'dock-cosmic',
    stats: { steps: '5 steps', features: '10 core', roles: '3 roles', sourced: '94%' },
    claims: [
      { id: 'CLM-C01', type: 'decision', topic: 'Prompt Guardrails Schema', label: 'Sourced', lblClass: 'lbl-sourced', stmt: 'Router responses must conform to strict JSON-schema definition before output parsing.', quote: 'Router responses must conform to strict JSON-schema definition before output parsing.', source: 'System Router PR #19' },
      { id: 'CLM-C02', type: 'risk', topic: 'Temperature Lockout', label: 'Sourced', lblClass: 'lbl-sourced', stmt: 'Temperature locked at 0.1 for high-stakes routing classification pipelines.', quote: 'Temperature locked at 0.1 for high-stakes routing classification pipelines.', source: 'Architecture Sync Note' },
      { id: 'CLM-C03', type: 'owner', topic: 'Guardrail Test Suite', label: 'Inferred', lblClass: 'lbl-inferred', stmt: 'Devika Nair authored 88% of router guardrail and prompt injection test suites.', quote: 'Devika Nair authored 42 of 48 commits in /core/guardrails.', source: 'Git Activity Analyzer' },
      { id: 'CLM-C04', type: 'next_action', topic: 'Emergency Token Rotation', label: 'Stated by Devika, 14 Oct', lblClass: 'lbl-stated', stmt: 'Rotate internal provider router token before staging deployment on Friday.', quote: 'Direct statement by departing lead Devika Nair.', source: 'Leaver Exit Note' }
    ]
  },
  {
    id: 'precision',
    index: 1,
    brand: 'PRECISION LABS',
    headline: 'Precision CNC Parts',
    subtitle: 'Embedded Firmware & Spindle Telemetry Ledger',
    leaver: 'Siddharth M.',
    incoming: 'Ananya K.',
    sourcedRate: '89%',
    claimsCount: 19,
    conflictsCount: 1,
    canariesCount: 0,
    cssClass: 'dock-precision',
    stats: { steps: '5 steps', features: '10 core', roles: '4 roles', sourced: '89%' },
    claims: [
      { id: 'CLM-P01', type: 'decision', topic: 'Spindle Telemetry Baud Rate', label: 'Possible conflict', lblClass: 'lbl-conflict', stmt: 'Baud rate set to 115200 on v1.2 controllers vs 921600 on v2.0 telemetry bus.', quote: 'Baud rate 115200 on v1.2 controllers vs 921600 on v2.0 telemetry bus.', source: 'Firmware Spec vs Slack Chat' },
      { id: 'CLM-P02', type: 'dependency', topic: 'CAN Bus Isolation', label: 'Sourced', lblClass: 'lbl-sourced', stmt: 'CAN bus optocoupler isolation must remain active during spindle acceleration cycles.', quote: 'CAN bus optocoupler isolation must remain active during spindle acceleration cycles.', source: 'Hardware Runbook' },
      { id: 'CLM-P03', type: 'contact', topic: 'Motor Driver Vendor Lead', label: 'Missing', lblClass: 'lbl-missing', stmt: 'No answer found in your view. It may be undocumented or restricted', quote: 'Checklist gap detector: no supplier contact listed for stepper IC driver.', source: 'Handover Checklist' },
      { id: 'CLM-P04', type: 'owner', topic: 'Firmware Flash Scripts', label: 'Inferred', lblClass: 'lbl-inferred', stmt: 'Siddharth M. maintained all automated flashing harnesses in /firmware/tools.', quote: 'Siddharth M. authored 29 of 32 tool commits.', source: 'Git History' }
    ]
  },
  {
    id: 'modular',
    index: 2,
    brand: 'MODULAR AUDIO',
    headline: 'Modular Sound, Bold Design.',
    subtitle: 'Low-Latency DSP WebAudio Synth Pipeline',
    leaver: 'Kabir Das',
    incoming: 'Tara Sen',
    sourcedRate: '91%',
    claimsCount: 12,
    conflictsCount: 0,
    canariesCount: 0,
    cssClass: 'dock-modular',
    stats: { steps: '5 steps', features: '10 core', roles: '3 roles', sourced: '91%' },
    claims: [
      { id: 'CLM-M01', type: 'decision', topic: 'AudioBuffer Quantum Size', label: 'Sourced', lblClass: 'lbl-sourced', stmt: 'AudioWorklet processing quantum locked at 128 frames for sub-5ms latency.', quote: 'AudioWorklet processing quantum locked at 128 frames for sub-5ms latency.', source: 'DSP Engine Architecture' },
      { id: 'CLM-M02', type: 'risk', topic: 'Wasm Memory Garbage Collection', label: 'Sourced', lblClass: 'lbl-sourced', stmt: 'Avoid dynamic JS object allocations inside the DSP rendering loop to prevent glitch clicks.', quote: 'Avoid dynamic JS object allocations inside the DSP rendering loop.', source: 'Audio Performance Doc' },
      { id: 'CLM-M03', type: 'owner', topic: 'Wavetable Generator Engine', label: 'Inferred', lblClass: 'lbl-inferred', stmt: 'Kabir Das developed 95% of wavetable interpolation routines in /dsp/tables.', quote: '38 of 40 commits in /dsp/tables by Kabir Das.', source: 'Repository Analytics' }
    ]
  },
  {
    id: 'silicon',
    index: 3,
    brand: '+se',
    headline: 'Scaling chips down to their physical limits',
    subtitle: 'VLSI Timing Closure & Verification Harness',
    leaver: 'Arjun Rao',
    incoming: 'Neha Gupta',
    sourcedRate: '96%',
    claimsCount: 22,
    conflictsCount: 0,
    canariesCount: 0,
    cssClass: 'dock-silicon',
    stats: { steps: '5 steps', features: '10 core', roles: '4 roles', sourced: '96%' },
    claims: [
      { id: 'CLM-S01', type: 'decision', topic: 'Setup Slack Budget', label: 'Sourced', lblClass: 'lbl-sourced', stmt: 'Worst negative slack must remain above +12ps at the 0.75V slow-slow corner.', quote: 'Worst negative slack must remain above +12ps at the 0.75V slow-slow corner.', source: 'Timing Closure Report' },
      { id: 'CLM-S02', type: 'dependency', topic: 'Standard Cell Library', label: 'Sourced', lblClass: 'lbl-sourced', stmt: 'Synthesis links against 7nm FinFET PDK v3.1 tracks exclusively.', quote: 'Synthesis links against 7nm FinFET PDK v3.1 tracks exclusively.', source: 'EDA Synthesis Makefile' },
      { id: 'CLM-S03', type: 'risk', topic: 'Clock Tree Skew', label: 'Sourced', lblClass: 'lbl-sourced', stmt: 'CTS skew target tightened to 15ps across memory macro boundaries.', quote: 'CTS skew target tightened to 15ps across memory macro boundaries.', source: 'Clock Tree Constraint File' }
    ]
  },
  {
    id: 'hyve',
    index: 4,
    brand: 'HYVE:SYSTEMS',
    headline: 'Autonomous Cluster Mesh & Zero-Trust Ingress',
    subtitle: 'Kubernetes Multi-Region Service Handover',
    leaver: 'Vikramaditya S.',
    incoming: 'Karan Mehta',
    sourcedRate: '88%',
    claimsCount: 16,
    conflictsCount: 2,
    canariesCount: 0,
    cssClass: 'dock-hyve',
    stats: { steps: '5 steps', features: '10 core', roles: '4 roles', sourced: '88%' },
    claims: [
      { id: 'CLM-H01', type: 'decision', topic: 'mTLS Strict Mode', label: 'Sourced', lblClass: 'lbl-sourced', stmt: 'Istio PeerAuthentication set to STRICT across all production namespaces.', quote: 'Istio PeerAuthentication set to STRICT across all production namespaces.', source: 'Ingress Mesh Manifest' },
      { id: 'CLM-H02', type: 'risk', topic: 'Cross-Region Latency Failover', label: 'Possible conflict', lblClass: 'lbl-conflict', stmt: 'Route53 failover TTL set to 10s (Runbook) vs 60s (Terraform live state).', quote: 'Route53 failover TTL set to 10s vs 60s.', source: 'Runbook vs Terraform State' },
      { id: 'CLM-H03', type: 'contact', topic: 'Cloud Escrow SLA Contact', label: 'Missing', lblClass: 'lbl-missing', stmt: 'No answer found in your view. It may be undocumented or restricted', quote: 'Checklist gap: no designated cloud TAM listed for disaster recovery failover.', source: 'Handover Checklist' }
    ]
  },
  {
    id: 'meridian',
    index: 5,
    brand: 'MERIDIAN // CORTEX BU',
    headline: 'Meridian Campus App',
    subtitle: 'Synthetic campus-app handover · primary demo',
    leaver: 'Aarav Sharma',
    incoming: 'Meera Nair',
    sourcedRate: '92%',
    claimsCount: 8,
    conflictsCount: 1,
    canariesCount: 0,
    cssClass: 'dock-meridian',
    isPrimaryDemo: true,
    stats: { steps: '5 steps', features: '10 core', roles: '4 roles', sourced: '92%' },
    claims: [
      { id: 'CLM-101', type: 'decision', topic: 'Payment Webhook Retries', label: 'Sourced', lblClass: 'lbl-sourced', stmt: 'Payment webhook retries stay switched off until vendor fixes duplicate events in their v2.4 sandbox.', quote: 'Payment webhook retries stay switched off until vendor fixes duplicate events in their v2.4 sandbox.', source: 'GitHub • PR #48 review note by Aarav Sharma' },
      { id: 'CLM-102', type: 'owner', topic: 'Production Deployments', label: 'Possible conflict', lblClass: 'lbl-conflict', stmt: 'Aarav owns production deployments (Aug 28 task board) vs. Karan handles deploys starting Oct 3 (team chat).', quote: 'Karan handles deploys starting today for the production cluster.', source: 'Q3 Task Board (Aug 28) vs Engineering Chat (Oct 3)' },
      { id: 'CLM-103', type: 'contact', topic: 'Razorpay Vendor Escalation Contact', label: 'Missing', lblClass: 'lbl-missing', stmt: 'No answer found in your view. It may be undocumented or restricted', quote: 'No connected source names an account manager or support thread for the Razorpay v2.4 webhook bug.', source: 'Handover Completeness Checklist' },
      { id: 'CLM-104', type: 'owner', topic: 'Billing Module Ownership', label: 'Inferred', lblClass: 'lbl-inferred', stmt: 'Aarav wrote most of the billing module (47 of 52 commits and 14 of 15 PR reviews in /services/billing).', quote: 'Aarav Sharma authored 47 of 52 commits (90.4%) and 14 of 15 PR reviews between Jul–Oct 2026.', source: 'GitHub commit & review activity' },
      { id: 'CLM-105', type: 'risk', topic: 'Redis Session Lock Timeout', label: 'Sourced', lblClass: 'lbl-sourced', stmt: 'Redis session TTL must remain at 3600s on port 6379; lowering it breaks checkout locks during peak hostel meal registration windows.', quote: 'Redis session TTL must remain at 3600s on port 6379; lowering it breaks checkout locks.', source: 'Architecture Sync Notes (12 Sep)' },
      { id: 'CLM-106', type: 'decision', topic: 'Club Treasury & Escrow Governance', label: 'Sourced', lblClass: 'lbl-sourced', stmt: 'Emergency club reserve of INR 1,40,000 is held in Razorpay escrow; post-10 Oct deploy rights require Treasurer co-sign.', quote: '1. Emergency club reserve of INR 1,40,000 is held in the Razorpay escrow account... 2. Requires Treasurer co-sign.', source: 'Confidential Note (treasurer_only)' },
      { id: 'CLM-107', type: 'next_action', topic: 'Staging Webhook Signing Secret', label: 'Stated by Aarav, 14 Oct', lblClass: 'lbl-stated', stmt: 'Rotate the staging webhook signing secret before Friday’s campus demo and update the worker node.', quote: 'Typed directly by departing lead Aarav Sharma during pre-exit handover check-in.', source: 'Aarav Sharma (Exit Note)' },
      { id: 'CLM-108', type: 'dependency', topic: 'Campus DNS & Load Balancer Routing', label: 'Sourced', lblClass: 'lbl-sourced', stmt: 'Production traffic on api.meridian.bu.edu routes through the campus AWS ALB configured by Karan.', quote: 'Pointed api.meridian.bu.edu to campus AWS ALB.', source: 'Q3 Engineering Task Board #TSK-92' }
    ]
  },
  {
    id: 'archon',
    index: 6,
    brand: 'archon',
    headline: '● Sell Your Software To Enterprise Buyers',
    subtitle: 'M&A Escrow Verification & License Provisioning API',
    leaver: 'Rishi Kapoor',
    incoming: 'Sanya Malhotra',
    sourcedRate: '90%',
    claimsCount: 11,
    conflictsCount: 1,
    canariesCount: 0,
    cssClass: 'dock-archon',
    stats: { steps: '5 steps', features: '10 core', roles: '3 roles', sourced: '90%' },
    claims: [
      { id: 'CLM-A01', type: 'decision', topic: 'License Revocation Webhook', label: 'Sourced', lblClass: 'lbl-sourced', stmt: 'Enterprise license keys expire immediately on contract termination webhook.', quote: 'Enterprise license keys expire immediately on contract termination webhook.', source: 'API Provisioning Contract' },
      { id: 'CLM-A02', type: 'risk', topic: 'Escrow Key Sharding', label: 'Possible conflict', lblClass: 'lbl-conflict', stmt: 'Shamir secret shares 3-of-5 required (Docs) vs 2-of-3 configured in KMS.', quote: 'Shamir secret shares 3-of-5 required vs 2-of-3.', source: 'Security Audit vs Cloud KMS' },
      { id: 'CLM-A03', type: 'owner', topic: 'Customer Auth Endpoints', label: 'Inferred', lblClass: 'lbl-inferred', stmt: 'Rishi Kapoor authored 92% of enterprise SSO connector code.', quote: '31 of 34 commits in /services/sso by Rishi Kapoor.', source: 'Git Repository Analyzer' }
    ]
  },
  {
    id: 'sentinel',
    index: 7,
    brand: 'SENTINEL // VERIFIER',
    headline: 'AI-POWERED PLAN REVIEW',
    subtitle: 'Deterministic Quote Guard, Canary Leak & Mutation Suite',
    leaver: 'Saiyam A.',
    incoming: 'Anushka V.',
    sourcedRate: '100%',
    claimsCount: 24,
    conflictsCount: 0,
    canariesCount: 0,
    cssClass: 'dock-sentinel',
    stats: { steps: '5 steps', features: '10 core', roles: '4 roles', sourced: '100%' },
    claims: [
      { id: 'CLM-T01', type: 'decision', topic: 'Exact-Token Guard Rules', label: 'Sourced', lblClass: 'lbl-sourced', stmt: 'Zero false accepts on 100 programmatic digit, identifier and negation mutations.', quote: 'Zero false accepts on 100 programmatic digit, identifier and negation mutations.', source: 'Sentinel Verification CI Suite' },
      { id: 'CLM-T02', type: 'risk', topic: 'Differential Leak Check', label: 'Sourced', lblClass: 'lbl-sourced', stmt: 'Rebuilding view with hidden claim produces byte-identical model inputs and outputs.', quote: 'Rebuilding view with hidden claim produces byte-identical output.', source: 'Differential Test Runner' },
      { id: 'CLM-T03', type: 'owner', topic: 'Canary Generator', label: 'Sourced', lblClass: 'lbl-sourced', stmt: 'Zero planted canary secrets leaked across 4 reader roles and 3 distinct random seeds.', quote: 'Zero planted canary secrets leaked across 4 reader roles and 3 seeds.', source: 'PRD Section 17 & 18 Verification' }
    ]
  }
];

// Meridian is the working sample. The other seven files are illustrative examples of the
// same handover format: they are labelled as such and never presented as live results.
const meridianSample = DOCK_PROJECTS.find(project => project.id === 'meridian');
Object.assign(meridianSample, {
  sourcedRate: 'WORKING SAMPLE',
  claimsCount: 0,
  conflictsCount: 0,
  canariesCount: null,
  stats: { steps: '5 steps', features: '10 core', roles: '3 reader views', sourced: 'Not run' },
  claims: []
});
DOCK_PROJECTS.forEach(p => { p.illustrative = p.id !== 'meridian'; });

let currentHoverIndex = meridianSample.index;
let currentSelectedProject = 'meridian';

const landing = document.getElementById('landing');
const detail = document.getElementById('detail');
const dockStage = document.getElementById('dockStage');
const dockCounter = document.getElementById('dockCounter');
const dockPillSelector = document.getElementById('dockPillSelector');
const projectSwitcher = document.getElementById('projectSwitcher');
const dockSection = document.getElementById('dockSection');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Clip the bottom of resting files instead of animating height: clip-path and
// transforms stay off the layout path, so the stack moves at full frame rate.
const CLIP_REST = 'inset(-40px -40px 130px -40px)';
const CLIP_OPEN = 'inset(-40px -40px -40px -40px)';
let dockCards = [];
let dockPills = [];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function poseFor(idx, active) {
  const isActive = idx === active;
  const isBefore = idx < active;
  return {
    y: isActive ? -95 : (isBefore ? -12 : 52),
    z: isActive ? 60 : (isBefore ? -idx * 3 : 10),
    rotationX: isActive ? 0 : (isBefore ? -14 : -12),
    scale: isActive ? 1.035 : 1,
    clipPath: isActive ? CLIP_OPEN : CLIP_REST,
    zIndex: isActive ? 60 : 10 + idx
  };
}

function cardMarkup(proj) {
  const flag = proj.illustrative
    ? '<span class="dock-illustrative">ILLUSTRATIVE</span>'
    : '<span class="dock-sample-flag">★ WORKING SAMPLE</span>';
  const metrics = proj.illustrative
    ? [['Example ledger', proj.claimsCount + ' example claims'], ['Example conflicts', proj.conflictsCount + ' flagged'], ['Status', 'Illustrative · not live']]
    : [['Synthetic source set', '6 Meridian sources'], ['Current pipeline', 'Run it in the Studio'], ['Persistence & access', 'Browser demo · simulated']];
  return `
    <div class="dock-card-tab">
      <div class="dock-brand-pill"><span class="dock-dot"></span><span>${esc(proj.brand)}</span>${flag}</div>
      <div class="dock-meta"><span>${esc(proj.leaver)} → ${esc(proj.incoming)}</span></div>
    </div>
    <div class="dock-card-body">
      <div class="dock-peek">
        <div>
          <h3 class="dock-title">${esc(proj.headline)}</h3>
          <p class="dock-sub">${esc(proj.subtitle)}</p>
        </div>
        <button class="dock-open-btn" type="button" data-open="${esc(proj.id)}">
          <span>${proj.illustrative ? 'View example' : 'Open spec'}</span> ↗
        </button>
      </div>
      <div class="dock-expanded">
        <div class="dock-metrics">
          ${metrics.map(m => `<div class="dock-metric-box"><div class="dock-metric-label">${esc(m[0])}</div><div class="dock-metric-val">${esc(m[1])}</div></div>`).join('')}
        </div>
        <div class="dock-drawer-foot">
          <span>Departing: <strong>${esc(proj.leaver)}</strong> → Successor: <strong>${esc(proj.incoming)}</strong></span>
          <span>${proj.illustrative ? 'Example of the format, not live data' : 'Open the spec, then run it in the Studio →'}</span>
        </div>
      </div>
    </div>`;
}

// Build the stack once. Later state changes only move it.
function buildDock() {
  dockStage.innerHTML = '';
  dockPillSelector.innerHTML = '';
  dockCards = DOCK_PROJECTS.map((proj, idx) => {
    const card = document.createElement('div');
    card.className = `dock-card ${proj.cssClass}`;
    card.dataset.idx = idx;
    card.style.width = `${60 + idx * 5.1}%`;
    card.style.top = `${105 + idx * 40}px`; // 105px headroom so a lifted first file clears the top bar
    card.innerHTML = cardMarkup(proj);
    card.addEventListener('pointerenter', e => onCardEnter(e, idx));
    card.addEventListener('pointerleave', cancelHoverIntent);
    card.addEventListener('click', e => {
      if (idx !== currentHoverIndex) { setActive(idx); return; } // first tap lifts, second opens
      openProjectDossier(proj.id, card);
    });
    card.querySelector('[data-open]').addEventListener('click', e => {
      e.stopPropagation();
      openProjectDossier(proj.id, card);
    });
    dockStage.appendChild(card);

    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'dock-pill-btn';
    pill.textContent = `${idx + 1}. ${proj.brand.split(' ')[0]}`;
    pill.setAttribute('aria-label', `${proj.headline}${proj.illustrative ? ' (illustrative example)' : ' (working sample)'}`);
    pill.addEventListener('pointerenter', () => setActive(idx));
    pill.addEventListener('focus', () => setActive(idx));
    pill.addEventListener('click', () => openProjectDossier(proj.id, dockCards[idx]));
    dockPillSelector.appendChild(pill);
    return card;
  });
  dockPills = Array.from(dockPillSelector.children);
  layoutDock(false);
}

function layoutDock(animate) {
  const gsap = window.gsap;
  const moving = animate && gsap && !reduceMotion.matches;
  dockCards.forEach((card, idx) => {
    const p = poseFor(idx, currentHoverIndex);
    const isActive = idx === currentHoverIndex;
    card.classList.toggle('active', isActive);
    card.style.zIndex = p.zIndex;
    const vars = { y: p.y, z: p.z, rotationX: p.rotationX, scale: p.scale, clipPath: p.clipPath, force3D: true };
    if (moving) {
      gsap.to(card, Object.assign(vars, { duration: 0.62, ease: 'expo.out', overwrite: 'auto' }));
    } else if (gsap) {
      gsap.set(card, vars);
    } else {
      card.style.transform = `translate3d(0, ${p.y}px, ${p.z}px) rotateX(${p.rotationX}deg) scale(${p.scale})`;
      card.style.clipPath = p.clipPath;
    }
    const drawer = card.querySelector('.dock-expanded');
    if (isActive && moving) {
      gsap.fromTo(drawer, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4, delay: 0.12, ease: 'power3.out', overwrite: 'auto' });
    } else if (gsap) {
      gsap.set(drawer, { clearProps: 'opacity,visibility,transform' });
    }
  });
  dockPills.forEach((pill, idx) => {
    const on = idx === currentHoverIndex;
    pill.classList.toggle('active', on);
    if (on) pill.setAttribute('aria-current', 'true'); else pill.removeAttribute('aria-current');
  });
  const pad = n => String(n).padStart(2, '0');
  dockCounter.textContent = `${pad(currentHoverIndex + 1)} / ${pad(DOCK_PROJECTS.length)} · ${DOCK_PROJECTS[currentHoverIndex].illustrative ? 'EXAMPLE' : 'WORKING SAMPLE'}`;
}

function setActive(idx) {
  idx = Math.max(0, Math.min(DOCK_PROJECTS.length - 1, idx));
  if (idx === currentHoverIndex) return;
  currentHoverIndex = idx;
  layoutDock(true);
}

// Kept for older callers (router, keyboard).
function renderDock() { if (!dockCards.length) buildDock(); else layoutDock(false); }
function updateDockState() { layoutDock(true); }

// Hover intent: a card that slides under a still pointer must not steal focus
// (that feedback loop made the stack jitter). Only real pointer movement counts.
let lastPointerMove = 0;
let hoverTimer = null;
dockStage.addEventListener('pointermove', () => { lastPointerMove = performance.now(); }, { passive: true });
function onCardEnter(e, idx) {
  if (e.pointerType === 'touch') return;
  cancelHoverIntent();
  if (performance.now() - lastPointerMove > 90) return;
  hoverTimer = setTimeout(() => setActive(idx), 60);
}
function cancelHoverIntent() { clearTimeout(hoverTimer); }

// Wheel: one file per gesture notch, throttled; page scroll resumes at either end.
let wheelAcc = 0;
let wheelLockUntil = 0;
dockSection.addEventListener('wheel', e => {
  const dir = Math.sign(e.deltaY);
  const canMove = dir > 0 ? currentHoverIndex < DOCK_PROJECTS.length - 1 : currentHoverIndex > 0;
  if (!dir || !canMove) { wheelAcc = 0; return; } // at either end the page (Lenis) scrolls normally
  e.preventDefault();
  e.stopPropagation(); // the dock consumed this notch, so the smooth scroller must not see it
  const now = performance.now();
  wheelAcc += e.deltaY;
  if (now < wheelLockUntil || Math.abs(wheelAcc) < 40) return;
  wheelAcc = 0;
  wheelLockUntil = now + 170;
  setActive(currentHoverIndex + dir);
}, { passive: false });

// Keyboard: arrows step through files on the workspace view, Enter opens, Escape goes back.
window.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable], dialog')) return;
  if (!landing.classList.contains('hide')) {
    const dockVisible = dockSection.getBoundingClientRect().top < window.innerHeight;
    if (!dockVisible) return;
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(currentHoverIndex - 1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(currentHoverIndex + 1); }
    else if (e.key === 'Enter' && e.target === document.body) {
      e.preventDefault();
      const proj = DOCK_PROJECTS[currentHoverIndex];
      if (proj) openProjectDossier(proj.id, dockCards[currentHoverIndex]);
    }
  } else if (e.key === 'Escape' && detail.classList.contains('show')) {
    closeProjectDossier();
  }
});

// OPEN PROJECT DOSSIER ACCORDING TO PRD
function renderDossier(projectId) {
  const proj = DOCK_PROJECTS.find(p => p.id === projectId) || DOCK_PROJECTS[0];
  currentSelectedProject = proj.id;
  currentHoverIndex = proj.index;
  projectSwitcher.value = proj.id;

  // Update Detail Header
  document.getElementById('detailEyebrow').textContent = `PROJECT DOSSIER · ${proj.brand} · PRD SPECIFICATION`;
  document.getElementById('detailTitle').innerHTML = `${proj.headline}<span style="color:var(--mint)">.</span>`;
  document.getElementById('detailLede').innerHTML = proj.illustrative
    ? `<b>Illustrative example:</b> <b>${esc(proj.leaver)}</b> → <b>${esc(proj.incoming)}</b> · ${esc(proj.subtitle)}. This file shows the handover format with example claims; it is not connected to live data.`
    : `<b>Synthetic Meridian demo:</b> <b>${esc(proj.leaver)}</b> → <b>${esc(proj.incoming)}</b>. Start the Studio to reconstruct claims from the six sample sources. No accuracy or leak result is assumed before running the checks.`;
  const banner = document.getElementById('illustrativeBanner');
  if (banner) banner.hidden = !proj.illustrative;

  // Update Hero Stats
  document.getElementById('statSteps').textContent = proj.stats.steps;
  document.getElementById('statFeatures').textContent = proj.stats.features;
  document.getElementById('statRoles').textContent = proj.stats.roles;
  document.getElementById('statSourced').textContent = proj.stats.sourced;

  // Update Active Project Dossier Claims
  document.getElementById('dossierTitle').textContent = `Meridian handover: ${proj.headline}`;
  document.getElementById('dossierPill').textContent = `${proj.leaver.toUpperCase()} → ${proj.incoming.toUpperCase()}`;

  const claimsContainer = document.getElementById('dossierClaimsGrid');
  claimsContainer.innerHTML = '';
  proj.claims.forEach(c => {
    const card = document.createElement('div');
    card.className = 'claim-card';
    card.innerHTML = `
      <div class="claim-card-top">
        <span class="claim-label ${c.lblClass}">${c.label}</span>
        <span style="font:9px 'DM Mono',monospace;color:var(--muted)">${c.id} · ${c.type}</span>
      </div>
      <p class="claim-stmt">${c.stmt}</p>
      <div class="claim-quote">
        ${c.label === 'Missing' ? '<span style="color:#B4462F">' + c.quote + '</span>' : 'Source: ' + c.source + ' — <mark>“' + c.quote + '”</mark>'}
      </div>
    `;
    claimsContainer.appendChild(card);
  });
  if (!proj.claims.length) {
    const empty = document.createElement('p');
    empty.className = 'dossier-empty';
    empty.textContent = 'Claims appear here after you reconstruct the Meridian sample in the Handover Studio.';
    claimsContainer.appendChild(empty);
  }

}

function openProjectDossier(projectId, sourceEl) {
  // The lifted file morphs into the dossier header (view transition, js/app.js).
  document.querySelectorAll('.dock-card').forEach(c => { c.style.viewTransitionName = ''; });
  if (sourceEl && 'startViewTransition' in document) sourceEl.style.viewTransitionName = 'dossier-hero';
  location.hash = '#/spec/' + projectId;
}
function closeProjectDossier() { location.hash = '#/'; }

document.getElementById('backBtn').addEventListener('click', closeProjectDossier);

// Tab Navigation inside Detail
document.querySelectorAll('#detailNav button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#detailNav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById(btn.dataset.target);
    if (window.BatonSpec) { window.BatonSpec.select(btn.dataset.target); return; }
    if (target) { if (window.BatonScroll) window.BatonScroll.to(target); else target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});

// Initialize Dock on page load
buildDock();