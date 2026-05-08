"use client";

import type { Database } from "@baseplay/shared/types/supabase.types";
import { getNetworkByChainId } from "@baseplay/shared/config/networks";
import { createPublicClient, fallback, http, parseAbi, parseEventLogs, type PublicClient } from "viem";
import { getSupabaseBrowser } from "@/lib/supabase";
import type { FeedRound } from "@/hooks/useRecentRounds";

export type RoundEvent = Database["public"]["Tables"]["round_events"]["Row"];
export type RoundSummary = Database["public"]["Tables"]["game_rounds"]["Row"];

const ROUND_DETAIL_ABI = parseAbi([
  "event BetPlaced(address indexed player, uint256 indexed requestId, uint256 betAmount, bytes params)",
  "event RoundSettled(address indexed player, uint256 indexed requestId, uint256 betAmount, uint256 payout, bool won)",
  "event BetRefundClaimed(address indexed player, uint256 indexed requestId, uint256 betAmount)",
  "event CrashPointGenerated(uint256 indexed requestId, uint256 crashPoint)"
]);

const clients = new Map<number, PublicClient>();

export interface RoundDetails {
  round: FeedRound | RoundSummary | null;
  events: RoundEvent[];
  source: "supabase" | "row" | "unavailable";
}

export function getTxExplorerUrl(chainId: number, txHash?: string | null) {
  if (!txHash) return null;
  const explorer = getNetworkByChainId(chainId)?.blockExplorer;
  return explorer ? `${explorer}/tx/${txHash}` : null;
}

export function getAddressExplorerUrl(chainId: number, address?: string | null) {
  if (!address) return null;
  const explorer = getNetworkByChainId(chainId)?.blockExplorer;
  return explorer ? `${explorer}/address/${address}` : null;
}

export function getRoundPath(round: Pick<FeedRound, "chain_id" | "vrf_request_id">) {
  return round.vrf_request_id ? `/rounds/${round.chain_id}/${round.vrf_request_id}` : null;
}

export async function fetchRoundDetails({
  chainId,
  requestId,
  seedRound
}: {
  chainId: number;
  requestId?: string | null;
  seedRound?: FeedRound | null;
}): Promise<RoundDetails> {
  const supabase = getSupabaseBrowser();
  if (!requestId) {
    return { round: seedRound ?? null, events: [], source: seedRound ? "row" : "unavailable" };
  }

  if (!supabase) {
    const events = seedRound?.tx_hash
      ? await fetchReceiptEvents({ chainId, requestId, txHash: seedRound.tx_hash, round: seedRound })
      : [];
    return { round: seedRound ?? null, events, source: seedRound ? "row" : "unavailable" };
  }

  const [roundResult, eventsResult] = await Promise.all([
    supabase
      .from("game_rounds")
      .select("*")
      .eq("chain_id", chainId)
      .eq("vrf_request_id", requestId)
      .maybeSingle(),
    supabase
      .from("round_events")
      .select("*")
      .eq("chain_id", chainId)
      .eq("vrf_request_id", requestId)
      .order("block_number", { ascending: true, nullsFirst: false })
      .order("log_index", { ascending: true })
  ]);

  if (roundResult.error || eventsResult.error) {
    console.warn("[BasePlay] Round detail query failed", roundResult.error?.message ?? eventsResult.error?.message);
  }

  const dbRound = roundResult.data ?? seedRound ?? null;
  const dbEvents = eventsResult.data ?? [];
  const receiptEvents = dbEvents.length === 0 && dbRound?.tx_hash
    ? await fetchReceiptEvents({ chainId, requestId, txHash: dbRound.tx_hash, round: dbRound })
    : [];

  return {
    round: dbRound,
    events: dbEvents.length > 0 ? dbEvents : receiptEvents,
    source: roundResult.data || dbEvents.length > 0 ? "supabase" : seedRound || receiptEvents.length > 0 ? "row" : "unavailable"
  };
}

export function eventLabel(eventName: string) {
  switch (eventName) {
    case "BetPlaced":
      return "Bet placed";
    case "CrashPointGenerated":
      return "Crash point generated";
    case "RoundSettled":
      return "Round settled";
    case "BetRefundClaimed":
      return "Refund claimed";
    default:
      return eventName.replace(/([a-z])([A-Z])/g, "$1 $2");
  }
}

async function fetchReceiptEvents({
  chainId,
  requestId,
  txHash,
  round
}: {
  chainId: number;
  requestId: string;
  txHash: string;
  round: FeedRound | RoundSummary;
}): Promise<RoundEvent[]> {
  const client = getClient(chainId);
  if (!client || !txHash.startsWith("0x")) return [];

  try {
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    const parsed = parseEventLogs({ abi: ROUND_DETAIL_ABI, logs: receipt.logs });
    return parsed
      .filter((event) => {
        const eventRequestId = (event.args as { requestId?: bigint }).requestId;
        return eventRequestId?.toString() === requestId;
      })
      .map((event, index) => ({
        id: `${txHash}-${event.logIndex ?? index}`,
        vrf_request_id: requestId,
        event_name: event.eventName,
        tx_hash: txHash,
        block_number: receipt.blockNumber ? Number(receipt.blockNumber) : null,
        log_index: event.logIndex ?? index,
        player: typeof (event.args as { player?: unknown }).player === "string" ? String((event.args as { player?: string }).player).toLowerCase() : round.player,
        game_id: round.game_id,
        chain_id: chainId,
        contract_address: event.address.toLowerCase(),
        args: serializeArgs(event.args),
        observed_at: round.settled_at
      }));
  } catch (error) {
    console.warn("[BasePlay] Receipt event fallback failed", error instanceof Error ? error.message : String(error));
    return [];
  }
}

function getClient(chainId: number) {
  const existing = clients.get(chainId);
  if (existing) return existing;

  const network = getNetworkByChainId(chainId);
  if (!network?.frontendRpcUrls?.length) return null;

  const client = createPublicClient({
    chain: {
      id: network.chainId,
      name: network.name,
      nativeCurrency: network.nativeCurrency,
      rpcUrls: { default: { http: network.frontendRpcUrls } }
    },
    transport: fallback(network.frontendRpcUrls.map((url) => http(url, { timeout: 10_000 })))
  });
  clients.set(chainId, client);
  return client;
}

function serializeArgs(value: unknown): RoundEvent["args"] {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeArgs);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => Number.isNaN(Number(key)))
        .map(([key, nestedValue]) => [key, serializeArgs(nestedValue)])
    );
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) return value;
  return String(value);
}
