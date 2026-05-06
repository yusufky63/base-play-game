"use client";

import { useEffect, useState } from "react";
import { createPublicClient, fallback, formatEther, http, parseEther } from "viem";
import { useWriteContract } from "wagmi";
import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { AdminMetric, AdminShell } from "@/components/admin/AdminShell";
import { getSupabaseBrowser } from "@/lib/supabase";
import { fetchRecentOnchainRounds, type OnchainRound } from "@/lib/onchainRounds";
import { formatEth, formatUsd } from "@/lib/formatters";
import { useEthUsdPrice } from "@/hooks/useEthUsdPrice";
import { useToast } from "@/components/ui/ToastProvider";
import { betPresetAmounts } from "@/lib/env";
import { getDefaultNetworkConfig } from "@/lib/networkConfig";

const vaultAbi = [
  { type: "function", name: "vaultBalance", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "minBet", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "maxBet", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "houseEdgeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "availableLiquidity", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalReservedPayout", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "setMinBet", stateMutability: "nonpayable", inputs: [{ type: "uint256", name: "newMin" }], outputs: [] },
  { type: "function", name: "setMaxBet", stateMutability: "nonpayable", inputs: [{ type: "uint256", name: "newMax" }], outputs: [] },
  { type: "function", name: "setHouseEdge", stateMutability: "nonpayable", inputs: [{ type: "uint256", name: "newBps" }], outputs: [] },
  { type: "function", name: "pause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "unpause", stateMutability: "nonpayable", inputs: [], outputs: [] }
] as const;

type Round = Database["public"]["Tables"]["game_rounds"]["Row"];
type RiskRound = Round | OnchainRound;
const defaultNetwork = getDefaultNetworkConfig();

export default function AdminVaultPage() {
  const ethUsd = useEthUsdPrice();
  const toast = useToast();
  const { writeContractAsync, isPending } = useWriteContract();
  const [state, setState] = useState({
    balance: "",
    minBet: "",
    maxBet: "",
    houseEdge: "",
    availableLiquidity: "",
    reserved: "",
    reservationReady: false,
    paused: false
  });
  const [controls, setControls] = useState({
    minBetEth: "0.0002",
    maxBetEth: "0.001",
    houseEdgePct: "3"
  });
  const [risk, setRisk] = useState({
    rounds: 0,
    wagered: 0,
    paid: 0,
    vaultProfit: 0,
    winRate: 0,
    payoutRatio: 0
  });
  const vaultAddress = CONTRACT_ADDRESSES[defaultNetwork.chainId]?.GameVault;

  useEffect(() => {
    if (!vaultAddress) return;

    const client = createPublicClient({
      chain: defaultNetwork.viemChain,
      transport: fallback(defaultNetwork.rpcUrls.map((url) => http(url, { timeout: 10_000 })))
    });

    async function load() {
      const [balance, minBet, maxBet, houseEdgeBps, paused] = await Promise.all([
        client.readContract({ address: vaultAddress, abi: vaultAbi, functionName: "vaultBalance" }),
        client.readContract({ address: vaultAddress, abi: vaultAbi, functionName: "minBet" }),
        client.readContract({ address: vaultAddress, abi: vaultAbi, functionName: "maxBet" }),
        client.readContract({ address: vaultAddress, abi: vaultAbi, functionName: "houseEdgeBps" }),
        client.readContract({ address: vaultAddress, abi: vaultAbi, functionName: "paused" })
      ]);
      const [availableLiquidity, reserved] = await Promise.all([
        client.readContract({ address: vaultAddress, abi: vaultAbi, functionName: "availableLiquidity" }).catch(() => null),
        client.readContract({ address: vaultAddress, abi: vaultAbi, functionName: "totalReservedPayout" }).catch(() => null)
      ]);

      setState({
        balance: `${formatEther(balance)} ETH`,
        minBet: `${formatEther(minBet)} ETH`,
        maxBet: `${formatEther(maxBet)} ETH`,
        houseEdge: `${Number(houseEdgeBps) / 100}%`,
        availableLiquidity: availableLiquidity === null ? "" : `${formatEther(availableLiquidity)} ETH`,
        reserved: reserved === null ? "" : `${formatEther(reserved)} ETH`,
        reservationReady: availableLiquidity !== null && reserved !== null,
        paused
      });
      setControls({
        minBetEth: formatEther(minBet),
        maxBetEth: formatEther(maxBet),
        houseEdgePct: String(Number(houseEdgeBps) / 100)
      });
    }

    void load();
  }, [vaultAddress]);

  async function writeVault(functionName: "setMinBet" | "setMaxBet" | "setHouseEdge" | "pause" | "unpause", args: readonly unknown[] = []) {
    if (!vaultAddress) return;
    try {
      const hash = await writeContractAsync({
        address: vaultAddress,
        abi: vaultAbi,
        functionName,
        args: args as never
      });
      toast({ tone: "success", title: "Vault transaction sent", description: hash });
    } catch (error) {
      toast({ tone: "error", title: "Vault transaction failed", description: error instanceof Error ? error.message : undefined });
    }
  }

  useEffect(() => {
    async function loadRisk() {
      const supabase = getSupabaseBrowser();
      let rows: RiskRound[] = [];

      if (supabase) {
        const { data, error } = await supabase.from("game_rounds").select("*").order("settled_at", { ascending: false }).limit(1000);
        if (error) {
          console.warn("[BasePlay] Supabase vault risk query failed", error.message);
        }
        rows = data ?? [];
      } else {
        rows = await fetchRecentOnchainRounds({ limit: 1000 });
      }

      const wagered = rows.reduce((sum, row) => sum + Number(row.bet_amount), 0);
      const paid = rows.reduce((sum, row) => sum + Number(row.payout), 0);
      const wins = rows.filter((row) => row.won).length;
      setRisk({
        rounds: rows.length,
        wagered,
        paid,
        vaultProfit: wagered - paid,
        winRate: rows.length ? (wins / rows.length) * 100 : 0,
        payoutRatio: wagered > 0 ? (paid / wagered) * 100 : 0
      });
    }

    void loadRisk();
  }, []);

  return (
    <AdminShell title="Vault" description="Vault health, realized P&L, payout ratio, and risk capacity. Payout values are net after house edge.">
      <div className="grid gap-3 md:grid-cols-3">
        <AdminMetric label="Vault balance" value={state.balance || "Loading"} detail={vaultAddress ?? "No deployed GameVault address"} />
        <AdminMetric label="Available liquidity" value={state.availableLiquidity || state.balance || "Loading"} detail={state.reservationReady ? `${state.reserved} reserved for active max payouts` : "Legacy deployed vault does not expose payout reserves"} />
        <AdminMetric label="House edge" value={state.houseEdge || "Loading"} detail="Read from GameVault" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <AdminMetric label="Estimated vault P&L" value={`${risk.vaultProfit >= 0 ? "+" : ""}${formatEth(risk.vaultProfit)} ETH`} detail={ethUsd ? formatUsd(risk.vaultProfit * ethUsd) : "Wagered minus net paid"} />
        <AdminMetric label="Payout ratio" value={`${risk.payoutRatio.toFixed(1)}%`} detail={`${formatEth(risk.paid)} ETH paid / ${formatEth(risk.wagered)} ETH wagered`} />
        <AdminMetric label="Win rate" value={`${risk.winRate.toFixed(1)}%`} detail={`${risk.rounds} settled rounds indexed`} />
      </div>

      <div className="mt-4 admin-note">
        <div className="mb-4 flex flex-col gap-2 border-b border-[var(--border)] pb-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-[var(--text-1)]">Vault controls</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-2)]">Owner-only settings for bet limits, house edge, and accepting new bets.</p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() => void writeVault(state.paused ? "unpause" : "pause")}
            className="play-button-ghost h-10 rounded-md px-4 text-sm font-bold disabled:opacity-50"
          >
            {state.paused ? "Unpause vault" : "Pause vault"}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <AdminControlInput
            label="Min bet ETH"
            value={controls.minBetEth}
            onChange={(value) => setControls((current) => ({ ...current, minBetEth: value }))}
            onSave={() => void writeVault("setMinBet", [parseEther(controls.minBetEth)])}
            disabled={isPending}
          />
          <AdminControlInput
            label="Max bet ETH"
            value={controls.maxBetEth}
            onChange={(value) => setControls((current) => ({ ...current, maxBetEth: value }))}
            onSave={() => void writeVault("setMaxBet", [parseEther(controls.maxBetEth)])}
            disabled={isPending}
          />
          <AdminControlInput
            label="House edge %"
            value={controls.houseEdgePct}
            onChange={(value) => setControls((current) => ({ ...current, houseEdgePct: value }))}
            onSave={() => void writeVault("setHouseEdge", [BigInt(Math.round(Number(controls.houseEdgePct) * 100))])}
            disabled={isPending}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="admin-note">
          <h2 className="font-semibold text-[var(--text-1)]">Risk model</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
            New contract code reserves the maximum net payout for every round before accepting the bet. This prevents multiple active rounds from promising more than the vault can safely pay.
          </p>
        </div>
        <div className="admin-note">
          <h2 className="font-semibold text-[var(--text-1)]">Payout policy</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
            House edge is deducted only from winning gross payouts. Losing bets stay in the vault as vault profit; there is no extra loss-side fee.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="admin-note">
          <h2 className="font-semibold text-[var(--text-1)]">UI bet presets</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
            Game pages show three quick bet buttons. They are frontend presets, not separate contract limits. Change them with <code>NEXT_PUBLIC_BET_PRESETS_ETH</code>, for example <code>0.0002,0.0005,0.001</code>.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {betPresetAmounts.map((amount) => (
              <div key={amount} className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3 font-mono text-xs font-semibold text-[var(--text-1)]">
                {amount} ETH
              </div>
            ))}
          </div>
        </div>
        <div className="admin-note">
          <h2 className="font-semibold text-[var(--text-1)]">Current deployed vault</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
            If reserve metrics show legacy mode, redeploy the updated vault and games before increasing max bet or adding mainnet liquidity.
          </p>
        </div>
      </div>
    </AdminShell>
  );
}

function AdminControlInput({ label, value, disabled, onChange, onSave }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void; onSave: () => void }) {
  return (
    <label className="grid gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <span className="font-mono text-[10px] font-semibold uppercase text-[var(--text-3)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-[var(--border-2)] bg-[var(--surface)] px-3 font-mono text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
      />
      <button type="button" disabled={disabled} onClick={onSave} className="primary-action h-10 rounded-md px-3 text-sm font-bold text-white disabled:opacity-50">
        Save
      </button>
    </label>
  );
}
