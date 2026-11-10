/* Spec explorer: a CircularCarousel of the 11 PRD sections on the product spec page.
 * Instead of one long scroll, the reader spins to a section and opens it; only that
 * section is shown below. "Show all sections" and printing restore the full document.
 */
(function () {
  'use strict';
  const host = document.getElementById('specCarousel');
  const grid = document.querySelector('#detail .content-grid');
  if (!host || !grid || !window.CircularCarousel) return;

  const SECTIONS = [
    { id: 'overviewInfo', title: 'Overview', subtitle: 'Product, problem and the core rule', motif: 'rule' },
    { id: 'workflowInfo', title: 'Workflow', subtitle: 'Connect → Reconstruct → Verify → Review → Handover', motif: 'steps' },
    { id: 'featuresInfo', title: 'Features', subtitle: '10 core features and Round 3 improvements', motif: 'grid' },
    { id: 'claimsInfo', title: 'Claim system', subtitle: 'Claim types, fields and labels', motif: 'pills' },
    { id: 'securityInfo', title: 'Security', subtitle: 'Permissions, privacy and no existence leakage', motif: 'lock' },
    { id: 'architectureInfo', title: 'Architecture', subtitle: 'Pipeline and tech stack', motif: 'flow' },
    { id: 'dataInfo', title: 'Data & API', subtitle: '15 tables and 18 FastAPI endpoints', motif: 'table' },
    { id: 'demoInfo', title: 'Demo', subtitle: 'Synthetic Meridian project and benchmark', motif: 'target' },
    { id: 'teamInfo', title: 'Team & plan', subtitle: 'Ownership and strict build order', motif: 'people' },
    { id: 'doneInfo', title: 'Testing', subtitle: 'Tests, targets and definition of done', motif: 'check' },
    { id: 'scopeInfo', title: 'Scope', subtitle: 'Non-goals and honest wording rules', motif: 'bounds' }
  ].filter(s => document.getElementById(s.id));

  // Palette cycle: midnight, honey tangerine, butter cream, tangerine-soft.
  const THEMES = [
    { bg: '#22242F', fg: '#FCF4DD', accent: '#F28C38', muted: '#C8C2B0' },
    { bg: '#F28C38', fg: '#22242F', accent: '#FCF4DD', muted: '#5A2C05' },
    { bg: '#FCF4DD', fg: '#22242F', accent: '#F28C38', muted: '#635D4B' },
    { bg: '#FDE2C2', fg: '#22242F', accent: '#8F4609', muted: '#6B3A0E' }
  ];

  const xml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

  function motif(kind, a, m) {
    const g = (x) => `<g transform="translate(300 64)" fill="none" stroke="${a}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${x}</g>`;
    switch (kind) {
      case 'rule': return g(`<circle cx="50" cy="50" r="40"/><path d="M28 52l14 14 30-32"/>`);
      case 'steps': return g(`<circle cx="10" cy="80" r="7" fill="${a}"/><circle cx="35" cy="60" r="7" fill="${a}"/><circle cx="60" cy="40" r="7" fill="${a}"/><circle cx="85" cy="20" r="7" fill="${a}"/><path d="M10 80L85 20" stroke-dasharray="4 9"/>`);
      case 'grid': return g(`<rect x="8" y="8" width="36" height="36" rx="8"/><rect x="56" y="8" width="36" height="36" rx="8" fill="${a}"/><rect x="8" y="56" width="36" height="36" rx="8"/><rect x="56" y="56" width="36" height="36" rx="8"/>`);
      case 'pills': return g(`<rect x="4" y="12" width="92" height="22" rx="11"/><rect x="4" y="44" width="64" height="22" rx="11" fill="${a}"/><rect x="4" y="76" width="80" height="22" rx="11" stroke-dasharray="6 6"/>`);
      case 'lock': return g(`<rect x="16" y="44" width="68" height="52" rx="12"/><path d="M30 44V30a20 20 0 0 1 40 0v14"/><circle cx="50" cy="68" r="6" fill="${a}"/>`);
      case 'flow': return g(`<rect x="2" y="36" width="26" height="26" rx="6"/><rect x="38" y="36" width="26" height="26" rx="6" fill="${a}"/><rect x="74" y="36" width="26" height="26" rx="6"/><path d="M28 49h10M64 49h10"/>`);
      case 'table': return g(`<rect x="6" y="10" width="88" height="80" rx="10"/><path d="M6 34h88M6 58h88M38 10v80"/>`);
      case 'target': return g(`<circle cx="50" cy="50" r="42"/><circle cx="50" cy="50" r="26"/><circle cx="50" cy="50" r="9" fill="${a}"/>`);
      case 'people': return g(`<circle cx="32" cy="34" r="14"/><circle cx="70" cy="34" r="14" fill="${a}"/><path d="M8 90c4-20 44-20 48 0M48 90c4-20 44-20 48 0"/>`);
      case 'check': return g(`<rect x="8" y="8" width="84" height="84" rx="16"/><path d="M28 50l15 15 30-32"/>`);
      default: return g(`<rect x="8" y="8" width="84" height="84" rx="16" stroke-dasharray="8 8"/><circle cx="50" cy="50" r="10" fill="${a}"/>`);
    }
  }

  function wrapWords(text, max) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    words.forEach(w => {
      if ((line + ' ' + w).trim().length > max && line) { lines.push(line); line = w; }
      else line = (line + ' ' + w).trim();
    });
    if (line) lines.push(line);
    return lines.slice(0, 3);
  }

  function cover(section, index) {
    const t = THEMES[index % THEMES.length];
    const num = String(index + 1).padStart(2, '0');
    const sub = wrapWords(section.subtitle, 28);
    const font = "'Arial Black','Helvetica Neue',Arial,sans-serif";
    const body = "'Helvetica Neue',Arial,sans-serif";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="440" viewBox="0 0 440 440">
  <rect width="440" height="440" fill="${t.bg}"/>
  <circle cx="440" cy="440" r="150" fill="${t.accent}" opacity=".14"/>
  <text x="34" y="58" font-family="Courier New,monospace" font-size="18" letter-spacing="3" fill="${t.muted}">BATON · SPEC ${num}/${String(SECTIONS.length).padStart(2, '0')}</text>
  ${motif(section.motif, t.accent, t.muted)}
  <text x="28" y="262" font-family="${font}" font-weight="900" font-size="132" letter-spacing="-6" fill="${t.fg}">${num}</text>
  <text x="34" y="318" font-family="${font}" font-weight="900" font-size="38" letter-spacing="-1" fill="${t.fg}">${xml(section.title)}</text>
  ${sub.map((l, i) => `<text x="34" y="${354 + i * 26}" font-family="${body}" font-size="20" fill="${t.muted}">${xml(l)}</text>`).join('')}
</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  const items = SECTIONS.map((s, i) => ({
    src: cover(s, i),
    alt: `${String(i + 1).padStart(2, '0')} ${s.title}: ${s.subtitle}`,
    title: `${String(i + 1).padStart(2, '0')} · ${s.title}`,
    subtitle: s.subtitle
  }));

  const current = document.getElementById('specCurrent');
  const showAllBtn = document.getElementById('specShowAll');
  const nav = document.getElementById('detailNav');
  let selected = 0;

  function select(index, opts) {
    opts = opts || {};
    index = Math.max(0, Math.min(SECTIONS.length - 1, index));
    selected = index;
    grid.classList.add('spec-paged');
    if (showAllBtn) { showAllBtn.textContent = 'Show all sections'; showAllBtn.setAttribute('aria-pressed', 'false'); }
    SECTIONS.forEach((s, i) => document.getElementById(s.id).classList.toggle('is-current', i === index));
    if (current) current.textContent = items[index].title + ' — ' + SECTIONS[index].subtitle;
    if (nav) nav.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.target === SECTIONS[index].id));
    if (opts.spin !== false && carousel) carousel.focusIndex(index);
    const card = document.getElementById(SECTIONS[index].id);
    const motionOK = window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (motionOK && opts.animate !== false) window.gsap.fromTo(card, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'expo.out', clearProps: 'opacity,visibility,transform' });
    if (opts.reveal) {
      const top = card.getBoundingClientRect().top;
      if (top > window.innerHeight * 0.7 || top < 80) {
        if (window.BatonScroll) window.BatonScroll.to(card); else card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  function showAll() {
    const paged = grid.classList.toggle('spec-paged');
    if (showAllBtn) {
      showAllBtn.textContent = paged ? 'Show all sections' : 'Show one section';
      showAllBtn.setAttribute('aria-pressed', String(!paged));
    }
    if (current) current.textContent = paged ? items[selected].title + ' — ' + SECTIONS[selected].subtitle : 'All 11 sections';
  }

  const carousel = window.CircularCarousel.mount(host, {
    items,
    preset: 'cylinder',
    intro: 'rise',
    cardWidth: 220,
    aspectRatio: 1,
    speed: 14,
    captions: true,
    fadeColor: '#FFFAEC',
    innerShade: 0.45,
    cornerRadius: 18,
    ariaLabel: 'Product spec sections. Use left and right arrow keys to turn, Enter to open.',
    onItemClick: (item, index) => select(index, { spin: false, reveal: true })
  });

  if (showAllBtn) showAllBtn.addEventListener('click', showAll);
  window.BatonSpec = {
    select: id => { const i = SECTIONS.findIndex(s => s.id === id); if (i >= 0) select(i, { reveal: true }); },
    replay: () => { carousel.refresh(); carousel.replay(); }
  };
  select(0, { spin: false, animate: false });

  // Replay the rise intro each time the spec page is opened.
  window.addEventListener('hashchange', () => {
    if (location.hash.indexOf('#/spec') === 0) setTimeout(() => window.BatonSpec.replay(), 60);
  });
  window.addEventListener('beforeprint', () => grid.classList.remove('spec-paged'));
  window.addEventListener('afterprint', () => select(selected, { spin: false, animate: false }));
})();
