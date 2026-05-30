"use client";

import { Activity, ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = 'force-dynamic';

export default function AwaitingApprovalPage() {
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_15%,rgba(6,182,212,0.15),transparent_32%),linear-gradient(135deg,#070a13,#0f172a)] text-slate-100 flex flex-col justify-between px-6 py-6 text-center">
      {/* Top logo */}
      <nav className="mx-auto flex w-full max-w-2xl items-center justify-center border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-cyan-400/20 bg-cyan-400/10 text-cyan-400">
            <Activity className="size-4 animate-pulse" />
          </span>
          <span className="text-sm font-black text-slate-200">PulseBoard</span>
        </div>
      </nav>

      {/* Main warning card */}
      <div className="mx-auto w-full max-w-md my-auto rounded-2xl border border-amber-500/20 bg-slate-900/40 p-8 backdrop-blur-xl">
        <ShieldAlert className="size-16 text-amber-400 mx-auto animate-pulse mb-6" />
        <h2 className="text-2xl font-black text-white">Awaiting Approval</h2>
        <p className="mt-4 text-slate-400 text-sm leading-6">
          Your account is pending approval from the administrator. 
          Please contact your administrator to grant access to the workspace.
        </p>

        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col gap-3">
          <Button onClick={() => {
            router.refresh();
            window.location.href = "/dashboard";
          }} className="w-full h-11 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-extrabold flex items-center justify-center gap-2 cursor-pointer">
            Check Status / Refresh
          </Button>
          <Button onClick={signOut} variant="secondary" className="w-full h-11 border border-white/5 bg-slate-950/40 text-slate-300 hover:text-white flex items-center justify-center gap-2 cursor-pointer">
            <LogOut className="size-4" />
            Logout / Switch Account
          </Button>
        </div>
      </div>

      <footer className="text-center text-xs text-slate-600 py-3">
        PulseBoard Protection Shield Active
      </footer>
    </main>
  );
}
