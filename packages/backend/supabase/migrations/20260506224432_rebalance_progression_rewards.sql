-- Rebalance progression so quest bonuses support activity without dominating
-- wager-based XP or referral caps. Existing completed quest rows are left as
-- historical records; these values apply to newly completed quests.
insert into public.quest_definitions
  (id, title, description, period, metric, target, reward_xp, badge_id, sort_order)
values
  ('daily-round-1', 'Play one round', 'Settle one round today.', 'daily', 'rounds', 1, 8, null, 10),
  ('daily-round-5', 'Play five rounds', 'Settle five rounds today.', 'daily', 'rounds', 5, 18, null, 20),
  ('daily-three-games', 'Try three games', 'Settle rounds in three different games today.', 'daily', 'distinct_games', 3, 16, null, 30),
  ('daily-win-1', 'Get a win', 'Win one settled round today.', 'daily', 'wins', 1, 10, null, 40),
  ('daily-round-10', 'Play ten rounds', 'Settle ten rounds today.', 'daily', 'rounds', 10, 30, 'daily-climber', 45),
  ('daily-win-2', 'Win twice', 'Win two settled rounds today.', 'daily', 'wins', 2, 16, null, 46),
  ('daily-five-games', 'Try five games', 'Settle rounds in five different games today.', 'daily', 'distinct_games', 5, 24, 'daily-explorer', 47),
  ('weekly-round-10', 'Weekly grinder', 'Settle ten rounds this week.', 'weekly', 'rounds', 10, 45, 'weekly-grinder', 50),
  ('weekly-five-games', 'Game explorer', 'Settle rounds in five different games this week.', 'weekly', 'distinct_games', 5, 45, 'game-explorer', 60),
  ('weekly-streak-7', 'Seven day streak', 'Keep a seven day streak this week.', 'weekly', 'current_streak', 7, 60, 'seven-day-streak', 70),
  ('weekly-round-25', '25-round week', 'Settle twenty-five rounds this week.', 'weekly', 'rounds', 25, 85, 'twenty-five-rounds', 80),
  ('weekly-win-10', 'Ten-win week', 'Win ten settled rounds this week.', 'weekly', 'wins', 10, 70, 'weekly-winner', 90),
  ('weekly-eight-games', 'Wide board', 'Settle rounds in eight different games this week.', 'weekly', 'distinct_games', 8, 75, 'wide-board', 100)
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
