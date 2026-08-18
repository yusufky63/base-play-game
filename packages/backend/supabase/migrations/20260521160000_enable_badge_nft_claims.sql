-- Migration: 20260521160000_enable_badge_nft_claims.sql
-- Enable on-chain NFT claims for BasePlayBadges (ERC-1155) on Base Mainnet

-- 1. Add contract_address and ensure mint_ready is enabled on badge_definitions
alter table public.badge_definitions
  add column if not exists contract_address text default '0x1Ca9E82eBA7967295C3D77404af639B592C268eD';

-- 2. Add claimed_on_chain and mint_tx_hash tracking columns to player_badges
alter table public.player_badges
  add column if not exists claimed_on_chain boolean not null default false,
  add column if not exists mint_tx_hash text,
  add column if not exists minted_at timestamptz;

-- 3. Update all 20 badge definitions to mint_ready = true and dynamic metadata URI
update public.badge_definitions
set
  mint_ready = true,
  contract_address = '0x1Ca9E82eBA7967295C3D77404af639B592C268eD',
  metadata_uri = '/api/badges/' || token_id || '.json',
  updated_at = now()
where token_id is not null;
