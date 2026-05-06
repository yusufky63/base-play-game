create table if not exists public.referral_codes (
  player text primary key references public.players(wallet_address) on delete cascade,
  code text unique not null default upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_referrals (
  referred_player text primary key references public.players(wallet_address) on delete cascade,
  referrer_player text not null references public.players(wallet_address) on delete cascade,
  referral_code text,
  source text not null default 'wallet_signature',
  claimed_at timestamptz not null default now(),
  constraint no_self_referral check (referred_player <> referrer_player)
);

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_player text not null references public.players(wallet_address) on delete cascade,
  referred_player text not null references public.players(wallet_address) on delete cascade,
  round_id uuid not null references public.game_rounds(id) on delete cascade,
  xp_awarded integer not null check (xp_awarded > 0),
  reward_day date not null,
  created_at timestamptz not null default now(),
  unique (round_id)
);

create table if not exists public.quest_definitions (
  id text primary key,
  title text not null,
  description text not null,
  period text not null check (period in ('daily', 'weekly')),
  metric text not null,
  target integer not null check (target > 0),
  reward_xp integer not null default 0 check (reward_xp >= 0),
  badge_id text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_quest_progress (
  player text not null references public.players(wallet_address) on delete cascade,
  quest_id text not null references public.quest_definitions(id) on delete cascade,
  period_start date not null,
  progress integer not null default 0 check (progress >= 0),
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (player, quest_id, period_start)
);

create table if not exists public.badge_definitions (
  id text primary key,
  title text not null,
  description text not null,
  category text not null default 'progression',
  token_id integer unique,
  metadata_uri text,
  mint_ready boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_badges (
  player text not null references public.players(wallet_address) on delete cascade,
  badge_id text not null references public.badge_definitions(id) on delete cascade,
  source text not null default 'progression',
  awarded_at timestamptz not null default now(),
  primary key (player, badge_id)
);

create index if not exists idx_player_referrals_referrer
  on public.player_referrals(referrer_player, claimed_at desc);

create index if not exists idx_referral_rewards_referrer_day
  on public.referral_rewards(referrer_player, reward_day, created_at desc);

create index if not exists idx_referral_rewards_pair_day
  on public.referral_rewards(referrer_player, referred_player, reward_day);

create index if not exists idx_player_quest_progress_player
  on public.player_quest_progress(player, period_start desc, quest_id);

create index if not exists idx_player_badges_player
  on public.player_badges(player, awarded_at desc);

insert into public.badge_definitions
  (id, title, description, category, token_id, metadata_uri, mint_ready, sort_order)
values
  ('first-round', 'First Round', 'Played your first settled BasePlay round.', 'progression', 1, '/badges/first-round.json', false, 10),
  ('first-win', 'First Win', 'Won your first settled BasePlay round.', 'progression', 2, '/badges/first-win.json', false, 20),
  ('ten-rounds', '10 Rounds', 'Played 10 settled BasePlay rounds.', 'progression', 3, '/badges/ten-rounds.json', false, 30),
  ('hundred-rounds', '100 Rounds', 'Played 100 settled BasePlay rounds.', 'progression', 4, '/badges/hundred-rounds.json', false, 40),
  ('seven-day-streak', '7-Day Streak', 'Kept a seven day play streak.', 'streak', 5, '/badges/seven-day-streak.json', false, 50),
  ('weekly-grinder', 'Weekly Grinder', 'Completed the weekly 10-round quest.', 'quest', 6, '/badges/weekly-grinder.json', false, 60),
  ('game-explorer', 'Game Explorer', 'Played five different BasePlay games.', 'quest', 7, '/badges/game-explorer.json', false, 70),
  ('referral-starter', 'Referral Starter', 'Invited a player into BasePlay.', 'social', 8, '/badges/referral-starter.json', false, 80),
  ('big-win-5x', 'Big Win 5x', 'Hit a 5x or higher winning payout.', 'win', 9, '/badges/big-win-5x.json', false, 90)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  token_id = excluded.token_id,
  metadata_uri = excluded.metadata_uri,
  mint_ready = excluded.mint_ready,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.quest_definitions
  (id, title, description, period, metric, target, reward_xp, badge_id, sort_order)
values
  ('daily-round-1', 'Play one round', 'Settle one round today.', 'daily', 'rounds', 1, 20, null, 10),
  ('daily-round-5', 'Play five rounds', 'Settle five rounds today.', 'daily', 'rounds', 5, 50, null, 20),
  ('daily-three-games', 'Try three games', 'Settle rounds in three different games today.', 'daily', 'distinct_games', 3, 40, null, 30),
  ('daily-win-1', 'Get a win', 'Win one settled round today.', 'daily', 'wins', 1, 25, null, 40),
  ('weekly-round-10', 'Weekly grinder', 'Settle ten rounds this week.', 'weekly', 'rounds', 10, 100, 'weekly-grinder', 50),
  ('weekly-five-games', 'Game explorer', 'Settle rounds in five different games this week.', 'weekly', 'distinct_games', 5, 100, 'game-explorer', 60),
  ('weekly-streak-7', 'Seven day streak', 'Keep a seven day streak this week.', 'weekly', 'current_streak', 7, 150, 'seven-day-streak', 70)
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

insert into public.referral_codes (player, code)
select wallet_address, referral_code
from public.players
on conflict (player) do nothing;

create or replace function public.fn_add_player_bonus_xp(
  p_player text,
  p_xp integer,
  p_settled_at timestamptz
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_week date := date_trunc('week', p_settled_at at time zone 'utc')::date;
  v_lifetime integer;
  v_level integer;
begin
  if p_xp <= 0 then
    return;
  end if;

  insert into public.player_stats
    (player, lifetime_xp, level, total_rounds, total_wagered, net_profit, biggest_win)
  values
    (p_player, p_xp, public.fn_xp_level(p_xp), 0, 0, 0, 0)
  on conflict (player) do update set
    lifetime_xp = public.player_stats.lifetime_xp + p_xp,
    level = public.fn_xp_level(public.player_stats.lifetime_xp + p_xp),
    updated_at = now();

  select lifetime_xp, level
    into v_lifetime, v_level
  from public.player_stats
  where player = p_player;

  insert into public.leaderboard_weekly
    (player, week_start, game_count, total_wagered, net_profit, biggest_win, xp, level, current_streak)
  values
    (p_player, v_week, 0, 0, 0, 0, p_xp, v_level, 0)
  on conflict (player, week_start) do update set
    xp = public.leaderboard_weekly.xp + p_xp,
    level = v_level,
    updated_at = now();
end;
$$;

create or replace function public.fn_award_badge(
  p_player text,
  p_badge_id text,
  p_source text
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_badge_id is null then
    return;
  end if;

  insert into public.player_badges (player, badge_id, source)
  values (p_player, p_badge_id, coalesce(p_source, 'progression'))
  on conflict (player, badge_id) do nothing;
end;
$$;

create or replace function public.fn_apply_quest_progress(
  p_player text,
  p_quest_id text,
  p_period_start date,
  p_progress integer,
  p_settled_at timestamptz
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_target integer;
  v_reward_xp integer;
  v_badge_id text;
  v_was_completed boolean := false;
  v_now_completed boolean := false;
begin
  select target, reward_xp, badge_id
    into v_target, v_reward_xp, v_badge_id
  from public.quest_definitions
  where id = p_quest_id and active = true;

  if not found then
    return;
  end if;

  select completed
    into v_was_completed
  from public.player_quest_progress
  where player = p_player
    and quest_id = p_quest_id
    and period_start = p_period_start;

  v_now_completed := p_progress >= v_target;

  insert into public.player_quest_progress
    (player, quest_id, period_start, progress, completed, completed_at)
  values
    (p_player, p_quest_id, p_period_start, greatest(p_progress, 0), v_now_completed,
     case when v_now_completed then p_settled_at else null end)
  on conflict (player, quest_id, period_start) do update set
    progress = greatest(public.player_quest_progress.progress, excluded.progress),
    completed = public.player_quest_progress.completed or excluded.completed,
    completed_at = case
      when public.player_quest_progress.completed_at is not null then public.player_quest_progress.completed_at
      when excluded.completed then p_settled_at
      else null
    end,
    updated_at = now()
  returning completed into v_now_completed;

  if v_now_completed and not coalesce(v_was_completed, false) then
    perform public.fn_add_player_bonus_xp(p_player, v_reward_xp, p_settled_at);
    perform public.fn_award_badge(p_player, v_badge_id, 'quest:' || p_quest_id);
  end if;
end;
$$;

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
  v_total_rounds integer;
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

  if coalesce(v_total_rounds, 0) >= 1 then
    perform public.fn_award_badge(new.player, 'first-round', 'round');
  end if;
  if new.won then
    perform public.fn_award_badge(new.player, 'first-win', 'round');
  end if;
  if coalesce(v_total_rounds, 0) >= 10 then
    perform public.fn_award_badge(new.player, 'ten-rounds', 'round');
  end if;
  if coalesce(v_total_rounds, 0) >= 100 then
    perform public.fn_award_badge(new.player, 'hundred-rounds', 'round');
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

  select count(*)::integer, count(distinct game_id)::integer
    into v_weekly_rounds, v_weekly_games
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
  perform public.fn_apply_quest_progress(new.player, 'daily-three-games', v_day, coalesce(v_daily_games, 0), new.settled_at);
  perform public.fn_apply_quest_progress(new.player, 'daily-win-1', v_day, coalesce(v_daily_wins, 0), new.settled_at);
  perform public.fn_apply_quest_progress(new.player, 'weekly-round-10', v_week, coalesce(v_weekly_rounds, 0), new.settled_at);
  perform public.fn_apply_quest_progress(new.player, 'weekly-five-games', v_week, coalesce(v_weekly_games, 0), new.settled_at);
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

drop trigger if exists trg_update_progression_rewards on public.game_rounds;
create trigger trg_update_progression_rewards
  after insert on public.game_rounds
  for each row execute function public.fn_update_progression_rewards();

create or replace view public.player_quest_summary
with (security_invoker = true)
as
select
  progress.player,
  progress.quest_id,
  definitions.title,
  definitions.description,
  definitions.period,
  definitions.metric,
  definitions.target,
  definitions.reward_xp,
  definitions.badge_id,
  definitions.sort_order,
  progress.period_start,
  progress.progress,
  progress.completed,
  progress.completed_at,
  progress.updated_at
from public.player_quest_progress progress
join public.quest_definitions definitions on definitions.id = progress.quest_id
where definitions.active = true;

create or replace view public.player_badge_summary
with (security_invoker = true)
as
select
  badges.player,
  badges.badge_id,
  definitions.title,
  definitions.description,
  definitions.category,
  definitions.token_id,
  definitions.metadata_uri,
  definitions.mint_ready,
  definitions.sort_order,
  badges.source,
  badges.awarded_at
from public.player_badges badges
join public.badge_definitions definitions on definitions.id = badges.badge_id
where definitions.active = true;

create or replace view public.player_referral_summary
with (security_invoker = true)
as
select
  codes.player,
  codes.code,
  count(distinct referrals.referred_player)::integer as total_referrals,
  count(distinct rewards.referred_player)::integer as active_referrals,
  coalesce(sum(rewards.xp_awarded), 0)::integer as total_referral_xp,
  max(rewards.created_at) as last_reward_at
from public.referral_codes codes
left join public.player_referrals referrals on referrals.referrer_player = codes.player
left join public.referral_rewards rewards on rewards.referrer_player = codes.player
group by codes.player, codes.code;

alter table public.referral_codes enable row level security;
alter table public.player_referrals enable row level security;
alter table public.referral_rewards enable row level security;
alter table public.quest_definitions enable row level security;
alter table public.player_quest_progress enable row level security;
alter table public.badge_definitions enable row level security;
alter table public.player_badges enable row level security;

drop policy if exists "read_referral_codes" on public.referral_codes;
create policy "read_referral_codes" on public.referral_codes for select using (true);

drop policy if exists "read_player_referrals" on public.player_referrals;
create policy "read_player_referrals" on public.player_referrals for select using (true);

drop policy if exists "read_referral_rewards" on public.referral_rewards;
create policy "read_referral_rewards" on public.referral_rewards for select using (true);

drop policy if exists "read_quest_definitions" on public.quest_definitions;
create policy "read_quest_definitions" on public.quest_definitions for select using (true);

drop policy if exists "read_player_quest_progress" on public.player_quest_progress;
create policy "read_player_quest_progress" on public.player_quest_progress for select using (true);

drop policy if exists "read_badge_definitions" on public.badge_definitions;
create policy "read_badge_definitions" on public.badge_definitions for select using (true);

drop policy if exists "read_player_badges" on public.player_badges;
create policy "read_player_badges" on public.player_badges for select using (true);

grant select on table public.referral_codes to anon, authenticated;
grant select on table public.player_referrals to anon, authenticated;
grant select on table public.referral_rewards to anon, authenticated;
grant select on table public.quest_definitions to anon, authenticated;
grant select on table public.player_quest_progress to anon, authenticated;
grant select on table public.badge_definitions to anon, authenticated;
grant select on table public.player_badges to anon, authenticated;
grant select on public.player_quest_summary to anon, authenticated;
grant select on public.player_badge_summary to anon, authenticated;
grant select on public.player_referral_summary to anon, authenticated;

revoke insert, update, delete on table public.referral_codes from anon, authenticated;
revoke insert, update, delete on table public.player_referrals from anon, authenticated;
revoke insert, update, delete on table public.referral_rewards from anon, authenticated;
revoke insert, update, delete on table public.quest_definitions from anon, authenticated;
revoke insert, update, delete on table public.player_quest_progress from anon, authenticated;
revoke insert, update, delete on table public.badge_definitions from anon, authenticated;
revoke insert, update, delete on table public.player_badges from anon, authenticated;

revoke execute on function public.fn_add_player_bonus_xp(text, integer, timestamptz) from anon, authenticated;
revoke execute on function public.fn_award_badge(text, text, text) from anon, authenticated;
revoke execute on function public.fn_apply_quest_progress(text, text, date, integer, timestamptz) from anon, authenticated;
revoke execute on function public.fn_update_progression_rewards() from anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.player_quest_progress;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.player_badges;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.referral_rewards;
exception
  when duplicate_object then null;
end $$;
