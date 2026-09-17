-- Wallet addresses are compared as plain text in Postgres, so "0xAbC..." and "0xabc..." would be
-- treated as two different players and split one wallet across several leaderboard, profile, and
-- stats rows. The backend already lowercases addresses before writing; this migration enforces the
-- same rule inside the database so no client can reintroduce case-variant duplicates.
--
-- 1. Abort if case-variant duplicates already exist. Merging them by summing counters is not safe
--    (some rounds could be counted on both sides), so they must be reconciled from chain data first.
-- 2. Lowercase any remaining mixed-case addresses in tables without address foreign keys.
-- 3. Normalize addresses on every insert/update with BEFORE triggers.
-- 4. Add unique lower(address) guards so a case-variant row can never be inserted again.

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from (
    select lower(wallet_address)
    from public.players
    group by lower(wallet_address)
    having count(*) > 1
  ) duplicates;
  if v_count > 0 then
    raise exception 'players contains % wallet addresses that differ only by letter case. Reconcile them from chain data before applying this migration.', v_count;
  end if;

  select count(*) into v_count
  from public.players
  where wallet_address <> lower(wallet_address)
     or (referrer is not null and referrer <> lower(referrer));
  if v_count > 0 then
    raise exception 'players contains % mixed-case wallet or referrer addresses. players.referrer references players.wallet_address, so lowercase these rows manually before applying this migration.', v_count;
  end if;

  select count(*) into v_count
  from (
    select lower(player)
    from public.player_stats
    group by lower(player)
    having count(*) > 1
  ) duplicates;
  if v_count > 0 then
    raise exception 'player_stats contains % players that differ only by letter case. Reconcile them from chain data before applying this migration.', v_count;
  end if;

  select count(*) into v_count
  from (
    select lower(player), week_start
    from public.leaderboard_weekly
    group by lower(player), week_start
    having count(*) > 1
  ) duplicates;
  if v_count > 0 then
    raise exception 'leaderboard_weekly contains % player/week rows that differ only by letter case. Reconcile them from chain data before applying this migration.', v_count;
  end if;

  select count(*) into v_count
  from (
    select lower(player), game_id, chain_id
    from public.player_game_stats
    group by lower(player), game_id, chain_id
    having count(*) > 1
  ) duplicates;
  if v_count > 0 then
    raise exception 'player_game_stats contains % player/game rows that differ only by letter case. Reconcile them from chain data before applying this migration.', v_count;
  end if;
end $$;

update public.game_rounds
set player = lower(player)
where player <> lower(player);

update public.round_events
set player = lower(player)
where player is not null
  and player <> lower(player);

update public.player_stats
set player = lower(player)
where player <> lower(player);

update public.leaderboard_weekly
set player = lower(player)
where player <> lower(player);

update public.player_game_stats
set player = lower(player)
where player <> lower(player);

create or replace function public.fn_lowercase_player_address()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.player is not null then
    new.player := lower(new.player);
  end if;
  return new;
end;
$$;

create or replace function public.fn_lowercase_wallet_address()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.wallet_address := lower(new.wallet_address);
  if new.referrer is not null then
    new.referrer := lower(new.referrer);
  end if;
  return new;
end;
$$;

revoke execute on function public.fn_lowercase_player_address() from public, anon, authenticated;
revoke execute on function public.fn_lowercase_wallet_address() from public, anon, authenticated;

-- game_rounds is the source of every stats row: its AFTER triggers (leaderboard, aggregate stats,
-- progression, lucky draw) all read new.player, which is already normalized here because BEFORE
-- triggers run first.
drop trigger if exists trg_lowercase_player_address on public.game_rounds;
create trigger trg_lowercase_player_address
  before insert or update of player on public.game_rounds
  for each row execute function public.fn_lowercase_player_address();

drop trigger if exists trg_lowercase_player_address on public.round_events;
create trigger trg_lowercase_player_address
  before insert or update of player on public.round_events
  for each row execute function public.fn_lowercase_player_address();

drop trigger if exists trg_lowercase_player_address on public.player_stats;
create trigger trg_lowercase_player_address
  before insert or update of player on public.player_stats
  for each row execute function public.fn_lowercase_player_address();

drop trigger if exists trg_lowercase_player_address on public.leaderboard_weekly;
create trigger trg_lowercase_player_address
  before insert or update of player on public.leaderboard_weekly
  for each row execute function public.fn_lowercase_player_address();

drop trigger if exists trg_lowercase_player_address on public.player_game_stats;
create trigger trg_lowercase_player_address
  before insert or update of player on public.player_game_stats
  for each row execute function public.fn_lowercase_player_address();

drop trigger if exists trg_lowercase_wallet_address on public.players;
create trigger trg_lowercase_wallet_address
  before insert or update of wallet_address, referrer on public.players
  for each row execute function public.fn_lowercase_wallet_address();

create unique index if not exists idx_players_wallet_address_lower
  on public.players (lower(wallet_address));

create unique index if not exists idx_player_stats_player_lower
  on public.player_stats (lower(player));

create unique index if not exists idx_leaderboard_weekly_player_lower_week
  on public.leaderboard_weekly (lower(player), week_start);

create unique index if not exists idx_player_game_stats_player_lower
  on public.player_game_stats (lower(player), game_id, chain_id);
