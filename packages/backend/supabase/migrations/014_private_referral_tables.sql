-- Public API grants should be read-only. RLS policies already restrict rows,
-- but trimming table privileges avoids accidental write exposure through REST.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon, authenticated;

grant select on table public.game_configs to anon, authenticated;
grant select on table public.game_rounds to anon, authenticated;
grant select on table public.leaderboard_weekly to anon, authenticated;
grant select on table public.platform_stats to anon, authenticated;
grant select on table public.game_stats to anon, authenticated;
grant select on table public.player_game_stats to anon, authenticated;
grant select on table public.player_stats to anon, authenticated;
grant select on table public.quest_definitions to anon, authenticated;
grant select on table public.player_quest_progress to anon, authenticated;
grant select on table public.badge_definitions to anon, authenticated;
grant select on table public.player_badges to anon, authenticated;
grant select on table public.round_events to anon, authenticated;
grant select on public.leaderboard_weekly_ranked to anon, authenticated;
grant select on public.player_quest_summary to anon, authenticated;
grant select on public.player_badge_summary to anon, authenticated;

-- Referral rows expose invite relationships and reward history. Keep that data
-- behind the backend referral API, which uses the service role and rate limits.
drop policy if exists "read_referral_codes" on public.referral_codes;
drop policy if exists "read_player_referrals" on public.player_referrals;
drop policy if exists "read_referral_rewards" on public.referral_rewards;

revoke all on table public.referral_codes from anon, authenticated;
revoke all on table public.player_referrals from anon, authenticated;
revoke all on table public.referral_rewards from anon, authenticated;
revoke select on public.player_referral_summary from anon, authenticated;

grant select on table public.referral_codes to service_role;
grant select on table public.player_referrals to service_role;
grant select on table public.referral_rewards to service_role;
grant select on public.player_referral_summary to service_role;
