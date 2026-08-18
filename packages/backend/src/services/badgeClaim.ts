import fs from "node:fs";
import path from "node:path";
import { getAddress, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getContractAddress } from "@baseplay/shared/config/addresses";
import { supabaseAdmin } from "../supabase/client.js";

function getPrivateKey(): `0x${string}` | null {
  const candidateKeys = [
    "PRIVATE_KEY",
    "SIGNER_PRIVATE_KEY",
    "PLATFORM_SIGNER_PRIVATE_KEY",
    "BADGE_SIGNER_PRIVATE_KEY",
    "ADMIN_PRIVATE_KEY",
    "BACKEND_PRIVATE_KEY",
    "SERVER_PRIVATE_KEY",
    "RELAYER_PRIVATE_KEY",
    "DEPLOYER_PRIVATE_KEY",
    "WALLET_PRIVATE_KEY",
    "EVM_PRIVATE_KEY",
    "NEXT_PUBLIC_PRIVATE_KEY"
  ];

  let raw: string | undefined;

  for (const key of candidateKeys) {
    const val = process.env[key];
    if (val && typeof val === "string" && val.trim().length > 0) {
      raw = val;
      break;
    }
  }

  // Fallback: case-insensitive scan of all env keys
  if (!raw) {
    for (const [k, v] of Object.entries(process.env)) {
      if (!v || typeof v !== "string" || !v.trim()) continue;
      const clean = k.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
      if (
        clean === "privatekey" ||
        clean === "signerprivatekey" ||
        clean === "platformsignerprivatekey" ||
        clean === "badgesignerprivatekey" ||
        clean === "adminprivatekey" ||
        clean.endsWith("privatekey") ||
        clean.endsWith("signerkey")
      ) {
        raw = v;
        break;
      }
    }
  }

  if (!raw) return null;

  const noComments = raw.split("#")[0].split("//")[0];
  const cleaned = noComments.trim().replace(/^["']|["']$/g, "").replace(/[\r\n\t\s]/g, "");
  if (!cleaned) return null;

  const hex = cleaned.startsWith("0x") ? cleaned : `0x${cleaned}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    console.warn(`[badgeClaim] Signer private key format invalid (length: ${hex.length}). Expected 66 chars (0x + 64 hex).`);
    return null;
  }

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
    return { success: false, error: "Platform signer not configured on backend. Please ensure PRIVATE_KEY is set in Railway environment variables." };
  }

  let signerAccount;
  try {
    signerAccount = privateKeyToAccount(privateKey);
  } catch (err: any) {
    console.error("[badgeClaim] Failed to initialize signer account:", err?.message);
    return { success: false, error: "Invalid platform signer private key on backend" };
  }
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
