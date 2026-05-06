-- Keep existing profile and leaderboard XP consistent with the bet-weighted
-- formula introduced in 009. Non-XP aggregates are left untouched.
with recomputed_rounds as (
  select
    id,
    public.fn_calculate_round_xp(bet_amount, won) as next_xp
  from public.game_rounds
)
update public.game_rounds rounds
set xp_earned = recomputed_rounds.next_xp
from recomputed_rounds
where rounds.id = recomputed_rounds.id
  and rounds.xp_earned is distinct from recomputed_rounds.next_xp;

with player_xp as (
  select
    player,
    coalesce(sum(xp_earned), 0)::integer as lifetime_xp
  from public.game_rounds
  group by player
)
update public.player_stats stats
set
  lifetime_xp = player_xp.lifetime_xp,
  level = public.fn_xp_level(player_xp.lifetime_xp),
  updated_at = now()
from player_xp
where stats.player = player_xp.player;

with weekly_xp as (
  select
    player,
    date_trunc('week', settled_at)::date as week_start,
    coalesce(sum(xp_earned), 0)::integer as xp
  from public.game_rounds
  group by player, date_trunc('week', settled_at)::date
)
update public.leaderboard_weekly weekly
set
  xp = weekly_xp.xp,
  level = coalesce(stats.level, public.fn_xp_level(weekly_xp.xp)),
  updated_at = now()
from weekly_xp
left join public.player_stats stats on stats.player = weekly_xp.player
where weekly.player = weekly_xp.player
  and weekly.week_start = weekly_xp.week_start;
