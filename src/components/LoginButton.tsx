"use client";

import { redirectToAuthLogin } from "@/lib/login-redirect";
import { usePreferences } from "@/components/Preferences";

export function LoginButton() {
  const { theme, t } = usePreferences();
  const light = theme === "light";

  return (
    <button
      type="button"
      onClick={redirectToAuthLogin}
      className={
        light
          ? "rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          : "rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
      }
    >
      {t("login")}
    </button>
  );
}
