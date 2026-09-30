"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Home, Search } from "lucide-react";
import { usePreferences } from "@/components/Preferences";

type ErrorStateProps = {
  code?: string;
  title: string;
  description: string;
  action?: ReactNode;
};

export function ErrorState({ code, title, description, action }: ErrorStateProps) {
  const { t } = usePreferences();

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      {code && (
        <p className="mb-3 font-mono text-sm tracking-[0.2em] text-violet-400/80">{code}</p>
      )}
      <h1 className="text-2xl font-semibold text-white sm:text-3xl">{title}</h1>
      <p className="mt-3 max-w-md text-sm text-zinc-400 sm:text-base">{description}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {action}
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
        >
          <Home className="h-4 w-4" />
          {t("home")}
        </Link>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/5"
        >
          <Search className="h-4 w-4" />
          {t("search")}
        </Link>
      </div>
    </div>
  );
}
