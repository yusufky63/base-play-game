# 06 — Database (Supabase)

> Supabase: [supabase.com/docs](https://supabase.com/docs)
> Realtime: [supabase.com/docs/guides/realtime](https://supabase.com/docs/guides/realtime)
> RLS: [supabase.com/docs/guides/auth/row-level-security](https://supabase.com/docs/guides/auth/row-level-security)
> CLI: [supabase.com/docs/reference/cli](https://supabase.com/docs/reference/cli)

---

## Setup

```
1. Create project at app.supabase.com
2. Note: Project URL and anon key (for frontend)
3. Note: Service role key (for backend only — never expose)
4. Dashboard → Database → Extensions → enable pg_cron
5. Run migrations below in order via SQL Editor
```

---

## Migration 001 — init.sql

```sql
-- Players table
create table public.players (
  wallet_address  text        primary key,
  username        text,
  avatar_seed     text        not null default gen_random_uuid()::text,
  referral_code   text        unique not null
                              default upper(substring(gen_random_uuid()::text, 1, 8)),
  referrer        text        references public.players(wallet_address),
  created_at      timestamptz not null default now()
);

-- All game rounds (one row per settled round)
create table public.game_rounds (
  id              uuid        primary key default gen_random_uuid(),
  tx_hash         text        unique,
  vrf_request_id  text        unique,
  player          text        not null,
  game_id         text        not null,
  chain_id        integer     not null,
  bet_amount      numeric     not null check (bet_amount > 0),
  payout          numeric     not null default 0 check (payout >= 0),
  multiplier      numeric,
  won             boolean     not null,
  settled_at      timestamptz not null default now()
);

-- Indexes for common query patterns
create index idx_rounds_player    on public.game_rounds(player);
create index idx_rounds_game_id   on public.game_rounds(game_id);
create index idx_rounds_chain_id  on public.game_rounds(chain_id);
create index idx_rounds_won       on public.game_rounds(won) where won = true;
create index idx_rounds_settled   on public.game_rounds(settled_at desc);

-- Admin-managed game config (mirrors games.registry.ts)
create table public.game_configs (
  game_id          text        not null,
  chain_id         integer     not null,
  contract_address text        not null,
  is_active        boolean     not null default true,
  min_bet_eth      numeric,
  max_bet_eth      numeric,
  house_edge_pct   numeric,
  updated_at       timestamptz not null default now(),
  primary key (game_id, chain_id)
);
```

---

## Migration 002 — leaderboard.sql

```sql
-- Weekly leaderboard (one row per player per week)
create table public.leaderboard_weekly (
  id            uuid        primary key default gen_random_uuid(),
  player        text        not null,
  week_start    date        not null,   -- ISO Monday of the week
  game_count    integer     not null default 0,
  total_wagered numeric     not null default 0,
  net_profit    numeric     not null default 0,
  biggest_win   numeric     not null default 0,
  updated_at    timestamptz not null default now(),
  unique (player, week_start)
);

-- Index for ranking queries
create index idx_lb_week_profit
  on public.leaderboard_weekly(week_start, net_profit desc);

-- Trigger: update leaderboard on every new settled round
create or replace function public.fn_update_leaderboard()
returns trigger
language plpgsql
security definer
as $$
declare
  v_week date := date_trunc('week', new.settled_at)::date;
begin
  insert into public.leaderboard_weekly
    (player, week_start, game_count, total_wagered, net_profit, biggest_win)
  values
    (new.player, v_week, 1, new.bet_amount,
     new.payout - new.bet_amount,
     greatest(new.payout, 0))
  on conflict (player, week_start) do update set
    game_count    = leaderboard_weekly.game_count    + 1,
    total_wagered = leaderboard_weekly.total_wagered + new.bet_amount,
    net_profit    = leaderboard_weekly.net_profit    + (new.payout - new.bet_amount),
    biggest_win   = greatest(leaderboard_weekly.biggest_win, new.payout),
    updated_at    = now();
  return new;
end;
$$;

create trigger trg_update_leaderboard
  after insert on public.game_rounds
  for each row execute function public.fn_update_leaderboard();

-- pg_cron: purge leaderboard rows older than 30 weeks every Monday at midnight UTC
-- Requires pg_cron extension to be enabled in Supabase Dashboard → Extensions
select cron.schedule(
  'purge-old-leaderboard',
  '0 0 * * 1',
  $$
    delete from public.leaderboard_weekly
    where week_start < (date_trunc('week', now()) - interval '30 weeks')::date;
  $$
);
```

---

## Migration 003 — rls_policies.sql

```sql
-- Enable RLS on all user-facing tables
alter table public.game_rounds        enable row level security;
alter table public.leaderboard_weekly enable row level security;
alter table public.players            enable row level security;
alter table public.game_configs       enable row level security;

-- game_rounds: anyone can read the last 24 hours (live feed)
create policy "read_recent_rounds"
  on public.game_rounds for select
  using (settled_at > now() - interval '24 hours');

-- leaderboard_weekly: public read
create policy "read_leaderboard"
  on public.leaderboard_weekly for select
  using (true);

-- game_configs: public read (so UI can display active games)
create policy "read_game_configs"
  on public.game_configs for select
  using (true);

-- players: public read (for basename display in leaderboard)
create policy "read_players"
  on public.players for select
  using (true);

-- Backend uses service_role key which bypasses RLS — no policies needed for write

-- Enable Realtime on relevant tables
alter publication supabase_realtime add table public.game_rounds;
alter publication supabase_realtime add table public.leaderboard_weekly;
```

---

## Type Generation

Run after any schema change to keep TypeScript types in sync.

```bash
npx supabase gen types typescript \
  --project-id YOUR_SUPABASE_PROJECT_ID \
  --schema public \
  > packages/shared/types/supabase.types.ts
```

---

## Supabase Clients

```ts
// packages/frontend/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@baseplay/shared/types/supabase.types";

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    realtime: { params: { eventsPerSecond: 10 } },
    auth:     { persistSession: false },
  }
);

// packages/backend/src/supabase/client.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { env }           from "../config/env";

// Service role — full access, never send to client
export const supabaseAdmin = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);
```

---

## Table Reference

| Table | Writer | Reader | Purpose |
|-------|--------|--------|---------|
| `game_rounds` | Backend (service role) | Public (last 24h) | All settled rounds |
| `leaderboard_weekly` | Trigger (auto) | Public | Weekly rankings |
| `players` | Backend | Public | Wallet profiles |
| `game_configs` | Backend / owner | Public | Active game settings |
| `player_stats` | Trigger (auto) | Public | Lifetime XP, streak, and player totals |
| `platform_stats` | Trigger/backfill | Public | Global round, wager, payout, and profit totals |
| `game_stats` | Trigger/backfill | Public | Per-game aggregate counts and economics |
| `player_game_stats` | Trigger/backfill | Public | Per-player per-game totals for profiles |
| `leaderboard_weekly_ranked` | View | Public | Weekly XP and profit ranks |
| `lucky_draw_config` | Backend/admin | Public read | Draw status, required rounds, ETH reference, prize weights |
| `lucky_draw_progress` | Trigger/function | Public read | Per-player qualified rounds and available draw count |
| `lucky_draw_rounds` | Trigger/function | Backend only | Private counted-round ledger, one row per qualifying round |
| `lucky_draw_results` | Historical/admin | Public read | Historical off-chain draw result rows from the pre-contract flow |

---

## Migration 004 - xp_streak_system.sql

Adds off-chain progression without changing game contract math:

- `game_rounds.xp_earned`: assigned before insert.
- `player_stats`: lifetime XP, level, current daily streak, longest streak, total rounds, total wagered, net profit.
- `leaderboard_weekly.xp`, `level`, `current_streak`: weekly XP ranking data.
- XP formula: `10 base XP + capped wager XP + 5 win bonus`.
- Daily streak increments once per UTC day when the player has a settled round; same-day extra rounds keep the streak unchanged.

Leaderboard sorting:

- XP tab: `xp desc`, tie-break by `net_profit desc`.
- Profit tab: `net_profit desc`, tie-break by `biggest_win desc`.
- UI pages results 50 rows at a time; it should not render every player at once for large seasons.

---

## Migration 005 - profile_stats_and_feed_pagination.sql

Adds the production data layer for cached global stats, game counts, profile summaries, and paginated feeds:

- `platform_stats`: one-row global totals for rounds, players, wagered amount, payout amount, and net profit.
- `game_stats`: per-game totals, win/loss counts, biggest win, wagered amount, payout amount, and net profit.
- `player_game_stats`: per-player game summaries used by `/profile/[address]`.
- `leaderboard_weekly_ranked`: security-invoker view that exposes weekly XP rank and profit rank.
- Composite indexes for feed pagination:
  - `game_rounds(settled_at desc, id desc)`
  - `game_rounds(game_id, settled_at desc, id desc)`
  - `game_rounds(player, settled_at desc, id desc)`
- Trigger `fn_update_aggregate_stats()` updates platform, game, and player-game aggregates when a settled round is inserted.
- Backfill statements rebuild aggregate rows from existing `game_rounds`.
- RLS is enabled on new public tables and read policies are explicit.
- `GRANT SELECT` is included for `anon` and `authenticated` because new Supabase tables may not be exposed to the Data API automatically.

Operational note: the migration file exists locally, but applying it to the remote project requires an authenticated Supabase MCP/CLI session.

---

## Lucky Draw Schema

Lucky Draw progress is tracked in Supabase, but new claims are handled by the on-chain `LuckyDraw` contract.

- Migration `20260514091500_lucky_draw.sql` adds `lucky_draw_config`, `lucky_draw_progress`, `lucky_draw_rounds`, `lucky_draw_results`, `fn_update_lucky_draw_progress()`, and `fn_claim_lucky_draw(text, text)`.
- Migration `20260514093000_tighten_lucky_draw_grants.sql` removes broad public grants and leaves `anon`/`authenticated` with `SELECT` only on public draw tables.
- Migration `20260515013000_disable_offchain_lucky_draw_claim.sql` drops `fn_claim_lucky_draw(text, text)` so backend/Supabase no longer creates draw randomness or payout rows for new claims.
- All Lucky Draw tables have RLS enabled.
- `lucky_draw_rounds` is not exposed to public clients.
- The backend uses `lucky_draw_rounds` plus indexed `game_rounds.vrf_request_id` rows to prepare proof candidates for the frontend.
- The `LuckyDraw` contract verifies proofs on-chain against approved game contracts, blocks reused request IDs, snapshots the prize table, requests Chainlink VRF, and exposes the resolved claimable ETH prize.
- Default UI reward tiers are `$0.10`, `$0.50`, `$1`, `$2.50`, `$5`, and `$10`, converted to ETH using `lucky_draw_config.eth_usd_reference`, currently `2300`.

Production migration status: Lucky Draw migrations through `disable_offchain_lucky_draw_claim` are applied to Supabase project `base-game` (`buubouudfeyhltsqryam`) through MCP.


