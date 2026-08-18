import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BADGE_METADATA_MAP: Record<number, {
  name: string;
  description: string;
  category: string;
  image: string;
  tier: string;
}> = {
  1: {
    name: "First Round",
    description: "Played your first settled BasePlay round on Base.",
    category: "Progression",
    image: "https://baseplay.games/badges/first-round.png",
    tier: "Bronze"
  },
  2: {
    name: "First Win",
    description: "Won your first settled BasePlay round on Base.",
    category: "Progression",
    image: "https://baseplay.games/badges/first-win.png",
    tier: "Bronze"
  },
  3: {
    name: "10 Rounds",
    description: "Played 10 settled BasePlay rounds on Base.",
    category: "Progression",
    image: "https://baseplay.games/badges/ten-rounds.png",
    tier: "Bronze"
  },
  4: {
    name: "100 Rounds",
    description: "Played 100 settled BasePlay rounds on Base.",
    category: "Progression",
    image: "https://baseplay.games/badges/hundred-rounds.png",
    tier: "Gold"
  },
  5: {
    name: "7-Day Streak",
    description: "Kept a seven day play streak on BasePlay.",
    category: "Streak",
    image: "https://baseplay.games/badges/seven-day-streak.png",
    tier: "Silver"
  },
  6: {
    name: "Weekly Grinder",
    description: "Completed the weekly round quest on BasePlay.",
    category: "Quest",
    image: "https://baseplay.games/badges/weekly-grinder.png",
    tier: "Silver"
  },
  7: {
    name: "Game Explorer",
    description: "Played five different BasePlay games.",
    category: "Quest",
    image: "https://baseplay.games/badges/game-explorer.png",
    tier: "Silver"
  },
  8: {
    name: "Referral Starter",
    description: "Invited a player into BasePlay.",
    category: "Social",
    image: "https://baseplay.games/badges/referral-starter.png",
    tier: "Bronze"
  },
  9: {
    name: "Big Win 5x",
    description: "Hit a 5x or higher winning payout on Base.",
    category: "Win",
    image: "https://baseplay.games/badges/big-win-5x.png",
    tier: "Gold"
  },
  10: {
    name: "Lucky Draw Winner",
    description: "Won a prize from the on-chain Lucky Draw.",
    category: "Promotional",
    image: "https://baseplay.games/badges/lucky-draw-winner.png",
    tier: "Gold"
  },
  11: {
    name: "25 Rounds",
    description: "Played 25 settled BasePlay rounds on Base.",
    category: "Progression",
    image: "https://baseplay.games/badges/twenty-five-rounds.png",
    tier: "Bronze"
  },
  12: {
    name: "50 Rounds",
    description: "Played 50 settled BasePlay rounds on Base.",
    category: "Progression",
    image: "https://baseplay.games/badges/fifty-rounds.png",
    tier: "Silver"
  },
  13: {
    name: "10 Wins",
    description: "Won 10 settled BasePlay rounds on Base.",
    category: "Progression",
    image: "https://baseplay.games/badges/ten-wins.png",
    tier: "Silver"
  },
  14: {
    name: "50 Wins",
    description: "Won 50 settled BasePlay rounds on Base.",
    category: "Progression",
    image: "https://baseplay.games/badges/fifty-wins.png",
    tier: "Gold"
  },
  15: {
    name: "14-Day Streak",
    description: "Kept a 14 day play streak on BasePlay.",
    category: "Streak",
    image: "https://baseplay.games/badges/fourteen-day-streak.png",
    tier: "Diamond"
  },
  16: {
    name: "Streak Builder",
    description: "Kept a three day play streak.",
    category: "Streak",
    image: "https://baseplay.games/badges/streak-builder.png",
    tier: "Bronze"
  },
  17: {
    name: "Daily Variety",
    description: "Played four different BasePlay games in one day.",
    category: "Quest",
    image: "https://baseplay.games/badges/daily-variety.png",
    tier: "Silver"
  },
  18: {
    name: "Daily Sharpshooter",
    description: "Won three settled rounds in one day.",
    category: "Quest",
    image: "https://baseplay.games/badges/daily-sharpshooter.png",
    tier: "Silver"
  },
  19: {
    name: "Weekly Striker",
    description: "Won five settled rounds in one week.",
    category: "Quest",
    image: "https://baseplay.games/badges/weekly-striker.png",
    tier: "Gold"
  },
  20: {
    name: "Weekly Marathon",
    description: "Completed a 50-round weekly quest.",
    category: "Quest",
    image: "https://baseplay.games/badges/weekly-marathon.png",
    tier: "Diamond"
  }
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const cleanId = rawId.replace(/\.json$/, "");
  const tokenId = parseInt(cleanId, 10);

  const badge = BADGE_METADATA_MAP[tokenId] || {
    name: `BasePlay Badge #${tokenId}`,
    description: `Official BasePlay in-game progression achievement badge #${tokenId} on Base.`,
    category: "Achievement",
    image: "https://baseplay.games/badges/default-badge.png",
    tier: "Achievement"
  };

  const metadata = {
    name: badge.name,
    description: badge.description,
    image: badge.image,
    external_url: `https://baseplay.games/quests`,
    attributes: [
      { trait_type: "Platform", value: "BasePlay" },
      { trait_type: "Network", value: "Base" },
      { trait_type: "Token ID", value: tokenId },
      { trait_type: "Category", value: badge.category },
      { trait_type: "Tier", value: badge.tier }
    ]
  };

  return NextResponse.json(metadata, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800"
    }
  });
}
