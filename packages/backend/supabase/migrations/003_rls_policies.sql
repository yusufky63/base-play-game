alter table public.game_rounds enable row level security;
alter table public.leaderboard_weekly enable row level security;
alter table public.players enable row level security;
alter table public.game_configs enable row level security;

create policy "read_recent_rounds"
  on public.game_rounds for select
  using (settled_at > now() - interval '24 hours');

create policy "read_leaderboard"
  on public.leaderboard_weekly for select
  using (true);

create policy "read_game_configs"
  on public.game_configs for select
  using (true);

create policy "read_players"
  on public.players for select
  using (true);

alter publication supabase_realtime add table public.game_rounds;
alter publication supabase_realtime add table public.leaderboard_weekly;
