/* Public client configuration.
 * - supabaseKey is Supabase's PUBLISHABLE key: it is meant to be public. On its own it can read
 *   nothing: every table requires a signed-in user (Supabase Auth JWT) and row-level security.
 *   The secret / service-role key is never shipped.
 * - The demo accounts below are deliberately public: they are printed on the sign-in screen so
 *   anyone can test each role on the synthetic Meridian project. They protect synthetic data only.
 * To run Baton without a database, set supabaseUrl to '' (everything then runs in the browser).
 */
window.BATON_CONFIG = {
  supabaseUrl: 'https://acwvvhnmjteendsyoawn.supabase.co',
  supabaseKey: 'sb_publishable_OYDwQEBHajnvAO7J8aQnXw_s1I_XlLb',
  demoPassword: 'baton-demo-2026',
  demoAccounts: [
    { persona: 'reviewer', name: 'Prof. Rao', initials: 'RA', email: 'rao@baton.example', role: 'Reviewer', does: 'Runs the Studio, decides claims, approves and publishes the handover.', start: true },
    { persona: 'owner', name: 'Priya', initials: 'PR', email: 'priya@baton.example', role: 'Data owner', does: 'Adds and tags sources. Cannot approve a handover (reviewer only).' },
    { persona: 'meera', name: 'Meera', initials: 'MN', email: 'meera@baton.example', role: 'Incoming lead · core team', does: 'Receives her handover. Try to break in: she cannot see sources, the ledger or treasurer-only items.' },
    { persona: 'rohan', name: 'Rohan', initials: 'RG', email: 'rohan@baton.example', role: 'Member · all members', does: 'Sees only all-members items; core-team and treasurer items show as gaps.' },
    { persona: 'kavya', name: 'Kavya', initials: 'KA', email: 'kavya@baton.example', role: 'Treasurer', does: 'Sees treasurer-only items that Meera and Rohan cannot.' },
    { persona: 'leaver', name: 'Aarav', initials: 'AS', email: 'aarav@baton.example', role: 'Departing lead', does: 'Answers the open gaps in a guided interview and can dispute claims about his work.' }
  ]
};
