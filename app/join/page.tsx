"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import * as clientDb from "@/lib/clientDb";

export default function JoinPage() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    if (value !== "" && !/^[0-9]$/.test(value)) return;

    const nextDigits = [...digits];
    nextDigits[index] = value;
    setDigits(nextDigits);
    setError("");

    if (value !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      if (digits[index] === "" && index > 0) {
        const nextDigits = [...digits];
        nextDigits[index - 1] = "";
        setDigits(nextDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        const nextDigits = [...digits];
        nextDigits[index] = "";
        setDigits(nextDigits);
      }
      setError("");
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pastedData = event.clipboardData.getData("text").trim();
    if (!/^\d{6}$/.test(pastedData)) return;

    const nextDigits = pastedData.split("");
    setDigits(nextDigits);
    inputRefs.current[5]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join("");
    if (code.length !== 6) {
      setError("Please enter all 6 digits.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const session = await clientDb.getSessionByCode(code);
      if (!session) {
        setError("PulseRoom not found. Double check the code!");
        return;
      }
      if (session.status !== "active") {
        setError("This PulseRoom is currently inactive. Ask the presenter to activate it!");
        return;
      }

      router.push(`/session/${code}`);
    } catch (err) {
      setError("Error checking PulseRoom code. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_15%,rgba(6,182,212,0.15),transparent_30%),radial-gradient(circle_at_80%_80%,rgba(139,92,246,0.12),transparent_30%),linear-gradient(135deg,#070a13,#0f172a)] text-slate-100 flex flex-col justify-between px-6 py-6">
      {/* Top Navbar */}
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-400/20 bg-cyan-400/10 text-cyan-400 group-hover:scale-105 transition-transform">
            <Activity className="size-5" />
          </span>
          <span className="text-lg font-black bg-gradient-to-r from-cyan-400 to-indigo-300 bg-clip-text text-transparent">
            PulseBoard
          </span>
        </Link>
        <Button asChild variant="ghost" size="sm" className="h-10 text-slate-400 hover:text-white hover:bg-white/5">
          <Link href="/login">Host Login</Link>
        </Button>
      </nav>

      {/* Main Joining Console */}
      <section className="mx-auto my-auto w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/60 p-8 shadow-3xl shadow-slate-950/50 backdrop-blur-2xl relative overflow-hidden">
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-tr from-cyan-500/10 to-violet-500/10 opacity-30 pointer-events-none" />

        <div className="text-center mb-8">
          <span className="flex h-14 w-14 mx-auto items-center justify-center rounded-full border border-cyan-400/25 bg-cyan-400/10 text-cyan-400 shadow-lg shadow-cyan-500/10 animate-pulse">
            <Activity className="size-6" />
          </span>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-white">Join a PulseRoom</h1>
          <p className="mt-2 text-sm text-slate-400">
            Enter the 6-digit code shown on the presenter's screen.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-between gap-2" onPaste={handlePaste}>
            {digits.map((digit, index) => (
              <input
                key={index}
                id={`digit-${index}`}
                name={`digit-${index}`}
                type="text"
                maxLength={1}
                inputMode="numeric"
                pattern="[0-9]*"
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-3xl font-black rounded-lg border border-white/10 bg-slate-950/50 text-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all shadow-inner"
                aria-label={`Digit ${index + 1}`}
              />
            ))}
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-sm font-semibold rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-red-400 shadow-md"
            >
              {error}
            </motion.p>
          )}

          <Button type="submit" className="w-full h-12 text-sm font-extrabold bg-cyan-500 hover:bg-cyan-600 text-slate-950 flex items-center justify-center gap-2 group shadow-lg shadow-cyan-500/10" disabled={loading || digits.some((d) => d === "")}>
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                Enter PulseRoom
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Button>
        </form>
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-600 py-3">
        PulseBoard &copy; {new Date().getFullYear()} &middot; Premium Realtime Polling
      </footer>
    </main>
  );
}
