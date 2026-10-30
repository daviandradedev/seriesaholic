"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import { usePreferences } from "@/components/Preferences";
import { redirectToAuthLogin } from "@/lib/login-redirect";

export function SignInRequired() {
  const { t } = usePreferences();

  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-dashed border-violet-500/30 bg-violet-500/5 p-8 text-center">
      <h1 className="text-lg font-semibold text-white">{t("signInRequiredTitle")}</h1>
      <p className="mt-2 text-sm text-zinc-400">{t("signInRequiredBody")}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={redirectToAuthLogin}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          <LogIn className="h-4 w-4" />
          {t("guestLogin")}
        </button>
        <Link
          href="/discover"
          className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
        >
          {t("discoverShows")}
        </Link>
      </div>
    </section>
  );
}
