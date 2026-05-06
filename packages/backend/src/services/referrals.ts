import { buildReferralClaimMessage, normalizeReferralInput } from "@baseplay/shared/utils/referral";
import { getAddress, isAddress, verifyMessage, type Hex } from "viem";
import { supabaseAdmin } from "../supabase/client.js";

export type ReferralClaimInput = {
  player: string;
  referrer: string;
  message: string;
  signature: Hex;
};

export async function claimReferral(input: ReferralClaimInput) {
  if (!isAddress(input.player)) {
    throw Object.assign(new Error("Invalid player address"), { statusCode: 400 });
  }

  const player = getAddress(input.player).toLowerCase();
  const referrerInput = normalizeReferralInput(input.referrer);
  if (!referrerInput) {
    throw Object.assign(new Error("Missing referrer"), { statusCode: 400 });
  }

  const expectedMessage = buildReferralClaimMessage({ player: getAddress(input.player), referrer: referrerInput });
  if (input.message !== expectedMessage) {
    throw Object.assign(new Error("Invalid referral signature message"), { statusCode: 400 });
  }

  const valid = await verifyMessage({
    address: getAddress(input.player),
    message: input.message,
    signature: input.signature
  });
  if (!valid) {
    throw Object.assign(new Error("Invalid referral signature"), { statusCode: 401 });
  }

  const referrer = await resolveReferrer(referrerInput);
  if (!referrer) {
    throw Object.assign(new Error("Referrer was not found"), { statusCode: 404 });
  }
  if (referrer === player) {
    throw Object.assign(new Error("Self-referral is not allowed"), { statusCode: 400 });
  }

  await ensurePlayer(player);
  await ensurePlayer(referrer);
  await ensureReferralCode(player);
  await ensureReferralCode(referrer);

  const existing = await supabaseAdmin
    .from("player_referrals")
    .select("*")
    .eq("referred_player", player)
    .maybeSingle();

  if (existing.error) {
    throw Object.assign(new Error(existing.error.message), { statusCode: 500 });
  }
  if (existing.data) {
    return {
      status: existing.data.referrer_player === referrer ? "existing" : "locked",
      referral: existing.data
    };
  }

  const { data, error } = await supabaseAdmin
    .from("player_referrals")
    .insert({
      referred_player: player,
      referrer_player: referrer,
      referral_code: referrerInput,
      source: "wallet_signature"
    })
    .select("*")
    .single();

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 });
  }

  await awardReferralStarterBadge(referrer);
  return { status: "claimed", referral: data };
}

export async function getReferralSummary(playerAddress: string) {
  if (!isAddress(playerAddress)) {
    throw Object.assign(new Error("Invalid player address"), { statusCode: 400 });
  }

  const player = getAddress(playerAddress).toLowerCase();
  await ensurePlayer(player);
  const code = await ensureReferralCode(player);
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: referrals, error: referralError }, { data: rewards, error: rewardError }, { data: myReferrer, error: myReferrerError }] = await Promise.all([
    supabaseAdmin.from("player_referrals").select("*").eq("referrer_player", player).order("claimed_at", { ascending: false }).limit(100),
    supabaseAdmin.from("referral_rewards").select("*").eq("referrer_player", player).order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.from("player_referrals").select("*").eq("referred_player", player).maybeSingle()
  ]);

  if (referralError || rewardError || myReferrerError) {
    throw Object.assign(new Error(referralError?.message ?? rewardError?.message ?? myReferrerError?.message), { statusCode: 500 });
  }

  const rewardRows = rewards ?? [];
  const totalXp = rewardRows.reduce((sum, row) => sum + Number(row.xp_awarded), 0);
  const dailyXp = rewardRows
    .filter((row) => String(row.reward_day) === today)
    .reduce((sum, row) => sum + Number(row.xp_awarded), 0);
  const activeReferredPlayers = new Set(rewardRows.map((row) => row.referred_player));

  return {
    player,
    code: code?.code ?? null,
    referralUrlPath: code?.code ? `/?ref=${encodeURIComponent(code.code)}` : null,
    referredBy: myReferrer?.referrer_player ?? null,
    totalReferrals: referrals?.length ?? 0,
    activeReferrals: activeReferredPlayers.size,
    totalXp,
    dailyXp,
    referrals: referrals ?? [],
    recentRewards: rewardRows.slice(0, 25)
  };
}

async function resolveReferrer(rawReferrer: string) {
  if (isAddress(rawReferrer)) {
    return getAddress(rawReferrer).toLowerCase();
  }

  const normalized = normalizeReferralInput(rawReferrer);
  const code = normalized.toUpperCase();
  const lower = normalized.toLowerCase();

  const codeRow = await supabaseAdmin.from("referral_codes").select("player").eq("code", code).maybeSingle();
  if (codeRow.data?.player) return String(codeRow.data.player).toLowerCase();

  const playerByCode = await supabaseAdmin.from("players").select("wallet_address").eq("referral_code", code).maybeSingle();
  if (playerByCode.data?.wallet_address) return String(playerByCode.data.wallet_address).toLowerCase();

  const playerByName = await supabaseAdmin.from("players").select("wallet_address").eq("username", lower).maybeSingle();
  if (playerByName.data?.wallet_address) return String(playerByName.data.wallet_address).toLowerCase();

  return null;
}

async function ensurePlayer(player: string) {
  await supabaseAdmin
    .from("players")
    .upsert({ wallet_address: player }, { onConflict: "wallet_address", ignoreDuplicates: true });
}

async function ensureReferralCode(player: string) {
  const existing = await supabaseAdmin.from("referral_codes").select("*").eq("player", player).maybeSingle();
  if (existing.data) return existing.data;

  const { data } = await supabaseAdmin
    .from("referral_codes")
    .insert({ player })
    .select("*")
    .maybeSingle();
  return data;
}

async function awardReferralStarterBadge(player: string) {
  await supabaseAdmin.from("player_badges").upsert(
    {
      player,
      badge_id: "referral-starter",
      source: "referral"
    },
    { onConflict: "player,badge_id", ignoreDuplicates: true }
  );
}
