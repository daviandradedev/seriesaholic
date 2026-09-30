import { prisma } from "@/lib/db";
import { invalidateLibraryCache } from "@/lib/cache-tags";
import { clearResolveCache } from "@/lib/tmdb";
import { requireUserId } from "@/lib/session-user";

export async function resetAllUserData() {
  const userId = await requireUserId();
  const scope = { userId };
  const [watches, shows, importShows, importLogs, importJobs] =
    await prisma.$transaction([
      prisma.episodeWatch.deleteMany({ where: { show: scope } }),
      prisma.show.deleteMany({ where: scope }),
      prisma.importLogShow.deleteMany({ where: { importLog: scope } }),
      prisma.importLog.deleteMany({ where: scope }),
      prisma.importJob.deleteMany({ where: scope }),
    ]);

  clearResolveCache();
  invalidateLibraryCache();

  return {
    episodeWatchesDeleted: watches.count,
    showsDeleted: shows.count,
    importLogShowsDeleted: importShows.count,
    importLogsDeleted: importLogs.count,
    importJobsDeleted: importJobs.count,
  };
}
