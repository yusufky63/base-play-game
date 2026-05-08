import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type EnvMap = Record<string, string | undefined>;

const requiredPublicObjects = [
  "game_rounds",
  "player_stats",
  "leaderboard_weekly",
  "platform_stats",
  "game_stats",
  "player_game_stats",
  "leaderboard_weekly_ranked",
  "quest_definitions",
  "player_quest_progress",
  "badge_definitions",
  "player_badges",
  "player_quest_summary",
  "player_badge_summary"
];

const requiredPrivateServiceObjects = [
  "referral_codes",
  "player_referrals",
  "referral_rewards",
  "player_referral_summary",
  "indexer_state"
];

const requiredServiceObjects = [...requiredPublicObjects, ...requiredPrivateServiceObjects];

function loadDotEnv(path: string): EnvMap {
  if (!existsSync(path)) return {};

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line
          .slice(index + 1)
          .trim()
          .replace(/^['"]|['"]$/g, "");
        return [key, value];
      })
  );
}

const rootEnv = {
  ...loadDotEnv(resolve(process.cwd(), ".env")),
  ...loadDotEnv(resolve(process.cwd(), "../..", ".env"))
};
const backendEnv = {
  ...loadDotEnv(resolve(process.cwd(), "packages/backend/.env")),
  ...loadDotEnv(resolve(process.cwd(), ".env"))
};
const env = { ...rootEnv, ...backendEnv, ...process.env };

const supabaseUrl = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.");
}

async function checkObject(name: string, key: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${name}?select=*&limit=1`, {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`
    }
  });

  let message = "";
  try {
    const body = await response.json();
    message = body?.message ?? body?.hint ?? "";
  } catch {
    message = await response.text().catch(() => "");
  }

  return {
    name,
    ok: response.ok,
    status: response.status,
    message
  };
}

async function main() {
  if (!anonKey) {
    console.warn("[Supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY is missing; skipping public REST checks.");
  }

  if (!serviceKey) {
    console.warn("[Supabase] SUPABASE_SERVICE_KEY is missing; skipping service-role checks.");
  }

  const publicResults = anonKey ? await Promise.all(requiredPublicObjects.map((name) => checkObject(name, anonKey))) : [];
  const privatePublicResults = anonKey ? await Promise.all(requiredPrivateServiceObjects.map((name) => checkObject(name, anonKey))) : [];
  const serviceResults = serviceKey
    ? await Promise.all(requiredServiceObjects.map((name) => checkObject(name, serviceKey)))
    : [];

  const missingPublic = publicResults.filter((result) => !result.ok);
  const exposedPrivate = privatePublicResults.filter((result) => result.ok);
  const missingService = serviceResults.filter((result) => !result.ok);

  console.log("\nPublic REST objects");
  for (const result of publicResults) {
    console.log(`${result.ok ? "OK" : "MISSING"} ${result.name} (${result.status}) ${result.message}`);
  }

  console.log("\nPrivate REST objects with anon key");
  for (const result of privatePublicResults) {
    console.log(`${result.ok ? "EXPOSED" : "PRIVATE"} ${result.name} (${result.status}) ${result.message}`);
  }

  console.log("\nService-role REST objects");
  for (const result of serviceResults) {
    console.log(`${result.ok ? "OK" : "MISSING"} ${result.name} (${result.status}) ${result.message}`);
  }

  if (missingPublic.length > 0 || exposedPrivate.length > 0 || missingService.length > 0) {
    console.log("\nSchema repair needed");
    console.log("Apply backend Supabase migrations through 014 to the linked project.");
    console.log("CLI option once SUPABASE_ACCESS_TOKEN is available:");
    console.log("  npx supabase link --project-ref buubouudfeyhltsqryam --workdir packages/backend/supabase");
    console.log("  npx supabase db push --workdir packages/backend/supabase");
    console.log("Or run the SQL files in packages/backend/supabase/migrations in numeric order through 014_private_referral_tables.sql.");
    process.exitCode = 1;
  }
}

await main();
