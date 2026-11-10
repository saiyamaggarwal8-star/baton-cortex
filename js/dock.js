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
    headline: 'Meridian Campus Backend, NY/BU',
    subtitle: 'Billing Webhooks, Redis Locks & Escrow Governance (Primary Demo)',
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

let currentHoverIndex = 5; // Default focused on Meridian (Index 5)
let currentSelectedProject = 'meridian';

const landing = document.getElementById('landing');
const detail = document.getElementById('detail');
const dockStage = document.getElementById('dockStage');
const dockCounter = document.getElementById('dockCounter');
const dockPillSelector = document.getElementById('dockPillSelector');
const projectSwitcher = document.getElementById('projectSwitcher');

// Render 3D Cascading File Dock
function renderDock() {
  dockStage.innerHTML = '';
  dockPillSelector.innerHTML = '';

  DOCK_PROJECTS.forEach((proj, idx) => {
    const isHovered = currentHoverIndex === idx;
    const isBefore = idx < currentHoverIndex;
    const isAfter = idx > currentHoverIndex;

    // Physical File Pull-Out Animation:
    // Hovered file pulls UP by -95px, forward +60px, straightens to 0deg, scales 1.035
    // Files before tuck back (-12px)
    // Files after drop down (+52px) so lifted sheet is unobstructed!
    const pullY = isHovered ? -95 : (isBefore ? -12 : 52);
    const transZ = isHovered ? 60 : (isBefore ? -idx * 3 : 10);
    const rotX = isHovered ? 0 : (isBefore ? -14 : -12);
    const zIdx = isHovered ? 60 : 10 + idx;
    const heightPx = isHovered ? 250 : 120;
    const widthPct = 60 + (idx * 5.1);
    const topPx = 25 + (idx * 40);

    const card = document.createElement('div');
    card.className = `dock-card ${proj.cssClass} ${isHovered ? 'active' : (isBefore ? 'before-active' : 'after-active')}`;
    card.style.width = `${widthPct}%`;
    card.style.top = `${topPx}px`;
    card.style.transform = `translate3d(0, ${pullY}px, ${transZ}px) rotateX(${rotX}deg) scale(${isHovered ? 1.035 : 1})`;
    card.style.zIndex = zIdx;
    card.style.height = `${heightPx}px`;

    card.innerHTML = `
      <div class="dock-card-tab">
        <div class="dock-brand-pill">
          <span class="dock-dot"></span>
          <span>${proj.brand}</span>
          ${proj.isPrimaryDemo ? '<span class="dock-demo-flag">★ PRIMARY DEMO</span>' : ''}
        </div>
        <div class="dock-meta">
          <span>${proj.leaver} → ${proj.incoming}</span>
          <span class="dock-rate-badge">${proj.sourcedRate} Sourced</span>
        </div>
      </div>
      <div class="dock-card-body">
        <div class="dock-peek">
          <div>
            <h3 class="dock-title">${proj.headline}</h3>
            <p class="dock-sub">${proj.subtitle}</p>
          </div>
          <button class="dock-open-btn" onclick="event.stopPropagation(); openProjectDossier('${proj.id}')">
            <span>Open PRD File</span> ↗
          </button>
        </div>

        <div class="dock-expanded">
          <div class="dock-metrics">
            <div class="dock-metric-box">
              <div class="dock-metric-label">Verified Ledger</div>
              <div class="dock-metric-val">${proj.claimsCount} Cited Claims</div>
            </div>
            <div class="dock-metric-box">
              <div class="dock-metric-label">Open Contradictions</div>
              <div class="dock-metric-val">${proj.conflictsCount === 0 ? '0 Conflicts' : proj.conflictsCount + ' Active Conflict'}</div>
            </div>
            <div class="dock-metric-box">
              <div class="dock-metric-label">Leak & Guard Suite</div>
              <div class="dock-metric-val">0 Canaries • 100%</div>
            </div>
          </div>
          <div class="dock-drawer-foot">
            <span>Departing: <strong>${proj.leaver}</strong> → Successor: <strong>${proj.incoming}</strong></span>
            <span style="text-decoration:underline">Click lifted sheet to open full PRD specification →</span>
          </div>
        </div>
      </div>
    `;

    card.addEventListener('mouseenter', () => {
      currentHoverIndex = idx;
      updateDockState();
    });

    card.addEventListener('click', () => {
      openProjectDossier(proj.id);
    });

    dockStage.appendChild(card);

    // Pill for bottom direct selector
    const pill = document.createElement('button');
    pill.className = `dock-pill-btn ${currentHoverIndex === idx ? 'active' : ''}`;
    pill.textContent = `${idx + 1}. ${proj.brand.split(' ')[0]}`;
    pill.addEventListener('mouseenter', () => {
      currentHoverIndex = idx;
      updateDockState();
    });
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      openProjectDossier(proj.id);
    });
    dockPillSelector.appendChild(pill);
  });

  dockCounter.textContent = `0${currentHoverIndex + 1} / 0${DOCK_PROJECTS.length} PROJECTS`;
}

