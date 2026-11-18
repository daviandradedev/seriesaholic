import { unstable_cache } from "next/cache";
import { getDashboardStats } from "@/lib/shows";
import { getWatchQueue } from "@/lib/watch-queue";
import { recentlyAddedShows } from "@/lib/domain-logic";
import { getUpcomingEpisodes, tmdbLanguage } from "@/lib/tmdb";
import type { Language } from "@/lib/copy";
import { HOME_TMDB_CACHE_TAG, LIBRARY_CACHE_TAG } from "@/lib/cache-tags";

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

  return {
    stats,
    queue,
    recentlyAdded: recentlyAddedShows(Object.values(queue).flat()),
    watchingTmdbIds,
  };
}

export const getCachedHomeLibrary = unstable_cache(loadHomeLibrary, ["home-library"], {
  tags: [LIBRARY_CACHE_TAG],
  revalidate: 60,
});

export async function getCachedHomeUpcoming(watchingTmdbIds: number[], language: Language) {
  if (watchingTmdbIds.length === 0) return [];
  const key = watchingTmdbIds.slice().sort((a, b) => a - b).join(",");
  return unstable_cache(
    () => getUpcomingEpisodes(watchingTmdbIds, tmdbLanguage(language)).catch(() => []),
    ["home-upcoming", language, key],
    { tags: [HOME_TMDB_CACHE_TAG], revalidate: 3600 },
  )();
}
