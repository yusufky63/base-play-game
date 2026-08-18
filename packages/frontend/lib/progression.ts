export function calculateRoundXp(betAmountEth: number, _won: boolean) {
  if (!Number.isFinite(betAmountEth) || betAmountEth <= 0) return 0;
  const wagerXp = Math.min(Math.floor(betAmountEth / 0.0001) * 3, 60);
  return 5 + wagerXp;
}

export function levelFromXp(xp: number) {
  if (!Number.isFinite(xp) || xp <= 0) return 1;
  return Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
}

export function levelProgress(xp: number, level = levelFromXp(xp)) {
  const previousLevelXp = Math.max(0, (level - 1) * (level - 1) * 100);
  const nextLevelXp = level * level * 100;
  const span = Math.max(1, nextLevelXp - previousLevelXp);
  const current = Math.max(0, xp - previousLevelXp);
  return {
    current,
    required: span,
    percent: Math.min(100, Math.max(0, Math.round((current / span) * 100))),
    nextLevelXp
  };
}

export function currentDailyStreak(dates: string[]) {
  const uniqueDays = [...new Set(dates.map((date) => date.slice(0, 10)))].sort().reverse();
  if (uniqueDays.length === 0) return 0;

  const today = toDateKey(new Date());
  const yesterday = toDateKey(addDays(new Date(), -1));
  if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) return 0;

  let streak = 1;
  let cursor = uniqueDays[0];
  for (const day of uniqueDays.slice(1)) {
    const expectedPrevious = toDateKey(addDays(new Date(`${cursor}T00:00:00Z`), -1));
    if (day !== expectedPrevious) break;
    streak += 1;
    cursor = day;
  }

  return streak;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
