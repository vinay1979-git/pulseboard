"use client";

import { useState, useRef } from "react";
import { Camera, Loader2, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import * as clientDb from "@/lib/clientDb";
import { Button } from "@/components/ui/button";

interface AvatarUploadProps {
  userId: string;
  initialAvatarUrl?: string | null;
  email: string;
}

export function AvatarUpload({ userId, initialAvatarUrl, email }: AvatarUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = () => {
    return email.split("@")[0].substring(0, 2).toUpperCase();
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fileExt = file.name.split(".").pop();
    const fileSize = file.size / 1024 / 1024; // size in MB

    if (fileSize > 2) {
      setErrorMsg("Image size must be less than 2MB.");
      return;
    }

    setUploading(true);
    setErrorMsg("");

    try {
      const supabase = createClient();
      const isSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

      if (isSupabase) {
        // 1. Upload to Supabase Storage in 'avatars' bucket
        const filePath = `${userId}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, file, { cacheControl: "3600", upsert: true });

        if (uploadError) throw uploadError;

        // 2. Retrieve Public URL
        const { data: { publicUrl } } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        // 3. Save URL to Database profile
        await clientDb.updateUserProfileAvatar(userId, publicUrl);
        setAvatarUrl(publicUrl);
      } else {
        // Local Mock Fallback: convert to base64 Data URL
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Url = reader.result as string;
          await clientDb.updateUserProfileAvatar(userId, base64Url);
          setAvatarUrl(base64Url);
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      console.error("Error uploading avatar:", err);
      setErrorMsg(err.message || "Failed to upload avatar image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="relative group flex h-20 w-20 items-center justify-center rounded-lg border border-cyan-300/30 bg-slate-900/60 text-cyan-700 dark:text-cyan-200 overflow-hidden shadow-2xl backdrop-blur-md">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full w-full text-slate-400 font-extrabold tracking-wider text-xl">
            {getInitials()}
          </div>
        )}

        {/* Hover overlay button */}
        <button
          type="button"
          onClick={handleUploadClick}
          disabled={uploading}
          className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-40"
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin text-cyan-400" />
          ) : (
            <>
              <Camera className="size-4 mb-1 text-cyan-400" />
              Upload
            </>
          )}
        </button>
      </div>

      <div className="text-left">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-cyan-400">
          Profile Management
        </p>
        <div className="mt-1 flex items-center gap-3">
          <h2 className="text-lg font-black text-white">Avatar Picture</h2>
          <Button
            type="button"
            size="sm"
            onClick={handleUploadClick}
            disabled={uploading}
            className="h-8 text-[10px] font-black uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/5 cursor-pointer"
          >
            {uploading ? "Uploading..." : "Change Image"}
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-slate-400 max-w-sm">
          Supports PNG, JPG, GIF up to 2MB. Image will be synchronized with Supabase Storage.
        </p>
        {errorMsg && (
          <p className="mt-2 text-xs font-semibold text-red-400 bg-red-400/10 border border-red-400/20 py-1 px-3.5 rounded-lg w-fit">
            {errorMsg}
          </p>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
}
