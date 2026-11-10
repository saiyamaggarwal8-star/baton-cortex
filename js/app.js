/* Hash router: #/ (workspace), #/studio/<step>, #/spec/<project>.
 * Switching between the three views uses the View Transitions API when available
 * (the lifted dock file morphs into the dossier header); otherwise it swaps instantly.
 */
(function () {
  'use strict';
  const landingEl = document.getElementById('landing');
  const studioEl = document.getElementById('studio');
  const detailEl = document.getElementById('detail');
  const STEPS = ['connect', 'reconstruct', 'verify', 'review', 'handover'];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let currentView = null;

  function parse() {
    const parts = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    const v = parts[0] === 'studio' ? 'studio' : parts[0] === 'spec' ? 'spec' : 'home';
    return { view: v, arg: parts[1] };
  }

  function show(view) {
    landingEl.classList.toggle('hide', view !== 'home');
    studioEl.classList.toggle('show', view === 'studio');
    detailEl.classList.toggle('show', view === 'spec');
    document.querySelectorAll('[data-nav]').forEach(a => {
      const on = a.dataset.nav === view;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function toTop() {
    if (window.BatonScroll) window.BatonScroll.top(); else window.scrollTo(0, 0);
  }

  function apply(r, changed) {
    if (r.view === 'studio') {
      show('studio');
      window.BatonStudio.goStep(STEPS.includes(r.arg) ? r.arg : 'connect');
      if (changed) toTop();
    } else if (r.view === 'spec') {
      renderDossier(r.arg || 'meridian');
      show('spec');
      toTop();
    } else {
      show('home');
      renderDock();
      if (changed) toTop();
    }
  }

  function route() {
    const r = parse();
    const changed = currentView !== null && r.view !== currentView;
    const done = () => {
      document.querySelectorAll('.dock-card').forEach(c => { c.style.viewTransitionName = ''; });
      if (window.BatonMotion) window.BatonMotion.afterRoute(r.view, changed || currentView === null);
    };
    currentView = r.view;
    if (changed && typeof document.startViewTransition === 'function' && !reduce.matches) {
      const vt = document.startViewTransition(() => apply(r, true));
      // A skipped transition (hidden tab, rapid navigation) rejects `ready`; the DOM update still runs.
      vt.ready.catch(() => {});
      vt.finished.then(done, done);
    } else {
      apply(r, changed);
      done();
    }
  }

  // "Try the Meridian sample" loads the sources the first time.
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-start-sample]');
    if (a && !window.BatonStudio.hasData()) window.BatonStudio.startSample();
  });

  window.BatonStudio.init();
  window.addEventListener('hashchange', route);
  route();
})();
