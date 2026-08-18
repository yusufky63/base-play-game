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

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: ".next",
  devIndicators: false,
  transpilePackages: ["@baseplay/shared"],
  reactStrictMode: true,
  env: inlineEnv
};

export default nextConfig;
