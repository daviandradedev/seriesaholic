import { prisma } from "@/lib/db";
import {
  classifyShowQueueBucket,
  classifyShowQueueBucketFromLibrary,
  isRegularSeason,
  isShowEnded,
  libraryStatusFromQueueBucket,
  type LibraryStatus,
  type QueueBucket,
} from "@/lib/domain-logic";
import { startOfDay, progressPercent, showPath } from "@/lib/utils";
import { getSeasonDetails, getShowDetails } from "@/lib/tmdb";
import { requireUserId } from "@/lib/session-user";
import type { ShowStatus } from "@prisma/client";

const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;

export type WatchQueueShow = {
  id: string;
  tmdbId: number | null;
  title: string;
  posterPath: string | null;
  status: ShowStatus;
  watchedCount: number;
  totalEpisodes: number;
  progress: number;
  unwatchedCount: number;
  recentUnwatchedCount: number;
  oldestUnwatchedAirDate: string | null;
  newestUnwatchedAirDate: string | null;
  tmdbStatus: string | null;
  href: string;
  updatedAt: string;
};

export type WatchQueue = {
  watchNext: WatchQueueShow[];
  backlog: WatchQueueShow[];
  upToDate: WatchQueueShow[];
  notStarted: WatchQueueShow[];
  finished: WatchQueueShow[];
  dropped: WatchQueueShow[];
};

export type GetWatchQueueOptions = {
  sync?: boolean;
  userId?: string;
};

type ShowRow = {
  id: string;
  tmdbId: number | null;
  title: string;
  posterPath: string | null;
  status: ShowStatus;
  tmdbStatus: string | null;
  isCustom: boolean;
  inWatchlist: boolean;
  totalEpisodes: number | null;
  unwatchedAiredCount: number | null;
  updatedAt: Date;
  episodes: Array<{
    seasonNumber?: number;
    episodeNumber?: number;
    watchedAt: Date | null;
  }>;
  seasons: Array<{
    seasonNumber: number;
    episodes: Array<{
      episodeNumber: number;
      airDate: string | null;
      runtimeMinutes?: number | null;
    }>;
  }>;
};

function toEntry(
  show: {
    id: string;
    tmdbId: number | null;
    title: string;
    posterPath: string | null;
    status: ShowStatus;
    tmdbStatus: string | null;
    updatedAt: Date | string;
  },
  watchedCount: number,
  totalEpisodes: number,
  unwatchedCount: number,
  recentUnwatchedCount: number,
  oldest: string | null,
  newest: string | null,
): WatchQueueShow {
  const updatedAt =
    show.updatedAt instanceof Date
      ? show.updatedAt.toISOString()
      : String(show.updatedAt);
  return {
    id: show.id,
    tmdbId: show.tmdbId,
    title: show.title,
    posterPath: show.posterPath,
    status: show.status,
    watchedCount,
    totalEpisodes,
    progress: progressPercent(watchedCount, totalEpisodes),
    unwatchedCount,
    recentUnwatchedCount,
    oldestUnwatchedAirDate: oldest,
    newestUnwatchedAirDate: newest,
    tmdbStatus: show.tmdbStatus,
    href: showPath(show),
    updatedAt,
  };
}

async function mapPool<T, R>(
  items: T[],
  fn: (item: T) => Promise<R | null>,
  concurrency = 5,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(fn));
    for (const r of chunkResults) {
      if (r) results.push(r);
    }
  }
  return results;
}

function resolveTotalEpisodes(show: ShowRow, computedCustomTotal: number) {
  if (show.isCustom || show.tmdbId == null) return computedCustomTotal;
  return show.totalEpisodes ?? 0;
}

