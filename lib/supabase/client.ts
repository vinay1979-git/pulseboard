import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/env";

export function createClient() {
  if (!isSupabaseConfigured()) {
    // Return mock client for frontend auth handling
    return {
      auth: {
        getUser: async () => {
          return {
            data: {
              user: {
                id: "demo-user-id",
                email: "vinay1979@gmail.com",
                user_metadata: {
                  full_name: "Vinay Visvanathan",
                  name: "Vinay Visvanathan"
                }
              }
            },
            error: null
          };
        },
        signInWithPassword: async () => {
          return { data: { session: {} }, error: null };
        },
        signUp: async () => {
          return { data: { session: {} }, error: null };
        },
        signInWithOAuth: async () => {
          if (typeof window !== "undefined") {
            window.location.href = "/dashboard";
          }
          return { error: null };
        },
        signOut: async () => {
          return { error: null };
        }
      }
    } as any;
  }

  return createBrowserClient(getSupabaseUrl(), getSupabaseKey());
}
