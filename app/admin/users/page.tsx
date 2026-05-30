"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Loader2,
  UserCheck,
  UserX,
  UserPlus,
  ShieldCheck,
  UserCog,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/app-shell";
import type { UserProfile } from "@/lib/schema";
import * as clientDb from "@/lib/clientDb";
import { createClient } from "@/lib/supabase/client";

export default function UserManagementPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const loadData = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      let userId = "demo-user-id";
      let email = "vinay1979@gmail.com";

      if (user) {
        setCurrentUser(user);
        userId = user.id;
        email = user.email || "";
      }

      // Sync and retrieve User Profile
      const profile = await clientDb.syncUserProfile(userId, email);
      setCurrentProfile(profile);

      // Strict RBAC Guard Check
      if (profile.role !== "super-admin") {
        router.push("/dashboard");
        return;
      }

      // Fetch all users
      const allUsers = await clientDb.getAllUsers();
      setUsers(allUsers);
    } catch (err) {
      console.error("Error loading user administration console:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleApproveUser = async (userId: string) => {
    try {
      await clientDb.approveUser(userId);
      
      // Optimistic state update
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, approval_status: "approved" as const } : u
        )
      );
      
      setActionMessage("User approved successfully!");
      setTimeout(() => setActionMessage(""), 2000);
    } catch (err) {
      console.error("Failed to approve user:", err);
    }
  };

  const handleDeclineUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to permanently decline and delete "${userEmail}"? This cannot be undone.`)) return;
    try {
      await clientDb.declineUser(userId);
      
      // Optimistic state update — remove from list entirely
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      
      setActionMessage(`Account for ${userEmail} has been declined and removed.`);
      setTimeout(() => setActionMessage(""), 3000);
    } catch (err) {
      console.error("Failed to decline user:", err);
      setActionMessage("Error: Failed to decline user.");
      setTimeout(() => setActionMessage(""), 3000);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || inviting) return;

    setInviting(true);
    try {
      const invited = await clientDb.manuallyAddUser(inviteEmail.trim());
      setUsers((prev) => [invited, ...prev]);
      setInviteEmail("");
      setActionMessage(`Pre-approved user invited successfully!`);
      setTimeout(() => setActionMessage(""), 3000);
    } catch (err: any) {
      console.error("Failed to invite user:", err);
      setActionMessage(`Error: ${err.message || "Failed to invite"}`);
      setTimeout(() => setActionMessage(""), 4000);
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center">
        <Loader2 className="size-8 animate-spin text-cyan-400" />
        <p className="mt-4 text-sm text-slate-400">Loading user console...</p>
      </div>
    );
  }

  const pendingUsers = users.filter((u) => u.approval_status === "pending");
  const approvedUsers = users.filter((u) => u.approval_status === "approved");

  return (
    <AppShell email={currentUser?.email || "vinay1979@gmail.com"} identityLabel="Super-Admin Access" role="super-admin">
      <div className="mx-auto max-w-7xl">
        {/* Admin Console Header Banner */}
        <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-tr from-cyan-500/5 to-violet-500/5 opacity-20 pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 shadow-md">
              <UserCog className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-white">User Administration</h1>
              <p className="text-sm text-slate-400 mt-1">
                Strict administrative security lock. Approve pending registrations and invite pre-approved power users.
              </p>
            </div>
          </div>
        </div>

        {/* Global Notifications Panel */}
        {actionMessage && (
          <div className="mb-6 text-center text-sm font-extrabold rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-4 py-2.5 text-cyan-400 shadow-lg">
            {actionMessage}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          {/* LEFT: User Management Lists */}
          <div className="space-y-8">
            {/* 1. Pending Approvals Grid */}
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-2xl relative">
              <h3 className="text-lg font-black border-b border-white/5 pb-3 flex items-center gap-2 text-white">
                <UserX className="size-5 text-amber-400" />
                Pending Approvals ({pendingUsers.length})
              </h3>
              
              <div className="mt-4 overflow-x-auto">
                {pendingUsers.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">
                    No pending account approvals in database queue.
                  </p>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] uppercase font-black tracking-wider text-slate-500">
                        <th className="pb-3">Email Address</th>
                        <th className="pb-3">Default Role</th>
                        <th className="pb-3 text-right">Access Controls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingUsers.map((user) => (
                        <tr key={user.id} className="border-b border-white/5 text-sm text-slate-300">
                          <td className="py-4 font-semibold">{user.email}</td>
                          <td className="py-4">
                            <span className="bg-slate-800 text-slate-400 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                              {user.role}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                onClick={() => handleDeclineUser(user.id, user.email)}
                                className="h-9 px-4 bg-red-500/20 hover:bg-red-500 border border-red-500/30 hover:border-red-500 text-red-400 hover:text-slate-950 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-150"
                              >
                                <UserX className="size-3.5" />
                                Decline
                              </Button>
                              <Button
                                onClick={() => handleApproveUser(user.id)}
                                className="h-9 px-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
                              >
                                <UserCheck className="size-3.5" />
                                Approve
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {/* 2. Approved Users Grid */}
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-2xl relative">
              <h3 className="text-lg font-black border-b border-white/5 pb-3 flex items-center gap-2 text-white">
                <ShieldCheck className="size-5 text-emerald-400 animate-pulse" />
                Approved Power Users ({approvedUsers.length})
              </h3>
              
              <div className="mt-4 overflow-x-auto">
                {approvedUsers.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">
                    No approved power users found.
                  </p>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] uppercase font-black tracking-wider text-slate-500">
                        <th className="pb-3">Email Address</th>
                        <th className="pb-3">Permission Role</th>
                        <th className="pb-3 text-right">Lobby Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedUsers.map((user) => (
                        <tr key={user.id} className="border-b border-white/5 text-sm text-slate-300">
                          <td className="py-4 font-semibold">{user.email}</td>
                          <td className="py-4">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                              user.role === "super-admin"
                                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/20"
                                : "bg-slate-800 text-slate-400"
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-black uppercase">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Approved
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT: Pre-Approval manual invitations form */}
          <div>
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-2xl relative">
              <h3 className="text-lg font-black border-b border-white/5 pb-3 flex items-center gap-2 text-white">
                <UserPlus className="size-5 text-cyan-400" />
                Pre-Approve Account
              </h3>
              
              <form onSubmit={handleInviteUser} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email" className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Google OAuth Email Address
                  </Label>
                  <Input
                    id="invite-email"
                    name="invite-email"
                    type="email"
                    required
                    placeholder="e.g. associate@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="text-sm h-11 bg-slate-950/40 border-white/5 text-white"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/10"
                  disabled={inviting || !inviteEmail.trim()}
                >
                  {inviting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Pre-approving...
                    </>
                  ) : (
                    <>
                      <Mail className="size-4" />
                      Grant Pre-Approval
                    </>
                  )}
                </Button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
