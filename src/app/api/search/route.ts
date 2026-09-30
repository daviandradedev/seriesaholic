import { NextRequest, NextResponse } from "next/server";
import { searchShows } from "@/lib/tmdb";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session-user";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q");
    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const data = await searchShows(query);
    const tracked = await prisma.show.findMany({
      where: { userId: await requireUserId(), tmdbId: { in: data.results.map((r) => r.id) } },
      select: { tmdbId: true, status: true },
    });
    const trackedMap = new Map(tracked.map((t) => [t.tmdbId, t.status]));

    const results = data.results.map((r) => ({
      ...r,
      tracked: trackedMap.has(r.id),
      status: trackedMap.get(r.id) ?? null,
    }));

    return NextResponse.json({ results, totalPages: data.total_pages });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 },
    );
  }
}
