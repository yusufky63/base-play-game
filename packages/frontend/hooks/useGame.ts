"use client";

import type { Abi } from "viem";
import { formatEther, parseEther, parseEventLogs } from "viem";
import { useEffect, useRef, useState } from "react";
import { base } from "wagmi/chains";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { getContractAddress } from "@baseplay/shared/config/addresses";
import { getNetworkByChainId } from "@baseplay/shared/config/networks";
import { parseContractError } from "@/lib/errors";
import { defaultChainId } from "@/lib/env";
import { useContractAddress } from "@/hooks/useContractAddress";
import { useOperationalStatus } from "@/hooks/useOperationalStatus";
import { useVRF } from "@/hooks/useVRF";
import { useToast } from "@/components/ui/ToastProvider";
import { getPreferredChainId } from "@/lib/preferredChain";
import { BASEPLAY_BUILDER_CODE_SUFFIX } from "@/lib/builderCode";
import { openWalletModal } from "@/lib/walletConnectors";

export function useGame(gameId: string, contractName: string, abi: Abi | null) {
  const { address, chain } = useAccount();
  const contractAddress = useContractAddress(contractName);
  const operationalStatus = useOperationalStatus(contractName);
  const vrf = useVRF();
  const toast = useToast();
  const publicClient = usePublicClient();
  const { switchChainAsync, isPending: isSwitchPending } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const activeRoundRef = useRef(0);
  const pollAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (vrf.state === "settled") {
      pollAbortRef.current?.abort();
      pollAbortRef.current = null;
    }
  }, [vrf.state]);

  async function placeBet(amountEth: string, params: `0x${string}`) {
    if (operationalStatus.status !== "live") {
      toast({ tone: "error", title: operationalStatus.title, description: operationalStatus.description });
      throw new Error(operationalStatus.title);
    }
    if (!address) {
      openWalletModal();
      toast({ tone: "info", title: "Connect wallet", description: "Choose MetaMask, WalletConnect, Coinbase, or Base Account from the wallet modal." });
      throw new Error("Wallet not connected");
    }
    const selectedChainId = getPreferredChainId();
    const walletChainId = chain?.id;
    const walletNetwork = getNetworkByChainId(walletChainId ?? 0);
    if (!walletNetwork) {
      try {
        await switchChainAsync({ chainId: base.id });
        rememberPreferredChain(base.id);
        toast({ tone: "info", title: "Network switched", description: "Wallet switched to Base mainnet. Press Play again to place the wager." });
      } catch {
        toast({ tone: "error", title: "Wrong network", description: "Switch your wallet to Base mainnet before placing a wager." });
      }
      throw new Error("Wrong network");
    }
    const targetChainId = walletChainId ?? selectedChainId ?? defaultChainId;
    const targetNetwork = getNetworkByChainId(targetChainId);
    if (!targetNetwork) {
      toast({ tone: "error", title: "Unsupported network", description: "Switch to Base mainnet before placing a wager." });
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
    if (!publicClient) {
      toast({ tone: "error", title: "Network unavailable", description: "The active network RPC is not ready yet. Try again in a moment." });
      throw new Error("Network unavailable");
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
    let wagerValue: bigint;
    try {
      wagerValue = parseEther(amountEth);
    } catch {
      toast({ tone: "error", title: "Invalid bet amount", description: "Select a valid ETH preset before placing a wager." });
      throw new Error("Invalid bet amount");
    }
    if (operationalStatus.minBetWei !== null && wagerValue < operationalStatus.minBetWei) {
      toast({ tone: "error", title: "Bet below minimum", description: `Minimum bet is ${operationalStatus.minBetEth} ETH on ${operationalStatus.networkName}.` });
      throw new Error("Bet below minimum");
    }
    if (operationalStatus.maxBetWei !== null && wagerValue > operationalStatus.maxBetWei) {
      toast({ tone: "error", title: "Bet above maximum", description: `Maximum bet is ${operationalStatus.maxBetEth} ETH on ${operationalStatus.networkName}.` });
      throw new Error("Bet above maximum");
    }
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
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
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
        value: wagerValue,
        dataSuffix: BASEPLAY_BUILDER_CODE_SUFFIX
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
        const pollAbort = new AbortController();
        pollAbortRef.current = pollAbort;
        void waitForRoundSettled({
          publicClient,
          contractAddress,
          abi,
          requestId,
          fromBlock: receipt.blockNumber,
          signal: pollAbort.signal,
          onSettled: (result) => {
            if (activeRoundRef.current !== roundKey) return;
            pollAbortRef.current = null;
            if (typeof result.tx_hash === "string" && result.tx_hash.startsWith("0x")) {
              setTxHash(result.tx_hash as `0x${string}`);
            }
            vrf.settle(result);
            toast({
              tone: result.won ? "success" : "info",
              title: result.won ? "Round won" : "Round settled",
              description: result.tx_hash ? "Result is confirmed on-chain." : undefined
            });
          },
          onTimeout: () => {
            if (activeRoundRef.current !== roundKey) return;
            pollAbortRef.current = null;
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

    activeRoundRef.current += 1;
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
    vrf.reset();
    setTxHash(null);

    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi,
        functionName: "claimRefund",
        dataSuffix: BASEPLAY_BUILDER_CODE_SUFFIX
      });
      toast({
        tone: "success",
        title: "Refund submitted",
        description: `Refund transaction sent: ${hash.slice(0, 10)}...${hash.slice(-6)}`
      });
      return hash;
    } catch (error) {
      const parsed = parseContractError(error);
      toast({ tone: "error", title: parsed.message });
      throw parsed;
    }
  }

  function reset() {
    activeRoundRef.current += 1;
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
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
    isTxPending: isPending || isSwitchPending,
    isConnected: Boolean(address),
    contractAddress,
    operationalStatus,
    isPlayDisabled: !contractAddress || operationalStatus.status !== "live",
    playDisabledReason: operationalStatus.status === "live" ? undefined : operationalStatus.playDisabledLabel,
    reset,
    setRequestId: vrf.setRequestId
  };
}

async function waitForRoundSettled({
  publicClient,
  contractAddress,
  abi,
  requestId,
  fromBlock,
  signal,
  onSettled,
  onTimeout
}: {
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>;
  contractAddress: `0x${string}`;
  abi: Abi;
  requestId: bigint;
  fromBlock: bigint;
  signal?: AbortSignal;
  onSettled: (result: Record<string, unknown>) => void;
  onTimeout: () => void;
}) {
  const startedAt = Date.now();
  const delays = [8_000, 12_000, 18_000, 25_000, 35_000];
  let nextFromBlock = fromBlock;

  for (const delay of delays) {
    if (signal?.aborted) return;
    const log = await findRoundSettledLog({
      publicClient,
      contractAddress,
      abi,
      requestId,
      fromBlock: nextFromBlock
    });

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

    if (log?.lastScannedBlock) {
      nextFromBlock = log.lastScannedBlock + 1n;
    }

    await sleep(delay, signal);
    if (Date.now() - startedAt > 120_000) break;
  }

  if (signal?.aborted) return;
  onTimeout();
}

async function findRoundSettledLog({
  publicClient,
  contractAddress,
  abi,
  requestId,
  fromBlock
}: {
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>;
  contractAddress: `0x${string}`;
  abi: Abi;
  requestId: bigint;
  fromBlock: bigint;
}): Promise<({ args?: Record<string, unknown>; transactionHash?: string; lastScannedBlock?: bigint } | undefined)> {
  const latestBlock = await publicClient.getBlockNumber();
  if (fromBlock > latestBlock) return { lastScannedBlock: latestBlock };

  const maxRange = 9_500n;
  let cursor = fromBlock;
  let lastScannedBlock = fromBlock;

  while (cursor <= latestBlock) {
    const toBlock = cursor + maxRange > latestBlock ? latestBlock : cursor + maxRange;
    lastScannedBlock = toBlock;

    try {
      const logs = await publicClient.getContractEvents({
        address: contractAddress,
        abi,
        eventName: "RoundSettled",
        args: { requestId },
        fromBlock: cursor,
        toBlock
      } as any);

      const log = logs[0] as { args?: Record<string, unknown>; transactionHash?: string } | undefined;
      if (log?.args) return { ...log, lastScannedBlock };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "");
      if (!message.includes("10,000") && !message.includes("rate limit") && !message.includes("over rate limit")) {
        throw error;
      }
      return { lastScannedBlock: cursor > fromBlock ? cursor - 1n : fromBlock };
    }

    cursor = toBlock + 1n;
  }

  return { lastScannedBlock };
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

function rememberPreferredChain(chainId: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("baseplay:chainId", String(chainId));
  window.dispatchEvent(new CustomEvent("baseplay:chain-change", { detail: chainId }));
}
