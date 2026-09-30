import nextEnv from "@next/env";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const { loadEnvConfig } = nextEnv;
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let rootEnv = {};
try {
  rootEnv = loadEnvConfig(rootDir).combinedEnv || {};
} catch {}

const envSource = {
  ...process.env,
  ...rootEnv
};

const inlineEnv = Object.fromEntries(
  Object.entries({
    NEXT_PUBLIC_DEFAULT_CHAIN: envSource.NEXT_PUBLIC_DEFAULT_CHAIN,
    NEXT_PUBLIC_SUPABASE_URL: envSource.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: envSource.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: envSource.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    NEXT_PUBLIC_WALLETCONNECT_ID: envSource.NEXT_PUBLIC_WALLETCONNECT_ID,
    NEXT_PUBLIC_OWNER_ADDRESS: envSource.NEXT_PUBLIC_OWNER_ADDRESS,
    NEXT_PUBLIC_ADMIN_ADDRESSES: envSource.NEXT_PUBLIC_ADMIN_ADDRESSES,
    NEXT_PUBLIC_APP_URL: envSource.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_BACKEND_URL: envSource.NEXT_PUBLIC_BACKEND_URL,
    NEXT_PUBLIC_BET_PRESETS_ETH: envSource.NEXT_PUBLIC_BET_PRESETS_ETH
  }).filter(([, value]) => typeof value === "string")
);

// Who may frame BasePlay. Mini app hosts do (the Farcaster and Base App web clients show mini apps in a frame), and
// zkCodex embeds game pages (lib/embed.ts); every other site is refused, so a betting page cannot be framed for
// clickjacking. FRAME_ANCESTORS_EXTRA (space separated) adds hosts without a code change.
const frameAncestors = [
  "'self'",
  "https://farcaster.xyz",
  "https://*.farcaster.xyz",
  "https://warpcast.com",
  "https://*.warpcast.com",
  "https://base.app",
  "https://*.base.app",
  "https://base.dev",
  "https://*.base.dev",
  "https://*.coinbase.com",
  "https://zkcodex.com",
  "https://*.zkcodex.com",
  "https://zk-codex-git-feat-xp-rewards-yusufky63s-projects.vercel.app",
  // zkCodex's dev server, so the embed can be tested against this site.
  "http://localhost:3001",
  ...String(envSource.FRAME_ANCESTORS_EXTRA || "").split(/\s+/).filter(Boolean)
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: ".next",
  devIndicators: false,
  transpilePackages: ["@baseplay/shared"],
  reactStrictMode: true,
  env: inlineEnv,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors.join(" ")}` }]
      }
    ];
  }
};

export default nextConfig;
