"use client";

import { CheckCircle2, Clock3, ExternalLink, Loader2, RadioTower, ReceiptText } from "lucide-react";
import { useAccount } from "wagmi";
import { getNetworkByChainId } from "@baseplay/shared/config/networks";
import type { VRFState } from "@/hooks/useVRF";
import { defaultChainId } from "@/lib/env";

interface RoundStatusProps {
  state: VRFState;
  requestId?: string | null;
  txHash?: string | null;
}

export function RoundStatus({ state, requestId, txHash }: RoundStatusProps) {
  const { chain } = useAccount();
  const network = getNetworkByChainId(chain?.id ?? defaultChainId);
  const explorerBase = network?.blockExplorer ?? "https://sepolia.basescan.org";

  if (state === "idle" && !requestId && !txHash) return null;

  const activeTx = state === "pending_tx";
  const activeVrf = state === "pending_vrf";
  const settled = state === "settled";
  const failed = state === "error";

  return (
    <section className={`round-status ${failed ? "round-status-error" : settled ? "round-status-settled" : ""}`}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="round-status-orb">
          {activeTx || activeVrf ? <Loader2 size={16} className="animate-spin" /> : settled ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-[var(--text-1)]">
            {activeTx && "Waiting for wallet confirmation"}
            {activeVrf && "Processing VRF settlement"}
            {settled && "Round confirmed"}
            {failed && "Settlement delayed"}
          </div>
          <div className="mt-1 text-xs leading-5 text-[var(--text-2)]">
            {activeTx && "Confirm the transaction in your wallet. The game will move to VRF after the bet is mined."}
            {activeVrf && "The bet transaction is mined. Chainlink VRF is generating the final result."}
            {settled && "Chainlink VRF settled the result emitted by the game contract."}
            {failed && "The round did not settle in the expected window. Refund is available after the contract timeout."}
          </div>
        </div>
      </div>

      <div className="round-status-refs">
        <StatusRef icon={<ReceiptText size={13} />} label="TX" value={txHash ? `${txHash.slice(0, 10)}...${txHash.slice(-6)}` : "waiting"} href={txHash ? `${explorerBase}/tx/${txHash}` : undefined} />
        <StatusRef icon={<RadioTower size={13} />} label="VRF" value={requestId ? `#${requestId.slice(0, 10)}...` : activeTx ? "after tx" : "waiting"} />
      </div>
    </section>
  );
}

function StatusRef({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const content = (
    <>
      <span className="text-[var(--accent)]">{icon}</span>
      <span className="text-[var(--text-3)]">{label}</span>
      <span className="max-w-36 truncate font-mono text-[var(--text-1)]">{value}</span>
      {href && <ExternalLink size={11} className="text-[var(--text-3)]" />}
    </>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="round-status-ref hover:border-[var(--accent)]">
        {content}
      </a>
    );
  }

  return <div className="round-status-ref">{content}</div>;
}
