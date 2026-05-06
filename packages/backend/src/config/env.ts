import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  VRF_SUB_ID_SEPOLIA: z.string().min(1),
  VRF_SUB_ID_MAINNET: z.string().min(1),
  FRONTEND_URL: z.string().url().default("http://localhost:3000")
});

const rawEnv = {
  ...process.env,
  SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
};

const parsed = schema.safeParse(rawEnv);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join(", ");

  throw new Error(
    [
      `[Config] Missing or invalid backend environment variables: ${details}.`,
      "Set these in Railway Variables: SUPABASE_URL, SUPABASE_SERVICE_KEY, VRF_SUB_ID_SEPOLIA, VRF_SUB_ID_MAINNET.",
      "SUPABASE_URL may also be supplied as NEXT_PUBLIC_SUPABASE_URL, but SUPABASE_SERVICE_KEY must be server-only."
    ].join(" ")
  );
}

export const env = parsed.data;
