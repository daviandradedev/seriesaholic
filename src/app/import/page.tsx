"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Upload, FileArchive, CheckCircle, AlertCircle, Loader2, Eye, XCircle } from "lucide-react";
import { usePreferences } from "@/components/Preferences";
import { ProgressBar } from "@/components/ProgressBar";
import { numberLocale, type CopyKey } from "@/lib/copy";
import { ImportFailureResolver } from "@/components/ImportFailureResolver";
import type { ImportStats } from "@/lib/importers/types";
import { saveWasRejected } from "@/lib/login-redirect";

const emptyStats = (): ImportStats => ({
  showsAdded: 0,
  showsUpdated: 0,
  episodesAdded: 0,
  episodesSkipped: 0,
  errors: 0,
  errorMessages: [],
  addedShows: [],
  failures: [],
});

const JOB_STORAGE_KEY = "seriesaholic-import-job-id";

type ImportJobResponse = {
  id: string;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  phase: string;
  current: number;
  total: number;
  label: string | null;
  format: string | null;
  importLogId: string | null;
  error: string | null;
  stats: ImportStats | null;
};

type ImportResult = {
  success: boolean;
  format: string;
  totalItems: number;
  importLogId?: string;
  stats: ImportStats;
  error?: string;
};

const PHASE_KEYS: Record<string, CopyKey> = {
  parsing: "phaseParsing",
  episodes: "phaseEpisodes",
  watchlist: "phaseWatchlist",
  dropped: "phaseDropped",
  status: "phaseStatus",
  complete: "phaseComplete",
};

function jobToResult(
  job: ImportJobResponse,
  totalItems: number | undefined,
  cancelledMessage: string,
  failedMessage: string,
): ImportResult {
  if (job.status === "CANCELLED") {
    return {
      success: false,
      format: job.format ?? "unknown",
      totalItems: totalItems ?? job.total,
      error: cancelledMessage,
      stats: {
        ...emptyStats(),
        ...(job.stats ?? {}),
        failures: job.stats?.failures ?? [],
      },
    };
  }

  if (job.status === "FAILED") {
    return {
      success: false,
      format: job.format ?? "unknown",
      totalItems: totalItems ?? 0,
      error: job.error ?? failedMessage,
      stats: {
        ...emptyStats(),
        errors: 1,
        ...(job.stats ?? {}),
        failures: job.stats?.failures ?? [],
      },
    };
  }

  return {
    success: true,
    format: job.format ?? "unknown",
    totalItems: totalItems ?? job.total,
    importLogId: job.importLogId ?? undefined,
    stats: {
      ...emptyStats(),
      ...(job.stats ?? {}),
      failures: job.stats?.failures ?? [],
    },
  };
}

