import { prisma } from "@/lib/db";
import { invalidateLibraryCache } from "@/lib/cache-tags";
import { isGuestId } from "@/lib/guest-session";

export async function claimGuestLibrary(guestId: string, userId: string) {
  if (!isGuestId(guestId) || guestId === userId) return;

  const guestShows = await prisma.show.findMany({
    where: { userId: guestId },
    include: { episodes: true },
  });

  for (const show of guestShows) {
    const existing =
      show.tmdbId == null
        ? null
        : await prisma.show.findFirst({
            where: { userId, tmdbId: show.tmdbId },
            select: { id: true },
          });

    if (!existing) {
      await prisma.show.update({ where: { id: show.id }, data: { userId } });
      continue;
    }

    for (const episode of show.episodes) {
      await prisma.episodeWatch.upsert({
        where: {
          showId_seasonNumber_episodeNumber: {
            showId: existing.id,
            seasonNumber: episode.seasonNumber,
            episodeNumber: episode.episodeNumber,
          },
        },
        create: {
          showId: existing.id,
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          tvdbId: episode.tvdbId,
          episodeName: episode.episodeName,
          watched: episode.watched,
          watchedAt: episode.watchedAt,
          rating: episode.rating,
          runtimeMinutes: episode.runtimeMinutes,
        },
        update: {
          watched: episode.watched,
          watchedAt: episode.watchedAt,
          rating: episode.rating,
          runtimeMinutes: episode.runtimeMinutes,
        },
      });
    }

    await prisma.show.delete({ where: { id: show.id } });
  }

  await prisma.importLog.updateMany({ where: { userId: guestId }, data: { userId } });
  await prisma.importJob.updateMany({ where: { userId: guestId }, data: { userId } });
  invalidateLibraryCache();
}