function analyzeShowLocal(
  show: ShowRow,
  cutoff: Date,
  today: Date,
): { entry: WatchQueueShow; bucket: QueueBucket } | null {
  const regularWatches = show.episodes.filter(
    (e) => e.seasonNumber == null || isRegularSeason(e.seasonNumber),
  );
  const watchedRecently = regularWatches.some(
    (e) => e.watchedAt && e.watchedAt >= cutoff,
  );
  const watchedCount = regularWatches.length;

  if (show.status === "COMPLETED" && watchedCount > 0) {
    const totalEpisodes = resolveTotalEpisodes(show, watchedCount);
    return {
      bucket: "finished",
      entry: toEntry(show, watchedCount, totalEpisodes, 0, 0, null, null),
    };
  }

  if (show.isCustom || show.tmdbId == null) {
    const watched = new Set(
      regularWatches
        .filter((e) => e.seasonNumber != null && e.episodeNumber != null)
        .map((e) => `${e.seasonNumber}-${e.episodeNumber}`),
    );
    const unwatchedAired: Date[] = [];
    let totalEpisodes = 0;
    for (const season of show.seasons) {
      if (!isRegularSeason(season.seasonNumber)) continue;
      for (const ep of season.episodes) {
        totalEpisodes++;
        if (!ep.airDate) continue;
        const air = startOfDay(new Date(ep.airDate));
        if (Number.isNaN(air.getTime()) || air > today) continue;
        const key = `${season.seasonNumber}-${ep.episodeNumber}`;
        if (!watched.has(key)) unwatchedAired.push(air);
      }
    }
    const tmdbStatus =
      show.tmdbStatus ??
      (unwatchedAired.length === 0 ? "Ended" : "Returning Series");
    const recentUnwatched = unwatchedAired.filter((d) => d >= cutoff);
    const sorted = [...unwatchedAired].sort((a, b) => a.getTime() - b.getTime());
    const bucket = classifyShowQueueBucket({
      isDropped: show.status === "DROPPED",
      watchedCount,
      unwatchedAiredCount: unwatchedAired.length,
      recentUnwatchedCount: recentUnwatched.length,
      watchedRecently,
      tmdbStatus,
      inWatchlist: show.inWatchlist,
      totalEpisodes: resolveTotalEpisodes(show, totalEpisodes),
      status: show.status as LibraryStatus,
    });
    if (!bucket) return null;
    void prisma.show
      .update({
        where: { id: show.id },
        data: { unwatchedAiredCount: unwatchedAired.length },
      })
      .catch(() => undefined);
    return {
      bucket,
      entry: toEntry(
        { ...show, tmdbStatus },
        watchedCount,
        totalEpisodes,
        unwatchedAired.length,
        recentUnwatched.length,
        sorted[0]?.toISOString().slice(0, 10) ?? null,
        sorted[sorted.length - 1]?.toISOString().slice(0, 10) ?? null,
      ),
    };
  }

  const totalEpisodes = resolveTotalEpisodes(show, watchedCount);
  const locallyComplete = totalEpisodes > 0 && watchedCount >= totalEpisodes;
  const effectiveUnwatched = locallyComplete ? 0 : show.unwatchedAiredCount;

  const bucket = classifyShowQueueBucketFromLibrary({
    isDropped: show.status === "DROPPED",
    watchedCount,
    watchedRecently,
    status: show.status as LibraryStatus,
    tmdbStatus: show.tmdbStatus,
    inWatchlist: show.inWatchlist,
    totalEpisodes: totalEpisodes || undefined,
    unwatchedAiredCount: effectiveUnwatched,
  });
  if (!bucket) return null;

  return {
    bucket,
    entry: toEntry(
      show,
      watchedCount,
      totalEpisodes,
      effectiveUnwatched ?? 0,
      0,
      null,
      null,
    ),
  };
}