export default function ImportPage() {
  const { language, t } = usePreferences();
  const locale = numberLocale(language);
  const [files, setFiles] = useState<FileList | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{
    phase: string;
    current: number;
    total: number;
    label?: string;
  } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const resetImportRun = useCallback(() => {
    stopPolling();
    setLoading(false);
    setCancelling(false);
    setJobId(null);
    setProgress(null);
    localStorage.removeItem(JOB_STORAGE_KEY);
  }, [stopPolling]);

  const pollJob = useCallback(
    async (id: string, totalItems?: number) => {
      try {
        const res = await fetch(`/api/import/jobs/${id}`);
        const job = (await res.json()) as ImportJobResponse;

        if (job.status === "COMPLETED") {
          resetImportRun();
          setResult(jobToResult(job, totalItems, t("importCancelledDetail"), t("importError")));
          return;
        }

        if (job.status === "FAILED" || job.status === "CANCELLED") {
          resetImportRun();
          setResult(jobToResult(job, totalItems, t("importCancelledDetail"), t("importError")));
          return;
        }

        setProgress({
          phase: job.phase,
          current: job.current,
          total: job.total,
          label: job.label ?? undefined,
        });
      } catch {
      }
    },
    [resetImportRun, t],
  );

  const startPolling = useCallback(
    (id: string, totalItems?: number) => {
      stopPolling();
      setJobId(id);
      localStorage.setItem(JOB_STORAGE_KEY, id);
      setLoading(true);
      void pollJob(id, totalItems);
      pollRef.current = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        void pollJob(id, totalItems);
      }, 10_000);
    },
    [pollJob, stopPolling],
  );

  useEffect(() => {
    async function resumeJob() {
      const storedId = localStorage.getItem(JOB_STORAGE_KEY);
      if (!storedId) return;

      const res = await fetch(`/api/import/jobs/${storedId}`);
      if (!res.ok) {
        localStorage.removeItem(JOB_STORAGE_KEY);
        return;
      }

      const job = (await res.json()) as ImportJobResponse;
      if (job.status === "RUNNING") {
        startPolling(storedId);
        return;
      }
      if (job.status === "COMPLETED" || job.status === "CANCELLED" || job.status === "FAILED") {
        setResult(jobToResult(job, undefined, t("importCancelledDetail"), t("importError")));
        localStorage.removeItem(JOB_STORAGE_KEY);
      }
    }

    void resumeJob();
    return () => stopPolling();
  }, [startPolling, stopPolling, t]);

  useEffect(() => {
    function onVisibility() {
      if (document.hidden) {
        stopPolling();
        return;
      }
      const id = localStorage.getItem(JOB_STORAGE_KEY);
      if (id && loading) startPolling(id);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loading, startPolling, stopPolling]);

  async function handleImport() {
    if (!files?.length) return;

    setLoading(true);
    setResult(null);
    setProgress({ phase: "parsing", current: 0, total: 0, label: "Enviando arquivo..." });

    const formData = new FormData();
    for (const file of Array.from(files)) {
      formData.append("files", file);
    }

    try {
      const res = await fetch("/api/import/tvtime", {
        method: "POST",
        body: formData,
      });
      if (saveWasRejected(res)) {
        setLoading(false);
        return;
      }
      const data = await res.json();

      if (res.status === 409 && data.jobId) {
        startPolling(data.jobId);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      startPolling(data.jobId as string, data.totalItems as number);
    } catch (err) {
      setLoading(false);
      setResult({
        success: false,
        format: "unknown",
        totalItems: 0,
        stats: { ...emptyStats(), errors: 1 },
        error: err instanceof Error ? err.message : t("importError"),
      });
    }
  }

  async function handleCancelImport() {
    if (!jobId || cancelling) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/import/jobs/${jobId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("cancelFailed"));

      resetImportRun();
      setResult({
        success: false,
        format: "unknown",
        totalItems: progress?.total ?? 0,
        stats: { ...emptyStats() },
        error: t("importCancelledDetail"),
      });
    } catch (err) {
      resetImportRun();
      setResult({
        success: false,
        format: "unknown",
        totalItems: 0,
        stats: { ...emptyStats(), errors: 1 },
        error: err instanceof Error ? err.message : t("cancelError"),
      });
    }
  }

  const percent =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : progress?.phase === "parsing"
        ? 5
        : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("importTitle")}</h1>
          <p className="mt-1 text-zinc-400">{t("importSubtitle")}</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-sm">
          <Link href="/imports" className="text-violet-400 hover:underline">
            {t("viewHistory")}
          </Link>
          <Link href="/settings" className="text-zinc-500 hover:text-zinc-300">
            {t("clearData")}
          </Link>
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
          {t("importRunsOnServer")}
        </div>
      )}

      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
        <h2 className="font-semibold text-white">{t("howToExport")}</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-400">
          <li>
            {t("importStep1Before")}{" "}
            <a
              href="https://gdpr.tvtime.com/gdpr/self-service"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:underline"
            >
              gdpr.tvtime.com
            </a>{" "}
            {t("importStep1After")}
          </li>
          <li>
            {t("importStep2Before")}{" "}
            <a
              href="https://github.com/Hobo-Ware/tv-time-liberator"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:underline"
            >
              TV Time Liberator
            </a>{" "}
            {t("importStep2After")}
          </li>
          <li>
            {t("importStep3Before")}{" "}
            <code className="text-violet-300">.env</code>
          </li>
          <li>{t("importStep4")}</li>
          <li>{t("importStep5")}</li>
        </ol>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className="cursor-pointer rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] p-12 text-center transition-colors hover:border-violet-500/40 hover:bg-violet-500/5"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,.csv,.json"
          multiple
          className="hidden"
          onChange={(e) => setFiles(e.target.files)}
        />
        <Upload className="mx-auto h-10 w-10 text-zinc-600" />
        <p className="mt-3 font-medium text-white">
          {files?.length ? t("filesSelected", { n: files.length }) : t("clickToSelect")}
        </p>
        <p className="mt-1 text-sm text-zinc-500">.zip, .csv ou .json</p>
      </div>

      {files && files.length > 0 && (
        <ul className="space-y-2">
          {Array.from(files).map((f) => (
            <li
              key={f.name}
              className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm text-zinc-300"
            >
              <FileArchive className="h-4 w-4 text-violet-400" />
              {f.name} ({(f.size / 1024).toFixed(0)} KB)
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={handleImport}
        disabled={!files?.length || loading}
        className="w-full rounded-xl bg-violet-600 py-3 font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? t("importing") : t("startImport")}
      </button>

      {(loading || cancelling) && (
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-violet-400" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white">
                {t(PHASE_KEYS[progress?.phase ?? "parsing"] ?? "importing")}
              </p>
              {progress && progress.total > 0 ? (
                <p className="mt-0.5 text-sm text-violet-300">
                  {progress.current.toLocaleString(locale)} /{" "}
                  {progress.total.toLocaleString(locale)}
                  <span className="ml-2 text-zinc-500">({percent}%)</span>
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-zinc-500">{t("pleaseWait")}</p>
              )}
            </div>
          </div>

          <ProgressBar value={percent} className="mt-4 h-2" />

          {progress?.label && progress.phase !== "parsing" && (
            <p className="mt-3 truncate text-xs text-zinc-500">{progress.label}</p>
          )}

          {loading && jobId && !cancelling && (
            <button
              type="button"
              onClick={() => void handleCancelImport()}
              disabled={cancelling}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
              {cancelling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("cancelling")}
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  {t("cancelImport")}
                </>
              )}
            </button>
          )}
        </div>
      )}

      {result && (
        <div
          className={`rounded-2xl border p-6 ${
            result.success
              ? "border-emerald-500/30 bg-emerald-500/5"
              : result.error?.toLowerCase().includes("cancel")
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-red-500/30 bg-red-500/5"
          }`}
        >
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            ) : result.error?.toLowerCase().includes("cancel") ? (
              <XCircle className="h-5 w-5 text-amber-400" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-400" />
            )}
            <h3 className="font-semibold text-white">
              {result.success
                ? t("importDone")
                : result.error?.toLowerCase().includes("cancel")
                  ? t("importCancelled")
                  : t("importError")}
            </h3>
          </div>

          {result.error && (
            <p
              className={`mt-2 text-sm ${
                result.error.toLowerCase().includes("cancel") ? "text-amber-200" : "text-red-300"
              }`}
            >
              {result.error}
            </p>
          )}

          {result.success && result.stats && (
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-white/[0.03] p-3">
                <p className="text-zinc-500">{t("formatDetected")}</p>
                <p className="font-medium text-white">{result.format}</p>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3">
                <p className="text-zinc-500">{t("showsAdded")}</p>
                <p className="font-medium text-white">{result.stats.showsAdded}</p>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3">
                <p className="text-zinc-500">{t("newEpisodes")}</p>
                <p className="font-medium text-white">
                  {result.stats.episodesAdded.toLocaleString(locale)}
                </p>
              </div>
              {result.stats.episodesSkipped > 0 && (
                <div className="rounded-lg bg-white/[0.03] p-3">
                  <p className="text-zinc-500">{t("alreadyExisted")}</p>
                  <p className="font-medium text-white">
                    {result.stats.episodesSkipped.toLocaleString(locale)}
                  </p>
                </div>
              )}
            </div>
          )}

          {result.success && result.importLogId && (
            <Link
              href={`/imports/${result.importLogId}`}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-medium text-white hover:bg-violet-500"
            >
              <Eye className="h-4 w-4" />
              {t("reviewAdded")}
            </Link>
          )}

          {result.success &&
            result.importLogId &&
            (result.stats.failures?.length ?? 0) > 0 && (
              <div className="mt-6 border-t border-white/10 pt-6">
                <ImportFailureResolver
                  importLogId={result.importLogId}
                  initialFailures={result.stats.failures}
                />
              </div>
            )}

          {result.stats?.errorMessages?.length > 0 &&
            !(result.stats.failures?.length > 0) && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-zinc-400">
                  {t("uniqueWarningCount", { n: result.stats.errors })}
                </summary>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-zinc-500">
                  {result.stats.errorMessages.map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
              </details>
            )}
        </div>
      )}
    </div>
  );
}
