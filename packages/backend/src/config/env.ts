import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  VRF_SUB_ID_SEPOLIA: z.string().min(1),
  VRF_SUB_ID_MAINNET: z.string().min(1),
  REDIS_URL: z.string().url(),
  FRONTEND_URL: z.string().url().default("http://localhost:3000")
});

export const env = schema.parse(process.env);
