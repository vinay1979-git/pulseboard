import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/env";
import { syncUserProfile } from "@/lib/db";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  // Clean the URL by returning a redirect to /dashboard to strip out large tokens
  const redirectUrl = new URL("/dashboard", request.url);
  const response = NextResponse.redirect(redirectUrl);

  if (code) {
    if (isSupabaseConfigured()) {
      const cookieStore = await cookies();
      
      const supabase = createServerClient(getSupabaseUrl(), getSupabaseKey(), {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            // 1. Write cookies to next/headers cookies() so other server components can access them
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (e) {
              console.error("Failed to write to cookieStore:", e);
            }
            
            // 2. ALSO set cookies explicitly on the outgoing NextResponse redirect object!
            // This guarantees the browser receives the Set-Cookie headers on redirect.
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      });

      try {
        await supabase.auth.exchangeCodeForSession(code);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const googleAvatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
          // Sync and retrieve User Profile to handle normal flow
          await syncUserProfile(user.id, user.email || "", googleAvatarUrl);

          // Critical RBAC Step: Explicitly assert Vinay's super-admin status
          if (user.email && user.email.toLowerCase() === "vinay1979@gmail.com") {
            try {
              const { data: existing } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .maybeSingle();

              if (existing) {
                if (existing.role !== "super-admin" || existing.approval_status !== "approved") {
                  await supabase
                    .from("profiles")
                    .update({
                      role: "super-admin",
                      approval_status: "approved",
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", user.id);
                }
              } else {
                await supabase
                  .from("profiles")
                  .insert({
                    id: user.id,
                    email: user.email,
                    role: "super-admin",
                    approval_status: "approved",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  });
              }
            } catch (e) {
              console.error("Callback explicit profile sync error:", e);
            }
          }
        }
      } catch (err) {
        console.error("Failed to exchange code for session:", err);
      }
    }
  }

  return response;
}
