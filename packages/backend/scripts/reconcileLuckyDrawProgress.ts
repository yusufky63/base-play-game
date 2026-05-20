import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Database } from "@baseplay/shared/types/supabase.types";

type Args = {
  apply: boolean;
  player: string | null;
  limit: number | null;
};

type ProgressRow = Database["public"]["Tables"]["lucky_draw_progress"]["Row"];

loadLocalEnv();

const [{ getLuckyDrawCanonicalProgress }, { env }] = await Promise.all([
  import("../src/services/luckyDraw.js"),
  import("../src/config/env.js")
]);

const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const args = parseArgs(process.argv.slice(2));
const players = await loadPlayers(args);
const results: Array<{
  player: string;
  before: string;
  after: string;
  eligibleProofs: number;
  changed: boolean;
}> = [];

for (const player of players) {
  const canonical = await getLuckyDrawCanonicalProgress(player);
  const previous = canonical.previous ?? {
    available_draws: 0,
    qualified_rounds: 0,
    lifetime_draws_earned: 0,
    lifetime_draws_claimed: canonical.lifetimeDrawsClaimed
  };
  const changed =
    previous.available_draws !== canonical.availableDraws ||
    previous.qualified_rounds !== canonical.qualifiedRounds ||
    previous.lifetime_draws_earned !== canonical.lifetimeDrawsEarned;

  if (changed && args.apply) {
    const { error } = await supabase
      .from("lucky_draw_progress")
      .update({
        available_draws: canonical.availableDraws,
        qualified_rounds: canonical.qualifiedRounds,
        lifetime_draws_earned: canonical.lifetimeDrawsEarned,
        updated_at: new Date().toISOString()
      })
      .eq("player", canonical.player);
    if (error) throw error;
  }

  results.push({
    player: shortAddress(canonical.player),
    before: `${previous.available_draws} available, ${previous.qualified_rounds}/${canonical.roundsRequired} progress, ${previous.lifetime_draws_earned} earned`,
    after: `${canonical.availableDraws} available, ${canonical.qualifiedRounds}/${canonical.roundsRequired} progress, ${canonical.lifetimeDrawsEarned} earned`,
    eligibleProofs: canonical.eligibleProofs,
    changed
  });
}

console.table(results);
console.log(JSON.stringify({
  mode: args.apply ? "apply" : "dry-run",
  checked: results.length,
  changed: results.filter((result) => result.changed).length
}, null, 2));

function parseArgs(argv: string[]): Args {
  const parsed: Args = { apply: false, player: null, limit: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") parsed.apply = true;
    else if (arg === "--player") parsed.player = argv[++index] ?? null;
    else if (arg === "--limit") parsed.limit = Number(argv[++index] ?? "0") || null;
    else if (arg === "--help") {
      console.log("Usage: tsx scripts/reconcileLuckyDrawProgress.ts [--apply] [--player 0x...] [--limit n]");
      process.exit(0);
    }
  }
  return parsed;
}

async function loadPlayers(options: Args) {
  if (options.player) return [options.player];

  let query = supabase
    .from("lucky_draw_progress")
    .select("player, available_draws, qualified_rounds, lifetime_draws_earned, lifetime_draws_claimed")
    .or("available_draws.gt.0,qualified_rounds.gt.0,lifetime_draws_earned.gt.0,lifetime_draws_claimed.gt.0")
    .order("available_draws", { ascending: false });

  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Pick<ProgressRow, "player">[]).map((row) => row.player);
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function loadLocalEnv() {
  for (const path of [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../..", ".env"),
    resolve(process.cwd(), "packages/backend/.env")
  ]) {
    if (!existsSync(path)) continue;
    for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const index = line.indexOf("=");
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
      process.env[key] ??= value;
    }
  }
}
