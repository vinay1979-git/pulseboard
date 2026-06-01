import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/env";
import { syncUserProfile, registerParticipant } from "@/lib/db";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  
  // Retrieve session preservation tokens from either cookies or search queries
  const cookieStore = await cookies();
  const sessionId = request.nextUrl.searchParams.get("session_id") || cookieStore.get("session_id")?.value;
  const sessionCode = request.nextUrl.searchParams.get("session_code") || cookieStore.get("session_code")?.value;

  // Clean the URL by returning a redirect to the target URL (next, session, or dashboard) to strip out large tokens
  const next = request.nextUrl.searchParams.get("next") || request.nextUrl.searchParams.get("redirectTo");
  let redirectPath = "/dashboard";
  if (next) {
    redirectPath = next;
  } else if (sessionCode) {
    redirectPath = `/session/${sessionCode}`;
  }

  const redirectUrl = new URL(redirectPath, request.url);
  const response = NextResponse.redirect(redirectUrl);

  if (code) {
    if (isSupabaseConfigured()) {
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
          const isSessionPath = redirectPath.includes("/session/") || redirectPath.includes("/room/");

          if (isSessionPath) {
            // Instantiate Supabase Admin Client using Service Role Key to bypass database triggers
            const { createAdminClient } = await import("@/lib/supabase/server");
            const adminClient = createAdminClient();

            try {
              const { error: adminErr } = await adminClient
                .from("profiles")
                .upsert({
                  id: user.id,
                  email: user.email,
                  role: "participant",
                  approval_status: "approved",
                  avatar_url: googleAvatarUrl || null,
                  updated_at: new Date().toISOString(),
                  created_at: new Date().toISOString()
                }, { onConflict: "id" });

              if (adminErr) {
                console.error("Admin client profile upsert failed during callback:", adminErr);
              } else {
                console.log("Successfully forced approved participant role for attendee via Admin client:", user.id);
              }
            } catch (err) {
              console.error("Failed to force approved profile using adminClient:", err);
            }
          } else {
            // Sync and retrieve User Profile to handle normal flow
            await syncUserProfile(user.id, user.email || "", googleAvatarUrl);
          }

          // If sessionId is present, this user is a participant joining a session!
          if (sessionId) {
            const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Anonymous";
            const email = user.email || "";
            
            try {
              // Insert participant into database!
              const participant = await registerParticipant(sessionId, name, email);
              console.log("Successfully registered participant via OAuth redirect:", participant);

              // Redirect back with the participant_id query parameter so the client registers it in localStorage
              const targetBase = next ? next : `/session/${sessionCode || ""}`;
              const finalRedirectUrl = new URL(`${targetBase}${targetBase.includes("?") ? "&" : "?"}participant_id=${participant.id}`, request.url);
              response.headers.set("Location", finalRedirectUrl.toString());
            } catch (regError) {
              console.error("Failed to register participant during OAuth callback:", regError);
            }

            // Delete session cookies on response
            response.cookies.delete("session_id");
            response.cookies.delete("session_code");
          }

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
