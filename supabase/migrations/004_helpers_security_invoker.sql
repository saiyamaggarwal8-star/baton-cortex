-- The request-context helpers only need rows the caller can already read under RLS
-- (their own workspace_members / profiles rows), so they run with the caller's rights.
-- Flagged by the Supabase security advisor (lint 0029) when they were SECURITY DEFINER.
alter function public.baton_ws() security invoker;
alter function public.baton_persona() security invoker;
alter function public.baton_account_is_staff() security invoker;
