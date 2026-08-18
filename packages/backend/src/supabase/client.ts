import { createClient } from "@supabase/supabase-js";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { env } from "../config/env.js";

const supabaseUrl = env.SUPABASE_URL || "https://buubouudfeyhltsqryam.supabase.co";
const supabaseKey = env.SUPABASE_SERVICE_KEY || "placeholder-key";

export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

