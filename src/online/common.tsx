import { useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import type { Member } from "./types";

export const nameOf = (members: Member[], uid: string) => members.find((m) => m.uid === uid)?.name ?? "؟";
export const isOnline = (members: Member[], uid: string) => members.find((m) => m.uid === uid)?.online ?? false;

/** Secret card that can be hidden when others are looking. */
export function SecretCard({ children, className }: { children: ReactNode; className?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className={cn("relative overflow-hidden rounded-3xl border border-white/10 text-center no-select", className)}>
      <div className={cn("p-6 transition", !shown && "blur-xl opacity-40")}>{children}</div>
      <button
        onClick={() => setShown((s) => !s)}
        className={cn(
          "absolute inset-x-0 bottom-0 py-2 text-sm font-bold transition",
          shown ? "bg-black/30 text-slate-300" : "inset-0 flex items-center justify-center bg-black/20 text-lg text-white",
        )}
      >
        {shown ? "🙈 مخفی کن" : "👆 برای دیدن نقش بزن"}
      </button>
    </div>
  );
}

export function OfflineDot({ online }: { online: boolean }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", online ? "bg-emerald-400" : "bg-slate-500")} />;
}
