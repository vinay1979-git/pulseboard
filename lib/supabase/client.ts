import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/env";

export function createClient() {
  console.log("[createClient] NEXT_PUBLIC_TEST_MODE:", process.env.NEXT_PUBLIC_TEST_MODE, "isSupabaseConfigured:", isSupabaseConfigured());
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

  const client = createBrowserClient(getSupabaseUrl(), getSupabaseKey());

  if (process.env.NEXT_PUBLIC_TEST_MODE === "true") {
    const mockUser = {
      id: "demo-user-id",
      email: "vinay1979@gmail.com",
      user_metadata: {
        full_name: "Vinay Visvanathan",
        name: "Vinay Visvanathan"
      }
    };
    client.auth = {
      getUser: async () => {
        return { data: { user: mockUser }, error: null };
      },
      getSession: async () => {
        return { data: { session: { user: mockUser } }, error: null };
      },
      signInWithPassword: async () => {
        return { data: { session: { user: mockUser } }, error: null };
      },
      signUp: async () => {
        return { data: { session: { user: mockUser } }, error: null };
      },
      signInWithOAuth: async () => {
        if (typeof window !== "undefined") {
          window.location.href = "/dashboard";
        }
        return { error: null };
      },
      signOut: async () => {
        return { error: null };
      },
      onAuthStateChange: () => {
        return { data: { subscription: { unsubscribe: () => {} } } };
      }
    } as any;
  }

  return client;
}
