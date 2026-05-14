import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { BASE_MAINNET_BACKEND_RPC_URLS } from "@baseplay/shared/config/networks";
import { createPublicClient, formatEther, parseAbi } from "viem";
import { base } from "viem/chains";
import { env } from "../config/env.js";
import { createPublicFirstTransport } from "./rpc.js";

const BASE_VRF_COORDINATOR = "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634" as const;

const vrfSubscriptionAbi = parseAbi([
  "function getSubscription(uint256 subId) view returns (uint96 balance,uint96 nativeBalance,uint64 reqCount,address owner,address[] consumers)",
  "function pendingRequestExists(uint256 subId) view returns (bool)"
]);

const luckyDrawOpsAbi = parseAbi([
  "function availableLiquidity() view returns (uint256)",
  "function totalPendingReserve() view returns (uint256)",
  "function totalClaimablePrizes() view returns (uint256)",
  "function maxPrizeAmount() view returns (uint256)",
  "function roundsRequired() view returns (uint256)",
  "function minEligibleBet() view returns (uint256)",
  "function paused() view returns (bool)",
  "function owner() view returns (address)"
]);

const client = createPublicClient({
  chain: base,
  transport: createPublicFirstTransport(BASE_MAINNET_BACKEND_RPC_URLS, { timeout: 10_000 })
});

export async function getAdminOpsState() {
  const chainId = 8453;
  const luckyDrawAddress = CONTRACT_ADDRESSES[chainId]?.LuckyDraw ?? null;
  const subscriptionId = env.VRF_SUB_ID_MAINNET;

  const [subscription, pendingRequestExists, luckyDraw] = await Promise.all([
    loadVrfSubscription(subscriptionId),
    client
      .readContract({
        address: BASE_VRF_COORDINATOR,
        abi: vrfSubscriptionAbi,
        functionName: "pendingRequestExists",
        args: [BigInt(subscriptionId)]
      })
      .catch(() => null),
    luckyDrawAddress ? loadLuckyDraw(luckyDrawAddress) : null
  ]);

  const normalizedLuckyDraw = luckyDrawAddress?.toLowerCase() ?? null;
  const consumers = subscription.consumers.map((consumer) => consumer.toLowerCase());

  return {
    status: "ok" as const,
    chainId,
    updatedAt: new Date().toISOString(),
    vrf: {
      coordinator: BASE_VRF_COORDINATOR,
      subscriptionId,
      linkBalanceJuels: subscription.linkBalance.toString(),
      linkBalance: formatLink(subscription.linkBalance),
      nativeBalanceWei: subscription.nativeBalance.toString(),
      nativeBalanceEth: formatEther(subscription.nativeBalance),
      requestCount: subscription.requestCount.toString(),
      owner: subscription.owner,
      consumers: subscription.consumers,
      pendingRequestExists: pendingRequestExists === true,
      luckyDrawConsumerReady: Boolean(normalizedLuckyDraw && consumers.includes(normalizedLuckyDraw))
    },
    luckyDraw: luckyDrawAddress
      ? {
          address: luckyDrawAddress,
          deployed: true,
          ...luckyDraw
        }
      : {
          address: null,
          deployed: false
        }
  };
}

async function loadVrfSubscription(subscriptionId: string) {
  const [linkBalance, nativeBalance, requestCount, owner, consumers] = await client.readContract({
    address: BASE_VRF_COORDINATOR,
    abi: vrfSubscriptionAbi,
    functionName: "getSubscription",
    args: [BigInt(subscriptionId)]
  });

  return {
    linkBalance,
    nativeBalance,
    requestCount,
    owner,
    consumers
  };
}

async function loadLuckyDraw(address: `0x${string}`) {
  const results = await client.multicall({
    allowFailure: true,
    contracts: [
      { address, abi: luckyDrawOpsAbi, functionName: "availableLiquidity" },
      { address, abi: luckyDrawOpsAbi, functionName: "totalPendingReserve" },
      { address, abi: luckyDrawOpsAbi, functionName: "totalClaimablePrizes" },
      { address, abi: luckyDrawOpsAbi, functionName: "maxPrizeAmount" },
      { address, abi: luckyDrawOpsAbi, functionName: "roundsRequired" },
      { address, abi: luckyDrawOpsAbi, functionName: "minEligibleBet" },
      { address, abi: luckyDrawOpsAbi, functionName: "paused" },
      { address, abi: luckyDrawOpsAbi, functionName: "owner" }
    ]
  });

  const availableLiquidity = readResult<bigint>(results, 0) ?? 0n;
  const totalPendingReserve = readResult<bigint>(results, 1) ?? 0n;
  const totalClaimablePrizes = readResult<bigint>(results, 2) ?? 0n;
  const maxPrizeAmount = readResult<bigint>(results, 3) ?? 0n;
  const roundsRequired = readResult<bigint>(results, 4) ?? 0n;
  const minEligibleBet = readResult<bigint>(results, 5) ?? 0n;
  const paused = readResult<boolean>(results, 6);
  const owner = readResult<string>(results, 7);

  return {
    availableLiquidityWei: availableLiquidity.toString(),
    availableLiquidityEth: formatEther(availableLiquidity),
    totalPendingReserveWei: totalPendingReserve.toString(),
    totalPendingReserveEth: formatEther(totalPendingReserve),
    totalClaimablePrizesWei: totalClaimablePrizes.toString(),
    totalClaimablePrizesEth: formatEther(totalClaimablePrizes),
    maxPrizeAmountWei: maxPrizeAmount.toString(),
    maxPrizeAmountEth: formatEther(maxPrizeAmount),
    roundsRequired: roundsRequired.toString(),
    minEligibleBetWei: minEligibleBet.toString(),
    minEligibleBetEth: formatEther(minEligibleBet),
    paused: paused === true,
    owner: owner ?? null
  };
}

function readResult<T>(results: readonly { status: "success" | "failure"; result?: unknown }[], index: number): T | null {
  const entry = results[index];
  return entry?.status === "success" ? (entry.result as T) : null;
}

function formatLink(juels: bigint) {
  return (Number(juels) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 6 });
}
