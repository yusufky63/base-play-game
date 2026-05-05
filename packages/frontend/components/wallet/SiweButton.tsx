"use client";

import { useState } from "react";
import { createSiweMessage, generateSiweNonce } from "viem/siwe";
import { BadgeCheck, Loader2 } from "lucide-react";
import { useAccount, usePublicClient, useSignMessage } from "wagmi";
import { useToast } from "@/components/ui/ToastProvider";

export function SiweButton() {
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { signMessageAsync } = useSignMessage();
  const toast = useToast();
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (!isConnected || !address || !chainId || !publicClient) {
      toast({ tone: "error", title: "Connect wallet first" });
      return;
    }

    setLoading(true);
    try {
      const message = createSiweMessage({
        address,
        chainId,
        domain: window.location.host,
        nonce: generateSiweNonce(),
        uri: window.location.origin,
        version: "1",
        statement: "Sign in to BasePlay with your wallet."
      });
      const signature = await signMessageAsync({ message });
      const valid = await publicClient.verifySiweMessage({ message, signature });
      setVerified(valid);
      toast({ tone: valid ? "success" : "error", title: valid ? "Wallet verified" : "SIWE verification failed" });
    } catch {
      toast({ tone: "error", title: "Signature cancelled" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={signIn} disabled={loading || !isConnected} className="siwe-button">
      {loading ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
      {verified ? "Verified" : "Verify wallet"}
    </button>
  );
}
