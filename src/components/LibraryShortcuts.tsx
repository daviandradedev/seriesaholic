"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Home, Import, Search, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/Preferences";

const shortcuts = [
  { href: "/", label: "home", icon: Home },
  { href: "/discover", label: "discover", icon: Sparkles },
  { href: "/search", label: "search", icon: Search },
  { href: "/calendar", label: "calendar", icon: Calendar },
  { href: "/import", label: "import", icon: Import },
  { href: "/settings", label: "settings", icon: Settings },
] as const;

export function LibraryShortcuts({ className }: { className?: string }) {
  const pathname = usePathname();
  const { theme, t } = usePreferences();
  const light = theme === "light";

  return (
    <nav className={cn("flex flex-wrap gap-2", className)} aria-label={t("library")}>
      {shortcuts.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
            pathname === href
              ? light
                ? "border-violet-500/40 bg-violet-500/10 text-violet-800"
                : "border-violet-500/40 bg-violet-500/15 text-violet-200"
              : light
                ? "border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                : "border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {t(label)}
        </Link>
      ))}
    </nav>
  );
}
