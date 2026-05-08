-- Public, append-only on-chain event timeline for round verification.
-- Summary rows stay in game_rounds; this table keeps each indexed tx/log so
-- users can inspect the request, settlement, refund, and game-specific events.

create table if not exists public.round_events (
  id uuid primary key default gen_random_uuid(),
  vrf_request_id text not null,
  event_name text not null,
  tx_hash text,
  block_number bigint,
  log_index integer not null default 0,
  player text,
  game_id text not null,
  chain_id integer not null,
  contract_address text not null,
  args jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  unique(chain_id, tx_hash, log_index)
);

create index if not exists idx_round_events_request
  on public.round_events(chain_id, vrf_request_id, block_number, log_index);

create index if not exists idx_round_events_tx
  on public.round_events(chain_id, tx_hash);

create index if not exists idx_round_events_game_recent
  on public.round_events(game_id, observed_at desc);

alter table public.round_events enable row level security;

drop policy if exists "read_round_events" on public.round_events;
create policy "read_round_events"
  on public.round_events for select
  using (true);

revoke all on table public.round_events from anon, authenticated;
grant select on table public.round_events to anon, authenticated;
