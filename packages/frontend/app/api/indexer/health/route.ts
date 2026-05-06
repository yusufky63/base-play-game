import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { env, frontendEnvStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL || frontendEnvStatus.backendUrl || readRootPublicEnv("NEXT_PUBLIC_BACKEND_URL") || "";

export async function GET() {
  if (!BACKEND_URL) {
    return supabaseHealthFallback("Backend URL is not configured. Showing Supabase aggregate freshness instead.");
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const response = await fetch(`${BACKEND_URL.replace(/\/$/, "")}/api/indexer/health`, {
      cache: "no-store",
      signal: controller.signal
    });
    clearTimeout(timeout);

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return supabaseHealthFallback("Backend health endpoint is unreachable. Showing Supabase aggregate freshness instead.");
  }
}

async function supabaseHealthFallback(message: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || readRootPublicEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || readRootPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({
      status: "unconfigured",
      indexers: [],
      message
    });
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/game_stats?select=chain_id,game_id,total_rounds,updated_at&order=updated_at.desc&limit=50`, {
      cache: "no-store",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`
      }
    });
    if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`);
    const rows = (await response.json()) as Array<{ chain_id: number; game_id: string; total_rounds: number; updated_at: string }>;
    const now = Date.now();
    return NextResponse.json({
      status: "supabase_fallback",
      indexers: rows.map((row) => {
        const updatedMs = Date.parse(row.updated_at);
        const fresh = Number.isFinite(updatedMs) && now - updatedMs < 15 * 60_000;
        return {
          chainId: row.chain_id,
          gameId: row.game_id,
          status: fresh ? "watching" : "catching_up",
          lastIndexedBlock: null,
          lastLogAt: row.updated_at,
          lastError: null,
          updatedAt: row.updated_at
        };
      }),
      message: rows.length > 0 ? "Backend watcher unavailable; Supabase aggregates are reachable." : "Backend watcher unavailable; Supabase has no indexed game stats yet."
    });
  } catch {
    return NextResponse.json({
      status: "unreachable",
      indexers: [],
      message
    });
  }
}

function readRootPublicEnv(name: string) {
  if (process.env.NODE_ENV === "production") return "";
  try {
    const envPath = resolve(process.cwd(), "../..", ".env");
    const line = readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .find((item) => item.trim().startsWith(`${name}=`));
    return line?.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "") ?? "";
  } catch {
    return "";
  }
}
