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
  console.log("Populando catálogo TMDB no Neon...");
  const seen = new Set<number>();
  let upserted = 0;

  for (const { key, fetch } of CATEGORIES) {
    console.log(`\n→ ${key}`);

    for (let page = 1; page <= 5; page++) {
      const data = await fetch(page);
      console.log(`  página ${page}: ${data.results.length} séries`);

      for (const show of data.results) {
        if (seen.has(show.id)) continue;
        seen.add(show.id);

        let external: { imdb_id: string | null; tvdb_id: number | null } | undefined;
        try {
          const details = await getShowDetails(show.id);
          external = details.external_ids;
        } catch {
          // ok
        }

        await prisma.catalogShow.upsert({
          where: { tmdbId: show.id },
          create: {
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
            category: key,
          },
          update: {
            title: show.name,
            overview: show.overview,
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

  console.log(`\n✓ ${upserted} séries cadastradas no catálogo (${seen.size} únicas)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
