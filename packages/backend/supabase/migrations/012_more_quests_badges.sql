insert into public.badge_definitions
  (id, title, description, category, token_id, metadata_uri, mint_ready, sort_order)
values
  ('daily-climber', 'Daily Climber', 'Completed a 10-round daily quest.', 'quest', 10, '/badges/daily-climber.json', false, 100),
  ('daily-explorer', 'Daily Explorer', 'Played five different BasePlay games in one day.', 'quest', 11, '/badges/daily-explorer.json', false, 110),
  ('five-wins', 'Five Wins', 'Won five settled BasePlay rounds.', 'win', 12, '/badges/five-wins.json', false, 120),
  ('twenty-five-rounds', '25 Rounds', 'Played 25 settled BasePlay rounds.', 'progression', 13, '/badges/twenty-five-rounds.json', false, 130),
  ('weekly-winner', 'Weekly Winner', 'Completed the weekly 10-win quest.', 'quest', 14, '/badges/weekly-winner.json', false, 140),
  ('wide-board', 'Wide Board', 'Played eight different BasePlay games in one week.', 'quest', 15, '/badges/wide-board.json', false, 150)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  token_id = excluded.token_id,
  metadata_uri = excluded.metadata_uri,
  mint_ready = excluded.mint_ready,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

insert into public.quest_definitions
  (id, title, description, period, metric, target, reward_xp, badge_id, sort_order)
values
  ('daily-round-10', 'Play ten rounds', 'Settle ten rounds today.', 'daily', 'rounds', 10, 90, 'daily-climber', 45),
  ('daily-win-2', 'Win twice', 'Win two settled rounds today.', 'daily', 'wins', 2, 45, null, 46),
  ('daily-five-games', 'Try five games', 'Settle rounds in five different games today.', 'daily', 'distinct_games', 5, 70, 'daily-explorer', 47),
  ('weekly-round-25', '25-round week', 'Settle twenty-five rounds this week.', 'weekly', 'rounds', 25, 180, 'twenty-five-rounds', 80),
  ('weekly-win-10', 'Ten-win week', 'Win ten settled rounds this week.', 'weekly', 'wins', 10, 175, 'weekly-winner', 90),
  ('weekly-eight-games', 'Wide board', 'Settle rounds in eight different games this week.', 'weekly', 'distinct_games', 8, 160, 'wide-board', 100)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  period = excluded.period,
  metric = excluded.metric,
  target = excluded.target,
  reward_xp = excluded.reward_xp,
  badge_id = excluded.badge_id,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

create or replace function public.fn_update_progression_rewards()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_day date := (new.settled_at at time zone 'utc')::date;
  v_week date := date_trunc('week', new.settled_at at time zone 'utc')::date;
  v_day_start timestamptz := v_day::timestamp at time zone 'utc';
  v_day_end timestamptz := (v_day + 1)::timestamp at time zone 'utc';
  v_week_start timestamptz := v_week::timestamp at time zone 'utc';
  v_week_end timestamptz := (v_week + 7)::timestamp at time zone 'utc';
  v_daily_rounds integer;
  v_daily_games integer;
  v_daily_wins integer;
  v_weekly_rounds integer;
  v_weekly_games integer;
  v_weekly_wins integer;
  v_total_rounds integer;
  v_total_wins integer;
  v_current_streak integer;
  v_lifetime_games integer;
  v_referrer text;
  v_daily_referral_xp integer;
  v_pair_daily_rounds integer;
  v_referral_xp integer;
  v_inserted_referral_xp integer;
