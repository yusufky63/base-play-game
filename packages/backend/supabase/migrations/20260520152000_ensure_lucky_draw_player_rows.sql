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

  insert into public.players (wallet_address)
  values (new.player)
  on conflict (wallet_address) do nothing;

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

revoke execute on function public.fn_update_lucky_draw_progress() from public, anon, authenticated;
