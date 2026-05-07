import { NextResponse } from "next/server";
import { createPublicClient, encodePacked, fallback, getAddress, http, keccak256, namehash, parseAbi } from "viem";
import { base, mainnet } from "viem/chains";
import { BASE_MAINNET_FRONTEND_RPC_URLS } from "@baseplay/shared/config/networks";

const BASE_L2_RESOLVER = "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD";
const BASE_COIN_TYPE = "80002105";
const l2ResolverAbi = parseAbi(["function name(bytes32 node) view returns (string)"]);

const baseClient = createPublicClient({
  chain: base,
  transport: fallback(BASE_MAINNET_FRONTEND_RPC_URLS.map((url) => http(url, { timeout: 8_000, retryCount: 1, retryDelay: 250 })))
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
    const name = await getBasename(normalized) ?? await getEnsName(normalized);
    return NextResponse.json(
      { name },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900"
        }
      }
    );
  } catch {
    return NextResponse.json({ name: null }, { status: 200 });
  }
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
