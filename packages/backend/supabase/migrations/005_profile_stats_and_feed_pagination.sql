create table if not exists public.platform_stats (
  id integer primary key default 1 check (id = 1),
  total_rounds integer not null default 0 check (total_rounds >= 0),
  total_players integer not null default 0 check (total_players >= 0),
  total_wagered numeric not null default 0 check (total_wagered >= 0),
  total_payout numeric not null default 0 check (total_payout >= 0),
  net_profit numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.game_stats (
  game_id text not null,
  chain_id integer not null,
  total_rounds integer not null default 0 check (total_rounds >= 0),
  total_players integer not null default 0 check (total_players >= 0),
  total_wagered numeric not null default 0 check (total_wagered >= 0),
  total_payout numeric not null default 0 check (total_payout >= 0),
  net_profit numeric not null default 0,
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  biggest_win numeric not null default 0 check (biggest_win >= 0),
  updated_at timestamptz not null default now(),
  primary key (game_id, chain_id)
);

create table if not exists public.player_game_stats (
  player text not null,
  game_id text not null,
  chain_id integer not null,
  total_rounds integer not null default 0 check (total_rounds >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  total_wagered numeric not null default 0 check (total_wagered >= 0),
  total_payout numeric not null default 0 check (total_payout >= 0),
  net_profit numeric not null default 0,
  biggest_win numeric not null default 0 check (biggest_win >= 0),
  last_played_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player, game_id, chain_id)
);

create index if not exists idx_rounds_feed_page
  on public.game_rounds(settled_at desc, id desc);

create index if not exists idx_rounds_game_feed_page
  on public.game_rounds(game_id, settled_at desc, id desc);

create index if not exists idx_rounds_player_feed_page
  on public.game_rounds(player, settled_at desc, id desc);

create index if not exists idx_game_stats_rounds
  on public.game_stats(chain_id, total_rounds desc);

create index if not exists idx_player_game_stats_player
  on public.player_game_stats(player, total_rounds desc);

create or replace function public.fn_update_aggregate_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_platform_player boolean;
  v_new_game_player boolean;
begin
  select not exists (
    select 1 from public.game_rounds
    where player = new.player and id <> new.id
  ) into v_new_platform_player;

  select not exists (
    select 1 from public.game_rounds
    where player = new.player
      and game_id = new.game_id
      and chain_id = new.chain_id
      and id <> new.id
  ) into v_new_game_player;

  insert into public.platform_stats
    (id, total_rounds, total_players, total_wagered, total_payout, net_profit)
  values
    (1, 1, case when v_new_platform_player then 1 else 0 end,
     new.bet_amount, new.payout, new.payout - new.bet_amount)
  on conflict (id) do update set
    total_rounds = platform_stats.total_rounds + 1,
    total_players = platform_stats.total_players + case when v_new_platform_player then 1 else 0 end,
    total_wagered = platform_stats.total_wagered + new.bet_amount,
    total_payout = platform_stats.total_payout + new.payout,
    net_profit = platform_stats.net_profit + (new.payout - new.bet_amount),
    updated_at = now();

  insert into public.game_stats
    (game_id, chain_id, total_rounds, total_players, total_wagered, total_payout,
     net_profit, wins, losses, biggest_win)
  values
    (new.game_id, new.chain_id, 1, case when v_new_game_player then 1 else 0 end,
     new.bet_amount, new.payout, new.payout - new.bet_amount,
     case when new.won then 1 else 0 end,
     case when new.won then 0 else 1 end,
     greatest(new.payout, 0))
  on conflict (game_id, chain_id) do update set
    total_rounds = game_stats.total_rounds + 1,
    total_players = game_stats.total_players + case when v_new_game_player then 1 else 0 end,
    total_wagered = game_stats.total_wagered + new.bet_amount,
    total_payout = game_stats.total_payout + new.payout,
    net_profit = game_stats.net_profit + (new.payout - new.bet_amount),
    wins = game_stats.wins + case when new.won then 1 else 0 end,
    losses = game_stats.losses + case when new.won then 0 else 1 end,
    biggest_win = greatest(game_stats.biggest_win, new.payout),
    updated_at = now();

  insert into public.player_game_stats
    (player, game_id, chain_id, total_rounds, wins, losses, total_wagered,
     total_payout, net_profit, biggest_win, last_played_at)
  values
    (new.player, new.game_id, new.chain_id, 1,
     case when new.won then 1 else 0 end,
     case when new.won then 0 else 1 end,
     new.bet_amount, new.payout, new.payout - new.bet_amount,
     greatest(new.payout, 0), new.settled_at)
  on conflict (player, game_id, chain_id) do update set
    total_rounds = player_game_stats.total_rounds + 1,
    wins = player_game_stats.wins + case when new.won then 1 else 0 end,
    losses = player_game_stats.losses + case when new.won then 0 else 1 end,
    total_wagered = player_game_stats.total_wagered + new.bet_amount,
    total_payout = player_game_stats.total_payout + new.payout,
    net_profit = player_game_stats.net_profit + (new.payout - new.bet_amount),
    biggest_win = greatest(player_game_stats.biggest_win, new.payout),
    last_played_at = greatest(player_game_stats.last_played_at, new.settled_at),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_update_aggregate_stats on public.game_rounds;
create trigger trg_update_aggregate_stats
  after insert on public.game_rounds
  for each row execute function public.fn_update_aggregate_stats();

truncate table public.platform_stats, public.game_stats, public.player_game_stats;

insert into public.platform_stats
  (id, total_rounds, total_players, total_wagered, total_payout, net_profit)
select
  1,
  count(*)::integer,
  count(distinct player)::integer,
  coalesce(sum(bet_amount), 0),
  coalesce(sum(payout), 0),
  coalesce(sum(payout - bet_amount), 0)
from public.game_rounds
on conflict (id) do update set
  total_rounds = excluded.total_rounds,
  total_players = excluded.total_players,
  total_wagered = excluded.total_wagered,
  total_payout = excluded.total_payout,
  net_profit = excluded.net_profit,
  updated_at = now();

insert into public.game_stats
  (game_id, chain_id, total_rounds, total_players, total_wagered, total_payout,
   net_profit, wins, losses, biggest_win)
select
  game_id,
  chain_id,
  count(*)::integer,
  count(distinct player)::integer,
  coalesce(sum(bet_amount), 0),
  coalesce(sum(payout), 0),
  coalesce(sum(payout - bet_amount), 0),
  count(*) filter (where won)::integer,
  count(*) filter (where not won)::integer,
  coalesce(max(payout), 0)
from public.game_rounds
group by game_id, chain_id
on conflict (game_id, chain_id) do update set
  total_rounds = excluded.total_rounds,
  total_players = excluded.total_players,
  total_wagered = excluded.total_wagered,
  total_payout = excluded.total_payout,
  net_profit = excluded.net_profit,
  wins = excluded.wins,
  losses = excluded.losses,
  biggest_win = excluded.biggest_win,
  updated_at = now();

insert into public.player_game_stats
  (player, game_id, chain_id, total_rounds, wins, losses, total_wagered,
   total_payout, net_profit, biggest_win, last_played_at)
select
  player,
  game_id,
  chain_id,
  count(*)::integer,
  count(*) filter (where won)::integer,
  count(*) filter (where not won)::integer,
  coalesce(sum(bet_amount), 0),
  coalesce(sum(payout), 0),
  coalesce(sum(payout - bet_amount), 0),
  coalesce(max(payout), 0),
  max(settled_at)
from public.game_rounds
group by player, game_id, chain_id
on conflict (player, game_id, chain_id) do update set
  total_rounds = excluded.total_rounds,
  wins = excluded.wins,
  losses = excluded.losses,
  total_wagered = excluded.total_wagered,
  total_payout = excluded.total_payout,
  net_profit = excluded.net_profit,
  biggest_win = excluded.biggest_win,
  last_played_at = excluded.last_played_at,
  updated_at = now();

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

alter table public.platform_stats enable row level security;
alter table public.game_stats enable row level security;
alter table public.player_game_stats enable row level security;

drop policy if exists "read_platform_stats" on public.platform_stats;
create policy "read_platform_stats"
  on public.platform_stats for select
  using (true);

drop policy if exists "read_game_stats" on public.game_stats;
create policy "read_game_stats"
  on public.game_stats for select
  using (true);

drop policy if exists "read_player_game_stats" on public.player_game_stats;
create policy "read_player_game_stats"
  on public.player_game_stats for select
  using (true);

grant select on table public.game_rounds to anon, authenticated;
grant select on table public.platform_stats to anon, authenticated;
grant select on table public.game_stats to anon, authenticated;
grant select on table public.player_game_stats to anon, authenticated;
grant select on table public.player_stats to anon, authenticated;
grant select on table public.leaderboard_weekly to anon, authenticated;
grant select on public.leaderboard_weekly_ranked to anon, authenticated;

revoke execute on function public.fn_update_aggregate_stats() from anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.game_stats;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.player_game_stats;
exception
  when duplicate_object then null;
end $$;
