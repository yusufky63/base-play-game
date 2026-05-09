"use client";

import { Copy, UserPlus } from "lucide-react";
import { useAccount } from "wagmi";
import { SharePanel } from "@/components/share/SharePanel";
import { useToast } from "@/components/ui/ToastProvider";
import { openWalletModal } from "@/lib/walletConnectors";

const CANONICAL_ORIGIN = "https://baseplay.games";
const SHARE_TEXT = "Try BasePlay with me. 🎲 Fast mini games on Base with verifiable results and instant payouts when you win.";

export function ReferralShareCard() {
  const { address } = useAccount();
  const toast = useToast();
  const referralPath = address ? `/?ref=${address}` : undefined;
  const displayUrl = `${CANONICAL_ORIGIN}${referralPath ?? ""}`;

  async function copyLink() {
    await navigator.clipboard?.writeText(displayUrl);
    toast({
      tone: "success",
      title: address ? "Referral link copied" : "BasePlay link copied",
      description: address ? "Friends can join through your referral link." : "Connect your wallet to share a personal referral link."
    });
  }

  return (
    <aside className="panel referral-share-card p-4">
      <div className="referral-share-head">
        <span className="referral-share-icon">
          <UserPlus size={16} />
        </span>
        <div className="min-w-0">
          <h2>Invite players</h2>
          <p>{address ? "Share your referral link from any game." : "Connect wallet to unlock your referral link."}</p>
        </div>
      </div>

      <div className="referral-share-url" title={displayUrl}>
        {displayUrl}
      </div>

      <div className="referral-share-actions">
        {address ? (
          <SharePanel compact text={SHARE_TEXT} path={referralPath} />
        ) : (
          <button type="button" onClick={openWalletModal} className="share-action">
            <UserPlus size={14} />
            Connect
          </button>
        )}
        <button type="button" onClick={() => void copyLink()} className="share-action" aria-label="Copy referral link">
          <Copy size={14} />
          Copy
        </button>
      </div>
    </aside>
  );
}
