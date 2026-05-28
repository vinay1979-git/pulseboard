import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/env";

export async function createClient() {
  if (!isSupabaseConfigured()) {
    // Return a mock client that satisfies the auth.getUser() calls safely
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
        signOut: async () => {
          return { error: null };
        }
      }
    } as any;
  }

  const cookieStore = await cookies();

  const client = createServerClient(getSupabaseUrl(), getSupabaseKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies; proxy.ts refreshes sessions.
        }
      },
    },
  });

  if (process.env.NEXT_PUBLIC_TEST_MODE === "true") {
    const mockUser = {
      id: "demo-user-id",
      email: "vinay1979@gmail.com",
      user_metadata: {
        full_name: "Vinay Visvanathan",
        name: "Vinay Visvanathan"
      }
    };
    Object.defineProperty(client, "auth", {
      value: {
        getUser: async () => {
          return { data: { user: mockUser }, error: null };
        },
        getSession: async () => {
          return { data: { session: { user: mockUser } }, error: null };
        },
        signOut: async () => {
          return { error: null };
        },
        onAuthStateChange: () => {
          return { data: { subscription: { unsubscribe: () => {} } } };
        }
      },
      writable: true,
      configurable: true
    });
  }

  return client;
}

export function createAdminClient() {
  const url = getSupabaseUrl();
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Stateless admin client bypasses RLS using service role key.
  // Fall back to a standard client if the admin key is not available.
  if (!url || !adminKey || url === "" || adminKey === "") {
    const fallbackKey = getSupabaseKey();
    return createSupabaseClient(url || "https://placeholder.supabase.co", fallbackKey || "placeholder", {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });
  }

  return createSupabaseClient(url, adminKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

