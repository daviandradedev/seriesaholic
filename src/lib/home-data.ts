import { unstable_cache } from "next/cache";
import { getDashboardStats } from "@/lib/shows";
import { getWatchQueue } from "@/lib/watch-queue";
import { getUpcomingEpisodes } from "@/lib/tmdb";
import { HOME_TMDB_CACHE_TAG, LIBRARY_CACHE_TAG } from "@/lib/cache-tags";
import { requireUserId } from "@/lib/session-user";

async function loadHomeLibrary(userId: string) {
  const [stats, queue] = await Promise.all([
    getDashboardStats(userId),
    getWatchQueue({ userId }),
  ]);

  const watchingTmdbIds = [
    ...queue.watchNext,
    ...queue.backlog,
    ...queue.upToDate,
  ]
    .map((s) => s.tmdbId)
    .filter((id): id is number => id != null)
    .filter((id, i, arr) => arr.indexOf(id) === i)
    .slice(0, 12);

  return { stats, queue, watchingTmdbIds };
}

const loadCachedHomeLibrary = unstable_cache(loadHomeLibrary, ["home-library"], {
  tags: [LIBRARY_CACHE_TAG],
  revalidate: 60,
});

export async function getCachedHomeLibrary() {
  const userId = await requireUserId();
  return loadCachedHomeLibrary(userId);
}

export async function getCachedHomeUpcoming(watchingTmdbIds: number[]) {
  if (watchingTmdbIds.length === 0) return [];
  const userId = await requireUserId();
  const key = watchingTmdbIds.slice().sort((a, b) => a - b).join(",");
  return unstable_cache(
    () => getUpcomingEpisodes(watchingTmdbIds).catch(() => []),
    ["home-upcoming", userId, key],
    { tags: [HOME_TMDB_CACHE_TAG], revalidate: 3600 },
  )();
}
