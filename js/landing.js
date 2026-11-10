/* Landing page cards: show the real state of the Meridian studio (browser storage), never invented numbers. */
(function () {
  'use strict';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = name => (String(name || '').replace(/\(.*?\)/g, '').match(/[A-Za-z]+/g) || ['?']).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const when = iso => {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };
  const bar = (label, value, max) => {
    const pct = max ? Math.round((value / max) * 100) : 0;
    return '<div class="bar"><div class="bar-top"><span>' + esc(label) + '</span><span>' + value + ' / ' + max + '</span></div>' +
      '<div class="bar-track" role="progressbar" aria-label="' + esc(label) + '" aria-valuenow="' + value + '" aria-valuemin="0" aria-valuemax="' + max + '"><span style="width:' + pct + '%"></span></div></div>';
  };

  function render() {
    const act = document.getElementById('landingActivity');
    const bars = document.getElementById('landingBars');
    const ver = document.getElementById('landingVersion');
    if (!act || !bars || !window.BatonStudio || !window.BatonStudio.summary) return;
    const s = window.BatonStudio.summary();

    act.innerHTML = s.audit.length
      ? s.audit.map(a => '<div class="activity-row"><span class="activity-avatar" aria-hidden="true">' + esc(initials(a.actor)) + '</span><div><b>' + esc(a.actor) + '</b> ' + esc(a.action) + '<div class="activity-when">' + esc(when(a.at)) + '</div></div></div>').join('')
      : '<div class="activity-empty">Nothing yet. Load the Meridian sample and every step you take shows up here.</div>';

    const done = s.steps.filter(x => x.done).length;
    bars.innerHTML =
      bar('Steps complete', done, s.steps.length) +
      bar('Claims reviewed', s.reviewed, s.claims) +
      '<div class="bar-note">' + s.sources + ' source' + (s.sources === 1 ? '' : 's') + ' connected</div>';

    ver.textContent = s.version ? s.version.id + ' · approved by ' + s.version.by : 'Draft · not shared';
  }

  window.addEventListener('hashchange', render);
  document.addEventListener('click', () => setTimeout(render, 0));
  render();
})();
