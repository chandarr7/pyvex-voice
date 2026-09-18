-- Narrow what `authenticated` and `anon` may do.
--
-- The initial migration granted the four DML privileges to `authenticated`, but
-- a grant is additive and Supabase's default privileges had already granted ALL
-- on new tables in `public`. `authenticated` therefore kept TRUNCATE, which is
-- not subject to row-level security: any signed-in user could destroy every row
-- in these tables regardless of ownership, while still being unable to SELECT
-- more than their own.
--
-- Revoking first and re-granting deliberately makes the privilege set the one
-- this file states, rather than whatever defaults happen to be in effect.

revoke all on public.profiles from authenticated, anon;
revoke all on public.voice_agents from authenticated, anon;
revoke all on public.call_sessions from authenticated, anon;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.voice_agents to authenticated;
grant select, insert, update, delete on public.call_sessions to authenticated;

-- These three exist only to back triggers. PostgREST exposes every function in
-- `public` at /rest/v1/rpc/, and handle_new_user runs as SECURITY DEFINER, so
-- none of them should be callable by a client.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.prevent_self_role_change() from public, anon, authenticated;
