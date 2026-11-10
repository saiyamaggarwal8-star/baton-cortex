-- Supabase helper used by an event trigger; it should not be callable through the public API.
-- (Flagged by the Supabase security advisor; the advisor reports no issues after this.)
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
