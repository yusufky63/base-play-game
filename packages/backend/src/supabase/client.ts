import { createClient } from "@supabase/supabase-js";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { env } from "../config/env.js";

export const supabaseAdmin = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});
