-- Backend-only checkpoint state for contract event indexing.
-- This prevents every backend restart from scanning a large fixed block range.

create table if not exists public.indexer_state (
  chain_id integer not null,
  game_id text not null,
  last_indexed_block numeric not null default 0 check (last_indexed_block >= 0),
  updated_at timestamptz not null default now(),
  primary key (chain_id, game_id)
);

alter table public.indexer_state enable row level security;

revoke all on table public.indexer_state from anon, authenticated;