function updateDockState() {
  renderDock();
}

// Mousewheel navigation inside dock
const dockSection = document.getElementById('dockSection');
dockSection.addEventListener('wheel', (e) => {
  // Only capture the scroll when the dock can actually move.
  if (e.deltaY > 15 && currentHoverIndex < DOCK_PROJECTS.length - 1) {
    e.preventDefault();
    currentHoverIndex++;
    updateDockState();
  } else if (e.deltaY < -15 && currentHoverIndex > 0) {
    e.preventDefault();
    currentHoverIndex--;
    updateDockState();
  }
}, { passive: false });

// Keyboard arrows navigation
window.addEventListener('keydown', (e) => {
  // Only on the landing view, never while typing.
  if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (!landing.classList.contains('hide')) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      currentHoverIndex = Math.max(0, currentHoverIndex - 1);
      updateDockState();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      currentHoverIndex = Math.min(DOCK_PROJECTS.length - 1, currentHoverIndex + 1);
      updateDockState();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const proj = DOCK_PROJECTS[currentHoverIndex];
      if (proj) openProjectDossier(proj.id);
    }
  } else if (e.key === 'Escape') {
    closeProjectDossier();
  }
});

// OPEN PROJECT DOSSIER ACCORDING TO PRD
function renderDossier(projectId) {
  const proj = DOCK_PROJECTS.find(p => p.id === projectId) || DOCK_PROJECTS[5];
  currentSelectedProject = proj.id;
  currentHoverIndex = proj.index;
  projectSwitcher.value = proj.id;

  // Update Detail Header
  document.getElementById('detailEyebrow').textContent = `PROJECT DOSSIER · ${proj.brand} · PRD SPECIFICATION`;
  document.getElementById('detailTitle').innerHTML = `${proj.headline}<span style="color:var(--mint)">.</span>`;
  document.getElementById('detailLede').innerHTML = `<b>Knowledge Handover:</b> Departing Lead <b>${proj.leaver}</b> → Successor <b>${proj.incoming}</b>. A verifiable knowledge-handover ledger reconstructed strictly according to the Baton Product Requirements Document. Sourced accuracy: <b>${proj.sourcedRate}</b>, 0 canaries leaked.`;

  // Update Hero Stats
  document.getElementById('statSteps').textContent = proj.stats.steps;
  document.getElementById('statFeatures').textContent = proj.stats.features;
  document.getElementById('statRoles').textContent = proj.stats.roles;
  document.getElementById('statSourced').textContent = proj.stats.sourced;

  // Update Active Project Dossier Claims
  document.getElementById('dossierTitle').textContent = `Verified Claims Ledger: ${proj.headline}`;
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
        ${c.label === 'Missing' ? '<span style="color:#f87171">' + c.quote + '</span>' : 'Source: ' + c.source + ' — <mark>“' + c.quote + '”</mark>'}
      </div>
    `;
    claimsContainer.appendChild(card);
  });

}

function openProjectDossier(projectId) { location.hash = '#/spec/' + projectId; }
function closeProjectDossier() { location.hash = '#/'; }

document.getElementById('backBtn').addEventListener('click', closeProjectDossier);

// Tab Navigation inside Detail
document.querySelectorAll('#detailNav button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#detailNav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById(btn.dataset.target);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// Initialize Dock on page load
renderDock();
