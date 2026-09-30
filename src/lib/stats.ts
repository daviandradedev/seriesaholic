import { prisma } from "@/lib/db";
import { getSeasonDetails, getShowDetails } from "@/lib/tmdb";
import { backfillShowGenres, ensureShowGenres, findShowsForStats, parseGenresJson } from "@/lib/genres";
import { catchUpEpisodesPerWeek, isShowInProduction, sumRealMinutes } from "@/lib/domain-logic";
import { backfillWatchRuntimes } from "@/lib/watch-runtime";
import { requireUserId } from "@/lib/session-user";
import { startOfDay } from "@/lib/utils";

export type WeeklyBucket = {
  label: string;
  value: number;
  isCurrent?: boolean;
};

export type MonthBucket = {
  label: string;
  month: number;
  year: number;
  value: number;
  isCurrent?: boolean;
};

export type MarathonEntry = {
  showTitle: string;
  showTmdbId: number;
  episodes: number;
  hours: number;
  date: string;
};

export type GenreStat = {
  genre: string;
  shows: number;
};

export type WatchStats = {
  totalEpisodes: number;
  episodesLast7Days: number;
  totalWatchMinutes: number;
  episodesWithRuntime: number;
  watchMinutesLast7Days: number;
  episodesByWeek: WeeklyBucket[];
  hoursByWeek: WeeklyBucket[];
  remainingEpisodes: number;
  startedShows: number;
  upcomingByMonth: MonthBucket[];
  catchUpEpisodesPerWeek: number;
  timeToWatchHours: number;
  futureWatchHoursByMonth: MonthBucket[];
  marathons: MarathonEntry[];
  addedShows: number;
  stillInProduction: number;
  topGenres: GenreStat[];
};

function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function weekKey(d: Date) {
  return `${d.getFullYear()}-W${isoWeek(d)}`;
}

function buildWeeklyBuckets(
  items: Array<{ date: Date; episodes: number; minutes: number }>,
  weeks = 12,
): { episodes: WeeklyBucket[]; hours: WeeklyBucket[] } {
  const now = new Date();
  const buckets = new Map<string, { episodes: number; minutes: number; label: string }>();

  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const key = weekKey(d);
    buckets.set(key, { episodes: 0, minutes: 0, label: String(isoWeek(d)) });
  }

  for (const item of items) {
    const key = weekKey(item.date);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.episodes += item.episodes;
      if (item.minutes > 0) bucket.minutes += item.minutes;
    }
  }

  const currentKey = weekKey(now);
  const entries = [...buckets.entries()];

  return {
    episodes: entries.map(([key, b]) => ({
      label: b.label,
      value: b.episodes,
      isCurrent: key === currentKey,
    })),
    hours: entries.map(([key, b]) => ({
      label: b.label,
      value: Math.round((b.minutes / 60) * 10) / 10,
      isCurrent: key === currentKey,
    })),
  };
}

const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function buildMonthBuckets(count = 6): MonthBucket[] {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    buckets.push({
      label: MONTH_LABELS[d.getMonth()],
      month: d.getMonth(),
      year: d.getFullYear(),
      value: 0,
      isCurrent: i === 0,
    });
  }
  return buckets;
}

function monthIndex(year: number, month: number, startYear: number, startMonth: number) {
  return (year - startYear) * 12 + (month - startMonth);
}

async function getUpcomingForWatchingShows(
  watching: Array<{ tmdbId: number; title: string }>,
) {
  const upcoming: Array<{ airDate: Date; runtimeMinutes: number | null }> = [];
  const today = startOfDay(new Date());

  for (const show of watching.slice(0, 35)) {
    try {
      const details = await getShowDetails(show.tmdbId);
      const seasonNum = details.number_of_seasons;
      if (seasonNum <= 0) continue;

      const season = await getSeasonDetails(show.tmdbId, seasonNum);
      for (const ep of season.episodes) {
        if (!ep.air_date) continue;
        const air = startOfDay(new Date(ep.air_date));
        if (air >= today) {
          upcoming.push({
            airDate: air,
            runtimeMinutes: ep.runtime ?? null,
          });
        }
      }
      await new Promise((r) => setTimeout(r, 40));
    } catch {
    }
  }

  return upcoming;
}

