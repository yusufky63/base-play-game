import nextEnv from "@next/env";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const { loadEnvConfig } = nextEnv;
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const rootEnv = loadEnvConfig(rootDir).combinedEnv;
const inlineEnv = Object.fromEntries(
  Object.entries({
    NEXT_PUBLIC_DEFAULT_CHAIN: rootEnv.NEXT_PUBLIC_DEFAULT_CHAIN,
    NEXT_PUBLIC_SUPABASE_URL: rootEnv.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: rootEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: rootEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    NEXT_PUBLIC_WALLETCONNECT_ID: rootEnv.NEXT_PUBLIC_WALLETCONNECT_ID,
    NEXT_PUBLIC_OWNER_ADDRESS: rootEnv.NEXT_PUBLIC_OWNER_ADDRESS,
    NEXT_PUBLIC_APP_URL: rootEnv.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_BACKEND_URL: rootEnv.NEXT_PUBLIC_BACKEND_URL,
    NEXT_PUBLIC_BET_PRESETS_ETH: rootEnv.NEXT_PUBLIC_BET_PRESETS_ETH
  }).filter(([, value]) => typeof value === "string")
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  transpilePackages: ["@baseplay/shared"],
  reactStrictMode: true,
  env: inlineEnv
};

export default nextConfig;
