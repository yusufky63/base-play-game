-- Tighten public execution and make backend-only indexer state explicit for RLS linting.

revoke execute on function public.fn_update_aggregate_stats() from public, anon, authenticated;
revoke execute on function public.fn_update_leaderboard() from public, anon, authenticated;

drop policy if exists "deny_indexer_state_public_select" on public.indexer_state;
create policy "deny_indexer_state_public_select"
  on public.indexer_state for select
  to anon, authenticated
  using (false);

revoke all on table public.indexer_state from anon, authenticated;