export async function getWatchStats(): Promise<WatchStats> {
  const userId = await requireUserId();
  await backfillShowGenres(40, userId);
  await backfillWatchRuntimes({ maxSeasons: 8, userId });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const regularSeason = { seasonNumber: { gte: 1 } };

  const ownWatches = { show: { userId } };
  const [allWatches, recentWatches, shows, marathonRows] = await Promise.all([
    prisma.episodeWatch.findMany({
      where: { watched: true, ...regularSeason, ...ownWatches },
      select: { watchedAt: true, runtimeMinutes: true },
    }),
    prisma.episodeWatch.findMany({
      where: { watched: true, watchedAt: { gte: sixtyDaysAgo }, ...regularSeason, ...ownWatches },
      select: { watchedAt: true },
    }),
    findShowsForStats(),
    prisma.$queryRaw<
      Array<{ showId: string; day: Date; episodes: bigint; minutes: bigint | null }>
    >`
      SELECT ew."showId", DATE(ew."watchedAt") as day,
             COUNT(*)::bigint as episodes,
             COALESCE(SUM(ew."runtimeMinutes"), 0)::bigint as minutes
      FROM "EpisodeWatch" ew
      INNER JOIN "Show" s ON s.id = ew."showId"
      WHERE ew.watched = true
        AND ew."watchedAt" IS NOT NULL
        AND ew."seasonNumber" >= 1
        AND s."userId" = ${userId}
      GROUP BY ew."showId", DATE(ew."watchedAt")
      ORDER BY episodes DESC
      LIMIT 10
    `,
  ]);

  const enrichedShows = await ensureShowGenres(shows);

  const totalEpisodes = allWatches.length;
  const episodesLast7Days = allWatches.filter(
    (w) => w.watchedAt && w.watchedAt >= sevenDaysAgo,
  ).length;

  const episodesWithRuntime = allWatches.filter(
    (w) => w.runtimeMinutes != null && w.runtimeMinutes > 0,
  ).length;

  const totalWatchMinutes = sumRealMinutes(allWatches);
  const watchMinutesLast7Days = sumRealMinutes(
    allWatches.filter((w) => w.watchedAt && w.watchedAt >= sevenDaysAgo),
  );

  const weeklyItems = allWatches
    .filter((w) => w.watchedAt && w.runtimeMinutes != null && w.runtimeMinutes > 0)
    .map((w) => ({
      date: w.watchedAt!,
      episodes: 1,
      minutes: w.runtimeMinutes!,
    }));

  const { episodes: episodesByWeek, hours: hoursByWeek } = buildWeeklyBuckets(weeklyItems);

  const withRuntime = allWatches.filter((w) => w.runtimeMinutes != null && w.runtimeMinutes > 0);
  const avgRuntime =
    withRuntime.length > 0
      ? withRuntime.reduce((s, w) => s + (w.runtimeMinutes ?? 0), 0) / withRuntime.length
      : 0;

  let remainingEpisodes = 0;
  let startedShows = 0;
  const watchingForUpcoming: Array<{ tmdbId: number; title: string }> = [];

  const progressBatch = enrichedShows.filter(
    (s) => s._count.episodes > 0 && s.status !== "PLAN_TO_WATCH",
  );

  const progressResults = await Promise.all(
    progressBatch.slice(0, 60).map(async (show) => {
      if (show.tmdbId == null) {
        return { remaining: 0, watching: null as { tmdbId: number; title: string } | null };
      }
      try {
        const details = await getShowDetails(show.tmdbId);
        const total = details.number_of_episodes;
        const watched = show._count.episodes;
        if (watched > 0 && watched < total) {
          return {
            remaining: total - watched,
            watching:
              show.status === "WATCHING"
                ? { tmdbId: show.tmdbId, title: show.title }
                : null,
          };
        }
      } catch {
      }
      return { remaining: 0, watching: null as { tmdbId: number; title: string } | null };
    }),
  );

  for (const result of progressResults) {
    if (result.remaining > 0) {
      remainingEpisodes += result.remaining;
      startedShows++;
      if (result.watching) watchingForUpcoming.push(result.watching);
    }
  }

  const upcomingEpisodes = await getUpcomingForWatchingShows(watchingForUpcoming);
  const upcomingByMonth = buildMonthBuckets(6);
  const futureWatchHoursByMonth = buildMonthBuckets(6);

  if (upcomingByMonth.length > 0) {
    const start = upcomingByMonth[0];
    for (const ep of upcomingEpisodes) {
      const idx = monthIndex(
        ep.airDate.getFullYear(),
        ep.airDate.getMonth(),
        start.year,
        start.month,
      );
      if (idx >= 0 && idx < upcomingByMonth.length) {
        upcomingByMonth[idx].value += 1;
        if (ep.runtimeMinutes != null) {
          futureWatchHoursByMonth[idx].value +=
            Math.round((ep.runtimeMinutes / 60) * 10) / 10;
        }
      }
    }
  }

  const catchUpEpisodesPerWeekValue = catchUpEpisodesPerWeek(recentWatches.length);
  const timeToWatchHours =
    avgRuntime > 0 ? Math.round((remainingEpisodes * avgRuntime) / 60) : 0;

  const showMap = new Map(enrichedShows.map((s) => [s.id, s]));
  const marathons: MarathonEntry[] = marathonRows.map((row) => {
    const show = showMap.get(row.showId);
    const minutes = Number(row.minutes ?? 0);
    return {
      showTitle: show?.title ?? "Show",
      showTmdbId: show?.tmdbId ?? 0,
      episodes: Number(row.episodes),
      hours: minutes > 0 ? Math.round(minutes / 60) : 0,
      date: row.day.toISOString().slice(0, 10),
    };
  });

  const genreCounts = new Map<string, number>();
  for (const show of enrichedShows) {
    for (const genre of parseGenresJson(show.genres)) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }

  const topGenres = [...genreCounts.entries()]
    .map(([genre, count]) => ({ genre, shows: count }))
    .sort((a, b) => b.shows - a.shows)
    .slice(0, 10);

  return {
    totalEpisodes,
    episodesLast7Days,
    totalWatchMinutes,
    episodesWithRuntime,
    watchMinutesLast7Days,
    episodesByWeek,
    hoursByWeek,
    remainingEpisodes,
    startedShows,
    upcomingByMonth,
    catchUpEpisodesPerWeek: catchUpEpisodesPerWeekValue,
    timeToWatchHours,
    futureWatchHoursByMonth,
    marathons,
    addedShows: enrichedShows.length,
    stillInProduction: enrichedShows.filter((s) => isShowInProduction(s.tmdbStatus)).length,
    topGenres,
  };
}
