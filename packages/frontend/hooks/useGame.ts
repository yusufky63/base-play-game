"use client";

import type { Abi } from "viem";
import { formatEther, parseEther, parseEventLogs } from "viem";
import { useRef, useState } from "react";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { getContractAddress } from "@baseplay/shared/config/addresses";
import { getNetworkByChainId } from "@baseplay/shared/config/networks";
import { parseContractError } from "@/lib/errors";
import { useContractAddress } from "@/hooks/useContractAddress";
import { useVRF } from "@/hooks/useVRF";
import { useToast } from "@/components/ui/ToastProvider";

export function useGame(gameId: string, contractName: string, abi: Abi | null) {
  const { address, chain } = useAccount();
  const contractAddress = useContractAddress(contractName);
  const vrf = useVRF();
  const toast = useToast();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const activeRoundRef = useRef(0);

  async function placeBet(amountEth: string, params: `0x${string}`) {
    if (!address) {
      toast({ tone: "error", title: "Wallet not connected", description: "Connect a wallet before placing a wager." });
      throw new Error("Wallet not connected");
    }
    if (!publicClient) {
      toast({ tone: "error", title: "Network unavailable", description: "The active network RPC is not ready yet. Try again in a moment." });
      throw new Error("Network unavailable");
    }
    const selectedChainId = getPreferredChainId();
    const walletChainId = chain?.id;
    const targetChainId = selectedChainId ?? walletChainId ?? baseSepolia.id;
    const targetNetwork = getNetworkByChainId(targetChainId);
    if (!targetNetwork) {
      toast({ tone: "error", title: "Unsupported network", description: "Switch to Base Sepolia or Base Mainnet before placing a wager." });
      throw new Error("Unsupported network");
    }
    if (walletChainId !== targetChainId) {
      try {
        await switchChainAsync({ chainId: targetChainId });
        toast({ tone: "info", title: "Network switched", description: `Wallet switched to ${targetNetwork.name}. Press Play again to place the wager.` });
      } catch {
        toast({ tone: "error", title: "Wrong network", description: `Switch your wallet to ${targetNetwork.name} before placing a wager.` });
      }
      throw new Error("Wrong network");
    }
    try {
      getContractAddress(targetChainId, contractName);
    } catch {
      toast({ tone: "error", title: "Contract unavailable", description: `${contractName} is not deployed on ${targetNetwork.name}.` });
      throw new Error(`${contractName} is not deployed on ${targetNetwork.name}`);
    }
    if (!contractAddress || !abi) {
      toast({ tone: "error", title: "Contract unavailable", description: `${contractName} is not configured for this chain.` });
      throw new Error(`${contractName} is not configured for this chain`);
    }
    const wagerValue = parseEther(amountEth);
    const balance = await publicClient.getBalance({ address });
    if (balance <= wagerValue) {
      toast({
        tone: "error",
        title: "Insufficient balance",
        description: `Your wallet has ${formatEther(balance)} ETH. You need ${amountEth} ETH plus gas on ${targetNetwork.name}.`
      });
      throw new Error("Insufficient balance");
    }

    const roundKey = activeRoundRef.current + 1;
    activeRoundRef.current = roundKey;
    vrf.reset();
    setTxHash(null);
    vrf.setState("pending_tx");
    toast({ tone: "info", title: "Sending transaction", description: "Confirm the wager in your wallet." });
    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi,
        functionName: "placeBet",
        args: [params],
        value: wagerValue
      });
      setTxHash(hash);
      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      const betPlacedLog = receipt
        ? parseEventLogs({
            abi,
            logs: receipt.logs,
            eventName: "BetPlaced"
          })[0]
        : null;
      const args = betPlacedLog?.args as { requestId?: unknown } | undefined;
      const requestId = args?.requestId;
      if (typeof requestId === "bigint") {
        vrf.setRequestId(requestId.toString());
      }
      vrf.setState("pending_vrf");
      toast({ tone: "info", title: "Verifying on-chain", description: "Waiting for Chainlink VRF settlement." });
      if (receipt && typeof requestId === "bigint" && publicClient) {
        void waitForRoundSettled({
          publicClient,
          contractAddress,
          abi,
          requestId,
          fromBlock: receipt.blockNumber,
          onSettled: (result) => {
            if (activeRoundRef.current !== roundKey) return;
            vrf.settle(result);
            toast({
              tone: result.won ? "success" : "info",
              title: result.won ? "Round won" : "Round settled",
              description: result.tx_hash ? "Result is confirmed on-chain." : undefined
            });
          },
          onTimeout: () => {
            if (activeRoundRef.current !== roundKey) return;
            vrf.setState("error");
            toast({ tone: "error", title: "VRF timeout", description: "Round is still unresolved. You can claim a refund after the timeout block window." });
          }
        });
      }
      return hash;
    } catch (error) {
      const parsed = parseContractError(error);
      if (activeRoundRef.current === roundKey) {
        activeRoundRef.current += 1;
        vrf.setState("idle");
        toast({ tone: "error", title: parsed.message });
      }
      throw parsed;
    }
  }

  async function claimRefund() {
    if (!address) {
      toast({ tone: "error", title: "Wallet not connected", description: "Connect the wallet that placed the round." });
      throw new Error("Wallet not connected");
    }
    if (!contractAddress || !abi) {
      toast({ tone: "error", title: "Contract unavailable", description: `${contractName} is not configured for this chain.` });
      throw new Error(`${contractName} is not configured for this chain`);
    }

    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi,
        functionName: "claimRefund"
      });
      setTxHash(hash);
      toast({ tone: "success", title: "Refund submitted", description: "Refund transaction was sent to the network." });
      activeRoundRef.current += 1;
      vrf.reset();
      return hash;
    } catch (error) {
      const parsed = parseContractError(error);
      toast({ tone: "error", title: parsed.message });
      throw parsed;
    }
  }

  function reset() {
    activeRoundRef.current += 1;
    setTxHash(null);
    vrf.reset();
  }

  return {
    placeBet,
    claimRefund,
    vrfState: vrf.state,
    vrfResult: vrf.result,
    requestId: vrf.requestId,
    txHash,
    isTxPending: isPending,
    isConnected: Boolean(address),
    contractAddress,
    reset,
    setRequestId: vrf.setRequestId
  };
}

