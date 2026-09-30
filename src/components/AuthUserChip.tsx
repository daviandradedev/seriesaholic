"use client";

import Image from "next/image";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { usePreferences } from "@/components/Preferences";

export type HeaderUser = {
  email: string;
  name: string;
  image?: string | null;
};

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
}

export function AuthUserChip({ user }: { user: HeaderUser }) {
  const { theme, t } = usePreferences();
  const light = theme === "light";
  const label = user.name?.trim() || user.email;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          window.location.assign("/api/auth/handoff");
        }}
        className={
          light
            ? "flex min-w-0 items-center gap-2 rounded-full py-0.5 pl-0.5 pr-1 text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
            : "flex min-w-0 items-center gap-2 rounded-full py-0.5 pl-0.5 pr-1 text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
        }
        title={t("profile")}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-white/15 bg-white/10 text-[11px] font-bold tracking-wide text-white">
          {user.image ? (
            <Image src={user.image} alt="" width={32} height={32} className="h-full w-full object-cover" />
          ) : (
            initialsFromName(label)
          )}
        </span>
        <span className="hidden max-w-[10rem] truncate text-xs sm:inline">{label}</span>
      </button>
      <button
        type="button"
        onClick={async () => {
          await authClient.signOut();
          window.location.reload();
        }}
        className={
          light
            ? "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
            : "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
        }
        aria-label={t("signOut")}
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">{t("signOut")}</span>
      </button>
    </div>
  );
}
