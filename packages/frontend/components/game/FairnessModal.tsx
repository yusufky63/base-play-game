"use client";

import { ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAccount } from "wagmi";
import { getNetworkByChainId } from "@baseplay/shared/config/networks";
import { defaultChainId } from "@/lib/env";
import { Modal } from "@/components/ui/Modal";

export function FairnessButton({ requestId, txHash }: { requestId?: string | null; txHash?: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fairness-vrf-button control-shell flex items-center gap-2 px-3 text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text-1)]"
      >
        <ShieldCheck size={14} className="text-[var(--win)]" />
        Chainlink VRF
      </button>
      <FairnessModal open={open} onClose={() => setOpen(false)} requestId={requestId ?? null} txHash={txHash ?? null} />
    </>
  );
}

function FairnessModal({
  open,
  onClose,
  requestId,
  txHash
}: {
  open: boolean;
  onClose: () => void;
  requestId: string | null;
  txHash: string | null;
}) {
  const { chain } = useAccount();
  const network = getNetworkByChainId(chain?.id ?? defaultChainId);
  const explorerBase = network?.blockExplorer ?? "https://sepolia.basescan.org";

  return (
    <Modal open={open} onClose={onClose} title="Provably Fair">
      <div className="space-y-4 text-sm">
        <div className="flex items-start gap-2 rounded-lg bg-[var(--win-light)] p-3">
          <ShieldCheck size={15} className="mt-0.5 flex-shrink-0 text-[var(--win)]" />
          <p className="text-xs leading-5 text-[var(--text-2)]">
            Game results are generated from Chainlink VRF randomness. The result can be verified on-chain and cannot be changed by BasePlay after the request is made.
          </p>
        </div>

        {txHash && (
          <InfoRow label="Transaction">
            <a
              href={`${explorerBase}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-mono text-xs text-[var(--accent)] hover:underline"
            >
              {txHash.slice(0, 12)}...{txHash.slice(-6)}
              <ExternalLink size={11} />
            </a>
          </InfoRow>
        )}
        {requestId && (
          <InfoRow label="VRF Request ID">
            <span className="break-all font-mono text-xs text-[var(--text-2)]">{requestId}</span>
          </InfoRow>
        )}
        <InfoRow label="Where to verify">
          <span className="text-xs leading-5 text-[var(--text-2)]">
            Use the transaction link on Basescan. Chainlink VRF does not expose a separate public page per request on Base; the request ID and game events are the on-chain proof.
          </span>
        </InfoRow>
        <InfoRow label="Oracle">
          <a
            href="https://docs.chain.link/vrf"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
          >
            Chainlink VRF v2.5
            <ExternalLink size={11} />
          </a>
        </InfoRow>
      </div>
    </Modal>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] py-2 last:border-b-0">
      <span className="flex-shrink-0 text-xs text-[var(--text-3)]">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}
