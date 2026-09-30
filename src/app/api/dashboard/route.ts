import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/shows";
import { getUpcomingEpisodes } from "@/lib/tmdb";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session-user";

export async function GET() {
  try {
    const userId = await requireUserId();
    const [stats, watchingShows] = await Promise.all([
      getDashboardStats(userId),
      prisma.show.findMany({
        where: {
          userId,
          status: "WATCHING",
          tmdbId: { not: null },
          episodes: { some: { watched: true, seasonNumber: { gte: 1 } } },
        },
        select: { tmdbId: true },
        take: 20,
      }),
    ]);

    const upcoming = await getUpcomingEpisodes(
      watchingShows.map((s) => s.tmdbId).filter((id): id is number => id != null),
    );

    return NextResponse.json({ stats, upcoming });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Dashboard failed" },
      { status: 500 },
    );
  }
}
