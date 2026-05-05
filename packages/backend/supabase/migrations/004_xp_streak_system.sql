alter table public.game_rounds
  add column if not exists xp_earned integer not null default 0 check (xp_earned >= 0);

alter table public.leaderboard_weekly
  add column if not exists xp integer not null default 0 check (xp >= 0),
  add column if not exists level integer not null default 1 check (level >= 1),
  add column if not exists current_streak integer not null default 0 check (current_streak >= 0);

create table if not exists public.player_stats (
  player text primary key,
  lifetime_xp integer not null default 0 check (lifetime_xp >= 0),
  level integer not null default 1 check (level >= 1),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_played_on date,
  total_rounds integer not null default 0 check (total_rounds >= 0),
  total_wagered numeric not null default 0 check (total_wagered >= 0),
  net_profit numeric not null default 0,
  biggest_win numeric not null default 0 check (biggest_win >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lb_week_xp
  on public.leaderboard_weekly(week_start, xp desc, net_profit desc);

create index if not exists idx_player_stats_xp
  on public.player_stats(lifetime_xp desc, net_profit desc);

create or replace function public.fn_xp_level(p_xp integer)
returns integer
language sql
immutable
set search_path = public
as $$
  select greatest(1, floor(sqrt(greatest(p_xp, 0)::numeric / 100))::integer + 1);
$$;

create or replace function public.fn_calculate_round_xp(p_bet_amount numeric, p_won boolean)
returns integer
language sql
immutable
set search_path = public
as $$
  select
    10
    + least(floor(greatest(p_bet_amount, 0) / 0.0001)::integer * 2, 20)
    + case when p_won then 5 else 0 end;
$$;

create or replace function public.fn_assign_round_xp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.xp_earned := public.fn_calculate_round_xp(new.bet_amount, new.won);
  return new;
end;
$$;

drop trigger if exists trg_assign_round_xp on public.game_rounds;
create trigger trg_assign_round_xp
  before insert on public.game_rounds
  for each row execute function public.fn_assign_round_xp();

create or replace function public.fn_update_leaderboard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week date := date_trunc('week', new.settled_at)::date;
  v_play_day date := new.settled_at::date;
  v_prev_xp integer := 0;
  v_prev_streak integer := 0;
  v_prev_longest integer := 0;
  v_last_played date;
  v_next_xp integer;
  v_next_level integer;
  v_next_streak integer;
  v_next_longest integer;
begin
  select lifetime_xp, current_streak, longest_streak, last_played_on
    into v_prev_xp, v_prev_streak, v_prev_longest, v_last_played
  from public.player_stats
  where player = new.player
  for update;

  if not found then
    v_prev_xp := 0;
    v_prev_streak := 0;
    v_prev_longest := 0;
    v_last_played := null;
  end if;

  if v_last_played is null then
    v_next_streak := 1;
  elsif v_last_played = v_play_day then
    v_next_streak := v_prev_streak;
  elsif v_last_played = v_play_day - 1 then
    v_next_streak := v_prev_streak + 1;
  else
    v_next_streak := 1;
  end if;

  v_next_longest := greatest(v_prev_longest, v_next_streak);
  v_next_xp := v_prev_xp + new.xp_earned;
  v_next_level := public.fn_xp_level(v_next_xp);

  insert into public.player_stats
    (player, lifetime_xp, level, current_streak, longest_streak, last_played_on,
     total_rounds, total_wagered, net_profit, biggest_win)
  values
    (new.player, new.xp_earned, public.fn_xp_level(new.xp_earned),
     1, 1, v_play_day, 1, new.bet_amount, new.payout - new.bet_amount,
     greatest(new.payout, 0))
  on conflict (player) do update set
    lifetime_xp = v_next_xp,
    level = v_next_level,
    current_streak = v_next_streak,
    longest_streak = v_next_longest,
    last_played_on = greatest(coalesce(player_stats.last_played_on, v_play_day), v_play_day),
    total_rounds = player_stats.total_rounds + 1,
    total_wagered = player_stats.total_wagered + new.bet_amount,
    net_profit = player_stats.net_profit + (new.payout - new.bet_amount),
    biggest_win = greatest(player_stats.biggest_win, new.payout),
    updated_at = now();

  insert into public.leaderboard_weekly
    (player, week_start, game_count, total_wagered, net_profit, biggest_win, xp, level, current_streak)
  values
    (new.player, v_week, 1, new.bet_amount, new.payout - new.bet_amount,
     greatest(new.payout, 0), new.xp_earned, v_next_level, v_next_streak)
  on conflict (player, week_start) do update set
    game_count = leaderboard_weekly.game_count + 1,
    total_wagered = leaderboard_weekly.total_wagered + new.bet_amount,
    net_profit = leaderboard_weekly.net_profit + (new.payout - new.bet_amount),
    biggest_win = greatest(leaderboard_weekly.biggest_win, new.payout),
    xp = leaderboard_weekly.xp + new.xp_earned,
    level = v_next_level,
    current_streak = v_next_streak,
    updated_at = now();

  return new;
end;
$$;

alter table public.player_stats enable row level security;

drop policy if exists "read_player_stats" on public.player_stats;
create policy "read_player_stats"
  on public.player_stats for select
  using (true);

revoke execute on function public.fn_assign_round_xp() from anon, authenticated;
revoke execute on function public.fn_update_leaderboard() from anon, authenticated;
revoke execute on function public.fn_calculate_round_xp(numeric, boolean) from anon, authenticated;
revoke execute on function public.fn_xp_level(integer) from anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.player_stats;
exception
  when duplicate_object then null;
end $$;
