"use client";

import { useState } from "react";
import { Loader2, Search, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseUrl, isSupabaseConfigured } from "@/lib/env";

export function AuthCard() {
  const router = useRouter();
  const supabase = createClient();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    setMessage("");

    if (!isSupabaseConfigured()) {
      // Mock mode: immediately log in and redirect to dashboard
      window.location.href = "/dashboard";
      return;
    }

    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });
      
      if (error) throw error;
    } catch (err: any) {
      setLoading(false);
      setMessage(err.message || "Failed to trigger authentication flow.");
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/60 p-8 shadow-3xl shadow-slate-950/50 backdrop-blur-2xl relative overflow-hidden">
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-tr from-cyan-500/5 to-transparent pointer-events-none" />

      <div className="mb-8 flex items-start justify-between gap-4 relative z-10">
        <div>
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/10 text-cyan-400">
            <ShieldCheck className="size-5" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Welcome to PulseBoard
          </h2>
          <p className="mt-1.5 text-sm text-slate-400">
            Sign in via Google to access your polling console dashboard workspace.
          </p>
        </div>
      </div>

      <div className="space-y-4 relative z-10">
        <Button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading}
          className="w-full h-12 text-xs font-black uppercase tracking-wider bg-cyan-500 hover:bg-cyan-600 text-slate-950 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/10"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin text-slate-950" />
          ) : (
            <Search className="size-4 text-slate-950" />
          )}
          Continue with Google
        </Button>

        {message ? (
          <p className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-4 py-2.5 text-sm text-cyan-400 font-semibold shadow-inner">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
