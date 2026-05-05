-- Production feed/profile access and leaderboard query optimization.
-- Public round data is already on-chain; expose settled rows through RLS so
-- feed/profile pagination does not fall back to expensive RPC scans.

drop policy if exists "read_recent_rounds" on public.game_rounds;
drop policy if exists "read_settled_rounds" on public.game_rounds;
create policy "read_settled_rounds"
  on public.game_rounds for select
  using (settled_at is not null);

create index if not exists idx_rounds_wins_feed_page
  on public.game_rounds(settled_at desc, id desc)
  where won = true;

create index if not exists idx_rounds_game_wins_feed_page
  on public.game_rounds(game_id, settled_at desc, id desc)
  where won = true;

create index if not exists idx_rounds_player_game_feed_page
  on public.game_rounds(player, game_id, settled_at desc, id desc);

create index if not exists idx_lb_week_xp_rank
  on public.leaderboard_weekly(week_start, xp desc, net_profit desc, biggest_win desc, player asc);

create index if not exists idx_lb_week_profit_rank
  on public.leaderboard_weekly(week_start, net_profit desc, biggest_win desc, xp desc, player asc);

create or replace view public.leaderboard_weekly_ranked
with (security_invoker = true)
as
select
  leaderboard_weekly.*,
  rank() over (
    partition by week_start
    order by xp desc, net_profit desc, biggest_win desc, player asc
  )::integer as xp_rank,
  rank() over (
    partition by week_start
    order by net_profit desc, biggest_win desc, xp desc, player asc
  )::integer as profit_rank
from public.leaderboard_weekly;

grant select on table public.game_rounds to anon, authenticated;
grant select on table public.leaderboard_weekly to anon, authenticated;
grant select on public.leaderboard_weekly_ranked to anon, authenticated;
