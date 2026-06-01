"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, Loader2, ShieldAlert, Sparkles, User, Mail, Send } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as clientDb from "@/lib/clientDb";

export default function ParticipantLoginPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Simulated Login Form States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    void loadSession();
  }, [code]);

  async function loadSession() {
    try {
      const activeSession = await clientDb.getSessionByCode(code);
      if (!activeSession) {
        setErrorMsg("PulseRoom not found.");
        setLoading(false);
        return;
      }
      
      // If already logged in, redirect straight to lobby
      const storedParticipant = window.localStorage.getItem(`pulse-participant-${code}`);
      if (storedParticipant) {
        router.push(`/session/${code}`);
        return;
      }

      setSession(activeSession);
      
      // If Google Client ID is configured, initialize Google GIS
      if (googleClientId) {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);

        script.onload = () => {
          try {
            (window as any).google?.accounts.id.initialize({
              client_id: googleClientId,
              callback: handleGoogleCredentialResponse,
            });
            (window as any).google?.accounts.id.renderButton(
              document.getElementById("google-signin-btn"),
              { theme: "filled_black", size: "large", width: 380 }
            );
          } catch (e) {
            console.error("Failed to render Google login button:", e);
          }
        };
      }
    } catch (err) {
      console.error("Failed to load session:", err);
      setErrorMsg("Error connecting to PulseRoom.");
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleCredentialResponse = async (response: any) => {
    try {
      setAuthLoading(true);
      const jwt = response.credential;
      
      // Decode JWT payload (payload is the second segment, base64url encoded)
      const base64Url = jwt.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );

      const payload = JSON.parse(jsonPayload);
      const userEmail = payload.email;
      const userName = payload.name || userEmail.split("@")[0];

      await handleRegistration(userName, userEmail);
    } catch (e) {
      console.error("Google JWT decode failed:", e);
      setErrorMsg("Failed to authenticate with Google.");
      setAuthLoading(false);
    }
  };

  const handleRegistration = async (participantName: string, participantEmail: string) => {
    if (!session) return;
    try {
      setAuthLoading(true);
      const participant = await clientDb.registerParticipant(
        session.id,
        participantName.trim(),
        participantEmail.trim().toLowerCase()
      );
      
      // Save participant details to local storage
      window.localStorage.setItem(`pulse-participant-${code}`, participant.id);
      window.localStorage.setItem(`pulseboard-session-${code}-participant`, participant.id); // sync legacy vote voter ID too

      router.push(`/session/${code}`);
    } catch (e: any) {
      console.error("Failed to register participant:", e);
      setErrorMsg(e.message || "Failed to register participant details.");
      setAuthLoading(false);
    }
  };

  const signInWithGoogleOAuth = async () => {
    if (!session) return;
    setAuthLoading(true);
    setErrorMsg("");

    if (process.env.NEXT_PUBLIC_TEST_MODE === "true") {
      await handleRegistration("Playwright Tester", "test@example.com");
      return;
    }

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // Cache session details in Lax cookies to survive standard Google OAuth loops
      document.cookie = `session_id=${session.id}; path=/; max-age=3600; SameSite=Lax; Secure`;
      document.cookie = `session_code=${code}; path=/; max-age=3600; SameSite=Lax; Secure`;

      const redirectTo = `${window.location.origin}/auth/callback?next=/session/${code}&session_id=${session.id}&session_code=${code}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          data: {
            is_participant: true,
            role: "participant",
          },
        },
      });

      if (error) throw error;
    } catch (e: any) {
      console.error("Google OAuth Sign-In failed:", e);
      setErrorMsg(e.message || "Failed to trigger Google OAuth.");
      setAuthLoading(false);
    }
  };

  const handleSimulatedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    await handleRegistration(name, email);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center">
        <Loader2 className="size-8 animate-spin text-cyan-400" />
        <p className="mt-4 text-sm text-slate-400">Loading attendee gateway...</p>
      </div>
    );
  }

  if (errorMsg && !session) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-6 text-center">
        <ShieldAlert className="size-16 text-red-500 mb-6" />
        <h1 className="text-3xl font-extrabold">{errorMsg}</h1>
        <p className="text-slate-400 mt-2 max-w-md">
          This PulseRoom pin is invalid, or the database connection has failed.
        </p>
        <Button asChild className="mt-6">
          <Link href="/join">Go back to Join Lobby</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_15%,rgba(6,182,212,0.15),transparent_32%),linear-gradient(135deg,#070a13,#0f172a)] text-slate-100 flex flex-col justify-between px-4 py-6 sm:px-6">
      
      {/* Simple Navbar */}
      <nav className="mx-auto flex w-full max-w-2xl items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-cyan-400/20 bg-cyan-400/10 text-cyan-400">
            <Activity className="size-4 animate-pulse" />
          </span>
          <span className="text-sm font-black text-slate-200">{session?.title}</span>
        </div>
        <span className="rounded-full bg-cyan-400/10 border border-cyan-400/20 px-3.5 py-1 text-xs font-black tracking-widest text-cyan-400 uppercase">
          Pin: {code}
        </span>
      </nav>

      {/* Login Card Panel */}
      <div className="mx-auto w-full max-w-md my-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 sm:p-8 shadow-3xl shadow-slate-950/50 backdrop-blur-2xl relative"
        >
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-tr from-cyan-500/5 to-violet-500/5 opacity-30 pointer-events-none" />
          
          <div className="text-center mb-6">
            <Sparkles className="size-8 mx-auto text-cyan-400 animate-pulse mb-3" />
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              PulseRoom Login Gate
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              This interactive PulseRoom is protected. Log in to register your score on the live Leaderboard!
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 text-center text-xs font-bold rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-red-400">
              {errorMsg}
            </div>
          )}

          {authLoading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <Loader2 className="size-8 animate-spin text-cyan-400" />
              <p className="mt-4 text-xs text-slate-400 font-extrabold uppercase tracking-widest animate-pulse">Authenticating...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <Button
                type="button"
                onClick={signInWithGoogleOAuth}
                className="w-full h-12 text-sm font-black uppercase tracking-wider bg-cyan-500 hover:bg-cyan-600 text-slate-950 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/10"
              >
                <Sparkles className="size-4 text-slate-950 animate-pulse" />
                Join with Google (OAuth)
              </Button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-600 py-3 mt-4">
        PulseBoard Secure Auth Portal
      </footer>
    </main>
  );
}
