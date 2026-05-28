import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/env";

function redirectWithCookies(
  request: NextRequest,
  supabaseResponse: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;

  const response = NextResponse.redirect(url);
  supabaseResponse.cookies
    .getAll()
    .forEach((cookie) => response.cookies.set(cookie));

  return response;
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // 1. If Supabase is not configured, we are in local development mock mode.
  // Bypass all middleware redirect checks to let page fallbacks handle routing.
  if (!isSupabaseConfigured()) {
    return supabaseResponse;
  }

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value),
        );
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
    Object.defineProperty(supabase, "auth", {
      value: {
        getUser: async () => {
          return { data: { user: mockUser }, error: null };
        },
        getSession: async () => {
          return { data: { session: { user: mockUser } }, error: null };
        }
      },
      writable: true,
      configurable: true
    });
  }

  // Use supabase.auth.getUser() to read cookies and update session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Safeguard: Ensure auth/callback is completely ignored by redirect logic
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp)$/) ||
    pathname.startsWith("/auth/callback")
  ) {
    return supabaseResponse;
  }

  // 2. If getUser() returns null (NO session):
  if (!user) {
    // If trying to access /dashboard or /console, redirect to /login
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/console")) {
      return redirectWithCookies(request, supabaseResponse, "/login");
    }
    // Fallback legacy protected routes
    const isLegacyProtectedRoute =
      pathname.startsWith("/profile") ||
      pathname.startsWith("/builder") ||
      pathname === "/polls" ||
      pathname.endsWith("/host");
    if (isLegacyProtectedRoute) {
      return redirectWithCookies(request, supabaseResponse, "/login");
    }
    return supabaseResponse;
  }

  // 3. If getUser() returns a valid session:
  let approvalStatus = "pending";
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("approval_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      approvalStatus = profile.approval_status;
    } else {
      // Hardcode super-admin email to approved even if profile record doesn't exist yet
      if (user.email?.toLowerCase() === "vinay1979@gmail.com") {
        approvalStatus = "approved";
      } else {
        approvalStatus = "pending";
      }
    }
  } catch (e) {
    console.error("Middleware profile fetch error:", e);
    // Safe fallback logic
    if (user.email?.toLowerCase() === "vinay1979@gmail.com") {
      approvalStatus = "approved";
    } else {
      approvalStatus = "pending";
    }
  }

  // 4. Redirect based on approval_status
  if (approvalStatus === "pending") {
    if (pathname !== "/awaiting-approval") {
      return redirectWithCookies(request, supabaseResponse, "/awaiting-approval");
    }
    return supabaseResponse;
  }

  if (approvalStatus === "approved") {
    // If valid session and approved, and user is navigating to /login, redirect to /dashboard
    if (pathname === "/login" || pathname === "/awaiting-approval") {
      return redirectWithCookies(request, supabaseResponse, "/dashboard");
    }
    return supabaseResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
