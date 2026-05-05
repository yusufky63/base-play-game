create table public.leaderboard_weekly (
  id uuid primary key default gen_random_uuid(),
  player text not null,
  week_start date not null,
  game_count integer not null default 0,
  total_wagered numeric not null default 0,
  net_profit numeric not null default 0,
  biggest_win numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (player, week_start)
);

create index idx_lb_week_profit on public.leaderboard_weekly(week_start, net_profit desc);

create or replace function public.fn_update_leaderboard()
returns trigger
language plpgsql
security definer
as $$
declare
  v_week date := date_trunc('week', new.settled_at)::date;
begin
  insert into public.leaderboard_weekly
    (player, week_start, game_count, total_wagered, net_profit, biggest_win)
  values
    (new.player, v_week, 1, new.bet_amount, new.payout - new.bet_amount, greatest(new.payout, 0))
  on conflict (player, week_start) do update set
    game_count = leaderboard_weekly.game_count + 1,
    total_wagered = leaderboard_weekly.total_wagered + new.bet_amount,
    net_profit = leaderboard_weekly.net_profit + (new.payout - new.bet_amount),
    biggest_win = greatest(leaderboard_weekly.biggest_win, new.payout),
    updated_at = now();
  return new;
end;
$$;

create trigger trg_update_leaderboard
  after insert on public.game_rounds
  for each row execute function public.fn_update_leaderboard();

select cron.schedule(
  'purge-old-leaderboard',
  '0 0 * * 1',
  $$
    delete from public.leaderboard_weekly
    where week_start < (date_trunc('week', now()) - interval '30 weeks')::date;
  $$
);
