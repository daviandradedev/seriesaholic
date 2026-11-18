"use client";

import { useSyncExternalStore } from "react";
import { redirectToAuthLogin } from "@/lib/login-redirect";
import { ModalDialog } from "@/components/ModalDialog";
import { usePreferences } from "@/components/Preferences";
import { GITHUB_URL, LINKEDIN_URL, PORTFOLIO_URL } from "@/lib/site-links";

const DISMISS_KEY = "sah-explore-notice";
const DISMISS_EVENT = "sah-explore-notice";

const workLinks = [
  { href: PORTFOLIO_URL, label: "portfolio" },
  { href: LINKEDIN_URL, label: "LinkedIn" },
  { href: GITHUB_URL, label: "GitHub" },
  { href: "https://work-schedule.daviandrade.dev", label: "Work Schedule" },
  { href: "https://asebili-student.daviandrade.dev", label: "student" },
  { href: "https://asebili-instructor.daviandrade.dev", label: "instructor" },
] as const;

function subscribeExploreNotice(onChange: () => void) {
  window.addEventListener(DISMISS_EVENT, onChange);
  return () => window.removeEventListener(DISMISS_EVENT, onChange);
}

export function ExplorePromptModal() {
  const { ready, theme, t } = usePreferences();
  const dismissed = useSyncExternalStore(
    subscribeExploreNotice,
    () => sessionStorage.getItem(DISMISS_KEY) === "1",
    () => true,
  );
  const open = ready && !dismissed;
  const light = theme === "light";

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    window.dispatchEvent(new Event(DISMISS_EVENT));
  }

  if (!open) return null;

  return (
    <ModalDialog
      labelledBy="explore-prompt-title"
      describedBy="explore-prompt-body"
      onClose={dismiss}
      className="max-w-lg"
    >
      <p className={light ? "text-xs font-medium uppercase tracking-wide text-violet-700" : "text-xs font-medium uppercase tracking-wide text-violet-300"}>
        {t("exploreEyebrow")}
      </p>
      <h2 id="explore-prompt-title" className="mt-2 text-xl font-semibold">
        {t("exploreTitle")}
      </h2>
      <p
        id="explore-prompt-body"
        className={light ? "mt-3 text-sm leading-relaxed text-zinc-600" : "mt-3 text-sm leading-relaxed text-zinc-300"}
      >
        {t("exploreBody")}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={redirectToAuthLogin}
          className={
            light
              ? "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              : "rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
          }
        >
          {t("exploreLogin")}
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
          {t("exploreContinue")}
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
                    ? "inline-flex min-h-6 items-center rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-800 hover:bg-zinc-100"
                    : "inline-flex min-h-6 items-center rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-200 hover:bg-white/5 hover:text-white"
                }
              >
                {link.label === "portfolio" || link.label === "student" || link.label === "instructor"
                  ? t(link.label)
                  : link.label}
                <span className="sr-only">. {t("opensInNewTab")}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </ModalDialog>
  );
}
