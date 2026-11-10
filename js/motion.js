/* Motion layer: GSAP (+ ScrollTrigger, SplitText, CustomEase) and Lenis smooth scroll.
 * Everything here is progressive: with prefers-reduced-motion, or if a library fails
 * to load, the page is fully usable and every element rests in its final state.
 * Only transform / opacity (and clip-path for the dock) are animated.
 */
(function () {
  'use strict';
  const gsap = window.gsap;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionOK = () => !!gsap && !reduce.matches;
  let lenis = null;

  // ---------------------------------------------------------------------------
  // Scrolling (Lenis when motion is allowed, native otherwise)
  // ---------------------------------------------------------------------------
  const HEADER_OFFSET = -92;
  window.BatonScroll = {
    top() { if (lenis) lenis.scrollTo(0, { immediate: true }); else window.scrollTo(0, 0); },
    to(el) {
      if (!el) return;
      if (lenis) lenis.scrollTo(el, { offset: HEADER_OFFSET, duration: 0.9 });
      else el.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
    }
  };

  if (!gsap) { window.BatonMotion = { afterRoute() {} }; return; }

  const plugins = [window.ScrollTrigger, window.SplitText, window.CustomEase].filter(Boolean);
  gsap.registerPlugin.apply(gsap, plugins);
  if (window.CustomEase) CustomEase.create('baton', '0.22,1,0.36,1');
  const EASE = window.CustomEase ? 'baton' : 'expo.out';
  gsap.defaults({ ease: EASE, duration: 0.6 });

  function startLenis() {
    if (lenis || !window.Lenis || reduce.matches) return;
    lenis = new window.Lenis({
      lerp: 0.11,
      smoothWheel: true,
      // Only true inner scrollers opt out. The dock and the spec ring stop the wheel events they
      // consume themselves, so the page never gets a native scroll and a Lenis scroll at once.
      prevent: node => !!(node.closest && node.closest('.claim-list, .passage, .src pre, .table-wrap, dialog, [data-lenis-prevent]'))
    });
    if (window.ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => { if (lenis) lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  function stopLenis() { if (lenis) { lenis.destroy(); lenis = null; } }
  startLenis();
  reduce.addEventListener('change', () => (reduce.matches ? stopLenis() : startLenis()));

  // ---------------------------------------------------------------------------
  // Sliding indicator behind the active top-nav link
  // ---------------------------------------------------------------------------
  const nav = document.querySelector('.topnav');
  let navInd = null;
  function moveNavIndicator(animate) {
    if (!nav || !motionOK()) { if (nav) nav.classList.remove('has-indicator'); return; }
    const active = nav.querySelector('a.active');
    if (!active) return;
    if (!navInd) {
      navInd = document.createElement('span');
      navInd.className = 'nav-indicator';
      navInd.setAttribute('aria-hidden', 'true');
      nav.prepend(navInd);
    }
    nav.classList.add('has-indicator');
    const vars = { x: active.offsetLeft, width: active.offsetWidth };
    if (animate) gsap.to(navInd, Object.assign(vars, { duration: 0.5, overwrite: 'auto' }));
    else gsap.set(navInd, vars);
  }
  window.addEventListener('resize', () => moveNavIndicator(false));

  // ---------------------------------------------------------------------------
  // Landing intro: split headline, highlight sweep, staggered cards
  // ---------------------------------------------------------------------------
  let introPlayed = false;
  function landingIntro() {
    if (introPlayed || !motionOK()) return;
    introPlayed = true;
    const title = document.getElementById('heroTitle');
    const tl = gsap.timeline({ defaults: { ease: EASE } });
    if (title && window.SplitText) {
      const split = SplitText.create(title, { type: 'words', mask: 'words', wordsClass: 'hero-word' });
      tl.from(split.words, { yPercent: 115, duration: 0.95, stagger: 0.07 }, 0);
    }
    const accent = document.querySelector('.hero-accent');
    if (accent) tl.fromTo(accent, { '--hl': 0 }, { '--hl': 1, duration: 0.8, ease: 'power3.inOut' }, 0.55);
    tl.fromTo('.hero-badge', { autoAlpha: 0, y: 10, }, { autoAlpha: 1, y: 0, duration: 0.5, clearProps: 'opacity,visibility,transform' }, 0)
      .fromTo('.hero-copy', { autoAlpha: 0, y: 16, }, { autoAlpha: 1, y: 0, duration: 0.7, clearProps: 'opacity,visibility,transform' }, 0.35)
      .fromTo('.hero-cta .btn', { autoAlpha: 0, y: 14, }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08, clearProps: 'opacity,visibility,transform' }, 0.45)
      .fromTo('.label-row .pill', { autoAlpha: 0, y: 8, }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.035, clearProps: 'opacity,visibility,transform' }, 0.6)
      .fromTo('.hero-side .bento', { autoAlpha: 0, y: 24, scale: 0.98, }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, stagger: 0.12, clearProps: 'opacity,visibility,transform' }, 0.25);

    if (window.ScrollTrigger) {
      gsap.set('.how-step', { autoAlpha: 0, y: 22 });
      ScrollTrigger.batch('.how-step', {
        start: 'top 92%', once: true,
        onEnter: batch => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08, overwrite: true })
      });
      gsap.from('.dock-section', {
        autoAlpha: 0, y: 40, duration: 0.9,
        scrollTrigger: { trigger: '.dock-section', start: 'top 88%', once: true }
      });
      // Safety net: never leave a reveal hidden if a trigger cannot fire.
      setTimeout(() => gsap.set('.how-step', { autoAlpha: 1, y: 0, overwrite: false }), 4000);
    }
  }

  // ---------------------------------------------------------------------------
  // Dossier entrance
  // ---------------------------------------------------------------------------
  function dossierIn() {
    if (!motionOK()) return;
    const tl = gsap.timeline();
    tl.fromTo('#detail .hero-stats .stat', { autoAlpha: 0, y: 18, }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.06, clearProps: 'opacity,visibility,transform' }, 0.05)
      .fromTo('#detail .active-project-dossier', { autoAlpha: 0, y: 22, }, { autoAlpha: 1, y: 0, duration: 0.7, clearProps: 'opacity,visibility,transform' }, 0.12)
      .fromTo('#detail .dossier-claims-grid > *', { autoAlpha: 0, y: 14, }, { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.05, clearProps: 'opacity,visibility,transform' }, 0.2)
      .fromTo('#detail .detail-nav button', { autoAlpha: 0, y: 8, }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.025, clearProps: 'opacity,visibility,transform' }, 0.25);
    const banner = document.getElementById('illustrativeBanner');
    if (banner && !banner.hidden) tl.fromTo(banner, { autoAlpha: 0, y: -8, }, { autoAlpha: 1, y: 0, duration: 0.5, clearProps: 'opacity,visibility,transform' }, 0.1);
    tl.fromTo('#detail .spec-explorer', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.7, clearProps: 'opacity,visibility,transform' }, 0.3);
    // Spec sections are opened one at a time by the spec explorer (js/spec-carousel.js),
    // which animates the opened section itself.
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }

  // ---------------------------------------------------------------------------
  // Studio: step/tab changes slide in; the active step indicator glides.
  // ---------------------------------------------------------------------------
  let lastKey = null;
  let lastStepRect = null;
  function countUp(root) {
    root.querySelectorAll('.pipe b, .kpi b').forEach(el => {
      const target = parseInt(el.textContent, 10);
      if (!Number.isFinite(target) || String(target) !== el.textContent.trim() || target === 0) return;
      const obj = { n: 0 };
      gsap.to(obj, { n: target, duration: 0.9, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(obj.n); } });
    });
  }
  function placeStepIndicator(animate) {
    const stepper = document.querySelector('#studioRoot .stepper');
    if (!stepper) return;
    const active = stepper.querySelector('button.active');
    if (!active || !motionOK()) { stepper.classList.remove('has-indicator'); return; }
    const ind = document.createElement('span');
    ind.className = 'step-indicator';
    ind.setAttribute('aria-hidden', 'true');
    stepper.prepend(ind);
    stepper.classList.add('has-indicator');
    const to = { x: active.offsetLeft, y: active.offsetTop, width: active.offsetWidth, height: active.offsetHeight };
    if (animate && lastStepRect) gsap.fromTo(ind, lastStepRect, Object.assign({}, to, { duration: 0.55, overwrite: 'auto' }));
    else gsap.set(ind, to);
    lastStepRect = to;
  }
  document.addEventListener('baton:render', e => {
    const d = e.detail || {};
    const key = d.step + '|' + (d.step === 'review' ? d.tab : '') + '|' + (d.step === 'handover' ? d.reader : '');
    const changed = key !== lastKey;
    const stepChanged = !lastKey || lastKey.split('|')[0] !== d.step;
    lastKey = key;
    placeStepIndicator(stepChanged);
    if (!changed || !motionOK()) return;
    const body = document.getElementById('stepBody');
    if (!body) return;
    const blocks = body.querySelectorAll(':scope > *, :scope > .split > *, :scope > .grid2 > *');
    gsap.fromTo(blocks, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.045, overwrite: true, clearProps: 'opacity,visibility,transform' });
    if (stepChanged) countUp(body);
  });

  // ---------------------------------------------------------------------------
  // Router hook (called by js/app.js after each route)
  // ---------------------------------------------------------------------------
  window.BatonMotion = {
    afterRoute(view, entered) {
      moveNavIndicator(entered && motionOK());
      if (window.ScrollTrigger) ScrollTrigger.refresh();
      if (!entered) return;
      if (view === 'home') landingIntro();
      else if (view === 'spec') dossierIn();
    }
  };
  // First paint: app.js has already routed once before this file loaded.
  window.BatonMotion.afterRoute((location.hash || '').indexOf('#/studio') === 0 ? 'studio' : (location.hash || '').indexOf('#/spec') === 0 ? 'spec' : 'home', true);
})();
