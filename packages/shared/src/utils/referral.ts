export const REFERRAL_STORAGE_KEY = "baseplay:referral";

export function buildReferralClaimMessage({ player, referrer }: { player: string; referrer: string }) {
  return [
    "BasePlay referral claim",
    "",
    `Player: ${player}`,
    `Referrer: ${referrer.trim()}`,
    "",
    "This signature links this wallet to a BasePlay referrer. It does not authorize a transaction or move funds."
  ].join("\n");
}

export function normalizeReferralInput(value: string | null | undefined) {
  return (value ?? "").trim().replace(/^@/, "");
}
