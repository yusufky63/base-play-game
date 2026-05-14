"use client";

import { useEffect, useMemo, useState } from "react";
import { Gift, Loader2, Pause, Play, Save } from "lucide-react";
import { AdminMetric, AdminShell } from "@/components/admin/AdminShell";
import { useLuckyDrawAdmin, useUpdateLuckyDrawConfig, useUpdateLuckyDrawResult, type LuckyDrawPrize } from "@/hooks/useLuckyDraw";
import { shortenAddress } from "@/lib/formatters";

type PrizeForm = Pick<LuckyDrawPrize, "usd" | "weight">;

export default function AdminLuckyDrawPage() {
  const admin = useLuckyDrawAdmin();
  const updateConfig = useUpdateLuckyDrawConfig();
  const updateResult = useUpdateLuckyDrawResult();
  const [enabled, setEnabled] = useState(true);
  const [roundsRequired, setRoundsRequired] = useState(10);
  const [minBetEth, setMinBetEth] = useState(0);
  const [ethUsdReference, setEthUsdReference] = useState(2300);
  const [pausedReason, setPausedReason] = useState("");
  const [prizes, setPrizes] = useState<PrizeForm[]>([]);
  const totalWeight = useMemo(() => prizes.reduce((sum, prize) => sum + Number(prize.weight || 0), 0), [prizes]);
  const claimableCount = admin.data?.recentResults.filter((result) => result.status === "claimable").length ?? 0;
  const claimableEth = admin.data?.recentResults
    .filter((result) => result.status === "claimable")
    .reduce((sum, result) => sum + Number(result.prize_eth), 0) ?? 0;

  useEffect(() => {
    const config = admin.data?.config;
    if (!config) return;
    setEnabled(config.enabled);
    setRoundsRequired(config.roundsRequired);
    setMinBetEth(config.minBetEth);
    setEthUsdReference(config.ethUsdReference);
    setPausedReason(config.pausedReason ?? "");
    setPrizes(config.prizes.map((prize) => ({ usd: prize.usd, weight: prize.weight })));
  }, [admin.data?.config]);

  function saveConfig() {
    updateConfig.mutate({
      enabled,
      roundsRequired,
      minBetEth,
      ethUsdReference,
      pausedReason,
      prizes
    });
  }

  return (
    <AdminShell title="Lucky Draw" description="Manage the 10-round draw loop, ETH reference pricing, prize weights, and payout queue.">
      <div className="grid gap-3 md:grid-cols-3">
        <AdminMetric label="Status" value={enabled ? "Enabled" : "Paused"} detail={enabled ? "New qualifying rounds can unlock draws" : pausedReason || "Draw claims are paused"} tone={enabled ? "win" : "pending"} />
        <AdminMetric label="Claimable" value={String(claimableCount)} detail={`${formatEth(claimableEth)} ETH awaiting payout`} tone={claimableCount > 0 ? "pending" : undefined} />
        <AdminMetric label="Reference" value={`$${ethUsdReference}`} detail="Used to convert USD prize tiers into ETH-denominated rewards" />
      </div>

      <section className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="panel p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase text-[var(--text-3)]">
                <Gift size={14} className="text-[var(--accent)]" />
                Draw config
              </div>
              <h2 className="mt-2 display-heading text-xl font-bold text-[var(--text-1)]">Reward controls</h2>
            </div>
            <button type="button" onClick={() => setEnabled((current) => !current)} className="play-button-ghost inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-bold">
              {enabled ? <Pause size={14} /> : <Play size={14} />}
              {enabled ? "Pause" : "Enable"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="admin-field">
              <span>Rounds required</span>
              <input type="number" min={1} max={500} value={roundsRequired} onChange={(event) => setRoundsRequired(Number(event.target.value))} />
            </label>
            <label className="admin-field">
              <span>Min bet ETH</span>
              <input type="number" min={0} step="0.000001" value={minBetEth} onChange={(event) => setMinBetEth(Number(event.target.value))} />
            </label>
            <label className="admin-field">
              <span>ETH/USD reference</span>
              <input type="number" min={1} step="1" value={ethUsdReference} onChange={(event) => setEthUsdReference(Number(event.target.value))} />
            </label>
          </div>

          <label className="admin-field mt-3">
            <span>Pause reason</span>
            <input value={pausedReason} onChange={(event) => setPausedReason(event.target.value)} placeholder="Optional player-facing pause reason" />
          </label>

          <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border)]">
            <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-[10px] uppercase text-[var(--text-3)]">
              <span>USD</span>
              <span>ETH</span>
              <span>Weight</span>
            </div>
            {prizes.map((prize, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_1fr] gap-2 border-b border-[var(--border)] px-3 py-2 last:border-b-0">
                <input className="admin-table-input" type="number" min={0.01} step="0.01" value={prize.usd} onChange={(event) => updatePrize(index, "usd", Number(event.target.value), prizes, setPrizes)} />
                <div className="flex items-center font-mono text-xs text-[var(--text-2)]">{formatEth(prize.usd / Math.max(1, ethUsdReference))}</div>
                <input className="admin-table-input" type="number" min={1} step="1" value={prize.weight} onChange={(event) => updatePrize(index, "weight", Number(event.target.value), prizes, setPrizes)} />
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-2 text-xs text-[var(--text-2)] sm:flex-row sm:items-center sm:justify-between">
            <span>Total weight: {totalWeight.toLocaleString()}</span>
            <button type="button" onClick={saveConfig} disabled={updateConfig.isPending || prizes.length === 0} className="primary-action inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold text-white disabled:opacity-45">
              {updateConfig.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save config
            </button>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h2 className="display-heading text-xl font-bold text-[var(--text-1)]">Recent draws</h2>
            <p className="mt-1 text-xs text-[var(--text-2)]">Mark ETH payouts after sending the reward transaction from the payout wallet.</p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {admin.isLoading && <div className="p-4 text-sm text-[var(--text-2)]">Loading Lucky Draw state...</div>}
            {!admin.isLoading && (admin.data?.recentResults ?? []).map((result) => (
              <div key={result.id} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1fr_150px_180px] md:items-center">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-[var(--text-1)]">{shortenAddress(result.player, 5)}</div>
                  <div className="mt-1 font-mono text-[11px] text-[var(--text-3)]">{new Date(result.created_at).toLocaleString()}</div>
                </div>
                <div>
                  <div className="font-mono font-bold text-[var(--accent)]">{formatEth(Number(result.prize_eth))} ETH</div>
                  <div className="font-mono text-[11px] text-[var(--text-3)]">${Number(result.prize_usd).toFixed(2)} at ${Number(result.eth_usd_reference).toFixed(0)}</div>
                </div>
                <ResultControls
                  result={result}
                  pending={updateResult.isPending}
                  onUpdate={(status, payoutTxHash) => updateResult.mutate({ id: result.id, status, payoutTxHash })}
                />
              </div>
            ))}
            {!admin.isLoading && (admin.data?.recentResults.length ?? 0) === 0 && <div className="p-4 text-sm text-[var(--text-3)]">No draw results yet.</div>}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}

function ResultControls({
  result,
  pending,
  onUpdate
}: {
  result: { id: string; status: "claimable" | "paid" | "voided"; payout_tx_hash: string | null };
  pending: boolean;
  onUpdate: (status: "claimable" | "paid" | "voided", payoutTxHash?: string | null) => void;
}) {
  const [txHash, setTxHash] = useState(result.payout_tx_hash ?? "");

  return (
    <div className="grid gap-2">
      <select
        value={result.status}
        disabled={pending}
        onChange={(event) => onUpdate(event.target.value as "claimable" | "paid" | "voided", txHash)}
        className="h-9 rounded-md border border-[var(--border-2)] bg-[var(--surface)] px-2 text-xs text-[var(--text-1)] outline-none"
      >
        <option value="claimable">Claimable</option>
        <option value="paid">Paid</option>
        <option value="voided">Voided</option>
      </select>
      <div className="flex gap-2">
        <input
          value={txHash}
          onChange={(event) => setTxHash(event.target.value)}
          placeholder="Payout tx hash"
          className="h-9 min-w-0 flex-1 rounded-md border border-[var(--border-2)] bg-[var(--surface)] px-2 font-mono text-xs text-[var(--text-1)] outline-none"
        />
        <button type="button" disabled={pending} onClick={() => onUpdate(result.status, txHash)} className="play-button-ghost h-9 rounded-md px-3 text-xs font-bold disabled:opacity-45">
          Save
        </button>
      </div>
    </div>
  );
}

function updatePrize(index: number, key: "usd" | "weight", value: number, prizes: PrizeForm[], setPrizes: (prizes: PrizeForm[]) => void) {
  setPrizes(prizes.map((prize, currentIndex) => (currentIndex === index ? { ...prize, [key]: value } : prize)));
}

function formatEth(value: number) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 8 });
}
