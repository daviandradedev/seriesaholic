import { prisma } from "@/lib/db";
import { sumRealMinutes } from "@/lib/domain-logic";
import { requireUserId } from "@/lib/session-user";
import { getSeasonDetails } from "@/lib/tmdb";

type SeasonBackfillTarget = {
  showId: string;
  seasonNumber: number;
  tmdbId: number;
};

export async function backfillWatchRuntimes(options?: { maxSeasons?: number; userId?: string }) {
  const maxSeasons = options?.maxSeasons ?? 120;
  const userId = options?.userId ?? (await requireUserId());

  const targets = await prisma.$queryRaw<SeasonBackfillTarget[]>`
    SELECT DISTINCT ew."showId", ew."seasonNumber", s."tmdbId"::int as "tmdbId"
    FROM "EpisodeWatch" ew
    INNER JOIN "Show" s ON s.id = ew."showId"
    WHERE ew.watched = true
      AND ew."seasonNumber" >= 1
      AND ew."runtimeMinutes" IS NULL
      AND s."tmdbId" IS NOT NULL
      AND s."isCustom" = false
      AND s."userId" = ${userId}
    LIMIT ${maxSeasons}
  `;

  if (targets.length === 0) return 0;

  let updated = 0;

  for (const target of targets) {
    try {
      const season = await getSeasonDetails(target.tmdbId, target.seasonNumber);
      const runtimeByEp = new Map(
        season.episodes
          .filter((ep) => ep.runtime != null && ep.runtime > 0)
          .map((ep) => [ep.episode_number, ep.runtime!]),
      );

      if (runtimeByEp.size === 0) continue;

      const missing = await prisma.episodeWatch.findMany({
        where: {
          showId: target.showId,
          seasonNumber: target.seasonNumber,
          watched: true,
          runtimeMinutes: null,
        },
        select: { episodeNumber: true },
      });

      for (const row of missing) {
        const runtime = runtimeByEp.get(row.episodeNumber);
        if (runtime == null) continue;

        await prisma.episodeWatch.update({
          where: {
            showId_seasonNumber_episodeNumber: {
              showId: target.showId,
              seasonNumber: target.seasonNumber,
              episodeNumber: row.episodeNumber,
            },
          },
          data: { runtimeMinutes: runtime },
        });
        updated++;
      }

      await new Promise((r) => setTimeout(r, 35));
    } catch {
    }
  }

  return updated;
}

export async function getTotalWatchMinutesFromDb(userId?: string) {
  const agg = await prisma.episodeWatch.aggregate({
    where: {
      watched: true,
      seasonNumber: { gte: 1 },
      runtimeMinutes: { not: null, gt: 0 },
      ...(userId ? { show: { userId } } : {}),
    },
    _sum: { runtimeMinutes: true },
    _count: { _all: true },
  });

  return {
    totalWatchMinutes: agg._sum.runtimeMinutes ?? 0,
    episodesWithRuntime: agg._count._all,
  };
}

export function sumWatchMinutes(
  watches: Array<{ runtimeMinutes: number | null | undefined }>,
) {
  return sumRealMinutes(watches);
}