function getPreferredChainId() {
  if (typeof window === "undefined") return undefined;
  const stored = Number(window.localStorage.getItem("baseplay:chainId"));
  return Number.isFinite(stored) && stored > 0 ? stored : undefined;
}

async function waitForRoundSettled({
  publicClient,
  contractAddress,
  abi,
  requestId,
  fromBlock,
  onSettled,
  onTimeout
}: {
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>;
  contractAddress: `0x${string}`;
  abi: Abi;
  requestId: bigint;
  fromBlock: bigint;
  onSettled: (result: Record<string, unknown>) => void;
  onTimeout: () => void;
}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 120_000) {
    const logs = await publicClient.getContractEvents({
      address: contractAddress,
      abi,
      eventName: "RoundSettled",
      args: { requestId },
      fromBlock
    } as any);

    const log = logs[0] as { args?: Record<string, unknown>; transactionHash?: string } | undefined;
    if (log?.args) {
      const receipt = log.transactionHash
        ? await publicClient.getTransactionReceipt({ hash: log.transactionHash as `0x${string}` })
        : null;
      const parsedLogs = receipt
        ? parseEventLogs({
            abi,
            logs: receipt.logs
          }).map((entry) => ({
            eventName: entry.eventName,
            args: entry.args
          }))
        : [];

      onSettled({
        ...log.args,
        events: parsedLogs,
        tx_hash: log.transactionHash,
        vrf_request_id: requestId.toString()
      });
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 4_000));
  }

  onTimeout();
}
