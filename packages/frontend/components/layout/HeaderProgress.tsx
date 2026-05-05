"use client";

import { Flame, Sparkles } from "lucide-react";
import { useAccount } from "wagmi";
import { usePlayerProgress } from "@/hooks/usePlayerProgress";
import { levelProgress } from "@/lib/progression";

export function HeaderProgress() {
  const { isConnected } = useAccount();
  const { progress, ready } = usePlayerProgress();

  if (!isConnected) return null;

  const xp = progress?.lifetime_xp ?? 0;
  const level = progress?.level ?? 1;
  const streak = progress?.current_streak ?? 0;
  const bar = levelProgress(xp, level);

  return (
    <div className="header-progress hidden min-w-[172px] items-center gap-3 px-3 lg:flex">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 font-mono text-[10px] font-bold uppercase">
          <span className="flex items-center gap-1 text-[var(--text-1)]">
            <Sparkles size={12} className="text-[var(--accent)]" />
            {ready ? `Lv ${level}` : "Loading"}
          </span>
          <span className="text-[var(--text-3)]">{xp} XP</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
          <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${bar.percent}%` }} />
        </div>
      </div>
      <div className="header-streak" title="Daily streak">
        <Flame size={13} />
        {streak}d
      </div>
    </div>
  );
}
