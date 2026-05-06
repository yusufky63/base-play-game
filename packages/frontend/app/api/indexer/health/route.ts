import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { frontendEnvStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL || frontendEnvStatus.backendUrl || readRootPublicEnv("NEXT_PUBLIC_BACKEND_URL") || "";

export async function GET() {
  if (!BACKEND_URL) {
    return NextResponse.json(
      {
        status: "unconfigured",
        indexers: [],
        message: "No production backend is configured. BasePlay is using Supabase and on-chain fallback data."
      }
    );
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
    return NextResponse.json(
      {
        status: "unreachable",
        indexers: [],
        message: "Backend health endpoint is unreachable."
      },
      { status: 502 }
    );
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
