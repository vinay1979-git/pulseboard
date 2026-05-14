"use client";

import { useState } from "react";
import { Loader2, Mail, Search, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "signup";

export function AuthCard() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const authResult =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (authResult.error) {
      setMessage(authResult.error.message);
      return;
    }

    if (mode === "signup" && !authResult.data.session) {
      setMessage("Check your inbox to confirm your account.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function signInWithGoogle() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setLoading(false);
      setMessage(error.message);
    }
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-white/14 bg-white/75 p-6 shadow-2xl shadow-slate-950/10 backdrop-blur-xl dark:bg-white/9 dark:shadow-cyan-950/25">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/15 text-cyan-700 dark:text-cyan-200">
            <ShieldCheck className="size-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {mode === "login"
              ? "Sign in to your PulseBoard workspace."
              : "Start tracking your workspace pulse today."}
          </p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 rounded-md border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-slate-950/45">
        {(["login", "signup"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setMode(item);
              setMessage("");
            }}
            className={cn(
              "h-9 rounded-sm text-sm font-semibold capitalize transition",
              mode === item
                ? "bg-white text-slate-950 shadow-sm dark:bg-white/12 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <form className="space-y-4" onSubmit={submitAuth}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
          />
        </div>

        {message ? (
          <p className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-800 dark:text-cyan-100">
            {message}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          {mode === "login" ? "Log in" : "Sign up"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
        <span className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          or
        </span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full text-slate-950 dark:text-white"
        onClick={signInWithGoogle}
        disabled={loading}
      >
        <Search className="size-4" />
        Continue with Google
      </Button>
    </div>
  );
}
