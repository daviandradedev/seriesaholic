import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { parseTvTimeExport } from "@/lib/importers/tvtime";
import { applyImportItems, countImportWork } from "@/lib/importers/apply";
import { ImportCancelledError } from "@/lib/importers/errors";
import type { ImportProgressEvent, ImportStats } from "@/lib/importers/types";
import type { ImportJobStatus } from "@prisma/client";
import { invalidateLibraryCache } from "@/lib/cache-tags";
import { cleanupSuspiciousImportWatches } from "@/lib/cleanup-import";
import { setTmdbImportMode } from "@/lib/tmdb";
import { requireUserId } from "@/lib/session-user";

const activeImportAborts = new Map<string, AbortController>();

export function registerImportJobAbort(jobId: string): AbortSignal {
  const controller = new AbortController();
  activeImportAborts.set(jobId, controller);
  return controller.signal;
}

export function unregisterImportJobAbort(jobId: string) {
  activeImportAborts.delete(jobId);
}

export async function requestCancelImportJob(jobId: string) {
  const userId = await requireUserId();
  const job = await prisma.importJob.findFirst({ where: { id: jobId, userId } });
  if (!job) throw new Error("Job not found");
  if (job.status !== "RUNNING") {
    throw new Error("There is no running import to cancel");
  }

  activeImportAborts.get(jobId)?.abort();

  progressTimers.delete(jobId);
  progressPending.delete(jobId);

  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      cancelRequested: true,
      status: "CANCELLED",
      phase: "complete",
      label: "Import cancelled",
    },
  });
}

export function hashImportPayload(files: Array<{ name: string; buffer: ArrayBuffer }>) {
  const hash = createHash("sha256");
  for (const file of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    hash.update(file.name);
    hash.update(Buffer.from(file.buffer));
  }
  return hash.digest("hex");
}

const progressPending = new Map<string, ImportProgressEvent>();
const progressTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function writeImportJobProgress(jobId: string, progress: ImportProgressEvent) {
  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      phase: progress.phase,
      current: progress.current,
      total: progress.total,
      label: progress.label,
      updatedAt: new Date(),
    },
  });
}

export async function flushImportJobProgress(jobId: string) {
  const timer = progressTimers.get(jobId);
  if (timer) {
    clearTimeout(timer);
    progressTimers.delete(jobId);
  }
  const progress = progressPending.get(jobId);
  if (!progress) return;
  progressPending.delete(jobId);
  await writeImportJobProgress(jobId, progress);
}

export async function updateImportJobProgress(jobId: string, progress: ImportProgressEvent) {
  progressPending.set(jobId, progress);

  const immediate =
    progress.phase === "complete" ||
    progress.phase === "status" ||
    progress.phase === "parsing";

  if (immediate) {
    await flushImportJobProgress(jobId);
    return;
  }

  if (progressTimers.has(jobId)) return;

  progressTimers.set(
    jobId,
    setTimeout(() => {
      progressTimers.delete(jobId);
      void flushImportJobProgress(jobId);
    }, 4000),
  );
}

export async function runImportJob(
  jobId: string,
  parsed: Awaited<ReturnType<typeof parseTvTimeExport>>,
  options?: { contentHash?: string; userId?: string },
) {
  const userId = options?.userId ?? (await requireUserId());
  setTmdbImportMode(true);
  const abortSignal = registerImportJobAbort(jobId);
  try {
    const workTotal = countImportWork(parsed.items).total;

    await updateImportJobProgress(jobId, {
      phase: "episodes",
      current: 0,
      total: workTotal,
      label: "Iniciando...",
    });

    const stats = await applyImportItems(
      parsed.items,
      async (progress) => {
        if (abortSignal.aborted) return;
        await updateImportJobProgress(jobId, progress);
      },
      { abortSignal, userId },
    );

    if (abortSignal.aborted) throw new ImportCancelledError();

    await updateImportJobProgress(jobId, {
      phase: "status",
      current: workTotal,
      total: workTotal,
      label: "Finishing...",
    });

    if (stats.episodesAdded <= 500) {
      await cleanupSuspiciousImportWatches({ maxWatches: 2, userId }).catch(() => undefined);
    }
    invalidateLibraryCache();

    const log = await prisma.importLog.create({
      data: {
        userId,
        source: `tvtime-${parsed.format}`,
        showsAdded: stats.showsAdded,
        episodesAdded: stats.episodesAdded,
        episodesSkipped: stats.episodesSkipped,
        errors: stats.errors,
        details: JSON.stringify({
          filesProcessed: parsed.filesProcessed,
          totalItems: parsed.items.length,
          errorMessages: stats.errorMessages.slice(0, 100),
          failures: stats.failures,
          jobId,
          contentHash: options?.contentHash ?? null,
          differential: true,
        }),
        addedShows: {
          create: stats.addedShows.map((s) => ({
            tmdbId: s.tmdbId,
            title: s.title,
            posterPath: s.posterPath,
            episodesAdded: s.episodesAdded,
            isNew: s.isNew,
          })),
        },
      },
    });

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        phase: "complete",
        importLogId: log.id,
        statsJson: JSON.stringify(stats),
        label: "Import complete",
        updatedAt: new Date(),
      },
    });

    return { logId: log.id, stats };
  } catch (err) {
    if (err instanceof ImportCancelledError) {
      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: "CANCELLED",
          phase: "complete",
          label: "Import cancelled",
          error: null,
          updatedAt: new Date(),
        },
      });
      invalidateLibraryCache();
      return { logId: null, stats: null, cancelled: true as const };
    }
    const message = err instanceof Error ? err.message : "Import failed";
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: message,
        updatedAt: new Date(),
      },
    });
    throw err;
  } finally {
    await flushImportJobProgress(jobId).catch(() => undefined);
    unregisterImportJobAbort(jobId);
    setTmdbImportMode(false);
  }
}

export function serializeImportJob(job: {
  id: string;
  status: ImportJobStatus;
  phase: string;
  current: number;
  total: number;
  label: string | null;
  format: string | null;
  filesProcessed: string | null;
  importLogId: string | null;
  error: string | null;
  statsJson: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  let stats: ImportStats | null = null;
  if (job.statsJson) {
    try {
      stats = JSON.parse(job.statsJson) as ImportStats;
    } catch {
      stats = null;
    }
  }

  return {
    id: job.id,
    status: job.status,
    phase: job.phase,
    current: job.current,
    total: job.total,
    label: job.label,
    format: job.format,
    filesProcessed: job.filesProcessed ? (JSON.parse(job.filesProcessed) as string[]) : [],
    importLogId: job.importLogId,
    error: job.error,
    stats,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export async function getImportJob(id: string) {
  const userId = await requireUserId();
  const job = await prisma.importJob.findFirst({ where: { id, userId } });
  if (!job) return null;
  return serializeImportJob(job);
}

export async function getActiveImportJob() {
  const userId = await requireUserId();
  const staleBefore = new Date(Date.now() - 45 * 60 * 1000);
  await prisma.importJob
    .updateMany({
      where: {
        userId,
        status: "RUNNING",
        updatedAt: { lt: staleBefore },
      },
      data: {
        status: "FAILED",
        error: "Import stopped (no progress)",
        phase: "complete",
      },
    })
    .catch(() => undefined);

  const job = await prisma.importJob.findFirst({
    where: { userId, status: "RUNNING" },
    orderBy: { createdAt: "desc" },
  });
  if (!job) return null;
  return serializeImportJob(job);
}

export async function getLatestImportJob() {
  const userId = await requireUserId();
  const job = await prisma.importJob.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!job) return null;
  return serializeImportJob(job);
}
