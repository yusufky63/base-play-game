"use client";

import { Loader2 } from "lucide-react";
import { useAccount, useSwitchChain } from "wagmi";
import { useEthUsdPrice } from "@/hooks/useEthUsdPrice";
import { formatUsd } from "@/lib/formatters";
import { type VRFState, VRF_MESSAGES } from "@/hooks/useVRF";
import { betPresetAmounts } from "@/lib/env";
import { openWalletModal } from "@/lib/walletConnectors";

interface BetPanelProps {
  amount: string;
  disabled?: boolean;
  disabledReason?: string;
  loading?: boolean;
  vrfState?: VRFState;
  actionLabel?: string;
  hideAction?: boolean;
  onAmountChange: (value: string) => void;
  onPlay: () => unknown | Promise<unknown>;
  onRefund?: () => unknown | Promise<unknown>;
}

export function BetPanel({
  amount,
  disabled = false,
  disabledReason,
  loading = false,
  vrfState = "idle",
  actionLabel = "Play",
  hideAction = false,
  onAmountChange,
  onPlay,
  onRefund
}: BetPanelProps) {
  const ethUsd = useEthUsdPrice();
  const { address, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const isBusy = loading || vrfState === "pending_tx" || vrfState === "pending_vrf";
  const isUnsupportedChain = Boolean(address) && (!chain?.id || chain.id !== 8453);
  const walletActionLabel = !address ? "Connect wallet" : isUnsupportedChain ? "Switch to Base" : actionLabel;

  function handleActionClick() {
    if (!address) {
      openWalletModal();
      return;
    }
    if (isUnsupportedChain && switchChain) {
      switchChain({ chainId: 8453 });
      return;
    }
    void runPanelAction(onPlay);
  }

  return (
    <aside className="panel bet-panel p-4">
      <div className="mb-3 flex justify-between text-xs text-[var(--text-3)]">
        <span>Bet amount</span>
        <span className="font-mono text-[var(--text-2)]">Select preset</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {betPresetAmounts.map((quickAmount) => (
          <QuickAmountButton
            key={quickAmount}
            amount={amount}
            quickAmount={quickAmount}
            ethUsd={ethUsd}
            onAmountChange={onAmountChange}
          />
        ))}
      </div>

      {!hideAction && (
        <button
          type="button"
          onClick={handleActionClick}
          disabled={disabled || isBusy}
          className="primary-action mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isBusy && <Loader2 size={16} className="animate-spin" />}
          {isBusy ? VRF_MESSAGES[vrfState] : disabled && disabledReason ? disabledReason : walletActionLabel}
        </button>
      )}

      {vrfState === "error" && onRefund && (
        <button
          type="button"
          onClick={() => void runPanelAction(onRefund)}
          className="mt-3 flex h-10 w-full items-center justify-center rounded-md border border-[var(--lose)] px-4 text-sm font-bold text-[var(--lose)] hover:bg-[var(--lose-light)]"
        >
          Claim refund
        </button>
      )}
    </aside>
  );
}

async function runPanelAction(action?: () => unknown | Promise<unknown>) {
  try {
    await action?.();
  } catch {
    // Game actions already surface player-facing errors through toast state.
  }
}

function QuickAmountButton({
  amount,
  quickAmount,
  ethUsd,
  onAmountChange
}: {
  amount: string;
  quickAmount: string;
  ethUsd: number | null;
  onAmountChange: (value: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAmountChange(quickAmount)}
      className={`bet-quick-button rounded-md border px-2 py-2 transition-colors ${
        amount === quickAmount
          ? "bet-quick-button-active border-[var(--accent)] bg-[var(--accent-light)] text-[var(--text-1)]"
          : "border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)]"
      }`}
    >
      <span>{ethUsd ? formatUsd(Number(quickAmount) * ethUsd) : quickAmount}</span>
      <small>{quickAmount} ETH</small>
    </button>
  );
}
