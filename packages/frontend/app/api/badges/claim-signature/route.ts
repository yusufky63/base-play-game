import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getContractAddress } from "@baseplay/shared/config/addresses";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

function getPrivateKey(): `0x${string}` | null {
  let raw = process.env.PRIVATE_KEY;
  if (!raw) {
    const candidatePaths = [
      path.resolve(process.cwd(), ".env.local"),
      path.resolve(process.cwd(), ".env"),
      path.resolve(process.cwd(), "../../.env"),
      path.resolve(process.cwd(), "../.env")
    ];

    for (const envPath of candidatePaths) {
      if (fs.existsSync(envPath)) {
        try {
          const content = fs.readFileSync(envPath, "utf8");
          const match = content.match(/^PRIVATE_KEY=(.*)$/m);
          if (match && match[1]) {
            raw = match[1];
            break;
          }
        } catch {}
      }
    }
  }

  if (!raw) return null;

  const cleaned = raw.trim().replace(/^["']|["']$/g, "").replace(/[\r\n\t\s]/g, "");
  if (!cleaned) return null;

  const hex = cleaned.startsWith("0x") ? cleaned : `0x${cleaned}`;
  return hex as `0x${string}`;
}

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { address, tokenId, tokenIds } = body;

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Invalid player address" }, { status: 400 });
    }

    const playerAddress = getAddress(address);
    const privateKey = getPrivateKey();
    if (!privateKey) {
      return NextResponse.json({ error: "Platform signer not configured" }, { status: 500 });
    }

    const signerAccount = privateKeyToAccount(privateKey);
    const contractAddress = getContractAddress(8453, "BasePlayBadges");

    const supabase = getSupabaseServer();

    // Verify ownership in database if supabase is configured
    if (supabase) {
      const { data: unlockedBadges, error } = await supabase
        .from("player_badges")
        .select("badge_id, badge_definitions(token_id)")
        .eq("player", playerAddress.toLowerCase());

      if (error) {
        console.error("[claim-signature] Supabase error:", error);
      } else if (unlockedBadges) {
        const unlockedTokenIds = new Set(
          unlockedBadges
            .map((b: any) => {
              const def = Array.isArray(b.badge_definitions) ? b.badge_definitions[0] : b.badge_definitions;
              return def?.token_id;
            })
            .filter((id): id is number => typeof id === "number")
        );

        if (tokenId !== undefined && !unlockedTokenIds.has(Number(tokenId))) {
          return NextResponse.json({ error: "Badge not earned by this player" }, { status: 403 });
        }

        if (Array.isArray(tokenIds)) {
          const hasAll = tokenIds.every((id: number) => unlockedTokenIds.has(Number(id)));
          if (!hasAll) {
            return NextResponse.json({ error: "One or more badges not earned by player" }, { status: 403 });
          }
        }
      }
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour validity

    const domain = {
      name: "BasePlay Badges",
      version: "1",
      chainId: 8453,
      verifyingContract: contractAddress
    } as const;

    // Single badge claim signature
    if (tokenId !== undefined && !tokenIds) {
      const parsedTokenId = BigInt(tokenId);
      const signature = await signerAccount.signTypedData({
        domain,
        types: {
          ClaimBadge: [
            { name: "player", type: "address" },
            { name: "tokenId", type: "uint256" },
            { name: "deadline", type: "uint256" }
          ]
        },
        primaryType: "ClaimBadge",
        message: {
          player: playerAddress,
          tokenId: parsedTokenId,
          deadline
        }
      });

      return NextResponse.json({
        success: true,
        contractAddress,
        player: playerAddress,
        tokenId: Number(parsedTokenId),
        deadline: Number(deadline),
        signature
      });
    }

    // Batch badge claim signature
    if (Array.isArray(tokenIds) && tokenIds.length > 0) {
      const parsedTokenIds = tokenIds.map((id: number) => BigInt(id));
      const signature = await signerAccount.signTypedData({
        domain,
        types: {
          ClaimBadgesBatch: [
            { name: "player", type: "address" },
            { name: "tokenIds", type: "uint256[]" },
            { name: "deadline", type: "uint256" }
          ]
        },
        primaryType: "ClaimBadgesBatch",
        message: {
          player: playerAddress,
          tokenIds: parsedTokenIds,
          deadline
        }
      });

      return NextResponse.json({
        success: true,
        contractAddress,
        player: playerAddress,
        tokenIds: tokenIds.map(Number),
        deadline: Number(deadline),
        signature
      });
    }

    return NextResponse.json({ error: "Missing tokenId or tokenIds" }, { status: 400 });
  } catch (err: any) {
    console.error("[claim-signature] Server error:", err);
    return NextResponse.json({ error: err?.message || "Failed to generate signature" }, { status: 500 });
  }
}
