/* Hash router: #/ (workspace), #/studio/<step>, #/spec/<project>. */
(function () {
  'use strict';
  const landingEl = document.getElementById('landing');
  const studioEl = document.getElementById('studio');
  const detailEl = document.getElementById('detail');
  const STEPS = ['connect', 'reconstruct', 'verify', 'review', 'handover'];

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

  function route() {
    const parts = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    const view = parts[0] || '';
    if (view === 'studio') {
      show('studio');
      const step = STEPS.includes(parts[1]) ? parts[1] : 'connect';
      window.BatonStudio.goStep(step);
      window.scrollTo(0, 0);
    } else if (view === 'spec') {
      renderDossier(parts[1] || 'meridian');
      show('spec');
      window.scrollTo(0, 0);
    } else {
      const fromOther = landingEl.classList.contains('hide');
      show('home');
      renderDock();
      if (fromOther) window.scrollTo(0, 0);
    }
  }

  // "Try it with the sample" loads the Meridian sources the first time.
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-start-sample]');
    if (a && !window.BatonStudio.hasData()) window.BatonStudio.startSample();
  });

  window.BatonStudio.init();
  window.addEventListener('hashchange', route);
  route();
})();
