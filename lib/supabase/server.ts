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

  return createServerClient(getSupabaseUrl(), getSupabaseKey(), {
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

