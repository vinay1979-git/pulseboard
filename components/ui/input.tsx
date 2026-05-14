import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  type,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full rounded-md border border-slate-300/70 bg-white/85 px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/40 dark:border-white/12 dark:bg-white/8 dark:text-white dark:placeholder:text-slate-400",
        className,
      )}
      {...props}
    />
  );
}
