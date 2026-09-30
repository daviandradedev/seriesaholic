"use client";

import { AuthUserChip, type HeaderUser } from "@/components/AuthUserChip";
import { BrandWordmark } from "@/components/BrandWordmark";
import { LoginButton } from "@/components/LoginButton";
import { LibraryShortcuts } from "@/components/LibraryShortcuts";
import { LanguageToggle, ThemeToggle, usePreferences } from "@/components/Preferences";
import { PORTFOLIO_URL } from "@/lib/site-links";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Home, Import, Search, Sparkles, Tv } from "lucide-react";
import { cn } from "@/lib/utils";

export function NavBar({ user }: { user: HeaderUser | null }) {
  const pathname = usePathname();
  const { theme, t } = usePreferences();
  const light = theme === "light";
  const mobileLinks = [
    { href: "/", label: t("home"), icon: Home },
    { href: "/discover", label: t("discover"), icon: Sparkles },
    { href: "/search", label: t("search"), icon: Search },
    { href: "/calendar", label: t("calendar"), icon: Calendar },
    { href: "/import", label: t("import"), icon: Import },
  ];

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner site-header-inner-app">
          <div className="site-header-row">
            <Link href="/" className="app-mark">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
                <Tv className="h-4 w-4" />
              </div>
              <span className="app-mark-name">SERIESAHOLIC</span>
            </Link>
            <div className="preferences-bar" role="group" aria-label={t("preferences")}>
              <LanguageToggle />
              <ThemeToggle />
              {user ? <AuthUserChip user={user} /> : <LoginButton />}
            </div>
          </div>
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`daviandrade.dev. ${t("opensInNewTab")}`}
            className="brand-lockup brand-lockup-center"
          >
            <BrandWordmark />
          </a>
        </div>
        <div className="site-header-shortcuts">
          <LibraryShortcuts />
        </div>
      </header>

      <nav
        className={
          light
            ? "fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white/95 backdrop-blur-xl md:hidden"
            : "fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0f0f14]/95 backdrop-blur-xl md:hidden"
        }
      >
        <div className="flex justify-around px-1 py-2">
          {mobileLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-0 flex-col items-center gap-0.5 px-1.5 py-1 text-[10px] transition-colors",
                pathname === href ? "text-violet-400" : "text-zinc-500",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
