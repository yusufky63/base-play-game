import { NextResponse } from "next/server";
import { createPublicClient, encodePacked, fallback, getAddress, http, keccak256, namehash, parseAbi } from "viem";
import { base, mainnet } from "viem/chains";
import { BASE_MAINNET_BACKEND_RPC_URLS } from "@baseplay/shared/config/networks";

const BASE_L2_RESOLVER = "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD";
const BASE_COIN_TYPE = "80002105";
const CACHE_TTL_MS = 24 * 60 * 60_000;
const CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=604800";
const l2ResolverAbi = parseAbi(["function name(bytes32 node) view returns (string)"]);
const cache = new Map<string, { name: string | null; expiresAt: number }>();
const pending = new Map<string, Promise<string | null>>();

const baseClient = createPublicClient({
  chain: base,
  transport: fallback(BASE_MAINNET_BACKEND_RPC_URLS.map((url) => http(url, { timeout: 8_000, retryCount: 1, retryDelay: 250 })))
});

const mainnetRpcUrl = process.env.MAINNET_RPC_URL || process.env.ETHEREUM_RPC_URL || "";
const mainnetClient = mainnetRpcUrl
  ? createPublicClient({
      chain: mainnet,
      transport: http(mainnetRpcUrl, { timeout: 8_000, retryCount: 1, retryDelay: 250 })
    })
  : null;

export async function GET(_request: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;

  try {
    const normalized = getAddress(address);
    const name = await resolveCachedName(normalized);
    return NextResponse.json(
      { name },
      {
        headers: {
          "Cache-Control": CACHE_CONTROL
        }
      }
    );
  } catch {
    return NextResponse.json({ name: null }, { status: 200, headers: { "Cache-Control": CACHE_CONTROL } });
  }
}

async function resolveCachedName(address: `0x${string}`) {
  const key = address.toLowerCase();
  const current = cache.get(key);
  if (current && current.expiresAt > Date.now()) return current.name;

  let request = pending.get(key);
  if (!request) {
    request = Promise.resolve(getBasename(address))
      .then((basename) => basename ?? getEnsName(address))
      .then((name) => {
        cache.set(key, { name, expiresAt: Date.now() + CACHE_TTL_MS });
        return name;
      })
      .finally(() => {
        pending.delete(key);
      });
    pending.set(key, request);
  }

  return request;
}

async function getBasename(address: `0x${string}`) {
  try {
    const reverseNode = getBaseReverseNode(address);
    return await baseClient.readContract({
      address: BASE_L2_RESOLVER,
      abi: l2ResolverAbi,
      functionName: "name",
      args: [reverseNode]
    });
  } catch {
    return null;
  }
}

async function getEnsName(address: `0x${string}`) {
  if (!mainnetClient) return null;

  try {
    return await mainnetClient.getEnsName({ address });
  } catch {
    return null;
  }
}

function getBaseReverseNode(address: `0x${string}`) {
  const addressNode = keccak256(address.toLowerCase().slice(2) as `0x${string}`);
  const baseReverseNode = namehash(`${BASE_COIN_TYPE}.reverse`);
  return keccak256(encodePacked(["bytes32", "bytes32"], [baseReverseNode, addressNode]));
}
