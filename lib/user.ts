import type { User } from "@supabase/supabase-js";

export function getUserDisplayName(user: User) {
  return (
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "PulseBoard user"
  );
}

export function getUserIdentityLabel(user: User) {
  const name = getUserDisplayName(user);
  return user.email ? `${name} (${user.email})` : name;
}
