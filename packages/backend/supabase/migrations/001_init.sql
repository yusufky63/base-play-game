create table public.players (
  wallet_address text primary key,
  username text,
  avatar_seed text not null default gen_random_uuid()::text,
  referral_code text unique not null default upper(substring(gen_random_uuid()::text, 1, 8)),
  referrer text references public.players(wallet_address),
  created_at timestamptz not null default now()
);

create table public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  tx_hash text unique,
  vrf_request_id text unique,
  player text not null,
  game_id text not null,
  chain_id integer not null,
  bet_amount numeric not null check (bet_amount > 0),
  payout numeric not null default 0 check (payout >= 0),
  multiplier numeric,
  won boolean not null,
  settled_at timestamptz not null default now()
);

create index idx_rounds_player on public.game_rounds(player);
create index idx_rounds_game_id on public.game_rounds(game_id);
create index idx_rounds_chain_id on public.game_rounds(chain_id);
create index idx_rounds_won on public.game_rounds(won) where won = true;
create index idx_rounds_settled on public.game_rounds(settled_at desc);

create table public.game_configs (
  game_id text not null,
  chain_id integer not null,
  contract_address text not null,
  is_active boolean not null default true,
  min_bet_eth numeric,
  max_bet_eth numeric,
  house_edge_pct numeric,
  updated_at timestamptz not null default now(),
  primary key (game_id, chain_id)
);
