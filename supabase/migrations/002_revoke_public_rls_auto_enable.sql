-- Supabase helper used by an event trigger on hosted projects; it should not be callable through the
-- public API. (Flagged by the Supabase security advisor; the advisor reports no issues after this.)
-- Guarded so the same migration also runs on a fresh local database (CI), where the helper may not exist.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
