import { prisma } from "@/lib/db";
import { addShowToLibrary, createCustomShow } from "@/lib/shows";
import { invalidateLibraryCache } from "@/lib/cache-tags";
import { requireUserId } from "@/lib/session-user";
import type { ImportFailedEpisode, ImportFailureGroup } from "@/lib/importers/types";

export type ImportLogDetails = {
  filesProcessed?: string[];
  totalItems?: number;
  errorMessages?: string[];
  failures?: ImportFailureGroup[];
  jobId?: string;
  contentHash?: string | null;
  differential?: boolean;
};

export function parseImportLogDetails(raw: string | null | undefined): ImportLogDetails {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ImportLogDetails;
  } catch {
    return {};
  }
}

export async function attachWatchedEpisodes(
  showId: string,
  episodes: ImportFailedEpisode[],
) {
  let added = 0;
  let skipped = 0;

  for (const ep of episodes) {
    if (ep.season < 1) {
      skipped++;
      continue;
    }
    const existing = await prisma.episodeWatch.findUnique({
      where: {
        showId_seasonNumber_episodeNumber: {
          showId,
          seasonNumber: ep.season,
          episodeNumber: ep.episode,
        },
      },
    });
    if (existing?.watched) {
      skipped++;
      continue;
    }

    await prisma.episodeWatch.upsert({
      where: {
        showId_seasonNumber_episodeNumber: {
          showId,
          seasonNumber: ep.season,
          episodeNumber: ep.episode,
        },
      },
      create: {
        showId,
        seasonNumber: ep.season,
        episodeNumber: ep.episode,
        tvdbId: ep.episodeTvdb ?? null,
        watched: true,
        watchedAt: ep.watchedAt ? new Date(ep.watchedAt) : new Date(),
      },
      update: {
        watched: true,
        watchedAt: ep.watchedAt ? new Date(ep.watchedAt) : new Date(),
      },
    });
    added++;
  }

  if (added > 0) {
    await prisma.show.update({
      where: { id: showId },
      data: { status: "WATCHING", inWatchlist: false, updatedAt: new Date() },
    });
  }

  invalidateLibraryCache();
  return { added, skipped };
}

function seasonsFromFailures(episodes: ImportFailedEpisode[]) {
  const bySeason = new Map<number, number[]>();
  for (const ep of episodes) {
    if (ep.season < 1) continue;
    const list = bySeason.get(ep.season) ?? [];
    if (!list.includes(ep.episode)) list.push(ep.episode);
    bySeason.set(ep.season, list);
  }

  return [...bySeason.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([seasonNumber, eps]) => ({
      seasonNumber,
      name: `Season ${seasonNumber}`,
      episodes: eps
        .sort((a, b) => a - b)
        .map((episodeNumber) => ({
          episodeNumber,
          name: `Episode ${episodeNumber}`,
        })),
    }));
}

export async function resolveImportFailure(input: {
  importLogId: string;
  failureId: string;
  mode: "link" | "create" | "tmdb";
  showId?: string;
  tmdbId?: number;
  title?: string;
}) {
  const userId = await requireUserId();
  const log = await prisma.importLog.findFirst({ where: { id: input.importLogId, userId } });
  if (!log) throw new Error("Import not found");

  const details = parseImportLogDetails(log.details);
  const failures = details.failures ?? [];
  const failure = failures.find((f) => f.id === input.failureId);
  if (!failure) throw new Error("Failure not found in this import");
  if (failure.resolved) throw new Error("This failure is already resolved");

  let showId: string;

  if (input.mode === "link") {
    if (!input.showId) throw new Error("showId is required to link");
    const show = await prisma.show.findFirst({ where: { id: input.showId, userId } });
    if (!show) throw new Error("Library show not found");
    showId = show.id;
  } else if (input.mode === "tmdb") {
    if (input.tmdbId == null) throw new Error("tmdbId is required");
    const show = await addShowToLibrary(input.tmdbId, false);
    showId = show.id;
  } else {
    const title = (input.title ?? failure.title).trim();
    if (!title) throw new Error("Title is required to create a show");
    const show = await createCustomShow({
      title,
      status: failure.episodes.length > 0 ? "WATCHING" : "PLAN_TO_WATCH",
      seasons: seasonsFromFailures(failure.episodes),
      tmdbStatus: "Returning Series",
    });
    showId = show.id;
  }

  const attach =
    failure.episodes.length > 0
      ? await attachWatchedEpisodes(showId, failure.episodes)
      : { added: 0, skipped: 0 };

  if (failure.reason === "watchlist_not_found" && attach.added === 0) {
    await prisma.show.update({
      where: { id: showId },
      data: { inWatchlist: true, status: "PLAN_TO_WATCH" },
    });
  }

  failure.resolved = true;
  details.failures = failures;

  await prisma.importLog.update({
    where: { id: log.id },
    data: {
      details: JSON.stringify(details),
      errors: Math.max(0, log.errors - 1),
    },
  });

  invalidateLibraryCache();

  return {
    showId,
    failure,
    episodesAdded: attach.added,
    episodesSkipped: attach.skipped,
  };
}
