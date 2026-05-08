"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, ShieldCheck } from "lucide-react";
import { createPublicClient, encodeFunctionData, fallback, formatEther, http, parseEther } from "viem";
import { useAccount, usePublicClient, useSendTransaction, useSwitchChain, useWriteContract } from "wagmi";
import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
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
  { type: "function", name: "unpause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ type: "uint256", name: "amount" }], outputs: [] },
  { type: "function", name: "emergencyWithdraw", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "error", name: "InvalidAmount", inputs: [] },
  { type: "error", name: "EnforcedPause", inputs: [] },
  { type: "error", name: "OwnableUnauthorizedAccount", inputs: [{ type: "address", name: "account" }] }
] as const;

type Round = Database["public"]["Tables"]["game_rounds"]["Row"];
type RiskRound = Round | OnchainRound;
type CallClient = { call: (args: { to: `0x${string}`; data: `0x${string}` }) => Promise<unknown> };
const defaultNetwork = getDefaultNetworkConfig();

export default function AdminVaultPage() {
  const ethUsd = useEthUsdPrice();
  const toast = useToast();
  const { chain } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending: isVaultWritePending } = useWriteContract();
  const { sendTransactionAsync, isPending: isFundPending } = useSendTransaction();
  const [state, setState] = useState({
    balance: "",
    balanceEth: 0,
    minBet: "",
    maxBet: "",
    maxBetEth: 0,
    houseEdge: "",
    houseEdgeBps: 500,
    availableLiquidity: "",
    availableLiquidityEth: 0,
    reserved: "",
    reservedEth: 0,
    reservationReady: false,
    withdrawSupported: false,
    paused: false
  });
  const [controls, setControls] = useState({
    minBetEth: "0.000055",
    maxBetEth: "0.0005",
    houseEdgePct: "5"
  });
  const [fundAmountEth, setFundAmountEth] = useState("0.01");
  const [withdrawAmountEth, setWithdrawAmountEth] = useState("0.001");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [risk, setRisk] = useState({
    rounds: 0,
    wagered: 0,
    paid: 0,
    vaultProfit: 0,
    winRate: 0,
    payoutRatio: 0
  });
  const vaultAddress = CONTRACT_ADDRESSES[defaultNetwork.chainId]?.GameVault;
  const v2VaultAddress = CONTRACT_ADDRESSES[defaultNetwork.chainId]?.GameVaultV2;

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
      const [availableLiquidity, reserved, withdrawSupported] = await Promise.all([
        client.readContract({ address: vaultAddress, abi: vaultAbi, functionName: "availableLiquidity" }).catch(() => null),
        client.readContract({ address: vaultAddress, abi: vaultAbi, functionName: "totalReservedPayout" }).catch(() => null),
        probeWithdrawSupport(client, vaultAddress)
      ]);
      const knownV2Vault = v2VaultAddress?.toLowerCase() === vaultAddress.toLowerCase();

      setState({
        balance: `${formatEther(balance)} ETH`,
        balanceEth: Number(formatEther(balance)),
        minBet: `${formatEther(minBet)} ETH`,
        maxBet: `${formatEther(maxBet)} ETH`,
        maxBetEth: Number(formatEther(maxBet)),
        houseEdge: `${Number(houseEdgeBps) / 100}%`,
        houseEdgeBps: Number(houseEdgeBps),
        availableLiquidity: availableLiquidity === null ? "" : `${formatEther(availableLiquidity)} ETH`,
        availableLiquidityEth: availableLiquidity === null ? Number(formatEther(balance)) : Number(formatEther(availableLiquidity)),
        reserved: reserved === null ? "" : `${formatEther(reserved)} ETH`,
        reservedEth: reserved === null ? 0 : Number(formatEther(reserved)),
        reservationReady: availableLiquidity !== null && reserved !== null,
        withdrawSupported: knownV2Vault || withdrawSupported,
        paused
      });
      setControls({
        minBetEth: formatEther(minBet),
        maxBetEth: formatEther(maxBet),
        houseEdgePct: String(Number(houseEdgeBps) / 100)
      });
    }

    void load();
  }, [v2VaultAddress, vaultAddress, refreshNonce]);

  async function ensureAdminNetwork() {
    if (chain?.id === defaultNetwork.chainId) return;
    await switchChainAsync({ chainId: defaultNetwork.chainId });
  }

  async function writeVault(functionName: "setMinBet" | "setMaxBet" | "setHouseEdge" | "pause" | "unpause" | "withdraw" | "emergencyWithdraw", args: readonly unknown[] = []) {
    if (!vaultAddress) return;
    try {
      await ensureAdminNetwork();
      const hash = await writeContractAsync({
        address: vaultAddress,
        abi: vaultAbi,
        functionName,
        args: args as never
      });
      toast({ tone: "success", title: "Vault transaction sent", description: hash });
      await publicClient?.waitForTransactionReceipt({ hash });
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      toast({ tone: "error", title: "Vault transaction failed", description: error instanceof Error ? error.message : undefined });
    }
  }

  async function withdrawAvailableLiquidity() {
    if (!vaultAddress) return;
    if (!state.withdrawSupported) {
      toast({ tone: "error", title: "Withdraw unavailable", description: "The deployed vault does not include amount-based withdraw. Deploy GameVaultV2 to enable it." });
      return;
    }
    if (!state.paused) {
      toast({ tone: "error", title: "Pause required", description: "Pause the vault before withdrawing available liquidity." });
      return;
    }

    const value = parseEthControl(withdrawAmountEth);
    if (value === null) return;
    if (value <= 0n) {
      toast({ tone: "error", title: "Invalid withdraw amount", description: "Use an ETH amount greater than zero." });
      return;
    }
    if (Number(formatEther(value)) > state.availableLiquidityEth) {
      toast({ tone: "error", title: "Amount exceeds available liquidity", description: "Withdraw only the available liquidity amount. Reserved payouts stay protected." });
      return;
    }

    await writeVault("withdraw", [value]);
  }

  async function fundVault() {
    if (!vaultAddress) return;
    const value = parseEthControl(fundAmountEth);
    if (value === null) return;
    if (value <= 0n) {
      toast({ tone: "error", title: "Invalid funding amount", description: "Use an ETH amount greater than zero." });
      return;
    }

    try {
      await ensureAdminNetwork();
      const hash = await sendTransactionAsync({ to: vaultAddress, value });
      toast({ tone: "success", title: "Vault funding sent", description: hash });
      await publicClient?.waitForTransactionReceipt({ hash });
      setRefreshNonce((current) => current + 1);
      toast({ tone: "success", title: "Vault funded", description: `${fundAmountEth} ETH was sent to the vault.` });
    } catch (error) {
      toast({ tone: "error", title: "Vault funding failed", description: error instanceof Error ? error.message : undefined });
    }
  }

  function parseEthControl(value: string) {
    try {
      return parseEther(value);
    } catch {
      toast({ tone: "error", title: "Invalid ETH amount", description: "Use a numeric ETH value such as 0.0005." });
      return null;
    }
  }

  function parseHouseEdgeControl(value: string) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      toast({ tone: "error", title: "Invalid house edge", description: "Use a non-negative percentage value." });
      return null;
    }
    return BigInt(Math.round(numeric * 100));
  }

  async function probeWithdrawSupport(client: CallClient, address: `0x${string}`) {
    try {
      await client.call({
        to: address,
        data: encodeFunctionData({ abi: vaultAbi, functionName: "withdraw", args: [0n] })
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "");
      const revertData = extractRevertData(error);
      return (
        (typeof revertData === "string" && revertData !== "0x") ||
        message.includes("InvalidAmount") ||
        message.includes("EnforcedPause") ||
        message.includes("OwnableUnauthorizedAccount")
      );
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

  const maxGrossMultiplier = Math.max(...GAMES_REGISTRY.map((game) => game.maxMultiplier));
  const maxNetReserve = state.maxBetEth * maxGrossMultiplier * (1 - state.houseEdgeBps / 10_000);
  const safeRoundCapacity = maxNetReserve > 0 ? state.availableLiquidityEth / maxNetReserve : 0;
  const liquidityTone = safeRoundCapacity < 3 ? "loss" : safeRoundCapacity < 10 ? "pending" : "win";
  const liquidityUsd = ethUsd ? formatUsd(state.availableLiquidityEth * ethUsd) : "USD pending";

  return (
    <AdminShell title="Vault" description="Vault health, realized P&L, payout ratio, and risk capacity. Payout values are net after house edge.">
      <div className="grid gap-3 md:grid-cols-3">
        <AdminMetric label="Vault balance" value={state.balance || "Loading"} detail={ethUsd ? formatUsd(state.balanceEth * ethUsd) : vaultAddress ?? "No deployed GameVault address"} />
        <AdminMetric label="Available liquidity" value={state.availableLiquidity || state.balance || "Loading"} detail={`${liquidityUsd} · ${state.reservationReady ? `${state.reserved} reserved` : "Legacy reserve view"}`} tone={liquidityTone} />
        <AdminMetric label="House edge" value={state.houseEdge || "Loading"} detail="Read from GameVault" />
      </div>

      <div className="mt-4 admin-note">
        <div className="mb-4 flex flex-col gap-2 border-b border-[var(--border)] pb-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-[var(--text-1)]">Fund vault</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-2)]">
              Send ETH from the connected owner wallet directly to the deployed GameVault. Current vault contracts accept plain ETH transfers.
            </p>
          </div>
          <button
            type="button"
            disabled={isFundPending || !vaultAddress}
            onClick={() => void fundVault()}
            className="primary-action h-10 rounded-md px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {isFundPending ? "Funding..." : "Fund vault"}
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="grid gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase text-[var(--text-3)]">Funding amount ETH</span>
            <input
              value={fundAmountEth}
              onChange={(event) => setFundAmountEth(event.target.value)}
              className="h-10 rounded-md border border-[var(--border-2)] bg-[var(--surface)] px-3 font-mono text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
            />
          </label>
          <div className="grid grid-cols-3 gap-2 md:w-[270px]">
            {["0.01", "0.05", "0.1"].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setFundAmountEth(amount)}
                className="play-button-ghost h-10 rounded-md px-3 font-mono text-xs font-bold"
              >
                {amount}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`mt-4 admin-alert ${liquidityTone === "loss" ? "admin-danger" : ""}`}>
        <div className="flex items-start gap-3">
          {liquidityTone === "win" ? <ShieldCheck size={18} className="text-[var(--win)]" /> : <AlertTriangle size={18} className={liquidityTone === "loss" ? "text-[var(--lose)]" : "text-[var(--pending)]"} />}
          <div>
            <div className="font-bold text-[var(--text-1)]">
              {liquidityTone === "win" ? "Liquidity looks healthy" : liquidityTone === "pending" ? "Liquidity buffer is getting thin" : "Critical liquidity buffer"}
            </div>
            <p className="mt-1 text-sm leading-6">
              Available liquidity can cover about {Number.isFinite(safeRoundCapacity) ? safeRoundCapacity.toFixed(1) : "0.0"} max-risk rounds at current max bet. Review max bet, vault funding, and Scratch/Plinko/Slots exposure before increasing limits.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <AdminMetric label="Estimated vault P&L" value={`${risk.vaultProfit >= 0 ? "+" : ""}${formatEth(risk.vaultProfit)} ETH`} detail={ethUsd ? formatUsd(risk.vaultProfit * ethUsd) : "Wagered minus net paid"} />
        <AdminMetric label="Payout ratio" value={`${risk.payoutRatio.toFixed(1)}%`} detail={`${formatEth(risk.paid)} ETH paid / ${formatEth(risk.wagered)} ETH wagered`} />
        <AdminMetric label="Win rate" value={`${risk.winRate.toFixed(1)}%`} detail={`${risk.rounds} settled rounds indexed`} />
      </div>

      <div className="mt-4 admin-note">
        <div className="mb-4 flex flex-col gap-2 border-b border-[var(--border)] pb-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-[var(--text-1)]">Available withdraw</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-2)]">
              Withdraw a specific ETH amount from available liquidity while the vault is paused. Reserved payouts remain protected.
            </p>
          </div>
          <button
            type="button"
            disabled={isVaultWritePending || !state.paused || !state.withdrawSupported}
            onClick={() => void withdrawAvailableLiquidity()}
            className="primary-action h-10 rounded-md px-4 text-sm font-bold text-white disabled:opacity-45"
            title={!state.withdrawSupported ? "Deploy GameVaultV2 to enable amount-based withdraw" : state.paused ? "Withdraw available liquidity to owner" : "Pause vault before withdraw"}
          >
            Withdraw amount
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="grid gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase text-[var(--text-3)]">Withdraw amount ETH</span>
            <input
              value={withdrawAmountEth}
              disabled={!state.withdrawSupported}
              onChange={(event) => setWithdrawAmountEth(event.target.value)}
              className="h-10 rounded-md border border-[var(--border-2)] bg-[var(--surface)] px-3 font-mono text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)] disabled:text-[var(--text-3)]"
              aria-label="Withdraw amount"
            />
          </label>
          <div className="grid grid-cols-3 gap-2 md:w-[270px]">
            {[
              { label: "25%", value: state.availableLiquidityEth * 0.25 },
              { label: "50%", value: state.availableLiquidityEth * 0.5 },
              { label: "Max", value: state.availableLiquidityEth }
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={!state.withdrawSupported}
                onClick={() => setWithdrawAmountEth(formatEth(preset.value))}
                className="play-button-ghost h-10 rounded-md px-3 font-mono text-xs font-bold disabled:opacity-45"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div className={`mt-3 rounded-md border p-3 text-sm leading-6 ${state.withdrawSupported ? "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]" : "border-[color-mix(in_srgb,var(--pending)_35%,transparent)] bg-[color-mix(in_srgb,var(--pending)_8%,transparent)] text-[var(--text-2)]"}`}>
          {state.withdrawSupported
            ? state.paused
              ? "Vault is paused. Amount-based withdraw is available up to the available liquidity value."
              : "Pause the vault first. Amount-based withdraw is intentionally blocked while games can accept new bets."
            : "Current mainnet GameVault does not include amount-based withdraw. It is available in GameVaultV2, so a vault redeploy is required before this button can be enabled."}
        </div>
      </div>

      <div className="mt-4 admin-note">
        <div className="mb-4 flex flex-col gap-2 border-b border-[var(--border)] pb-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-[var(--text-1)]">Emergency withdraw</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-2)]">
              Full paused-vault drain to the owner wallet. Use only after active rounds are resolved or intentionally abandoned.
            </p>
          </div>
          <button
            type="button"
            disabled={isVaultWritePending || !state.paused}
            onClick={() => void writeVault("emergencyWithdraw")}
            className="play-button-ghost h-10 rounded-md px-4 text-sm font-bold text-[var(--lose)] disabled:opacity-45"
            title={state.paused ? "Withdraw full paused vault balance to owner" : "Pause vault before emergency withdraw"}
          >
            Emergency withdraw
          </button>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm leading-6 text-[var(--text-2)]">
          {!state.paused ? "Pause the vault first to unlock emergency withdraw. " : "Vault is paused, so full emergency withdraw is available. "}
          Before draining funds, resolve or refund active rounds where possible. A full emergency withdraw can leave pending payout/refund paths without liquidity.
        </div>
      </div>

      <div className="mt-4 admin-note">
        <div className="mb-4 flex flex-col gap-2 border-b border-[var(--border)] pb-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-[var(--text-1)]">Vault controls</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-2)]">Owner-only settings for bet limits, house edge, and accepting new bets.</p>
          </div>
          <button
            type="button"
            disabled={isVaultWritePending}
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
            onSave={() => {
              const value = parseEthControl(controls.minBetEth);
              if (value !== null) void writeVault("setMinBet", [value]);
            }}
            disabled={isVaultWritePending}
          />
          <AdminControlInput
            label="Max bet ETH"
            value={controls.maxBetEth}
            onChange={(value) => setControls((current) => ({ ...current, maxBetEth: value }))}
            onSave={() => {
              const value = parseEthControl(controls.maxBetEth);
              if (value !== null) void writeVault("setMaxBet", [value]);
            }}
            disabled={isVaultWritePending}
          />
          <AdminControlInput
            label="House edge %"
            value={controls.houseEdgePct}
            onChange={(value) => setControls((current) => ({ ...current, houseEdgePct: value }))}
            onSave={() => {
              const value = parseHouseEdgeControl(controls.houseEdgePct);
              if (value !== null) void writeVault("setHouseEdge", [value]);
            }}
            disabled={isVaultWritePending}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="admin-note">
          <h2 className="font-semibold text-[var(--text-1)]">Risk model</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
            New contract code reserves the maximum net payout for every round before accepting the bet. This prevents multiple active rounds from promising more than the vault can safely pay.
          </p>
          <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs leading-5 text-[var(--text-2)]">
            Practical minimum liquidity should stay above reserved payouts plus several max-risk rounds. At current limits, one max-risk reserve is about {formatEth(maxNetReserve)} ETH; the current buffer covers about {Number.isFinite(safeRoundCapacity) ? safeRoundCapacity.toFixed(1) : "0.0"} such rounds.
          </div>
        </div>
        <div className="admin-note">
          <h2 className="font-semibold text-[var(--text-1)]">Payout policy</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
            House edge is deducted only from winning gross payouts. Losing bets stay in the vault as vault profit; there is no extra loss-side fee.
          </p>
          <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs leading-5 text-[var(--text-2)]">
            Contract guardrails: min bet cannot go below 0.00001 ETH, max bet cannot exceed 0.01 ETH, and house edge cannot exceed 5%. House edge changes are blocked while payouts are reserved.
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="admin-note">
          <h2 className="font-semibold text-[var(--text-1)]">UI bet presets</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
            Game pages show three quick bet buttons. They are frontend presets, not separate contract limits. Change them with <code>NEXT_PUBLIC_BET_PRESETS_ETH</code>, for example <code>0.000055,0.00023,0.0005</code>.
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
          {vaultAddress && (
            <a href={`${defaultNetwork.network.blockExplorer}/address/${vaultAddress}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-xs font-bold text-[var(--text-1)] hover:text-[var(--accent)]">
              {vaultAddress}
              <ExternalLink size={13} />
            </a>
          )}
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

function extractRevertData(error: unknown): string | undefined {
  const first = error as { data?: unknown; cause?: unknown };
  if (typeof first.data === "string") return first.data;
  const second = first.cause as { data?: unknown; cause?: unknown } | undefined;
  if (typeof second?.data === "string") return second.data;
  const third = second?.cause as { data?: unknown } | undefined;
  if (typeof third?.data === "string") return third.data;
  return undefined;
}