async function analyzeShowDeep(
  show: ShowRow,
  cutoff: Date,
  today: Date,
  sync: boolean,
): Promise<{ entry: WatchQueueShow; bucket: QueueBucket } | null> {
  const regularWatches = show.episodes.filter(
    (e) => e.seasonNumber == null || isRegularSeason(e.seasonNumber),
  );
  const watched = new Set(
    regularWatches
      .filter((e) => e.seasonNumber != null && e.episodeNumber != null)
      .map((e) => `${e.seasonNumber}-${e.episodeNumber}`),
  );
  const watchedRecently = regularWatches.some(
    (e) => e.watchedAt && e.watchedAt >= cutoff,
  );

  if (show.isCustom || show.tmdbId == null) {
    return analyzeShowLocal(show, cutoff, today);
  }

  const unwatchedAired: Date[] = [];
  let totalEpisodes = 0;
  let tmdbStatus = show.tmdbStatus;

  try {
    const details = await getShowDetails(show.tmdbId);
    totalEpisodes = details.number_of_episodes;
    tmdbStatus = details.status || tmdbStatus;

    if (sync && (!show.tmdbStatus || show.tmdbStatus !== details.status)) {
      await prisma.show
        .update({
          where: { id: show.id },
          data: {
            tmdbStatus: details.status,
            totalEpisodes: details.number_of_episodes,
          },
        })
        .catch(() => undefined);
    } else if (!sync) {
      await prisma.show
        .update({
          where: { id: show.id },
          data: {
            totalEpisodes: details.number_of_episodes,
            tmdbStatus: details.status || tmdbStatus,
          },
        })
        .catch(() => undefined);
    }

    for (let s = 1; s <= details.number_of_seasons; s++) {
      let season;
      try {
        season = await getSeasonDetails(show.tmdbId, s);
      } catch {
        continue;
      }
      for (const ep of season.episodes) {
        if (!ep.air_date) continue;
        const air = startOfDay(new Date(ep.air_date));
        if (air > today) continue;
        const key = `${ep.season_number}-${ep.episode_number}`;
        if (!watched.has(key)) unwatchedAired.push(air);
      }
    }
  } catch {
    totalEpisodes = regularWatches.length;
  }

  const recentUnwatched = unwatchedAired.filter((d) => d >= cutoff);
  const sorted = [...unwatchedAired].sort((a, b) => a.getTime() - b.getTime());
  const watchedCount = regularWatches.length;

  let pendingAired = unwatchedAired.length;
  const catalogComplete = totalEpisodes > 0 && watchedCount >= totalEpisodes;
  if (catalogComplete && isShowEnded(tmdbStatus)) {
    pendingAired = 0;
  }

  const bucket = classifyShowQueueBucket({
    isDropped: show.status === "DROPPED",
    watchedCount,
    unwatchedAiredCount: pendingAired,
    recentUnwatchedCount: recentUnwatched.length,
    watchedRecently,
    tmdbStatus,
    inWatchlist: show.inWatchlist,
    totalEpisodes,
    status: show.status as LibraryStatus,
  });

  if (!bucket) return null;

  const cachePending =
    catalogComplete && isShowEnded(tmdbStatus) ? 0 : unwatchedAired.length;
  if (show.unwatchedAiredCount !== cachePending) {
    await prisma.show
      .update({
        where: { id: show.id },
        data: { unwatchedAiredCount: cachePending, totalEpisodes },
      })
      .catch(() => undefined);
  }

  if (sync) {
    const nextStatus = libraryStatusFromQueueBucket(
      bucket,
      show.status as LibraryStatus,
    );
    if (nextStatus && nextStatus !== show.status) {
      await prisma.show
        .update({ where: { id: show.id }, data: { status: nextStatus } })
        .catch(() => undefined);
      show.status = nextStatus;
    }
  }

  return {
    bucket,
    entry: toEntry(
      { ...show, tmdbStatus },
      watchedCount,
      totalEpisodes,
      cachePending,
      recentUnwatched.length,
      sorted[0]?.toISOString().slice(0, 10) ?? null,
      sorted[sorted.length - 1]?.toISOString().slice(0, 10) ?? null,
    ),
  };
}

export async function recomputeShowAiredPending(showId: string) {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
      tmdbId: true,
      tmdbStatus: true,
      episodes: {
        where: { watched: true, seasonNumber: { gte: 1 } },
        select: { seasonNumber: true, episodeNumber: true },
      },
    },
  });
  if (!show?.tmdbId) return;

  const today = startOfDay(new Date());
  const watched = new Set(
    show.episodes.map((e) => `${e.seasonNumber}-${e.episodeNumber}`),
  );
  const unwatchedAired: Date[] = [];
  let totalEpisodes = 0;
  let tmdbStatus = show.tmdbStatus;

  try {
    const details = await getShowDetails(show.tmdbId);
    totalEpisodes = details.number_of_episodes;
    tmdbStatus = details.status || tmdbStatus;

    for (let s = 1; s <= details.number_of_seasons; s++) {
      let season;
      try {
        season = await getSeasonDetails(show.tmdbId, s);
      } catch {
        continue;
      }
      for (const ep of season.episodes) {
        if (!ep.air_date) continue;
        const air = startOfDay(new Date(ep.air_date));
        if (air > today) continue;
        const key = `${ep.season_number}-${ep.episode_number}`;
        if (!watched.has(key)) unwatchedAired.push(air);
      }
    }
  } catch {
    return;
  }

  const watchedCount = show.episodes.length;
  let pending = unwatchedAired.length;
  if (
    totalEpisodes > 0 &&
    watchedCount >= totalEpisodes &&
    isShowEnded(tmdbStatus)
  ) {
    pending = 0;
  }

  await prisma.show.update({
    where: { id: showId },
    data: {
      unwatchedAiredCount: pending,
      totalEpisodes,
      tmdbStatus,
    },
  });
}

