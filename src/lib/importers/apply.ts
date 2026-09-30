import { prisma } from "@/lib/db";
import {
  clearResolveCache,
  getShowDetails,
  parseTitleYear,
  resolveShowFromExternalIds,
} from "@/lib/tmdb";
import type {
  ImportFailedEpisode,
  ImportFailureGroup,
  ImportItem,
  ImportLogShowEntry,
  ImportProgressEvent,
  ImportStats,
} from "@/lib/importers/types";
import { ImportCancelledError } from "@/lib/importers/errors";
import type { ShowStatus } from "@prisma/client";
import { genresFromTmdb } from "@/lib/genres";
import { randomUUID } from "crypto";
import { requireUserId } from "@/lib/session-user";

export function importItemKey(item: Pick<ImportItem, "ids" | "title">) {
  const showTvdb = item.ids.showTvdb ?? item.ids.tvdb;
  const title = item.title ? parseTitleYear(item.title).name.toLowerCase() : "";
  return `${showTvdb ?? ""}-${item.ids.imdb ?? ""}-${title}`;
}

export function episodeWatchKey(showId: string, season: number, episode: number) {
  return `${showId}:${season}:${episode}`;
}

type LocalShow = {
  id: string;
  tmdbId: number | null;
  tvdbId: number | null;
  imdbId: string | null;
  title: string;
  posterPath: string | null;
  status: ShowStatus;
  inWatchlist: boolean;
  userRating: number | null;
};

function indexLocalShows(shows: LocalShow[]) {
  const byTvdb = new Map<number, LocalShow>();
  const byImdb = new Map<string, LocalShow>();
  const byTmdb = new Map<number, LocalShow>();

  for (const show of shows) {
    if (show.tvdbId != null) byTvdb.set(show.tvdbId, show);
    if (show.imdbId) byImdb.set(show.imdbId, show);
    if (show.tmdbId != null) byTmdb.set(show.tmdbId, show);
  }

  return { byTvdb, byImdb, byTmdb };
}

export function findLocalShow(
  ids: ImportItem["ids"],
  index: ReturnType<typeof indexLocalShows>,
): LocalShow | null {
  const tvdb = ids.showTvdb ?? ids.tvdb;
  if (tvdb != null) {
    const hit = index.byTvdb.get(tvdb);
    if (hit) return hit;
  }
  if (ids.imdb) {
    const hit = index.byImdb.get(ids.imdb);
    if (hit) return hit;
  }
  if (ids.tmdb != null) {
    const hit = index.byTmdb.get(ids.tmdb);
    if (hit) return hit;
  }
  return null;
}

async function upsertShowFromTmdb(
  tmdbId: number,
  existing: LocalShow | null,
  userId: string,
  extras?: {
    inWatchlist?: boolean;
    userRating?: number;
    status?: ShowStatus;
  },
  signal?: AbortSignal,
) {
  const details = await getShowDetails(tmdbId, signal);
  const external = details.external_ids;
  const meta = genresFromTmdb(details);

  if (existing) {
    return prisma.show.update({
      where: { id: existing.id },
      data: {
        tvdbId: external?.tvdb_id ?? undefined,
        imdbId: external?.imdb_id ?? undefined,
        title: details.name,
        overview: details.overview,
        posterPath: details.poster_path,
        backdropPath: details.backdrop_path,
        firstAirDate: details.first_air_date,
        totalEpisodes: details.number_of_episodes,
        ...meta,
        userRating: existing.userRating ?? extras?.userRating ?? undefined,
        inWatchlist: extras?.inWatchlist ? true : existing.inWatchlist,
        status:
          extras?.status === "DROPPED"
            ? "DROPPED"
            : extras?.status === "PLAN_TO_WATCH" && existing.status === "PLAN_TO_WATCH"
              ? "PLAN_TO_WATCH"
              : existing.status,
      },
    });
  }

  const status = extras?.status ?? "PLAN_TO_WATCH";

  return prisma.show.create({
    data: {
      userId,
      tmdbId,
      tvdbId: external?.tvdb_id ?? null,
      imdbId: external?.imdb_id ?? null,
      title: details.name,
      overview: details.overview,
      posterPath: details.poster_path,
      backdropPath: details.backdrop_path,
      firstAirDate: details.first_air_date,
      totalEpisodes: details.number_of_episodes,
      ...meta,
      inWatchlist: extras?.inWatchlist ?? false,
      userRating: extras?.userRating ?? null,
      status,
    },
  });
}

