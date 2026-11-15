/* Hash router: #/ (workspace), #/studio/<step>, #/spec/<project>.
 * Switching between the three views uses the View Transitions API when available
 * (the lifted dock file morphs into the dossier header); otherwise it swaps instantly.
 */
(function () {
  'use strict';
  const landingEl = document.getElementById('landing');
  const libraryEl = document.getElementById('libraryView');
  const studioEl = document.getElementById('studio');
  const detailEl = document.getElementById('detail');
  const accountEl = document.getElementById('accountView');
  const STEPS = ['connect', 'reconstruct', 'verify', 'review', 'handover'];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let currentView = null;

  function parse() {
    const parts = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    const v = parts[0] === 'studio' ? 'studio'
            : parts[0] === 'spec' ? 'spec'
            : parts[0] === 'login' ? 'login'
            : parts[0] === 'me' ? 'me'
            : parts[0] === 'library' ? 'library'
            : 'home';
    return { view: v, arg: parts[1] };
  }

  function show(view) {
    const libEl = document.getElementById('libraryView') || libraryEl;
    landingEl.classList.toggle('hide', view !== 'home');
    if (libEl) libEl.classList.toggle('show', view === 'library');
    studioEl.classList.toggle('show', view === 'studio');
    detailEl.classList.toggle('show', view === 'spec');
    accountEl.classList.toggle('show', view === 'login' || view === 'me');
    document.querySelectorAll('[data-nav]').forEach(a => {
      const on = a.dataset.nav === view || (a.dataset.nav === 'studio' && view === 'me');
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function toTop() {
    if (window.BatonScroll) window.BatonScroll.top(); else window.scrollTo(0, 0);
  }

  // With a database configured, the Studio needs a signed-in staff account (data owner or reviewer);
  // readers are sent to their own handover page. Without a database (or in local mode) it runs locally.
  function guard(r) {
    const D = window.BatonDB;
    if (!D || !D.configured) return r.view === 'me' ? { view: 'login', arg: '' } : r;
    const s = D.session();
    if (r.view === 'studio' && !s) return { view: 'login', arg: 'studio', redirect: '#/login/studio' };
    if (r.view === 'studio' && !D.isStaff()) return { view: 'me', redirect: '#/me' };
    if (r.view === 'me' && !s) return { view: 'login', arg: 'me', redirect: '#/login/me' };
    return r;
  }

  function apply(r, changed) {
    const g = guard(r);
    if (g.redirect && location.hash !== g.redirect) history.replaceState(null, '', g.redirect);
    r = g;
    if (r.view === 'login' || r.view === 'me') {
      show(r.view);
      window.BatonAccount.show(r.view, r.arg);
      if (changed) toTop();
    } else if (r.view === 'studio') {
      show('studio');
      window.BatonStudio.goStep(STEPS.includes(r.arg) ? r.arg : 'connect');
      if (changed) toTop();
    } else if (r.view === 'spec') {
      renderDossier(r.arg || 'meridian');
      show('spec');
      toTop();
    } else if (r.view === 'library') {
      show('library');
      if (typeof renderDock === 'function') renderDock();
      if (changed) toTop();
    } else {
      show('home');
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
    if (changed && typeof document.startViewTransition === 'function' && !reduce.matches && document.visibilityState === 'visible') {
      // The browser may postpone a transition's callback (background tab, busy frame). Navigation must not
      // depend on it: apply the CURRENT address once, from the callback or from a short fallback timer.
      let ran = false;
      const update = () => { if (ran) return; ran = true; apply(parse(), true); };
      const vt = document.startViewTransition(update);
      setTimeout(update, 400);
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
