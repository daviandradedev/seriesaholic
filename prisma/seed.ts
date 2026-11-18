import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  getPopularShows,
  getTopRatedShows,
  getTrendingShows,
  getShowDetails,
} from "../src/lib/tmdb";

const prisma = new PrismaClient();

const CATEGORIES = [
  { key: "trending", fetch: getTrendingShows },
  { key: "popular", fetch: getPopularShows },
  { key: "top_rated", fetch: getTopRatedShows },
] as const;

async function main() {
  console.log("Seeding the TMDB catalog...");
  const seen = new Set<number>();
  let upserted = 0;

  for (const { key, fetch } of CATEGORIES) {
    console.log(`\n→ ${key}`);

    for (let page = 1; page <= 5; page++) {
      const [data, english] = await Promise.all([
        fetch(page, "pt-BR"),
        fetch(page, "en-US").catch(() => ({ results: [], total_pages: 0 })),
      ]);
      const englishById = new Map(english.results.map((show) => [show.id, show]));
      console.log(`  page ${page}: ${data.results.length} shows`);

      for (const show of data.results) {
        if (seen.has(show.id)) continue;
        seen.add(show.id);

        const external = await getShowDetails(show.id)
          .then((details) => details.external_ids)
          .catch(() => undefined);
        const en = englishById.get(show.id);

        await prisma.catalogShow.upsert({
          where: { tmdbId: show.id },
          create: {
            tmdbId: show.id,
            tvdbId: external?.tvdb_id ?? null,
            imdbId: external?.imdb_id ?? null,
            title: show.name,
            titleEn: en?.name || null,
            overview: show.overview,
            overviewEn: en?.overview || null,
            posterPath: show.poster_path,
            backdropPath: show.backdrop_path,
            firstAirDate: show.first_air_date,
            voteAverage: show.vote_average,
            popularity: show.popularity ?? null,
            category: key,
          },
          update: {
            title: show.name,
            titleEn: en?.name || undefined,
            overview: show.overview,
            overviewEn: en?.overview || undefined,
            posterPath: show.poster_path,
            backdropPath: show.backdrop_path,
            voteAverage: show.vote_average,
            popularity: show.popularity ?? undefined,
            category: key,
            syncedAt: new Date(),
          },
        });
        upserted++;
        await new Promise((r) => setTimeout(r, 80));
      }

      if (page >= data.total_pages) break;
    }
  }

  console.log(`\n✓ ${upserted} catalog shows saved (${seen.size} unique)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
