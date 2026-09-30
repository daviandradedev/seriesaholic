"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { usePreferences } from "@/components/Preferences";
import { saveWasRejected } from "@/lib/login-redirect";
import { isResetConfirmPhrase, resetConfirmPhrase } from "@/lib/reset-confirm";

const JOB_STORAGE_KEY = "seriesaholic-import-job-id";

export default function SettingsPage() {
  const router = useRouter();
  const { t, language } = usePreferences();
  const shownPhrase = resetConfirmPhrase(language);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const typed = phrase.trim().toUpperCase();
  const canSubmit = isResetConfirmPhrase(typed) && !busy;

  async function handleReset() {
    if (!canSubmit) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: typed }),
      });
      if (saveWasRejected(res)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("clearFailed"));

      try {
        localStorage.removeItem(JOB_STORAGE_KEY);
      } catch {
      }

      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("clearError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{t("settingsPage")}</h1>
        <p className="mt-1 text-zinc-400">{t("settingsSubtitle")}</p>
      </div>

      <section className="space-y-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div>
            <h2 className="text-lg font-semibold text-red-200">{t("dangerZone")}</h2>
            <p className="mt-2 text-sm text-zinc-400">
              {t("settingsDangerBefore")}{" "}
              <strong className="text-zinc-200">{t("settingsDangerStrong")}</strong>
              {t("settingsDangerAfter")}
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-zinc-500">
              <li>{t("settingsItemLibrary")}</li>
              <li>{t("settingsItemImports")}</li>
              <li>
                {t("settingsItemCatalogBefore")}{" "}
                <span className="text-zinc-400">{t("settingsItemCatalogNot")}</span>{" "}
                {t("settingsItemCatalogAfter")}
              </li>
            </ul>
          </div>
        </div>

        {done ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {t("clearedBefore")}{" "}
            <Link href="/import" className="underline hover:text-white">
              {t("importAgain")}
            </Link>{" "}
            {t("clearedOr")}{" "}
            <Link href="/" className="underline hover:text-white">
              {t("clearedHome")}
            </Link>
            .
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm text-zinc-400">
              {t("typeConfirm", { phrase: "\u0000" }).split("\u0000")[0]}
              <span className="font-mono text-red-300">{shownPhrase}</span>
              {t("typeConfirm", { phrase: "\u0000" }).split("\u0000")[1]}
              <input
                type="text"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder={shownPhrase}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none"
              />
            </label>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleReset}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("erasing")}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  {t("clearAll")}
                </>
              )}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