begin
  insert into public.players (wallet_address)
  values (new.player)
  on conflict (wallet_address) do nothing;

  insert into public.referral_codes (player)
  values (new.player)
  on conflict (player) do nothing;

  select total_rounds, current_streak
    into v_total_rounds, v_current_streak
  from public.player_stats
  where player = new.player;

  select count(*) filter (where won)::integer
    into v_total_wins
  from public.game_rounds
  where player = new.player;

  if coalesce(v_total_rounds, 0) >= 1 then
    perform public.fn_award_badge(new.player, 'first-round', 'round');
  end if;
  if new.won then
    perform public.fn_award_badge(new.player, 'first-win', 'round');
  end if;
  if coalesce(v_total_rounds, 0) >= 10 then
    perform public.fn_award_badge(new.player, 'ten-rounds', 'round');
  end if;
  if coalesce(v_total_rounds, 0) >= 25 then
    perform public.fn_award_badge(new.player, 'twenty-five-rounds', 'round');
  end if;
  if coalesce(v_total_rounds, 0) >= 100 then
    perform public.fn_award_badge(new.player, 'hundred-rounds', 'round');
  end if;
  if coalesce(v_total_wins, 0) >= 5 then
    perform public.fn_award_badge(new.player, 'five-wins', 'round');
  end if;
  if coalesce(v_current_streak, 0) >= 7 then
    perform public.fn_award_badge(new.player, 'seven-day-streak', 'streak');
  end if;
  if new.won and new.bet_amount > 0 and new.payout >= new.bet_amount * 5 then
    perform public.fn_award_badge(new.player, 'big-win-5x', 'round');
  end if;

  select count(*)::integer, count(distinct game_id)::integer, count(*) filter (where won)::integer
    into v_daily_rounds, v_daily_games, v_daily_wins
  from public.game_rounds
  where player = new.player
    and settled_at >= v_day_start
    and settled_at < v_day_end;

  select count(*)::integer, count(distinct game_id)::integer, count(*) filter (where won)::integer
    into v_weekly_rounds, v_weekly_games, v_weekly_wins
  from public.game_rounds
  where player = new.player
    and settled_at >= v_week_start
    and settled_at < v_week_end;

  select count(distinct game_id)::integer
    into v_lifetime_games
  from public.game_rounds
  where player = new.player;

  if coalesce(v_lifetime_games, 0) >= 5 then
    perform public.fn_award_badge(new.player, 'game-explorer', 'round');
  end if;

  perform public.fn_apply_quest_progress(new.player, 'daily-round-1', v_day, coalesce(v_daily_rounds, 0), new.settled_at);
  perform public.fn_apply_quest_progress(new.player, 'daily-round-5', v_day, coalesce(v_daily_rounds, 0), new.settled_at);
  perform public.fn_apply_quest_progress(new.player, 'daily-round-10', v_day, coalesce(v_daily_rounds, 0), new.settled_at);
  perform public.fn_apply_quest_progress(new.player, 'daily-three-games', v_day, coalesce(v_daily_games, 0), new.settled_at);
  perform public.fn_apply_quest_progress(new.player, 'daily-five-games', v_day, coalesce(v_daily_games, 0), new.settled_at);
  perform public.fn_apply_quest_progress(new.player, 'daily-win-1', v_day, coalesce(v_daily_wins, 0), new.settled_at);
  perform public.fn_apply_quest_progress(new.player, 'daily-win-2', v_day, coalesce(v_daily_wins, 0), new.settled_at);
  perform public.fn_apply_quest_progress(new.player, 'weekly-round-10', v_week, coalesce(v_weekly_rounds, 0), new.settled_at);
  perform public.fn_apply_quest_progress(new.player, 'weekly-round-25', v_week, coalesce(v_weekly_rounds, 0), new.settled_at);
  perform public.fn_apply_quest_progress(new.player, 'weekly-five-games', v_week, coalesce(v_weekly_games, 0), new.settled_at);
  perform public.fn_apply_quest_progress(new.player, 'weekly-eight-games', v_week, coalesce(v_weekly_games, 0), new.settled_at);
  perform public.fn_apply_quest_progress(new.player, 'weekly-win-10', v_week, coalesce(v_weekly_wins, 0), new.settled_at);
  perform public.fn_apply_quest_progress(new.player, 'weekly-streak-7', v_week, coalesce(v_current_streak, 0), new.settled_at);

  select referrer_player
    into v_referrer
  from public.player_referrals
  where referred_player = new.player;

  if v_referrer is not null and new.xp_earned > 0 then
    select coalesce(sum(xp_awarded), 0)::integer
      into v_daily_referral_xp
    from public.referral_rewards
    where referrer_player = v_referrer
      and reward_day = v_day;

    select count(*)::integer
      into v_pair_daily_rounds
    from public.referral_rewards
    where referrer_player = v_referrer
      and referred_player = new.player
      and reward_day = v_day;

    if coalesce(v_daily_referral_xp, 0) < 60 and coalesce(v_pair_daily_rounds, 0) < 20 then
      v_referral_xp := least(6, greatest(1, ceil(new.xp_earned::numeric * 0.10)::integer));
      v_referral_xp := least(v_referral_xp, 60 - coalesce(v_daily_referral_xp, 0));

      insert into public.referral_rewards
        (referrer_player, referred_player, round_id, xp_awarded, reward_day)
      values
        (v_referrer, new.player, new.id, v_referral_xp, v_day)
      on conflict (round_id) do nothing
      returning xp_awarded into v_inserted_referral_xp;

      if v_inserted_referral_xp is not null then
        perform public.fn_add_player_bonus_xp(v_referrer, v_inserted_referral_xp, new.settled_at);
        perform public.fn_award_badge(v_referrer, 'referral-starter', 'referral');
      end if;
    end if;
  end if;

  return new;
end;
$$;
