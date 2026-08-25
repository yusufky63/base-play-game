"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatEther, parseEther, type Abi } from "viem";
import { 
  useAccount, 
  usePublicClient, 
  useReadContract, 
  useSwitchChain,
  useWaitForTransactionReceipt, 
  useWatchContractEvent, 
  useWriteContract 
} from "wagmi";
import { 
  ArrowLeft,
  ArrowUpRight,
  Check, 
  Copy, 
  Radio,
  Share2, 
  Swords, 
  Users, 
  User,
  Trophy,
  XCircle,
  CheckCircle2
} from "lucide-react";
import pvPArenaAbi from "@baseplay/shared/abis/PvPArena.json";
import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { BetPanel } from "@/components/game/BetPanel";
import { GameIdentity } from "@/components/game/GameIdentity";
import { GameShell } from "@/components/game/GameShell";
import { RoundSummaryStrip } from "@/components/game/RoundSummaryStrip";
import { ShareWinModal } from "@/components/share/ShareWinModal";
import { BasenameLabel } from "@/components/base/BasenameLabel";
import { useToast } from "@/components/ui/ToastProvider";
import { useEthUsdPrice } from "@/hooks/useEthUsdPrice";
import { formatUsd } from "@/lib/formatters";
import type { VRFState } from "@/hooks/useVRF";

export interface OnChainRoom {
  roomId: number;
  playerA: `0x${string}`;
  playerB: `0x${string}`;
  betAmount: bigint;
  betAmountEth: string;
  choiceA: number; // 0 = Heads, 1 = Tails
  vrfRequestId: bigint;
  status: number; // 0: OPEN, 1: MATCHED, 2: SETTLED, 3: CANCELLED
  blockNumber: bigint;
  winner: `0x${string}`;
  createdAt: bigint;
}

