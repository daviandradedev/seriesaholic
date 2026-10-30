import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getEnglishShowText } from "../src/lib/tmdb";

const prisma = new PrismaClient();
const CONCURRENCY = 6;

async function missingTmdbIds() {
  const [shows, catalog] = await Promise.all([
    prisma.show.findMany({
      where: { titleEn: null, isCustom: false, tmdbId: { not: null } },
      select: { tmdbId: true },
      distinct: ["tmdbId"],
    }),
    prisma.catalogShow.findMany({
      where: { titleEn: null },
      select: { tmdbId: true },
    }),
  ]);
  const ids = new Set<number>();
  for (const row of [...shows, ...catalog]) {
    if (row.tmdbId != null) ids.add(row.tmdbId);
  }
  return [...ids];
}

async function fill(tmdbId: number) {
  const english = await getEnglishShowText(tmdbId);
  if (!english.titleEn) return false;
  await prisma.$transaction([
    prisma.show.updateMany({ where: { tmdbId, isCustom: false, titleEn: null }, data: english }),
    prisma.catalogShow.updateMany({ where: { tmdbId, titleEn: null }, data: english }),
  ]);
  return true;
}

async function main() {
  const ids = await missingTmdbIds();
  console.log(`Filling English text for ${ids.length} shows...`);
  let next = 0;
  let filled = 0;
  let failed = 0;

  async function worker() {
    while (next < ids.length) {
      const tmdbId = ids[next]!;
      next += 1;
      try {
        if (await fill(tmdbId)) filled += 1;
      } catch {
        failed += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () => worker()));
  console.log(`✓ ${filled} filled, ${failed} failed`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
