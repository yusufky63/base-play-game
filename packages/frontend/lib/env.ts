import { z } from "zod";
import { base, baseSepolia } from "wagmi/chains";
import type { NetworkKey } from "@baseplay/shared/config/networks";

const cleanEnv = (value: string | undefined) => value?.trim();

const publicEnvSchema = z.object({
  NEXT_PUBLIC_DEFAULT_CHAIN: z.enum(["baseSepolia", "baseMainnet"]).default("baseSepolia"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().default(""),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().optional().default(""),
  NEXT_PUBLIC_WALLETCONNECT_ID: z.string().optional().default(""),
  NEXT_PUBLIC_OWNER_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional().or(z.literal("")),
  NEXT_PUBLIC_APP_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_BACKEND_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_BET_PRESETS_ETH: z.string().optional().default("0.000055,0.00023,0.0005")
});

export const env = publicEnvSchema.parse({
  NEXT_PUBLIC_DEFAULT_CHAIN: cleanEnv(process.env.NEXT_PUBLIC_DEFAULT_CHAIN),
  NEXT_PUBLIC_SUPABASE_URL: cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: cleanEnv(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID),
  NEXT_PUBLIC_WALLETCONNECT_ID: cleanEnv(process.env.NEXT_PUBLIC_WALLETCONNECT_ID),
  NEXT_PUBLIC_OWNER_ADDRESS: cleanEnv(process.env.NEXT_PUBLIC_OWNER_ADDRESS),
  NEXT_PUBLIC_APP_URL: cleanEnv(process.env.NEXT_PUBLIC_APP_URL),
  NEXT_PUBLIC_BACKEND_URL: cleanEnv(process.env.NEXT_PUBLIC_BACKEND_URL),
  NEXT_PUBLIC_BET_PRESETS_ETH: cleanEnv(process.env.NEXT_PUBLIC_BET_PRESETS_ETH)
});

export const walletConnectProjectId =
  env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || env.NEXT_PUBLIC_WALLETCONNECT_ID;

export const frontendEnvStatus = {
  walletConnectReady: Boolean(walletConnectProjectId),
  supabaseReady: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  appUrl: env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  backendUrl: env.NEXT_PUBLIC_BACKEND_URL || ""
};

export const defaultNetworkKey = env.NEXT_PUBLIC_DEFAULT_CHAIN as NetworkKey;
export const defaultChainId = defaultNetworkKey === "baseMainnet" ? base.id : baseSepolia.id;

const parsedBetPresetAmounts = env.NEXT_PUBLIC_BET_PRESETS_ETH.split(",")
  .map((item) => item.trim())
  .filter((item) => /^\d+(\.\d+)?$/.test(item))
  .slice(0, 3);

export const betPresetAmounts = parsedBetPresetAmounts.length > 0 ? parsedBetPresetAmounts : ["0.000055", "0.00023", "0.0005"];
