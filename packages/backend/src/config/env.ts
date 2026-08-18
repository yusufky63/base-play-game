import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  SUPABASE_URL: z.string().url().default("https://buubouudfeyhltsqryam.supabase.co"),
  SUPABASE_SERVICE_KEY: z.string().min(1).default(""),
  VRF_SUB_ID_MAINNET: z.string().default("1"),
  FRONTEND_URL: z.string().default("https://baseplay.games")
});

const rawEnv = {
  ...process.env,
  SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://buubouudfeyhltsqryam.supabase.co",
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  VRF_SUB_ID_MAINNET: process.env.VRF_SUB_ID_MAINNET ?? process.env.VRF_SUBSCRIPTION_ID ?? "1",
  FRONTEND_URL: process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://baseplay.games"
};

const parsed = schema.safeParse(rawEnv);

export const env = parsed.success ? parsed.data : {
  NODE_ENV: "development" as const,
  PORT: Number(process.env.PORT) || 4000,
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://buubouudfeyhltsqryam.supabase.co",
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  VRF_SUB_ID_MAINNET: process.env.VRF_SUB_ID_MAINNET || "1",
  FRONTEND_URL: process.env.FRONTEND_URL || "https://baseplay.games"
};
