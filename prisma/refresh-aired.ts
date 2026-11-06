import "dotenv/config";
import { prisma } from "../src/lib/db";
import { recomputeShowAiredPending, syncLibraryStatuses } from "../src/lib/watch-queue";

const CONCURRENCY = 4;

async function main() {
  const shows = await prisma.show.findMany({
    where: { isCustom: false, tmdbId: { not: null } },
    select: { id: true },
  });
  console.log(`Recounting aired episodes for ${shows.length} shows...`);
  let next = 0;
  let failed = 0;

  async function worker() {
    while (next < shows.length) {
      const show = shows[next]!;
      next += 1;
      await recomputeShowAiredPending(show.id).catch(() => {
        failed += 1;
      });
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, shows.length) }, () => worker()));
  const unchecked = await prisma.show.count({
    where: { isCustom: false, tmdbId: { not: null }, airedCheckedAt: null },
  });
  const owners = await prisma.show.findMany({ select: { userId: true }, distinct: ["userId"] });
  let completed = 0;
  for (const { userId } of owners) completed += await syncLibraryStatuses(userId);
  console.log(`✓ done, ${failed} failed, ${unchecked} still unchecked, ${completed} marked as finished`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
