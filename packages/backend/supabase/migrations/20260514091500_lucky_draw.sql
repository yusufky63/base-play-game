create extension if not exists pgcrypto;

create table if not exists public.lucky_draw_config (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default true,
  rounds_required integer not null default 10 check (rounds_required > 0),
  min_bet_eth numeric not null default 0 check (min_bet_eth >= 0),
  eth_usd_reference numeric not null default 2300 check (eth_usd_reference > 0),
  prize_table jsonb not null default '[
    {"usd": 0.10, "weight": 62000},
    {"usd": 0.50, "weight": 25000},
    {"usd": 1.00, "weight": 9000},
    {"usd": 2.50, "weight": 3000},
    {"usd": 5.00, "weight": 800},
    {"usd": 10.00, "weight": 200}
  ]'::jsonb,
  paused_reason text,
  updated_at timestamptz not null default now()
);

insert into public.lucky_draw_config (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.lucky_draw_progress (
  player text primary key references public.players(wallet_address) on delete cascade,
  qualified_rounds integer not null default 0 check (qualified_rounds >= 0),
  available_draws integer not null default 0 check (available_draws >= 0),
  lifetime_draws_earned integer not null default 0 check (lifetime_draws_earned >= 0),
  lifetime_draws_claimed integer not null default 0 check (lifetime_draws_claimed >= 0),
  total_prize_eth numeric not null default 0 check (total_prize_eth >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.lucky_draw_rounds (
  round_id uuid primary key references public.game_rounds(id) on delete cascade,
  player text not null references public.players(wallet_address) on delete cascade,
  game_id text not null,
  bet_amount numeric not null,
  counted_at timestamptz not null default now()
);

create table if not exists public.lucky_draw_results (
  id uuid primary key default gen_random_uuid(),
  player text not null references public.players(wallet_address) on delete cascade,
  prize_usd numeric not null check (prize_usd > 0),
  prize_eth numeric not null check (prize_eth > 0),
  eth_usd_reference numeric not null check (eth_usd_reference > 0),
  status text not null default 'claimable' check (status in ('claimable', 'paid', 'voided')),
  entropy_hash text not null,
  client_seed text,
  payout_tx_hash text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_lucky_draw_rounds_player
  on public.lucky_draw_rounds(player, counted_at desc);

create index if not exists idx_lucky_draw_results_player
  on public.lucky_draw_results(player, created_at desc);

create index if not exists idx_lucky_draw_results_status
  on public.lucky_draw_results(status, created_at desc);

create or replace function public.fn_update_lucky_draw_progress()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_config public.lucky_draw_config%rowtype;
  v_inserted integer := 0;
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

  insert into public.lucky_draw_rounds (round_id, player, game_id, bet_amount)
  values (new.id, new.player, new.game_id, new.bet_amount)
  on conflict (round_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return new;
  end if;

  insert into public.lucky_draw_progress
    (player, qualified_rounds, available_draws, lifetime_draws_earned)
  values
    (
      new.player,
      case when v_config.rounds_required <= 1 then 0 else 1 end,
      case when v_config.rounds_required <= 1 then 1 else 0 end,
      case when v_config.rounds_required <= 1 then 1 else 0 end
    )
  on conflict (player) do update set
    qualified_rounds = (public.lucky_draw_progress.qualified_rounds + 1) % v_config.rounds_required,
    available_draws = public.lucky_draw_progress.available_draws +
      case when public.lucky_draw_progress.qualified_rounds + 1 >= v_config.rounds_required then 1 else 0 end,
    lifetime_draws_earned = public.lucky_draw_progress.lifetime_draws_earned +
      case when public.lucky_draw_progress.qualified_rounds + 1 >= v_config.rounds_required then 1 else 0 end,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_update_lucky_draw_progress on public.game_rounds;
create trigger trg_update_lucky_draw_progress
  after insert on public.game_rounds
  for each row execute function public.fn_update_lucky_draw_progress();

create or replace function public.fn_claim_lucky_draw(
  p_player text,
  p_client_seed text
)
returns public.lucky_draw_results
language plpgsql
set search_path = public
as $$
declare
  v_config public.lucky_draw_config%rowtype;
  v_progress public.lucky_draw_progress%rowtype;
  v_entropy bytea := gen_random_bytes(32);
  v_entropy_hash text := encode(digest(v_entropy || coalesce(p_client_seed, '')::bytea, 'sha256'), 'hex');
  v_total_weight bigint := 0;
  v_roll bigint;
  v_cursor integer := 0;
  v_prize_usd numeric := 0;
  v_prize_eth numeric := 0;
  v_result public.lucky_draw_results%rowtype;
  v_item jsonb;
  v_weight integer;
begin
  select *
    into v_config
  from public.lucky_draw_config
  where id = 1
  for update;

  if not found or not v_config.enabled then
    raise exception 'Lucky Draw is paused';
  end if;

  select *
    into v_progress
  from public.lucky_draw_progress
  where player = lower(p_player)
  for update;

  if not found or v_progress.available_draws <= 0 then
    raise exception 'No Lucky Draw available';
  end if;

  for v_item in select value from jsonb_array_elements(v_config.prize_table)
  loop
    v_weight := greatest(0, coalesce((v_item->>'weight')::integer, 0));
    v_total_weight := v_total_weight + v_weight;
  end loop;

  if v_total_weight <= 0 then
    raise exception 'Lucky Draw prize table is invalid';
  end if;

  v_roll := mod(
    (
      (get_byte(v_entropy, 0)::bigint << 24) +
      (get_byte(v_entropy, 1)::bigint << 16) +
      (get_byte(v_entropy, 2)::bigint << 8) +
      get_byte(v_entropy, 3)::bigint
    ),
    v_total_weight
  );

  for v_item in select value from jsonb_array_elements(v_config.prize_table)
  loop
    v_weight := greatest(0, coalesce((v_item->>'weight')::integer, 0));
    v_cursor := v_cursor + v_weight;
    if v_roll < v_cursor then
      v_prize_usd := (v_item->>'usd')::numeric;
      exit;
    end if;
  end loop;

  if v_prize_usd <= 0 then
    raise exception 'Lucky Draw prize table did not resolve';
  end if;

  v_prize_eth := round(v_prize_usd / v_config.eth_usd_reference, 12);

  insert into public.lucky_draw_results
    (player, prize_usd, prize_eth, eth_usd_reference, entropy_hash, client_seed)
  values
    (lower(p_player), v_prize_usd, v_prize_eth, v_config.eth_usd_reference, v_entropy_hash, left(coalesce(p_client_seed, ''), 96))
  returning * into v_result;

  update public.lucky_draw_progress
  set
    available_draws = available_draws - 1,
    lifetime_draws_claimed = lifetime_draws_claimed + 1,
    total_prize_eth = total_prize_eth + v_prize_eth,
    updated_at = now()
  where player = lower(p_player);

  return v_result;
end;
$$;

alter table public.lucky_draw_config enable row level security;
alter table public.lucky_draw_progress enable row level security;
alter table public.lucky_draw_rounds enable row level security;
alter table public.lucky_draw_results enable row level security;

drop policy if exists "read_lucky_draw_config" on public.lucky_draw_config;
create policy "read_lucky_draw_config" on public.lucky_draw_config for select using (true);

drop policy if exists "read_lucky_draw_progress" on public.lucky_draw_progress;
create policy "read_lucky_draw_progress" on public.lucky_draw_progress for select using (true);

drop policy if exists "read_lucky_draw_results" on public.lucky_draw_results;
create policy "read_lucky_draw_results" on public.lucky_draw_results for select using (true);

grant select on table public.lucky_draw_config to anon, authenticated;
grant select on table public.lucky_draw_progress to anon, authenticated;
grant select on table public.lucky_draw_results to anon, authenticated;

revoke all on table public.lucky_draw_rounds from anon, authenticated;
revoke insert, update, delete on table public.lucky_draw_config from anon, authenticated;
revoke insert, update, delete on table public.lucky_draw_progress from anon, authenticated;
revoke insert, update, delete on table public.lucky_draw_results from anon, authenticated;
revoke execute on function public.fn_update_lucky_draw_progress() from anon, authenticated;
revoke execute on function public.fn_claim_lucky_draw(text, text) from anon, authenticated;
