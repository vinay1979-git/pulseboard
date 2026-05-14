import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseKey, getSupabaseUrl } from "@/lib/env";

export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseKey());
}
