import { prisma } from "@/lib/db";
import { isShowEnded } from "@/lib/domain-logic";
import { invalidateLibraryCache } from "@/lib/cache-tags";
import { requireUserId } from "@/lib/session-user";

export async function cleanupSuspiciousImportWatches(options?: {
  maxWatches?: number;
  userId?: string;
  deleteOrphanShows?: boolean;
}) {
  const userId = options?.userId ?? (await requireUserId());
  const maxWatches = options?.maxWatches ?? 2;
  const deleteOrphanShows = options?.deleteOrphanShows !== false;

  const candidates = await prisma.show.findMany({
    where: {
      userId,
      isCustom: false,
      status: { in: ["WATCHING", "PLAN_TO_WATCH", "COMPLETED"] },
    },
    select: {
      id: true,
      title: true,
      tmdbStatus: true,
      status: true,
      inWatchlist: true,
      tvdbId: true,
      firstAirDate: true,
      episodes: {
        where: { watched: true, seasonNumber: { gte: 1 } },
        select: { tvdbId: true, watchedAt: true },
      },
    },
  });

  const toProcess = candidates.filter((s) => {
    const n = s.episodes.length;

    if (s.status === "PLAN_TO_WATCH" && n === 0) {
      return isShowEnded(s.tmdbStatus) && !s.inWatchlist;
    }

    if (n === 0 || n > maxWatches) return false;

    if (isShowEnded(s.tmdbStatus) && s.status !== "COMPLETED") return true;

    const allSameTvdb =
      s.tvdbId != null && s.episodes.every((e) => e.tvdbId === s.tvdbId);
    if (allSameTvdb) return true;

    if (s.firstAirDate) {
      const premiere = new Date(s.firstAirDate);
      const allBeforeAir = s.episodes.every(
        (e) => e.watchedAt != null && e.watchedAt < premiere,
      );
      if (allBeforeAir) return true;
    }

    return false;
  });

  let watchesRemoved = 0;
  let showsDeleted = 0;
  const titles: string[] = [];

  for (const show of toProcess) {
    if (show.episodes.length > 0) {
      const deleted = await prisma.episodeWatch.deleteMany({
        where: { showId: show.id, watched: true, seasonNumber: { gte: 1 } },
      });
      watchesRemoved += deleted.count;
    }

    if (deleteOrphanShows) {
      await prisma.show.delete({ where: { id: show.id } });
      showsDeleted++;
    } else {
      await prisma.show.update({
        where: { id: show.id },
        data: { status: "PLAN_TO_WATCH", inWatchlist: true },
      });
    }
    titles.push(show.title);
  }

  if (titles.length > 0) invalidateLibraryCache();

  return {
    showsCleaned: titles.length,
    showsDeleted,
    watchesRemoved,
    titles,
  };
}

export async function cleanupDuplicateEpisodeBindings(options?: {
  maxResolve?: number;
}) {
  const maxResolve = options?.maxResolve ?? 400;

  const watches = await prisma.episodeWatch.findMany({
    where: { watched: true, seasonNumber: { gte: 1 }, tvdbId: { not: null } },
    select: {
      id: true,
      tvdbId: true,
      showId: true,
      show: { select: { id: true, tmdbId: true, title: true, inWatchlist: true } },
    },
  });

  const byTvdb = new Map<number, typeof watches>();
  for (const w of watches) {
    if (w.tvdbId == null) continue;
    const list = byTvdb.get(w.tvdbId) ?? [];
    list.push(w);
    byTvdb.set(w.tvdbId, list);
  }

  const dupGroups = [...byTvdb.entries()].filter(([, list]) => {
    return new Set(list.map((w) => w.showId)).size > 1;
  });

  const { findShowByEpisodeTvdbId } = await import("@/lib/tmdb");
  const correctTmdbByEpisode = new Map<number, number>();
  let resolved = 0;
  let watchesRemoved = 0;
  const touchedShows = new Set<string>();
  const removedFrom: string[] = [];

  for (const [episodeTvdb, list] of dupGroups) {
    if (resolved >= maxResolve) break;

    let correctTmdb = correctTmdbByEpisode.get(episodeTvdb);
    if (correctTmdb == null) {
      try {
        const hit = await findShowByEpisodeTvdbId(episodeTvdb);
        resolved++;
        if (!hit?.show?.id) continue;
        correctTmdb = hit.show.id;
        correctTmdbByEpisode.set(episodeTvdb, correctTmdb);
        await new Promise((r) => setTimeout(r, 40));
      } catch {
        resolved++;
        continue;
      }
    }

    for (const w of list) {
      if (w.show.tmdbId === correctTmdb) continue;
      await prisma.episodeWatch.delete({ where: { id: w.id } });
      watchesRemoved++;
      touchedShows.add(w.showId);
      removedFrom.push(`${w.show.title} ← ep ${episodeTvdb}`);
    }
  }

  let showsDeleted = 0;
  const deletedTitles: string[] = [];
  for (const showId of touchedShows) {
    const left = await prisma.episodeWatch.count({
      where: { showId, watched: true, seasonNumber: { gte: 1 } },
    });
    if (left > 0) continue;
    const show = await prisma.show.findUnique({
      where: { id: showId },
      select: { title: true, inWatchlist: true, status: true },
    });
    if (!show) continue;
    if (show.inWatchlist || show.status === "PLAN_TO_WATCH") {
      await prisma.show.update({
        where: { id: showId },
        data: { status: "PLAN_TO_WATCH", inWatchlist: true },
      });
      continue;
    }
    await prisma.show.delete({ where: { id: showId } });
    showsDeleted++;
    deletedTitles.push(show.title);
  }

  if (watchesRemoved > 0 || showsDeleted > 0) invalidateLibraryCache();

  return {
    duplicateEpisodeIds: dupGroups.length,
    resolved,
    watchesRemoved,
    showsDeleted,
    deletedTitles,
    sampleRemovals: removedFrom.slice(0, 30),
  };
}
