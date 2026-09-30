import { prisma } from "@/lib/db";
import { discoverByGenres, getGenreIdMap, getShowDetails } from "@/lib/tmdb";
import { backfillShowGenres, parseGenresJson, serializeGenres } from "@/lib/genres";
import {
  buildGenreWeights,
  scoreShowCompatibility,
  type UserTasteProfile,
} from "@/lib/domain-logic";
import { withSchemaFallback } from "@/lib/prisma-safe";
import { requireUserId } from "@/lib/session-user";

export type ScoredShow = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  voteAverage: number | null;
  firstAirDate: string | null;
  compatibilityScore: number;
  matchingGenres: string[];
  category: string;
};

export type { UserTasteProfile };

async function loadShowsForProfile(userId: string) {
  return withSchemaFallback(
    () =>
      prisma.show.findMany({
        where: { userId },
        include: {
          _count: { select: { episodes: { where: { watched: true, seasonNumber: { gte: 1 } } } } },
        },
      }),
    () =>
      prisma.show.findMany({
        where: { userId },
        select: {
          id: true,
          tmdbId: true,
          title: true,
          status: true,
          posterPath: true,
          backdropPath: true,
          overview: true,
          tvdbId: true,
          imdbId: true,
          firstAirDate: true,
          inWatchlist: true,
          userRating: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { episodes: { where: { watched: true, seasonNumber: { gte: 1 } } } } },
        },
      }).then((rows) => rows.map((row) => ({ ...row, genres: null, tmdbStatus: null }))),
  );
}

export async function buildUserTasteProfile(userId?: string): Promise<UserTasteProfile> {
  const scopeUserId = userId ?? (await requireUserId());
  await backfillShowGenres(50, scopeUserId);
  const shows = await loadShowsForProfile(scopeUserId);

  return buildGenreWeights(
    shows.map((show) => ({
      genres: parseGenresJson(show.genres),
      episodeCount: show._count.episodes,
    })),
  );
}

async function enrichCatalogGenres(
  items: Array<{ tmdbId: number; genres: string | null }>,
) {
  const missing = items.filter((i) => parseGenresJson(i.genres).length === 0);
  for (const item of missing.slice(0, 15)) {
    try {
      const details = await getShowDetails(item.tmdbId);
      const genres = serializeGenres(details.genres.map((g) => g.name));
      await withSchemaFallback(
        () =>
          prisma.catalogShow.update({
            where: { tmdbId: item.tmdbId },
            data: { genres },
          }),
        () => undefined,
      );
      item.genres = genres;
      await new Promise((r) => setTimeout(r, 50));
    } catch {
    }
  }
}

async function loadCatalogCandidates(trackedIds: number[]) {
  return prisma.catalogShow.findMany({
    where: trackedIds.length > 0 ? { tmdbId: { notIn: trackedIds } } : {},
    take: 200,
  });
}

export async function getPersonalizedRecommendations(limit = 48, userId?: string): Promise<{
  profile: UserTasteProfile;
  shows: ScoredShow[];
}> {
  const scopeUserId = userId ?? (await requireUserId());
  const profile = await buildUserTasteProfile(scopeUserId);
  const trackedIds = (
    await prisma.show.findMany({
      where: { userId: scopeUserId, tmdbId: { not: null } },
      select: { tmdbId: true },
    })
  )
    .map((s) => s.tmdbId)
    .filter((id): id is number => id != null);

  let candidates = await loadCatalogCandidates(trackedIds);
  await enrichCatalogGenres(candidates);
  candidates = await loadCatalogCandidates(trackedIds);

  const scored: ScoredShow[] = candidates.map((show) => {
    const genres = parseGenresJson(show.genres);
    const { score, matching } = scoreShowCompatibility(genres, profile);
    return {
      tmdbId: show.tmdbId,
      title: show.title,
      posterPath: show.posterPath,
      voteAverage: show.voteAverage,
      firstAirDate: show.firstAirDate,
      compatibilityScore: score,
      matchingGenres: matching,
      category: "for_you",
    };
  });

  scored.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

  const topScored = scored.filter((s) => s.compatibilityScore > 0).slice(0, limit);

  if (topScored.length >= limit || profile.topGenres.length === 0) {
    return { profile, shows: topScored.slice(0, limit) };
  }

  const genreMap = await getGenreIdMap();
  const genreIds = profile.topGenres
    .map((g) => genreMap.get(g))
    .filter((id): id is number => id != null)
    .slice(0, 3);

  if (genreIds.length > 0) {
    const seen = new Set([...trackedIds, ...topScored.map((s) => s.tmdbId)]);
    try {
      const discovered = await discoverByGenres(genreIds, 1);
      for (const item of discovered.results) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);

        let genres: string[] = [];
        try {
          const details = await getShowDetails(item.id);
          genres = details.genres.map((g) => g.name);
          const genreJson = serializeGenres(genres);
          await withSchemaFallback(
            () =>
              prisma.catalogShow.upsert({
                where: { tmdbId: item.id },
                create: {
                  tmdbId: item.id,
                  title: item.name,
                  overview: item.overview,
                  posterPath: item.poster_path,
                  backdropPath: item.backdrop_path,
                  firstAirDate: item.first_air_date,
                  voteAverage: item.vote_average,
                  popularity: item.popularity ?? null,
                  genres: genreJson,
                  category: "for_you",
                },
                update: {
                  genres: genreJson,
                  popularity: item.popularity ?? undefined,
                },
              }),
            () => undefined,
          );
        } catch {
        }

        const { score, matching } = scoreShowCompatibility(genres, profile);
        topScored.push({
          tmdbId: item.id,
          title: item.name,
          posterPath: item.poster_path,
          voteAverage: item.vote_average,
          firstAirDate: item.first_air_date,
          compatibilityScore: score,
          matchingGenres: matching,
          category: "for_you",
        });

        if (topScored.length >= limit) break;
      }
      topScored.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    } catch {
    }
  }

  return { profile, shows: topScored.slice(0, limit) };
}