function emptyQueue(): WatchQueue {
  return {
    watchNext: [],
    backlog: [],
    upToDate: [],
    notStarted: [],
    finished: [],
    dropped: [],
  };
}

function sortQueue(queue: WatchQueue) {
  queue.watchNext.sort((a, b) =>
    (b.newestUnwatchedAirDate ?? "").localeCompare(a.newestUnwatchedAirDate ?? ""),
  );
  queue.backlog.sort((a, b) =>
    (a.oldestUnwatchedAirDate ?? "").localeCompare(b.oldestUnwatchedAirDate ?? ""),
  );
  queue.finished.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return queue;
}

async function loadShowsForFastQueue(userId: string): Promise<ShowRow[]> {
  const [catalogShows, customShows] = await Promise.all([
    prisma.show.findMany({
      where: { userId, isCustom: false, tmdbId: { not: null } },
      select: {
        id: true,
        tmdbId: true,
        title: true,
        posterPath: true,
        status: true,
        tmdbStatus: true,
        isCustom: true,
        inWatchlist: true,
        updatedAt: true,
        totalEpisodes: true,
        unwatchedAiredCount: true,
        episodes: {
          where: { watched: true, seasonNumber: { gte: 1 } },
          select: { watchedAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.show.findMany({
      where: { userId, OR: [{ isCustom: true }, { tmdbId: null }] },
      select: {
        id: true,
        tmdbId: true,
        title: true,
        posterPath: true,
        status: true,
        tmdbStatus: true,
        isCustom: true,
        inWatchlist: true,
        updatedAt: true,
        totalEpisodes: true,
        unwatchedAiredCount: true,
        episodes: {
          where: { watched: true, seasonNumber: { gte: 1 } },
          select: { seasonNumber: true, episodeNumber: true, watchedAt: true },
        },
        seasons: {
          where: { seasonNumber: { gte: 1 } },
          select: {
            seasonNumber: true,
            episodes: { select: { episodeNumber: true, airDate: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return [
    ...catalogShows.map((s) => ({ ...s, seasons: [] as ShowRow["seasons"] })),
    ...customShows,
  ];
}

export async function getWatchQueue(
  options?: GetWatchQueueOptions,
): Promise<WatchQueue> {
  const userId = options?.userId ?? (await requireUserId());
  const sync = options?.sync === true;
  const today = startOfDay(new Date());
  const cutoff = new Date(today.getTime() - TWO_MONTHS_MS);
  const queue = emptyQueue();

  if (!sync) {
    const shows = await loadShowsForFastQueue(userId);
    for (const show of shows) {
      const item = analyzeShowLocal(show, cutoff, today);
      if (!item) continue;
      queue[item.bucket].push(item.entry);
    }
    return sortQueue(queue);
  }

  await prisma.episodeWatch
    .deleteMany({ where: { seasonNumber: { lt: 1 }, show: { userId } } })
    .catch(() => 0);

  const shows = await prisma.show.findMany({
    where: { userId },
    include: {
      episodes: {
        where: { watched: true, seasonNumber: { gte: 1 } },
        select: { seasonNumber: true, episodeNumber: true, watchedAt: true },
      },
      seasons: {
        include: {
          episodes: {
            select: {
              episodeNumber: true,
              airDate: true,
              runtimeMinutes: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const analyzed = await mapPool(
    shows,
    (show) => analyzeShowDeep(show, cutoff, today, true),
    2,
  );

  for (const item of analyzed) {
    if (!item) continue;
    queue[item.bucket].push(item.entry);
  }

  return sortQueue(queue);
}

export async function syncWatchQueueStatuses() {
  return getWatchQueue({ sync: true });
}
