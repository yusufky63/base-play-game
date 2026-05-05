import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_DEFAULT_CHAIN: z.enum(["baseSepolia", "baseMainnet"]).default("baseSepolia"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().default(""),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().optional().default(""),
  NEXT_PUBLIC_WALLETCONNECT_ID: z.string().optional().default(""),
  NEXT_PUBLIC_OWNER_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional().or(z.literal("")),
  NEXT_PUBLIC_APP_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_BACKEND_URL: z.string().url().optional().or(z.literal(""))
});

export const env = publicEnvSchema.parse({
  NEXT_PUBLIC_DEFAULT_CHAIN: process.env.NEXT_PUBLIC_DEFAULT_CHAIN,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  NEXT_PUBLIC_WALLETCONNECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_ID,
  NEXT_PUBLIC_OWNER_ADDRESS: process.env.NEXT_PUBLIC_OWNER_ADDRESS,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL
});

export const walletConnectProjectId =
  env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || env.NEXT_PUBLIC_WALLETCONNECT_ID;

export const frontendEnvStatus = {
  walletConnectReady: Boolean(walletConnectProjectId),
  supabaseReady: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  appUrl: env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  backendUrl: env.NEXT_PUBLIC_BACKEND_URL || ""
};
