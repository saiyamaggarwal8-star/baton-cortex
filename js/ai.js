/* Browser side of the AI service (api/ai.js). The browser never talks to a model directly:
 * it sends the signed-in user's Supabase token to /api/ai, which checks it, calls Claude, and runs the
 * code verifier on every proposal before anything comes back. */
(function () {
  'use strict';
  const D = window.BatonDB;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
  const ENDPOINT = (window.BATON_CONFIG && window.BATON_CONFIG.aiEndpoint) || (local ? 'https://baton-cortex.vercel.app/api/ai' : '/api/ai');

  function available() {
    return !!(D && D.configured && D.session && D.session() && D.isStaff());
  }

  async function call(task, body, timeoutMs) {
    if (!available()) throw new Error('Sign in as the reviewer or data owner to use AI extraction.');
    const s = D.session();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 75000);
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token },
        body: JSON.stringify(Object.assign({ task }, body))
      });
    } catch (e) {
      throw new Error(e.name === 'AbortError' ? 'The AI service took too long. Rules results are kept.' : 'Could not reach the AI service. Rules results are kept.');
    } finally { clearTimeout(timer); }
    let j = {};
    try { j = await res.json(); } catch (e) { j = {}; }
    if (!res.ok) throw new Error(j.error || ('AI service error ' + res.status));
    return j;
  }

  window.BatonAI = { available, call, endpoint: ENDPOINT };
})();