export function PvPArenaClient() {
  const searchParams = useSearchParams();
  const targetRoomIdFromUrl = searchParams.get("room") ? Number(searchParams.get("room")) : null;

  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const ethUsd = useEthUsdPrice();
  const toast = useToast();

  const arenaAddress = (CONTRACT_ADDRESSES[chain?.id ?? 8453]?.PvPArena ?? "0x0965A9ACc1f300E60179057D7eEA20967731b8F5") as `0x${string}`;

  // Game UI State
  const [amount, setAmount] = useState("0.00023");
  const [choice, setChoice] = useState<"Heads" | "Tails">("Heads");
  const [activeTab, setActiveTab] = useState<"arena" | "lobby">("lobby");

  // On-chain Rooms State
  const [rooms, setRooms] = useState<OnChainRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<OnChainRoom | null>(null);
  const [selectedChallengeRoom, setSelectedChallengeRoom] = useState<OnChainRoom | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Wagmi Read: nextRoomId (low polling overhead)
  const { data: nextRoomIdRaw, refetch: refetchNextRoomId } = useReadContract({
    address: arenaAddress,
    abi: pvPArenaAbi as Abi,
    functionName: "nextRoomId",
    query: { refetchInterval: 4000 }
  });

  // Wagmi Write
  const { writeContractAsync, data: txHash, isPending: isTxPending } = useWriteContract();
  const { isLoading: isTxWaiting } = useWaitForTransactionReceipt({ hash: txHash });

  // Stable Multicall Loader - ZERO DEPENDENCY LOOP
  const loadRooms = useCallback(async () => {
    if (!publicClient || !nextRoomIdRaw) return;
    const total = Number(nextRoomIdRaw);
    if (total <= 1) {
      setRooms([]);
      return;
    }

    try {
      const calls = [];
      const startId = Math.max(1, total - 40);
      for (let id = startId; id < total; id++) {
        calls.push({
          address: arenaAddress,
          abi: pvPArenaAbi as Abi,
          functionName: "rooms",
          args: [BigInt(id)]
        });
      }

      const results = await publicClient.multicall({ contracts: calls, allowFailure: true });
      const parsed: OnChainRoom[] = [];

      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        if (res.status === "success" && Array.isArray(res.result)) {
          const [roomId, playerA, playerB, betAmountWei, choiceA, vrfRequestId, status, blockNumber, winner, createdAt] =
            res.result as [bigint, `0x${string}`, `0x${string}`, bigint, number, bigint, number, bigint, `0x${string}`, bigint];

          if (Number(roomId) > 0) {
            parsed.push({
              roomId: Number(roomId),
              playerA,
              playerB,
              betAmount: betAmountWei,
              betAmountEth: formatEther(betAmountWei),
              choiceA: Number(choiceA),
              vrfRequestId,
              status: Number(status),
              blockNumber,
              winner,
              createdAt
            });
          }
        }
      }

      parsed.sort((a, b) => b.roomId - a.roomId);
      setRooms(parsed);

      // Synchronize active room without creating re-render loop
      if (address) {
        const userAddr = address.toLowerCase();
        const liveActive = parsed.find(
          (r) =>
            (r.playerA.toLowerCase() === userAddr ||
              (r.playerB && r.playerB.toLowerCase() === userAddr)) &&
            (r.status === 0 || r.status === 1)
        );

        if (liveActive) {
          setActiveRoom(liveActive);
        } else {
          setActiveRoom((current) => {
            if (!current) return null;
            const updated = parsed.find((r) => r.roomId === current.roomId);
            return updated ?? current;
          });
        }
      }
    } catch (e) {
      console.error("PvP room load error:", e);
    }
  }, [publicClient, nextRoomIdRaw, address, arenaAddress]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  // URL Target Room Detection (Run once when rooms load)
  useEffect(() => {
    if (targetRoomIdFromUrl && rooms.length > 0 && !selectedChallengeRoom) {
      const target = rooms.find((r) => r.roomId === targetRoomIdFromUrl && r.status === 0);
      if (target) {
        setSelectedChallengeRoom(target);
        setActiveTab("arena");
      }
    }
  }, [targetRoomIdFromUrl, rooms, selectedChallengeRoom]);

  // Real-time On-Chain Contract Events
  useWatchContractEvent({
    address: arenaAddress,
    abi: pvPArenaAbi as Abi,
    eventName: "RoomJoined",
    onLogs() {
      void loadRooms();
      setSelectedChallengeRoom(null);
      setActiveTab("arena");
    }
  });

  useWatchContractEvent({
    address: arenaAddress,
    abi: pvPArenaAbi as Abi,
    eventName: "RoomSettled",
    onLogs() {
      void loadRooms();
      void refetchNextRoomId();
    }
  });

  // Action: Create Duel Room
  async function handleCreateDuel() {
    if (!isConnected || !address) {
      toast({ tone: "info", title: "Connect Wallet", description: "Connect wallet to play on Base." });
      return;
    }
    if (chain?.id !== 8453) {
      if (switchChain) switchChain({ chainId: 8453 });
      toast({ tone: "error", title: "Wrong Network", description: "Please switch to Base Mainnet." });
      return;
    }

    try {
      setSelectedChallengeRoom(null);
      setActiveTab("arena");
      await writeContractAsync({
        address: arenaAddress,
        abi: pvPArenaAbi as Abi,
        functionName: "createRoom",
        args: [choice === "Heads" ? 0 : 1],
        value: parseEther(amount)
      });
    } catch (err: any) {
      toast({ tone: "error", title: "Create Failed", description: err?.shortMessage || err?.message });
    }
  }

  // Action: Accept & Match Duel Room (Instant Transition, No Stuck Screen)
  async function handleConfirmJoinDuel(room: OnChainRoom) {
    if (!isConnected || !address) {
      toast({ tone: "info", title: "Connect Wallet", description: "Connect wallet to play on Base." });
      return;
    }
    if (chain?.id !== 8453) {
      if (switchChain) switchChain({ chainId: 8453 });
      toast({ tone: "error", title: "Wrong Network", description: "Please switch to Base Mainnet." });
      return;
    }

    try {
      // 1. Immediately clear challenge screen to prevent challenger from getting stuck
      setSelectedChallengeRoom(null);
      // 2. Set active battle state instantly
      setActiveRoom({
        ...room,
        playerB: address as `0x${string}`,
        status: 1
      });
      setActiveTab("arena");

      // 3. Submit transaction
      await writeContractAsync({
        address: arenaAddress,
        abi: pvPArenaAbi as Abi,
        functionName: "joinRoom",
        args: [BigInt(room.roomId)],
        value: room.betAmount
      });
    } catch (err: any) {
      toast({ tone: "error", title: "Join Failed", description: err?.shortMessage || err?.message });
    }
  }

  // Action: Cancel Room
  async function handleCancelDuel(roomId: number) {
    try {
      await writeContractAsync({
        address: arenaAddress,
        abi: pvPArenaAbi as Abi,
        functionName: "cancelRoom",
        args: [BigInt(roomId)]
      });
      setActiveRoom(null);
      setSelectedChallengeRoom(null);
    } catch (err: any) {
      toast({ tone: "error", title: "Cancel Failed", description: err?.shortMessage || err?.message });
    }
  }

  // Copy Invite Link
  function copyInviteLink(roomId: number) {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://baseplay.games";
    const refParam = address ? `&ref=${address}` : "";
    const inviteUrl = `${origin}/games/pvp?room=${roomId}${refParam}`;
    navigator.clipboard?.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
    toast({
      tone: "success",
      title: "Invite Link Copied!",
      description: "Send this link to challenge a friend on Base."
    });
  }

  function chooseSide(nextChoice: "Heads" | "Tails") {
    if (isBusy) return;
    if (isSettled) setActiveRoom(null);
    setChoice(nextChoice);
  }

  const openRooms = rooms.filter((r) => r.status === 0);
  const settledRooms = rooms.filter((r) => r.status === 2);

  const isBusy = Boolean(isTxPending || isTxWaiting || (activeRoom && activeRoom.status === 1));
  const isSettled = Boolean(activeRoom && activeRoom.status === 2);
  const isWon = Boolean(isSettled && address && activeRoom?.winner.toLowerCase() === address.toLowerCase());

  // Winning outcome: "Heads" | "Tails"
  const winningOutcomeSide = activeRoom && isSettled
    ? (activeRoom.winner.toLowerCase() === activeRoom.playerA.toLowerCase()
        ? (activeRoom.choiceA === 0 ? "Heads" : "Tails")
        : (activeRoom.choiceA === 0 ? "Tails" : "Heads"))
    : null;

  const result = isSettled ? winningOutcomeSide : null;
  const currentChoice = activeRoom ? (activeRoom.choiceA === 0 ? "Heads" : "Tails") : choice;
  const coinFace = result ? (result === "Heads" ? "H" : "T") : currentChoice === "Heads" ? "H" : "T";
  const payoutEth = activeRoom ? (parseFloat(activeRoom.betAmountEth) * 2 * 0.98).toFixed(5) : "0.00";

  const vrfState: VRFState = activeRoom?.status === 1 ? "pending_vrf" : isTxPending || isTxWaiting ? "pending_tx" : isSettled ? "settled" : "idle";

  const isMyOpenRoom = Boolean(
    activeRoom &&
      activeRoom.status === 0 &&
      address &&
      activeRoom.playerA.toLowerCase() === address.toLowerCase()
  );

  const activeChallenge = selectedChallengeRoom && selectedChallengeRoom.status === 0 ? selectedChallengeRoom : null;

  return (
    <GameShell
      gameId="pvp"
      title="PvP Arena"
      description="Heads or tails against other players with instant settlement after VRF confirmation."
      vrfState={vrfState}
      txHash={txHash}
      side={
        <div className="space-y-4">
          <BetPanel
            amount={amount}
            loading={isBusy}
            disabled={isBusy}
            vrfState={vrfState}
            actionLabel="Create Duel Room"
            onAmountChange={setAmount}
            onPlay={handleCreateDuel}
          />

          {/* Real PvP Duels Live Feed */}
          <section className="panel game-feed-panel p-3.5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="display-heading text-sm font-bold text-[var(--text-1)]">PvP Duels feed</h2>
              <div className="flex items-center gap-2">
                <Radio size={14} className="text-[var(--accent)]" />
              </div>
            </div>

            <div className="space-y-2">
              {settledRooms.length === 0 ? (
                <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-4 text-sm text-[var(--text-3)] text-center">
                  No settled duels yet.
                </div>
              ) : (
                settledRooms.slice(0, 5).map((room) => {
                  const netGain = (parseFloat(room.betAmountEth) * 0.96).toFixed(5);
                  const usdVal = ethUsd ? formatUsd(parseFloat(netGain) * ethUsd) : null;
                  const isHostWinner = room.winner.toLowerCase() === room.playerA.toLowerCase();
                  const sideWon = isHostWinner ? (room.choiceA === 0 ? "Heads" : "Tails") : (room.choiceA === 0 ? "Tails" : "Heads");

                  return (
                    <div
                      key={room.roomId}
                      className="feed-row grid cursor-pointer grid-cols-[1fr_auto] gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-[var(--text-1)] truncate">
                          <Trophy size={13} className="text-[var(--win)] shrink-0" />
                          <BasenameLabel address={room.winner} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--text-3)]">
                          <GameIdentity gameId="pvp" size="xs" className="game-identity-feed" />
                          <span className="result-badge result-badge-win">
                            WIN ({sideWon}) • #{room.roomId}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 font-mono text-xs text-[var(--win)] font-bold">
                        <ArrowUpRight size={13} />
                        <span>
                          +{netGain} ETH
                          {usdVal && <span className="block text-right text-[10px] text-[var(--text-3)] font-normal">{usdVal}</span>}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Navigation Toolbar */}
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="game-category-strip flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("arena");
                setSelectedChallengeRoom(null);
              }}
              className={`play-button-ghost flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold transition ${
                activeTab === "arena" && !activeChallenge
                  ? "choice-option-selected border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "text-[var(--text-2)] hover:text-[var(--text-1)]"
              }`}
            >
              <Swords size={14} />
              Coin Duel
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("lobby")}
              className={`play-button-ghost flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold transition ${
                activeTab === "lobby"
                  ? "choice-option-selected border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "text-[var(--text-2)] hover:text-[var(--text-1)]"
              }`}
            >
              <Users size={14} />
              Open Lobby ({openRooms.length})
            </button>
          </div>

          {activeRoom && (
            <span className="badge font-mono text-xs">
              Room #{activeRoom.roomId} {activeRoom.status === 0 ? "(Open)" : activeRoom.status === 1 ? "(Rolling VRF)" : "(Settled)"}
            </span>
          )}
        </div>

        {/* View 1: Challenger Duel Confirmation Screen */}
        {activeChallenge && activeTab === "arena" && (
          <section className="game-stage min-h-[460px] p-4 md:p-6">
            <div className="flex h-full flex-col items-center justify-center gap-6 max-w-md mx-auto text-center">
              <button
                type="button"
                onClick={() => setSelectedChallengeRoom(null)}
                className="self-start flex items-center gap-1.5 text-xs text-[var(--text-3)] hover:text-[var(--text-1)] font-semibold transition"
              >
                <ArrowLeft size={13} />
                Back to Lobby
              </button>

              <div className="space-y-1">
                <h2 className="text-lg font-bold text-[var(--text-1)]">Accept Duel Room #{activeChallenge.roomId}</h2>
                <p className="text-xs text-[var(--text-3)]">
                  Click the button below to match the bet and start the coin flip.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="panel p-3 rounded-lg border border-[var(--border)] text-left">
                  <div className="text-[10px] text-[var(--text-3)] font-mono">HOST</div>
                  <div className="text-xs font-mono font-bold truncate text-[var(--text-1)]">
                    <BasenameLabel address={activeChallenge.playerA} />
                  </div>
                  <span className="badge text-[10px] mt-1">
                    {activeChallenge.choiceA === 0 ? "Heads (H)" : "Tails (T)"}
                  </span>
                </div>

                <div className="panel p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-left">
                  <div className="text-[10px] text-[var(--accent)] font-mono font-bold">YOUR SIDE</div>
                  <div className="text-xs font-mono font-bold text-[var(--text-1)]">
                    {activeChallenge.choiceA === 0 ? "Tails (T)" : "Heads (H)"}
                  </div>
                  <span className="badge text-[10px] text-[var(--accent)] border border-[var(--border)] bg-[var(--surface)] mt-1">
                    {activeChallenge.choiceA === 0 ? "T" : "H"}
                  </span>
                </div>
              </div>

              <div className="w-full panel p-3 rounded-lg border border-[var(--border)] flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-[var(--text-3)]">Bet: </span>
                  <strong className="text-[var(--text-1)]">{activeChallenge.betAmountEth} ETH</strong>
                </div>
                <div>
                  <span className="text-[var(--text-3)]">Pot: </span>
                  <strong className="text-[var(--win)]">
                    {(parseFloat(activeChallenge.betAmountEth) * 2 * 0.98).toFixed(5)} ETH
                  </strong>
                </div>
              </div>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleConfirmJoinDuel(activeChallenge)}
                className="w-full primary-action flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold text-white shadow-md disabled:opacity-50"
              >
                <Swords size={16} />
                Start Coin Duel ({activeChallenge.betAmountEth} ETH)
              </button>
            </div>
          </section>
        )}

        {/* View 2: Coin Duel Arena */}
        {!activeChallenge && activeTab === "arena" && (
          <section className={`game-stage min-h-[460px] p-4 md:p-6 ${isSettled ? (isWon ? "result-win-effect" : "result-loss-effect") : ""}`}>
            <div className="flex h-full flex-col items-center justify-center gap-7">
              {/* Host Open Room Invite Strip */}
              {isMyOpenRoom && (
                <div className="panel p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] space-y-2.5 w-full max-w-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-1)]">
                      Room #{activeRoom?.roomId} is Open
                    </span>
                    <span className="badge text-[10px] font-mono text-[var(--accent)] border border-[var(--border)] bg-[var(--surface)]">
                      {activeRoom?.choiceA === 0 ? "Heads (H)" : "Tails (T)"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => activeRoom && copyInviteLink(activeRoom.roomId)}
                      className="flex-1 flex items-center justify-between px-3 py-2 rounded-md bg-[var(--surface)] border border-[var(--border)] text-xs font-mono text-[var(--text-1)] hover:border-[var(--accent)] transition"
                    >
                      <span className="truncate">baseplay.games/games/pvp?room={activeRoom?.roomId}</span>
                      <span className="shrink-0 flex items-center gap-1 text-[var(--accent)] font-bold text-[11px]">
                        {copiedLink ? <Check size={12} className="text-[var(--win)]" /> : <Copy size={12} />}
                        {copiedLink ? "Copied" : "Copy"}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => activeRoom && handleCancelDuel(activeRoom.roomId)}
                      className="px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--lose)] text-xs font-bold hover:bg-[var(--lose-light)] transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Matched Duel Players Bar */}
              {activeRoom && !isMyOpenRoom && (
                <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                  <div className="panel p-3 rounded-lg flex items-center justify-between border border-[var(--border-2)] bg-[var(--surface)]">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-[var(--accent)] font-bold text-xs shrink-0">
                        <User size={14} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] text-[var(--text-3)] font-mono">
                          HOST {address && activeRoom.playerA.toLowerCase() === address.toLowerCase() ? "(YOU)" : ""}
                        </div>
                        <div className="text-xs font-mono font-bold truncate text-[var(--text-1)]">
                          <BasenameLabel address={activeRoom.playerA} />
                        </div>
                      </div>
                    </div>
                    <span className="badge font-mono text-xs font-bold">
                      {activeRoom.choiceA === 0 ? "H" : "T"}
                    </span>
                  </div>

                  <div className="panel p-3 rounded-lg flex items-center justify-between border border-[var(--border-2)] bg-[var(--surface)]">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-2)] font-bold text-xs shrink-0">
                        <User size={14} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] text-[var(--text-3)] font-mono">
                          CHALLENGER {address && activeRoom.playerB && activeRoom.playerB.toLowerCase() === address.toLowerCase() ? "(YOU)" : ""}
                        </div>
                        <div className="text-xs font-mono font-bold truncate text-[var(--text-1)]">
                          {activeRoom.playerB && activeRoom.playerB !== "0x0000000000000000000000000000000000000000" ? (
                            <BasenameLabel address={activeRoom.playerB} />
                          ) : (
                            "Waiting..."
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="badge font-mono text-xs font-bold">
                      {activeRoom.choiceA === 0 ? "T" : "H"}
                    </span>
                  </div>
                </div>
              )}

              {/* 3D Coin Animation Scene */}
              <div className={`coin-scene ${isBusy ? "coin-scene-running" : ""}`}>
                <div className="coin-orbit" />
                <div
                  className={`coin-face ${
                    isBusy ? "coin-face-spinning" : ""
                  } ${
                    isSettled
                      ? isWon
                        ? "coin-face-settled coin-face-win"
                        : "coin-face-settled coin-face-loss"
                      : "coin-face-idle"
                  }`}
                >
                  <span className="coin-rim" />
                  <span className="coin-mark">{coinFace}</span>
                  <span className="coin-caption">{result ?? currentChoice}</span>
                </div>
                <div className="coin-shadow" />
              </div>

              {/* Side Selector (When Creating Duel) */}
              {!activeRoom && (
                <div className="grid w-full max-w-md grid-cols-2 gap-2">
                  {(["Heads", "Tails"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      disabled={isBusy}
                      onClick={() => chooseSide(item)}
                      className={`coin-choice play-button-ghost rounded-md px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-55 ${
                        choice === item
                          ? "choice-option-selected border-[var(--accent)] bg-[var(--accent)] text-white"
                          : "text-[var(--text-2)] hover:border-[var(--accent)] hover:text-white"
                      }`}
                    >
                      <span>{item}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Round Summary Strip */}
              <RoundSummaryStrip
                items={[
                  { label: "Pick", value: currentChoice },
                  { label: "Landed", value: result ?? (isBusy ? "Resolving" : "-") },
                  { label: "Pays", value: "2x" }
                ]}
                status={isSettled ? (isWon ? "win" : "loss") : isBusy ? "running" : "idle"}
              />

              {/* In-Flow Clean Result Callout */}
              {isSettled && (
                <div className={`result-callout ${isWon ? "result-callout-win result-callout-shareable" : "result-callout-loss"} w-full max-w-md !static !transform-none mt-2`} role="status">
                  <div className="result-callout-icon">
                    {isWon ? <CheckCircle2 size={19} /> : <XCircle size={19} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="result-callout-label">{isWon ? "Won" : "Lost"}</div>
                    <div className="result-callout-title">{isWon ? "Correct side" : "Wrong side"}</div>
                    <div className="result-callout-detail">
                      Picked {currentChoice}, landed {result}. Winner: {activeRoom ? <BasenameLabel address={activeRoom.winner} /> : null}
                    </div>
                    {isWon && (
                      <div className="win-share-panel mt-3 pt-3 border-t border-[var(--border)]">
                        <div className="win-share-head flex items-center justify-between">
                          <div className="win-share-kicker flex items-center gap-1.5 text-xs text-[var(--win)] font-bold">
                            <Trophy size={13} />
                            Verified win
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowShareModal(true)}
                            className="px-3 py-1.5 rounded-md bg-[var(--win)] text-slate-950 font-bold text-xs shadow-sm hover:opacity-90 transition flex items-center gap-1"
                          >
                            <Share2 size={12} />
                            Share Card
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* View 3: Open Rooms Lobby */}
        {activeTab === "lobby" && (
          <section className="space-y-4">
            {openRooms.length === 0 ? (
              <div className="panel p-8 text-center space-y-3">
                <div className="p-3 rounded-full bg-[var(--surface-2)] w-12 h-12 mx-auto flex items-center justify-center text-[var(--text-3)]">
                  <Swords size={22} />
                </div>
                <h3 className="text-sm font-bold text-[var(--text-1)]">No Open Duels</h3>
                <p className="text-xs text-[var(--text-3)] max-w-sm mx-auto">
                  There are currently no open duel rooms. Use the panel on the left to create the first room on Base!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {openRooms.map((room) => {
                  const isHost = address && room.playerA.toLowerCase() === address.toLowerCase();
                  const totalPot = (parseFloat(room.betAmountEth) * 2).toFixed(5);
                  const challengerSide = room.choiceA === 0 ? "Tails (T)" : "Heads (H)";
                  const usdValue = ethUsd ? formatUsd(parseFloat(room.betAmountEth) * ethUsd) : null;

                  return (
                    <div key={room.roomId} className="panel p-4 flex flex-col justify-between space-y-4 hover:border-[var(--border-2)] transition">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-[var(--text-1)]">
                              {room.betAmountEth} ETH
                            </span>
                            {usdValue && <span className="text-[11px] text-[var(--text-3)]">({usdValue})</span>}
                          </div>
                          <div className="text-xs text-[var(--text-3)] flex items-center gap-1.5 font-mono truncate">
                            <span>Host:</span>
                            <BasenameLabel address={room.playerA} className="text-[var(--text-2)] font-semibold" />
                            {isHost && <span className="badge text-[10px] text-[var(--accent)]">You</span>}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <div className="text-[10px] text-[var(--text-3)] font-mono">POT</div>
                          <div className="text-xs font-mono font-bold text-[var(--win)]">{totalPot} ETH</div>
                        </div>
                      </div>

                      <div className="space-y-2.5 pt-2.5 border-t border-[var(--border)] text-xs">
                        <div className="flex items-center justify-between text-[11px] text-[var(--text-3)]">
                          <span>Host: <strong className="text-[var(--text-1)]">{room.choiceA === 0 ? "Heads (H)" : "Tails (T)"}</strong></span>
                          <span>You Get: <strong className="text-[var(--accent)]">{challengerSide}</strong></span>
                        </div>

                        {isHost ? (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => copyInviteLink(room.roomId)}
                              className="py-2.5 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--accent)] text-xs font-bold hover:bg-[var(--surface)] transition flex items-center justify-center gap-1.5"
                            >
                              <Share2 size={13} />
                              Invite
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleCancelDuel(room.roomId)}
                              className="py-2.5 rounded-md border border-[var(--lose)] text-[var(--lose)] text-xs font-bold hover:bg-[var(--lose-light)] transition disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              setSelectedChallengeRoom(room);
                              setActiveTab("arena");
                            }}
                            className="w-full primary-action flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-bold text-white shadow-sm disabled:opacity-50"
                          >
                            <Swords size={14} />
                            Accept Duel ({room.betAmountEth} ETH)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      <ShareWinModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        gameName="PvP Coin Duel"
        payoutEth={activeRoom ? parseFloat(activeRoom.betAmountEth) * 2 * 0.98 : 0}
        betAmountEth={activeRoom?.betAmountEth}
        multiplier="1.96x"
        playerAddress={address}
        txHash={txHash}
      />
    </GameShell>
  );
}
