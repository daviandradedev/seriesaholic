import { prisma } from "@/lib/db";
import {
  getPopularShows,
  getTopRatedShows,
  getTrendingShows,
  getShowDetails,
} from "@/lib/tmdb";
import { serializeGenres } from "@/lib/genres";
import { withSchemaFallback } from "@/lib/prisma-safe";
import { requireUserId } from "@/lib/session-user";

export type CatalogCategory = "trending" | "popular" | "top_rated";

const CATEGORY_LABELS: Record<CatalogCategory, string> = {
  trending: "Em alta",
  popular: "Populares",
  top_rated: "Mais bem avaliadas",
};

const FETCHERS: Record<
  CatalogCategory,
  (page: number) => ReturnType<typeof getTrendingShows>
> = {
  trending: getTrendingShows,
  popular: getPopularShows,
  top_rated: getTopRatedShows,
};

export function collectTrackedTmdbIds(
  shows: Array<{ tmdbId: number | null }>,
): number[] {
  return shows.flatMap((s) => (s.tmdbId != null ? [s.tmdbId] : []));
}

export async function syncCatalogFromTmdb() {
  const seen = new Set<number>();
  let upserted = 0;

  for (const category of Object.keys(FETCHERS) as CatalogCategory[]) {
    const fetchPage = FETCHERS[category];

    for (let page = 1; page <= 5; page++) {
      const data = await fetchPage(page);

      for (const show of data.results) {
        if (seen.has(show.id)) continue;
        seen.add(show.id);

        let external: { imdb_id: string | null; tvdb_id: number | null } | undefined;
        let genres: string | null = null;
        try {
          const details = await getShowDetails(show.id);
          external = details.external_ids;
          genres = serializeGenres(details.genres.map((g) => g.name));
        } catch {
        }

        const baseCreate = {
          tmdbId: show.id,
          tvdbId: external?.tvdb_id ?? null,
          imdbId: external?.imdb_id ?? null,
          title: show.name,
          overview: show.overview,
          posterPath: show.poster_path,
          backdropPath: show.backdrop_path,
          firstAirDate: show.first_air_date,
          voteAverage: show.vote_average,
          popularity: show.popularity ?? null,
          category,
        };

        const baseUpdate = {
          tvdbId: external?.tvdb_id ?? undefined,
          imdbId: external?.imdb_id ?? undefined,
          title: show.name,
          overview: show.overview,
          posterPath: show.poster_path,
          backdropPath: show.backdrop_path,
          firstAirDate: show.first_air_date,
          voteAverage: show.vote_average,
          popularity: show.popularity ?? undefined,
          category,
          syncedAt: new Date(),
        };

        await withSchemaFallback(
          () =>
            prisma.catalogShow.upsert({
              where: { tmdbId: show.id },
              create: { ...baseCreate, genres },
              update: { ...baseUpdate, genres: genres ?? undefined },
            }),
          () =>
            prisma.catalogShow.upsert({
              where: { tmdbId: show.id },
              create: baseCreate,
              update: baseUpdate,
            }),
        );
        upserted++;

        await new Promise((r) => setTimeout(r, 80));
      }

      if (page >= data.total_pages) break;
    }
  }

  return { upserted, total: seen.size };
}

export async function syncCatalogIfEmpty() {
  const count = await prisma.catalogShow.count();
  if (count > 0) return { synced: false as const, count };
  const result = await syncCatalogFromTmdb();
  return { synced: true as const, ...result };
}

export async function getDiscoverShows(options?: {
  category?: CatalogCategory;
  limit?: number;
  excludeTracked?: boolean;
}) {
  const { category, limit = 24, excludeTracked = true } = options ?? {};

  const userId = excludeTracked ? await requireUserId() : null;
  const trackedIds = userId
    ? collectTrackedTmdbIds(
        await prisma.show.findMany({
          where: { userId, tmdbId: { not: null } },
          select: { tmdbId: true },
        }),
      )
    : [];

  return prisma.catalogShow.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(excludeTracked && trackedIds.length > 0
        ? { tmdbId: { notIn: trackedIds } }
        : {}),
    },
    orderBy: [{ popularity: "desc" }, { voteAverage: "desc" }],
    take: limit,
  });
}

export async function getCatalogStats() {
  const [total, byCategory] = await Promise.all([
    prisma.catalogShow.count(),
    prisma.catalogShow.groupBy({
      by: ["category"],
      _count: { category: true },
    }),
  ]);

  return {
    total,
    categories: byCategory.map((c) => ({
      category: c.category as CatalogCategory,
      label: CATEGORY_LABELS[c.category as CatalogCategory] ?? c.category,
      count: c._count.category,
    })),
  };
}
