import { createClient } from "@supabase/supabase-js";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { env, frontendEnvStatus } from "@/lib/env";

let browserClient: any = null;

export function getSupabaseBrowser() {
  if (!frontendEnvStatus.supabaseReady) return null;

  if (!browserClient) {
    browserClient = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } }
    });
  }

  return browserClient;
}
