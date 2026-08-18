alter table public.lucky_draw_config
  add column if not exists daily_draw_cap integer not null default 10
  check (daily_draw_cap > 0 and daily_draw_cap <= 100);

update public.lucky_draw_config
set
  min_bet_eth = 0.000115,
  eth_usd_reference = 2187,
  daily_draw_cap = 10,
  updated_at = now()
where id = 1;

create table if not exists public.lucky_draw_daily_progress (
  player text not null,
  draw_day date not null,
  qualified_rounds integer not null default 0 check (qualified_rounds >= 0),
  earned_draws integer not null default 0 check (earned_draws >= 0),
  updated_at timestamptz not null default now(),
  primary key (player, draw_day)
);

create index if not exists idx_lucky_draw_daily_progress_day
  on public.lucky_draw_daily_progress(draw_day desc, player);

with config as (
  select
    greatest(1, rounds_required) as rounds_required,
    min_bet_eth,
    daily_draw_cap
  from public.lucky_draw_config
  where id = 1
),
ordered as (
  select
    rounds.player,
    (rounds.counted_at at time zone 'UTC')::date as draw_day,
    row_number() over (partition by rounds.player order by rounds.counted_at, rounds.round_id) as row_number
  from public.lucky_draw_rounds rounds
  cross join config
  where rounds.bet_amount >= config.min_bet_eth
),
daily as (
  select
    ordered.player,
    ordered.draw_day,
    count(*)::integer as qualified_rounds,
    count(*) filter (where ordered.row_number % config.rounds_required = 0)::integer as earned_draws
  from ordered
  cross join config
  group by ordered.player, ordered.draw_day, config.rounds_required
)
insert into public.lucky_draw_daily_progress (player, draw_day, qualified_rounds, earned_draws, updated_at)
select
  daily.player,
  daily.draw_day,
  daily.qualified_rounds,
  least(daily.earned_draws, config.daily_draw_cap),
  now()
from daily
cross join config
on conflict (player, draw_day) do update set
  qualified_rounds = excluded.qualified_rounds,
  earned_draws = excluded.earned_draws,
  updated_at = now();

create or replace function public.fn_update_lucky_draw_progress()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_config public.lucky_draw_config%rowtype;
  v_progress public.lucky_draw_progress%rowtype;
  v_daily public.lucky_draw_daily_progress%rowtype;
  v_draw_day date := (new.settled_at at time zone 'UTC')::date;
  v_inserted integer := 0;
  v_next_qualified integer := 0;
  v_earned_draw integer := 0;
begin
  select *
    into v_config
  from public.lucky_draw_config
  where id = 1;

  if not found or not v_config.enabled then
    return new;
  end if;

  if new.bet_amount < v_config.min_bet_eth then
    return new;
  end if;

  insert into public.lucky_draw_daily_progress (player, draw_day)
  values (new.player, v_draw_day)
  on conflict (player, draw_day) do nothing;

  select *
    into v_daily
  from public.lucky_draw_daily_progress
  where player = new.player
    and draw_day = v_draw_day
  for update;

  if v_daily.earned_draws >= v_config.daily_draw_cap then
    return new;
  end if;

  insert into public.lucky_draw_progress
    (player, qualified_rounds, available_draws, lifetime_draws_earned)
  values (new.player, 0, 0, 0)
  on conflict (player) do nothing;

  select *
    into v_progress
  from public.lucky_draw_progress
  where player = new.player
  for update;

  insert into public.lucky_draw_rounds (round_id, player, game_id, bet_amount)
  values (new.id, new.player, new.game_id, new.bet_amount)
  on conflict (round_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return new;
  end if;

  v_next_qualified := v_progress.qualified_rounds + 1;
  v_earned_draw := case when v_next_qualified >= v_config.rounds_required then 1 else 0 end;

  update public.lucky_draw_progress
  set
    qualified_rounds = case when v_earned_draw = 1 then 0 else v_next_qualified end,
    available_draws = available_draws + v_earned_draw,
    lifetime_draws_earned = lifetime_draws_earned + v_earned_draw,
    updated_at = now()
  where player = new.player;

  update public.lucky_draw_daily_progress
  set
    qualified_rounds = qualified_rounds + 1,
    earned_draws = earned_draws + v_earned_draw,
    updated_at = now()
  where player = new.player
    and draw_day = v_draw_day;

  return new;
end;
$$;

revoke all on table public.lucky_draw_daily_progress from anon, authenticated;
alter table public.lucky_draw_daily_progress enable row level security;