export function countImportWork(items: ImportItem[]) {
  const showCache = new Set<string>();
  const watchlistShows = new Set<string>();
  const droppedShows = new Set<string>();

  for (const item of items) {
    if (item.action === "watchlist" && item.type === "show") {
      watchlistShows.add(importItemKey(item));
    }
    if (item.action === "dropped" && item.type === "show") {
      droppedShows.add(importItemKey(item));
    }
  }

  const episodeItems = items.filter(
    (i) => i.action === "history" && i.type === "episode",
  );

  for (const item of episodeItems) {
    showCache.add(importItemKey(item));
  }

  const watchlistOnly = [...watchlistShows].filter((key) => !showCache.has(key)).length;
  const droppedOnly = [...droppedShows].filter((key) => !showCache.has(key)).length;

  return {
    episodeItems,
    watchlistOnly,
    droppedOnly,
    total: episodeItems.length + watchlistOnly + droppedOnly,
  };
}

export async function applyImportItems(
  items: ImportItem[],
  onProgress?: (event: ImportProgressEvent) => void | Promise<void>,
  options?: { abortSignal?: AbortSignal; userId?: string },
): Promise<ImportStats> {
  clearResolveCache();
  const userId = options?.userId ?? (await requireUserId());
  items = items.filter((i) => i.type !== "movie");

  const stats: ImportStats = {
    showsAdded: 0,
    showsUpdated: 0,
    episodesAdded: 0,
    episodesSkipped: 0,
    errors: 0,
    errorMessages: [],
    addedShows: [],
    failures: [],
  };

  const showCache = new Map<string, string>();
  const showTmdbById = new Map<string, number | null>();
  const showRatings = new Map<string, number>();
  const watchlistShows = new Set<string>();
  const droppedShows = new Set<string>();
  const failedShows = new Set<string>();
  const failureGroups = new Map<string, ImportFailureGroup>();
  const importShowMap = new Map<number, ImportLogShowEntry>();
  const createdThisImport = new Set<string>();
  const { abortSignal } = options ?? {};

  function throwIfCancelled() {
    if (abortSignal?.aborted) throw new ImportCancelledError();
  }

  function pushFailureEpisode(
    groupKey: string,
    item: ImportItem,
    reason: ImportFailureGroup["reason"],
    message: string,
  ) {
    const title = item.title?.trim() || "Untitled show";
    let group = failureGroups.get(groupKey);
    if (!group) {
      group = {
        id: randomUUID(),
        groupKey,
        title,
        message,
        reason,
        ids: { ...item.ids },
        episodes: [],
      };
      failureGroups.set(groupKey, group);
      stats.errors++;
    }

    if (item.season != null && item.episode != null && item.season >= 1) {
      const line = `Import failed for "${title}" episode S${item.season}E${item.episode}: ${message}`;
      const already = group.episodes.some(
        (e) => e.season === item.season && e.episode === item.episode,
      );
      if (!already) {
        const ep: ImportFailedEpisode = {
          season: item.season,
          episode: item.episode,
          watchedAt: item.watchedAt,
          episodeTvdb: item.ids.episodeTvdb,
          line,
        };
        group.episodes.push(ep);
        if (!stats.errorMessages.includes(line)) stats.errorMessages.push(line);
      }
    } else {
      const line = `Import failed for "${title}": ${message}`;
      if (!stats.errorMessages.includes(line)) stats.errorMessages.push(line);
    }
  }

  for (const item of items) {
    if (item.action === "watchlist" && item.type === "show") {
      watchlistShows.add(importItemKey(item));
    }
    if (item.action === "dropped" && item.type === "show") {
      droppedShows.add(importItemKey(item));
    }
    if (item.action === "ratings" && item.type === "show") {
      const key = importItemKey(item);
      if (item.rating != null) showRatings.set(key, item.rating);
    }
  }

  const libraryShows = await prisma.show.findMany({
    where: { userId },
    select: {
      id: true,
      tmdbId: true,
      tvdbId: true,
      imdbId: true,
      title: true,
      posterPath: true,
      status: true,
      inWatchlist: true,
      userRating: true,
    },
  });
  const localIndex = indexLocalShows(libraryShows);
  for (const show of libraryShows) {
    showTmdbById.set(show.id, show.tmdbId);
  }

  const existingWatches = await prisma.episodeWatch.findMany({
    where: { watched: true, seasonNumber: { gte: 1 }, show: { userId } },
    select: { showId: true, seasonNumber: true, episodeNumber: true },
  });
  const watchedKeys = new Set(
    existingWatches.map((w) =>
      episodeWatchKey(w.showId, w.seasonNumber, w.episodeNumber),
    ),
  );

  throwIfCancelled();

  const { episodeItems, watchlistOnly, droppedOnly } = countImportWork(items);
  const total = episodeItems.length + watchlistOnly + droppedOnly;
  let current = 0;
  let lastReportAt = 0;
  let lastReportCurrent = -1;

  const report = async (phase: ImportProgressEvent["phase"], label?: string) => {
    const now = Date.now();
    const terminal =
      phase === "complete" ||
      phase === "watchlist" ||
      phase === "dropped" ||
      phase === "status" ||
      phase === "parsing";
    const reportEvery = total > 5000 ? 120 : total > 2000 ? 80 : 40;
    const reportMinMs = total > 5000 ? 5000 : total > 2000 ? 3500 : 2500;
    if (
      !terminal &&
      current - lastReportCurrent < reportEvery &&
      now - lastReportAt < reportMinMs
    ) {
      return;
    }
    lastReportAt = now;
    lastReportCurrent = current;
    await onProgress?.({ phase, current, total, label });
  };

  const EPISODE_BATCH_SIZE = 250;
  type PendingWatch = {
    showId: string;
    cacheKey: string;
    season: number;
    episode: number;
    tvdbId: number | null;
    watchedAt: Date;
    rating: number | null;
  };
  const pendingWatches: PendingWatch[] = [];
  const showsToMarkWatching = new Set<string>();

  async function flushEpisodeBatch() {
    if (pendingWatches.length === 0) return;
    throwIfCancelled();

    const batch = pendingWatches.splice(0, pendingWatches.length);
    await prisma.episodeWatch.createMany({
      data: batch.map((w) => ({
        showId: w.showId,
        seasonNumber: w.season,
        episodeNumber: w.episode,
        tvdbId: w.tvdbId,
        watched: true,
        watchedAt: w.watchedAt,
        rating: w.rating,
        runtimeMinutes: null,
      })),
      skipDuplicates: true,
    });

    if (showsToMarkWatching.size > 0) {
      const ids = [...showsToMarkWatching];
      showsToMarkWatching.clear();
      await prisma.show.updateMany({
        where: { id: { in: ids }, status: { not: "DROPPED" } },
        data: { status: "WATCHING", inWatchlist: false },
      });
    }
  }

  function trackShow(
    tmdbId: number,
    title: string,
    posterPath: string | null,
    isNew: boolean,
    episodesDelta = 0,
  ) {
    const existing = importShowMap.get(tmdbId);
    if (existing) {
      existing.episodesAdded += episodesDelta;
      if (isNew) existing.isNew = true;
    } else {
      importShowMap.set(tmdbId, {
        tmdbId,
        title,
        posterPath,
        episodesAdded: episodesDelta,
        isNew,
      });
    }
  }

  function rememberShow(
    cacheKey: string,
    show: { id: string; tmdbId: number | null; title: string; posterPath: string | null },
    isNew: boolean,
  ) {
    showCache.set(cacheKey, show.id);
    showTmdbById.set(show.id, show.tmdbId);
    if (show.tmdbId != null) {
      trackShow(show.tmdbId, show.title, show.posterPath, isNew);
    }
  }

  await report("episodes", "Starting episode import...");

  for (const item of episodeItems) {
    try {
      throwIfCancelled();
      const cacheKey = importItemKey(item);
      let showId = showCache.get(cacheKey);

      if (!showId) {
        if (failedShows.has(cacheKey)) {
          pushFailureEpisode(
            cacheKey,
            item,
            "show_not_found",
            "Show not found on TMDB (already failed in this import)",
          );
          current++;
          await report("episodes", item.title);
          continue;
        }

        const local = findLocalShow(item.ids, localIndex);
        if (local) {
          rememberShow(cacheKey, local, false);
          showId = local.id;
        } else {
          const tmdbShow = await resolveShowFromExternalIds(
            {
              showTvdb: item.ids.showTvdb ?? item.ids.tvdb,
              episodeTvdb: item.ids.episodeTvdb,
              imdb: item.ids.imdb,
              title: item.title,
            },
            abortSignal,
          );

          if (!tmdbShow) {
            failedShows.add(cacheKey);
            pushFailureEpisode(
              cacheKey,
              item,
              "show_not_found",
              "Show not found on TMDB. Link it to an existing show or create a new one",
            );
            current++;
            await report("episodes", item.title);
            continue;
          }

          const existing = localIndex.byTmdb.get(tmdbShow.id) ?? null;
          const show = await upsertShowFromTmdb(
            tmdbShow.id,
            existing,
            userId,
            {
              inWatchlist: watchlistShows.has(cacheKey),
              userRating: showRatings.get(cacheKey),
              status: droppedShows.has(cacheKey)
                ? "DROPPED"
                : "PLAN_TO_WATCH",
            },
            abortSignal,
          );

          if (existing) stats.showsUpdated++;
          else {
            stats.showsAdded++;
            createdThisImport.add(show.id);
            const asLocal: LocalShow = {
              id: show.id,
              tmdbId: show.tmdbId,
              tvdbId: show.tvdbId,
              imdbId: show.imdbId,
              title: show.title,
              posterPath: show.posterPath,
              status: show.status,
              inWatchlist: show.inWatchlist,
              userRating: show.userRating,
            };
            if (asLocal.tmdbId != null) localIndex.byTmdb.set(asLocal.tmdbId, asLocal);
            if (asLocal.tvdbId != null) localIndex.byTvdb.set(asLocal.tvdbId, asLocal);
            if (asLocal.imdbId) localIndex.byImdb.set(asLocal.imdbId, asLocal);
          }

          rememberShow(cacheKey, show, !existing);
          showId = show.id;
        }
      }

      if (item.season == null || item.episode == null) {
        current++;
        await report("episodes", item.title);
        continue;
      }

      if (item.season < 1) {
        stats.episodesSkipped++;
        current++;
        await report("episodes", item.title);
        continue;
      }

      const watchKey = episodeWatchKey(showId, item.season, item.episode);
      if (watchedKeys.has(watchKey)) {
        stats.episodesSkipped++;
        current++;
        await report(
          "episodes",
          item.title
            ? `${item.title} S${item.season}E${item.episode}`
            : undefined,
        );
        continue;
      }

      const tmdbId = showTmdbById.get(showId) ?? null;

      throwIfCancelled();

      pendingWatches.push({
        showId,
        cacheKey,
        season: item.season,
        episode: item.episode,
        tvdbId: item.ids.episodeTvdb ?? null,
        watchedAt: item.watchedAt ? new Date(item.watchedAt) : new Date(),
        rating: item.rating ?? null,
      });

      if (!droppedShows.has(cacheKey)) {
        showsToMarkWatching.add(showId);
      }

      if (pendingWatches.length >= EPISODE_BATCH_SIZE) {
        await flushEpisodeBatch();
      }

      watchedKeys.add(watchKey);
      stats.episodesAdded++;
      if (tmdbId != null) {
        const entry = importShowMap.get(tmdbId);
        if (entry) entry.episodesAdded++;
      }
    } catch (err) {
      if (err instanceof ImportCancelledError || abortSignal?.aborted) {
        throw new ImportCancelledError();
      }
      const cacheKey = importItemKey(item);
      pushFailureEpisode(
        cacheKey,
        item,
        "episode_error",
        err instanceof Error ? err.message : String(err),
      );
    }

    current++;
    await report(
      "episodes",
      item.title
        ? `${item.title} S${item.season ?? "?"}E${item.episode ?? "?"}`
        : undefined,
    );
  }

  await flushEpisodeBatch();

  async function importShowList(
    keys: string[],
    phase: "watchlist" | "dropped",
    opts: { inWatchlist?: boolean; status?: ShowStatus },
  ) {
    if (keys.length === 0) return;
    await report(phase, phase === "dropped" ? "Importing dropped shows..." : undefined);

    for (const key of keys) {
      throwIfCancelled();
      const item = items.find(
        (i) =>
          i.type === "show" &&
          i.action === (phase === "dropped" ? "dropped" : "watchlist") &&
          importItemKey(i) === key,
      );
      if (!item) {
        current++;
        await report(phase, undefined);
        continue;
      }

      try {
        let showId = showCache.get(key);

        if (!showId) {
          const local = findLocalShow(item.ids, localIndex);
          if (local) {
            const patch: { inWatchlist?: boolean; status?: ShowStatus; userRating?: number } = {};
            if (opts.inWatchlist && !local.inWatchlist) patch.inWatchlist = true;
            if (opts.status === "DROPPED" && local.status !== "DROPPED") {
              patch.status = "DROPPED";
            }
            const rating = showRatings.get(key);
            if (rating != null && local.userRating == null) patch.userRating = rating;

            let show = local;
            if (Object.keys(patch).length > 0) {
              show = await prisma.show.update({ where: { id: local.id }, data: patch });
              stats.showsUpdated++;
            }
            rememberShow(key, show, false);
            showId = show.id;
          } else {
            const tmdbShow = await resolveShowFromExternalIds(
              {
                showTvdb: item.ids.showTvdb ?? item.ids.tvdb,
                episodeTvdb: item.ids.episodeTvdb,
                imdb: item.ids.imdb,
                title: item.title,
              },
              abortSignal,
            );

            if (!tmdbShow) {
              failedShows.add(key);
              pushFailureEpisode(
                key,
                item,
                "watchlist_not_found",
                phase === "dropped"
                  ? "Dropped show not found on TMDB"
                  : "Watchlist show not found on TMDB",
              );
            } else {
              const existing = localIndex.byTmdb.get(tmdbShow.id) ?? null;
              const show = await upsertShowFromTmdb(
                tmdbShow.id,
                existing,
                userId,
                {
                  inWatchlist: opts.inWatchlist,
                  userRating: showRatings.get(key),
                  status: opts.status,
                },
                abortSignal,
              );

              if (existing) stats.showsUpdated++;
              else stats.showsAdded++;

              rememberShow(key, show, !existing);
              showId = show.id;
            }
          }
        } else if (opts.status === "DROPPED") {
          await prisma.show.update({
            where: { id: showId },
            data: { status: "DROPPED" },
          });
        }
      } catch (err) {
        if (err instanceof ImportCancelledError || abortSignal?.aborted) {
          throw new ImportCancelledError();
        }
        pushFailureEpisode(
          key,
          item,
          "watchlist_not_found",
          err instanceof Error ? err.message : String(err),
        );
      }

      current++;
      await report(phase, item.title);
    }
  }

  const watchlistKeys = [...watchlistShows].filter((key) => !showCache.has(key));
  throwIfCancelled();
  await importShowList(watchlistKeys, "watchlist", {
    inWatchlist: true,
    status: "PLAN_TO_WATCH",
  });

  const droppedKeys = [...droppedShows].filter((key) => !showCache.has(key));
  throwIfCancelled();
  await importShowList(droppedKeys, "dropped", { status: "DROPPED" });

  for (const showId of createdThisImport) {
    throwIfCancelled();
    const hasWatch = [...watchedKeys].some((k) => k.startsWith(`${showId}:`));
    if (hasWatch) continue;
    const keys = [...showCache.entries()]
      .filter(([, id]) => id === showId)
      .map(([k]) => k);
    if (keys.some((k) => watchlistShows.has(k) || droppedShows.has(k))) continue;
    const tmdbId = showTmdbById.get(showId);
    await prisma.show.delete({ where: { id: showId } }).catch(() => undefined);
    stats.showsAdded = Math.max(0, stats.showsAdded - 1);
    if (tmdbId != null) importShowMap.delete(tmdbId);
  }

  for (const key of droppedShows) {
    const showId = showCache.get(key);
    if (showId) {
      await prisma.show.update({
        where: { id: showId },
        data: { status: "DROPPED" },
      });
    }
  }

  stats.addedShows = [...importShowMap.values()];
  stats.failures = [...failureGroups.values()].map((g) => ({
    ...g,
    episodes: [...g.episodes].sort(
      (a, b) => a.season - b.season || a.episode - b.episode,
    ),
  }));
  await onProgress?.({
    phase: "complete",
    current: total,
    total,
    label: "Import complete",
  });

  return stats;
}
