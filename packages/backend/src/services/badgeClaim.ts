import { getAddress, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getContractAddress } from "@baseplay/shared/config/addresses";
import { supabaseAdmin } from "../supabase/client.js";

function getPrivateKey(): `0x${string}` | null {
  const raw = process.env.PRIVATE_KEY;
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^["']|["']$/g, "").replace(/[\r\n\t\s]/g, "");
  if (!cleaned) return null;
  const hex = cleaned.startsWith("0x") ? cleaned : `0x${cleaned}`;
  return hex as `0x${string}`;
}

export async function generateBadgeClaimSignature(input: {
  address: string;
  tokenId?: number;
  tokenIds?: number[];
}) {
  const { address, tokenId, tokenIds } = input;
  if (!address || !isAddress(address)) {
    return { success: false, error: "Invalid player address" };
  }

  const playerAddress = getAddress(address);
  const privateKey = getPrivateKey();
  if (!privateKey) {
    return { success: false, error: "Platform signer not configured on backend" };
  }

  const signerAccount = privateKeyToAccount(privateKey);
  const contractAddress = getContractAddress(8453, "BasePlayBadges");

  // Verify ownership in database
  if (supabaseAdmin) {
    try {
      const { data: unlockedBadges, error } = await supabaseAdmin
        .from("player_badges")
        .select("badge_id, badge_definitions(token_id)")
        .eq("player", playerAddress.toLowerCase());

      if (error) {
        console.error("[badgeClaim] Supabase error:", error);
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
          return { success: false, error: "Badge not earned by this player" };
        }

        if (Array.isArray(tokenIds)) {
          const hasAll = tokenIds.every((id: number) => unlockedTokenIds.has(Number(id)));
          if (!hasAll) {
            return { success: false, error: "One or more badges not earned by player" };
          }
        }
      }
    } catch (sbErr) {
      console.warn("[badgeClaim] Supabase verification catch:", sbErr);
    }
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour validity

  const domain = {
    name: "BasePlay Badges",
    version: "1",
    chainId: 8453,
    verifyingContract: contractAddress
  } as const;

  // Single claim
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

    return {
      success: true,
      contractAddress,
      player: playerAddress,
      tokenId: Number(parsedTokenId),
      deadline: Number(deadline),
      signature
    };
  }

  // Batch claim
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

    return {
      success: true,
      contractAddress,
      player: playerAddress,
      tokenIds: tokenIds.map(Number),
      deadline: Number(deadline),
      signature
    };
  }

  return { success: false, error: "Missing tokenId or tokenIds" };
}
