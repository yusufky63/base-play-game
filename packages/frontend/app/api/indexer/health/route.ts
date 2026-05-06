import { NextResponse } from "next/server";
import { frontendEnvStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL || frontendEnvStatus.backendUrl || "";

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
