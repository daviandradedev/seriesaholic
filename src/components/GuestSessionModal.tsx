"use client";

import { useEffect, useSyncExternalStore } from "react";
import { redirectToAuthLogin } from "@/lib/login-redirect";
import { usePreferences } from "@/components/Preferences";

const DISMISS_KEY = "sah-guest-notice";

const workLinks = [
  { href: "https://daviandrade-portfolio.vercel.app/", label: "portfolio" },
  { href: "https://linkedin.com/in/daviandradedev", label: "LinkedIn" },
  { href: "https://github.com/daviandradedev", label: "GitHub" },
  { href: "https://workschedule-dd.vercel.app/", label: "Work Schedule" },
  { href: "https://asebili-student.daviandrade.dev", label: "student" },
  { href: "https://asebili-instructor.daviandrade.dev", label: "instructor" },
] as const;

function subscribeGuestNotice(onChange: () => void) {
  window.addEventListener("sah-guest-notice", onChange);
  return () => window.removeEventListener("sah-guest-notice", onChange);
}

export function GuestSessionModal() {
  const { ready, theme, t } = usePreferences();
  const dismissed = useSyncExternalStore(
    subscribeGuestNotice,
    () => sessionStorage.getItem(DISMISS_KEY) === "1",
    () => true,
  );
  const open = ready && !dismissed;
  const light = theme === "light";

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    window.dispatchEvent(new Event("sah-guest-notice"));
  }

  if (!open) return null;

  return (
    <div
      className={
        light
          ? "fixed inset-0 z-[70] flex items-end justify-center bg-zinc-900/40 p-4 sm:items-center"
          : "fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      }
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-session-title"
        className={
          light
            ? "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl"
            : "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#12121a] p-6 text-white shadow-2xl"
        }
      >
        <p className={light ? "text-xs font-medium uppercase tracking-wide text-violet-700" : "text-xs font-medium uppercase tracking-wide text-violet-300"}>
          {t("guestEyebrow")}
        </p>
        <h2 id="guest-session-title" className="mt-2 text-xl font-semibold">
          {t("guestTitle")}
        </h2>
        <p className={light ? "mt-3 text-sm leading-relaxed text-zinc-600" : "mt-3 text-sm leading-relaxed text-zinc-300"}>
          {t("guestBody")}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            autoFocus
            onClick={redirectToAuthLogin}
            className={
              light
                ? "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                : "rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
            }
          >
            {t("guestLogin")}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className={
              light
                ? "rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-100"
                : "rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:bg-white/5"
            }
          >
            {t("guestContinue")}
          </button>
        </div>

        <div className={light ? "mt-6 border-t border-zinc-200 pt-5" : "mt-6 border-t border-white/10 pt-5"}>
          <p className={light ? "text-xs font-medium uppercase tracking-wide text-zinc-500" : "text-xs font-medium uppercase tracking-wide text-zinc-500"}>
            {t("work")}
          </p>
          <p className={light ? "mt-2 text-sm leading-relaxed text-zinc-600" : "mt-2 text-sm leading-relaxed text-zinc-400"}>
            {t("workBody")}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {workLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={
                    light
                      ? "inline-flex rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-800 hover:bg-zinc-100"
                      : "inline-flex rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-200 hover:bg-white/5 hover:text-white"
                  }
                >
                  {link.label === "portfolio" || link.label === "student" || link.label === "instructor"
                    ? t(link.label)
                    : link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function GuestClaim() {
  useEffect(() => {
    if (sessionStorage.getItem("sah-claimed") === "1") return;
    void fetch("/api/auth/claim-guest", { method: "POST" }).finally(() => {
      sessionStorage.setItem("sah-claimed", "1");
    });
  }, []);

  return null;
}
